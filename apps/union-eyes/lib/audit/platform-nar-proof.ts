/** The platform NAR connection is deliberately separate from the case tenant transaction.
 * The shared NAR adapter seals and stores the record before this persistence
 * callback acknowledges it. Storage/signature errors propagate unchanged.
 * Canonical case audit atomicity remains with canonical-nar-proof.ts.
 */
import type { DecisionProofAdapter } from '@nzila/decision-core'
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { desc, eq } from 'drizzle-orm'

export function createPlatformNarProofAdapter(): DecisionProofAdapter {
  return createNarProofAdapter({
    keyId: process.env.NAR_SIGNING_KEY_ID,
    getPreviousHash: async (organizationId) => {
      const rows = await platformDb
        .select({ hash: auditRecords.narHash })
        .from(auditRecords)
        .where(eq(auditRecords.organizationId, organizationId))
        .orderBy(desc(auditRecords.createdAt))
        .limit(1)
      return rows[0]?.hash
    },
    persistRecord: async (record) => {
      await platformDb.insert(auditRecords).values({
        id: record.id,
        decisionRecordId: record.decisionRecordId,
        organizationId: record.organizationId,
        decisionType: record.decisionType,
        actionType: record.actionType,
        actorId: record.actorId,
        actorType: record.actorType,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        policyId: record.policyId,
        policyVersion: record.policyVersion,
        inputHash: record.inputHash,
        outcomeHash: record.outcomeHash,
        payload: record.payload,
        narHash: record.seal.hash,
        narSignature: record.seal.signature,
        previousHash: record.seal.previousHash,
        keyId: record.seal.keyId,
        storageType: record.storage?.type,
        storageUri: record.storage?.uri,
        immutable: record.storage?.immutable,
        retentionUntil: record.storage?.retentionUntil
          ? new Date(record.storage.retentionUntil)
          : null,
        createdAt: new Date(record.createdAt),
      })
      return { auditRecordId: record.id }
    },
    getSigningSecret: getNarSigningSecret,
  })
}
