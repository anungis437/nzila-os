// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import frCA from '../../messages/fr-CA.json'
import { MemberDocuments, parseDocumentList } from './member-documents'

const documents = [
  { id: 'doc-1', title: 'Signed grievance form', documentType: 'grievance_form', privacyLabel: 'team_confidential', createdAt: '2026-04-30T12:00:00Z', uploadedBy: 'someone' },
  { id: 'doc-2', title: 'Member handbook', documentType: 'handbook', privacyLabel: 'public_internal', createdAt: '2026-04-29T12:00:00Z' },
]

function ok(data: unknown) { return Promise.resolve({ ok: true, json: async () => data }) }
function renderDocs(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <MemberDocuments />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => { vi.stubGlobal('open', vi.fn()) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('MemberDocuments', () => {
  it('lists documents with a localized source label and no uploader identity', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ success: true, data: documents })))
    renderDocs()
    expect((await screen.findAllByText('Signed grievance form')).length).toBeGreaterThan(0)
    expect(screen.getByText('Your document')).toBeInTheDocument()
    expect(screen.getByText('Shared by your union')).toBeInTheDocument()
    expect(screen.getByText('Grievance form')).toBeInTheDocument()
    expect(screen.queryByText('someone')).not.toBeInTheDocument()
    expect(screen.queryByText(/grievance_form/)).not.toBeInTheDocument()
  })

  it('shows an honest empty state, localized', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ success: true, data: [] })))
    renderDocs('fr-CA')
    expect(await screen.findByText('Aucun document pour le moment')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('shows a retryable error when the list cannot load', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockImplementationOnce(() => ok({ success: true, data: documents }))
    vi.stubGlobal('fetch', fetchMock)
    renderDocs()
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load your documents")
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Member handbook')).length).toBeGreaterThan(0)
  })

  it('opens the download URL, and says so plainly when none is available', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/documents/repository') return ok({ success: true, data: documents })
      if (url.includes('doc-1')) return ok({ success: true, data: { downloadUrl: 'https://files.example.test/a.pdf' } })
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderDocs()
    await screen.findAllByText('Signed grievance form')
    fireEvent.click(screen.getByRole('button', { name: /Download Signed grievance form/ }))
    await waitFor(() => expect(window.open).toHaveBeenCalledWith('https://files.example.test/a.pdf', '_blank', 'noopener,noreferrer'))
    fireEvent.click(screen.getByRole('button', { name: /Download Member handbook/ }))
    expect(await screen.findByText("This file isn't available for download right now.")).toBeInTheDocument()
  })
})

describe('parseDocumentList', () => {
  it('accepts flat, enveloped and nested shapes and drops rows without an id', () => {
    const row = { id: 'x', title: 'T', createdAt: '2026-01-01' }
    expect(parseDocumentList([row])).toHaveLength(1)
    expect(parseDocumentList({ data: [row] })).toHaveLength(1)
    expect(parseDocumentList({ data: { data: [row, { title: 'no id' }] } })).toHaveLength(1)
    expect(parseDocumentList(null)).toEqual([])
    expect(parseDocumentList({ data: 'nope' })).toEqual([])
  })
})
