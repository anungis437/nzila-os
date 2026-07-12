/**
 * Platform Admin — SAGE audit sink adapter (server-only)
 *
 * Implements the `SageAuditSink` port from `@nzila/sage-core` by routing SAGE
 * audit payloads into the SAME NAR-sealed audit pipeline used by the rest of
 * platform-admin (`enforceDecision` → hash-chained `audit_records`). This is
 * NOT a second audit store — it is the SAGE-side port into the existing audit
 * infrastructure, mirroring `recordItsmAudit`.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import { enforceDecision } from '@nzila/decision-core'
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar'
import { createLogger } from '@nzila/os-core'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { desc, eq } from 'drizzle-orm'
import type { SageAuditPayload, SageAuditSink } from '@nzila/sage-core'

const logger = createLogger('platform-admin:sage-audit')

const narProofAdapter = createNarProofAdapter({
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

/**
 * SAGE audit sink backed by the NAR-sealed audit pipeline.
 *
 * Audit is best-effort from the caller's perspective (failures are logged, not
 * thrown), matching `recordItsmAudit` — a swallowed audit failure must not roll
 * back a persisted SAGE action.
 */
export function createSagePlatformAuditSink(actorRole: string): SageAuditSink {
  return {
    async record(input: SageAuditPayload): Promise<void> {
      try {
        await enforceDecision({
          decisionType: `platform.${input.resource}.mutated`,
          organizationId: input.orgId,
          resourceId: input.resourceId ?? input.resource,
          actor: {
            id: input.actorId,
            type: 'user',
            role: actorRole,
            authorityScope: [`${input.resource}:write`],
          },
          authorityScope: [`${input.resource}:write`],
          input: input.payload ?? {},
          policy: {
            id: `platform.${input.resource}.audit`,
            version: '1.0.0',
            domain: 'platform',
          },
          actionType: input.action,
          proofAdapter: narProofAdapter,
          emitAuditPayload: true,
        })
      } catch (error) {
        logger.error('Failed to record SAGE audit', {
          error: error instanceof Error ? error.message : String(error),
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          orgId: input.orgId,
        })
      }
    },
  }
}
