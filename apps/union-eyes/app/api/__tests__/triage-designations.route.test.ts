import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  grant: vi.fn(),
  caseEligible: vi.fn(),
  conversationEligible: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => handler,
}));
vi.mock('@/lib/api/errors', () => ({ ApiError: { badRequest: Error, forbidden: Error, notFound: Error } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: (op: (tx: unknown) => Promise<unknown>) => op({}) }));
vi.mock('@/lib/cases/case-authorization', () => ({
  getCaseActor: async () => ({ userId: 'admin-1', organizationId: 'org-1' }),
  caseAssigneeEligible: m.caseEligible,
}));
vi.mock('@/lib/triage/designations', () => ({
  grantDesignation: m.grant,
  listDesignations: vi.fn(),
  revokeDesignation: vi.fn(),
  conversationAssigneeEligible: m.conversationEligible,
}));

const future = () => new Date(Date.now() + 86_400_000).toISOString();

describe('triage-designations POST eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.caseEligible.mockResolvedValue(false);
    m.conversationEligible.mockResolvedValue(true);
    m.grant.mockImplementation(async (_tx: unknown, _actor: unknown, _input: unknown, deps: { assigneeEligible: (id: string) => Promise<boolean> }) => {
      await deps.assigneeEligible('designee-1');
      return { kind: 'ok', designation: { id: 'd1' } };
    });
  });

  // DEF-0B12-PLT-TRIAGE-GRANT-APPLIES-THE-CASE-ELIGIBILITY-TEST-TO-A-MESSAGES-DESIGNATION
  it('judges a messages designation as a conversation assignee, never by the case-note test', async () => {
    const { POST } = await import('../triage-designations/route');
    await (POST as any)({ body: { scope: 'messages', userId: 'designee-1', expiresAt: future() } });
    expect(m.conversationEligible).toHaveBeenCalledWith({}, 'org-1', 'designee-1');
    expect(m.caseEligible).not.toHaveBeenCalled();
  });

  it('judges a cases designation as a case assignee', async () => {
    const { POST } = await import('../triage-designations/route');
    await (POST as any)({ body: { scope: 'cases', userId: 'designee-1', expiresAt: future() } });
    expect(m.caseEligible).toHaveBeenCalledWith({}, { userId: 'admin-1', organizationId: 'org-1' }, 'designee-1');
    expect(m.conversationEligible).not.toHaveBeenCalled();
  });
});
