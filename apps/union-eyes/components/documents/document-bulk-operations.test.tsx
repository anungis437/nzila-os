// @vitest-environment jsdom
// What the bulk bar tells a person about an action it ran: its words in the page language, a failed or not-completed action shown as such (never as
// finished), and the selection kept unless the action reported that it completed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { DocumentBulkOperations } from './document-bulk-operations'

const settings = vi.hoisted(() => ({ locale: 'en-CA' }))
vi.mock('next-intl', () => ({ useLocale: () => settings.locale }))

beforeEach(() => { settings.locale = 'en-CA'; vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers() })

async function run(handler: () => Promise<void | boolean>, clear = vi.fn()) {
  render(<DocumentBulkOperations selectedCount={2} onClearSelection={clear} onBulkDownload={handler} />)
  fireEvent.click(screen.getByRole('button', { name: /^(Download|Télécharger)$/ }))
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: /^(Download|Télécharger)$/ }).at(-1)!) })
  await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
  return clear
}

describe('DocumentBulkOperations', () => {
  it('is worded in French on a French page, and does not promise a ZIP file', async () => {
    settings.locale = 'fr-CA'
    render(<DocumentBulkOperations selectedCount={2} onClearSelection={vi.fn()} onBulkDownload={async () => undefined} onBulkShare={async () => undefined} />)
    expect(screen.getByText('2 sélectionnés')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Télécharger' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Partager' })).toBeInTheDocument()
    expect(screen.queryByText(/selected|Download|Share/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    expect(screen.getByText(/Chacun des 2 documents/)).toBeInTheDocument()
    expect(screen.queryByText(/ZIP/)).toBeNull()
  })

  it('clears the selection only after an action that completed', async () => {
    const clear = await run(async () => undefined)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('keeps the selection and says so when the action reports that it did not complete', async () => {
    const clear = await run(async () => false)
    expect(clear).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('The action was not completed.')
  })

  it('shows a failure in the page language, never the exception text, and keeps the selection', async () => {
    settings.locale = 'fr-CA'
    const clear = await run(async () => { throw new Error('ECONNRESET at socket.js:41') })
    expect(clear).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('L’action n’a pas pu être effectuée.')
    expect(alert).not.toHaveTextContent(/ECONNRESET/)
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
