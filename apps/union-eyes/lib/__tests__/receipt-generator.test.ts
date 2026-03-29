import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  jsPDF: vi.fn(),
  putBlob: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockSetFontSize: vi.fn(),
  mockSetFont: vi.fn(),
  mockText: vi.fn(),
  mockOutput: vi.fn(),
}));

vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize = mocks.mockSetFontSize;
    setFont = mocks.mockSetFont;
    text = mocks.mockText;
    output = mocks.mockOutput.mockReturnValue(new ArrayBuffer(100));
  },
}));

vi.mock('@/lib/blob-client', () => ({
  putBlob: mocks.putBlob,
}));

vi.mock('@/lib/logger', () => ({
  logger: mocks.logger,
}));

import { generateReceipt } from '../receipt-generator';

describe('receipt-generator', () => {
  const receiptData = {
    transactionId: 'tx-12345678-abcd',
    memberId: 'mem-1',
    memberName: 'Jane Doe',
    organizationName: 'CUPE Local 123',
    duesAmount: 100.0,
    copeAmount: 10.0,
    pacAmount: 5.0,
    strikeFundAmount: 15.0,
    lateFeeAmount: 0,
    totalAmount: 130.0,
    paidDate: new Date('2026-01-15'),
    paymentReference: 'PAY-001',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a PDF receipt and uploads to blob storage', async () => {
    mocks.putBlob.mockResolvedValue({ url: 'https://blob.store/receipt.pdf' });

    const url = await generateReceipt(receiptData);

    expect(mocks.putBlob).toHaveBeenCalledWith(
      expect.stringContaining('receipts/mem-1/receipt-tx-12345678-abcd'),
      expect.any(Buffer),
      { contentType: 'application/pdf' },
    );
    expect(url).toBe('https://blob.store/receipt.pdf');
    expect(mocks.logger.info).toHaveBeenCalledWith(
      'Receipt generated successfully',
      expect.objectContaining({ transactionId: receiptData.transactionId }),
    );
  });

  it('renders late fee line when lateFeeAmount > 0', async () => {
    mocks.putBlob.mockResolvedValue({ url: 'https://blob.store/r2.pdf' });

    await generateReceipt({ ...receiptData, lateFeeAmount: 25.0, totalAmount: 155.0 });

    // The PDF is generated without error (late fee path is exercised)
    expect(mocks.putBlob).toHaveBeenCalled();
  });

  it('throws and logs error on blob upload failure', async () => {
    mocks.putBlob.mockRejectedValue(new Error('upload failed'));

    await expect(generateReceipt(receiptData)).rejects.toThrow('upload failed');
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to generate receipt',
      expect.any(Error),
      expect.objectContaining({ transactionId: receiptData.transactionId }),
    );
  });
});
