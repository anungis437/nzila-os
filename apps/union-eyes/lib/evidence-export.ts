/**
 * Evidence Export Module
 *
 * Produces a self-contained evidence pack (JSON) for a given case.
 * Includes: case record, notes, status transitions, audit trail, and
 * a SHA-256 seal for tamper detection.
 *
 * PR-032: Evidence Export + Seal Verification
 */

import { createHash } from 'crypto';

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
  /** SHA-256 hex digest of the canonical JSON (everything except `seal`) */
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
 * Compute a SHA-256 hex digest over a canonical JSON representation.
 * Stable ordering is guaranteed by `JSON.stringify` on objects with
 * consistent property insertion order (we control the shape).
 */
export function computeSeal(data: Omit<EvidencePack, 'seal'>): string {
  const canonical = JSON.stringify(data);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify that a pack has not been tampered with.
 * Returns `true` when the computed seal matches the embedded seal.
 */
export function verifySeal(pack: EvidencePack): boolean {
  const { seal, ...rest } = pack;
  return computeSeal(rest) === seal;
}
