// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import '@testing-library/jest-dom/vitest'
import en from '../../messages/en-CA.json'
import fr from '../../messages/fr-CA.json'
import { CaseStatusActions } from './case-status-actions'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const answers = (body: unknown, ok = true) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => body })),
  )
const show = (locale: 'en-CA' | 'fr-CA', onTransition = vi.fn(), canClose = true) => {
  const messages = locale === 'en-CA' ? en : fr
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CaseStatusActions
        caseId="synthetic-case"
        sourceStatus="resolved"
        canClose={canClose}
        disabled={false}
        onTransition={onTransition}
      />
    </NextIntlClientProvider>,
  )
  return { messages: messages.workbench, onTransition }
}
describe.each(['en-CA', 'fr-CA'] as const)('server-qualified case status controls %s', (locale) => {
  it('offers and submits the server-approved closure from a resolved case', async () => {
    answers({ caseId: 'synthetic-case', currentStatus: 'resolved', allowedTransitions: ['closed'] })
    const { messages, onTransition } = show(locale)
    const control = await screen.findByRole('combobox', { name: messages.updateStatusLabel })
    expect(screen.getByRole('option', { name: messages.statusOptions.closed })).toBeVisible()
    expect(screen.queryByRole('option', { name: messages.statusOptions.investigation })).toBeNull()
    await userEvent.selectOptions(control, 'closed')
    expect(onTransition).toHaveBeenCalledExactlyOnceWith('closed')
  })
  it('keeps an empty permission result explicit without inventing actions', async () => {
    answers({ caseId: 'synthetic-case', currentStatus: 'resolved', allowedTransitions: [] })
    const { messages } = show(locale)
    expect(await screen.findByText(messages.statusActionsEmpty)).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
  it('also honors the workbench close-power boundary', async () => {
    answers({ caseId: 'synthetic-case', currentStatus: 'resolved', allowedTransitions: ['closed'] })
    const { messages } = show(locale, vi.fn(), false)
    expect(await screen.findByText(messages.statusActionsEmpty)).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
  it('shows an actual loading state while the source query is pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )
    const { messages } = show(locale)
    expect(screen.getByRole('status')).toHaveTextContent(messages.statusActionsLoading)
    expect(screen.queryByRole('combobox')).toBeNull()
  })
  it('refuses stale state until the workbench is reloaded', async () => {
    answers({ caseId: 'synthetic-case', currentStatus: 'closed', allowedTransitions: [] })
    const { messages } = show(locale)
    expect(await screen.findByText(messages.statusActionsStale)).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
  it.each([
    { caseId: 'another-case', currentStatus: 'resolved', allowedTransitions: ['closed'] },
    { caseId: 'synthetic-case', currentStatus: 'resolved', allowedTransitions: ['arbitration'] },
    {
      caseId: 'synthetic-case',
      currentStatus: 'resolved',
      allowedTransitions: ['closed'],
      success: false,
    },
  ])('refuses a foreign, unsupported or failed action response', async (body) => {
    answers(body)
    const { messages } = show(locale)
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(messages.statusActionsUnavailable),
    )
    expect(screen.queryByRole('combobox')).toBeNull()
  })
  it('shows a failed source query without an enabled status control', async () => {
    answers({}, false)
    const { messages } = show(locale)
    expect(await screen.findByText(messages.statusActionsUnavailable)).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
