import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  return { queue, db };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/lmbp-immigration-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
}));

import { LMBPImmigrationService, lmbpImmigrationService } from '../lmbp-immigration-service';

const push = (...items: unknown[]) => h.queue.push(...items);
const svc = new LMBPImmigrationService();

beforeEach(() => {
  h.queue.length = 0;
  vi.clearAllMocks();
});

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe('registerForeignWorker', () => {
  it('registers a worker and schedules a work-permit expiry alert (under LMBP threshold)', async () => {
    push([{ id: 'w1' }]); // insert returning
    push([{ count: 5 }]); // checkLMBPRequirement count < 10
    push([]); // expiry alert insert
    const worker = await svc.registerForeignWorker({
      employerId: 'e1', firstName: 'Ana', lastName: 'Lee', workPermitExpiry: daysFromNow(200), startDate: new Date('2024-01-01'),
    } as never);
    expect(worker).toEqual({ id: 'w1' });
  });

  it('triggers an LMBP-required alert when the employer crosses the threshold', async () => {
    push([{ id: 'w2' }]); // insert returning
    push([{ count: 12 }]); // count >= 10
    push([]); // existingLetter lookup empty
    push([]); // LMBP-required alert insert
    push([]); // expiry alert insert
    const worker = await svc.registerForeignWorker({
      employerId: 'e1', firstName: 'Bob', lastName: 'Kim', workPermitExpiry: daysFromNow(200), startDate: new Date('2024-01-01'),
    } as never);
    expect(worker).toEqual({ id: 'w2' });
  });
});

describe('checkLMBPRequirement', () => {
  it('does nothing under the threshold', async () => {
    push([{ count: 3 }]);
    await expect(svc.checkLMBPRequirement('e1')).resolves.toBeUndefined();
  });

  it('skips the alert when an active letter already exists', async () => {
    push([{ count: 15 }]); // count
    push([{ id: 'l1' }]); // existing active letter
    await expect(svc.checkLMBPRequirement('e1')).resolves.toBeUndefined();
  });
});

describe('generateLMBPLetter', () => {
  it('creates a letter, links workers and schedules a compliance-report alert', async () => {
    push([{ id: 'l1' }]); // insert letter returning
    push([]); // update foreignWorkers
    push([]); // compliance report alert insert
    const letter = await svc.generateLMBPLetter({
      employerId: 'e1',
      employerName: 'Acme',
      commitments: [{ type: 'skills_transfer', description: 'd', kpi: 'k' }],
      foreignWorkerIds: ['w1', 'w2'],
    });
    expect(letter).toEqual({ id: 'l1' });
  });

  it('respects a custom validity period', async () => {
    push([{ id: 'l2' }]);
    push([]);
    push([]);
    const letter = await svc.generateLMBPLetter({
      employerId: 'e1', employerName: 'Acme', commitments: [], foreignWorkerIds: ['w1'], validityYears: 5,
    });
    expect(letter).toEqual({ id: 'l2' });
  });
});

describe('trackGSSApplication', () => {
  it('records the application and schedules a delay alert', async () => {
    push([{ id: 'g1' }]); // insert returning
    push([]); // alert insert
    const app = await svc.trackGSSApplication({
      applicationNumber: 'GSS-1', submissionDate: new Date('2024-03-01'), foreignWorkerId: 'w1', employerId: 'e1',
    } as never);
    expect(app).toEqual({ id: 'g1' });
  });
});

describe('updateGSSApplicationStatus', () => {
  it('records an approved decision and resolves the delay alert', async () => {
    const submission = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    push([{ id: 'g1', submissionDate: submission }]); // select app
    push([]); // update app
    push([]); // update alert
    const r = await svc.updateGSSApplicationStatus('g1', 'approved');
    expect(typeof r.processingDays).toBe('number');
    expect(typeof r.met2WeekTarget).toBe('boolean');
  });

  it('flags exceeding the 2-week target for a slow decision', async () => {
    const submission = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    push([{ id: 'g1', submissionDate: submission }]);
    push([]);
    push([]);
    const r = await svc.updateGSSApplicationStatus('g1', 'denied', { reason: 'incomplete' });
    expect(r.met2WeekTarget).toBe(false);
  });

  it('throws when the application is not found', async () => {
    push([]);
    await expect(svc.updateGSSApplicationStatus('bad', 'withdrawn')).rejects.toThrow('GSS application not found');
  });
});

describe('createMentorship', () => {
  it('creates a mentorship and updates the mentee record', async () => {
    push([{ id: 'm1' }]); // insert returning
    push([]); // update foreignWorkers
    const m = await svc.createMentorship({
      mentorId: 'mentor1', menteeId: 'w1', skillsToTransfer: ['welding'], startDate: new Date('2024-01-01'), endDate: new Date('2024-12-31'),
    } as never);
    expect(m).toEqual({ id: 'm1' });
  });

  it('handles a mentorship with no end date', async () => {
    push([{ id: 'm2' }]);
    push([]);
    const m = await svc.createMentorship({
      mentorId: 'mentor1', menteeId: 'w1', skillsToTransfer: ['welding'], startDate: new Date('2024-01-01'),
    } as never);
    expect(m).toEqual({ id: 'm2' });
  });
});

describe('trackSkillsTransferKPIs', () => {
  it('updates KPIs without completing', async () => {
    push([]); // update mentorships
    await expect(svc.trackSkillsTransferKPIs('m1', { totalMeetings: 3, completionPercentage: 50 })).resolves.toBeUndefined();
  });

  it('marks completion and updates compliance when 100%', async () => {
    push([]); // update KPIs
    push([]); // update completed
    push([{ id: 'm1', menteeId: 'w1' }]); // select mentorship
    push([]); // update foreignWorkers compliance
    await expect(svc.trackSkillsTransferKPIs('m1', { completionPercentage: 100 })).resolves.toBeUndefined();
  });

  it('handles completion when the mentorship lookup is empty', async () => {
    push([]); // update KPIs
    push([]); // update completed
    push([]); // select mentorship empty
    await expect(svc.trackSkillsTransferKPIs('m1', { completionPercentage: 100 })).resolves.toBeUndefined();
  });
});

describe('flagLMBPNonCompliance', () => {
  it('creates a compliance alert', async () => {
    push([{ id: 'a1' }]); // insert returning
    const alert = await svc.flagLMBPNonCompliance({
      employerId: 'e1', issue: 'missing mentorship', severity: 'high', recommendedAction: 'assign mentor',
    });
    expect(alert).toEqual([{ id: 'a1' }]);
  });
});

describe('generateLMBPComplianceReport', () => {
  it('generates a report from letter and mentorship data', async () => {
    push([{ id: 'l1', employerId: 'e1', foreignWorkerIds: ['w1', 'w2'] }]); // letter
    push([{ id: 'm1', status: 'completed' }, { id: 'm2', status: 'active' }]); // mentorships
    push([{ id: 'rep1' }]); // insert returning
    const report = await svc.generateLMBPComplianceReport({
      lmbpLetterId: 'l1', reportingPeriodStart: new Date('2024-01-01'), reportingPeriodEnd: new Date('2024-12-31'),
    });
    expect(report).toEqual({ id: 'rep1' });
  });

  it('throws when the LMBP letter is not found', async () => {
    push([]);
    await expect(
      svc.generateLMBPComplianceReport({ lmbpLetterId: 'bad', reportingPeriodStart: new Date(), reportingPeriodEnd: new Date() })
    ).rejects.toThrow('LMBP letter not found');
  });
});

describe('getComplianceDashboard', () => {
  it('aggregates workers, letters, GSS apps, mentorships and alerts', async () => {
    push([
      { workPermitExpiry: daysFromNow(200) },
      { workPermitExpiry: daysFromNow(30) },
      { workPermitExpiry: daysFromNow(-5) },
    ]); // workers
    push([
      { complianceStatus: 'active', validUntil: daysFromNow(100) },
      { complianceStatus: 'expired', validUntil: daysFromNow(-10) },
    ]); // letters
    push([
      { actualDecisionDate: new Date(), met2WeekTarget: true, status: 'approved' },
      { actualDecisionDate: null, status: 'pending' },
    ]); // gss apps
    push([
      { status: 'active', completionPercentage: 50 },
      { status: 'completed', completionPercentage: 100 },
    ]); // mentorships
    push([
      { severity: 'critical' },
      { severity: 'high' },
      { severity: 'medium' },
    ]); // alerts
    const d = await svc.getComplianceDashboard('e1');
    expect(d.totalForeignWorkers).toBe(3);
    expect(d.activeWorkPermits).toBe(2);
    expect(d.expiringWorkPermits).toBe(1);
    expect(d.lmbpLetters.active).toBe(1);
    expect(d.gssApplications.met2WeekTarget).toBe(100);
    expect(d.mentorships.completed).toBe(1);
    expect(d.complianceAlerts.critical).toBe(1);
  });

  it('defaults GSS performance to 100 when no applications are completed', async () => {
    push([]); // workers
    push([]); // letters
    push([{ actualDecisionDate: null, status: 'pending' }]); // gss apps
    push([]); // mentorships
    push([]); // alerts
    const d = await svc.getComplianceDashboard('e1');
    expect(d.gssApplications.met2WeekTarget).toBe(100);
    expect(d.mentorships.avgCompletionRate).toBe(0);
  });
});

it('exposes a singleton instance', () => {
  expect(lmbpImmigrationService).toBeInstanceOf(LMBPImmigrationService);
});
