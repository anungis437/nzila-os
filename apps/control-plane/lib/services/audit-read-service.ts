import type { AuditReadAccessContext } from '@/lib/api-auth'
import type { auditRecords } from '@nzila/db/schema'
import { buildNarExportPack, verifyFullChain, verifyNarRecord, type NarRecord } from '@nzila/nar'
import {
  findAuditRecordById,
  listAuditExportRecords,
} from '@/lib/repositories/audit-record-repository'

function toNarRecord(row: typeof auditRecords.$inferSelect): NarRecord {
  return {
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
    storage:
      row.storageType && row.storageUri && row.immutable && row.retentionUntil
        ? {
            type: row.storageType as 'azure_blob',
            uri: row.storageUri,
            immutable: row.immutable,
            retentionUntil: row.retentionUntil.toISOString(),
          }
        : undefined,
    createdAt: row.createdAt.toISOString(),
    seal: {
      algorithm: 'sha256',
      keyId: row.keyId,
      hash: row.narHash,
      signature: row.narSignature,
      previousHash: row.previousHash ?? undefined,
      signedAt: row.createdAt.toISOString(),
    },
  }
}

export async function exportAuditRecords(input: {
  orgId: string
  from: string | null
  to: string | null
  limit: number
  generatedBy: string
}) {
  const records = (await listAuditExportRecords(input)).map(toNarRecord)
  const chain = await verifyFullChain({ organizationId: input.orgId, records })
  const pack = await buildNarExportPack(records, input.orgId, { generatedBy: input.generatedBy })
  return {
    ...pack,
    chainProof: {
      rootHash: chain.rootHash ?? '',
      totalRecords: chain.totalRecords,
      verified: chain.valid,
    },
  }
}

export async function verifyAuditProof(
  input: { auditRecordId?: string; organizationId?: string; record?: NarRecord },
  auth: AuditReadAccessContext,
) {
  let record = input.record
  if (!record && input.auditRecordId) {
    const row = await findAuditRecordById(input.auditRecordId)
    if (!row)
      return {
        status: 404,
        body: { ok: false, error: { code: 'NOT_FOUND', message: 'Audit record not found' } },
      }
    if (input.organizationId && input.organizationId !== row.organizationId)
      return {
        status: 403,
        body: {
          ok: false,
          error: { code: 'ORG_SCOPE_MISMATCH', message: 'organizationId does not match record' },
        },
      }
    if (auth.role === 'auditor' && auth.organizationId !== row.organizationId)
      return {
        status: 403,
        body: {
          ok: false,
          error: {
            code: 'ORG_SCOPE_MISMATCH',
            message: 'Auditor token is scoped to a different organization',
          },
        },
      }
    record = toNarRecord(row)
  }
  if (record && auth.role === 'auditor' && auth.organizationId !== record.organizationId)
    return {
      status: 403,
      body: {
        ok: false,
        error: {
          code: 'ORG_SCOPE_MISMATCH',
          message: 'Auditor token is scoped to a different organization',
        },
      },
    }
  if (!record)
    return {
      status: 400,
      body: {
        ok: false,
        error: { code: 'MISSING_RECORD', message: 'Provide auditRecordId or record' },
      },
    }
  return { status: 200, body: { ok: true, data: await verifyNarRecord(record) } }
}
