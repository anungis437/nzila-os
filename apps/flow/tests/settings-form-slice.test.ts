import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/app/(dashboard)/settings/settings-actions', () => ({
  saveGeneralSettingsAction: vi.fn(async () => ({ ok: true })),
  saveQuotePolicyAction: vi.fn(async () => ({ ok: true })),
  saveBrandingAction: vi.fn(async () => ({ ok: true })),
}))

describe('settings form slice', () => {
  it('renders settings form default tab fields and controls', async () => {
    const { SettingsForm } = await import('@/app/(dashboard)/settings/settings-form')

    const markup = renderToStaticMarkup(
      React.createElement(SettingsForm, {
        config: {
          settings: {
            currency: 'CAD',
            quoteValidityDays: 30,
            quotePrefix: 'QT',
            invoicePrefix: 'INV',
            poPrefix: 'PO',
            orderPrefix: 'ORD',
            shareLinkExpiryDays: 7,
            locale: 'en-CA',
            defaultShippingPolicy: 'FOB',
            taxConfig: { defaultRate: 0.15 },
          },
          branding: {
            orgId: 'org-1',
            companyName: 'Nzila',
            companyLegalName: 'Nzila Inc.',
            address: '123 Main St',
            supportEmail: 'support@nzila.io',
          },
          quotePolicy: {
            minMarginPercent: 10,
            approvalThresholdPercent: 25,
          },
        } as never,
      }),
    )

    expect(markup).toContain('Settings')
    expect(markup).toContain('General')
    expect(markup).toContain('Workspace')
    expect(markup).toContain('Default Currency')
    expect(markup).toContain('Quote Validity (days)')
    expect(markup).toContain('Reference Format')
    expect(markup).toContain('Preview: QT-2026-001')
  })
})
