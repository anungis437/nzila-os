import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  canonical: vi.fn(),
  rows: [] as unknown[][],
  contexts: [] as Array<Record<string, unknown>>,
  getOrganizationIdForUser: vi.fn(),
  getOrganizationInfo: vi.fn(),
  getUserRole: vi.fn(),
  choices: vi.fn(),
}));

function makeChain() {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => (m.rows.shift() ?? []) as unknown[]),
  };
  return chain;
}

const mockTx = {
  select: vi.fn(() => makeChain()),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth, currentUser: m.currentUser }));
// The ambient handle must never be used: a profile is read in the person's own user context.
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get() { throw new Error('ambient db used outside a context'); } }) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (context: Record<string, unknown>, operation: (tx: typeof mockTx) => Promise<unknown>) => {
    m.contexts.push(context);
    return operation(mockTx);
  }),
}));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
  getOrganizationInfo: m.getOrganizationInfo,
}));
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: m.getUserRole }));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: m.canonical }));
vi.mock('@/lib/auth/canonical-organization-selection', () => ({
  getCanonicalOrganizationChoices: m.choices,
  canonicalOrganizationError: vi.fn(() => new Response(JSON.stringify({ error: 'denied' }), { status: 403 })),
}));

const ORG = '11111111-1111-4111-8111-111111111111';

async function loadRoute() {
  return import('../users/me/profile/route');
}

describe('users/me/profile route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rows = [];
    m.contexts = [];
    m.canonical.mockReturnValue(false);
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.currentUser.mockResolvedValue({
      fullName: 'Pat Member',
      emailAddresses: [{ emailAddress: 'pat@example.com' }],
      primaryPhoneNumber: { phoneNumber: '+15550100' },
    });
    m.getOrganizationIdForUser.mockResolvedValue(ORG);
    m.getOrganizationInfo.mockResolvedValue({ id: ORG, name: 'Local 1', slug: 'local-1', type: 'union' });
    m.getUserRole.mockResolvedValue('steward');
  });

  it('answers 401 when nobody is signed in, before any context is opened', async () => {
    m.auth.mockResolvedValueOnce({ userId: null });
    const { GET } = await loadRoute();

    const response = await GET();

    expect(response.status).toBe(401);
    expect(m.contexts).toEqual([]);
  });

  it('reads the profile of the signed-in person in their own user context, with no organization', async () => {
    m.rows.push([{ id: 'p1', membership: 'pro', status: 'active', usageCredits: 1000, userId: 'user_1' }]);
    const { GET } = await loadRoute();

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(m.contexts).toEqual([{ organizationId: 'system', userId: 'user_1' }]);
    expect(payload.user).toEqual({ id: 'user_1', name: 'Pat Member', email: 'pat@example.com', phone: '+15550100' });
    // Only the identifier is served: the row's plan, credit and payment-status columns belong to a retired product and mean nothing here.
    expect(payload.profile).toEqual({ id: 'p1' });
    expect(payload.organization).toEqual({ id: ORG, name: 'Local 1', slug: 'local-1', type: 'union' });
    expect(payload.role).toBe('steward');
    expect(mockTx.select).toHaveBeenCalledTimes(1);
  });

  it('never relinks a profile to the caller by e-mail address: a missing profile is reported as null and nothing is written', async () => {
    // Another person's profile carries the caller's e-mail address; it must not be read by e-mail, moved, or returned.
    m.rows.push([], [{ id: 'other', userId: 'someone-else', email: 'pat@example.com' }]);
    const { GET } = await loadRoute();

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile).toBeNull();
    expect(mockTx.select).toHaveBeenCalledTimes(1);
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it('defaults the role to member when the person has no organization', async () => {
    m.rows.push([]);
    m.getOrganizationIdForUser.mockResolvedValueOnce(null);
    const { GET } = await loadRoute();

    const payload = await (await GET()).json();

    expect(payload.organization).toBeNull();
    expect(payload.role).toBe('member');
    expect(m.getUserRole).not.toHaveBeenCalled();
  });

  it('does not turn a database failure into an empty profile', async () => {
    mockTx.select.mockImplementationOnce(() => { throw new Error('connection reset'); });
    const { GET } = await loadRoute();

    await expect(GET()).rejects.toThrow('connection reset');
  });

  it('the canonical branch answers from the private actor and opens no database context of its own', async () => {
    m.canonical.mockReturnValue(true);
    m.choices.mockResolvedValue({
      activeOrganizationId: ORG,
      organizations: [{ id: ORG, name: 'Local 1', slug: 'local-1', type: 'union' }],
      memberships: [{ organizationId: ORG, userId: 'user_1', role: 'member' }],
      organizationAuthority: 'canonical',
    });
    const { GET } = await loadRoute();

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile).toBeNull();
    expect(payload.role).toBe('member');
    expect(m.contexts).toEqual([]);
  });
});
