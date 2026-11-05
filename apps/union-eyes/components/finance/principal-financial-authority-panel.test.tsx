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

// GET /api/dues/remittances returns { data: rows }; withApi wraps it as { success, data, timestamp }, so the rows arrive at data.data.
const answer = (rows: unknown[]) => ({ success: true, data: { data: rows }, timestamp: '2026-03-16T12:00:00.000Z' })
// A refused call carries the standard error body; the mandate's own reason is in `details.code` where the deployment sends details.
const refusal = (code: string, message: string, withDetails = true) => ({
  code: 'FORBIDDEN',
  message,
  timestamp: '2026-03-16T12:00:00.000Z',
  ...(withDetails ? { details: { code } } : {}),
})

describe('principal financial authority panel', () => {
  it('shows the remittances the mandate allows, read from the route envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => answer([{ id: 'r1', employerId: 'emp', totalAmount: '10.00', processingStatus: 'pending' }]) })),
    )
    renderPanel()
    expect(await screen.findByText('emp')).toBeInTheDocument()
    expect(screen.getByText('10.00')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('shows an empty ledger only when the route answered with no rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => answer([]) })))
    renderPanel()
    expect(await screen.findByText('No remittance is visible under your mandate.')).toBeInTheDocument()
  })

  it('does not read a bare { data: rows } body: a body that is not the route envelope is an error, not an empty ledger', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 'r1' }] }) })))
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response')
    expect(screen.queryByText('No remittance is visible under your mandate.')).not.toBeInTheDocument()
  })

  it('shows an error, not an empty ledger, when the request cannot be made', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('Failed to fetch'))))
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')
    expect(screen.queryByText('No remittance is visible under your mandate.')).not.toBeInTheDocument()
  })

  it('shows an unissued mandate and retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => refusal('FINANCIAL_MANDATES_NOT_ISSUED', 'No financial mandate is issued') })
      .mockResolvedValueOnce({ ok: true, json: async () => answer([]) })
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
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => refusal(code, 'refused') })))
      renderPanel()
      expect(await screen.findByRole('alert')).toHaveTextContent(text)
    }
  })

  it('states the server\'s own message when a refusal names no reason the page words', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403, json: async () => refusal('', 'You do not have the required role for this endpoint', false) })),
    )
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have the required role for this endpoint')
  })
})
