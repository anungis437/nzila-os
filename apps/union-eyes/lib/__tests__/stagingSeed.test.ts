import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
  },
}));

vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: {
    id: 'id',
    organizationId: 'organizationId',
    grievanceNumber: 'grievanceNumber',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
}));

import { buildScenarios, runStagingSeed } from '../stagingSeed';

/** Build a chainable select that resolves to `rows` at .limit(). */
function selectReturning(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
  };
  return chain;
}

describe('lib/stagingSeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the deterministic scenario list', () => {
    const scenarios = buildScenarios('org-1');
    expect(scenarios).toHaveLength(5);
    expect(scenarios[0].id).toBe('open-grievance-triage');
  });

  it('inserts grievances that do not yet exist and reports success', async () => {
    mocks.select.mockReturnValue(selectReturning([])); // none exist
    const values = vi.fn().mockResolvedValue(undefined);
    mocks.insert.mockReturnValue({ values });

    const result = await runStagingSeed('org-1');

    expect(result.ok).toBe(true);
    expect(result.org_id).toBe('org-1');
    expect(result.scenarios_applied).toHaveLength(5);
    expect(values).toHaveBeenCalledTimes(5);
  });

  it('skips insert when a grievance already exists', async () => {
    mocks.select.mockReturnValue(selectReturning([{ id: 'existing' }]));
    const values = vi.fn();
    mocks.insert.mockReturnValue({ values });

    const result = await runStagingSeed('org-2');

    expect(result.ok).toBe(true);
    expect(values).not.toHaveBeenCalled();
  });

  it('captures warnings when a scenario fails', async () => {
    mocks.select.mockReturnValue(selectReturning([]));
    const values = vi.fn().mockRejectedValue(new Error('db down'));
    mocks.insert.mockReturnValue({ values });

    const result = await runStagingSeed('org-3');

    expect(result.ok).toBe(false);
    expect(result.warnings).toHaveLength(5);
    expect(result.warnings[0]).toContain('db down');
  });

  it('refuses to run against production without the override', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STAGING_SEED_ALLOW_PROD', '');
    await expect(runStagingSeed('org-4')).rejects.toThrow(/refuses to run against NODE_ENV=production/);
  });

  it('allows production with the explicit override', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STAGING_SEED_ALLOW_PROD', 'true');
    mocks.select.mockReturnValue(selectReturning([{ id: 'x' }]));
    mocks.insert.mockReturnValue({ values: vi.fn() });

    const result = await runStagingSeed('org-5');
    expect(result.ok).toBe(true);
  });
});
