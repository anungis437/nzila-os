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
import { getOrganizationIdForUser } from '@/lib/organization-utils'
import { withRLSContext } from '@/lib/db/with-rls-context'
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
    return NextResponse.json({ success: false, error: error.code, code }, { status: status[error.code] })
  }
  const denied = caseAuthorizationResponse(error)
  if (denied) return denied
  throw error
}

export async function GET() {
  try {
    const who = await actor()
    const list = await withRLSContext(async (tx) =>
      listMemberReviewIntake(drizzleExecutor(tx), kernelDeps, { organizationId: who.organizationId, actorUserId: who.userId }),
    )
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
      raw = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' }, { status: 400 })
    }
    const parsed = openSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const opened = await withRLSContext(async (tx) =>
      openMemberReview(drizzleExecutor(tx), kernelDeps, {
        organizationId: who.organizationId,
        actorUserId: who.userId,
        reviewType: parsed.data.reviewType,
        adverseUserIds: parsed.data.adverseUserIds,
      }),
    )
    return NextResponse.json({ success: true, ...opened }, { status: 201 })
  } catch (error) {
    return reviewErrorResponse(error)
  }
}
