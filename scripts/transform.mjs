#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './lib/config.mjs';
import { loadManifest } from './lib/crawler.mjs';
import { extractMetadata, cleanHtml } from './lib/html-parser.mjs';
import { htmlToMarkdown, generateMarkdownFile, generatePdfStub } from './lib/markdown-writer.mjs';
import { localPathToContentPath, isPdfUrl, urlToLocalPath } from './lib/url-utils.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

async function transform() {
  const manifest = await loadManifest();
  const entries = Object.entries(manifest);

  if (entries.length === 0) {
    console.log('No entries in manifest. Run `pnpm run crawl` first.');
    process.exit(1);
  }

  console.log(`Found ${entries.length} entries in manifest`);
  if (dryRun) console.log('DRY RUN — no files will be written');
  if (force) console.log('FORCE MODE — overwriting existing .md files');
  console.log();

  let transformed = 0;
  let skipped = 0;
  let errors = 0;
  let pdfs = 0;

  for (const [url, entry] of entries) {
    try {
      // Skip failed entries
      if (entry.status !== 200) {
        skipped++;
        continue;
      }

      const contentPath = localPathToContentPath(entry.localPath);
      const outputPath = path.join(config.outputDir, contentPath);

      // Skip non-HTML, non-PDF content (images, etc.)
      if (!entry.contentType?.includes('text/html') && entry.contentType !== 'application/pdf') {
        skipped++;
        continue;
      }

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

      if (entry.contentType === 'application/pdf') {
        // Generate PDF stub page
        const title = titleFromPath(entry.localPath);
        const metadata = {
          title,
          description: `${title}. From Project Canterbury.`,
        };

        if (dryRun) {
          console.log(`[PDF STUB] ${contentPath}`);
        } else {
          const mdContent = generatePdfStub(metadata, url);
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, mdContent, 'utf-8');
        }
        pdfs++;
        transformed++;
        continue;
      }

      // HTML → Markdown transform
      const archivePath = path.join(config.archiveDir, entry.localPath);
      let html;
      try {
        html = await fs.readFile(archivePath, 'utf-8');
      } catch {
        console.log(`  [MISSING] ${entry.localPath} — archived file not found`);
        errors++;
        continue;
      }

      // Extract metadata
      const metadata = extractMetadata(html, entry.localPath);

      // Clean HTML
      const cleaned = cleanHtml(html);

      // Convert to Markdown
      const markdown = htmlToMarkdown(cleaned);

      // Generate complete file with frontmatter
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
      console.error(`  [ERROR] ${url}: ${err.message}`);
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
