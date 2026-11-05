import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  createVotingSession: vi.fn(),
  audit: vi.fn(),
  tx: {},
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod').z }));
vi.mock('@/lib/services/voting-service', () => ({ listVotingSessions: vi.fn(), createVotingSession: m.createVotingSession }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_org: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('drizzle-orm', () => ({ inArray: vi.fn(), count: vi.fn() }));
vi.mock('@/db/schema', () => ({ votingOptions: {}, votes: {} }));
vi.mock('@/db/db', () => ({ db: {} }));

const body = { title: 'Ratify', type: 'ratification', meetingType: 'general_membership' };

describe('voting/sessions POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.createVotingSession.mockResolvedValue({ id: 's1' });
    m.audit.mockResolvedValue(undefined);
  });

  it('records the creation on the same transaction as the session', async () => {
    const { POST } = await import('../voting/sessions/route');
    await expect((POST as any)({ body, organizationId: 'org_1', userId: 'u1' })).resolves.toEqual({ id: 's1' });
    expect(m.audit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'voting_session.create', resourceId: 's1' }),
    );
  });

  it('does not report the session as created when its audit cannot be written', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const { POST } = await import('../voting/sessions/route');
    await expect((POST as any)({ body, organizationId: 'org_1', userId: 'u1' })).rejects.toThrow('audit down');
  });
});
