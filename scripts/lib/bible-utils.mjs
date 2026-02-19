/**
 * Bible utilities: book name normalization, roman numeral parsing, URL building.
 * Used by both the fetch script and the remark scripture citations plugin.
 */

/**
 * Maps every abbreviation form found in the Anglican corpus to a canonical URL slug.
 * Covers classical Anglican citation styles (e.g. "Matt.", "S. Matt.", "1 Cor."),
 * liturgical abbreviations (e.g. "Cant." for Song of Solomon, "Apoc." for Revelation),
 * and modern short forms.
 */
export const BOOK_ALIASES = {
  // ── Old Testament ──────────────────────────────────────────────────────────
  // Genesis
  'gen': 'genesis', 'gene': 'genesis', 'genesis': 'genesis',
  // Exodus
  'exod': 'exodus', 'exo': 'exodus', 'exodus': 'exodus',
  // Leviticus
  'lev': 'leviticus', 'levit': 'leviticus', 'leviticus': 'leviticus',
  // Numbers
  'num': 'numbers', 'numb': 'numbers', 'numbers': 'numbers',
  // Deuteronomy
  'deut': 'deuteronomy', 'deu': 'deuteronomy', 'deuteronomy': 'deuteronomy',
  // Joshua
  'josh': 'joshua', 'jos': 'joshua', 'joshua': 'joshua',
  // Judges
  'judg': 'judges', 'jud': 'judges', 'judges': 'judges',
  // Ruth
  'ruth': 'ruth',
  // 1 Samuel
  '1sam': '1-samuel', '1 sam': '1-samuel', '1samuel': '1-samuel',
  '1 samuel': '1-samuel',
  // 2 Samuel
  '2sam': '2-samuel', '2 sam': '2-samuel', '2samuel': '2-samuel',
  '2 samuel': '2-samuel',
  // 1 Kings
  '1kings': '1-kings', '1 kings': '1-kings', '1kgs': '1-kings', '1 kgs': '1-kings',
  // 2 Kings
  '2kings': '2-kings', '2 kings': '2-kings', '2kgs': '2-kings', '2 kgs': '2-kings',
  // 1 Chronicles
  '1chr': '1-chronicles', '1chron': '1-chronicles', '1 chron': '1-chronicles',
  '1 chr': '1-chronicles', '1chronicles': '1-chronicles',
  // 2 Chronicles
  '2chr': '2-chronicles', '2chron': '2-chronicles', '2 chron': '2-chronicles',
  '2 chr': '2-chronicles', '2chronicles': '2-chronicles',
  // Ezra
  'ezra': 'ezra', 'ezr': 'ezra',
  // Nehemiah
  'neh': 'nehemiah', 'nehemiah': 'nehemiah',
  // Esther
  'esth': 'esther', 'est': 'esther', 'esther': 'esther',
  // Job
  'job': 'job',
  // Psalms
  'ps': 'psalms', 'psal': 'psalms', 'psalm': 'psalms', 'psalms': 'psalms',
  // Proverbs
  'prov': 'proverbs', 'pro': 'proverbs', 'proverbs': 'proverbs',
  // Ecclesiastes
  'eccl': 'ecclesiastes', 'ecc': 'ecclesiastes', 'ecclesiastes': 'ecclesiastes',
  // Song of Solomon
  'song': 'song-of-solomon', 'cant': 'song-of-solomon', 'canticles': 'song-of-solomon',
  'son': 'song-of-solomon', 'sg': 'song-of-solomon',
  // Isaiah
  'isa': 'isaiah', 'isai': 'isaiah', 'is': 'isaiah', 'isaiah': 'isaiah',
  // Jeremiah
  'jer': 'jeremiah', 'jere': 'jeremiah', 'jeremiah': 'jeremiah',
  // Lamentations
  'lam': 'lamentations', 'lamentations': 'lamentations',
  // Ezekiel
  'ezek': 'ezekiel', 'eze': 'ezekiel', 'ezekiel': 'ezekiel',
  // Daniel
  'dan': 'daniel', 'daniel': 'daniel',
  // Hosea
  'hos': 'hosea', 'hosea': 'hosea',
  // Joel
  'joel': 'joel',
  // Amos
  'amos': 'amos',
  // Obadiah
  'obad': 'obadiah', 'ob': 'obadiah', 'obadiah': 'obadiah',
  // Jonah
  'jonah': 'jonah', 'jon': 'jonah',
  // Micah
  'mic': 'micah', 'micah': 'micah',
  // Nahum
  'nah': 'nahum', 'nahum': 'nahum',
  // Habakkuk
  'hab': 'habakkuk', 'habakkuk': 'habakkuk',
  // Zephaniah
  'zeph': 'zephaniah', 'zep': 'zephaniah', 'zephaniah': 'zephaniah',
  // Haggai
  'hag': 'haggai', 'haggai': 'haggai',
  // Zechariah
  'zech': 'zechariah', 'zec': 'zechariah', 'zechariah': 'zechariah',
  // Malachi
  'mal': 'malachi', 'malachi': 'malachi',

  // ── New Testament ──────────────────────────────────────────────────────────
  // Matthew
  'matt': 'matthew', 'matth': 'matthew', 'mat': 'matthew', 'mt': 'matthew',
  'matthew': 'matthew',
  // Mark
  'mark': 'mark', 'mk': 'mark', 'mar': 'mark',
  // Luke
  'luke': 'luke', 'lk': 'luke', 'luc': 'luke',
  // John (gospel)
  'john': 'john', 'jn': 'john',
  // Acts
  'acts': 'acts', 'act': 'acts',
  // Romans
  'rom': 'romans', 'ro': 'romans', 'romans': 'romans',
  // 1 Corinthians
  '1cor': '1-corinthians', '1 cor': '1-corinthians', '1corinthians': '1-corinthians',
  '1 corinthians': '1-corinthians',
  // 2 Corinthians
  '2cor': '2-corinthians', '2 cor': '2-corinthians', '2corinthians': '2-corinthians',
  '2 corinthians': '2-corinthians',
  // Galatians
  'gal': 'galatians', 'galatians': 'galatians',
  // Ephesians
  'eph': 'ephesians', 'ephesians': 'ephesians',
  // Philippians
  'phil': 'philippians', 'philipp': 'philippians', 'php': 'philippians',
  'philippians': 'philippians',
  // Colossians
  'col': 'colossians', 'colossians': 'colossians',
  // 1 Thessalonians
  '1thess': '1-thessalonians', '1 thess': '1-thessalonians',
  '1thessalonians': '1-thessalonians', '1 thessalonians': '1-thessalonians',
  // 2 Thessalonians
  '2thess': '2-thessalonians', '2 thess': '2-thessalonians',
  '2thessalonians': '2-thessalonians', '2 thessalonians': '2-thessalonians',
  // 1 Timothy
  '1tim': '1-timothy', '1 tim': '1-timothy', '1timothy': '1-timothy',
  '1 timothy': '1-timothy',
  // 2 Timothy
  '2tim': '2-timothy', '2 tim': '2-timothy', '2timothy': '2-timothy',
  '2 timothy': '2-timothy',
  // Titus
  'tit': 'titus', 'titus': 'titus',
  // Philemon
  'philem': 'philemon', 'phlm': 'philemon', 'phm': 'philemon', 'philemon': 'philemon',
  // Hebrews
  'heb': 'hebrews', 'hebrews': 'hebrews',
  // James
  'jas': 'james', 'jam': 'james', 'james': 'james',
  // 1 Peter
  '1pet': '1-peter', '1 pet': '1-peter', '1peter': '1-peter', '1 peter': '1-peter',
  // 2 Peter
  '2pet': '2-peter', '2 pet': '2-peter', '2peter': '2-peter', '2 peter': '2-peter',
  // 1 John
  '1john': '1-john', '1 john': '1-john',
  // 2 John
  '2john': '2-john', '2 john': '2-john',
  // 3 John
  '3john': '3-john', '3 john': '3-john',
  // Jude
  'jude': 'jude',
  // Revelation (also Apocalypse in classical Anglican usage)
  'rev': 'revelation', 'apoc': 'revelation', 'revelation': 'revelation',
};

/**
 * Convert a Roman numeral string to an integer.
 * Handles i–cl range (covers all KJV chapter numbers, max Psalms 150).
 * Returns null if the string is not a valid Roman numeral.
 */
export function fromRoman(str) {
  const s = str.toLowerCase().trim();
  // Must consist only of Roman numeral characters
  if (!/^[ivxlc]+$/.test(s)) return null;

  const vals = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let result = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const curr = vals[s[i]];
    if (curr === undefined) return null;
    result += curr < prev ? -curr : curr;
    prev = curr;
  }
  return result > 0 ? result : null;
}

/**
 * Parse a chapter or verse token that may be Arabic or Roman numeral.
 * Returns the integer value, or null if unrecognisable.
 */
export function parseChapterOrVerse(token) {
  if (!token) return null;
  const t = token.trim();
  const arabic = parseInt(t, 10);
  if (!isNaN(arabic) && String(arabic) === t) return arabic;
  return fromRoman(t);
}

/**
 * Normalise a raw book name string (as captured from a citation regex) to
 * a canonical URL slug like "matthew", "1-corinthians", "song-of-solomon".
 *
 * Steps:
 *  1. Strip S. / St. / Saint prefix (classical Anglican "S. Matt.")
 *  2. Strip trailing period
 *  3. Lowercase and trim
 *  4. Compact any "N " number prefix to "N" for lookup (e.g. "1 cor" → "1cor")
 *  5. Look up in BOOK_ALIASES
 *
 * Returns null for any string that doesn't map to a known Bible book.
 */
export function normalizeBook(raw) {
  let s = raw.trim()
    .replace(/^(S\.\s*|St\.?\s+|Saint\s+)/i, '') // strip S./St./Saint prefix
    .replace(/\.\s*$/, '')                          // strip trailing period
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();

  // Try exact match first (handles "1 cor", "2 tim", etc.)
  if (BOOK_ALIASES[s]) return BOOK_ALIASES[s];

  // Try compacting number-space prefix: "1 cor" → "1cor"
  const compact = s.replace(/^(\d)\s+/, '$1');
  return BOOK_ALIASES[compact] || null;
}

/**
 * Build the canonical URL for a Bible passage.
 *
 * Examples:
 *   bibleUrl('john', 3)        → '/bible/john/3/'
 *   bibleUrl('john', 3, 16)    → '/bible/john/3/#v16'
 */
export function bibleUrl(book, chapter, verse = null) {
  const base = `/bible/${book}/${chapter}/`;
  return verse ? `${base}#v${verse}` : base;
}
