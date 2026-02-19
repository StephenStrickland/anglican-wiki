#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './lib/config.mjs';
import { loadManifest } from './lib/crawler.mjs';
import { extractMetadata, cleanHtml } from './lib/html-parser.mjs';
import { htmlToMarkdown, generateMarkdownFile, generatePdfStub } from './lib/markdown-writer.mjs';
import { localPathToContentPath } from './lib/url-utils.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

/**
 * Recursively find all files with given extensions under a directory.
 */
async function findFiles(dir, extensions) {
  const results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Build the list of files to transform.
 * In curated mode, scans the archive filesystem for the curated directories.
 * Otherwise, uses the manifest.
 */
async function collectEntries() {
  if (config.curatedDirs) {
    // Scan the archive filesystem directly for curated directories
    const entries = [];
    for (const dir of config.curatedDirs) {
      const dirPath = path.join(config.archiveDir, dir);
      const htmlFiles = await findFiles(dirPath, ['.html', '.htm']);
      const pdfFiles = await findFiles(dirPath, ['.pdf']);

      for (const filePath of htmlFiles) {
        const localPath = path.relative(config.archiveDir, filePath);
        entries.push({ localPath, contentType: 'text/html' });
      }
      for (const filePath of pdfFiles) {
        const localPath = path.relative(config.archiveDir, filePath);
        entries.push({ localPath, contentType: 'application/pdf' });
      }
    }
    return entries;
  }

  // Non-curated mode: use the manifest
  const manifest = await loadManifest();
  const manifestEntries = Object.entries(manifest);
  if (manifestEntries.length === 0) {
    console.log('No entries in manifest. Run `pnpm run crawl` first.');
    process.exit(1);
  }
  return manifestEntries
    .filter(([, entry]) => entry.status === 200)
    .map(([url, entry]) => ({
      localPath: entry.localPath,
      contentType: entry.contentType,
      url,
    }));
}

async function transform() {
  const entries = await collectEntries();

  console.log(`Found ${entries.length} files to transform`);
  if (config.curatedDirs) {
    console.log(`Curated mode: scanning ${config.curatedDirs.length} directories from archive`);
  }
  if (dryRun) console.log('DRY RUN — no files will be written');
  if (force) console.log('FORCE MODE — overwriting existing .md files');
  console.log();

  let transformed = 0;
  let skipped = 0;
  let errors = 0;
  let pdfs = 0;

  for (const entry of entries) {
    try {
      const { localPath, contentType } = entry;

      // Skip non-HTML, non-PDF content
      if (!contentType?.includes('text/html') && contentType !== 'application/pdf') {
        skipped++;
        continue;
      }

      // Remap bcp/ → bcp-historical/ for output to avoid conflict with existing BCP directories
      const outputLocalPath = localPath.startsWith('bcp/')
        ? 'bcp-historical/' + localPath.slice(4)
        : localPath;

      const contentPath = localPathToContentPath(outputLocalPath);
      const outputPath = path.join(config.outputDir, contentPath);

      // Check if output already exists (unless --force)
      if (!force && !dryRun) {
        try {
          await fs.access(outputPath);
          skipped++;
          continue;
        } catch {
          // File doesn't exist, proceed with transform
        }
      }

      if (contentType === 'application/pdf') {
        const title = titleFromPath(localPath);
        const metadata = {
          title,
          description: `${title}. From Project Canterbury.`,
        };
        const pdfUrl = `${config.baseUrl}/${localPath}`;

        if (dryRun) {
          console.log(`[PDF STUB] ${contentPath}`);
        } else {
          const mdContent = generatePdfStub(metadata, pdfUrl);
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, mdContent, 'utf-8');
        }
        pdfs++;
        transformed++;
        continue;
      }

      // HTML → Markdown transform
      const archivePath = path.join(config.archiveDir, localPath);
      let html;
      try {
        html = await fs.readFile(archivePath, 'utf-8');
      } catch {
        console.log(`  [MISSING] ${localPath} — archived file not found`);
        errors++;
        continue;
      }

      const metadata = extractMetadata(html, localPath);
      const cleaned = cleanHtml(html);
      const markdown = htmlToMarkdown(cleaned, localPath);
      const mdFile = generateMarkdownFile(metadata, markdown);

      if (dryRun) {
        console.log(`[TRANSFORM] ${contentPath} — "${metadata.title}"`);
      } else {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, mdFile, 'utf-8');
      }

      transformed++;

      if (transformed % 100 === 0) {
        console.log(`  Progress: ${transformed} transformed, ${skipped} skipped, ${errors} errors`);
      }
    } catch (err) {
      console.error(`  [ERROR] ${entry.localPath}: ${err.message}`);
      errors++;
    }
  }

  console.log();
  console.log('Transform complete.');
  console.log(`  Transformed: ${transformed} (including ${pdfs} PDF stubs)`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

function titleFromPath(localPath) {
  const parts = localPath.replace(/\.(html?|pdf)$/i, '').split('/');
  const last = parts[parts.length - 1] || parts[parts.length - 2] || 'Untitled';
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

try {
  await transform();
} catch (err) {
  console.error('Transform failed:', err);
  process.exit(1);
}
