import { describe, expect, it } from 'vitest';
import { OCR_MAX_BYTES, OCR_MAX_EXTRACT_CHARS, boundExtractedText, ocrDispatchKind } from './ocr-bytes';

describe('OCR byte dispatch', () => {
  it('follows a document or image signature ahead of the declared type', () => {
    expect(ocrDispatchKind(Buffer.from('%PDF-1.7\n'), 'image/png', 'png')).toBe('pdf');
    expect(ocrDispatchKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'text/plain', 'txt')).toBe('image');
    expect(ocrDispatchKind(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'application/pdf', 'pdf')).toBe('image');
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0, 'latin1');
    webp.write('WEBP', 8, 'latin1');
    expect(ocrDispatchKind(webp, 'application/octet-stream', 'bin')).toBe('image');
  });

  it('rejects containers and unknown bytes even when the browser calls them images', () => {
    expect(ocrDispatchKind(Buffer.from('PK\u0003\u0004fake'), 'image/png', 'png')).toBe('unsupported');
    expect(ocrDispatchKind(Buffer.from('Rar!\u001a\u0007\u0000'), 'image/jpeg', 'jpg')).toBe('unsupported');
    expect(ocrDispatchKind(Buffer.from([0x00, 0x01, 0x02, 0x03]), 'image/png', 'png')).toBe('unsupported');
    expect(ocrDispatchKind(Buffer.alloc(0), 'text/plain', 'txt')).toBe('unsupported');
    expect(ocrDispatchKind(Buffer.alloc(OCR_MAX_BYTES + 1), 'text/plain', 'txt')).toBe('unsupported');
  });

  it('keeps a non-signature image declaration on the image processor and reads real text as text', () => {
    expect(ocrDispatchKind(Buffer.from('bytes'), 'image/png', 'png')).toBe('image');
    expect(ocrDispatchKind(Buffer.from('plain words'), 'application/pdf', 'pdf')).toBe('text');
    expect(ocrDispatchKind(Buffer.from('hello'), 'text/plain', 'txt')).toBe('text');
    expect(ocrDispatchKind(Buffer.from('<svg></svg>'), 'image/svg+xml', 'svg')).toBe('unsupported');
    expect(ocrDispatchKind(Buffer.from('hello'), 'application/zip', 'zip')).toBe('unsupported');
  });

  it('caps extracted text without keeping the overflow', () => {
    const bounded = boundExtractedText('x'.repeat(OCR_MAX_EXTRACT_CHARS + 25));
    expect(bounded.truncated).toBe(true);
    expect(bounded.text).toHaveLength(OCR_MAX_EXTRACT_CHARS);
    expect(bounded.text.includes('overflow')).toBe(false);
    expect(boundExtractedText('short')).toEqual({ text: 'short', truncated: false });
  });
});
