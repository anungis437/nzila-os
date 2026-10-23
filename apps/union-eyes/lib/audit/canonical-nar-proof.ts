import { sql } from 'drizzle-orm'
import type { DecisionProofAdapter } from '@nzila/decision-core'
import { createNarRecord, getNarSigningSecret, verifyNarRecord, type NarRecord } from '@nzila/nar'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { appendCanonicalAuditLog } from './canonical-audit-chain'

/** Signed decision proofs in the canonical tenant audit chain. This makes no Azure WORM claim. */
export const canonicalNarProofAdapter: DecisionProofAdapter = {
  async createProof(decision, context) {
    return withRLSContext({ organizationId: decision.organizationId }, (tx) =>
      createCanonicalNarProofAdapter(tx).createProof(decision, context))
  },
}

/** Use the caller's bound transaction so the business write and proof commit together. */
export function createCanonicalNarProofAdapter(tx: RLSTx): DecisionProofAdapter {
  return {
    async createProof(decision, context) {
      // Share the audit writer's lock, holding it through head read, signing and append.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(
        hashtextextended(${`audit_logs:${decision.organizationId}`}, 0))`)
      const previous = (await tx.execute(sql`SELECT details->'narRecord' AS record
        FROM public.audit_logs WHERE organization_id=${decision.organizationId}::uuid
        AND action='nar.decision.proof' ORDER BY created_at DESC, id DESC LIMIT 1`
      )) as unknown as { record: NarRecord }[]
      const secret = await getNarSigningSecret()
      const head = previous[0]?.record
      if (head && (head.organizationId !== decision.organizationId || !(await verifyNarRecord(head, secret)).valid))
        throw new Error('UE_NAR_INVALID_CANONICAL_HEAD')
      const record = await createNarRecord({
        decision, decisionType: context.decisionType, actionType: context.actionType,
        previousHash: head?.seal.hash, isGenesis: !head,
        keyId: process.env.NAR_SIGNING_KEY_ID, secret,
      })
      const { contentHash } = await appendCanonicalAuditLog(tx, {
        organizationId: decision.organizationId, action: 'nar.decision.proof',
        resourceType: decision.resourceType, resourceId: decision.resourceId,
        userId: decision.actor.id,
        details: { narRecord: record, proofStorage: 'canonical_append_only_audit_log' },
      })
      const [stored] = (await tx.execute(sql`SELECT id, details->'narRecord' AS record
        FROM public.audit_logs WHERE organization_id=${decision.organizationId}::uuid
        AND content_hash=${contentHash} AND action='nar.decision.proof'`
      )) as unknown as { id: string; record: NarRecord }[]
      if (!stored || stored.record.id !== record.id || stored.record.seal.hash !== record.seal.hash ||
        !(await verifyNarRecord(stored.record, secret)).valid)
        throw new Error('UE_NAR_CANONICAL_READBACK_FAILED')
      return { auditRecordId: stored.id, hash: stored.record.seal.hash,
        signature: stored.record.seal.signature, previousHash: stored.record.seal.previousHash,
        verified: true }
    },
  }
}
