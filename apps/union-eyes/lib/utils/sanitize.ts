/**
 * HTML sanitization utility using DOMPurify
 * Use this to sanitize any HTML before rendering with dangerouslySetInnerHTML
 */
import DOMPurify from 'dompurify';

/** Trusted external domains for payment/OAuth redirects */
const TRUSTED_REDIRECT_DOMAINS = [
  'checkout.stripe.com',
  'billing.stripe.com',
  'whop.com',
  'checkout.shopify.com',
  'appcenter.intuit.com',     // QBO OAuth
  'accounts.intuit.com',      // QBO OAuth
];

/**
 * Validate a URL before using it in window.location.href or window.open().
 * Allows same-origin relative paths and trusted external checkout/OAuth domains.
 * Returns the URL if valid, or null if the redirect should be blocked.
 */
export function validateRedirectUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    // Block dangerous protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    // Allow same-origin
    if (parsed.origin === window.location.origin) return url;
    // Allow trusted external domains
    const isTrusted = TRUSTED_REDIRECT_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith('.' + d),
    );
    return isTrusted ? url : null;
  } catch {
    return null;
  }
}

/**
 * Normalise user-supplied link or image content for an `href`/`src` attribute. Only the listed protocols are allowed,
 * so `javascript:`, `data:` and `vbscript:` values yield undefined. Relative paths are refused: a block's content is
 * rendered in a preview and in an email, neither of which has a meaningful base.
 */
export function safeAttributeUrl(value: string, protocols: readonly string[] = ['http:', 'https:']): string | undefined {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return protocols.includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe HTML tags and removes dangerous elements like <script>, event handlers, etc.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') {
    // Server-side: reduce to plain text (never rendered on the server). Repeat until stable so a nested fragment
    // cannot reassemble a tag, then drop any leftover angle bracket.
    let previous: string;
    let out = dirty;
    do {
      previous = out;
      out = out.replace(/<[^>]*>/g, '');
    } while (out !== previous);
    return out.replace(/[<>]/g, '');
  }
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'div', 'span',
      'hr', 'sup', 'sub', 'dl', 'dt', 'dd', 'figure', 'figcaption',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
      'width', 'height', 'style', 'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
}
