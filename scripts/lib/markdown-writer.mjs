import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import matter from 'gray-matter';
import { urlToStarlightPath, isImageUrl } from './url-utils.mjs';
import { config } from './config.mjs';

/**
 * Create a configured Turndown instance with site-specific rules.
 */
function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  // Add GFM support (tables, strikethrough)
  turndown.use(gfm);

  // Custom rule: rewrite internal links to Starlight paths
  turndown.addRule('internalLinks', {
    filter: (node) => {
      return node.nodeName === 'A' && node.getAttribute('href');
    },
    replacement: (content, node) => {
      const href = node.getAttribute('href');
      if (!href || !content.trim()) return content;

      // Rewrite anglicanhistory.org links to Starlight paths
      let newHref = href;
      if (href.includes('anglicanhistory.org') || (href.startsWith('/') && !href.startsWith('//'))) {
        try {
          const fullUrl = href.startsWith('/')
            ? `${config.baseUrl}${href}`
            : href;
          newHref = urlToStarlightPath(fullUrl);
        } catch {
          // Keep original href if parsing fails
        }
      }

      const title = node.getAttribute('title');
      const titlePart = title ? ` "${title}"` : '';
      return `[${content}](${newHref}${titlePart})`;
    },
  });

  // Custom rule: <center> → plain content (already stripped in HTML cleaning, but just in case)
  turndown.addRule('center', {
    filter: 'center',
    replacement: (content) => content,
  });

  // Custom rule: <font> → plain content
  turndown.addRule('font', {
    filter: 'font',
    replacement: (content) => content,
  });

  // Keep images with their original src for now
  turndown.addRule('images', {
    filter: 'img',
    replacement: (content, node) => {
      const src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || '';
      if (!src) return '';
      return `![${alt}](${src})`;
    },
  });

  return turndown;
}

const turndown = createTurndown();

/**
 * Convert cleaned HTML to Markdown.
 * @param {string} cleanedHtml
 * @param {string} [localPath] - archive-relative path (e.g. "dearmer/monuments1915.html") for resolving relative image URLs
 */
export function htmlToMarkdown(cleanedHtml, localPath) {
  let md = turndown.turndown(cleanedHtml);
  return postProcess(md, localPath);
}

/**
 * Fix mis-encoded Windows-1252 C1 control characters (U+0080–U+009F).
 * Source HTML from Project Canterbury is often Windows-1252 encoded;
 * reading it as UTF-8 maps bytes 0x80–0x9F to C1 control chars instead
 * of the intended characters (smart quotes, em dashes, etc.)
 */
const WIN1252_MAP = {
  '\u0080': '\u20AC', '\u0082': '\u201A', '\u0083': '\u0192',
  '\u0084': '\u201E', '\u0085': '\u2026', '\u0086': '\u2020',
  '\u0087': '\u2021', '\u0088': '\u02C6', '\u0089': '\u2030',
  '\u008A': '\u0160', '\u008B': '\u2039', '\u008C': '\u0152',
  '\u008E': '\u017D', '\u0091': '\u2018', '\u0092': '\u2019',
  '\u0093': '\u201C', '\u0094': '\u201D', '\u0095': '\u2022',
  '\u0096': '\u2013', '\u0097': '\u2014', '\u0098': '\u02DC',
  '\u0099': '\u2122', '\u009A': '\u0161', '\u009B': '\u203A',
  '\u009C': '\u0153', '\u009E': '\u017E', '\u009F': '\u0178',
};

function fixWindows1252(text) {
  return text.replace(/[\u0080-\u009F]/g, (ch) => WIN1252_MAP[ch] || ch);
}

/**
 * Post-process Markdown: collapse whitespace, fix entities, normalize headings.
 */
function postProcess(md, localPath) {
  // Fix mis-encoded Windows-1252 C1 control characters
  md = fixWindows1252(md);

  // Replace non-breaking spaces with regular spaces
  md = md.replace(/\u00A0/g, ' ');

  // Remove soft hyphens (invisible formatting hints)
  md = md.replace(/\u00AD/g, '');

  // Collapse multiple blank lines to two
  md = md.replace(/\n{3,}/g, '\n\n');

  // Fix common HTML entities that Turndown might miss
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");

  // Rewrite relative image paths to absolute URLs on the source site
  if (localPath) {
    const baseDir = localPath.replace(/[^/]*$/, ''); // e.g. "dearmer/"
    md = md.replace(/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g, (match, alt, src) => {
      // Root-relative paths (e.g. /images/foo.jpg) resolve against the site root
      const absoluteSrc = src.startsWith('/')
        ? `${config.baseUrl}${src}`
        : `${config.baseUrl}/${baseDir}${src}`;
      return `![${alt}](${absoluteSrc})`;
    });
  }

  // Normalize headings: demote h1 to h2 (Starlight uses title as h1)
  md = md.replace(/^# /gm, '## ');

  // Clean up trailing whitespace on lines
  md = md.replace(/[ \t]+$/gm, '');

  // Ensure file ends with a single newline
  md = md.trim() + '\n';

  return md;
}

/**
 * Generate a complete Markdown file with frontmatter.
 */
export function generateMarkdownFile(metadata, markdownContent) {
  const frontmatter = {
    title: metadata.title,
    description: metadata.description,
  };

  const yamlFront = matter.stringify('', frontmatter).trim();
  return `${yamlFront}\n\n${markdownContent}`;
}

/**
 * Generate a stub page for PDF documents.
 */
export function generatePdfStub(metadata, pdfUrl) {
  const content = `This document is available as a PDF from Project Canterbury:\n\n[Download PDF](${pdfUrl})\n`;
  return generateMarkdownFile(metadata, content);
}
