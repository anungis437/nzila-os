// @vitest-environment jsdom
/**
 * The jurisdiction preferences form reads the member's saved preferences from GET /api/precedents/jurisdiction-preferences, which the framework wraps as { success, data, timestamp }.
 * When they cannot be read the form would show defaults that are not the member's own, and saving them would overwrite the real ones: so it says so and turns saving off.
 * A refused save says why in the server's words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({ toast: vi.fn() }))

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }))

import { JurisdictionPreferences } from '../JurisdictionPreferences'

const fetchMock = vi.fn()

const wrapped = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data, timestamp: 'now' }) })
const failed = (status: number, message: string) => ({ ok: false, status, json: async () => ({ code: 'FAILED', message, timestamp: 'now', traceId: 't' }) })

const saved = { preferredJurisdictions: ['ON', 'QC'], preferredLevels: ['provincial'], includeNational: false, autoApply: true, isConfigured: true }

beforeEach(() => {
  fetchMock.mockReset()
  h.toast.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('JurisdictionPreferences', () => {
  it('shows the saved preferences the route answers under data', async () => {
    fetchMock.mockResolvedValueOnce(wrapped(saved))
    render(<JurisdictionPreferences />)
    expect(await screen.findByText('Configured')).toBeInTheDocument()
    expect(screen.getByText(/2 jurisdictions, 1 level selected/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('turns saving off, and says why, when the saved preferences could not be read', async () => {
    fetchMock.mockResolvedValueOnce(failed(500, 'The preferences store is unavailable'))
    render(<JurisdictionPreferences />)
    expect(await screen.findByRole('alert')).toHaveTextContent('saving is turned off')
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats an answer that is not the preferences the same way, instead of showing defaults as if they were the member\'s', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => saved })
    render(<JurisdictionPreferences />)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeDisabled()
    expect(screen.queryByText('Configured')).toBeNull()
  })

  it('says why a save was refused, in the server\'s words, and sends the selections with PUT', async () => {
    fetchMock.mockResolvedValueOnce(wrapped(saved)).mockResolvedValueOnce(failed(403, 'Preferences cannot be changed by this role'))
    render(<JurisdictionPreferences />)
    await screen.findByText('Jurisdiction Level')
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }))
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error saving preferences', description: 'Preferences cannot be changed by this role' })))
    const [url, init] = fetchMock.mock.calls[1] as [string, { method: string; body: string }]
    expect(url).toBe('/api/precedents/jurisdiction-preferences')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ preferredJurisdictions: ['ON', 'QC'], preferredLevels: ['provincial'], includeNational: false, autoApply: true })
  })
})
