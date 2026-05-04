import { asc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { verifyFullChain } from '@nzila/nar'
import type { NarRecord } from '@nzila/nar'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('control-plane:jobs:verify-nar-chain')

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const cause = (error as { cause?: { code?: string } }).cause
  return cause?.code === '42P01'
}

function parseOrgFilterArg(): string | undefined {
  const marker = '--org='
  const arg = process.argv.find((value) => value.startsWith(marker))
  return arg ? arg.slice(marker.length) : undefined
}

async function loadOrgIds(filterOrgId?: string): Promise<string[]> {
  if (filterOrgId) return [filterOrgId]

  let rows: Array<{ organizationId: string }>
  try {
    rows = await platformDb
      .select({ organizationId: auditRecords.organizationId })
      .from(auditRecords)
      .groupBy(auditRecords.organizationId)
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error
    }

    logger.warn('audit_records table is missing; treating NAR chain verification as empty in local environment')
    return []
  }

  return rows.map((row) => row.organizationId)
}

async function run(): Promise<void> {
  const requestedOrgId = parseOrgFilterArg()
  const orgIds = await loadOrgIds(requestedOrgId)

  logger.info('Starting daily NAR chain verification', {
    orgCount: orgIds.length,
    requestedOrgId,
  })

  for (const orgId of orgIds) {
    const rows = await platformDb
      .select()
      .from(auditRecords)
      .where(eq(auditRecords.organizationId, orgId))
      .orderBy(asc(auditRecords.createdAt))

    const records = rows.map((row) => ({
      id: row.id,
      decisionRecordId: row.decisionRecordId,
      organizationId: row.organizationId,
      decisionType: row.decisionType,
      actionType: row.actionType,
      actorId: row.actorId,
      actorType: row.actorType as 'user' | 'system' | 'api',
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      policyId: row.policyId,
      policyVersion: row.policyVersion,
      inputHash: row.inputHash,
      outcomeHash: row.outcomeHash,
      payload: row.payload as NarRecord['payload'],
      storage: row.storageType && row.storageUri && row.immutable && row.retentionUntil
        ? {
            type: row.storageType as 'azure_blob',
            uri: row.storageUri,
            immutable: row.immutable,
            retentionUntil: row.retentionUntil.toISOString(),
          }
        : undefined,
      createdAt: row.createdAt.toISOString(),
      seal: {
        algorithm: 'sha256' as const,
        keyId: row.keyId,
        hash: row.narHash,
        signature: row.narSignature,
        previousHash: row.previousHash ?? undefined,
        signedAt: row.createdAt.toISOString(),
      },
    }))

    const verification = await verifyFullChain({ organizationId: orgId, records })

    logger.info('NAR chain verification completed for organization', {
      organizationId: orgId,
      totalRecords: verification.totalRecords,
      valid: verification.valid,
      corruptionIndex: verification.corruptionIndex,
      anomalies: verification.anomalies,
    })

    if (!verification.valid) {
      throw new Error(`NAR chain verification failed for organization ${orgId}`)
    }
  }

  logger.info('NAR chain verification completed', {
    checkedOrganizations: orgIds.length,
  })
}

run().catch((error) => {
  logger.error('NAR chain verification job failed', {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : { value: String(error) },
  })
  process.exitCode = 1
})
