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

// Review payloads can include complainant identities and privileged classifications.
// Dynamic rendering alone does not prevent intermediary or browser HTTP caching.
const PRIVATE_RESPONSE_HEADERS = { 'Cache-Control': 'no-store, private' } as const

function privateJson(body: unknown, init?: { status?: number; headers?: Record<string, string> }): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { ...init?.headers, ...PRIVATE_RESPONSE_HEADERS },
  })
}

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
      return privateJson({ success: false, error: 'RATE_LIMITED', code }, { status: 429, headers: { 'Retry-After': '3600' } })
    }
    return privateJson({ success: false, error: error.code, code }, { status: status[error.code] })
  }
  const denied = caseAuthorizationResponse(error)
  if (denied) {
    denied.headers.set('Cache-Control', PRIVATE_RESPONSE_HEADERS['Cache-Control'])
    return denied
  }
  if (error instanceof ApiError) {
    return privateJson({ success: false, error: error.code }, { status: error.code === ErrorCode.FORBIDDEN ? 403 : 401 })
  }
  // Anything else (a database or row-level-security failure, a binding error) is logged and answered in the same structured shape.
  logger.error('review route failed', error instanceof Error ? error : new Error(String(error)))
  return privateJson({ success: false, error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' }, { status: 500 })
}

export async function GET() {
  try {
    const who = await actor()
    // An explicit organization makes the database context exactly the organization this route resolved, never a second resolution.
    const list = await withRLSContext({ organizationId: who.organizationId }, async (tx) => {
      const authorizationByReview = new Map<string, { kind: string; id: string; instrument: string }[]>()
      const result = await listMemberReviewIntake(drizzleExecutor(tx), kernelDeps, {
        organizationId: who.organizationId,
        actorUserId: who.userId,
        onOversightAuthorization: (reviewId, authority) => {
          authorizationByReview.set(reviewId, authority.map(({ kind, id, instrument }) => ({ kind, id, instrument })))
        },
      })
      if (result.oversight.length > 0) {
        // The store's authorization callback is an internal security boundary.
        // Never disclose a review if the audit cannot attribute its authorization
        // to a specific mandate, even if the store is later refactored.
        for (const review of result.oversight) {
          const sources = authorizationByReview.get(review.id)
          if (!sources?.some((source) => source.kind === 'mandate' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source.id) && source.instrument.trim().length > 0)) {
            throw new AuthorityStoreError('DENIED', 'OVERSIGHT_AUTHORITY_PROVENANCE_MISSING: refuse unauditable disclosure')
          }
        }
        // An oversight read discloses complainant identity and privilege classification, so it leaves a record in the same transaction.
        await persistAtomicAudit(tx, {
          organizationId: who.organizationId,
          userId: who.userId,
          action: 'review.oversight.read',
          resourceType: 'governance_review',
          resourceId: result.oversight[0].id,
          details: { reviewIds: result.oversight.map((review) => review.id), privilegedCount: result.oversight.filter((review) => review.classification === 'privileged').length, decision: 'review:monitor', authorityByReview: result.oversight.map((review) => ({ reviewId: review.id, sources: authorizationByReview.get(review.id)! })) },
        })
      }
      return result
    })
    return privateJson({ success: true, ...list })
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
      if (text === null) return privateJson({ success: false, error: 'PAYLOAD_TOO_LARGE', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
      raw = JSON.parse(text)
    } catch {
      return privateJson({ success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' }, { status: 400 })
    }
    const parsed = openSchema.safeParse(raw)
    if (!parsed.success) {
      return privateJson({ success: false, error: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR' }, { status: 400 })
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
    return privateJson({ success: true, ...opened, alreadyOpen: !created }, { status: created ? 201 : 200 })
  } catch (error) {
    return reviewErrorResponse(error)
  }
}
