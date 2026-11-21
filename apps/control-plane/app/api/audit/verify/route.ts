import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import type { NarRecord } from '@nzila/nar'
import { verifyAuditProof } from '@/lib/services/audit-read-service'

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

export async function POST(request: NextRequest) {
  try {
    if (request.headers.has('x-api-key')) {
      await requireApiAuth(request)
    }

    const auth = await requireAuditReadAuth(request)

    const body = await request.json().catch(() => null)
    const parsed = VerifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid verify payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const result = await verifyAuditProof(
      { ...parsed.data, record: parsed.data.record as NarRecord | undefined },
      auth,
    )
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return handleAuthError(error)
  }
}
