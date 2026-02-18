import { URL } from 'node:url';
import path from 'node:path';
import { config } from './config.mjs';

const BASE_HOST = new URL(config.baseUrl).hostname;

/**
 * Normalize a URL: resolve relative to parent, strip fragment/query, ensure trailing slash consistency.
 */
export function normalizeUrl(href, parentUrl) {
  if (!href) return null;

  // Skip non-HTTP protocols and patterns
  for (const pattern of config.skipPatterns) {
    if (pattern.test(href)) return null;
  }

  try {
    const resolved = new URL(href, parentUrl);

    // Only crawl same host
    if (resolved.hostname !== BASE_HOST) return null;

    // Strip fragment and query
    resolved.hash = '';
    resolved.search = '';

    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is internal (same host).
 */
export function isInternalUrl(href) {
  try {
    const url = new URL(href);
    return url.hostname === BASE_HOST;
  } catch {
    return false;
  }
}

/**
 * Convert a full URL to a local archive path.
 * e.g. https://anglicanhistory.org/jewel/apology/01.html → jewel/apology/01.html
 */
export function urlToLocalPath(url) {
  const parsed = new URL(url);
  let pathname = parsed.pathname;

  // Remove leading slash
  pathname = pathname.replace(/^\//, '');

  // Default to index.html for directory URLs
  if (!pathname || pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  return pathname;
}

/**
 * Convert a local archive path to a Starlight content path (for .md output).
 * e.g. jewel/apology/01.html → jewel/apology/01.md
 *      jewel/apology/index.html → jewel/apology/index.md
 */
export function localPathToContentPath(localPath) {
  // Replace .html/.htm extension with .md
  return localPath.replace(/\.html?$/i, '.md');
}

/**
 * Convert a full anglicanhistory.org URL to a relative Starlight path.
 * Used for rewriting internal links in transformed content.
 * e.g. https://anglicanhistory.org/jewel/apology/01.html → /project-canterbury/jewel/apology/01/
 */
export function urlToStarlightPath(href) {
  try {
    const parsed = new URL(href, config.baseUrl);
    if (parsed.hostname !== BASE_HOST) return href;

    let pathname = parsed.pathname;

    // Remove leading slash
    pathname = pathname.replace(/^\//, '');

    // For PDFs, keep the original URL
    if (pathname.endsWith('.pdf')) return href;

    // Strip .html/.htm extension
    pathname = pathname.replace(/\.html?$/i, '');

    // Strip trailing index
    pathname = pathname.replace(/\/index$/, '/');

    // Ensure no trailing slash for non-directory paths, then add one for Starlight
    if (!pathname.endsWith('/')) {
      pathname += '/';
    }

    return `/project-canterbury/${pathname}`;
  } catch {
    return href;
  }
}

/**
 * Check if a URL points to a PDF.
 */
export function isPdfUrl(url) {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/**
 * Check if a URL points to an image.
 */
export function isImageUrl(url) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp'];
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return imageExts.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Check if a URL points to an HTML page (by extension or lack thereof).
 */
export function isHtmlUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.html') || pathname.endsWith('.htm')) return true;
    // Directory URLs are likely index pages
    if (pathname.endsWith('/') || !path.extname(pathname)) return true;
    return false;
  } catch {
    return false;
  }
}
