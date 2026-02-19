import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');

export const config = {
  // Source site
  baseUrl: 'https://anglicanhistory.org',
  userAgent: 'AnglicanWikiBot/1.0 (+https://anglican.wiki)',

  // Crawl settings
  concurrency: 10,
  intervalMs: 300,
  maxRetries: 1,

  // Paths
  rootDir: ROOT_DIR,
  archiveDir: path.join(ROOT_DIR, 'archive'),
  manifestPath: path.join(ROOT_DIR, 'archive', '.manifest.json'),
  outputDir: path.join(ROOT_DIR, 'src/content/docs'),

  // URL patterns to skip
  skipPatterns: [
    /^mailto:/,
    /^javascript:/,
    /^#/,
    /\?/,            // query strings (search pages, etc.)
    /cgi-bin/,
    /search/i,
  ],

  // Curated content: only transform files from these top-level directories.
  // Set to null to transform everything (no filter).
  curatedDirs: [
    // Tier 1: Foundational Collections
    'tracts',       // Tracts for the Times (~86 files)
    'lact',         // Library of Anglo-Catholic Theology (~32 files)
    'hooker',       // Richard Hooker — Laws of Ecclesiastical Polity (~10 files)
    'pusey',        // E.B. Pusey (~34 files)

    // Tier 2: Major Figures
    'keble',        // John Keble (~12 files)
    'gore',         // Charles Gore (~18 files)
    'neale',        // John Mason Neale (~32 files)
    'dearmer',      // Percy Dearmer (~18 files)
    'grafton',      // Charles Chapman Grafton (~121 files)
    'liddon',       // Henry Liddon (~15 files)

    // Tier 3: Supporting Collections
    'caroline',     // Caroline Divines (~10 files)
    'reformation',  // English Reformation (~9 files)
    'liturgy',      // Liturgical texts (~29 files)
    'bcp',          // BCP-related documents (~11 files)
    'bios',         // Biographical works (~49 files)

    // Tier 4: Curated samples
    'nonjurors',    // Nonjuring tradition (~22 files)
    'essays',       // Scholarly essays (~12 files)
  ],
};
