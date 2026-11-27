import 'server-only'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import type { createNarRecord } from '@nzila/nar'

export async function findPreviousAuditHash(organizationId: string) {
  return platformDb
    .select({ hash: auditRecords.narHash })
    .from(auditRecords)
    .where(eq(auditRecords.organizationId, organizationId))
    .orderBy(desc(auditRecords.createdAt))
    .limit(1)
}

export async function persistAuditRecord(nar: Awaited<ReturnType<typeof createNarRecord>>) {
  await platformDb.insert(auditRecords).values({
    id: nar.id,
    decisionRecordId: nar.decisionRecordId,
    organizationId: nar.organizationId,
    decisionType: nar.decisionType,
    actionType: nar.actionType,
    actorId: nar.actorId,
    actorType: nar.actorType,
    resourceType: nar.resourceType,
    resourceId: nar.resourceId,
    policyId: nar.policyId,
    policyVersion: nar.policyVersion,
    inputHash: nar.inputHash,
    outcomeHash: nar.outcomeHash,
    payload: nar.payload,
    narHash: nar.seal.hash,
    narSignature: nar.seal.signature,
    previousHash: nar.seal.previousHash,
    keyId: nar.seal.keyId,
    storageType: nar.storage?.type,
    storageUri: nar.storage?.uri,
    immutable: nar.storage?.immutable,
    retentionUntil: nar.storage?.retentionUntil ? new Date(nar.storage.retentionUntil) : null,
    createdAt: new Date(nar.createdAt),
  })
}

export async function listAuditRecords(orgId: string, resourceId: string | null) {
  return platformDb
    .select()
    .from(auditRecords)
    .where(
      resourceId
        ? and(eq(auditRecords.organizationId, orgId), eq(auditRecords.resourceId, resourceId))
        : eq(auditRecords.organizationId, orgId),
    )
    .orderBy(desc(auditRecords.createdAt))
    .limit(100)
}

export async function findAuditRecordById(id: string) {
  return (await platformDb.select().from(auditRecords).where(eq(auditRecords.id, id)).limit(1))[0]
}

export async function listAuditExportRecords(input: {
  orgId: string
  from: string | null
  to: string | null
  limit: number
}) {
  const filters = [eq(auditRecords.organizationId, input.orgId)]
  if (input.from) filters.push(gte(auditRecords.createdAt, new Date(input.from)))
  if (input.to) filters.push(lte(auditRecords.createdAt, new Date(input.to)))
  return platformDb
    .select()
    .from(auditRecords)
    .where(and(...filters))
    .orderBy(asc(auditRecords.createdAt))
    .limit(Math.min(Math.max(input.limit, 1), 5000))
}
