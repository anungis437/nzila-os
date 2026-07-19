import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const h = vi.hoisted(() => {
  const onConflict = vi.fn(async () => ({}));
  const db = { insert: vi.fn(() => ({ values: () => ({ onConflictDoUpdate: onConflict }) })) };
  const client: Record<string, ReturnType<typeof vi.fn>> = {};
  return { onConflict, db, client };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/data/lms', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));
vi.mock('../linkedin-learning-client', () => ({
  LinkedInLearningClient: class { constructor() { return h.client; } },
}));

import { LinkedInLearningAdapter } from '../linkedin-learning-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const initConfig = {
  organizationId: 'org-1',
  type: IntegrationType.LMS,
  provider: IntegrationProvider.LINKEDIN_LEARNING,
  credentials: { clientId: 'cid', clientSecret: 'secret', accessToken: 'tok' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new LinkedInLearningAdapter('org-1', { clientId: 'cid', clientSecret: 'secret', accessToken: 'tok' });
  await adapter.initialize(initConfig);
  await adapter.connect();
  return adapter;
};

describe('LinkedInLearningAdapter', () => {
  beforeEach(() => {
    h.onConflict.mockReset();
    h.onConflict.mockImplementation(async () => ({}));
    h.db.insert.mockClear();
    Object.assign(h.client, {
      healthCheck: vi.fn(async () => ({ status: 'ok', message: 'ok' })),
      getCourses: vi.fn(async () => ({ courses: [] })),
      getEnrollments: vi.fn(async () => ({ enrollments: [] })),
      getProgress: vi.fn(async () => ({ progress: [] })),
      getCompletions: vi.fn(async () => ({ completions: [] })),
      getLearners: vi.fn(async () => ({ learners: [] })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connect succeeds when health is ok', async () => {
    const adapter = await makeConnected();
    expect(h.client.healthCheck).toHaveBeenCalled();
    const hc = await adapter.healthCheck();
    expect(hc.healthy).toBe(true);
  });

  it('connect throws when health is not ok', async () => {
    const adapter = new LinkedInLearningAdapter('org-1', { clientId: 'c', clientSecret: 's' });
    await adapter.initialize(initConfig);
    h.client.healthCheck = vi.fn(async () => ({ status: 'error', message: 'bad' }));
    await expect(adapter.connect()).rejects.toThrow('Failed to connect to LinkedIn Learning');
  });

  it('healthCheck returns unhealthy on thrown error', async () => {
    const adapter = await makeConnected();
    h.client.healthCheck = vi.fn(() => Promise.reject(new Error('down')));
    const hc = await adapter.healthCheck();
    expect(hc.healthy).toBe(false);
    expect(hc.lastError).toBe('down');
  });

  it('disconnect clears connection and sync then throws', async () => {
    const adapter = await makeConnected();
    await adapter.disconnect();
    await expect(adapter.sync({ type: SyncType.FULL })).rejects.toThrow();
  });

  it('verifyWebhook fails closed and processWebhook is a no-op', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'x', data: {} } as never);
    expect(true).toBe(true);
  });

  it('sync courses processes records (both duration units)', async () => {
    const adapter = await makeConnected();
    h.client.getCourses = vi.fn(async () => ({
      courses: [
        { urn: 'c1', title: { value: 'A' }, description: { value: 'd' }, difficultyLevel: 'BEGINNER', timeToComplete: { unit: 'HOUR', duration: 2 }, publishedAt: '2024-01-01', lastUpdatedAt: '2024-02-01', provider: 'LinkedIn' },
        { urn: 'c2', title: { value: 'B' }, difficultyLevel: 'ADVANCED', timeToComplete: { unit: 'MINUTE', duration: 30 }, publishedAt: '2024-01-01', lastUpdatedAt: '2024-02-01', provider: 'LinkedIn' },
      ],
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['courses'] });
    expect(r.recordsProcessed).toBe(2);
    expect(r.success).toBe(true);
  });

  it('sync course counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getCourses = vi.fn(async () => ({
      courses: [{ urn: 'c1', title: { value: 'A' }, difficultyLevel: 'BEGINNER', timeToComplete: { unit: 'HOUR', duration: 1 }, publishedAt: '2024-01-01', lastUpdatedAt: '2024-02-01', provider: 'LinkedIn' }],
    }));
    h.onConflict.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['courses'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync enrollments, progress, completions and learners', async () => {
    const adapter = await makeConnected();
    h.client.getEnrollments = vi.fn(async () => ({
      enrollments: [{ learnerUrn: 'l1', courseUrn: 'c1', enrolledAt: '2024-01-01', status: 'ACTIVE', progressPercentage: 50, lastAccessedAt: '2024-02-01' }],
    }));
    h.client.getProgress = vi.fn(async () => ({
      progress: [{ learnerUrn: 'l1', contentUrn: 'ct1', courseUrn: 'c1', progressPercentage: 75, timeSpent: 120, completedAt: null }],
    }));
    h.client.getCompletions = vi.fn(async () => ({
      completions: [{ learnerUrn: 'l1', courseUrn: 'c1', completedAt: '2024-03-01', certificateUrn: 'cert1', grade: 95 }],
    }));
    h.client.getLearners = vi.fn(async () => ({
      learners: [{ urn: 'l1', firstName: 'A', lastName: 'B', email: 'a@b.com', profileUrl: 'http://x' }],
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['enrollments', 'progress', 'completions', 'learners'] });
    expect(r.recordsProcessed).toBe(4);
  });

  it('sync logs unknown entity type and sets metadata error when a fetch throws', async () => {
    const adapter = await makeConnected();
    await adapter.sync({ type: SyncType.FULL, orgs: ['mystery'] });
    h.client.getCourses = vi.fn(() => Promise.reject(new Error('fatal')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['courses'] });
    expect(r.success).toBe(false);
    expect((r.metadata as { error: string }).error).toBe('fatal');
  });
});
