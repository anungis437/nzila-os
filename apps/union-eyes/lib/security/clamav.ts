import { URL } from 'node:url';

export type MalwareScanStatus = 'clean' | 'infected' | 'unavailable';

export interface MalwareScanResult {
  status: MalwareScanStatus;
  scannedAt: string;
  engine: 'clamav';
  signature?: string;
  reason?: string;
}

export class MalwareScanError extends Error {
  public readonly result: MalwareScanResult;

  constructor(message: string, result: MalwareScanResult) {
    super(message);
    this.name = 'MalwareScanError';
    this.result = result;
  }
}

function normalizeScanUrl(raw: string): string {
  const parsed = new URL(raw);
  const basePath = parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname;
  parsed.pathname = `${basePath}/scan`;
  return parsed.toString();
}

function mapJsonResponse(payload: unknown): MalwareScanResult {
  const now = new Date().toISOString();
  if (!payload || typeof payload !== 'object') {
    return {
      status: 'unavailable',
      scannedAt: now,
      engine: 'clamav',
      reason: 'invalid_scanner_payload',
    };
  }

  const record = payload as Record<string, unknown>;
  const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
  const signature = typeof record.signature === 'string' ? record.signature : undefined;
  const reason = typeof record.reason === 'string' ? record.reason : undefined;
  const infected = record.infected === true;

  if (status === 'infected' || infected) {
    return { status: 'infected', scannedAt: now, engine: 'clamav', signature, reason };
  }
  if (status === 'clean') {
    return { status: 'clean', scannedAt: now, engine: 'clamav', signature, reason };
  }
  if (status === 'unavailable') {
    return { status: 'unavailable', scannedAt: now, engine: 'clamav', signature, reason: reason ?? 'scanner_unavailable' };
  }

  return {
    status: 'unavailable',
    scannedAt: now,
    engine: 'clamav',
    reason: reason ?? 'unknown_scanner_status',
  };
}

function mapTextResponse(body: string): MalwareScanResult {
  const now = new Date().toISOString();
  const normalized = body.trim();

  if (/\bOK\b/i.test(normalized)) {
    return { status: 'clean', scannedAt: now, engine: 'clamav' };
  }

  const foundMatch = normalized.match(/: (.+) FOUND$/i);
  if (foundMatch?.[1]) {
    return {
      status: 'infected',
      scannedAt: now,
      engine: 'clamav',
      signature: foundMatch[1],
    };
  }

  return {
    status: 'unavailable',
    scannedAt: now,
    engine: 'clamav',
    reason: 'unrecognized_scanner_response',
  };
}

export async function scanBufferWithClamAV(buffer: Buffer): Promise<MalwareScanResult> {
  const scannerBaseUrl = process.env.CLAMAV_URL;
  if (!scannerBaseUrl) {
    return {
      status: 'unavailable',
      scannedAt: new Date().toISOString(),
      engine: 'clamav',
      reason: 'clamav_url_missing',
    };
  }

  try {
    const response = await fetch(normalizeScanUrl(scannerBaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      return {
        status: 'unavailable',
        scannedAt: new Date().toISOString(),
        engine: 'clamav',
        reason: `scanner_http_${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return mapJsonResponse(await response.json());
    }
    return mapTextResponse(await response.text());
  } catch {
    return {
      status: 'unavailable',
      scannedAt: new Date().toISOString(),
      engine: 'clamav',
      reason: 'scanner_connection_error',
    };
  }
}

function shouldFailClosed(): boolean {
  if (process.env.CLAMAV_FAIL_OPEN === 'true') {
    return false;
  }
  if (process.env.NODE_ENV === 'test' && process.env.CLAMAV_ENFORCE_IN_TEST !== 'true') {
    return false;
  }
  return true;
}

export async function assertBufferSafeForUpload(
  buffer: Buffer,
  fileLabel: string,
): Promise<MalwareScanResult> {
  const result = await scanBufferWithClamAV(buffer);

  if (result.status === 'infected') {
    throw new MalwareScanError(
      `Malware detected in ${fileLabel}${result.signature ? ` (${result.signature})` : ''}`,
      result,
    );
  }

  if (result.status === 'unavailable' && shouldFailClosed()) {
    throw new MalwareScanError(
      `Malware scanner unavailable for ${fileLabel}`,
      result,
    );
  }

  return result;
}

export function isMalwareScanError(error: unknown): error is MalwareScanError {
  return error instanceof MalwareScanError;
}
