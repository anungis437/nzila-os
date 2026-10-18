import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  find: vi.fn(), update: vi.fn(), access: vi.fn(), audit: vi.fn(), review: vi.fn(), execute: vi.fn(),
  authenticate: vi.fn(), countAudit: vi.fn(), countPayment: vi.fn(), identity: vi.fn(),
  proof: vi.fn(), history: vi.fn(), apiAuth: vi.fn(), readAuth: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../apps/console/lib/services/ai-action-service', () => ({ findAiAction: state.find, updateAiAction: state.update }))
vi.mock('../../apps/console/lib/api-guards', () => ({ requireOrgAccess: state.access }))
vi.mock('../../apps/console/lib/catch-utils', () => ({ asAiError: () => null }))
vi.mock('../../packages/ai-sdk/src/index', () => ({ recordAiReviewDecision: state.review }))
vi.mock('../../packages/ai-core/src/index', async () => {
  const { z } = await import('zod')
  return {
    appendAiAuditEvent: state.audit, executeAction: state.execute,
    AiActionApproveRequestSchema: z.object({ actionId: z.string(), approved: z.boolean(), notes: z.string().optional() }),
  }
})
vi.mock('../../packages/os-core/src/index', () => ({ createLogger: () => state.logger }))
vi.mock('../../packages/os-core/src/telemetry/index', () => ({ withSpan: (_name: string, _meta: unknown, fn: () => unknown) => fn() }))
vi.mock('../../apps/flow/lib/api-guards', () => ({
  authenticateUser: state.authenticate, withRequestContext: (_req: unknown, fn: () => unknown) => fn(),
}))
vi.mock('../../apps/flow/lib/services/governance-metrics-service', () => ({
  countAuditEvents: state.countAudit, countPaymentGateBlocks: state.countPayment,
}))
vi.mock('../../apps/flow/lib/telemetry/counters', () => ({
  getWorkflowTransitionErrorCount: () => 0, getEventEmissionGapCount: () => 0,
}))
vi.mock('../../apps/agrimo/lib/services/identity-sync-service', () => ({
  handleOrganizationCreated: state.identity, handleOrganizationUpdated: state.identity,
  handleMembershipCreated: state.identity, handleMembershipDeleted: state.identity, handleUserDeleted: state.identity,
}))
vi.mock('../../apps/control-plane/lib/services/audit-proof-service', () => ({
  recordDecisionProof: state.proof, getAuditRecordHistory: state.history,
}))
vi.mock('../../apps/control-plane/lib/api-auth', () => ({
  requireApiAuth: state.apiAuth, requireAuditReadAuth: state.readAuth,
  handleAuthError: () => new Response('denied', { status: 401 }),
}))

import { POST as approve } from '../../apps/console/app/api/ai/actions/approve/route'
import { POST as execute } from '../../apps/console/app/api/ai/actions/execute/route'
import { GET as metrics, recordAuditEvent, recordPaymentGateBlock } from '../../apps/flow/app/api/governance/telemetry/route'
import { POST as webhook } from '../../apps/agrimo/app/api/webhooks/clerk/route'
import { POST as proof, GET as history } from '../../apps/control-plane/app/api/audit/record/route'

const orgId = '00000000-0000-4000-8000-000000000001'
const actionId = '00000000-0000-4000-8000-000000000002'
const req = (body: unknown, headers: Record<string, string> = {}) => new NextRequest('https://example.invalid/api', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
})
beforeEach(() => {
  vi.resetAllMocks()
  state.find.mockResolvedValue({ id: actionId, orgId, status: 'awaiting_approval', riskTier: 'low', appKey: 'console', actionType: 'read', profileKey: 'default' })
  state.access.mockResolvedValue({ ok: true, context: { userId: 'actor' } })
  state.execute.mockResolvedValue({ status: 'success' })
  state.authenticate.mockResolvedValue({ ok: true })
  state.countAudit.mockResolvedValue(10)
  state.countPayment.mockResolvedValue(20)
  state.readAuth.mockResolvedValue({ role: 'auditor', organizationId: orgId })
})
afterEach(() => vi.unstubAllEnvs())

describe('A02 action routes', () => {
  it('preserves lookup → guard → update → audit → review ordering and response', async () => {
    const response = await approve(req({ actionId, approved: true, notes: 'review' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ actionId, status: 'approved', approvedBy: 'actor' })
    const order = [state.find, state.access, state.update, state.audit, state.review].map(fn => fn.mock.invocationCallOrder[0])
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(state.update).toHaveBeenCalledWith(actionId, { status: 'approved', approvedBy: 'actor', approvedAt: expect.any(Date), updatedAt: expect.any(Date) })
    expect(state.audit.mock.calls[0][0].afterJson.notes).toBe('review')
  })
  it('preserves missing, denied and conflicting approval results without updates', async () => {
    state.find.mockResolvedValueOnce(undefined)
    expect((await approve(req({ actionId, approved: true }))).status).toBe(404)
    state.access.mockResolvedValueOnce({ ok: false, response: new Response('denied', { status: 403 }) })
    expect((await approve(req({ actionId, approved: true }))).status).toBe(403)
    state.find.mockResolvedValueOnce({ orgId, status: 'executed' })
    expect((await approve(req({ actionId, approved: true }))).status).toBe(409)
    expect(state.update).not.toHaveBeenCalled()
    expect(state.audit).not.toHaveBeenCalled()
  })
  it('preserves execute tenant check, low-risk role, and business result status', async () => {
    state.find.mockResolvedValueOnce({ orgId: 'different' })
    expect((await execute(req({ orgId, actionId }))).status).toBe(403)
    expect(state.access).not.toHaveBeenCalled()
    expect((await execute(req({ orgId, actionId }))).status).toBe(200)
    expect(state.access).toHaveBeenCalledWith(orgId, { minRole: 'org_secretary' })
    expect(state.execute).toHaveBeenCalledWith(actionId, 'actor')
    state.execute.mockResolvedValueOnce({ status: 'failed' })
    expect((await execute(req({ orgId, actionId }))).status).toBe(500)
  })
})

describe('A05 metrics fallback', () => {
  it('does not query before authentication', async () => {
    state.authenticate.mockResolvedValueOnce({ ok: false, response: new Response('denied', { status: 401 }) })
    expect((await metrics(new Request('https://example.invalid'))).status).toBe(401)
    expect(state.countAudit).not.toHaveBeenCalled()
  })
  it('retains independent awaits and the first successful count when the second fails', async () => {
    recordAuditEvent()
    recordPaymentGateBlock()
    state.countPayment.mockRejectedValueOnce(new Error('unavailable'))
    const partial = await (await metrics(new Request('https://example.invalid'))).json()
    expect(partial.audit_event_volume).toBe(10)
    expect(partial.payment_gate_blocks).toBe(1)
    state.countAudit.mockRejectedValueOnce(new Error('unavailable'))
    const fallback = await (await metrics(new Request('https://example.invalid'))).json()
    expect(fallback.audit_event_volume).toBe(1)
    expect(fallback.payment_gate_blocks).toBe(1)
  })
})

describe('A06 verified identity dispatch', () => {
  function signed(timestamp: string, signature?: string) {
    const body = JSON.stringify({ type: 'organization.created', data: { id: 'clerk-org' } })
    const secret = Buffer.from('test-signing-material')
    vi.stubEnv('AUTH_WEBHOOK_SECRET', `whsec_${secret.toString('base64')}`)
    return new Request('https://example.invalid', {
      method: 'POST', body,
      headers: {
        'svix-id': 'envelope', 'svix-timestamp': timestamp,
        'svix-signature': signature ?? `v1,${createHmac('sha256', secret).update(`envelope.${timestamp}.${body}`).digest('base64')}`,
      },
    })
  }
  it('rejects stale/bad signatures before dispatch and keeps verified handler status', async () => {
    expect((await webhook(signed('0'))).status).toBe(400)
    expect((await webhook(signed(String(Math.floor(Date.now() / 1000)), 'v1,aW52YWxpZA=='))).status).toBe(401)
    expect(state.identity).not.toHaveBeenCalled()
    expect((await webhook(signed(String(Math.floor(Date.now() / 1000))))).status).toBe(200)
    expect(state.identity).toHaveBeenCalledExactlyOnceWith({ id: 'clerk-org' })
    state.identity.mockRejectedValueOnce(new Error('private failure'))
    expect((await webhook(signed(String(Math.floor(Date.now() / 1000))))).status).toBe(500)
    expect(state.logger.error).toHaveBeenLastCalledWith('[auth-webhook] Handler error')
  })
})

describe('A07 proof route guards', () => {
  const decision = {
    id: 'decision', organizationId: orgId, domain: 'platform', resourceType: 'item', resourceId: 'item',
    actor: { id: 'actor', type: 'user' }, input: {}, policy: { id: 'policy', version: '1', domain: 'platform' },
    outcome: { status: 'approved' }, createdAt: '2026-01-01T00:00:00.000Z',
  }
  it('preserves auth, missing-header and mismatch guards before proof creation', async () => {
    state.apiAuth.mockRejectedValueOnce(new Error('denied'))
    expect((await proof(req({}))).status).toBe(401)
    expect((await proof(req({}))).status).toBe(400)
    expect((await proof(req({ decision, decisionType: 'd', actionType: 'a' }, { 'x-org-id': 'other' }))).status).toBe(403)
    expect(state.proof).not.toHaveBeenCalled()
  })
  it('preserves auditor history scope and scoped success arguments', async () => {
    expect((await history(new NextRequest('https://example.invalid?orgId=other'))).status).toBe(403)
    expect(state.history).not.toHaveBeenCalled()
    state.history.mockResolvedValueOnce([])
    expect((await history(new NextRequest(`https://example.invalid?orgId=${orgId}&resourceId=item`))).status).toBe(200)
    expect(state.history).toHaveBeenCalledWith(orgId, 'item')
    state.proof.mockResolvedValueOnce({ id: 'record', seal: { hash: 'h', signature: 's' } })
    expect((await proof(req({ decision, decisionType: 'd', actionType: 'a' }, { 'x-org-id': orgId }))).status).toBe(200)
    expect(state.proof).toHaveBeenCalledWith({ decision, decisionType: 'd', actionType: 'a' }, orgId)
  })
})
