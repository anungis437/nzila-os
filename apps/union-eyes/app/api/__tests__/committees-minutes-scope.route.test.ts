import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  requireCommitteeScope: vi.fn(),
  recordMinutes: vi.fn(),
  approveMinutes: vi.fn(),
  getMeeting: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/services/committee-workspace-service', () => ({
  requireCommitteeScope: m.requireCommitteeScope,
  recordMinutes: m.recordMinutes,
  approveMinutes: m.approveMinutes,
  getMeeting: m.getMeeting,
}));

const ctx = { organizationId: 'org_1', userId: 'u1', params: { id: 'c1', meetingId: 'm1' } };

describe('committees/[id]/meetings/[meetingId]/minutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.requireCommitteeScope.mockResolvedValue(undefined);
  });

  it('is scoped to the caller organization and committee before anything is written', async () => {
    const { POST } = await import('../committees/[id]/meetings/[meetingId]/minutes/route');
    m.recordMinutes.mockResolvedValue({ id: 'm1' });
    await (POST as any)({ ...ctx, body: { minutes: 'text' } });
    expect(m.requireCommitteeScope).toHaveBeenCalledWith('org_1', 'c1', { meetingId: 'm1' });
  });

  it('writes nothing for another organization\'s meeting', async () => {
    m.requireCommitteeScope.mockRejectedValue(Object.assign(new Error('Meeting not found'), { code: 'NOT_FOUND' }));
    const { POST, PATCH } = await import('../committees/[id]/meetings/[meetingId]/minutes/route');
    await expect((POST as any)({ ...ctx, body: { minutes: 'text' } })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect((PATCH as any)(ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.recordMinutes).not.toHaveBeenCalled();
    expect(m.approveMinutes).not.toHaveBeenCalled();
  });

  it('refuses to change or re-approve approved minutes', async () => {
    const { POST, PATCH } = await import('../committees/[id]/meetings/[meetingId]/minutes/route');
    m.recordMinutes.mockResolvedValue(null);
    await expect((POST as any)({ ...ctx, body: { minutes: 'edit' } })).rejects.toMatchObject({ code: 'CONFLICT' });

    m.getMeeting.mockResolvedValue({ id: 'm1', minutes: 'text' });
    m.approveMinutes.mockResolvedValue(null);
    await expect((PATCH as any)(ctx)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuses a request without an organization context', async () => {
    const { POST } = await import('../committees/[id]/meetings/[meetingId]/minutes/route');
    await expect((POST as any)({ ...ctx, organizationId: null, body: { minutes: 'x' } })).rejects.toThrow('Organization context required');
    expect(m.recordMinutes).not.toHaveBeenCalled();
  });
});
