import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// DEF-0B5-PAY-EQUITY-NO-STATE-MACHINE-OR-DEADLINES: the status of a pay equity exercise moves one audited step at a time through an explicit
// graph, each step records its own facts, the generic routes write neither the status nor those facts, and the statutory periods the schema
// comments state are unconfirmed rules that never write a date by themselves.
const m = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  handler: null as null | ((ctx: Record<string, unknown>) => Promise<unknown>),
  current: [] as Array<Record<string, unknown>>,
  updated: [] as Array<Record<string, unknown>>,
  sets: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
  locked: 0,
}))

vi.mock('@/lib/api/with-api', () => ({
  withApi: (config: Record<string, unknown>, handler: (ctx: Record<string, unknown>) => Promise<unknown>) => {
    m.config = config
    m.handler = handler
    return handler
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, work: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => { m.locked += 1; return m.current } }) }) }) }),
      update: () => ({ set: (values: Record<string, unknown>) => { m.sets.push(values); return { where: () => ({ returning: async () => m.updated }) } } }),
    }
    return work(tx)
  },
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: async (_tx: unknown, entry: Record<string, unknown>) => { m.audits.push(entry) } }))

const crud = vi.hoisted(() => ({ opts: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: (opts: Record<string, unknown>) => {
    crud.opts.push(opts)
    return opts.itemRoute ? { GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() } : { GET: vi.fn(), POST: vi.fn() }
  },
}))

import {
  PAY_EQUITY_DEADLINE_RULES,
  PAY_EQUITY_TRANSITIONS,
  addPeriod,
  planTransition,
  type CurrentExercise,
  type PayEquityStatus,
} from '@/lib/pay-equity/pay-equity-lifecycle'
import { payEquityStatusEnum } from '@/db/schema'
import { ApiError, ErrorCode } from '@/lib/api/errors'

const ORG = '11111111-1111-4111-8111-111111111111'
const ID = '22222222-2222-4222-8222-222222222222'
const at = (status: PayEquityStatus, extra: Partial<CurrentExercise> = {}): CurrentExercise => ({
  status, resultsPostedDate: null, contestDeadline: null, adjustmentsPaidDate: null, maintenanceEvaluationDate: null, ...extra,
})
describe('the pay equity lifecycle graph', () => {
  it('names every status, and no status leads to itself', () => {
    expect(Object.keys(PAY_EQUITY_TRANSITIONS).sort()).toEqual([...payEquityStatusEnum.enumValues].sort())
    for (const [from, targets] of Object.entries(PAY_EQUITY_TRANSITIONS)) expect(targets, from).not.toContain(from)
  })

  it('refuses a jump over the intermediate steps, such as recording adjustments_paid on a new exercise', () => {
    for (const to of ['adjustments_paid', 'results_posted', 'adjustments_calculated', 'maintenance_completed'] as const) {
      const plan = planTransition(at('not_started'), to, { adjustmentsPaidDate: '2026-05-01', resultsPostedDate: '2026-04-01', contestDeadline: '2026-06-01', totalAdjustmentAmount: '10', maintenanceEvaluationDate: '2026-01-01' })
      expect(plan, to).toMatchObject({ ok: false, status: 409 })
    }
    expect(planTransition(at('adjustments_calculated'), 'adjustments_paid', { adjustmentsPaidDate: '2026-05-01' })).toMatchObject({ ok: false, status: 409 })
  })

  it('makes each step record its own facts', () => {
    expect(planTransition(at('not_started'), 'committee_formed', {})).toMatchObject({ ok: false, status: 400 })
    expect(planTransition(at('not_started'), 'committee_formed', { committeeFormationDate: '2026-01-10' })).toEqual({
      ok: true, set: { committeeFormed: true, committeeFormationDate: '2026-01-10' }, deadlines: [],
    })
    expect(planTransition(at('evaluation_in_progress'), 'adjustments_calculated', {})).toMatchObject({ ok: false, status: 400 })
    expect(planTransition(at('adjustments_calculated'), 'results_posted', { resultsPostedDate: '2026-03-01' })).toMatchObject({ ok: false, status: 400 })
    expect(planTransition(at('results_posted', { resultsPostedDate: '2026-03-01' }), 'adjustments_paid', { adjustmentsPaidDate: '2026-02-01' })).toMatchObject({ ok: false, status: 400 })
  })

  it('records the deadline the officer states, and shows the unconfirmed rule beside it without applying it', () => {
    const plan = planTransition(at('adjustments_calculated'), 'results_posted', { resultsPostedDate: '2026-03-01', contestDeadline: '2026-05-15' })
    expect(plan).toEqual({
      ok: true,
      set: { resultsPostedDate: '2026-03-01', contestDeadline: '2026-05-15' },
      deadlines: [{ ruleId: 'QC-PAY-EQUITY-CONTEST-PERIOD', ruleVersion: '0-unconfirmed', confirmation: 'UNCONFIRMED', proposedDate: '2026-04-30', recordedDate: '2026-05-15' }],
    })
    expect(planTransition(at('adjustments_calculated'), 'results_posted', { resultsPostedDate: '2026-03-01', contestDeadline: '2026-03-01' })).toMatchObject({ ok: false, status: 400 })
  })

  it('enforces the contest deadline the exercise records', () => {
    const posted = at('results_posted', { resultsPostedDate: '2026-03-01', contestDeadline: '2026-04-30' })
    expect(planTransition(posted, 'contested', { contestedOn: '2026-04-30' })).toMatchObject({ ok: true })
    expect(planTransition(posted, 'contested', { contestedOn: '2026-05-01' })).toMatchObject({ ok: false, status: 409 })
    expect(planTransition(posted, 'contested', { contestedOn: '2026-02-28' })).toMatchObject({ ok: false, status: 400 })
    expect(planTransition(at('results_posted'), 'contested', { contestedOn: '2026-03-02' })).toMatchObject({ ok: false, status: 409 })
  })

  it('keeps every statutory period unconfirmed, with where it is stated and what confirming it needs', () => {
    for (const rule of Object.values(PAY_EQUITY_DEADLINE_RULES)) {
      expect(rule.confirmation, rule.id).toBe('UNCONFIRMED')
      expect(rule.statedIn).toContain('cnesst-schema.ts')
      expect(rule.confirmationNeeded.length).toBeGreaterThan(40)
    }
    expect(addPeriod('2026-03-01', { days: 60 })).toBe('2026-04-30')
    expect(addPeriod('2024-02-29', { years: 5 })).toBe('2029-03-01')
    const maintenance = planTransition(at('adjustments_paid', { resultsPostedDate: '2026-03-01' }), 'maintenance_due', { nextMaintenanceDue: '2031-01-01' })
    expect(maintenance).toMatchObject({ ok: true, set: { nextMaintenanceDue: '2031-01-01' }, deadlines: [{ ruleId: 'QC-PAY-EQUITY-MAINTENANCE-INTERVAL', confirmation: 'UNCONFIRMED', proposedDate: '2031-03-01', recordedDate: '2031-01-01' }] })
  })
})

describe('POST /api/cnesst/pay-equity/:id/transition', () => {
  beforeEach(async () => {
    m.current = []
    m.updated = []
    m.sets = []
    m.audits = []
    m.locked = 0
    await import('@/app/api/cnesst/pay-equity/[id]/transition/route')
  })
  const call = (body: Record<string, unknown>, id = ID) => m.handler!({ body, params: { id }, organizationId: ORG, userId: 'officer-1' })
  const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as InstanceType<typeof ApiError>)

  it('is an officer route with a strict body: the status is only a target, and no other column is accepted', () => {
    expect((m.config!.auth as { minRole: string }).minRole).toBe('officer')
    const schema = m.config!.body as { safeParse: (value: unknown) => { success: boolean } }
    expect(schema.safeParse({ to: 'committee_formed', committeeFormationDate: '2026-01-10' }).success).toBe(true)
    for (const body of [{ to: 'paid' }, { to: 'committee_formed', status: 'adjustments_paid' }, { to: 'results_posted', organizationId: ORG }, { to: 'committee_formed', committeeFormationDate: '2026-02-31' }, { to: 'adjustments_calculated', totalAdjustmentAmount: '-5' }]) {
      expect(schema.safeParse(body).success, JSON.stringify(body)).toBe(false)
    }
  })

  it('locks the row, writes the step under a status predicate, and audits it with the facts and the rule proposals', async () => {
    m.current = [{ id: ID, organizationId: ORG, status: 'adjustments_calculated', resultsPostedDate: null, contestDeadline: null, adjustmentsPaidDate: null, maintenanceEvaluationDate: null }]
    m.updated = [{ id: ID, status: 'results_posted' }]
    const result = await call({ to: 'results_posted', resultsPostedDate: '2026-03-01', contestDeadline: '2026-04-30' }) as { deadlines: unknown[] }
    expect(m.locked).toBe(1)
    expect(m.sets[0]).toMatchObject({ status: 'results_posted', resultsPostedDate: '2026-03-01', contestDeadline: '2026-04-30' })
    expect(m.audits).toEqual([expect.objectContaining({
      organizationId: ORG, userId: 'officer-1', action: 'pay_equity.transition', resourceType: 'pay_equity_exercises', resourceId: ID,
      details: expect.objectContaining({ from: 'adjustments_calculated', to: 'results_posted', fields: ['resultsPostedDate', 'contestDeadline'] }),
    })])
    expect(result.deadlines).toHaveLength(1)
  })

  it('refuses a step the graph does not allow, writes nothing and audits nothing', async () => {
    m.current = [{ id: ID, organizationId: ORG, status: 'not_started' }]
    const error = await rejection(call({ to: 'adjustments_paid', adjustmentsPaidDate: '2026-05-01' }))
    expect(error?.code).toBe(ErrorCode.CONFLICT)
    expect(m.sets).toEqual([])
    expect(m.audits).toEqual([])
  })

  it('answers a missing or another organization\'s exercise as not found, and a status changed underneath as a conflict', async () => {
    expect((await rejection(call({ to: 'committee_formed', committeeFormationDate: '2026-01-10' })))?.code).toBe(ErrorCode.NOT_FOUND)
    expect((await rejection(call({ to: 'committee_formed', committeeFormationDate: '2026-01-10' }, 'not-a-uuid')))?.code).toBe(ErrorCode.VALIDATION_ERROR)
    m.current = [{ id: ID, organizationId: ORG, status: 'not_started' }]
    m.updated = []
    expect((await rejection(call({ to: 'committee_formed', committeeFormationDate: '2026-01-10' })))?.code).toBe(ErrorCode.CONFLICT)
    expect(m.audits).toEqual([])
  })
})

describe('the generic pay equity routes write neither the status nor a step\'s facts', () => {
  it('leaves status, dates, amounts and the declaration to the lifecycle', async () => {
    crud.opts = []
    await import('@/app/api/cnesst/pay-equity/route')
    await import('@/app/api/cnesst/pay-equity/[id]/route')
    expect(crud.opts).toHaveLength(2)
    for (const opts of crud.opts) {
      const writable = opts.writableFields as string[]
      for (const field of ['status', 'committeeFormed', 'committeeFormationDate', 'totalAdjustmentAmount', 'resultsPostedDate', 'contestDeadline', 'adjustmentsPaidDate', 'maintenanceEvaluationDate', 'nextMaintenanceDue', 'cneesstDeclarationFiled', 'cneesstDeclarationDate']) {
        expect(writable).not.toContain(field)
      }
    }
    expect(readFileSync(join(process.cwd(), 'app/api/cnesst/pay-equity/[id]/transition/route.ts'), 'utf8')).toContain('eq(payEquityExercises.status, from)')
  })
})
