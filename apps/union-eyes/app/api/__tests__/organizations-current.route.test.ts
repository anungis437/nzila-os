import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  canRead: vi.fn(),
  canAdminister: vi.fn(),
  row: {} as Record<string, unknown>,
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: vi.fn() }));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.access,
  canReadOrganization: m.canRead,
  canAdministerOrganization: m.canAdminister,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: (_ctx: unknown, op: () => Promise<unknown>) => op() }));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'id' } }));
vi.mock('@/db/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([m.row]) }) }) }),
    execute: vi.fn(async () => [{ total: 1, active: 1, cnt: 0 }]),
  },
}));

const ORG = '11111111-1111-4111-8111-111111111111';

describe('organizations/current', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1', orgId: ORG });
    m.access.mockResolvedValue({});
    m.canRead.mockReturnValue(true);
    m.canAdminister.mockReturnValue(false);
    m.row = {
      id: ORG, name: 'Local 1', slug: 'local-1', subscriptionTier: 'pro', billingContactId: 'billing-user',
      settings: { secret: 'x' }, createdBy: 'creator', legacyOrgId: 'legacy', featuresEnabled: [],
    };
  });

  // DEF-0B9-ORG-CURRENT-ROW-READ-AT-ANY-MEMBER-FLOOR-RETURNS-SETTINGS-AND-BILLING-CONTACT
  it('returns no settings, billing contact, tier or provenance to a member who is not an administrator', async () => {
    const { GET } = await import('../organizations/current/route');
    const body = await (await GET()).json();
    expect(body.data.name).toBe('Local 1');
    for (const key of ['settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'legacy_org_id']) expect(body.data).not.toHaveProperty(key);
  });

  it('returns them to an administrator of the organization', async () => {
    m.canAdminister.mockReturnValue(true);
    const { GET } = await import('../organizations/current/route');
    const body = await (await GET()).json();
    expect(body.data.billing_contact_id).toBe('billing-user');
    expect(body.data.settings).toEqual({ secret: 'x' });
  });

  it('answers 404 to someone who holds no membership in the organization', async () => {
    m.canRead.mockReturnValue(false);
    const { GET } = await import('../organizations/current/route');
    expect((await GET()).status).toBe(404);
  });
});
