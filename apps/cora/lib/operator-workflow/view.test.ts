import { describe, expect, it } from 'vitest'
import { createSyntheticOperatorRuntime, finishSyntheticRun } from './synthetic-journeys'
import { createInstitutionalWorkflowService } from '../institutional-workflow/service'
import { WorkflowDenied } from '../institutional-workflow/contracts'

describe('server-derived operator workflow view', () => {
  it.each(['tenant', 'actor', 'permission', 'view-grant'] as const)(
    'fails closed with no detail leakage for missing %s authority',
    async (caseName) => {
      const f = createSyntheticOperatorRuntime()
      const run = await f.service.request(f.requestFor(0))
      if (caseName === 'tenant') f.setContext({ orgId: 'different-tenant' })
      if (caseName === 'actor') f.setContext({ actorId: 'different-actor' })
      if (caseName === 'permission') f.setContext({ permissions: [] })
      if (caseName === 'view-grant') f.ports.authorizeOperatorView = undefined
      const view = await f.service.inspectOperator(run.runId)
      expect(view).toEqual({
        access: 'DENIED',
        message: 'This workflow is unavailable in your current authorized context.',
      })
      expect(f.denials.length).toBeGreaterThan(0)
    },
  )
  it('does not assume historical viewing permission after revocation', async () => {
    const f = createSyntheticOperatorRuntime()
    const run = await f.service.request(f.requestFor(0))
    await finishSyntheticRun(f, run.runId)
    f.recipientRights.get(run.recipientId)!.revokedAt = run.requestedAt
    f.ports.authorizeOperatorView = async () => ({
      allowed: true,
      authorizationRef: 'current-only',
      historical: false,
    })
    expect((await f.service.inspectOperator(run.runId)).access).toBe('DENIED')
  })
  it.each(['UNKNOWN', 'DENIED'] as const)(
    'does not use a historical viewing grant to bypass %s disclosure',
    async (state) => {
      const f = createSyntheticOperatorRuntime()
      const run = await f.service.request(f.requestFor(0))
      await finishSyntheticRun(f, run.runId)
      f.recipientRights.get(run.recipientId)!.disclosure = state
      expect(await f.service.inspectOperator(run.runId)).toEqual({
        access: 'DENIED',
        message: 'This workflow is unavailable in your current authorized context.',
      })
    },
  )
  it('does not manufacture currentness from CURRENT without a runtime verification timestamp', async () => {
    const f = createSyntheticOperatorRuntime()
    f.evidence.values().next().value!.assertion.evidence.freshness = 'CURRENT'
    const run = await f.service.request(f.requestFor(0))
    const view = await f.service.inspectOperator(run.runId)
    if (view.access !== 'ALLOWED') throw new Error('Expected authorized synthetic view')
    expect(view.freshness).toMatchObject({ state: 'NOT_VERIFIED', verifiedAt: null })
  })
  it('does not expose source content when current source disclosure becomes unknown', async () => {
    const f = createSyntheticOperatorRuntime()
    const run = await f.service.request(f.requestFor(0))
    await finishSyntheticRun(f, run.runId)
    f.sourceRights.disclosure = 'UNKNOWN'
    expect((await f.service.inspectOperator(run.runId)).access).toBe('DENIED')
  })
  it('shows the earliest source or recipient authorization expiry', async () => {
    const f = createSyntheticOperatorRuntime()
    const run = await f.service.request(f.requestFor(0))
    const at = Date.parse(f.journey.attempt.at)
    const earlier = new Date(at + 86400000).toISOString()
    f.sourceRights.expiresAt = earlier
    f.recipientRights.get(run.recipientId)!.expiresAt = new Date(at + 172800000).toISOString()
    const view = await f.service.inspectOperator(run.runId)
    if (view.access !== 'ALLOWED') throw new Error('Expected permitted view')
    expect(view.permissions.expiresAt).toBe(earlier)
  })
  it('shows CURRENT only with explicit verification time and removes current treatment for history', async () => {
    const f = createSyntheticOperatorRuntime()
    const definition = f.evidence.values().next().value!
    definition.assertion.evidence.freshness = 'CURRENT'
    definition.currentlyVerifiedAt = f.journey.attempt.at
    const run = await f.service.request(f.requestFor(0))
    const current = await f.service.inspectOperator(run.runId)
    if (current.access !== 'ALLOWED') throw new Error('Expected current authorized view')
    expect(current.freshness).toMatchObject({ state: 'CURRENT', verifiedAt: f.journey.attempt.at })
    f.recipientRights.get(run.recipientId)!.revokedAt = run.requestedAt
    const history = await f.service.inspectOperator(run.runId)
    if (history.access !== 'ALLOWED') throw new Error('Expected permitted historical view')
    expect(history.freshness.state).toBe('NOT_VERIFIED')
    expect(history.actionable).toBe(false)
  })
  it('records separate disposition ownership without inferring a decision value', async () => {
    const f = createSyntheticOperatorRuntime()
    const run = await f.service.request(f.requestFor(0))
    await finishSyntheticRun(f, run.runId)
    f.becomeRecipient()
    await f.service.recordDisposition({
      runId: run.runId,
      externalDispositionRef: 'synthetic-external-reference',
    })
    f.becomeOperator()
    const view = await f.service.inspectOperator(run.runId)
    if (view.access !== 'ALLOWED') throw new Error('Expected permitted view')
    expect(view.decision).toMatchObject({
      status: 'REFERENCE_RECORDED',
      reference: 'synthetic-external-reference',
    })
    expect(view.technical.state).toBe('MATCHED')
    expect(view.decision).not.toHaveProperty('outcome')
    expect(view.decision.owner).not.toBe('cora')
  })
  it('does not leak a successor reference whose viewing grant is absent', async () => {
    const f = createSyntheticOperatorRuntime()
    const request = f.requestFor(0)
    const a = await f.service.request(request)
    const original = f.definitions.get(`${request.requirement.id}@${request.requirement.version}`)!
    const next = structuredClone(original)
    next.use.requirement.requirementVersion = '2'
    f.definitions.set(`${request.requirement.id}@2`, next)
    const b = await f.service.request({
      ...request,
      requirement: { ...request.requirement, version: '2' },
    })
    f.ports.authorizeOperatorView = async (_context, run) => ({
      allowed: run.runId !== b.runId,
      authorizationRef: 'synthetic-history-grant',
      historical: true,
    })
    const view = await f.service.inspectOperator(a.runId)
    if (view.access !== 'ALLOWED') throw new Error('Expected original view')
    expect(view.successorRunIds).toEqual([])
  })
  it('propagates unexpected failures rather than showing a success-shaped or silently denied view', async () => {
    const f = createSyntheticOperatorRuntime()
    const run = await f.service.request(f.requestFor(0))
    const service = createInstitutionalWorkflowService({
      ...f.ports,
      authorizeOperatorView: async () => {
        throw new Error('View authorization service unavailable')
      },
    })
    await expect(service.inspectOperator(run.runId)).rejects.toThrow('unavailable')
    const denied = createInstitutionalWorkflowService({
      ...f.ports,
      authorizeOperatorView: async () => {
        throw new WorkflowDenied('Explicit deny')
      },
    })
    expect((await denied.inspectOperator(run.runId)).access).toBe('DENIED')
  })
})
