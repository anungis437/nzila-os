// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ requireUser: vi.fn(), hasMinRole: vi.fn(), canManage: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/api-auth-guard', () => ({ requireUser: m.requireUser, hasMinRole: m.hasMinRole }));
vi.mock('@nzila/platform-auth/invites', () => ({ canManageOrganizationInvites: m.canManage }));
vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/components/admin/members-console', () => ({ default: () => null }));
vi.mock('@/components/admin/organization-invitations', () => ({ default: () => null }));
import Page from './page';
import Invites from '@/components/admin/organization-invitations';
import PlatformMembers from '@/components/admin/members-console';
beforeEach(() => {
  vi.clearAllMocks(); m.requireUser.mockResolvedValue({ userId: 'admin-a', organizationId: 'org-a' });
  m.canManage.mockResolvedValue(false); m.hasMinRole.mockResolvedValue(false);
  m.redirect.mockImplementation(() => { throw new Error('REDIRECT'); });
});
describe('organization member administration entry', () => {
  it('renders the tenant invitation console for a direct admin without platform-support rank', async () => {
    m.canManage.mockResolvedValue(true);
    expect((await Page()).type).toBe(Invites);
    expect(m.canManage).toHaveBeenCalledWith('admin-a', 'org-a');
    expect(m.hasMinRole).not.toHaveBeenCalled();
  });
  it('keeps platform support on its separate console without granting invitation controls', async () => {
    m.hasMinRole.mockResolvedValue(true);
    expect((await Page()).type).toBe(PlatformMembers);
    expect(m.hasMinRole).toHaveBeenCalledWith('support_manager');
  });
  it('rejects a role with neither direct admin membership nor support authority', async () => {
    await expect(Page()).rejects.toThrow('REDIRECT');
    expect(m.redirect).toHaveBeenCalledWith('/dashboard');
  });
});
