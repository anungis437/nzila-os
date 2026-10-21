import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Wrap the real pdfjs so loading-task destruction is observable without changing parsing.
const destroyed = vi.hoisted(() => ({ count: 0 }));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>();
  return {
    ...actual,
    getDocument: (params: unknown) => {
      const task = (actual.getDocument as (p: unknown) => { destroy: () => Promise<void> })(params);
      const original = task.destroy.bind(task);
      task.destroy = async () => {
        destroyed.count += 1;
        return original();
      };
      return task;
    },
  };
});

import { DataIngestionService } from '../data-ingestion';
import {
  IngestionCapacityError,
  IngestionTooLargeError,
  MAX_INGEST_FILE_BYTES,
  PDF_PARSE_BUDGET_BYTES,
  PDF_PARSE_MAX_WAITING,
  pdfParseBudget,
} from '../ingestion-limits';
import { buildPdf } from './pdf-fixture';

const ingestPdf = (buffer: Buffer, name = 'a.pdf') =>
  new DataIngestionService().ingest(buffer, 'application/pdf', name, { source: 'test' });

describe('PDF ingestion resource bounds', () => {
  afterEach(() => {
    destroyed.count = 0;
  });

  it('keeps extracting real PDFs and returns the budget afterwards', async () => {
    const doc = await ingestPdf(buildPdf('Budgeted clause'));
    expect(doc.content).toContain('Budgeted clause');
    expect(pdfParseBudget.inFlightBytes).toBe(0);
    expect(pdfParseBudget.waiting).toBe(0);
  });

  it('destroys the loading task after a successful parse', async () => {
    await ingestPdf(buildPdf('Destroyed after success'));
    expect(destroyed.count).toBe(1);
  });

  it('destroys the loading task and releases the budget when parsing fails', async () => {
    const doc = await ingestPdf(Buffer.from('this is not a pdf'), 'bad.pdf');
    expect(doc.content).toBe('');
    expect(destroyed.count).toBe(1);
    expect(pdfParseBudget.inFlightBytes).toBe(0);
  });

  it('rejects an oversized document before acquiring budget or copying it', async () => {
    const oversized = Buffer.alloc(MAX_INGEST_FILE_BYTES + 1);
    const acquire = vi.spyOn(pdfParseBudget, 'acquire');
    await expect(ingestPdf(oversized)).rejects.toBeInstanceOf(IngestionTooLargeError);
    expect(acquire).not.toHaveBeenCalled();
    expect(pdfParseBudget.inFlightBytes).toBe(0);
    expect(destroyed.count).toBe(0);
    acquire.mockRestore();
  });

  it('parses concurrent documents without exceeding the byte budget', async () => {
    const original = pdfParseBudget.acquire.bind(pdfParseBudget);
    let peak = 0;
    const spy = vi.spyOn(pdfParseBudget, 'acquire').mockImplementation(async (bytes: number) => {
      const release = await original(bytes);
      peak = Math.max(peak, pdfParseBudget.inFlightBytes);
      return release;
    });
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => ingestPdf(buildPdf(`Concurrent ${i}`), `c${i}.pdf`)));
    spy.mockRestore();
    expect(results.map((doc) => doc.content.includes('Concurrent'))).toEqual([true, true, true, true]);
    expect(peak).toBeLessThanOrEqual(PDF_PARSE_BUDGET_BYTES);
    expect(pdfParseBudget.inFlightBytes).toBe(0);
  });

  it('queues a bounded number of parses behind a saturated budget and rejects the rest', async () => {
    const saturate = await pdfParseBudget.acquire(PDF_PARSE_BUDGET_BYTES);
    const queued = Array.from({ length: PDF_PARSE_MAX_WAITING }, (_, i) => ingestPdf(buildPdf(`Queued ${i}`), `q${i}.pdf`));
    await Promise.resolve();
    expect(pdfParseBudget.waiting).toBe(PDF_PARSE_MAX_WAITING);

    await expect(ingestPdf(buildPdf('Overflow'))).rejects.toBeInstanceOf(IngestionCapacityError);
    expect(pdfParseBudget.waiting).toBe(PDF_PARSE_MAX_WAITING);

    saturate();
    const docs = await Promise.all(queued);
    expect(docs.every((doc) => doc.content.includes('Queued'))).toBe(true);
    expect(pdfParseBudget.inFlightBytes).toBe(0);
    expect(pdfParseBudget.waiting).toBe(0);
  });
});
