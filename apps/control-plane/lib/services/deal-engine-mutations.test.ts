import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  deal: vi.fn(),
  pilot: vi.fn(),
  followUp: vi.fn(),
  ingestion: vi.fn(),
  transition: vi.fn(),
  checklist: vi.fn(),
  status: vi.fn(),
  complete: vi.fn(),
  snooze: vi.fn(),
  reassign: vi.fn(),
  retry: vi.fn(),
  emit: vi.fn(),
  audit: vi.fn(),
  log: vi.fn(),
  order: [] as string[],
}))
vi.mock('@/db/adapters', () => ({
  getDealAdapter: m.deal,
  getPilotAdapter: m.pilot,
  getFollowUpAdapter: m.followUp,
  getIngestionAdapter: m.ingestion,
}))
vi.mock('./deal-engine-events', () => ({
  emitDealEvent: m.emit,
  DEAL_ENGINE_EVENTS: {
    DEAL_STAGE_CHANGED: 'stage',
    PILOT_CHECKLIST_UPDATED: 'checklist',
    PILOT_STARTED: 'pilot',
    FOLLOWUP_COMPLETED: 'completed',
    INGESTION_STARTED: 'ingestion',
  },
}))
vi.mock('./deal-engine-audit', () => ({ recordDealAudit: m.audit }))
vi.mock('@/lib/telemetry', () => ({ logger: { error: m.log } }))

beforeEach(() => {
  vi.resetAllMocks()
  m.order = []
  m.deal.mockReturnValue({ transitionStage: m.transition })
  m.pilot.mockReturnValue({ updateChecklist: m.checklist, updateStatus: m.status })
  m.followUp.mockReturnValue({ complete: m.complete, snooze: m.snooze, reassign: m.reassign })
  m.ingestion.mockReturnValue({ retry: m.retry })
  m.emit.mockImplementation(async () => {
    m.order.push('event')
  })
  m.audit.mockImplementation(() => {
    m.order.push('audit')
  })
})
describe('deal mutation services retain adapter/event/audit boundaries', () => {
  it('retains transition, event and audit order with exact actor and previous-stage metadata', async () => {
    m.transition.mockImplementation(async () => {
      m.order.push('transition')
      return { id: 'deal', stage: 'pilot_active' }
    })
    const { transitionPipeline } = await import('./deal-engine-mutations')
    const response = await transitionPipeline(
      { dealId: 'deal', toStage: 'pilot_active', actor: 'operator', reason: 'recorded reason' },
      { fromStage: 'demo_completed' },
    )
    expect(response.status).toBe(200)
    expect(m.order).toEqual(['transition', 'event', 'audit'])
    expect(m.transition).toHaveBeenCalledWith('deal', 'pilot_active', 'operator', 'recorded reason')
    expect(m.emit).toHaveBeenCalledWith(
      'stage',
      expect.objectContaining({ fromStage: 'demo_completed', toStage: 'pilot_active' }),
      { actorId: 'operator', tenantId: 'system' },
    )
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'operator',
        orgId: 'system',
        details: expect.objectContaining({ before: { stage: 'demo_completed' } }),
      }),
    )
  })
  it('retains unsupported and denied transition statuses without emitting events', async () => {
    const { transitionPipeline } = await import('./deal-engine-mutations')
    const input = { dealId: 'deal', toStage: 'pilot_active' as const, actor: 'operator' }
    m.deal.mockReturnValueOnce({})
    expect((await transitionPipeline(input)).status).toBe(501)
    m.transition.mockResolvedValueOnce(null)
    expect((await transitionPipeline(input)).status).toBe(404)
    expect(m.emit).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })
  it('preserves the existing best-effort event failure contract without re-running a mutation', async () => {
    m.transition.mockResolvedValue({ id: 'deal', stage: 'pilot_active' })
    m.emit.mockRejectedValueOnce(new Error('transport unavailable'))
    const { transitionPipeline } = await import('./deal-engine-mutations')
    expect(
      (await transitionPipeline({ dealId: 'deal', toStage: 'pilot_active', actor: 'operator' }))
        .status,
    ).toBe(200)
    expect(m.transition).toHaveBeenCalledTimes(1)
    expect(m.audit).not.toHaveBeenCalled()
    expect(m.log).toHaveBeenCalledTimes(1)
  })
  it('retains pilot checklist and status metadata without changing event names', async () => {
    m.checklist.mockResolvedValue({ id: 'pilot' })
    m.status.mockResolvedValue({ id: 'pilot' })
    const { mutatePilot } = await import('./deal-engine-mutations')
    expect(
      (
        await mutatePilot({
          action: 'update_checklist',
          pilotId: 'pilot',
          actor: 'operator',
          checklistKey: 'dataReceived',
          checklistValue: true,
        })
      ).status,
    ).toBe(200)
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          before: { dataReceived: false },
          after: { dataReceived: true },
        }),
      }),
    )
    expect(
      (
        await mutatePilot(
          { action: 'update_status', pilotId: 'pilot', actor: 'operator', status: 'active' },
          { previousStatus: 'planned' },
        )
      ).status,
    ).toBe(200)
    expect(m.emit.mock.calls.map((call) => call[0])).toEqual(['checklist', 'pilot'])
  })
  it('retains follow-up completion, snooze and reassignment arguments', async () => {
    m.complete.mockResolvedValue({ id: 'follow', title: 'Task', completedAt: 'now' })
    m.snooze.mockResolvedValue({ id: 'follow' })
    m.reassign.mockResolvedValue({ id: 'follow' })
    const { mutateFollowUp } = await import('./deal-engine-mutations')
    expect(
      (await mutateFollowUp({ action: 'complete', followUpId: 'follow', actor: 'operator' }))
        .status,
    ).toBe(200)
    expect(
      (
        await mutateFollowUp(
          {
            action: 'snooze',
            followUpId: 'follow',
            actor: 'operator',
            newDueDate: '2026-12-01T00:00:00Z',
          },
          { previousDueDate: 'old date' },
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await mutateFollowUp(
          { action: 'reassign', followUpId: 'follow', actor: 'operator', newOwner: 'next' },
          { previousOwner: 'old' },
        )
      ).status,
    ).toBe(200)
    expect(m.snooze).toHaveBeenCalledWith('follow', '2026-12-01T00:00:00Z', 'operator')
    expect(m.reassign).toHaveBeenCalledWith('follow', 'next', 'operator')
    expect(m.emit).toHaveBeenCalledTimes(1)
  })
  it('propagates the absent UE ingestion store and never starts a retry/event on another connection', async () => {
    m.retry.mockRejectedValueOnce(new Error('relation ingestion_batches does not exist'))
    const { retryIngestion } = await import('./deal-engine-mutations')
    await expect(retryIngestion({ runId: 'run', actor: 'operator' })).rejects.toThrow(
      'ingestion_batches',
    )
    expect(m.emit).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })
})
