import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  eventEmit: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  trackPilotEvent: vi.fn(),
  getSLADeadlineHours: vi.fn(),
  toLifecycleState: vi.fn(),
  recordUnionEyesSlaCompliance: vi.fn(),
  recordUnionEyesSlaWatchdog: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: m.dbSelect,
  },
}));

vi.mock('@/lib/events/event-bus', () => ({
  eventBus: {
    emit: m.eventEmit,
  },
}));

vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/lib/workflow/case-lifecycle', () => ({ getSLADeadlineHours: m.getSLADeadlineHours }));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: m.toLifecycleState }));
vi.mock('@/lib/pilot-metrics', () => ({
  recordUnionEyesSlaCompliance: m.recordUnionEyesSlaCompliance,
  recordUnionEyesSlaWatchdog: m.recordUnionEyesSlaWatchdog,
}));
vi.mock('@/lib/api/framework', () => ({
  withApi: vi.fn((_: unknown, handler: () => Promise<unknown>) => handler),
}));

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(async () => rows),
  };
  return chain;
}

async function loadRoute() {
  return import('../cron/sla-watchdog/route');
}

describe('cron/sla-watchdog route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.recordUnionEyesSlaCompliance.mockResolvedValue(undefined);
    m.recordUnionEyesSlaWatchdog.mockResolvedValue(undefined);
    m.toLifecycleState.mockReturnValue('submitted');
    m.getSLADeadlineHours.mockReturnValue(24);
  });

  it('returns empty counts when no active claims are found', async () => {
    m.dbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { POST } = await loadRoute();

    const result = await POST();

    expect(result).toMatchObject({ scanned: 0, at_risk: 0, breached: 0 });
    expect(m.eventEmit).not.toHaveBeenCalled();
  });

  it('emits at-risk events and pilot tracking when claim is near SLA breach', async () => {
    const now = new Date();
    const updatedAt = new Date(now.getTime() - 23 * 60 * 60 * 1000); // 1h remaining if SLA=24h
    m.dbSelect.mockReturnValueOnce(
      makeSelectChain([
        {
          claimId: 'claim_1',
          claimNumber: 'CLM-1',
          status: 'submitted',
          priority: 'high',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          updatedAt,
          createdAt: updatedAt,
        },
      ]),
    );

    const { POST } = await loadRoute();
    const result = await POST();

    expect(result).toMatchObject({ scanned: 1, at_risk: 1, breached: 0 });
    expect(m.eventEmit).toHaveBeenCalledTimes(2);
    expect(m.trackPilotEvent).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org_1',
      eventType: 'sla_breach_risk',
    }));
  });

  it('emits breached events and metrics when claim is overdue', async () => {
    const now = new Date();
    const updatedAt = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    m.dbSelect.mockReturnValueOnce(
      makeSelectChain([
        {
          claimId: 'claim_2',
          claimNumber: 'CLM-2',
          status: 'submitted',
          priority: 'medium',
          organizationId: 'org_2',
          assignedTo: 'user_2',
          updatedAt,
          createdAt: updatedAt,
        },
      ]),
    );

    const { POST } = await loadRoute();
    const result = await POST();

    expect(result).toMatchObject({ scanned: 1, at_risk: 0, breached: 1 });
    expect(m.eventEmit).toHaveBeenCalledWith(
      'claim_events',
      expect.objectContaining({ event_type: 'sla_breached' }),
      expect.objectContaining({ source: 'sla-watchdog' }),
    );
    expect(m.trackPilotEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'sla_breached' }));
    expect(m.recordUnionEyesSlaWatchdog).toHaveBeenCalled();
    expect(m.recordUnionEyesSlaCompliance).toHaveBeenCalled();
  });

  it('scans mixed at-risk and breached claims', async () => {
    const now = new Date();
    const atRiskTime = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    const breachedTime = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    m.dbSelect.mockReturnValueOnce(
      makeSelectChain([
        {
          claimId: 'claim_1',
          claimNumber: 'CLM-1',
          status: 'submitted',
          priority: 'high',
          organizationId: 'org_1',
          assignedTo: 'user_1',
          updatedAt: atRiskTime,
          createdAt: atRiskTime,
        },
        {
          claimId: 'claim_2',
          claimNumber: 'CLM-2',
          status: 'submitted',
          priority: 'medium',
          organizationId: 'org_1',
          assignedTo: 'user_2',
          updatedAt: breachedTime,
          createdAt: breachedTime,
        },
      ]),
    );

    const { POST } = await loadRoute();
    const result = await POST();

    expect(result).toMatchObject({ scanned: 2, at_risk: 1, breached: 1 });
    expect(m.eventEmit).toHaveBeenCalledTimes(3);
  });
});
