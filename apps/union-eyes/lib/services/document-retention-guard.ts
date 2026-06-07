export interface DocumentMutabilityGuardInput {
  metadata?: unknown;
}

interface ParsedRetentionSignals {
  legalHoldActive: boolean;
  retentionUntil: Date | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseSignals(metadata: unknown): ParsedRetentionSignals {
  const record = toRecord(metadata);
  const legalHold = record.legalHold;
  const legalHoldRecord = toRecord(legalHold);
  const retention = toRecord(record.retention);

  const legalHoldActive = record.legalHoldActive === true
    || legalHold === true
    || legalHoldRecord.active === true;

  const retentionUntil = parseDate(
    record.retentionUntil
      ?? record.recordsRetentionUntil
      ?? retention.until
      ?? retention.retentionUntil,
  );

  return {
    legalHoldActive,
    retentionUntil,
  };
}

export function getDocumentMutabilityBlockReason(
  input: DocumentMutabilityGuardInput,
  now = new Date(),
): string | null {
  const signals = parseSignals(input.metadata);

  if (signals.legalHoldActive) {
    return 'Document is under legal hold';
  }

  if (signals.retentionUntil && signals.retentionUntil.getTime() > now.getTime()) {
    return `Document is retained until ${signals.retentionUntil.toISOString()}`;
  }

  return null;
}
