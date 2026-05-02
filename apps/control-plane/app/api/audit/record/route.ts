import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { createNarRecord, getNarSigningSecret, uploadNarToAzureImmutableBlob } from '@nzila/nar'
import type { DecisionRecord } from '@nzila/decision-core'

const BodySchema = z.object({
  decisionType: z.string().min(1),
  actionType: z.string().min(1),
  decision: z.object({
    id: z.string().min(1),
    organizationId: z.string().min(1),
    domain: z.enum(['labour', 'legal', 'commerce', 'media', 'education', 'health', 'platform']),
    resourceType: z.string().min(1),
    resourceId: z.string().min(1),
    actor: z.object({
      id: z.string().min(1),
      type: z.enum(['user', 'system', 'api']),
      role: z.string().optional(),
      authorityScope: z.array(z.string()).optional(),
    }),
    input: z.unknown(),
    policy: z.object({
      id: z.string().min(1),
      version: z.string().min(1),
      domain: z.string().min(1),
    }),
    outcome: z.object({
      status: z.enum(['approved', 'rejected', 'pending', 'escalated']),
      reasonCode: z.string().optional(),
      explanationTrace: z.array(z.string()).optional(),
    }),
    proof: z
      .object({
        auditRecordId: z.string().optional(),
        hash: z.string().optional(),
        signature: z.string().optional(),
        previousHash: z.string().optional(),
        verified: z.boolean().optional(),
      })
      .optional(),
    createdAt: z.string().min(1),
  }),
})

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)

    const orgHeader = request.headers.get('x-org-id')
    if (!orgHeader) {
      return NextResponse.json(
        { ok: false, error: { code: 'ORG_SCOPE_REQUIRED', message: 'x-org-id header is required' } },
        { status: 400 },
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }

    const input = parsed.data
    if (input.decision.organizationId !== orgHeader) {
      return NextResponse.json(
        { ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'x-org-id must match decision.organizationId' } },
        { status: 403 },
      )
    }

    const previous = await platformDb
      .select({ hash: auditRecords.narHash })
      .from(auditRecords)
      .where(eq(auditRecords.organizationId, orgHeader))
      .orderBy(desc(auditRecords.createdAt))
      .limit(1)

    const decision = input.decision as DecisionRecord

    const narWithoutStorage = await createNarRecord({
      decision,
      decisionType: input.decisionType,
      actionType: input.actionType,
      previousHash: previous[0]?.hash,
      isGenesis: !previous[0]?.hash,
      keyId: process.env.NAR_SIGNING_KEY_ID,
      secret: await getNarSigningSecret(),
    })

    const storage = await uploadNarToAzureImmutableBlob(narWithoutStorage)

    const nar = await createNarRecord({
      recordId: narWithoutStorage.id,
      decision,
      decisionType: input.decisionType,
      actionType: input.actionType,
      previousHash: previous[0]?.hash,
      isGenesis: !previous[0]?.hash,
      createdAt: narWithoutStorage.createdAt,
      keyId: process.env.NAR_SIGNING_KEY_ID,
      secret: await getNarSigningSecret(),
      storage,
    })

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

    return NextResponse.json({
      ok: true,
      data: {
        auditRecordId: nar.id,
        hash: nar.seal.hash,
        signature: nar.seal.signature,
        previousHash: nar.seal.previousHash,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuditReadAuth(request)

    const orgId = request.nextUrl.searchParams.get('orgId')
    const resourceId = request.nextUrl.searchParams.get('resourceId')

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: { code: 'ORG_ID_REQUIRED', message: 'orgId query param is required' } },
        { status: 400 },
      )
    }

    if (auth.role === 'auditor' && auth.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'Auditor token is scoped to a different organization' } },
        { status: 403 },
      )
    }

    const records = await platformDb
      .select()
      .from(auditRecords)
      .where(resourceId
        ? and(eq(auditRecords.organizationId, orgId), eq(auditRecords.resourceId, resourceId))
        : eq(auditRecords.organizationId, orgId))
      .orderBy(desc(auditRecords.createdAt))
      .limit(100)

    return NextResponse.json({ ok: true, data: records })
  } catch (error) {
    return handleAuthError(error)
  }
}
