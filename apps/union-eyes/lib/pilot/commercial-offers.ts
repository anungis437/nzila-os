import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function commercialTermsDigest(input: {
  applicationId: string;
  organizationId: string;
  version: number;
  currency: string;
  amount: string;
  pricingBasis: string;
  memberCountBasis: number;
  memberCountEvidenceRef: string;
  terms: Record<string, unknown>;
  expiresAt: Date;
}): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize({ ...input, expiresAt: input.expiresAt.toISOString() })))
    .digest('hex');
}

export const PILOT_COMMERCIAL_NOTICE_VERSION = 'pilot-commercial-acceptance-v1';
