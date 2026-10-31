import { describe, expect, it } from 'vitest';
import { readVerifiedPdfResponse } from '../verified-pdf-response';

const validPdf = '%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF';
const response = (body: BodyInit, status: number, type: string) =>
  new Response(body, { status, headers: { 'content-type': type } });

describe('legal form PDF download integrity', () => {
  it('refuses the current 501 endpoint without treating its JSON as a PDF', async () => {
    await expect(readVerifiedPdfResponse(response('{"error":"not implemented"}', 501, 'application/json')))
      .rejects.toThrow('not yet available');
  });
  it('refuses successful JSON and HTML masquerading as a download', async () => {
    await expect(readVerifiedPdfResponse(response('{"success":true}', 200, 'application/json')))
      .rejects.toThrow('non-PDF');
    await expect(readVerifiedPdfResponse(response('<html>OK</html>', 200, 'text/html')))
      .rejects.toThrow('non-PDF');
  });
  it('refuses a PDF content type with invalid bytes', async () => {
    await expect(readVerifiedPdfResponse(response('{"fake":"pdf"}', 200, 'application/pdf')))
      .rejects.toThrow('invalid PDF');
  });
  it('returns an actual PDF blob with an explicit PDF media type', async () => {
    const blob = await readVerifiedPdfResponse(response(validPdf, 200, 'application/pdf; charset=binary'));
    expect(blob.size).toBeGreaterThan(5);
    expect(await blob.text()).toBe(validPdf);
  });
  it('refuses an empty PDF and service errors', async () => {
    await expect(readVerifiedPdfResponse(response('', 200, 'application/pdf'))).rejects.toThrow('empty');
    await expect(readVerifiedPdfResponse(response('down', 503, 'text/plain'))).rejects.toThrow('could not generate');
  });
});
