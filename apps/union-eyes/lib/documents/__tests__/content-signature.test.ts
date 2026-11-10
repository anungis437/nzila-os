import { describe, expect, it } from 'vitest';
import { verifyDeclaredContentType } from '../content-signature';

// DEF-0B8-FED-EXTERNAL-UPLOAD-CLIENT-CLAIMED-TYPE-SIZE-NO-SCAN-WHOLE-BLOB-READ: the type is read from the bytes, not taken from the client.
describe('verifyDeclaredContentType', () => {
  const zip = (...names: string[]) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(names.join('\u0000'), 'latin1')]);

  it('accepts files whose bytes are the declared type', () => {
    expect(verifyDeclaredContentType(Buffer.from('%PDF-1.4 ...'), 'application/pdf')).toEqual({ ok: true, mimeType: 'application/pdf' });
    expect(verifyDeclaredContentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg').ok).toBe(true);
    expect(verifyDeclaredContentType(Buffer.from('GIF89a..'), 'image/gif').ok).toBe(true);
    expect(verifyDeclaredContentType(Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '), 'image/webp').ok).toBe(true);
    expect(verifyDeclaredContentType(zip('[Content_Types].xml', 'word/document.xml'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').ok).toBe(true);
    expect(verifyDeclaredContentType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'application/msword').ok).toBe(true);
    expect(verifyDeclaredContentType(Buffer.from('name,amount\nA,1\n'), 'text/csv').ok).toBe(true);
  });

  it('refuses bytes of another type than the one declared', () => {
    expect(verifyDeclaredContentType(Buffer.from('MZ executable'), 'application/pdf')).toEqual({ ok: false, reason: 'content_mismatch' });
    expect(verifyDeclaredContentType(Buffer.from('%PDF-1.4'), 'image/png')).toEqual({ ok: false, reason: 'content_mismatch' });
    // A spreadsheet package declared as a word document.
    expect(verifyDeclaredContentType(zip('[Content_Types].xml', 'xl/workbook.xml'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').ok).toBe(false);
    // Binary content declared as text.
    expect(verifyDeclaredContentType(Buffer.from([0x41, 0x00, 0x42]), 'text/plain').ok).toBe(false);
    expect(verifyDeclaredContentType(Buffer.from([0xc3, 0x28]), 'text/plain').ok).toBe(false);
  });

  it('refuses types not admitted for an outside party, whatever the bytes', () => {
    for (const type of ['application/zip', 'application/x-rar-compressed', 'image/svg+xml', 'application/x-msdownload', '']) {
      expect(verifyDeclaredContentType(Buffer.from('PK\u0003\u0004'), type)).toEqual({ ok: false, reason: 'type_not_allowed' });
    }
  });
});
