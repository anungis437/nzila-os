import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// DEF-0B3-SEND-INVOICE-NOT-SENT: the route generated a platform invoice and delivered nothing. Generation is POST /api/finance/invoices;
// this path answers 501, keeps its steward floor, and no longer reaches the invoice generator.
describe('billing/send-invoice route', () => {
  const source = readFileSync(resolve(__dirname, '../billing/send-invoice/route.ts'), 'utf8');

  it('answers 501 behind the steward floor', () => {
    expect(source).toContain('ApiError.notImplemented');
    expect(source).toContain("minRole: 'steward'");
    expect(source).toContain('export const POST = handler');
  });

  it('does not generate an invoice', () => {
    expect(source).not.toContain('generateInvoice');
  });
});
