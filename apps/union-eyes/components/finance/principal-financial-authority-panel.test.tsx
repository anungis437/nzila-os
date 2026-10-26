// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en.json'
import fr from '../../messages/fr.json'
import { PrincipalFinancialAuthorityPanel } from './principal-financial-authority-panel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPanel(locale: 'en' | 'fr' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <PrincipalFinancialAuthorityPanel />
    </NextIntlClientProvider>,
  )
}

describe('principal financial authority panel', () => {
  it('shows remittances the mandate allows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 'r1', employerId: 'emp', totalAmount: '10.00', processingStatus: 'pending' }] }) })),
    )
    renderPanel()
    expect(await screen.findByText('emp')).toBeInTheDocument()
    expect(screen.getByText('10.00')).toBeInTheDocument()
  })

  it('shows an empty ledger', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })))
    renderPanel()
    expect(await screen.findByText('No remittance is visible under your mandate.')).toBeInTheDocument()
  })

  it('shows an unissued mandate and retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ details: { code: 'FINANCIAL_MANDATES_NOT_ISSUED' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel('fr')
    expect(await screen.findByRole('alert')).toHaveTextContent("Aucun mandat financier n'a été émis dans cette organisation.")
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText("Aucune remise n'est visible sous votre mandat.")).toBeInTheDocument()
  })

  it('shows duty, segregation and missing-record denials', async () => {
    for (const [code, text] of [
      ['DUTY_NOT_HELD', 'You do not hold this financial duty.'],
      ['SEGREGATION_OF_DUTIES', 'You already took part in this financial action.'],
      ['NOT_FOUND', 'That remittance is not available.'],
    ] as const) {
      cleanup()
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ details: { code } }) })))
      renderPanel()
      expect(await screen.findByRole('alert')).toHaveTextContent(text)
    }
  })
})
