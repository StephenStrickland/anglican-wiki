import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');

export const config = {
  // Source site
  baseUrl: 'https://anglicanhistory.org',
  userAgent: 'AnglicanWikiBot/1.0 (+https://anglican.wiki)',

  // Crawl settings
  concurrency: 2,
  intervalMs: 500,
  maxRetries: 3,

  // Paths
  rootDir: ROOT_DIR,
  archiveDir: path.join(ROOT_DIR, 'archive'),
  manifestPath: path.join(ROOT_DIR, 'archive', '.manifest.json'),
  outputDir: path.join(ROOT_DIR, 'src/content/docs/project-canterbury'),

  // URL patterns to skip
  skipPatterns: [
    /^mailto:/,
    /^javascript:/,
    /^#/,
    /\?/,            // query strings (search pages, etc.)
    /cgi-bin/,
    /search/i,
  ],
};
