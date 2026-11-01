import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  runtime: vi.fn(),
  authority: vi.fn(),
  load: vi.fn(),
  resolve: vi.fn(),
  apply: vi.fn(),
  deny: vi.fn(),
  system: vi.fn(),
  tenant: vi.fn(),
  logError: vi.fn(),
}));

class TestApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
  static unauthorized = () => new TestApiError(401, 'Authentication required');
  static forbidden = (message: string) => new TestApiError(403, message);
  static badRequest = (message: string) => new TestApiError(400, message);
  static conflict = (message: string) => new TestApiError(409, message);
  static internal = (message: string) => new TestApiError(500, message);
}

vi.mock('@/lib/api/framework', async () => ({
  withApi: m.withApi,
  RATE_LIMITS: { ORG_WRITE: 'ORG_WRITE' },
  z: (await import('zod')).z,
  ApiError: TestApiError,
}));
vi.mock('@/lib/config/pilot-demo-runtime', () => ({ assertPilotDemoMutationRuntime: m.runtime }));
vi.mock('@/lib/platform/platform-staff', () => ({ requirePlatformStaffAuthority: m.authority }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.system, withRLSContext: m.tenant }));
vi.mock('@/lib/logger', () => ({ logger: { error: m.logError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/pilot/fixture-bootstrap', () => {
  class FixtureUnavailableError extends Error {}
  return {
    FixtureUnavailableError,
    fixtureSlug: (fixture: { org: { slug?: string } }) => fixture.org.slug ?? 'cupe-local-123',
    loadCupeFixture: m.load,
    resolveFixtureOrganization: m.resolve,
    applyFixture: m.apply,
    recordFixtureDenial: m.deny,
  };
});

const fixture = {
  org: { name: 'CUPE Local', slug: 'cupe-local-123' },
  members: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
  cases: [{ number: 'G-1' }, { number: 'G-2' }],
  worksites: [{ id: 'w1' }, { id: 'w2' }],
};

const done = {
  kind: 'done' as const,
  dryRun: false,
  removed: { members: 0, grievances: 0 },
  clearedStale: { members: 0, grievances: 0 },
  seeded: { members: 2, cases: 1 },
  alreadyPresent: { members: 1, cases: 1 },
  caseNumbersInUse: 0,
  onboarding: { checklistInitialized: 1, completed: 1, pending: 6, total: 7 },
};

type Body = { reset?: boolean; confirmReset?: string; dryRun?: boolean; includeDemoScript?: boolean };
const ctx = (body: Body = {}) => ({
  body: { reset: false, dryRun: false, includeDemoScript: true, ...body },
  userId: 'staff_1',
  organizationId: 'org_actor',
});

async function post(body: Body = {}) {
  const { POST } = await import('../pilot/bootstrap/cupe/route');
  return (POST as unknown as (c: unknown) => Promise<Record<string, any>>)(ctx(body));
}

// DEF-0B10-PIL-CUPE-BOOTSTRAP-RESET-DELETES-ALL-GRIEVANCES-MEMBERS-AND-CHECKLIST-ROWS-OF-THE-ORGANIZATION-AT-THE-FIXTURE-SLUG-WITH-NO-DEMO-MARKER
describe('pilot/bootstrap/cupe route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c));
    m.runtime.mockReturnValue('pilot');
    m.authority.mockResolvedValue({ userId: 'staff_1', organizationId: 'org_actor' });
    m.load.mockResolvedValue(fixture);
    m.resolve.mockResolvedValue({ kind: 'ready', organizationId: 'org_fixture', created: true });
    m.apply.mockResolvedValue(done);
    m.deny.mockResolvedValue(undefined);
    m.system.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work('tx-system'));
    m.tenant.mockImplementation(async (_scope: unknown, work: (tx: unknown) => Promise<unknown>) => work('tx-tenant'));
  });

  it('refuses outside a pilot or demo runtime before consulting authority or any database', async () => {
    m.runtime.mockImplementation(() => { throw new Error('NZILA_MODE must be pilot or demo'); });

    await expect(post()).rejects.toMatchObject({ status: 403, message: 'NZILA_MODE must be pilot or demo' });

    expect(m.authority).not.toHaveBeenCalled();
    expect(m.system).not.toHaveBeenCalled();
    expect(m.tenant).not.toHaveBeenCalled();
  });

  it('needs platform-staff authority for the fixture operation, and a refusal opens nothing', async () => {
    m.authority.mockRejectedValue(new TestApiError(403, 'Acting across organizations needs platform-staff authority'));

    await expect(post()).rejects.toMatchObject({ status: 403 });

    expect(m.authority).toHaveBeenCalledWith({ userId: 'staff_1', organizationId: 'org_actor' }, 'platform.pilot_fixture.manage');
    expect(m.load).not.toHaveBeenCalled();
    expect(m.system).not.toHaveBeenCalled();
    expect(m.tenant).not.toHaveBeenCalled();
  });

  it('reports an unreadable fixture as a server problem and writes nothing', async () => {
    const { FixtureUnavailableError } = await import('@/lib/pilot/fixture-bootstrap');
    m.load.mockRejectedValue(new FixtureUnavailableError('The pilot fixture file was not found'));

    await expect(post()).rejects.toMatchObject({ status: 500, message: 'The pilot fixture file was not found' });

    expect(m.system).not.toHaveBeenCalled();
  });

  it.each([[undefined], ['some-other-org'], ['']])('requires a reset to name the organization (got %j) and opens nothing otherwise', async (confirmReset) => {
    await expect(post({ reset: true, confirmReset })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('confirmReset') });

    expect(m.system).not.toHaveBeenCalled();
    expect(m.tenant).not.toHaveBeenCalled();
  });

  it('accepts a reset that names the fixture organization, and a rehearsal of one without the name', async () => {
    m.apply.mockImplementation(async (_tx: unknown, args: { dryRun: boolean }) => ({ ...done, dryRun: args.dryRun }));

    await expect(post({ reset: true, confirmReset: 'cupe-local-123' })).resolves.toMatchObject({ success: true, dryRun: false, reset: true });
    await expect(post({ reset: true, dryRun: true })).resolves.toMatchObject({ success: true, dryRun: true, reset: true });

    expect(m.apply).toHaveBeenLastCalledWith('tx-tenant', expect.objectContaining({ reset: true, dryRun: true }));
  });

  it('creates the organization as the system role only, and seeds as the runtime role bound to that organization', async () => {
    const result = await post();

    expect(m.resolve).toHaveBeenCalledWith('tx-system', { slug: 'cupe-local-123', name: 'CUPE Local', userId: 'staff_1', dryRun: false, runtimeMode: 'pilot' });
    expect(m.tenant).toHaveBeenCalledWith({ organizationId: 'org_fixture', userId: 'staff_1' }, expect.any(Function));
    expect(m.apply).toHaveBeenCalledTimes(1);
    expect(m.apply).toHaveBeenCalledWith(
      'tx-tenant',
      expect.objectContaining({ organizationId: 'org_fixture', userId: 'staff_1', reset: false, dryRun: false, organizationCreated: true, runtimeMode: 'pilot' }),
    );
    expect(m.system).toHaveBeenCalledTimes(1);
    expect(result.organizationId).toBe('org_fixture');
    expect(result.organizationCreated).toBe(true);
  });

  it('refuses an organization at the slug that the bootstrap did not create, and never opens its tenant scope', async () => {
    m.resolve.mockResolvedValue({ kind: 'refused', reason: 'not_a_fixture_organization', organizationId: 'org_real' });

    await expect(post({ reset: true, confirmReset: 'cupe-local-123' })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('was not created by the pilot bootstrap'),
    });

    expect(m.tenant).not.toHaveBeenCalled();
    expect(m.apply).not.toHaveBeenCalled();
  });

  it('reports a rehearsal that finds no organization as one that would create it, and creates nothing', async () => {
    m.resolve.mockResolvedValue({ kind: 'would_create' });

    const result = await post({ dryRun: true });

    expect(m.resolve).toHaveBeenCalledWith('tx-system', expect.objectContaining({ dryRun: true }));
    expect(result).toMatchObject({ success: true, dryRun: true, organizationId: null, wouldCreateOrganization: true, planned: { members: 3, cases: 2 } });
    expect(m.tenant).not.toHaveBeenCalled();
  });

  it('reports what was actually done, not what the fixture attempted', async () => {
    const result = await post();

    expect(result.seeded).toEqual({ worksites: 0, worksitesAvailableInFixtureNotSeeded: 2, members: 2, cases: 1 });
    expect(result.alreadyPresent).toEqual({ members: 1, cases: 1 });
    expect(result.removed).toEqual({ members: 0, grievances: 0 });
    expect(result.onboarding).toEqual(done.onboarding);
    expect(result.organizationName).toBe('CUPE Local');
  });

  it('reports the removed rows of a reset and the ledger entries it cleared', async () => {
    m.apply.mockResolvedValue({ ...done, removed: { members: 3, grievances: 2 }, clearedStale: { members: 1, grievances: 0 } });

    const result = await post({ reset: true, confirmReset: 'cupe-local-123' });

    expect(result).toMatchObject({ reset: true, removed: { members: 3, grievances: 2 }, clearedStale: { members: 1, grievances: 0 } });
  });

  it('refuses a reset that would delete rows the bootstrap did not create, saying how many and that nothing changed', async () => {
    m.apply.mockResolvedValue({ kind: 'refused', reason: 'foreign_rows', foreign: { members: 2, grievances: 1 } });

    await expect(post({ reset: true, confirmReset: 'cupe-local-123' })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/2 member rows and 1 grievance rows.*Nothing was changed/),
    });
  });

  it('refuses a reset whose rows are still referenced by records the bootstrap did not create', async () => {
    m.apply.mockResolvedValue({ kind: 'refused', reason: 'dependent_rows', constraint: 'grievance_responses_grievance_id_fk' });

    const refusal = post({ reset: true, confirmReset: 'cupe-local-123' });

    await expect(refusal).rejects.toMatchObject({ status: 409, message: expect.stringContaining('still referenced') });
    await expect(refusal).rejects.not.toMatchObject({ message: expect.stringContaining('grievance_responses_grievance_id_fk') });
  });

  it('refuses an operator without an active membership in the organization, records that, and writes nothing', async () => {
    m.tenant.mockRejectedValue(new AuthOrgBindingError('MEMBERSHIP_REQUIRED'));

    await expect(post()).rejects.toMatchObject({ status: 403, message: expect.stringContaining('active membership') });

    expect(m.deny).toHaveBeenCalledWith('tx-system', {
      organizationId: 'org_fixture',
      userId: 'staff_1',
      runtimeMode: 'pilot',
      reason: 'membership_required',
      details: { code: 'MEMBERSHIP_REQUIRED' },
    });
    expect(m.apply).not.toHaveBeenCalled();
  });

  it('still refuses when the membership refusal itself cannot be recorded, and says so in the log', async () => {
    m.tenant.mockRejectedValue(new AuthOrgBindingError('MEMBERSHIP_REQUIRED'));
    m.deny.mockRejectedValue(new Error('audit store down'));

    await expect(post()).rejects.toMatchObject({ status: 403 });

    expect(m.logError).toHaveBeenCalledWith('pilot_fixture_denial_not_recorded', { error: 'audit store down' });
  });

  it('does not turn any other failure into a success, so a failed audit write leaves the request failed', async () => {
    m.tenant.mockRejectedValue(new Error('audit write failed'));

    await expect(post()).rejects.toThrow('audit write failed');

    expect(m.deny).not.toHaveBeenCalled();
  });

  it('omits the demo script unless asked for it', async () => {
    expect((await post({ includeDemoScript: false })).demoScript).toEqual([]);
    expect((await post({ includeDemoScript: true })).demoScript).toHaveLength(4);
  });
});
