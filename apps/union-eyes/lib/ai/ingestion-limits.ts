/**
 * Resource bounds for AI document ingestion.
 *
 * Deployed envelope (deploy-union-eyes.yml): 1 vCPU, 2Gi per replica, up to 3 replicas.
 * Budgets are per replica. A PDF in flight holds the upload File, the request Buffer, the
 * Uint8Array copy handed to pdfjs and pdfjs' own working set, roughly 5x the file size at
 * peak. Two full-size documents (2 x 50 MB x ~5 = ~500 MB) leave the rest of the 2Gi for the
 * Next.js runtime, so the byte budgets below are sized from that, not from a throughput goal.
 */

export const MAX_INGEST_FILE_BYTES = 50 * 1024 * 1024;
// Multipart framing and the small `data` metadata field travel with the file.
export const MAX_INGEST_BODY_BYTES = MAX_INGEST_FILE_BYTES + 1024 * 1024;

export const UPLOAD_BUDGET_BYTES = 2 * MAX_INGEST_BODY_BYTES;
export const PDF_PARSE_BUDGET_BYTES = 2 * MAX_INGEST_FILE_BYTES;
export const PDF_PARSE_MAX_WAITING = 4;
export const PDF_PARSE_WAIT_TIMEOUT_MS = 15_000;

export class IngestionTooLargeError extends Error {
  readonly code = 'INGESTION_TOO_LARGE';
  constructor() {
    super('Document exceeds the maximum ingestion size');
  }
}

export class IngestionCapacityError extends Error {
  readonly code = 'INGESTION_CAPACITY';
  constructor() {
    super('Document ingestion is at capacity');
  }
}

interface Waiter {
  bytes: number;
  grant: () => void;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Byte-weighted admission control with a bounded FIFO queue. Waiting is capped in both
 * length and time, so a burst is shed with IngestionCapacityError instead of accumulating.
 */
export class ByteBudget {
  private inFlight = 0;
  private readonly waiters: Waiter[] = [];

  constructor(
    private readonly capacityBytes: number,
    private readonly maxWaiting: number,
    private readonly waitTimeoutMs: number,
  ) {}

  get inFlightBytes(): number {
    return this.inFlight;
  }

  get waiting(): number {
    return this.waiters.length;
  }

  /** Resolves to an idempotent release function. */
  async acquire(bytes: number): Promise<() => void> {
    if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError('bytes must be a non-negative number');
    if (bytes > this.capacityBytes) throw new IngestionTooLargeError();

    if (this.waiters.length === 0 && this.inFlight + bytes <= this.capacityBytes) {
      this.inFlight += bytes;
      return this.releaser(bytes);
    }
    if (this.waiters.length >= this.maxWaiting) throw new IngestionCapacityError();

    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        bytes,
        timer: null,
        grant: () => {
          if (waiter.timer) clearTimeout(waiter.timer);
          this.inFlight += bytes;
          resolve(this.releaser(bytes));
        },
      };
      if (this.waitTimeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(new IngestionCapacityError());
        }, this.waitTimeoutMs);
      }
      this.waiters.push(waiter);
    });
  }

  private releaser(bytes: number): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inFlight -= bytes;
      this.drain();
    };
  }

  private drain(): void {
    while (this.waiters.length > 0 && this.inFlight + this.waiters[0].bytes <= this.capacityBytes) {
      this.waiters.shift()!.grant();
    }
  }
}

export const uploadBudget = new ByteBudget(UPLOAD_BUDGET_BYTES, 0, 0);
export const pdfParseBudget = new ByteBudget(
  PDF_PARSE_BUDGET_BYTES,
  PDF_PARSE_MAX_WAITING,
  PDF_PARSE_WAIT_TIMEOUT_MS,
);

/**
 * Reads multipart form data while counting bytes, so an oversized or mislabeled body is
 * aborted mid-stream instead of being buffered whole before any size check can run.
 */
export async function readBoundedFormData(request: Request, maxBodyBytes: number): Promise<FormData> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBodyBytes) throw new IngestionTooLargeError();
  if (!request.body) return request.formData();

  let seen = 0;
  const counted = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > maxBodyBytes) {
          controller.error(new IngestionTooLargeError());
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  try {
    return await new Response(counted, { headers }).formData();
  } catch (error) {
    if (error instanceof IngestionTooLargeError) throw error;
    // undici surfaces a stream error as a TypeError whose cause is the original error.
    if ((error as { cause?: unknown })?.cause instanceof IngestionTooLargeError) throw new IngestionTooLargeError();
    throw error;
  }
}

/** Declared body size when trustworthy, otherwise the ceiling, so unknown sizes cost the most. */
export function admissionWeight(request: Request, maxBodyBytes: number): number {
  const declared = Number(request.headers.get('content-length'));
  return Number.isFinite(declared) && declared > 0 ? Math.min(declared, maxBodyBytes) : maxBodyBytes;
}
