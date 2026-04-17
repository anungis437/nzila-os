/**
 * HTML sanitization utility.
 * - Server-side (RSC / SSR): uses `sanitize-html` (Node-compatible)
 * - Client-side: uses DOMPurify (faster, browser-native)
 * Both share the same allowlist so output is consistent.
 */

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'div', 'span',
  'hr', 'sup', 'sub', 'dl', 'dt', 'dd', 'figure', 'figcaption',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
  'width', 'height', 'colspan', 'rowspan',
];

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Works on both server and client.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') {
    // Server-side: use sanitize-html (Node-compatible, no DOM required)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sanitizeHtmlLib = require('sanitize-html') as typeof import('sanitize-html');
    return sanitizeHtmlLib(dirty, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: Object.fromEntries(ALLOWED_TAGS.map((tag) => [tag, ALLOWED_ATTR])),
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        a: (tagName, attribs) => {
          if (attribs.target === '_blank') {
            return {
              tagName,
              attribs: {
                ...attribs,
                rel: 'noopener noreferrer',
              },
            };
          }
          return { tagName, attribs };
        },
      },
    });
  }

  // Client-side: use DOMPurify (browser-native, faster)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DOMPurify = (require('dompurify') as typeof import('dompurify')).default;
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
