import { beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ user: vi.fn(), minRole: vi.fn(), dashboard: vi.fn() }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('@/lib/api-auth-guard', () => ({ requireUser: h.user, hasMinRole: h.minRole }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error('REDIRECT:' + path) } }))
vi.mock('../correspondence-dashboard', () => ({ CorrespondenceDashboard: h.dashboard }))
import Page from '../page'

beforeEach(() => { vi.clearAllMocks(); h.minRole.mockResolvedValue(false) })
describe('letter page uses the same explicit local staff boundary', () => {
  it('renders the Clerk page while signing remains unavailable', async () => {
    h.user.mockResolvedValue({ userId: 'clerk-a', organizationId: 'org-a', roles: ['clerk'] })
    const page = await Page({ params: Promise.resolve({ locale: 'fr-CA' }) })
    const dashboard = page.props.children[1]
    expect(dashboard.props).toMatchObject({ userId: 'clerk-a', userRole: 'clerk', canSign: false })
    expect(h.minRole).toHaveBeenCalledExactlyOnceWith('officer')
  })
  it.each(['member', 'app_owner', 'support_agent', 'unknown_role'])('redirects %s from the tenant letter page', async role => {
    h.user.mockResolvedValue({ userId: 'actor', organizationId: 'org-a', roles: [role] })
    await expect(Page({ params: Promise.resolve({ locale: 'en-CA' }) })).rejects.toThrow('REDIRECT:/dashboard')
    expect(h.minRole).not.toHaveBeenCalled()
  })
})
