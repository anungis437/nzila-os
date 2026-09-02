/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 11: AUTH_OFFBOARDING_RUNTIME_BEHAVIOR proof for
 * app/api/admin/users/[userId]/route.ts. PUT (active/inactive toggle)
 * already emitted `member.status_changed` (triggering
 * revokeAllUserSessions() + case-access revocation via
 * lib/events/pilot-event-listeners.ts) — but DELETE (soft-delete) did
 * NOT, leaving a soft-deleted member's session and case access active.
 * Fixed: DELETE now emits the same event with newStatus: 'deleted'.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  selectWhere: vi.fn(),
  updateWhere: vi.fn(),
  emitAndWait: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@nzila/os-core/telemetry', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));
vi.mock('@/db/schema', () => ({
  organizationMembers: { id: 'id', status: 'status', organizationId: 'organizationId', deletedAt: 'deletedAt', updatedAt: 'updatedAt' },
}));
vi.mock('@/db/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: m.selectWhere }) }) }),
    update: () => ({ set: () => ({ where: m.updateWhere }) }),
  },
}));
vi.mock('@/lib/events/event-bus', () => ({ eventBus: { emitAndWait: m.emitAndWait } }));

async function loadRoute() {
  return import('../route');
}

describe('admin users route — offboarding event parity between PUT and DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ADMIN_USER_IDS = 'platform-admin-1';
    m.auth.mockResolvedValue({ userId: 'platform-admin-1' });
    m.updateWhere.mockResolvedValue(undefined);
    m.emitAndWait.mockResolvedValue(undefined);
  });

  it('rejects a non-platform-admin caller on both PUT and DELETE', async () => {
    m.auth.mockResolvedValue({ userId: 'ordinary-org-admin' });
    const { PUT, DELETE } = await loadRoute();
    const params = Promise.resolve({ userId: 'member-1' });

    const putRes = await PUT({} as never, { params });
    const delRes = await DELETE({} as never, { params });

    expect(putRes.status).toBe(403);
    expect(delRes.status).toBe(403);
    expect(m.emitAndWait).not.toHaveBeenCalled();
  });

  it('PUT (active -> inactive) emits member.status_changed for session/case-access revocation', async () => {
    m.selectWhere.mockResolvedValue([{ status: 'active', organizationId: 'org-a' }]);
    const { PUT } = await loadRoute();

    const res = await PUT({} as never, { params: Promise.resolve({ userId: 'member-1' }) });

    expect(res.status).toBe(200);
    expect(m.emitAndWait).toHaveBeenCalledWith(
      'member.status_changed',
      expect.objectContaining({ userId: 'member-1', organizationId: 'org-a', oldStatus: 'active', newStatus: 'inactive' }),
    );
  });

  it('DELETE (soft-delete) ALSO emits member.status_changed — same offboarding enforcement as PUT', async () => {
    m.selectWhere.mockResolvedValue([{ status: 'active', organizationId: 'org-a' }]);
    const { DELETE } = await loadRoute();

    const res = await DELETE({} as never, { params: Promise.resolve({ userId: 'member-1' }) });

    expect(res.status).toBe(200);
    expect(m.emitAndWait).toHaveBeenCalledWith(
      'member.status_changed',
      expect.objectContaining({ userId: 'member-1', organizationId: 'org-a', oldStatus: 'active', newStatus: 'deleted' }),
    );
  });

  it('DELETE returns 404 without emitting the event when the member does not exist', async () => {
    m.selectWhere.mockResolvedValue([]);
    const { DELETE } = await loadRoute();

    const res = await DELETE({} as never, { params: Promise.resolve({ userId: 'ghost' }) });

    expect(res.status).toBe(404);
    expect(m.emitAndWait).not.toHaveBeenCalled();
    expect(m.updateWhere).not.toHaveBeenCalled();
  });
});
