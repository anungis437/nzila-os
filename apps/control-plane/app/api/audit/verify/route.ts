import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { verifyNarRecord } from '@nzila/nar'
import type { NarRecord } from '@nzila/nar'

const VerifySchema = z.object({
  auditRecordId: z.string().optional(),
  organizationId: z.string().optional(),
  record: z
    .object({
      id: z.string(),
      decisionRecordId: z.string(),
      organizationId: z.string(),
      decisionType: z.string(),
      actionType: z.string(),
      actorId: z.string(),
      actorType: z.enum(['user', 'system', 'api']),
      resourceType: z.string(),
      resourceId: z.string(),
      policyId: z.string(),
      policyVersion: z.string(),
      inputHash: z.string(),
      outcomeHash: z.string(),
      payload: z.unknown(),
      createdAt: z.string(),
      seal: z.object({
        algorithm: z.literal('sha256'),
        keyId: z.string(),
        hash: z.string(),
        signature: z.string(),
        previousHash: z.string().optional(),
        signedAt: z.string(),
      }),
    })
    .optional(),
})

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
      algorithm: 'sha256',
      keyId: row.keyId,
      hash: row.narHash,
      signature: row.narSignature,
      previousHash: row.previousHash ?? undefined,
      signedAt: row.createdAt.toISOString(),
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuditReadAuth(request)

    const body = await request.json().catch(() => null)
    const parsed = VerifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid verify payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }

    let record: NarRecord | undefined = parsed.data.record as NarRecord | undefined

    if (!record && parsed.data.auditRecordId) {
      const rows = await platformDb
        .select()
        .from(auditRecords)
        .where(eq(auditRecords.id, parsed.data.auditRecordId))
        .limit(1)
      const row = rows[0]
      if (!row) {
        return NextResponse.json(
          { ok: false, error: { code: 'NOT_FOUND', message: 'Audit record not found' } },
          { status: 404 },
        )
      }

      if (parsed.data.organizationId && parsed.data.organizationId !== row.organizationId) {
        return NextResponse.json(
          { ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'organizationId does not match record' } },
          { status: 403 },
        )
      }

      if (auth.role === 'auditor' && auth.organizationId !== row.organizationId) {
        return NextResponse.json(
          { ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'Auditor token is scoped to a different organization' } },
          { status: 403 },
        )
      }

      record = toNarRecord(row)
    }

    if (record && auth.role === 'auditor' && auth.organizationId !== record.organizationId) {
      return NextResponse.json(
        { ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'Auditor token is scoped to a different organization' } },
        { status: 403 },
      )
    }

    if (!record) {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_RECORD', message: 'Provide auditRecordId or record' } },
        { status: 400 },
      )
    }

    const verification = await verifyNarRecord(record)
    return NextResponse.json({ ok: true, data: verification })
  } catch (error) {
    return handleAuthError(error)
  }
}
