import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), organization: vi.fn(), role: vi.fn() }));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: mocks.organization, DEFAULT_ORGANIZATION_ID: 'unused' }));
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: mocks.role }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock('@/components/dashboard/operational-shell', () => ({ OperationalShell: () => null }));
vi.mock('@/components/mobile/OfflineBanner', () => ({ OfflineBanner: () => null }));

import MobileLayout from '../layout';
import MobileEntry from '../page';
import DashboardEntry from '../../dashboard/page';
import { OperationalShell } from '@/components/dashboard/operational-shell';

describe('mobile shared presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'owned-member' });
    mocks.organization.mockResolvedValue('owned-org');
    mocks.role.mockResolvedValue('officer');
  });

  it('passes the existing server-resolved role into the same operational shell', async () => {
    const element = await MobileLayout({ children: 'mobile-content' });
    expect(mocks.organization).toHaveBeenCalledWith('owned-member');
    expect(mocks.role).toHaveBeenCalledWith('owned-member', 'owned-org');
    expect(element.type).toBe(OperationalShell);
    expect(element.props.userRole).toBe('officer');
    expect(element.props.children).toContain('mobile-content');
  });

  it('keeps unauthenticated users out before resolving organization or role', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(MobileLayout({ children: 'protected' })).rejects.toThrow('REDIRECT:/login');
    expect(mocks.organization).not.toHaveBeenCalled();
    expect(mocks.role).not.toHaveBeenCalled();
  });

  it('uses the canonical role entry instead of a separate sample dashboard', () => {
    expect(MobileEntry).toBe(DashboardEntry);
  });
});
