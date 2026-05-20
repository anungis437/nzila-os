import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => {
  const insertReturning = vi.fn()
  const insertValues = vi.fn(() => ({ returning: insertReturning }))
  const insertFn = vi.fn(() => ({ values: insertValues }))

  const selectChain: {
    rows: unknown[]
    select: () => typeof selectChain
    from: () => typeof selectChain
    where: () => typeof selectChain
    orderBy: () => typeof selectChain
    limit: () => Promise<unknown[]>
    then: (resolve: (rows: unknown[]) => void) => void
  } = {
    rows: [],
    select() { return this },
    from() { return this },
    where() { return this },
    orderBy() { return this },
    limit() { return Promise.resolve(this.rows) },
    then(resolve) { resolve(this.rows) },
  }

  const platformDb = {
    insert: insertFn,
    select: vi.fn(() => selectChain),
  }

  const recordAuditEvent = vi.fn(async () => undefined)

  return { platformDb, insertFn, insertValues, insertReturning, selectChain, recordAuditEvent }
})

vi.mock('@nzila/db/platform', () => ({ platformDb: mocks.platformDb }))
vi.mock('@/lib/audit-db', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
  AUDIT_ACTIONS: { WORKFLOW_TRIGGERED: 'workflow.triggered' },
}))

import {
  __internal,
  recordDecisionEvent,
  type RecordDecisionInput,
} from './decision'

const ORG = '00000000-0000-0000-0000-000000000001'

function baseInput(overrides: Partial<RecordDecisionInput> = {}): RecordDecisionInput {
  return {
    type: 'workflow.authorized',
    orgId: ORG,
    domain: 'commerce',
    actorId: 'user_1',
    actorRole: 'admin',
    action: 'workflow.trigger',
    resource: 'workflow',
    resourceId: 'commerce.invoice.send',
    outcome: 'allowed',
    reasonCode: 'POLICY_PERMITTED',
    reason: 'ok',
    policyId: 'commerce.invoice.send',
    policyVersion: '1.0.0',
    workflowId: 'commerce.invoice.send',
    correlationId: 'corr-1',
    requestId: '11111111-1111-1111-1111-111111111111',
    evaluatedContext: { foo: 'bar' },
    ...overrides,
  }
}

function fakeRow(input: RecordDecisionInput, requestHash: string) {
  return {
    id: 'row-1',
    orgId: input.orgId,
    domain: input.domain,
    workflowId: input.workflowId ?? null,
    caseId: input.caseId ?? null,
    actorUserId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    resourceType: input.resource,
    resourceId: input.resourceId ?? null,
    decision: __internal.mapOutcome(input.outcome),
    reasonCode: input.reasonCode,
    explanation: input.reason ?? null,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    evaluatedContext: { foo: 'bar' },
    requestHash,
    correlationId: input.correlationId ?? null,
    traceId: input.traceId ?? null,
    eventType: input.type,
    createdAt: new Date('2026-05-20T00:00:00Z'),
  }
}

describe('decision recorder', () => {
  beforeEach(() => {
    mocks.insertFn.mockClear()
    mocks.insertValues.mockClear()
    mocks.insertReturning.mockReset()
    mocks.recordAuditEvent.mockClear()
    mocks.selectChain.rows = []
  })

  describe('redact', () => {
    it('redacts sensitive keys recursively', () => {
      const out = __internal.redact({
        user: 'a',
        password: 'p',
        nested: { apiKey: 'x', safe: 1, list: [{ token: 't' }] },
      })
      expect(out).toEqual({
        user: 'a',
        password: '[REDACTED]',
        nested: { apiKey: '[REDACTED]', safe: 1, list: [{ token: '[REDACTED]' }] },
      })
    })
  })

  describe('canonicalize + computeRequestHash', () => {
    it('produces a deterministic hash regardless of key order', () => {
      const a = __internal.computeRequestHash(baseInput({ evaluatedContext: { a: 1, b: 2 } }), { a: 1, b: 2 })
      const b = __internal.computeRequestHash(baseInput({ evaluatedContext: { b: 2, a: 1 } }), { b: 2, a: 1 })
      expect(a).toBe(b)
      expect(a).toHaveLength(64)
    })

    it('changes hash when material fields differ', () => {
      const h1 = __internal.computeRequestHash(baseInput(), { foo: 'bar' })
      const h2 = __internal.computeRequestHash(baseInput({ reasonCode: 'OTHER' }), { foo: 'bar' })
      expect(h1).not.toBe(h2)
    })
  })

  describe('mapOutcome', () => {
    it('maps legacy outcomes to canonical decisions', () => {
      expect(__internal.mapOutcome('allowed')).toBe('allowed')
      expect(__internal.mapOutcome('executed')).toBe('allowed')
      expect(__internal.mapOutcome('recorded')).toBe('allowed')
      expect(__internal.mapOutcome('denied')).toBe('denied')
      expect(__internal.mapOutcome('approved_required')).toBe('approval_required')
    })
  })

  describe('recordDecisionEvent', () => {
    it('inserts a decision row with canonical fields and returns a DecisionRecord', async () => {
      const input = baseInput()
      const hash = __internal.computeRequestHash(input, { foo: 'bar' })
      mocks.insertReturning.mockResolvedValueOnce([fakeRow(input, hash)])

      const rec = await recordDecisionEvent(input)

      expect(mocks.insertFn).toHaveBeenCalledTimes(1)
      const values = (mocks.insertValues.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]![0]
      expect(values.orgId).toBe(input.orgId)
      expect(values.domain).toBe('commerce')
      expect(values.decision).toBe('allowed')
      expect(values.reasonCode).toBe('POLICY_PERMITTED')
      expect(values.policyId).toBe('commerce.invoice.send')
      expect(values.policyVersion).toBe('1.0.0')
      expect(values.eventType).toBe('workflow.authorized')
      expect(values.requestHash).toBe(hash)

      expect(rec.outcome).toBe('allowed')
      expect(rec.policyId).toBe('commerce.invoice.send')
      expect(rec.requestHash).toBe(hash)
      expect(rec.requestId).toBe(input.requestId)
    })

    it('redacts sensitive fields in evaluated_context before persist', async () => {
      const input = baseInput({ evaluatedContext: { ok: 1, password: 'secret', token: 'tok' } })
      const hash = __internal.computeRequestHash(input, { ok: 1, password: '[REDACTED]', token: '[REDACTED]' })
      mocks.insertReturning.mockResolvedValueOnce([fakeRow(input, hash)])

      await recordDecisionEvent(input)

      const values = (mocks.insertValues.mock.calls as unknown as Array<[{ evaluatedContext: Record<string, unknown> }]>)[0]![0]
      expect(values.evaluatedContext.password).toBe('[REDACTED]')
      expect(values.evaluatedContext.token).toBe('[REDACTED]')
      expect(values.evaluatedContext.ok).toBe(1)
    })

    it('fails closed when DB insert throws', async () => {
      const input = baseInput()
      mocks.insertReturning.mockRejectedValueOnce(new Error('connection refused'))
      await expect(recordDecisionEvent(input)).rejects.toThrow('connection refused')
    })

    it('does not swallow errors from audit mirror but still returns the persisted record', async () => {
      const input = baseInput()
      const hash = __internal.computeRequestHash(input, { foo: 'bar' })
      mocks.insertReturning.mockResolvedValueOnce([fakeRow(input, hash)])
      mocks.recordAuditEvent.mockRejectedValueOnce(new Error('audit down'))

      const rec = await recordDecisionEvent(input)
      expect(rec.id).toBe('row-1')
    })

    it('maps denied outcome to canonical `denied`', async () => {
      const input = baseInput({ outcome: 'denied', reasonCode: 'ROLE_NOT_PERMITTED' })
      const hash = __internal.computeRequestHash(input, { foo: 'bar' })
      mocks.insertReturning.mockResolvedValueOnce([fakeRow(input, hash)])
      const rec = await recordDecisionEvent(input)
      expect(rec.outcome).toBe('denied')
    })
  })
})
