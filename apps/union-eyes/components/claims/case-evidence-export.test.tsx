// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createHash, webcrypto } from 'node:crypto'
import '@testing-library/jest-dom/vitest'
import { buildEvidencePackage, buildEvidencePdf } from '@/lib/evidence-export'
import { CaseEvidenceExport } from './case-evidence-export'

const language = vi.hoisted(() => ({ locale: 'en-CA' }))
vi.mock('next-intl', () => ({ useLocale: () => language.locale }))
const CASE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ACTOR = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const props = { caseId: CASE, organizationId: ORG, actorId: ACTOR, allowed: true }
const downloads: Array<{ filename: string; url: string }> = []
const created = vi.fn((_blob: Blob | MediaSource) => 'blob:controlled-case-export')
const revoked = vi.fn()
function envelope() {
  return buildEvidencePackage({ caseId: CASE, organizationId: ORG, exportedBy: ACTOR,
    caseRecord: { claimId: CASE, organizationId: ORG, description: 'Synthetic case' }, notes: [], auditTrail: [] })
}
async function response() {
  const pkg = envelope(), locale = language.locale.startsWith('fr') ? 'fr-CA' : 'en-CA'
  const bytes = await buildEvidencePdf(pkg, locale)
  return new Response(new Uint8Array(bytes), { headers: {
    'content-type': 'application/pdf', 'content-digest': `sha-256=:${createHash('sha256').update(bytes).digest('base64')}:`,
    'x-evidence-case-id': CASE, 'x-evidence-organization-id': ORG, 'x-evidence-actor-id': ACTOR,
    'x-evidence-seal': pkg.pack.seal, 'x-evidence-seal-verified': 'true', 'x-evidence-locale': locale,
  } })
}
beforeEach(() => {
  language.locale = 'en-CA'; downloads.length = 0; created.mockClear(); revoked.mockClear()
  vi.stubGlobal('crypto', webcrypto); vi.stubEnv('EVIDENCE_SEAL_KEY', 'synthetic-browser-export-test-key')
  const BrowserURL = URL
  vi.stubGlobal('URL', class extends BrowserURL { static createObjectURL = created; static revokeObjectURL = revoked })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) { downloads.push({ filename: this.download, url: this.href }) })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('primary-handler case pack download', () => {
  it('requests no export without a user action and hides the control when the server capability is absent', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const view = render(<CaseEvidenceExport {...props} />)
    expect(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' })).toBeVisible()
    expect(fetcher).not.toHaveBeenCalled()
    view.rerender(<CaseEvidenceExport {...props} allowed={false} />)
    expect(screen.queryByTestId('case-evidence-export')).not.toBeInTheDocument()
  })
  it('uses French keyboard activation, verifies the actual server envelope and issues a bounded private download', async () => {
    language.locale = 'fr-CA'; const fetcher = vi.fn(async () => response()); vi.stubGlobal('fetch', fetcher)
    render(<CaseEvidenceExport {...props} />)
    screen.getByRole('button', { name: 'Télécharger le dossier de preuves scellé (PDF)' }).focus()
    await userEvent.keyboard('{Enter}')
    await screen.findByRole('status')
    expect(downloads).toEqual([{ filename: `union-eyes-case-${CASE}.pdf`, url: 'blob:controlled-case-export' }])
    expect(fetcher).toHaveBeenCalledWith(`/api/cases/${CASE}/export?format=pdf&envelope=true&verify=true&locale=fr-CA`, expect.objectContaining({ cache: 'no-store', credentials: 'same-origin', redirect: 'error', headers: { 'x-ue-expected-organization': ORG } }))
    expect(created).toHaveBeenCalledOnce(); expect(created.mock.calls[0][0]).toMatchObject({ type: 'application/pdf' })
    expect(document.querySelector('a[download]')).toBeNull()
  })
  it('requires a fresh server decision for a second download and removes the previous object URL on denial', async () => {
    const fetcher = vi.fn(async () => response()); vi.stubGlobal('fetch', fetcher)
    render(<CaseEvidenceExport {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' })); await screen.findByRole('status')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' })).toBeEnabled())
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 404 }))
    await userEvent.click(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your access changed')
    expect(fetcher).toHaveBeenCalledTimes(2); expect(downloads).toHaveLength(1); expect(revoked).toHaveBeenCalledWith('blob:controlled-case-export')
  })
  it('never downloads tampered or failed responses and does not automatically replay a request', async () => {
    const fetcher = vi.fn(async () => { const valid = await response(); const bytes = new Uint8Array(await valid.arrayBuffer()); bytes[15] ^= 1; return new Response(bytes, { headers: valid.headers }) }); vi.stubGlobal('fetch', fetcher)
    render(<CaseEvidenceExport {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be verified')
    expect(downloads).toHaveLength(0); expect(created).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledOnce()
  })
  it('ignores a late response after organization, actor or case context changes', async () => {
    let resolve!: (value: Response) => void
    const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r })); vi.stubGlobal('fetch', fetcher)
    const view = render(<CaseEvidenceExport {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' }))
    view.rerender(<CaseEvidenceExport {...props} caseId={OTHER} organizationId={OTHER} actorId={OTHER} />)
    resolve(await response())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' })).toBeEnabled())
    expect(downloads).toHaveLength(0); expect(created).not.toHaveBeenCalled(); expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('does not issue two exports from repeated activation while the first request is pending', async () => {
    let resolve!: (value: Response) => void
    const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r })); vi.stubGlobal('fetch', fetcher)
    render(<CaseEvidenceExport {...props} />)
    await userEvent.dblClick(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' }))
    expect(fetcher).toHaveBeenCalledOnce(); resolve(await response()); await screen.findByRole('status'); expect(downloads).toHaveLength(1)
  })
  it('also verifies the structured JSON option through the same explicit user action', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(envelope()), { headers: { 'content-type': 'application/json' } })))
    render(<CaseEvidenceExport {...props} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Export format' }), 'json')
    await userEvent.click(screen.getByRole('button', { name: 'Download sealed case pack (JSON)' })); await screen.findByRole('status')
    expect(downloads[0].filename).toBe(`union-eyes-case-${CASE}.json`)
  })
  it.each([401, 403, 404, 500])('withholds files on HTTP%s and never automatically retries', async status => {
    const fetcher = vi.fn(async () => new Response('{}', { status })); vi.stubGlobal('fetch', fetcher)
    render(<CaseEvidenceExport {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' })); await screen.findByRole('alert')
    expect(downloads).toHaveLength(0); expect(created).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledOnce()
  })
  it('reports browser download uncertainty separately from integrity verification', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response())); created.mockImplementationOnce(() => { throw new Error('Synthetic browser failure') })
    render(<CaseEvidenceExport {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Download sealed case pack (PDF)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('browser download could not be confirmed')
    expect(downloads).toHaveLength(0)
  })
})
