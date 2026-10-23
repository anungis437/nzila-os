import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), canonical: vi.fn(), binding: vi.fn(), rls: vi.fn(), select: vi.fn(),
  legacySelect: vi.fn(() => { throw new Error('LEGACY_PROFILE_MUST_NOT_RUN') }),
  currentUser: vi.fn(), role: vi.fn(), organization: vi.fn(),
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth, currentUser: mocks.currentUser }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: mocks.canonical }))
vi.mock('@/lib/auth/canonical-context', () => ({ getCanonicalOrganizationContext: mocks.binding }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: mocks.rls }))
vi.mock('@/db/db', () => ({ db: { select: mocks.legacySelect } }))
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: mocks.role }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: mocks.organization,
  DEFAULT_ORGANIZATION_ID: 'default-org-must-not-be-used' }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error('REDIRECT:'+path) } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/components/sidebar', () => ({ default: () => null }))
vi.mock('@/components/cancellation-popup', () => ({ default: () => null }))
vi.mock('@/components/payment-success-popup', () => ({ default: () => null }))
vi.mock('@/components/organization/organization-selector', () => ({ OrganizationSelector: () => null }))
vi.mock('@/components/organization/organization-breadcrumb', () => ({ OrganizationBreadcrumb: () => null }))
vi.mock('@/components/language-switcher', () => ({ default: () => null }))
vi.mock('@/components/header-actions', () => ({ HeaderActions: () => null }))
vi.mock('@/components/dashboard/role-experience-guard', () => ({ default: () => null }))
vi.mock('@/contexts/pilot-mode-context', () => ({ PilotModeProvider: () => null }))
vi.mock('@/lib/hooks/use-feature-flags', () => ({ FeatureFlagProvider: () => null }))
vi.mock('@/components/onboarding/onboarding-provider', () => ({ OnboardingProvider: () => null }))
vi.mock('@/components/compliance/qc-bilingual-banner', () => ({ QcBilingualBanner: () => null }))

import DashboardLayout from '../layout'

describe('canonical dashboard admission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.canonical.mockReturnValue(true)
    mocks.auth.mockResolvedValue({ userId: 'platform-member' })
    mocks.binding.mockResolvedValue({ userId: 'platform-member', organizationId: 'actual-org',
      email: 'owned@example.test', role: 'member' })
    mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ provinceTerritory: 'ON' }] }) }) })
    mocks.rls.mockImplementation(async (_context, op) => op({ select: mocks.select }))
  })

  it('renders an explicitly bound member without a legacy billing profile or email relinking', async () => {
    expect(await DashboardLayout({ children: 'native-member-content' })).toBeTruthy()
    expect(mocks.binding).toHaveBeenCalledWith({ expectedActorUserId: 'platform-member' })
    expect(mocks.rls).toHaveBeenCalledWith({ organizationId: 'actual-org' }, expect.any(Function))
    expect(mocks.legacySelect).not.toHaveBeenCalled()
    expect(mocks.currentUser).not.toHaveBeenCalled()
    expect(mocks.organization).not.toHaveBeenCalled()
    expect(mocks.role).not.toHaveBeenCalled()
  })

  it('fails closed on revoked membership instead of defaulting to an organization or role', async () => {
    mocks.binding.mockRejectedValue(new Error('MEMBERSHIP_REQUIRED'))
    await expect(DashboardLayout({ children: 'protected' })).rejects.toThrow('MEMBERSHIP_REQUIRED')
    expect(mocks.rls).not.toHaveBeenCalled()
    expect(mocks.legacySelect).not.toHaveBeenCalled()
  })

  it('propagates a scoped organization query failure without opening the legacy provisioning path', async () => {
    mocks.rls.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(DashboardLayout({ children: 'protected' })).rejects.toThrow('database unavailable')
    expect(mocks.legacySelect).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated request before any profile or tenant query', async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null })
    await expect(DashboardLayout({ children: 'protected' })).rejects.toThrow('REDIRECT:/login')
    expect(mocks.binding).not.toHaveBeenCalled()
    expect(mocks.legacySelect).not.toHaveBeenCalled()
  })
})
