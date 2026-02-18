import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import PQueue from 'p-queue';
import { config } from './config.mjs';
import {
  normalizeUrl,
  urlToLocalPath,
  isHtmlUrl,
  isImageUrl,
  isPdfUrl,
} from './url-utils.mjs';

/**
 * Load manifest from disk, or return empty object.
 */
export async function loadManifest() {
  try {
    const data = await fs.readFile(config.manifestPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Save manifest to disk.
 */
async function saveManifest(manifest) {
  await fs.mkdir(path.dirname(config.manifestPath), { recursive: true });
  await fs.writeFile(config.manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Fetch a URL with retries and exponential backoff.
 */
async function fetchWithRetry(url, retries = config.maxRetries) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': config.userAgent },
        redirect: 'follow',
      });
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`  Retry ${attempt + 1}/${retries} for ${url} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Extract all internal links from an HTML page.
 */
function extractLinks(html, pageUrl) {
  const $ = load(html);
  const links = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const normalized = normalizeUrl(href, pageUrl);
    if (normalized) links.add(normalized);
  });

  // Also extract image sources
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    const normalized = normalizeUrl(src, pageUrl);
    if (normalized) links.add(normalized);
  });

  return links;
}

/**
 * Save response content to the archive directory.
 */
async function saveToArchive(localPath, content) {
  const fullPath = path.join(config.archiveDir, localPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  if (typeof content === 'string') {
    await fs.writeFile(fullPath, content, 'utf-8');
  } else {
    await fs.writeFile(fullPath, Buffer.from(content));
  }
}

/**
 * Main crawl function.
 */
export async function crawl({ force = false, dryRun = false } = {}) {
  const manifest = force ? {} : await loadManifest();
  const visited = new Set(Object.keys(manifest).filter(u => manifest[u].status === 200));
  const queue = new PQueue({ concurrency: config.concurrency, interval: config.intervalMs, intervalCap: config.concurrency });
  const toVisit = new Set();
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Seed with the homepage
  const startUrl = config.baseUrl + '/';
  toVisit.add(startUrl);

  console.log(`Starting crawl from ${startUrl}`);
  if (dryRun) console.log('DRY RUN — no files will be saved');
  if (force) console.log('FORCE MODE — re-crawling everything');
  console.log();

  /**
   * Process a single URL.
   */
  async function processUrl(url, parentUrl) {
    // Already visited in this session
    if (visited.has(url)) return;
    visited.add(url);

    // Already in manifest (resume mode)
    if (!force && manifest[url]?.status === 200) {
      skipped++;
      return;
    }

    const localPath = urlToLocalPath(url);

    // PDFs: record in manifest but don't download
    if (isPdfUrl(url)) {
      if (dryRun) {
        console.log(`[PDF] ${url}`);
        return;
      }
      manifest[url] = {
        localPath,
        status: 200,
        contentType: 'application/pdf',
        crawledAt: new Date().toISOString(),
        parentUrl: parentUrl || null,
      };
      processed++;
      logProgress();
      return;
    }

    if (dryRun) {
      console.log(`[WOULD CRAWL] ${url}`);
      return;
    }

    try {
      const response = await fetchWithRetry(url);
      const contentType = response.headers.get('content-type') || '';
      const status = response.status;

      manifest[url] = {
        localPath,
        status,
        contentType: contentType.split(';')[0].trim(),
        crawledAt: new Date().toISOString(),
        parentUrl: parentUrl || null,
      };

      if (status !== 200) {
        console.log(`  [${status}] ${url}`);
        errors++;
        return;
      }

      if (contentType.includes('text/html')) {
        const html = await response.text();
        await saveToArchive(localPath, html);

        // Extract and enqueue links
        const links = extractLinks(html, url);
        for (const link of links) {
          if (!visited.has(link)) {
            toVisit.add(link);
            queue.add(() => processUrl(link, url));
          }
        }
      } else if (isImageUrl(url)) {
        const buffer = await response.arrayBuffer();
        await saveToArchive(localPath, buffer);
      } else {
        // Other content types — save as-is
        const buffer = await response.arrayBuffer();
        await saveToArchive(localPath, buffer);
      }

      processed++;
      logProgress();

      // Periodically save manifest
      if (processed % 50 === 0) {
        await saveManifest(manifest);
      }
    } catch (err) {
      console.error(`  [ERROR] ${url}: ${err.message}`);
      manifest[url] = {
        localPath,
        status: 0,
        contentType: null,
        crawledAt: new Date().toISOString(),
        parentUrl: parentUrl || null,
        error: err.message,
      };
      errors++;
    }
  }

  function logProgress() {
    if (processed % 10 === 0) {
      console.log(`  Processed: ${processed} | Queue: ${queue.size} | Pending: ${queue.pending} | Errors: ${errors}`);
    }
  }

  // Seed the queue
  queue.add(() => processUrl(startUrl, null));

  // Wait for the queue to drain
  await queue.onIdle();

  // Final save
  if (!dryRun) {
    await saveManifest(manifest);
  }

  console.log();
  console.log(`Crawl complete.`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped (already archived): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total URLs in manifest: ${Object.keys(manifest).length}`);

  return manifest;
}
