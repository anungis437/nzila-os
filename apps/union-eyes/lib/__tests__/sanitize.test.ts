/**
 * Sanitize — Unit Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DOMPurify ───────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockSanitize: vi.fn((input: string) => input), // pass-through by default
}));

vi.mock('dompurify', () => ({
  default: { sanitize: mocks.mockSanitize },
}));

import { validateRedirectUrl, sanitizeHtml } from '../utils/sanitize';

// ── validateRedirectUrl ─────────────────────────────────────────────────────

describe('validateRedirectUrl', () => {
  beforeEach(() => {
    // jsdom sets window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.unioneyes.ca', hostname: 'app.unioneyes.ca', href: '' },
      writable: true,
    });
  });

  it('allows same-origin URL', () => {
    expect(validateRedirectUrl('https://app.unioneyes.ca/dashboard')).toBe('https://app.unioneyes.ca/dashboard');
  });

  it('allows relative path', () => {
    expect(validateRedirectUrl('/dashboard')).toBe('/dashboard');
  });

  it('allows trusted Stripe checkout domain', () => {
    expect(validateRedirectUrl('https://checkout.stripe.com/pay/cs_123')).toBe(
      'https://checkout.stripe.com/pay/cs_123',
    );
  });

  it('allows trusted billing.stripe.com', () => {
    expect(validateRedirectUrl('https://billing.stripe.com/p/session/abc')).toBe(
      'https://billing.stripe.com/p/session/abc',
    );
  });

  it('allows trusted Intuit OAuth', () => {
    expect(validateRedirectUrl('https://accounts.intuit.com/auth')).toBeTruthy();
  });

  it('blocks untrusted external domain', () => {
    expect(validateRedirectUrl('https://evil.com/steal')).toBeNull();
  });

  it('blocks javascript: protocol', () => {
    // eslint-disable-next-line no-script-url
    expect(validateRedirectUrl('javascript:alert(1)')).toBeNull();
  });

  it('blocks data: protocol', () => {
    expect(validateRedirectUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('returns null for malformed URL with dangerous protocol', () => {
    expect(validateRedirectUrl('ftp://evil.com/file')).toBeNull();
  });
});

// ── sanitizeHtml ─────────────────────────────────────────────────────────────

describe('sanitizeHtml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls DOMPurify.sanitize in browser environment', () => {
    mocks.mockSanitize.mockReturnValue('<b>safe</b>');
    const result = sanitizeHtml('<b>safe</b><script>evil</script>');
    expect(mocks.mockSanitize).toHaveBeenCalledWith(
      '<b>safe</b><script>evil</script>',
      expect.objectContaining({ ALLOWED_TAGS: expect.any(Array) }),
    );
    expect(result).toBe('<b>safe</b>');
  });

  it('strips all tags on server-side (no window)', () => {
    const origWindow = globalThis.window;
    // @ts-expect-error — simulating server
    delete globalThis.window;
    try {
      const result = sanitizeHtml('<p>Hello</p><script>bad</script>');
      expect(result).toBe('Hellobad');
    } finally {
      globalThis.window = origWindow;
    }
  });
});
