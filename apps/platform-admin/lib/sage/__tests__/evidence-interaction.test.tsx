// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateSourceForm } from '../../../app/sage/components/evidence/create-source-form'
import { SourceList } from '../../../app/sage/components/evidence/source-list'
import { ItemList } from '../../../app/sage/components/evidence/item-list'
import type {
  SageEvidenceItemResponse,
  SageEvidenceSourceResponse,
} from '../evidence-schemas'

// next-intl: translate by returning the key path so assertions are stable and
// do not depend on the actual message catalog.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const ORG = '00000000-0000-0000-0000-000000000001'
const WS = '11111111-1111-1111-1111-111111111111'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('CreateSourceForm (rendered)', () => {
  it('renders accessible labelled controls', () => {
    render(
      <CreateSourceForm orgId={ORG} workspaceId={WS} sourceTypes={['public', 'administrative']} />,
    )
    // Accessible name resolves through the <label htmlFor> association.
    expect(screen.getByLabelText('sourceType')).toBeDefined()
    expect(screen.getByLabelText('containsPersonalInformation')).toBeDefined()
    expect(screen.getByLabelText('containsSensitiveInformation')).toBeDefined()
  })

  it('submits with an Idempotency-Key and x-org-id, and no orgId/actorId in the body', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: { id: 's1' } }), { status: 201 }),
      )
    // jsdom lacks crypto.randomUUID in some versions; provide a deterministic one.
    if (!globalThis.crypto) {
      // @ts-expect-error minimal shim for the test environment
      globalThis.crypto = {}
    }
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '22222222-2222-2222-2222-222222222222',
    )

    render(<CreateSourceForm orgId={ORG} workspaceId={WS} sourceTypes={['public']} />)

    // Submit the form (a required source type is preselected).
    fireEvent.submit(screen.getByLabelText('sourceType').closest('form')!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/sage/workspaces/${WS}/evidence-sources`)
    const headers = init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('22222222-2222-2222-2222-222222222222')
    expect(headers['x-org-id']).toBe(ORG)

    const body = JSON.parse(init.body as string)
    expect(body).toHaveProperty('sourceType', 'public')
    // Server-derived identity must never be present in the request body.
    expect(body).not.toHaveProperty('orgId')
    expect(body).not.toHaveProperty('actorId')
    expect(body).not.toHaveProperty('workspaceId')
    expect(body).not.toHaveProperty('createdBy')

    // Success path refreshes the server component tree.
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('shows an accessible error alert when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { message: 'nope' } }), { status: 403 }),
    )
    render(<CreateSourceForm orgId={ORG} workspaceId={WS} sourceTypes={['public']} />)
    fireEvent.submit(screen.getByLabelText('sourceType').closest('form')!)
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(refresh).not.toHaveBeenCalled()
  })
})

const UNCLASSIFIED_SOURCE: SageEvidenceSourceResponse = {
  id: 'src-1',
  sourceType: 'public',
  sourceQuality: null,
  authorizationLevel: 'internal',
  containsPersonalInformation: false,
  containsSensitiveInformation: false,
  classified: false,
  createdAt: '2026-07-12T00:00:00.000Z',
}

describe('SourceList (rendered permission gating)', () => {
  it('offers classification to a contributor on an unclassified source', () => {
    render(
      <SourceList
        orgId={ORG}
        workspaceId={WS}
        sources={[UNCLASSIFIED_SOURCE]}
        canContribute
        sourceQualities={['moderate']}
        authorizationLevels={['internal']}
      />,
    )
    expect(screen.getByRole('button', { name: 'classify' })).toBeDefined()
  })

  it('hides the classify action when the user cannot contribute (permission-gated)', () => {
    render(
      <SourceList
        orgId={ORG}
        workspaceId={WS}
        sources={[UNCLASSIFIED_SOURCE]}
        canContribute={false}
        sourceQualities={['moderate']}
        authorizationLevels={['internal']}
      />,
    )
    // UI hiding is a convenience only — the server still enforces authorization —
    // but a read-only viewer must not even be offered the classify control.
    expect(screen.queryByRole('button', { name: 'classify' })).toBeNull()
  })
})

const REGISTERED_ITEM: SageEvidenceItemResponse = {
  id: 'item-1',
  sourceId: 'src-1',
  lifecycleState: 'registered',
  confidenceLevel: 'moderate',
  excludedFromExternalReview: false,
  humanReviewRequired: true,
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
}

describe('ItemList (rendered lifecycle gating)', () => {
  it('offers the link action for a not-yet-linked item', () => {
    render(<ItemList orgId={ORG} workspaceId={WS} items={[REGISTERED_ITEM]} canContribute />)
    expect(screen.getByRole('button', { name: 'link' })).toBeDefined()
  })

  it('does not offer the link action once the item is already linked', () => {
    render(
      <ItemList
        orgId={ORG}
        workspaceId={WS}
        items={[{ ...REGISTERED_ITEM, id: 'item-2', lifecycleState: 'linked' }]}
        canContribute
      />,
    )
    expect(screen.queryByRole('button', { name: 'link' })).toBeNull()
  })

  it('hides the link action from a read-only viewer', () => {
    render(
      <ItemList orgId={ORG} workspaceId={WS} items={[REGISTERED_ITEM]} canContribute={false} />,
    )
    expect(screen.queryByRole('button', { name: 'link' })).toBeNull()
  })
})
