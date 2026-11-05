import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock('@/lib/api-auth-guard', () => ({ requireUser: mocks.requireUser }));
vi.mock('next/navigation', () => ({
  redirect: (location: string) => {
    throw new Error(`REDIRECT:${location}`);
  },
}));

import { isUuid, requireOrganizationScope } from '../organization-scope';
import { isUuid as isUuidDirect } from '../uuid';

const ORG = '4f0d6b5e-8a52-4c5e-9d0e-2f3b8d9a1c11';

beforeEach(() => vi.clearAllMocks());

describe('isUuid', () => {
  it('accepts the uuids PostgreSQL accepts, in either case', () => {
    expect(isUuid(ORG)).toBe(true);
    expect(isUuid(ORG.toUpperCase())).toBe(true);
  });

  it('refuses everything else: it names no row', () => {
    for (const value of ['platform', 'org_2abc', '', ORG.slice(1), `${ORG}0`, null, undefined, 42, {}]) {
      expect(isUuid(value), String(value)).toBe(false);
    }
  });

  it('is the one definition the scope helper re-exports', () => {
    expect(isUuid).toBe(isUuidDirect);
  });
});

describe('requireOrganizationScope', () => {
  it('returns the signed-in user and the organization of the verified membership', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', organizationId: ORG, role: 'member' });

    expect(await requireOrganizationScope()).toEqual({ userId: 'user-1', organizationId: ORG });
  });

  it('sends a platform administrator who belongs to no organization back to the dashboard, with nothing read', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'admin-1', organizationId: 'platform' });

    await expect(requireOrganizationScope()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('sends a user with no organization back to the dashboard', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', organizationId: undefined });

    await expect(requireOrganizationScope()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('lets the failure of the identity itself propagate, never as an empty scope', async () => {
    mocks.requireUser.mockRejectedValue(new Error('Unauthorized'));

    await expect(requireOrganizationScope()).rejects.toThrow('Unauthorized');
  });
});
