// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateExportRequestForm } from '../../../app/sage/components/exports/create-export-request-form'
import { ExportRequestList, type ExportRequestRow } from '../../../app/sage/components/exports/export-request-list'
import { ExportPackageList, type ExportPackageRow } from '../../../app/sage/components/exports/export-package-list'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const ORG = '00000000-0000-0000-0000-000000000001'
const WS = '11111111-1111-1111-1111-111111111111'
const ITEM = '22222222-2222-2222-2222-222222222222'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

function mockFetchOk() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { id: 'x' } }), { status: 201 }))
}
function stubUuid() {
  if (!globalThis.crypto) {
    // @ts-expect-error minimal shim
    globalThis.crypto = {}
  }
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('33333333-3333-3333-3333-333333333333')
}

describe('CreateExportRequestForm (rendered)', () => {
  const evidence = [{ id: ITEM, label: 'Evidence 2222', authorizationLevel: 'accepted' }]

  it('requires a purpose before submitting', async () => {
    const fetchMock = mockFetchOk()
    render(
      <CreateExportRequestForm
        orgId={ORG}
        workspaceId={WS}
        requesterId="u-admin"
        packageTypes={['internal_review_bundle']}
        evidenceItems={evidence}
        boundaryFlags={[]}
        reviewNotes={[]}
        decisionRecords={[]}
      />,
    )
    fireEvent.submit(screen.getByRole('button', { name: 'requestExport' }).closest('form')!)
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits a valid selection with an Idempotency-Key and no identity/status/hash/recipient in the body', async () => {
    const fetchMock = mockFetchOk()
    stubUuid()
    render(
      <CreateExportRequestForm
        orgId={ORG}
        workspaceId={WS}
        requesterId="u-admin"
        packageTypes={['internal_review_bundle']}
        evidenceItems={evidence}
        boundaryFlags={[]}
        reviewNotes={[]}
        decisionRecords={[]}
      />,
    )
    fireEvent.change(screen.getByLabelText('purpose'), { target: { value: 'internal review' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.submit(screen.getByRole('button', { name: 'requestExport' }).closest('form')!)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBeTruthy()
    const body = JSON.parse(init?.body as string)
    expect(body.purpose).toBe('internal review')
    expect(body.evidenceItemIds).toContain(ITEM)
    for (const forbidden of ['requesterId', 'orgId', 'status', 'requestedScopeHash', 'recipient', 'approverId']) {
      expect(body).not.toHaveProperty(forbidden)
    }
    // The requester identity is displayed but not an editable input.
    expect(screen.getByTestId('export-requester').textContent).toBe('u-admin')
  })
})

describe('ExportRequestList (independent approval, rendered)', () => {
  const own: ExportRequestRow = {
    id: 'req-own',
    requestedBy: 'u-admin',
    purpose: 'mine',
    packageType: 'internal_review_bundle',
    status: 'requested',
    requestedScopeHash: 'h',
    itemCount: 1,
    createdAt: 't',
  }
  const other: ExportRequestRow = { ...own, id: 'req-other', requestedBy: 'u-other', purpose: 'theirs' }

  it('offers no approve/deny controls for the current actor’s own request', () => {
    render(<ExportRequestList orgId={ORG} workspaceId={WS} currentActorId="u-admin" canApprove requests={[own]} />)
    expect(screen.queryByText('approveRequest')).toBeNull()
    expect(screen.queryByText('denyRequest')).toBeNull()
  })

  it('offers approve/deny for another actor’s pending request and requires a rationale', async () => {
    const fetchMock = mockFetchOk()
    render(<ExportRequestList orgId={ORG} workspaceId={WS} currentActorId="u-admin" canApprove requests={[other]} />)
    const approve = screen.getByText('approveRequest')
    expect(approve).toBeDefined()
    fireEvent.click(approve)
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends a valid approval with an Idempotency-Key and no approverId/status/hash in the body', async () => {
    const fetchMock = mockFetchOk()
    stubUuid()
    render(<ExportRequestList orgId={ORG} workspaceId={WS} currentActorId="u-admin" canApprove requests={[other]} />)
    fireEvent.change(screen.getByLabelText('decisionRationale'), { target: { value: 'looks correct' } })
    fireEvent.click(screen.getByText('approveRequest'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/approve')
    const headers = init?.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBeTruthy()
    const body = JSON.parse(init?.body as string)
    expect(body.rationale).toBe('looks correct')
    for (const forbidden of ['approverId', 'status', 'approvedScopeHash']) {
      expect(body).not.toHaveProperty(forbidden)
    }
  })
})

describe('ExportPackageList (generation + no external delivery, rendered)', () => {
  const pkg: ExportPackageRow = {
    id: 'pkg-1',
    exportRequestId: 'req-1',
    status: 'generated',
    packageType: 'internal_review_bundle',
    manifestHash: 'm'.repeat(64),
    contentHash: 'c'.repeat(64),
    sizeBytes: 100,
    policyVersion: 'sage-export-v1',
    itemCount: 1,
    excludedCount: 0,
    generatedBy: 'u-approver',
    generatedAt: 't',
  }

  it('shows a generate control for an approved (generatable) request', () => {
    render(<ExportPackageList orgId={ORG} workspaceId={WS} generatableRequestIds={['req-1']} packages={[]} />)
    expect(screen.getByText('generatePackage')).toBeDefined()
  })

  it('shows package hashes and an internal download link, and no external-delivery control', () => {
    render(<ExportPackageList orgId={ORG} workspaceId={WS} generatableRequestIds={[]} packages={[pkg]} />)
    const link = screen.getByText('downloadInternal').closest('a')!
    expect(link.getAttribute('href')).toContain('/download')
    // No external-delivery affordances exist.
    expect(screen.queryByText(/send/i)).toBeNull()
    expect(screen.queryByText(/share/i)).toBeNull()
    expect(screen.queryByText(/publish/i)).toBeNull()
    expect(screen.queryByText(/recipient/i)).toBeNull()
  })
})
