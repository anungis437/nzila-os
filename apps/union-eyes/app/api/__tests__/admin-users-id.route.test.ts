import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  resolveOrganizationAccess: vi.fn(),
  databaseCalled: vi.fn(),
}));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveOrganizationAccess,
  isAdministrativeRole: (role?: string) => role === 'admin',
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.databaseCalled,
}));
vi.mock('@nzila/os-core/telemetry', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe('admin/users/[userId] private membership access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'platform-only' });
    m.resolveOrganizationAccess.mockResolvedValue({
      platform: true, direct: new Map(), descendants: new Set(),
    });
  });
  it.each(['PUT', 'DELETE'] as const)('%s denies platform-only users before any privileged database operation', async (method) => {
    const route = await import('../admin/users/[userId]/route');
    const response = await route[method]({} as never, { params: Promise.resolve({ userId: 'membership' }) });
    expect(response.status).toBe(403);
    expect(m.databaseCalled).not.toHaveBeenCalled();
  });
});
