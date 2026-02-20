/**
 * fetch-kjv.mjs — one-time setup script
 *
 * Downloads the public-domain King James Bible from GitHub and splits it into
 * 66 per-book JSON files under src/data/bible/, plus a manifest.json index.
 *
 * Usage:  node scripts/fetch-kjv.mjs
 *
 * The source (thiagobodruk/bible) is public domain / CC0.
 * Run this script once and commit the generated files; it does not need to be
 * run again unless you want to refresh the data.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'src', 'data', 'bible');
const KJV_URL =
  'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';

// Canonical book metadata in canonical order.
// slug: the URL-safe identifier used in /bible/{slug}/{chapter}/
// name: display name as it appears in KJV
// testament: 'OT' | 'NT'
const BOOK_META = [
  { slug: 'genesis',           name: 'Genesis',                    testament: 'OT' },
  { slug: 'exodus',            name: 'Exodus',                     testament: 'OT' },
  { slug: 'leviticus',         name: 'Leviticus',                  testament: 'OT' },
  { slug: 'numbers',           name: 'Numbers',                    testament: 'OT' },
  { slug: 'deuteronomy',       name: 'Deuteronomy',                testament: 'OT' },
  { slug: 'joshua',            name: 'Joshua',                     testament: 'OT' },
  { slug: 'judges',            name: 'Judges',                     testament: 'OT' },
  { slug: 'ruth',              name: 'Ruth',                       testament: 'OT' },
  { slug: '1-samuel',          name: '1 Samuel',                   testament: 'OT' },
  { slug: '2-samuel',          name: '2 Samuel',                   testament: 'OT' },
  { slug: '1-kings',           name: '1 Kings',                    testament: 'OT' },
  { slug: '2-kings',           name: '2 Kings',                    testament: 'OT' },
  { slug: '1-chronicles',      name: '1 Chronicles',               testament: 'OT' },
  { slug: '2-chronicles',      name: '2 Chronicles',               testament: 'OT' },
  { slug: 'ezra',              name: 'Ezra',                       testament: 'OT' },
  { slug: 'nehemiah',          name: 'Nehemiah',                   testament: 'OT' },
  { slug: 'esther',            name: 'Esther',                     testament: 'OT' },
  { slug: 'job',               name: 'Job',                        testament: 'OT' },
  { slug: 'psalms',            name: 'Psalms',                     testament: 'OT' },
  { slug: 'proverbs',          name: 'Proverbs',                   testament: 'OT' },
  { slug: 'ecclesiastes',      name: 'Ecclesiastes',               testament: 'OT' },
  { slug: 'song-of-solomon',   name: 'Song of Solomon',            testament: 'OT' },
  { slug: 'isaiah',            name: 'Isaiah',                     testament: 'OT' },
  { slug: 'jeremiah',          name: 'Jeremiah',                   testament: 'OT' },
  { slug: 'lamentations',      name: 'Lamentations',               testament: 'OT' },
  { slug: 'ezekiel',           name: 'Ezekiel',                    testament: 'OT' },
  { slug: 'daniel',            name: 'Daniel',                     testament: 'OT' },
  { slug: 'hosea',             name: 'Hosea',                      testament: 'OT' },
  { slug: 'joel',              name: 'Joel',                       testament: 'OT' },
  { slug: 'amos',              name: 'Amos',                       testament: 'OT' },
  { slug: 'obadiah',           name: 'Obadiah',                    testament: 'OT' },
  { slug: 'jonah',             name: 'Jonah',                      testament: 'OT' },
  { slug: 'micah',             name: 'Micah',                      testament: 'OT' },
  { slug: 'nahum',             name: 'Nahum',                      testament: 'OT' },
  { slug: 'habakkuk',          name: 'Habakkuk',                   testament: 'OT' },
  { slug: 'zephaniah',         name: 'Zephaniah',                  testament: 'OT' },
  { slug: 'haggai',            name: 'Haggai',                     testament: 'OT' },
  { slug: 'zechariah',         name: 'Zechariah',                  testament: 'OT' },
  { slug: 'malachi',           name: 'Malachi',                    testament: 'OT' },
  { slug: 'matthew',           name: 'Matthew',                    testament: 'NT' },
  { slug: 'mark',              name: 'Mark',                       testament: 'NT' },
  { slug: 'luke',              name: 'Luke',                       testament: 'NT' },
  { slug: 'john',              name: 'John',                       testament: 'NT' },
  { slug: 'acts',              name: 'Acts',                       testament: 'NT' },
  { slug: 'romans',            name: 'Romans',                     testament: 'NT' },
  { slug: '1-corinthians',     name: '1 Corinthians',              testament: 'NT' },
  { slug: '2-corinthians',     name: '2 Corinthians',              testament: 'NT' },
  { slug: 'galatians',         name: 'Galatians',                  testament: 'NT' },
  { slug: 'ephesians',         name: 'Ephesians',                  testament: 'NT' },
  { slug: 'philippians',       name: 'Philippians',                testament: 'NT' },
  { slug: 'colossians',        name: 'Colossians',                 testament: 'NT' },
  { slug: '1-thessalonians',   name: '1 Thessalonians',            testament: 'NT' },
  { slug: '2-thessalonians',   name: '2 Thessalonians',            testament: 'NT' },
  { slug: '1-timothy',         name: '1 Timothy',                  testament: 'NT' },
  { slug: '2-timothy',         name: '2 Timothy',                  testament: 'NT' },
  { slug: 'titus',             name: 'Titus',                      testament: 'NT' },
  { slug: 'philemon',          name: 'Philemon',                   testament: 'NT' },
  { slug: 'hebrews',           name: 'Hebrews',                    testament: 'NT' },
  { slug: 'james',             name: 'James',                      testament: 'NT' },
  { slug: '1-peter',           name: '1 Peter',                    testament: 'NT' },
  { slug: '2-peter',           name: '2 Peter',                    testament: 'NT' },
  { slug: '1-john',            name: '1 John',                     testament: 'NT' },
  { slug: '2-john',            name: '2 John',                     testament: 'NT' },
  { slug: '3-john',            name: '3 John',                     testament: 'NT' },
  { slug: 'jude',              name: 'Jude',                       testament: 'NT' },
  { slug: 'revelation',        name: 'Revelation',                 testament: 'NT' },
];

/** Fetch a URL and return the response body as a string. */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AnglicanWikiBot/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchUrl(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Fetching KJV from ${KJV_URL} …`);
  let raw = await fetchUrl(KJV_URL);

  // Strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

  const sourceBooks = JSON.parse(raw);
  if (sourceBooks.length !== 66) {
    throw new Error(`Expected 66 books, got ${sourceBooks.length}`);
  }

  const manifest = [];

  for (let i = 0; i < 66; i++) {
    const src = sourceBooks[i];
    const meta = BOOK_META[i];

    // Convert chapters array-of-arrays to object keyed by 1-based numbers
    // chapters: { "1": { "1": "verse text", "2": "verse text", ... }, ... }
    const chapters = {};
    for (let ci = 0; ci < src.chapters.length; ci++) {
      const chKey = String(ci + 1);
      chapters[chKey] = {};
      const verses = src.chapters[ci];
      for (let vi = 0; vi < verses.length; vi++) {
        chapters[chKey][String(vi + 1)] = verses[vi];
      }
    }

    const bookData = {
      slug: meta.slug,
      name: meta.name,
      testament: meta.testament,
      chapterCount: src.chapters.length,
      chapters,
    };

    const outPath = path.join(OUT_DIR, `${meta.slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(bookData, null, 2), 'utf8');
    console.log(`  ✓ ${meta.name} (${src.chapters.length} chapters)`);

    manifest.push({
      slug: meta.slug,
      name: meta.name,
      testament: meta.testament,
      chapterCount: src.chapters.length,
    });
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\nDone. ${manifest.length} books written to src/data/bible/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
