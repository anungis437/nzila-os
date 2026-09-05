import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const h = vi.hoisted(() => {
  const workers: Array<{
    name: string;
    processor: (job: unknown) => Promise<unknown>;
    handlers: Record<string, ((...a: unknown[]) => void)[]>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  const selectQueue: unknown[] = [];
  const makeSelectChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit']) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = selectQueue.length ? selectQueue.shift() : [];
      return v instanceof Error ? Promise.reject(v).then(res, rej) : Promise.resolve(v).then(res, rej);
    };
    return chain;
  };
  return {
    workers,
    selectQueue,
    makeSelectChain,
    redisQuit: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    generatePDF: vi.fn(async () => Buffer.from('pdf')),
    generateExcel: vi.fn(async () => Buffer.from('xlsx')),
    notifySend: vi.fn(() => Promise.resolve()),
    updateRequestStatus: vi.fn(async () => undefined),
    profile: { email: 'u@x.com' } as { email: string } | null,
    findFirst: vi.fn(),
  };
});

class MockWorker {
  name: string;
  processor: (job: unknown) => Promise<unknown>;
  handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  close = vi.fn(async () => undefined);
  constructor(name: string, processor: (job: unknown) => Promise<unknown>) {
    this.name = name;
    this.processor = processor;
    h.workers.push(this as unknown as (typeof h.workers)[number]);
  }
  on(event: string, cb: (...a: unknown[]) => void) {
    (this.handlers[event] ||= []).push(cb);
    return this;
  }
}
class MockIORedis {
  quit = h.redisQuit;
}

const nodeRequire = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Module: any = nodeRequire('node:module');
const originalLoad = Module._load;
Module._load = function (request: string, ...args: unknown[]) {
  if (request === 'bullmq') return { Worker: MockWorker, Job: class {} };
  if (request === 'ioredis') return MockIORedis;
  return originalLoad.call(this, request, ...args);
};

afterAll(() => {
  Module._load = originalLoad;
});

vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  between: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

vi.mock('../../../db/db', () => ({
  db: {
    select: vi.fn(() => h.makeSelectChain()),
    query: { profiles: { findFirst: h.findFirst } },
  },
}));
vi.mock('../../../db/schema/claims-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('../../../db/schema/organization-members-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
// Production source now pulls grievanceTransitions from the canonical
// domains/claims/workflows module (PR #752 schema canonicalization); mock
// that path instead of the deprecated grievance-workflow-schema module so
// this test doesn't execute the real Drizzle enum/table definitions against
// the mocked claims-schema module above.
vi.mock('../../../db/schema/domains/claims/workflows', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));

vi.mock('../../services/notification-service', () => ({ getNotificationService: () => ({ send: h.notifySend }) }));
vi.mock('../../utils/pdf-generator', () => ({ generatePDF: h.generatePDF }));
vi.mock('../../utils/excel-generator', () => ({ generateExcel: h.generateExcel }));
vi.mock('../../gdpr/consent-manager', () => ({
  DataExportService: { exportUserData: vi.fn(async () => ({})) },
  GdprRequestManager: { updateRequestStatus: h.updateRequestStatus },
}));
vi.mock('papaparse', () => ({ default: { unparse: vi.fn(() => '') } }));
vi.mock('fs/promises', () => ({
  default: { mkdir: h.mkdir, writeFile: h.writeFile },
  mkdir: h.mkdir,
  writeFile: h.writeFile,
}));

const job = (data: Record<string, unknown>, id = 'j1') => ({
  id,
  data,
  updateProgress: vi.fn(async () => undefined),
});

async function loadFresh() {
  vi.resetModules();
  return import('../report-worker');
}

describe('report-worker', () => {
  let sigtermBefore: NodeJS.SignalsListener[];
  let sigintBefore: NodeJS.SignalsListener[];

  beforeEach(() => {
    sigtermBefore = process.listeners('SIGTERM') as NodeJS.SignalsListener[];
    sigintBefore = process.listeners('SIGINT') as NodeJS.SignalsListener[];
    h.workers.length = 0;
    h.selectQueue.length = 0;
    h.redisQuit.mockClear();
    h.mkdir.mockReset().mockResolvedValue(undefined);
    h.writeFile.mockReset().mockResolvedValue(undefined);
    h.generatePDF.mockReset().mockResolvedValue(Buffer.from('pdf'));
    h.generateExcel.mockReset().mockResolvedValue(Buffer.from('xlsx'));
    h.notifySend.mockReset().mockReturnValue(Promise.resolve());
    h.updateRequestStatus.mockReset().mockResolvedValue(undefined);
    h.profile = { email: 'u@x.com' };
    h.findFirst.mockReset().mockImplementation(async (opts: { where?: (p: unknown, ops: unknown) => unknown }) => {
      try { opts?.where?.({ userId: { __col: 'userId' } }, { eq: () => ({}) }); } catch { /* ignore */ }
      return h.profile;
    });
  });

  afterEach(() => {
    for (const l of process.listeners('SIGTERM') as NodeJS.SignalsListener[]) {
      if (!sigtermBefore.includes(l)) process.removeListener('SIGTERM', l);
    }
    for (const l of process.listeners('SIGINT') as NodeJS.SignalsListener[]) {
      if (!sigintBefore.includes(l)) process.removeListener('SIGINT', l);
    }
    vi.clearAllMocks();
  });

  it('exports a configured worker', async () => {
    const mod = await loadFresh();
    expect(mod.reportWorker).toBeDefined();
    expect(h.workers[0].name).toBe('reports');
  });

  it('generates a claims PDF report and notifies the user', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'c1', status: 'open', priority: 'high', createdAt: new Date() }]);
    const r = await h.workers[0].processor(job({
      reportType: 'claims', tenantId: 'org1', userId: 'u1',
      parameters: { format: 'pdf', startDate: '2024-01-01', endDate: '2024-02-01', status: 'open' },
    })) as { success: boolean; filename: string; size: number };
    expect(r.success).toBe(true);
    expect(r.filename).toMatch(/^claims-report-\d+\.pdf$/);
    expect(h.generatePDF).toHaveBeenCalled();
    expect(h.writeFile).toHaveBeenCalled();
    expect(h.notifySend).toHaveBeenCalled();
  });

  it('generates a claims Excel report without optional filters', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'c1', status: 'open' }]);
    const r = await h.workers[0].processor(job({
      reportType: 'claims', tenantId: 'org1', userId: 'u1',
      parameters: { format: 'excel' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
    expect(h.generateExcel).toHaveBeenCalled();
  });

  it('generates a members report (excel)', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'm1', status: 'active' }]);
    const r = await h.workers[0].processor(job({
      reportType: 'members', tenantId: 'org1', userId: 'u1',
      parameters: { format: 'excel', status: 'active' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
  });

  it('generates a grievances report (pdf)', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'g1', claimNumber: 'G-1' }]);
    const r = await h.workers[0].processor(job({
      reportType: 'grievances', tenantId: 'org1', userId: 'u1',
      parameters: { format: 'pdf', startDate: '2024-01-01', endDate: '2024-02-01', status: 'open' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
  });

  it('generates a usage report aggregating claims and members (pdf)', async () => {
    await loadFresh();
    h.selectQueue.push(
      [{ status: 'open', priority: 'high', resolvedAt: null }, { status: 'closed', priority: 'low', resolvedAt: new Date() }],
      [{ status: 'active' }, { status: 'inactive' }],
      [{ status: 'active' }],
      [{ id: 't1' }],
    );
    const r = await h.workers[0].processor(job({
      reportType: 'usage', tenantId: 'org1', userId: 'u1',
      parameters: { format: 'pdf', startDate: '2024-01-01', endDate: '2024-02-01' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
    expect(h.generatePDF).toHaveBeenCalled();
  });

  it('generates a usage report (excel)', async () => {
    await loadFresh();
    h.selectQueue.push([], [], [], []);
    const r = await h.workers[0].processor(job({
      reportType: 'usage', tenantId: 'org1', userId: 'u1',
      parameters: { format: 'excel', startDate: '2024-01-01', endDate: '2024-02-01' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
    expect(h.generateExcel).toHaveBeenCalled();
  });

  it('rejects for an unknown report type', async () => {
    await loadFresh();
    await expect(h.workers[0].processor(job({
      reportType: 'bogus', tenantId: 'org1', userId: 'u1', parameters: { format: 'pdf' },
    }))).rejects.toThrow(/Unknown report type/);
  });

  it('rejects the gdpr export type (helper not in scope)', async () => {
    await loadFresh();
    await expect(h.workers[0].processor(job({
      reportType: 'gdpr_export', tenantId: 'org1', userId: 'u1',
      parameters: { format: 'json', requestId: 'r1' },
    }))).rejects.toBeDefined();
  });

  it('still succeeds when notification send fails', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'c1', status: 'open' }]);
    h.notifySend.mockReturnValue(Promise.reject(new Error('notify down')));
    const r = await h.workers[0].processor(job({
      reportType: 'claims', tenantId: 'org1', userId: 'u1', parameters: { format: 'pdf' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
  });

  it('still succeeds when the profile lookup throws', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'c1', status: 'open' }]);
    h.findFirst.mockRejectedValue(new Error('db down'));
    const r = await h.workers[0].processor(job({
      reportType: 'claims', tenantId: 'org1', userId: 'u1', parameters: { format: 'pdf' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
  });

  it('skips notification when the user has no email', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'c1', status: 'open' }]);
    h.profile = null;
    const r = await h.workers[0].processor(job({
      reportType: 'claims', tenantId: 'org1', userId: 'u1', parameters: { format: 'pdf' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
    expect(h.notifySend).not.toHaveBeenCalled();
  });

  it('continues when ensuring the reports directory fails', async () => {
    await loadFresh();
    h.mkdir.mockRejectedValue(new Error('mkdir fail'));
    h.selectQueue.push([{ id: 'c1', status: 'open' }]);
    const r = await h.workers[0].processor(job({
      reportType: 'claims', tenantId: 'org1', userId: 'u1', parameters: { format: 'pdf' },
    })) as { success: boolean };
    expect(r.success).toBe(true);
  });

  it('registers event handlers and a SIGTERM shutdown', async () => {
    await loadFresh();
    const w = h.workers[0];
    expect(() => w.handlers.completed?.[0]({})).not.toThrow();
    expect(() => w.handlers.failed?.[0]({}, new Error('e'))).not.toThrow();
    expect(() => w.handlers.error?.[0](new Error('e'))).not.toThrow();
    process.emit('SIGTERM');
    await Promise.resolve();
    await Promise.resolve();
    expect(w.close).toHaveBeenCalled();
  });
});
