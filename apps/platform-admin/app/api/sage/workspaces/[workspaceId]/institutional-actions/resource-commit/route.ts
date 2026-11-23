/**
 * Platform Admin — SAGE institutional resource.commit API
 *
 * POST /api/sage/workspaces/[workspaceId]/institutional-actions/resource-commit
 *
 * Pattern-A financial commitment under a server-attested institutional mandate.
 * Browser may supply mandateId, resourceId, optional claimedPositionId and
 * requestedCommitMinor only. Verification labels, currency, instrument
 * authority, ledger totals, conflict/recusal and authoritative office/position
 * are never accepted from the request body.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { CreateInstitutionalResourceCommitRequest } from '@/lib/sage/institutional-schemas'
import { commitSageResourceUnderMandateForScope } from '@/lib/sage/institutional-service'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' },
      },
      { status: 400 },
    )
  }

  return withOrgWrite(request, async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
        { status: 400 },
      )
    }

    const parsed = CreateInstitutionalResourceCommitRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid institutional resource commit payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await commitSageResourceUnderMandateForScope(ctx, workspaceId, parsed.data, {
        idempotencyKey,
      })
      return NextResponse.json(
        { ok: true, data: result.response },
        { status: result.replayed ? 200 : 201 },
      )
    } catch (error) {
      // Workspace miss remains a non-disclosing 404 via sageErrorResponse/NOT_FOUND.
      if (
        error instanceof Error &&
        /not found/i.test(error.message) &&
        !('code' in error)
      ) {
        return sageNotFoundResponse()
      }
      return sageErrorResponse(error)
    }
  })
}
