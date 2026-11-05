/**
 * getEffectiveCaseAccess: only a genuine absence of access is NO_ACCESS.
 *
 * It used to catch every error and answer NO_ACCESS, so a database outage, a revoked privilege or a broken connection told a legitimate
 * caller they had no access to their own case (403/404) and hid the fault from every alert. Now a malformed case id, the kernel's own
 * "no such case" / "not the session principal" refusals and the organization's "not a member" refusals are the absence of access; every
 * other error reaches the route as the server fault it is.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ withRLSContext: vi.fn(), decideCase: vi.fn() }));

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/authority/store/route-adapter', () => ({
  decideCase: m.decideCase,
  drizzleExecutor: () => ({ query: async () => ({ rows: [] }) }),
  kernelDeps: {},
}));
vi.mock('@/lib/authority/store/lifecycle', () => ({ assignCase: vi.fn(), reassignCase: vi.fn(), revokeCaseAssignment: vi.fn() }));
vi.mock('@/db/schema/domains/claims/grievances', () => ({ grievances: {} }));

import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding';
import { AuthorityStoreError } from '@/lib/authority/store/executor';
import { getEffectiveCaseAccess } from '../case-access-service';

const ORG = '11111111-1111-4111-8111-111111111111';
const CASE = '22222222-2222-4222-8222-222222222222';
const params = { organizationId: ORG, grievanceId: CASE, userId: 'user-1' };

describe('getEffectiveCaseAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRLSContext.mockImplementation(async (_context: unknown, work: (tx: unknown) => Promise<unknown>) => work({}));
    m.decideCase.mockResolvedValue({ effect: 'deny' });
  });

  it('answers no access, without looking anything up, for an id that is not a uuid', async () => {
    for (const bad of ['', 'not-a-uuid', '123', `${CASE}; DROP TABLE grievances`]) {
      const access = await getEffectiveCaseAccess({ ...params, grievanceId: bad });
      expect(access.canViewCase, bad).toBe(false);
    }
    expect((await getEffectiveCaseAccess({ ...params, organizationId: 'org-1' })).canViewCase).toBe(false);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('answers no access when the kernel denies the read', async () => {
    const access = await getEffectiveCaseAccess(params);
    expect(access).toMatchObject({ canViewCase: false, isPrimaryOwner: false, accessRole: null });
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG }, expect.any(Function));
  });

  it.each([
    ['the kernel says there is no such case', new AuthorityStoreError('NOT_FOUND', 'no such case')],
    ['the actor is not the session principal', new AuthorityStoreError('DENIED', 'ACTOR_NOT_SESSION')],
    ['the caller is not a member of the organization', new AuthOrgBindingError('MEMBERSHIP_REQUIRED')],
    ['the caller lacks the role the organization requires', new AuthOrgBindingError('ROLE_REQUIRED')],
    ['the organization is not one the caller may act in', new AuthOrgBindingError('INVALID_ORGANIZATION')],
    ['the actor differs from the bound principal', new AuthOrgBindingError('ACTOR_MISMATCH')],
  ])('answers no access when %s', async (_label, error) => {
    m.withRLSContext.mockRejectedValueOnce(error);
    expect((await getEffectiveCaseAccess(params)).canViewCase).toBe(false);
  });

  it.each([
    ['the database is unreachable', new Error('connect ECONNREFUSED 127.0.0.1:5432')],
    ['a privilege was revoked', Object.assign(new Error('permission denied for table ue_authority_resource_relationships'), { code: '42501' })],
    ['the statement fails', Object.assign(new Error('syntax error at or near "FROM"'), { code: '42601' })],
    ['no session can be established', new AuthOrgBindingError('UNAUTHENTICATED')],
    ['the session authority is missing', new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')],
    ['the authority store rejects the context', new AuthorityStoreError('INVALID_CONTEXT', 'organizationId must be a uuid')],
    ['a transaction cannot be committed', new AuthorityStoreError('PRECONDITION', 'serialization failure')],
  ])('lets the fault reach the caller when %s, instead of reporting no access', async (_label, error) => {
    m.withRLSContext.mockRejectedValueOnce(error);
    await expect(getEffectiveCaseAccess(params)).rejects.toBe(error);
  });

  it('lets a failure inside the kernel decision reach the caller as well', async () => {
    m.decideCase.mockRejectedValueOnce(new Error('kernel storage unavailable'));
    await expect(getEffectiveCaseAccess(params)).rejects.toThrow('kernel storage unavailable');
  });
});
