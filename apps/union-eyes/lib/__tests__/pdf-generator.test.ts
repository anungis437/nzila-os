/**
 * PDF Generator — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock PDFKit ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const fakeDoc = {
    fontSize: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    moveDown: vi.fn().mockReturnThis(),
    rect: vi.fn().mockReturnThis(),
    fillAndStroke: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    addPage: vi.fn().mockReturnThis(),
    bufferedPageRange: vi.fn().mockReturnValue({ start: 0, count: 1 }),
    end: vi.fn(),
    on: vi.fn(),
    y: 100,
    page: {
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      height: 792,
      width: 612,
    },
  };

  return { fakeDoc };
});

vi.mock('pdfkit', () => {
  const PDFDocument = function PDFDocument() {
    return mocks.fakeDoc;
  } as unknown as { new(opts?: unknown): typeof mocks.fakeDoc };
  return { default: PDFDocument };
});

import { generatePDF, addHeader, addFooter } from '../utils/pdf-generator';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('generatePDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Make doc.on('end') fire immediately
    mocks.fakeDoc.on.mockImplementation((event: string, cb: (chunk?: Buffer) => void) => {
      if (event === 'data') {
        cb(Buffer.from('pdf-data'));
      }
      if (event === 'end') {
        setTimeout(cb, 0);
      }
      return mocks.fakeDoc;
    });
  });

  it('returns a Buffer', async () => {
    const result = await generatePDF({ title: 'Test', data: [] });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('calls doc.end()', async () => {
    await generatePDF({ title: 'Test', data: [] });
    expect(mocks.fakeDoc.end).toHaveBeenCalled();
  });

  it('renders generic report by default', async () => {
    await generatePDF({ title: 'Generic', data: [{ a: 1 }] });
    expect(mocks.fakeDoc.fontSize).toHaveBeenCalledWith(20);
    expect(mocks.fakeDoc.text).toHaveBeenCalledWith('Generic', { align: 'center' });
  });

  it('renders claims-report template', async () => {
    await generatePDF({
      title: 'Claims',
      data: [{ claimNumber: 'C1', subject: 'Test', status: 'open', priority: 'high' }],
      template: 'claims-report',
    });
    expect(mocks.fakeDoc.text).toHaveBeenCalledWith('Claims', { align: 'center' });
  });

  it('renders members-report template', async () => {
    await generatePDF({
      title: 'Members',
      data: [{ name: 'Alice', email: 'a@b.ca', status: 'active' }],
      template: 'members-report',
    });
    expect(mocks.fakeDoc.text).toHaveBeenCalledWith('Members', { align: 'center' });
  });

  it('renders grievances-report template', async () => {
    await generatePDF({
      title: 'Grievances',
      data: [{ claimNumber: 'G1', subject: 'Test', status: 'pending' }],
      template: 'grievances-report',
    });
    expect(mocks.fakeDoc.text).toHaveBeenCalledWith('Grievances', { align: 'center' });
  });

  it('renders usage-report template', async () => {
    await generatePDF({
      title: 'Usage',
      data: { period: { start: '2025-01', end: '2025-06' }, claims: { total: 5 }, members: { total: 100 } } as unknown as unknown[],
      template: 'usage-report',
    });
    expect(mocks.fakeDoc.text).toHaveBeenCalledWith('Usage', { align: 'center' });
  });

  it('renders financial-report template', async () => {
    await generatePDF({
      title: 'Finance',
      data: { period: { start: '2025-01', end: '2025-06' }, revenue: 10000, expenses: 5000 } as unknown as unknown[],
      template: 'financial-report',
    });
    expect(mocks.fakeDoc.text).toHaveBeenCalledWith('Finance', { align: 'center' });
  });

  it('passes custom size and orientation', async () => {
    await generatePDF({
      title: 'Test',
      data: [],
      size: 'A4',
      orientation: 'landscape',
    });
    expect(mocks.fakeDoc.end).toHaveBeenCalled();
  });

  it('handles single object data (non-array)', async () => {
    await generatePDF({
      title: 'Single',
      data: { key: 'value' } as unknown as unknown[],
    });
    expect(mocks.fakeDoc.fontSize).toHaveBeenCalledWith(12);
  });
});

describe('addHeader', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders header text with defaults', () => {
    addHeader(mocks.fakeDoc as unknown as typeof import('pdfkit'), 'Report Header');
    expect(mocks.fakeDoc.fontSize).toHaveBeenCalledWith(12);
    expect(mocks.fakeDoc.text).toHaveBeenCalledWith('Report Header', { align: 'center' });
    expect(mocks.fakeDoc.moveDown).toHaveBeenCalled();
  });

  it('uses custom fontSize', () => {
    addHeader(mocks.fakeDoc as unknown as typeof import('pdfkit'), 'Big', { fontSize: 24 });
    expect(mocks.fakeDoc.fontSize).toHaveBeenCalledWith(24);
  });
});

describe('addFooter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders footer text', () => {
    addFooter(mocks.fakeDoc as unknown as typeof import('pdfkit'), 'Footer Text');
    expect(mocks.fakeDoc.fontSize).toHaveBeenCalledWith(9);
    expect(mocks.fakeDoc.text).toHaveBeenCalledWith(
      'Footer Text', expect.any(Number), expect.any(Number), expect.any(Object),
    );
  });

  it('hides page numbers when showPageNumbers=false', () => {
    addFooter(mocks.fakeDoc as unknown as typeof import('pdfkit'), 'Footer', false);
    // When false, text is called once (only the footer text, no page number)
    expect(mocks.fakeDoc.text).toHaveBeenCalledTimes(1);
  });
});
