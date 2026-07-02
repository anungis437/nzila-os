import { createHash } from 'node:crypto'
import type { DecisionEvidencePack } from './schema.js'

// ─── Pack Hash Computation ────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of a decision evidence pack.
 * The hash is deterministic: fields are included in a stable canonical order.
 */
export function computePackHash(pack: Omit<DecisionEvidencePack, 'packHash' | 'sealed' | 'sealedAt'>): string {
  const canonical = {
    id: pack.id,
    orgId: pack.orgId,
    packType: pack.packType,
    decisionTitle: pack.decisionTitle,
    decisionOutcome: pack.decisionOutcome,
    executiveSummary: pack.executiveSummary,
    evidenceRefs: pack.evidenceRefs.map((r) => r.refId).sort(),
    approvers: pack.approvers.map((a) => a.actorId).sort(),
    createdAt: pack.createdAt,
    prevPackHash: pack.prevPackHash,
    schemaVersion: pack.schemaVersion,
  }

  const json = JSON.stringify(canonical, Object.keys(canonical).sort())
  return createHash('sha256').update(json).digest('hex')
}

// ─── Seal Hash Computation ────────────────────────────────────────────────────

/**
 * Compute the seal hash for the complete pack at export time.
 * This includes the full pack contents and is stored in the sealed pack envelope.
 */
export function computeSealHash(pack: DecisionEvidencePack): string {
  const json = JSON.stringify(pack, null, 0) // compact, stable
  return createHash('sha256').update(json).digest('hex')
}

// ─── Evidence Ref Hash ────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash for an arbitrary buffer or string artifact.
 */
export function computeArtifactHash(content: string | Buffer): string {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
  return createHash('sha256').update(buf).digest('hex')
}
