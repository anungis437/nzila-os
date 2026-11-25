import { describe, expect, it } from 'vitest';
import { documentAttachmentName } from './attachment-name';

describe('download attachment filename boundary', () => {
  it('preserves an astral character at the truncation boundary without a URI encoding failure', () => {
    const name = documentAttachmentName('a'.repeat(199) + '😀.pdf');
    expect(name).toBe('a'.repeat(199) + '😀');
    expect(decodeURIComponent(encodeURIComponent(name))).toBe(name);
  });

  it.each(['\uD800', '\uDC00', 'name\uD800.pdf'])('normalizes malformed UTF-16 before the response header is encoded', raw => {
    expect(() => encodeURIComponent(documentAttachmentName(raw))).not.toThrow();
    expect(documentAttachmentName(raw)).toContain('\uFFFD');
  });

  it('removes paths and header control characters and supplies a nonempty fallback', () => {
    expect(documentAttachmentName('path\\nested/quoted"\r\nname.pdf')).toBe('quotedname.pdf');
    expect(documentAttachmentName('/\r\n"')).toBe('document');
  });
});
