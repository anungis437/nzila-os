/**
 * Platform Admin — ITSM Config audit logger
 *
 * Records every mutating ITSM-config action (create/update/delete on queues,
 * SLA profiles, and approval decisions) to the platform's NAR-sealed
 * `audit_records` table via the @nzila/decision-core enforcement pipeline.
 *
 * Why go through `enforceDecision()`:
 *  - Produces a hash-chained, signature-bearing audit record (NAR seal).
 *  - Uses the same proof adapter pattern as `/api/admin/org` so the audit
 *    chain stays continuous per-org.
 *  - Gives us free policy hooks for future compliance gates.
 *
 * The helper is intentionally narrow — callers pass an action descriptor
 * plus the resource id and any structured input/outcome metadata. Failures
 * are logged but do NOT crash the request: audit is best-effort from the
 * route handler's perspective. The underlying NAR adapter still persists
 * even when no policy gate exists.
 */
import { enforceDecision } from '@nzila/decision-core'
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar'
import { createLogger } from '@nzila/os-core'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { desc, eq } from 'drizzle-orm'

const logger = createLogger('platform-admin:itsm-audit')

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

export interface RecordItsmAuditInput {
  orgId: string
  actorId: string
  actorRole: string
  /** dot-namespaced action — e.g. 'itsm.queue.created' */
  actionType: string
  /** resource discriminator — e.g. 'itsm_queue', 'itsm_sla_profile' */
  resourceType: string
  /** uuid of the affected resource (post-write) */
  resourceId: string
  /** structured request input (will be hashed and included in payload) */
  input?: Record<string, unknown>
  /** structured outcome (will be hashed and included in payload) */
  outcome?: Record<string, unknown>
}

/**
 * Best-effort NAR-sealed audit record.
 * Returns true on success, false on a swallowed audit failure.
 */
export async function recordItsmAudit(
  args: RecordItsmAuditInput,
): Promise<boolean> {
  try {
    await enforceDecision({
      decisionType: `platform.${args.resourceType}.mutated`,
      organizationId: args.orgId,
      resourceId: args.resourceId,
      actor: {
        id: args.actorId,
        type: 'user',
        role: args.actorRole,
        authorityScope: [`${args.resourceType}:write`],
      },
      authorityScope: [`${args.resourceType}:write`],
      input: args.input ?? {},
      policy: {
        id: `platform.${args.resourceType}.audit`,
        version: '1.0.0',
        domain: 'platform',
      },
      actionType: args.actionType,
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
    })
    return true
  } catch (error) {
    logger.error('Failed to record ITSM audit', {
      error: error instanceof Error ? error.message : String(error),
      actionType: args.actionType,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      orgId: args.orgId,
    })
    return false
  }
}
