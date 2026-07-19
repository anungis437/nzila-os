import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select', 'from', 'where', 'limit', 'orderBy', 'groupBy',
      'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete',
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const item = queue.length ? queue.shift() : [];
      if (item instanceof Error) return Promise.reject(item).catch(reject);
      return Promise.resolve(item).then(resolve);
    };
    return chain;
  };
  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  return {
    queue,
    db,
    initiateBreakGlass: vi.fn(),
    terminateBreakGlass: vi.fn(),
  };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('../break-glass-service', () => ({
  breakGlassService: {
    initiateBreakGlass: h.initiateBreakGlass,
    terminateBreakGlass: h.terminateBreakGlass,
  },
}));
vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/force-majeure-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { ForceMajeureIntegrationService, forceMajeureIntegrationService } from '../force-majeure-integration';

const hoursAgo = (h2: number) => new Date(Date.now() - h2 * 60 * 60 * 1000);

let svc: ForceMajeureIntegrationService;

beforeEach(() => {
  h.queue.length = 0;
  h.initiateBreakGlass.mockReset();
  h.terminateBreakGlass.mockReset();
  h.initiateBreakGlass.mockResolvedValue({ sessionId: 'bg-session-1' });
  h.terminateBreakGlass.mockResolvedValue(undefined);
  svc = new ForceMajeureIntegrationService();
});

describe('force-majeure-integration', () => {
  describe('activateForceMajeure', () => {
    it('activates with break-glass for a critical event', async () => {
      pushSel([{ id: 'ev-1' }], [{ id: 'act-1' }]);
      const r = await svc.activateForceMajeure({
        eventType: 'cyberattack',
        severity: 'critical',
        description: 'breach',
        impactedSystems: ['member-profiles', 'billing'],
        activatedBy: 'admin',
        requiresBreakGlass: true,
      });
      expect(r.eventId).toBe('ev-1');
      expect(r.activationId).toBe('act-1');
      expect(r.breakGlassSessionId).toBe('bg-session-1');
      expect(r.status).toBe('active');
      expect(r.actions.some(a => a.includes('Break-glass'))).toBe(true);
      expect(r.actions.some(a => a.includes('Provincial privacy'))).toBe(true);
    });

    it('activates without break-glass for a non-critical event', async () => {
      pushSel([{ id: 'ev-2' }], [{ id: 'act-2' }]);
      const r = await svc.activateForceMajeure({
        eventType: 'infrastructure_failure',
        severity: 'low',
        description: 'outage',
        impactedSystems: ['api'],
        activatedBy: 'ops',
      });
      expect(r.breakGlassSessionId).toBeUndefined();
      expect(r.status).toBe('monitoring');
      expect(h.initiateBreakGlass).not.toHaveBeenCalled();
    });
  });

  describe('deactivateForceMajeure', () => {
    it('closes break-glass sessions and generates a report (within SLA, with lessons)', async () => {
      const event = { id: 'ev-1', eventType: 'cyberattack', severity: 'critical', description: 'd', startTime: hoursAgo(10), impactedSystems: ['member-profiles'] };
      pushSel([event], [{ breakGlassSessionId: 'bg-1' }, { breakGlassSessionId: null }], []);
      const r = await svc.deactivateForceMajeure({ eventId: 'ev-1', deactivatedBy: 'admin', resolution: 'fixed', lessonsLearned: 'do better' });
      expect(r.success).toBe(true);
      expect(r.breakGlassSessionsClosed).toBe(1);
      expect(r.report).toContain('Lessons Learned');
      expect(r.report).toContain('Achieved');
    });

    it('handles break-glass termination failure (extended duration, no lessons)', async () => {
      const event = { id: 'ev-2', eventType: 'pandemic', severity: 'high', description: 'd', startTime: hoursAgo(100), impactedSystems: ['api'] };
      h.terminateBreakGlass.mockRejectedValueOnce(new Error('cannot close'));
      pushSel([event], [{ breakGlassSessionId: 'bg-2' }], []);
      const r = await svc.deactivateForceMajeure({ eventId: 'ev-2', deactivatedBy: 'admin', resolution: 'resolved' });
      expect(r.breakGlassSessionsClosed).toBe(0);
      expect(r.report).toContain('Extended');
      expect(r.report).not.toContain('Lessons Learned');
    });

    it('throws when the event is not found', async () => {
      pushSel([]);
      await expect(svc.deactivateForceMajeure({ eventId: 'missing', deactivatedBy: 'a', resolution: 'r' })).rejects.toThrow('not found');
    });
  });

  describe('check48HourRecoveryStatus', () => {
    it('reports early-phase progress (<24h)', async () => {
      pushSel([{ id: 'ev-1', eventType: 'cyberattack', severity: 'high', startTime: hoursAgo(0), status: 'active' }]);
      const r = await svc.check48HourRecoveryStatus('ev-1');
      expect(r.hoursElapsed).toBe(0);
      expect(r.onTrack).toBe(true);
      expect(r.actions.some(a => a.includes('Continue monitoring'))).toBe(true);
      expect(r.recoveryMilestones.some(m => m.status === 'in-progress')).toBe(true);
      expect(r.recoveryMilestones.some(m => m.status === 'pending')).toBe(true);
    });

    it('reports mid-phase progress (24-48h)', async () => {
      pushSel([{ id: 'ev-2', eventType: 'pandemic', severity: 'medium', startTime: hoursAgo(30), status: 'active' }]);
      const r = await svc.check48HourRecoveryStatus('ev-2');
      expect(r.actions.some(a => a.includes('Verify full service'))).toBe(true);
      expect(r.recoveryMilestones.some(m => m.status === 'completed')).toBe(true);
    });

    it('reports overdue recovery (>48h)', async () => {
      pushSel([{ id: 'ev-3', eventType: 'cyberattack', severity: 'critical', startTime: hoursAgo(50), status: 'extended' }]);
      const r = await svc.check48HourRecoveryStatus('ev-3');
      expect(r.onTrack).toBe(false);
      expect(r.hoursRemaining).toBe(0);
      expect(r.actions.some(a => a.includes('Complete post-incident'))).toBe(true);
    });

    it('throws when the event is not found', async () => {
      pushSel([]);
      await expect(svc.check48HourRecoveryStatus('missing')).rejects.toThrow('not found');
    });
  });

  describe('assessPIPEDABreach', () => {
    it('flags a notifiable breach for cyberattacks', async () => {
      pushSel([{ id: 'ev-1', eventType: 'cyberattack', startTime: hoursAgo(1), impactedSystems: ['billing'] }]);
      const r = await svc.assessPIPEDABreach('ev-1');
      expect(r.breachLikely).toBe(true);
      expect(r.notificationRequired).toBe(true);
      expect(r.deadline).toBeInstanceOf(Date);
      expect(r.recommendedActions.some(a => a.includes('Privacy Commissioner'))).toBe(true);
    });

    it('does not require notification for infrastructure failures', async () => {
      pushSel([{ id: 'ev-2', eventType: 'infrastructure_failure', startTime: hoursAgo(1), impactedSystems: ['api'] }]);
      const r = await svc.assessPIPEDABreach('ev-2');
      expect(r.notificationRequired).toBe(false);
      expect(r.deadline).toBeUndefined();
      expect(r.recommendedActions.some(a => a.includes('Continue monitoring'))).toBe(true);
    });

    it('escalates natural disasters that touch personal data', async () => {
      pushSel([{ id: 'ev-3', eventType: 'natural_disaster', startTime: hoursAgo(1), impactedSystems: ['member-profiles'] }]);
      const r = await svc.assessPIPEDABreach('ev-3');
      expect(r.breachLikely).toBe(true);
      expect(r.notificationRequired).toBe(true);
    });

    it('throws when the event is not found', async () => {
      pushSel([]);
      await expect(svc.assessPIPEDABreach('missing')).rejects.toThrow('not found');
    });
  });

  describe('getActiveEvents', () => {
    it('lists active events with break-glass status', async () => {
      pushSel(
        [
          { id: 'e1', eventType: 'cyberattack', severity: 'high', description: 'd1', startTime: hoursAgo(5), status: 'active' },
          { id: 'e2', eventType: 'pandemic', severity: 'low', description: 'd2', startTime: hoursAgo(2), status: 'active' },
        ],
        [{ breakGlassSessionId: 'bg-1' }],
        [],
      );
      const r = await svc.getActiveEvents();
      expect(r).toHaveLength(2);
      expect(r[0].breakGlassActive).toBe(true);
      expect(r[1].breakGlassActive).toBe(false);
    });
  });

  describe('getForceMajeureDashboard', () => {
    it('summarizes events and compliance', async () => {
      pushSel(
        [
          { id: 'a', status: 'active', eventType: 'cyberattack', severity: 'high', actualDuration: null },
          { id: 'b', status: 'resolved', eventType: 'pandemic', severity: 'low', actualDuration: 24 },
          { id: 'c', status: 'resolved', eventType: 'natural_disaster', severity: 'medium', actualDuration: 60 },
        ],
        [{}, {}],
      );
      const r = await svc.getForceMajeureDashboard();
      expect(r.activeEvents).toBe(1);
      expect(r.totalEvents).toBe(3);
      expect(r.averageRecoveryTime).toBe(42);
      expect(r.breakGlassUsage).toBe(2);
      expect(r.complianceRate).toBe(50);
      expect(r.recentEvents).toHaveLength(3);
    });

    it('returns defaults when there are no events', async () => {
      pushSel([], []);
      const r = await svc.getForceMajeureDashboard();
      expect(r.averageRecoveryTime).toBe(0);
      expect(r.complianceRate).toBe(100);
      expect(r.recentEvents).toHaveLength(0);
    });
  });

  it('exports a singleton instance', () => {
    expect(forceMajeureIntegrationService).toBeInstanceOf(ForceMajeureIntegrationService);
  });
});
