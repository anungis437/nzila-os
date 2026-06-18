import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockResolveOrgContext,
  mockRevalidatePath,
  mockUpsertOrgSettings,
  mockUpsertOrgQuotePolicy,
  mockUpsertOrgBranding,
  mockEmitConfigChange,
} = vi.hoisted(() => ({
  mockResolveOrgContext: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockUpsertOrgSettings: vi.fn(),
  mockUpsertOrgQuotePolicy: vi.fn(),
  mockUpsertOrgBranding: vi.fn(),
  mockEmitConfigChange: vi.fn(),
}))

vi.mock('@/lib/resolve-org', () => ({ resolveOrgContext: mockResolveOrgContext }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@nzila/platform-commerce-org/service', () => ({
  upsertOrgSettings: mockUpsertOrgSettings,
  upsertOrgQuotePolicy: mockUpsertOrgQuotePolicy,
  upsertOrgBranding: mockUpsertOrgBranding,
}))
vi.mock('@/lib/config-events', () => ({ emitConfigChange: mockEmitConfigChange }))

describe('settings actions slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1', actorId: 'user-1' })
    mockUpsertOrgSettings.mockResolvedValue({ changeEvent: 'settings-updated' })
    mockUpsertOrgQuotePolicy.mockResolvedValue({ changeEvent: 'policy-updated' })
    mockUpsertOrgBranding.mockResolvedValue({ changeEvent: 'branding-updated' })
  })

  it('covers success and failure branches for settings saves', async () => {
    const mod = await import('@/app/(dashboard)/settings/settings-actions')

    await expect(mod.saveGeneralSettingsAction({ currency: 'USD' } as never)).resolves.toEqual({ ok: true })
    expect(mockEmitConfigChange).toHaveBeenCalledWith('settings-updated')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')

    await expect(mod.saveQuotePolicyAction({ marginFloor: 0.2 } as never)).resolves.toEqual({ ok: true })
    expect(mockEmitConfigChange).toHaveBeenCalledWith('policy-updated')

    await expect(mod.saveBrandingAction({ companyName: 'Nzila' } as never)).resolves.toEqual({ ok: true })
    expect(mockEmitConfigChange).toHaveBeenCalledWith('branding-updated')

    mockUpsertOrgSettings.mockRejectedValueOnce(new Error('settings failed'))
    await expect(mod.saveGeneralSettingsAction({ currency: 'EUR' } as never)).resolves.toEqual({ ok: false, error: 'settings failed' })

    mockUpsertOrgQuotePolicy.mockRejectedValueOnce(new Error('policy failed'))
    await expect(mod.saveQuotePolicyAction({ marginFloor: 0.3 } as never)).resolves.toEqual({ ok: false, error: 'policy failed' })

    mockUpsertOrgBranding.mockRejectedValueOnce(new Error('branding failed'))
    await expect(mod.saveBrandingAction({ companyName: 'Other' } as never)).resolves.toEqual({ ok: false, error: 'branding failed' })
  })
})
