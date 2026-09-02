import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ getUserRoleInOrganization: vi.fn() }));
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: m.getUserRoleInOrganization }));

import { hasInstitutionalTopologyAccess } from '../access';

describe('hasInstitutionalTopologyAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['clc_staff', 'clc_executive', 'system_admin'])(
    'allows role %s',
    async (role) => {
      m.getUserRoleInOrganization.mockResolvedValue(role);
      await expect(hasInstitutionalTopologyAccess('u1', 'org1')).resolves.toBe(true);
    },
  );

  it.each(['member', 'steward', 'chief_steward', 'admin', 'coo', 'platform_lead', ''])(
    'denies role %s',
    async (role) => {
      m.getUserRoleInOrganization.mockResolvedValue(role);
      await expect(hasInstitutionalTopologyAccess('u1', 'org1')).resolves.toBe(false);
    },
  );

  it('denies (fail closed) when getUserRoleInOrganization throws', async () => {
    m.getUserRoleInOrganization.mockRejectedValue(new Error('db error'));
    await expect(hasInstitutionalTopologyAccess('u1', 'org1')).resolves.toBe(false);
  });

  it('denies when no role is found (null/undefined)', async () => {
    m.getUserRoleInOrganization.mockResolvedValue(null);
    await expect(hasInstitutionalTopologyAccess('u1', 'org1')).resolves.toBe(false);
  });
});
