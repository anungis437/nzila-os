import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  shouldThrow: false,
  warn: vi.fn(),
}));

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'orderBy', 'limit']) {
    c[m] = vi.fn(() => c);
  }
  (c as { then: (r: (v: unknown) => void, j: (e: unknown) => void) => void }).then = (resolve, reject) => {
    if (h.shouldThrow) return reject(new Error('db boom'));
    resolve(h.rows);
  };
  return c;
}

vi.mock('server-only', () => ({}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => 'and'), desc: vi.fn(() => 'desc'), eq: vi.fn(() => 'eq'),
}));
vi.mock('@nzila/os-core/telemetry', () => ({
  createLogger: () => ({ warn: h.warn, info: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/db/db', () => ({ db: { select: vi.fn(() => chain()) } }));
vi.mock('@/db/schema/grievance-schema', () => ({
  grievances: new Proxy({}, { get: (_t, p) => String(p) }),
}));
vi.mock('@/lib/demo/cupe4373-demo', () => ({
  demoCases: [{ id: 'G-1', title: 'Static One' }],
}));

import { getDemoCaseFromDb, getDemoCasesFromDb } from '../cupe4373-cases-repo';

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'u1', grievanceNumber: 'G-DB-1', type: 'raw-type', status: 'open',
    priority: 'urgent', step: '1', grievantName: 'Worker', employerName: 'Emp',
    workplaceName: 'Site', cbaArticle: 'Art 5', title: 'DB Case',
    description: 'desc', background: 'bg', desiredOutcome: 'win',
    filedDate: new Date('2024-01-01'), responseDeadline: new Date('2024-02-01'),
    timeline: [{ date: '2024-01-02', action: 'filed', actor: 'A', entryId: 't1' }],
    attachments: [], organizationId: 'org', createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-03'),
    ...over,
  };
}

beforeEach(() => {
  h.rows = [];
  h.shouldThrow = false;
  h.warn.mockReset();
});

afterEach(() => {
  delete process.env.UE_DEMO_DATA_SOURCE;
  delete process.env.DATABASE_URL;
});

describe('getDemoCasesFromDb', () => {
  it('returns static cases when db not enabled', async () => {
    const out = await getDemoCasesFromDb();
    expect(out[0].id).toBe('G-1');
  });

  it('enables via DATABASE_URL demo-db host', async () => {
    process.env.DATABASE_URL = 'postgres://demo-db/x';
    h.rows = [];
    const out = await getDemoCasesFromDb();
    expect(out[0].id).toBe('G-1');
  });

  it('reconstructs cases with demo meta', async () => {
    process.env.UE_DEMO_DATA_SOURCE = 'db';
    h.rows = [
      row({
        attachments: [
          { id: 'a1', name: 'real.pdf', url: 'u', type: 'pdf', uploadedAt: 'x' },
          {
            id: 'm', name: 'meta', url: 'u', type: 'json', uploadedAt: 'x',
            _demoMeta: {
              caseworkStream: 'accommodation', worker: 'W', unit: 'U', location: 'L',
              assignedSteward: 'S', urgencyLabel: 'urgent', statusLabel: 'Active',
              agreementRefs: ['A1'], continuityState: 'cs', nextStep: 'ns',
              relatedCases: ['rc'], flags: ['f'], notes: ['n'],
            },
          },
        ],
      }),
    ];
    const out = await getDemoCasesFromDb();
    expect(out[0].type).toBe('Accommodation request');
    expect(out[0].worker).toBe('W');
    expect(out[0].attachments).toEqual(['real.pdf']);
    expect(out[0].timeline[0].id).toBe('t1');
  });

  it('reconstructs cases without meta covering priority mapping and type labels', async () => {
    process.env.UE_DEMO_DATA_SOURCE = 'db';
    h.rows = [
      row({ grievanceNumber: 'G-A', priority: 'high', timeline: null, attachments: null, cbaArticle: null }),
      row({ grievanceNumber: 'G-B', priority: 'low', grievantName: null, workplaceName: null }),
    ];
    const out = await getDemoCasesFromDb();
    expect(out[0].urgency).toBe('watch');
    expect(out[1].urgency).toBe('steady');
    expect(out[0].timeline).toEqual([]);
  });

  it('falls back to static when no rows', async () => {
    process.env.UE_DEMO_DATA_SOURCE = 'db';
    h.rows = [];
    expect((await getDemoCasesFromDb())[0].id).toBe('G-1');
  });

  it('falls back to static when db throws', async () => {
    process.env.UE_DEMO_DATA_SOURCE = 'db';
    h.shouldThrow = true;
    expect((await getDemoCasesFromDb())[0].id).toBe('G-1');
    expect(h.warn).toHaveBeenCalled();
  });
});

describe('getDemoCaseFromDb', () => {
  it('returns static match when db not enabled', async () => {
    expect((await getDemoCaseFromDb('G-1'))?.id).toBe('G-1');
    expect(await getDemoCaseFromDb('missing')).toBeNull();
  });

  it('returns reconstructed case from db', async () => {
    process.env.UE_DEMO_DATA_SOURCE = 'db';
    h.rows = [row({ grievanceNumber: 'G-DB-2' })];
    const out = await getDemoCaseFromDb('G-DB-2');
    expect(out?.id).toBe('G-DB-2');
  });

  it('falls back to static when row missing', async () => {
    process.env.UE_DEMO_DATA_SOURCE = 'db';
    h.rows = [];
    expect(await getDemoCaseFromDb('G-1')).not.toBeNull();
    expect(await getDemoCaseFromDb('nope')).toBeNull();
  });

  it('falls back to static when db throws', async () => {
    process.env.UE_DEMO_DATA_SOURCE = 'db';
    h.shouldThrow = true;
    expect((await getDemoCaseFromDb('G-1'))?.id).toBe('G-1');
    expect(h.warn).toHaveBeenCalled();
  });
});
