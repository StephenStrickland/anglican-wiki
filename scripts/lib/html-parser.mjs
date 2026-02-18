import { load } from 'cheerio';

/**
 * Extract metadata from an HTML page using a cascade of strategies.
 */
export function extractMetadata(html, localPath) {
  const $ = load(html);
  const title = extractTitle($, localPath);
  const description = extractDescription($, title);

  return { title, description };
}

/**
 * Title extraction cascade:
 * 1. <title> tag (if not just "Project Canterbury")
 * 2. First <h1>
 * 3. First <center> text block
 * 4. First bold text
 * 5. Fallback: derive from URL path
 */
function extractTitle($, localPath) {
  // 1. <title> tag
  const titleTag = $('title').text().trim();
  if (titleTag && !isGenericTitle(titleTag)) {
    return cleanTitle(titleTag);
  }

  // 2. First <h1>
  const h1 = $('h1').first().text().trim();
  if (h1 && !isGenericTitle(h1)) {
    return cleanTitle(h1);
  }

  // 3. First <center> text block
  const centerText = $('center').first().text().trim();
  if (centerText && centerText.length > 3 && centerText.length < 200) {
    return cleanTitle(centerText.split('\n')[0].trim());
  }

  // 4. First bold text
  const boldText = $('b, strong').first().text().trim();
  if (boldText && boldText.length > 3 && boldText.length < 200) {
    return cleanTitle(boldText);
  }

  // 5. Fallback from path
  return titleFromPath(localPath);
}

function isGenericTitle(title) {
  const generic = ['project canterbury', 'index', 'untitled', ''];
  return generic.some(g => title.toLowerCase().includes(g) && title.length < g.length + 10);
}

function cleanTitle(title) {
  return title
    .replace(/\s+/g, ' ')
    .replace(/^Project Canterbury\s*[-:–—]\s*/i, '')
    .replace(/\s*[-:–—]\s*Project Canterbury$/i, '')
    .trim();
}

function titleFromPath(localPath) {
  const parts = localPath.replace(/\.html?$/i, '').split('/');
  const last = parts[parts.length - 1] || parts[parts.length - 2] || 'Untitled';
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function extractDescription($, title) {
  // Try meta description
  const metaDesc = $('meta[name="description"]').attr('content');
  if (metaDesc) return metaDesc.trim();

  // Generate from title
  return `${title}. From Project Canterbury.`;
}

/**
 * Clean HTML: remove nav chrome, scripts, styles, and site-specific decorative elements.
 * Returns the cleaned HTML string of just the content.
 */
export function cleanHtml(html) {
  const $ = load(html);

  // Remove scripts, styles, and meta elements
  $('script, style, link[rel="stylesheet"], meta, noscript').remove();

  // Remove Google Analytics and tracking
  $('script[src*="google"], script[src*="analytics"]').remove();

  // Remove "Project Canterbury" header/nav elements
  // The site typically has a centered "Project Canterbury" header at the top
  removeProjectCanterburyHeader($);

  // Remove "return to" footer links
  removeFooterLinks($);

  // Remove decorative <hr> at page boundaries (first and last)
  removeDecorativeHr($);

  // Unwrap structural <blockquote> used as content wrappers
  unwrapStructuralBlockquotes($);

  // Strip <center> tags but preserve content
  $('center').each((_, el) => {
    $(el).replaceWith($(el).html());
  });

  // Strip <font> tags but preserve content
  $('font').each((_, el) => {
    $(el).replaceWith($(el).html());
  });

  // Get the body content (or the whole thing if no body)
  let content = $('body').html() || $.html();

  return content;
}

function removeProjectCanterburyHeader($) {
  // Look for links to anglicanhistory.org root or "Project Canterbury" text at the top
  $('body > center, body > div, body > p, body > table').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const html = $(el).html() || '';

    // Only check elements near the top of the document
    if (text.includes('project canterbury') &&
        (html.includes('anglicanhistory.org') || text.length < 100)) {
      $(el).remove();
      return;
    }

    // Site navigation blocks at the top
    if (text.startsWith('project canterbury') && text.length < 200) {
      $(el).remove();
    }
  });

  // Also remove standalone "Project Canterbury" headers
  $('h1, h2, h3, h4').each((_, el) => {
    if ($(el).text().trim().toLowerCase() === 'project canterbury') {
      $(el).remove();
    }
  });
}

function removeFooterLinks($) {
  // Remove "return to" links commonly at the bottom
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const parent = $(el).parent();

    if (text.match(/^(return to|back to|go to)\s/i) &&
        parent.children().length <= 2) {
      // Check if parent is just a wrapper for this link
      const parentText = parent.text().trim().toLowerCase();
      if (parentText.match(/^(return to|back to|go to)\s/i)) {
        parent.remove();
      }
    }
  });

  // Remove elements at the end that are just navigation
  $('body > center:last-child, body > p:last-child, body > div:last-child').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.match(/^(return to|back to|go to)\s/) ||
        (text.includes('project canterbury') && text.length < 100)) {
      $(el).remove();
    }
  });
}

function removeDecorativeHr($) {
  // Remove leading and trailing <hr> elements
  const body = $('body');

  // Remove first <hr> if it's near the top
  body.children('hr').first().remove();

  // Remove last <hr> if it's near the bottom
  body.children('hr').last().remove();
}

function unwrapStructuralBlockquotes($) {
  // The site uses <blockquote> as a page content wrapper (not for actual quotes).
  // If a blockquote contains the bulk of the page content (multiple paragraphs,
  // headings, etc.), unwrap it.
  $('blockquote').each((_, el) => {
    const children = $(el).children();
    const hasHeadings = children.filter('h1, h2, h3, h4, h5, h6').length > 0;
    const hasManyParagraphs = children.filter('p').length > 3;

    // If blockquote contains headings or many paragraphs, it's structural
    if (hasHeadings || hasManyParagraphs) {
      $(el).replaceWith($(el).html());
    }
  });
}
