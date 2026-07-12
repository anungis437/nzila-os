// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ResolveBoundaryFlagForm } from '../../../app/sage/components/governance/resolve-boundary-flag-form'
import { CreateDecisionRecordForm } from '../../../app/sage/components/governance/create-decision-record-form'
import { BoundaryFlagList } from '../../../app/sage/components/governance/boundary-flag-list'
import type { SageBoundaryFlagResponse } from '../governance-schemas'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const ORG = '00000000-0000-0000-0000-000000000001'
const WS = '11111111-1111-1111-1111-111111111111'
const FLAG = '22222222-2222-2222-2222-222222222222'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

function mockFetchOk() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }))
}
function stubUuid() {
  if (!globalThis.crypto) {
    // @ts-expect-error minimal shim
    globalThis.crypto = {}
  }
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('33333333-3333-3333-3333-333333333333')
}

describe('ResolveBoundaryFlagForm (rendered)', () => {
  it('requires a resolution note before submitting', async () => {
    const fetchMock = mockFetchOk()
    render(
      <ResolveBoundaryFlagForm
        orgId={ORG}
        workspaceId={WS}
        flagId={FLAG}
        resolutions={['resolved', 'retained']}
      />,
    )
    fireEvent.submit(screen.getByLabelText('resolutionOutcome').closest('form')!)
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits with an Idempotency-Key + x-org-id and no reviewer/tenant fields in the body', async () => {
    const fetchMock = mockFetchOk()
    stubUuid()
    render(
      <ResolveBoundaryFlagForm
        orgId={ORG}
        workspaceId={WS}
        flagId={FLAG}
        resolutions={['resolved', 'retained']}
      />,
    )
    fireEvent.change(screen.getByLabelText('resolutionNote'), { target: { value: 'addressed' } })
    fireEvent.submit(screen.getByLabelText('resolutionOutcome').closest('form')!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/sage/workspaces/${WS}/boundary-flags/${FLAG}/resolve`)
    const headers = init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBeDefined()
    expect(headers['x-org-id']).toBe(ORG)
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ resolution: 'resolved', resolutionNote: 'addressed' })
    expect(body).not.toHaveProperty('resolvedBy')
    expect(body).not.toHaveProperty('reviewerId')
    expect(body).not.toHaveProperty('orgId')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})

describe('CreateDecisionRecordForm (rendered)', () => {
  it('shows the authenticated reviewer as non-editable text', () => {
    render(
      <CreateDecisionRecordForm
        orgId={ORG}
        workspaceId={WS}
        reviewerId="u-admin"
        evidenceOptions={[]}
        boundaryFlagOptions={[]}
      />,
    )
    const reviewer = screen.getByTestId('decision-reviewer')
    expect(reviewer.textContent).toBe('u-admin')
    // Reviewer is shown as text, not an editable field.
    expect(reviewer.tagName).toBe('P')
  })

  it('requires an uncertainty statement and, when valid, sends no reviewer/tenant fields', async () => {
    const fetchMock = mockFetchOk()
    stubUuid()
    render(
      <CreateDecisionRecordForm
        orgId={ORG}
        workspaceId={WS}
        reviewerId="u-admin"
        evidenceOptions={[]}
        boundaryFlagOptions={[]}
      />,
    )
    // Fill the decision but leave uncertainty empty → accessible validation, no fetch.
    fireEvent.change(screen.getByLabelText('decisionStatement'), { target: { value: 'proceed' } })
    fireEvent.submit(screen.getByLabelText('decisionStatement').closest('form')!)
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(fetchMock).not.toHaveBeenCalled()

    // Provide the uncertainty statement and submit.
    fireEvent.change(screen.getByLabelText('uncertainty'), { target: { value: 'limited sample' } })
    fireEvent.submit(screen.getByLabelText('decisionStatement').closest('form')!)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/sage/workspaces/${WS}/decisions`)
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ decision: 'proceed', uncertainty: 'limited sample' })
    expect(body).not.toHaveProperty('humanReviewerId')
    expect(body).not.toHaveProperty('reviewerId')
    expect(body).not.toHaveProperty('actorId')
    expect(body).not.toHaveProperty('orgId')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})

describe('BoundaryFlagList (rendered permission gating)', () => {
  const openFlag: SageBoundaryFlagResponse = {
    id: FLAG,
    flagType: 'sensitivity',
    targetType: 'workspace',
    targetId: null,
    note: null,
    status: 'open',
    authorizationLevel: 'internal',
    authorizationBasis: 'workspace_default',
    resolvedBy: null,
    resolutionNote: null,
    resolvedAt: null,
    createdBy: 'u-admin',
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  }

  it('offers the resolve action to a contributor on an open flag', () => {
    render(
      <BoundaryFlagList
        orgId={ORG}
        workspaceId={WS}
        flags={[openFlag]}
        canContribute
        resolutions={['resolved', 'retained']}
      />,
    )
    expect(screen.getByRole('button', { name: 'resolveFlag' })).toBeDefined()
  })

  it('hides the resolve action from a read-only actor', () => {
    render(
      <BoundaryFlagList
        orgId={ORG}
        workspaceId={WS}
        flags={[openFlag]}
        canContribute={false}
        resolutions={['resolved', 'retained']}
      />,
    )
    expect(screen.queryByRole('button', { name: 'resolveFlag' })).toBeNull()
  })

  it('does not offer resolution for an already-resolved flag', () => {
    render(
      <BoundaryFlagList
        orgId={ORG}
        workspaceId={WS}
        flags={[{ ...openFlag, status: 'resolved', resolutionNote: 'done', resolvedBy: 'u-admin' }]}
        canContribute
        resolutions={['resolved', 'retained']}
      />,
    )
    expect(screen.queryByRole('button', { name: 'resolveFlag' })).toBeNull()
  })
})
