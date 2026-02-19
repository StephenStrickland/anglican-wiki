/**
 * remark-scripture-citations.mjs
 *
 * A remark plugin that finds scripture citations in markdown text nodes and
 * converts them to hyperlinks pointing at the in-app Bible pages.
 *
 * Handles the full range of citation styles found in the Anglican corpus:
 *   Classical: "Matt. xviii. 15"  "S. John xv. 5"   "1 Cor. ii. 10"
 *   Mixed:     "Acts iii. 1"      "Ps. cxix. 19"     "Gen. i. 1"
 *   Modern:    "John 3:16"        "1 Cor. 13:13"
 *   Chapter-only: "1 Tim. iii"    "Heb. xi"
 *
 * No external dependencies — the AST visitor is implemented inline.
 */

import { normalizeBook, parseChapterOrVerse, bibleUrl } from './bible-utils.mjs';

/**
 * Citation regex. Matches scripture references in text.
 *
 * Group 1 (bookRaw):    The book name with optional prefixes,
 *                       e.g. "Matt.", "1 Cor.", "S. John", "Ps."
 * Group 2 (chapterRaw): Chapter number (roman or arabic)
 * Group 3 (verseRaw):   Verse number (roman or arabic) — optional
 *
 * The overall pattern:
 *   [1/2/3 ][S./St. ]BookName[.]  Chapter[./:] [Verse]
 */
const CITATION_RE =
  /\b((?:\d\s+)?(?:S\.?\s+|St\.?\s+)?[A-Z][a-z]{1,11}\.?)\s+([ivxlcIVXLC]{1,6}|\d{1,3})(?:[.:\s]\s*(\d{1,3}|[ivxlc]{1,6})(?!\w))?/g;

/**
 * Process a single text-node value, returning an array of remark nodes
 * (mix of 'text' and 'link' nodes). Returns null if no citations found.
 *
 * @param {string} text - The raw text content of the node.
 * @returns {Array|null} Array of remark nodes, or null if no matches.
 */
function processText(text) {
  CITATION_RE.lastIndex = 0;
  const nodes = [];
  let lastIndex = 0;
  let match;

  while ((match = CITATION_RE.exec(text)) !== null) {
    const [full, bookRaw, chapterRaw, verseRaw] = match;
    const start = match.index;

    // Resolve book slug — skip if unrecognised (prevents false positives)
    const book = normalizeBook(bookRaw);
    if (!book) continue;

    const chapter = parseChapterOrVerse(chapterRaw);
    if (!chapter) continue;

    const verse = parseChapterOrVerse(verseRaw) || null;

    // Push plain text preceding this citation
    if (start > lastIndex) {
      nodes.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    // Push scripture link node
    nodes.push({
      type: 'link',
      url: bibleUrl(book, chapter, verse),
      title: null,
      children: [{ type: 'text', value: full }],
      data: { hProperties: { class: 'scripture-ref' } },
    });

    lastIndex = start + full.length;
  }

  if (nodes.length === 0) return null;

  // Push remaining text after the last citation
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return nodes;
}

/**
 * Walk the remark AST in-place, replacing text nodes that contain scripture
 * citations with a mix of text and link nodes.
 *
 * Skips:
 *   - Text nodes whose parent is a link (prevents double-linking)
 *   - Text nodes inside code/inlineCode nodes (these have no 'children')
 *
 * @param {import('mdast').Root} node - The root (or any) AST node to walk.
 * @param {import('mdast').Node|null} parent - The parent node.
 */
function walk(node, parent) {
  if (!node.children) return;

  const newChildren = [];
  for (const child of node.children) {
    if (child.type === 'text' && parent?.type !== 'link') {
      const replacements = processText(child.value);
      if (replacements) {
        newChildren.push(...replacements);
      } else {
        newChildren.push(child);
      }
    } else {
      walk(child, node);
      newChildren.push(child);
    }
  }
  node.children = newChildren;
}

/**
 * The remark plugin factory. Register in astro.config.mjs:
 *
 *   import { remarkScriptureCitations } from './scripts/lib/remark-scripture-citations.mjs';
 *   // ...
 *   markdown: { remarkPlugins: [remarkScriptureCitations] }
 */
export function remarkScriptureCitations() {
  return (tree) => {
    walk(tree, null);
  };
}
