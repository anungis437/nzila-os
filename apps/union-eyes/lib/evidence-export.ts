/**
 * Evidence Export Module
 *
 * Produces a self-contained evidence pack (JSON) for a given case.
 * Includes: case record, notes, status transitions, audit trail, and
 * an HMAC-SHA256 seal for tamper detection and origin authentication.
 *
 * PR-032: Evidence Export + Seal Verification
 */

import { createHmac } from 'crypto';

/** Seal key — must be set in production; falls back for dev/test only. */
function getSealKey(): string {
  const key = process.env.EVIDENCE_SEAL_KEY;
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('EVIDENCE_SEAL_KEY environment variable is required in production');
  }
  return key || 'dev-seal-key-not-for-production';
}

// ---------------------------------------------------------------------------
// Evidence pack shape
// ---------------------------------------------------------------------------

export interface EvidencePack {
  version: '1.0';
  exportedAt: string;
  exportedBy: string;
  caseId: string;
  organizationId: string;
  caseRecord: Record<string, unknown>;
  notes: Record<string, unknown>[];
  auditTrail: Record<string, unknown>[];
  /** HMAC-SHA256 hex digest of the canonical JSON (everything except `seal`) */
  seal: string;
}

// ---------------------------------------------------------------------------
// Build + seal
// ---------------------------------------------------------------------------

export function buildEvidencePack(input: {
  exportedBy: string;
  caseId: string;
  organizationId: string;
  caseRecord: Record<string, unknown>;
  notes: Record<string, unknown>[];
  auditTrail: Record<string, unknown>[];
}): EvidencePack {
  const unsealedPack = {
    version: '1.0' as const,
    exportedAt: new Date().toISOString(),
    exportedBy: input.exportedBy,
    caseId: input.caseId,
    organizationId: input.organizationId,
    caseRecord: input.caseRecord,
    notes: input.notes,
    auditTrail: input.auditTrail,
  };

  const seal = computeSeal(unsealedPack);

  return { ...unsealedPack, seal };
}

// ---------------------------------------------------------------------------
// Seal computation + verification
// ---------------------------------------------------------------------------

/**
 * Compute an HMAC-SHA256 hex digest over a canonical JSON representation.
 * Uses EVIDENCE_SEAL_KEY for authentication — prevents seal forgery.
 * Stable ordering is guaranteed by `JSON.stringify` on objects with
 * consistent property insertion order (we control the shape).
 */
export function computeSeal(data: Omit<EvidencePack, 'seal'>): string {
  const canonical = JSON.stringify(data);
  return createHmac('sha256', getSealKey()).update(canonical).digest('hex');
}

/**
 * Verify that a pack has not been tampered with.
 * Returns `true` when the computed HMAC seal matches the embedded seal.
 */
export function verifySeal(pack: EvidencePack): boolean {
  const { seal, ...rest } = pack;
  return computeSeal(rest) === seal;
}
