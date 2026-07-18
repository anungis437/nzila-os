import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  execute: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
  createSession: vi.fn(),
  listIncidentUsers: vi.fn(),
  createMatter: vi.fn(),
  updateAiSummaryStatus: vi.fn(),
  selectResults: [] as Array<Array<Record<string, unknown>>>,
  executeResults: [] as Array<Array<Record<string, unknown>>>,
  deleteResults: [] as Array<Array<Record<string, unknown>>>,
  manifestText: null as string | null,
}));

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    execute: state.execute,
    delete: state.delete,
    select: state.select,
  },
}));

vi.mock('@nzila/platform-auth/password', () => ({
  createSession: state.createSession,
}));

vi.mock('@/modules/incidents/service', () => ({
  listIncidentUsers: state.listIncidentUsers,
}));

vi.mock('@/modules/incidents/matter-service', () => ({
  createMatter: state.createMatter,
  updateAiSummaryStatus: state.updateAiSummaryStatus,
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: state.mkdir,
    readFile: state.readFile,
    writeFile: state.writeFile,
    rm: state.rm,
  },
  mkdir: state.mkdir,
  readFile: state.readFile,
  writeFile: state.writeFile,
  rm: state.rm,
}));

function makeSelectChain() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => state.selectResults.shift() ?? []),
      })),
    })),
  };
}

function makeDeleteChain() {
  return {
    where: vi.fn(() => ({
      returning: vi.fn(async () => state.deleteResults.shift() ?? []),
    })),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
  state.selectResults = [];
  state.executeResults = [];
  state.deleteResults = [];
  state.manifestText = null;

  state.mkdir.mockResolvedValue(undefined);
  state.readFile.mockImplementation(async () => {
    if (state.manifestText) {
      return state.manifestText;
    }
    throw new Error('ENOENT');
  });
  state.writeFile.mockImplementation(async (_filePath: string, content: string) => {
    const text = String(content);
    if (text.includes('reviewerSessionTokenHash')) {
      state.manifestText = text;
    }
  });
  state.rm.mockResolvedValue(undefined);
  state.createSession.mockImplementation(async ({ userId }: { userId: string }) => ({
    token: `token-${userId}`,
    session: { sessionId: `session-${userId}` },
  }));
  state.listIncidentUsers.mockResolvedValue(undefined);
  state.createMatter.mockImplementation(async (_orgId: string, createdBy: string, input: Record<string, unknown>) => ({
    id: `${createdBy}-${String(input.title).toLowerCase().replace(/\s+/g, '-')}`,
  }));
  state.updateAiSummaryStatus.mockResolvedValue(undefined);
  state.select.mockImplementation(() => makeSelectChain());
  state.execute.mockImplementation(async () => state.executeResults.shift() ?? []);
  state.delete.mockImplementation(() => makeDeleteChain());
});

describe('courtlens-gap3 fixture', () => {
  it('refuses to run in production-like environments', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');

    const { assertLocalOnly } = await import('../courtlens-gap3-fixture');
    expect(() => assertLocalOnly()).toThrow('Refusing to run CourtLens gap3 fixture in production');

    vi.unstubAllEnvs();
  });

  it('returns the existing manifest on duplicate seed instead of reseeding', async () => {
    state.selectResults = [[{ userId: 'user-1' }], [{ userId: 'user-2' }], [{ userId: 'user-3' }]];
    state.executeResults = [[], [], []];
    state.createMatter.mockResolvedValueOnce({ id: 'matter-1' });
    state.createMatter.mockResolvedValueOnce({ id: 'matter-2' });
    state.createMatter.mockResolvedValueOnce({ id: 'matter-3' });

    const { seed } = await import('../courtlens-gap3-fixture');
    const first = await seed();
    const second = await seed();

    expect(first).toMatchObject({ orgId: 'metro-university' });
    expect(second).toEqual(first);
    expect(state.createSession).toHaveBeenCalledTimes(3);
    expect(state.createMatter).toHaveBeenCalledTimes(3);
    expect(state.listIncidentUsers).toHaveBeenCalledTimes(2);
  });

  it('writes a redacted seed manifest with hashed session aliases only', async () => {
    state.selectResults = [[{ userId: 'user-1' }], [{ userId: 'user-2' }], [{ userId: 'user-3' }]];
    state.executeResults = [[], [], []];
    state.createMatter.mockResolvedValueOnce({ id: 'matter-1' });
    state.createMatter.mockResolvedValueOnce({ id: 'matter-2' });
    state.createMatter.mockResolvedValueOnce({ id: 'matter-3' });

    const { seed } = await import('../courtlens-gap3-fixture');
    await seed();

    const written = state.writeFile.mock.calls.find(([filePath]) => String(filePath).includes('fixture-manifest.json'))?.[1] as string;
    expect(written).toContain('reviewerSessionTokenHash');
    expect(written).toContain('sameTenantDeniedSessionTokenHash');
    expect(written).toContain('crossTenantSessionTokenHash');
    expect(written).not.toContain('token-ue-qa');
    expect(written).not.toContain('playwright-e2e-auth');
  });

  it('cleans up rows and reports zero remaining records', async () => {
    state.manifestText = JSON.stringify({
      createdAt: '2026-07-18T00:00:00.000Z',
      orgId: 'metro-university',
      reviewerUserId: 'ue-qa-steward-primary',
      reviewerSessionId: 'session-reviewer',
      reviewerSessionTokenHash: 'hash-reviewer',
      sameTenantDeniedUserId: 'ue-qa-member-primary',
      sameTenantDeniedSessionId: 'session-denied',
      sameTenantDeniedSessionTokenHash: 'hash-denied',
      crossTenantUserId: 'ue-qa-member-secondary',
      crossTenantSessionId: 'session-cross',
      crossTenantSessionTokenHash: 'hash-cross',
      sameTenantDeniedMatterId: 'matter-denied',
      externalizableMatterId: 'matter-export',
      crossTenantMatterId: 'matter-cross',
    });
    state.executeResults = [[], [], [], [{ id: 'matter-denied' }, { id: 'matter-export' }, { id: 'matter-cross' }], [{ id: 'ue-qa-steward-primary' }, { id: 'ue-qa-member-primary' }, { id: 'ue-qa-member-secondary' }], [{ count: 0 }], [{ count: 0 }]];
    state.deleteResults = [[{ sessionId: 'session-reviewer' }, { sessionId: 'session-denied' }, { sessionId: 'session-cross' }]];

    const { cleanup } = await import('../courtlens-gap3-fixture');
    await cleanup();

    const reportText = state.writeFile.mock.calls.find(([filePath]) => String(filePath).includes('cleanup-report.json'))?.[1] as string;
    const report = JSON.parse(reportText) as Record<string, unknown>;

    expect(report.deletedIncidentCount).toBe(3);
    expect(report.deletedAbrUserCount).toBe(3);
    expect(report.deletedSessionCount).toBe(3);
    expect(report.remainingIncidentCount).toBe(0);
    expect(report.remainingAbrUserCount).toBe(0);
    expect(report.sessionIdentifiersRedacted).toBe(true);
  });

  it('uses the approved database boundary and cleanup predicates for the fixture tables', async () => {
    state.manifestText = JSON.stringify({
      createdAt: '2026-07-18T00:00:00.000Z',
      orgId: 'metro-university',
      reviewerUserId: 'ue-qa-steward-primary',
      reviewerSessionId: 'session-reviewer',
      reviewerSessionTokenHash: 'hash-reviewer',
      sameTenantDeniedUserId: 'ue-qa-member-primary',
      sameTenantDeniedSessionId: 'session-denied',
      sameTenantDeniedSessionTokenHash: 'hash-denied',
      crossTenantUserId: 'ue-qa-member-secondary',
      crossTenantSessionId: 'session-cross',
      crossTenantSessionTokenHash: 'hash-cross',
      sameTenantDeniedMatterId: 'matter-denied',
      externalizableMatterId: 'matter-export',
      crossTenantMatterId: 'matter-cross',
    });
    state.executeResults = [[], [], [], [{ id: 'matter-denied' }, { id: 'matter-export' }, { id: 'matter-cross' }], [{ id: 'ue-qa-steward-primary' }, { id: 'ue-qa-member-primary' }, { id: 'ue-qa-member-secondary' }], [{ count: 0 }], [{ count: 0 }]];
    state.deleteResults = [[{ sessionId: 'session-reviewer' }, { sessionId: 'session-denied' }, { sessionId: 'session-cross' }]];

    const { cleanup } = await import('../courtlens-gap3-fixture');
    await cleanup();

    expect(state.execute).toHaveBeenCalled();
    expect(state.delete).toHaveBeenCalled();
    const serializedCalls = state.execute.mock.calls.map(([query]) => JSON.stringify(query)).join('\n');
    expect(serializedCalls).toContain('abr_notes');
    expect(serializedCalls).toContain('abr_remediation_actions');
    expect(serializedCalls).toContain('abr_incident_events');
    expect(serializedCalls).toContain('abr_incidents');
    expect(serializedCalls).toContain('abr_users');
  });
});
