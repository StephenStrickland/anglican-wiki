#!/usr/bin/env node

import { crawl } from './lib/crawler.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

try {
  await crawl({ force, dryRun });
} catch (err) {
  console.error('Crawl failed:', err);
  process.exit(1);
}
