import { describe, expect, it } from 'vitest';
import {
  ByteBudget,
  IngestionCapacityError,
  IngestionTooLargeError,
  MAX_INGEST_BODY_BYTES,
  PDF_PARSE_BUDGET_BYTES,
  MAX_INGEST_FILE_BYTES,
  admissionWeight,
  readBoundedFormData,
} from '../ingestion-limits';

describe('ByteBudget', () => {
  it('admits work within capacity and rejects a single request larger than capacity', async () => {
    const budget = new ByteBudget(100, 2, 0);
    const release = await budget.acquire(60);
    expect(budget.inFlightBytes).toBe(60);
    await expect(budget.acquire(101)).rejects.toBeInstanceOf(IngestionTooLargeError);
    release();
    expect(budget.inFlightBytes).toBe(0);
  });

  it('queues FIFO and grants waiters as capacity is released', async () => {
    const budget = new ByteBudget(100, 2, 0);
    const first = await budget.acquire(100);
    const order: string[] = [];
    const second = budget.acquire(60).then((release) => (order.push('second'), release));
    const third = budget.acquire(60).then((release) => (order.push('third'), release));
    expect(budget.waiting).toBe(2);
    first();
    const releaseSecond = await second;
    expect(order).toEqual(['second']);
    releaseSecond();
    (await third)();
    expect(order).toEqual(['second', 'third']);
    expect(budget.inFlightBytes).toBe(0);
    expect(budget.waiting).toBe(0);
  });

  it('sheds load once the bounded queue is full instead of queueing without limit', async () => {
    const budget = new ByteBudget(10, 1, 0);
    const held = await budget.acquire(10);
    const queued = budget.acquire(10);
    await expect(budget.acquire(10)).rejects.toBeInstanceOf(IngestionCapacityError);
    expect(budget.waiting).toBe(1);
    held();
    (await queued)();
  });

  it('rejects immediately when the queue is disabled', async () => {
    const budget = new ByteBudget(10, 0, 0);
    const held = await budget.acquire(10);
    await expect(budget.acquire(1)).rejects.toBeInstanceOf(IngestionCapacityError);
    held();
  });

  it('times out waiters and removes them from the queue', async () => {
    const budget = new ByteBudget(10, 2, 20);
    const held = await budget.acquire(10);
    await expect(budget.acquire(5)).rejects.toBeInstanceOf(IngestionCapacityError);
    expect(budget.waiting).toBe(0);
    held();
    expect(budget.inFlightBytes).toBe(0);
  });

  it('release is idempotent', async () => {
    const budget = new ByteBudget(10, 0, 0);
    const release = await budget.acquire(10);
    release();
    release();
    expect(budget.inFlightBytes).toBe(0);
    (await budget.acquire(10))();
  });

  it('sizes the parse budget for two full-size documents', () => {
    expect(PDF_PARSE_BUDGET_BYTES).toBe(2 * MAX_INGEST_FILE_BYTES);
    expect(MAX_INGEST_BODY_BYTES).toBeGreaterThan(MAX_INGEST_FILE_BYTES);
  });
});

function multipartRequest(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/ai/ingest', { method: 'POST', body, headers, duplex: 'half' } as RequestInit);
}

describe('readBoundedFormData', () => {
  it('parses a body within the ceiling', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array(1024)], 'a.bin'));
    const parsed = await readBoundedFormData(multipartRequest(form), 1024 * 1024);
    expect((parsed.get('file') as File).size).toBe(1024);
  });

  it('rejects a declared Content-Length over the ceiling without reading the body', async () => {
    const request = multipartRequest('x', { 'content-type': 'multipart/form-data; boundary=b', 'content-length': '5000' });
    await expect(readBoundedFormData(request, 1000)).rejects.toBeInstanceOf(IngestionTooLargeError);
  });

  it('aborts a streamed body that exceeds the ceiling with no Content-Length', async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1000));
        if (pulled > 1000) controller.close();
      },
    });
    const request = multipartRequest(stream, { 'content-type': 'multipart/form-data; boundary=b' });
    await expect(readBoundedFormData(request, 5000)).rejects.toBeInstanceOf(IngestionTooLargeError);
    expect(pulled).toBeLessThan(50);
  });
});

describe('admissionWeight', () => {
  it('uses a trustworthy declared size and the ceiling otherwise', () => {
    const withLength = new Request('http://x', { method: 'POST', headers: { 'content-length': '300' }, body: 'x' });
    expect(admissionWeight(withLength, 1000)).toBe(300);
    expect(admissionWeight(new Request('http://x', { method: 'POST', body: 'x' }), 1000)).toBe(1000);
    const huge = new Request('http://x', { method: 'POST', headers: { 'content-length': '999999' }, body: 'x' });
    expect(admissionWeight(huge, 1000)).toBe(1000);
  });
});
