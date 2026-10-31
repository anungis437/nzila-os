/**
 * /api/reviews
 *   GET  — reviews the authenticated member opened or filed, and reviews a live
 *          monitor mandate allows them to see. Unmandated reviews are not read.
 *   POST — the same member opens a complaint, appeal or reconsideration.
 * The organization, the opener and the complainant come from the session.
 * No review-notification policy is adopted, so a successful response records
 * that no notice was sent.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@nzila/platform-auth/entra/server'
import { ApiError } from '@/lib/api/errors'
import { ErrorCode } from '@/lib/api/standardized-responses'
import { getOrganizationIdForUser } from '@/lib/organization-utils'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { logger } from '@/lib/logger'
import { AuthorityStoreError } from '@/lib/authority/store/executor'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { REVIEW_INTAKE_TYPES } from '@/lib/authority/review-intake-types'
import { listMemberReviewIntake, openMemberReview } from '@/lib/authority/store/review-intake'
import { caseAuthorizationResponse } from '@/lib/cases/case-authorization'

export const dynamic = 'force-dynamic'

const openSchema = z.object({
  reviewType: z.enum(REVIEW_INTAKE_TYPES),
  adverseUserIds: z.array(z.string().min(1).max(255)).max(8).optional(),
}).strict()

async function actor(): Promise<{ userId: string; organizationId: string }> {
  const { userId } = await auth()
  if (!userId) throw ApiError.unauthorized()
  const organizationId = await getOrganizationIdForUser(userId)
  if (!organizationId) throw ApiError.forbidden()
  return { userId, organizationId }
}

/** The whole body is two short fields; anything larger is refused before it is parsed. */
const MAX_BODY_BYTES = 2048

/** Reads at most MAX_BODY_BYTES and stops pulling the stream beyond that. Returns null when the body is larger. */
async function readBoundedBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

const CODE = /\b([A-Z][A-Z0-9_]{3,})\b/

function reviewErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthorityStoreError) {
    const code = CODE.exec(error.message)?.[1] ?? error.code
    const status: Record<AuthorityStoreError['code'], number> = {
      DENIED: 403,
      NOT_FOUND: 404,
      PRECONDITION: 409,
      ALREADY_TERMINAL: 409,
      IDEMPOTENCY_CONFLICT: 409,
      INVALID_CONTEXT: 400,
    }
    if (code === 'REVIEW_INTAKE_LIMIT') {
      return NextResponse.json({ success: false, error: 'RATE_LIMITED', code }, { status: 429, headers: { 'Retry-After': '3600' } })
    }
    return NextResponse.json({ success: false, error: error.code, code }, { status: status[error.code] })
  }
  const denied = caseAuthorizationResponse(error)
  if (denied) return denied
  if (error instanceof ApiError) {
    return NextResponse.json({ success: false, error: error.code }, { status: error.code === ErrorCode.FORBIDDEN ? 403 : 401 })
  }
  // Anything else (a database or row-level-security failure, a binding error) is logged and answered in the same structured shape.
  logger.error('review route failed', error instanceof Error ? error : new Error(String(error)))
  return NextResponse.json({ success: false, error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' }, { status: 500 })
}

export async function GET() {
  try {
    const who = await actor()
    // An explicit organization makes the database context exactly the organization this route resolved, never a second resolution.
    const list = await withRLSContext({ organizationId: who.organizationId }, async (tx) => {
      const result = await listMemberReviewIntake(drizzleExecutor(tx), kernelDeps, { organizationId: who.organizationId, actorUserId: who.userId })
      if (result.oversight.length > 0) {
        // An oversight read discloses complainant identity and privilege classification, so it leaves a record in the same transaction.
        await persistAtomicAudit(tx, {
          organizationId: who.organizationId,
          userId: who.userId,
          action: 'review.oversight.read',
          resourceType: 'governance_review',
          resourceId: result.oversight[0].id,
          details: { reviewIds: result.oversight.map((review) => review.id), privilegedCount: result.oversight.filter((review) => review.classification === 'privileged').length, decision: 'review:monitor' },
        })
      }
      return result
    })
    return NextResponse.json({ success: true, ...list })
  } catch (error) {
    return reviewErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const who = await actor()
    let raw: unknown
    try {
      const text = await readBoundedBody(request)
      if (text === null) return NextResponse.json({ success: false, error: 'PAYLOAD_TOO_LARGE', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
      raw = JSON.parse(text)
    } catch {
      return NextResponse.json({ success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' }, { status: 400 })
    }
    const parsed = openSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const { created, ...opened } = await withRLSContext({ organizationId: who.organizationId }, async (tx) =>
      openMemberReview(drizzleExecutor(tx), kernelDeps, {
        organizationId: who.organizationId,
        actorUserId: who.userId,
        reviewType: parsed.data.reviewType,
        adverseUserIds: parsed.data.adverseUserIds,
      }),
    )
    // A repeat of an already open review answers with that review (200) instead of writing another permanent row (201).
    return NextResponse.json({ success: true, ...opened, alreadyOpen: !created }, { status: created ? 201 : 200 })
  } catch (error) {
    return reviewErrorResponse(error)
  }
}
