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

  it('refuses to run against a production deployment, and the old override does nothing', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('UE_ENVIRONMENT', '');
      vi.stubEnv('NEXT_PUBLIC_APP_ENV', '');
      vi.stubEnv('STAGING_SEED_ALLOW_PROD', '');
      await expect(runStagingSeed('org-4')).rejects.toThrow(/Refusing to run "stagingSeed" against a production deployment/);

      vi.stubEnv('UE_ENVIRONMENT', 'production');
      vi.stubEnv('STAGING_SEED_ALLOW_PROD', 'true');
      await expect(runStagingSeed('org-4')).rejects.toThrow(/no override/);
    } finally {
      write.mockRestore();
    }
  });

  it('seeds the organization STAGING_SEED_ORG_ID names, falls back to the demo staging organization, and still refuses production with it set', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('UE_ENVIRONMENT', 'staging');
      vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
      mocks.select.mockReturnValue(selectReturning([{ id: 'x' }]));
      mocks.insert.mockReturnValue({ values: vi.fn() });

      vi.stubEnv('STAGING_SEED_ORG_ID', 'org-from-the-environment');
      vi.resetModules();
      const named = await import('../stagingSeed');
      expect((await named.runStagingSeed()).org_id).toBe('org-from-the-environment');

      vi.stubEnv('STAGING_SEED_ORG_ID', '');
      vi.resetModules();
      const unnamed = await import('../stagingSeed');
      expect((await unnamed.runStagingSeed()).org_id).toBe('org_demo_unioneyes_staging');

      vi.stubEnv('STAGING_SEED_ORG_ID', 'org-from-the-environment');
      vi.stubEnv('UE_ENVIRONMENT', 'production');
      vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
      vi.resetModules();
      const production = await import('../stagingSeed');
      await expect(production.runStagingSeed()).rejects.toThrow(/Refusing to run "stagingSeed" against a production deployment/);
    } finally {
      write.mockRestore();
    }
  });

  it('runs in a staging deployment, which is named by its identity and needs no override', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UE_ENVIRONMENT', 'staging');
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    mocks.select.mockReturnValue(selectReturning([{ id: 'x' }]));
    mocks.insert.mockReturnValue({ values: vi.fn() });

    const result = await runStagingSeed('org-5');
    expect(result.ok).toBe(true);
  });
});
