import { NextResponse } from 'next/server'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor, caseAuthorizationResponse } from '@/lib/cases/case-authorization'
import { CreateCaseDeadline, ChangeCaseDeadline } from '@/lib/cases/case-deadline-contract'
import { listCaseDeadlines, createCaseDeadline, changeCaseDeadline } from '@/lib/cases/case-deadlines'
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard'
import { authorizationDenialResponse } from '@/lib/api/authorization-denial'
import { ApiError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ caseId: string }> }
async function handle(request: Request, context: Context, method: 'GET' | 'POST' | 'PATCH') {
  try {
    const actor = await getCaseActor()
    await requireEntitlement(actor.organizationId, 'grievance_case_suite')
    const { caseId } = await context.params
    if (method === 'GET') return NextResponse.json(await withRLSContext(tx => listCaseDeadlines(tx, actor, caseId)))
    let body: unknown
    try { body = await request.json() } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }) }
    if (method === 'POST') {
      const parsed = CreateCaseDeadline.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
      const result = await withRLSContext(tx => createCaseDeadline(tx, actor, caseId, parsed.data))
      return NextResponse.json(result, { status: result.created ? 201 : 200 })
    }
    const parsed = ChangeCaseDeadline.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    return NextResponse.json(await withRLSContext(tx => changeCaseDeadline(tx, actor, caseId, parsed.data)))
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CONFLICT') return NextResponse.json({ error: 'CONFLICT' }, { status: 409 })
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'CONFLICT' }, { status: 409 })
    const denied = caseAuthorizationResponse(error) ?? authorizationDenialResponse(error)
    if (denied) return denied
    logger.error('Case deadline operation failed', error as Error)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
export const GET = (request: Request, context: Context) => handle(request, context, 'GET')
export const POST = (request: Request, context: Context) => handle(request, context, 'POST')
export const PATCH = (request: Request, context: Context) => handle(request, context, 'PATCH')
