/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Canonical Scoring Payload
 * MODULE: OCI/OCRA canonical, timestamp-free scoring payload for byte-identical hashing.
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md
 *           docs/oci/superseded/government-readiness/IMPLEMENTATION_STATUS.md (determinism claim)
 * DOCTRINE_VERSION: 1.0.0
 *
 * The unqualified "byte-identical" determinism claim is false for the *full*
 * scoring outputs, because `ScoringTrace.scoredAt` and
 * `OrganizationalContinuityProfile.generatedAt` are wall-clock timestamps that
 * shift between runs.
 *
 * The honest, defensible claim is:
 *
 *   > For identical substantive inputs, the *canonical scoring payload*
 *   > produced by `toCanonicalScoringPayload()` is byte-identical across runs.
 *   > Wall-clock metadata (`scoredAt`, `generatedAt`, `answeredAt`) is
 *   > deliberately excluded from the canonical payload so it cannot mask a
 *   > substantive drift and so the reproducibility hash is stable.
 *
 * `hashCanonicalScoringPayload()` returns a deterministic SHA-256 (hex) of the
 * canonical payload's stable JSON serialization. Same substantive inputs →
 * same hash, regardless of when the assessment was scored.
 */

import { createHash } from 'node:crypto';
import type { ScoringTrace } from '../scoring';

/**
 * Timestamp-free, wall-clock-independent projection of a ScoringTrace suitable
 * for byte-identical reproducibility hashing.
 */
export interface CanonicalScoringPayload {
  readonly assessmentId: string;
  readonly scoringVersion: string;
  readonly questionBankVersion: number;
  readonly questionTraces: ScoringTrace['questionTraces'];
  readonly dimensionTraces: ScoringTrace['dimensionTraces'];
  readonly composite: number;
  readonly maturityBand: ScoringTrace['maturityBand'];
}

/**
 * Extract the canonical, timestamp-free scoring payload from a ScoringTrace.
 * The returned object contains exactly the fields whose byte-identical
 * reproducibility we are willing to defend publicly.
 */
export function toCanonicalScoringPayload(trace: ScoringTrace): CanonicalScoringPayload {
  return {
    assessmentId: trace.assessmentId,
    scoringVersion: trace.scoringVersion,
    questionBankVersion: trace.questionBankVersion,
    questionTraces: trace.questionTraces,
    dimensionTraces: trace.dimensionTraces,
    composite: trace.composite,
    maturityBand: trace.maturityBand,
  };
}

/**
 * Deterministic, order-stable JSON serializer. Sorts object keys recursively so
 * two payloads with the same substance produce the same bytes regardless of
 * insertion order.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = canonicalize(v);
  return out;
}

/**
 * Byte-identical reproducibility hash of the canonical scoring payload. Same
 * substantive inputs → same hash, across machines and across runs.
 */
export function hashCanonicalScoringPayload(trace: ScoringTrace): string {
  const payload = toCanonicalScoringPayload(trace);
  return createHash('sha256').update(canonicalStringify(payload)).digest('hex');
}
