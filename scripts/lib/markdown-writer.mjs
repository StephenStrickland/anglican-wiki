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
 * Post-process Markdown: collapse whitespace, fix entities, normalize headings.
 */
function postProcess(md, localPath) {
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
