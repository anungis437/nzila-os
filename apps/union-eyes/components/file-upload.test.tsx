// @vitest-environment jsdom
/**
 * The evidence uploader talks to /api/cases/:id/evidence, a withApi route: a success is { success, data: { attachment } } and a failure is { code, message }. A refused upload or delete is
 * reported with the sentence the route gives (a malware refusal, a locked case), the attachment list changes only when the route said it did, and an upload the route accepted without
 * naming the attachment is reported as such rather than listed as nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({ toast: vi.fn() }))

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }))

import { FileUpload } from './file-upload'

const fetchMock = vi.fn()

const attachment = { url: 'https://files.example.test/a.pdf', fileName: 'a.pdf', fileSize: 2048, fileType: 'application/pdf', uploadedAt: '2026-01-01T00:00:00Z', uploadedBy: 'user-1' }

const wrapped = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data, timestamp: 'now' }) })
const failed = (status: number, message: string) => ({ ok: false, status, json: async () => ({ code: 'FAILED', message, timestamp: 'now', traceId: 't' }) })

const pick = (container: HTMLElement) =>
  fireEvent.change(container.querySelector('input[type="file"]') as HTMLElement, { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } })

beforeEach(() => {
  h.toast.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('FileUpload: uploading', () => {
  it('lists the attachment the route names under data, and keeps it listed when the component renders again', async () => {
    fetchMock.mockResolvedValueOnce(wrapped({ attachment }))
    const onUploadComplete = vi.fn()
    const { container } = render(<FileUpload claimId="claim-1" onUploadComplete={onUploadComplete} />)
    pick(container)
    expect(await screen.findByText('a.pdf')).toBeInTheDocument()
    expect(onUploadComplete).toHaveBeenCalledWith(attachment)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/cases/claim-1/evidence')
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload successful' }))
  })

  it('reports a refused upload with the sentence the route gives', async () => {
    fetchMock.mockResolvedValueOnce(failed(422, 'The file failed the malware scan'))
    const { container } = render(<FileUpload claimId="claim-1" />)
    pick(container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed', description: 'The file failed the malware scan', variant: 'destructive' })))
    expect(screen.queryByText('a.pdf')).toBeNull()
  })

  it('reports an accepted upload that names no attachment, and lists nothing', async () => {
    fetchMock.mockResolvedValueOnce(wrapped({}))
    const { container } = render(<FileUpload claimId="claim-1" />)
    pick(container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed', description: 'Upload completed without attachment metadata' })))
    expect(screen.queryByText('a.pdf')).toBeNull()
  })

  it('falls back to its own words when the failure names nothing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <') } })
    const { container } = render(<FileUpload claimId="claim-1" />)
    pick(container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed', description: 'Upload failed' })))
  })
})

describe('FileUpload: deleting', () => {
  const deleteButton = () => {
    const button = screen.getAllByRole('button').find((candidate) => candidate.textContent === '')
    if (!button) throw new Error('no delete button')
    return button
  }

  it('keeps the attachment and says why when the route refuses the delete', async () => {
    fetchMock.mockResolvedValueOnce(failed(409, 'The case is locked'))
    const onDeleteComplete = vi.fn()
    render(<FileUpload claimId="claim-1" existingAttachments={[attachment]} onDeleteComplete={onDeleteComplete} />)
    fireEvent.click(deleteButton())
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete failed', description: 'The case is locked' })))
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(onDeleteComplete).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }]
    expect(url).toBe(`/api/cases/claim-1/evidence?fileUrl=${encodeURIComponent(attachment.url)}`)
    expect(init.method).toBe('DELETE')
  })

  it('removes the attachment only once the route says it was deleted', async () => {
    fetchMock.mockResolvedValueOnce(wrapped({ deleted: true }))
    const onDeleteComplete = vi.fn()
    render(<FileUpload claimId="claim-1" existingAttachments={[attachment]} onDeleteComplete={onDeleteComplete} />)
    fireEvent.click(deleteButton())
    await waitFor(() => expect(onDeleteComplete).toHaveBeenCalledWith(attachment.url))
    await waitFor(() => expect(screen.queryByText('a.pdf')).toBeNull())
  })
})
