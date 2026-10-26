import { describe, expect, it } from 'vitest';
import { safeAttributeUrl, sanitizeHtml } from '../sanitize';
import { sanitizationRules } from '../../middleware/request-validation';

describe('safeAttributeUrl', () => {
  it('allows only the listed protocols', () => {
    expect(safeAttributeUrl('https://example.org/a?b=1')).toBe('https://example.org/a?b=1');
    expect(safeAttributeUrl('http://example.org')).toBe('http://example.org/');
    expect(safeAttributeUrl('mailto:rep@example.org', ['https:', 'mailto:'])).toBe('mailto:rep@example.org');
    expect(safeAttributeUrl('mailto:rep@example.org')).toBeUndefined();
  });

  it('refuses script-bearing, data and relative values', () => {
    for (const value of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', '/relative/path', '//evil.example', '', '   ']) {
      expect(safeAttributeUrl(value), value).toBeUndefined();
    }
  });
});

describe('plain-text HTML reduction', () => {
  const nested = ['<scr<script>ipt>alert(1)</scr</script>ipt>', '<<b>script>alert(1)<</b>/script>', '<img src=x onerror=alert(1)//'];

  it('server-side sanitizeHtml never leaves a reassembled tag or angle bracket', () => {
    for (const input of nested) {
      const out = sanitizeHtml(input);
      expect(out, input).not.toMatch(/[<>]/);
      expect(out.toLowerCase(), input).not.toContain('<script');
    }
    expect(sanitizeHtml('<p>Hello <b>member</b></p>')).toBe('Hello member');
  });

  it('request-validation html rule removes script and style blocks, nested fragments and stray brackets', () => {
    for (const input of nested) {
      const out = sanitizationRules.html(input);
      expect(out, input).not.toMatch(/[<>]/);
    }
    expect(sanitizationRules.html('a<script>alert(1)</script>b<style>p{}</style>c')).toBe('abc');
    expect(sanitizationRules.html('<div>Grievance <i>12</i></div>')).toBe('Grievance 12');
    expect(sanitizationRules.html(42)).toBe('');
  });
});
