// @vitest-environment jsdom
/**
 * The edit-organization page sends what PATCH /api/organizations/[id] takes. The route refuses any key its schema does not list (organizationPatchSchema is strict), so the
 * body the page builds is held to the route's own schema here: a field the page invents is a save that can only fail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/en-CA.json'
import { organizationPatchSchema } from '@/lib/organizations/profile-input'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PARENT_ID = '22222222-2222-4222-8222-222222222222'

const h = vi.hoisted(() => ({ push: vi.fn(), data: null as unknown }))

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '11111111-1111-4111-8111-111111111111' }), useRouter: () => ({ push: h.push }) }))
vi.mock('swr', () => ({ default: () => ({ data: h.data, error: undefined, isLoading: false }) }))
vi.mock('@/components/organization/organization-breadcrumb', () => ({ OrganizationBreadcrumb: () => null }))

import EditOrganizationPage from './page'

const organization = {
  id: ORG_ID,
  name: 'CUPE Local 1000',
  slug: 'cupe-local-1000',
  organization_type: 'local',
  description: 'A public-sector local',
  parent_id: PARENT_ID,
  status: 'active',
  charter_number: 'C-77',
  affiliation_date: '2019-05-01T00:00:00.000Z',
  settings: { sector: 'education', jurisdiction: 'CA-ON' },
}

const fetchMock = vi.fn()

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en-CA" messages={messages}>
      <EditOrganizationPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  h.push.mockReset()
  h.data = { data: organization }
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (init?.method === 'PATCH') return { ok: true, status: 200, json: async () => ({ data: organization }) }
    return { ok: true, status: 200, json: async () => ({ data: [{ id: PARENT_ID, name: 'CUPE National', organization_type: 'union' }] }) }
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const patchBody = () => {
  const call = fetchMock.mock.calls.find(([, init]) => (init as { method?: string } | undefined)?.method === 'PATCH')
  return JSON.parse((call![1] as { body: string }).body) as Record<string, unknown>
}

describe('EditOrganizationPage', () => {
  it('saves a body the route accepts: only keys its strict schema lists, and every value in its shape', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByDisplayValue('CUPE Local 1000')).toBeInTheDocument())
    fireEvent.submit(screen.getByDisplayValue('CUPE Local 1000').closest('form')!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/organizations/${ORG_ID}`, expect.objectContaining({ method: 'PATCH' })))
    const body = patchBody()
    expect(organizationPatchSchema.safeParse(body).success, JSON.stringify(organizationPatchSchema.safeParse(body).error?.issues)).toBe(true)
    expect(Object.keys(body).sort()).toEqual(['affiliation_date', 'charter_number', 'description', 'name', 'parent_id', 'settings', 'slug', 'status'])
    expect(body).toMatchObject({ name: 'CUPE Local 1000', slug: 'cupe-local-1000', parent_id: PARENT_ID, status: 'active', description: 'A public-sector local', charter_number: 'C-77', affiliation_date: '2019-05-01' })
    expect(body.settings).toEqual({ sector: 'education', jurisdiction: 'CA-ON' })
    await waitFor(() => expect(h.push).toHaveBeenCalledWith(`/dashboard/admin/organizations/${ORG_ID}`))
  })

  it('shows the type the organization has, read-only, because this route does not change it', async () => {
    renderPage()
    const field = await screen.findByLabelText('Organization Type')
    expect(field).toBeDisabled()
    expect(field).toHaveValue('Local')
    expect(screen.getByLabelText('Description')).toHaveValue('A public-sector local')
  })

  it('shows the error the route answers with when the save is refused', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByDisplayValue('CUPE Local 1000')).toBeInTheDocument())
    fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) =>
      init?.method === 'PATCH' ? { ok: false, status: 400, json: async () => ({ error: 'slug is taken' }) } : { ok: true, json: async () => ({ data: [] }) },
    )
    fireEvent.submit(screen.getByDisplayValue('CUPE Local 1000').closest('form')!)
    expect(await screen.findByText('slug is taken')).toBeInTheDocument()
    expect(h.push).not.toHaveBeenCalled()
  })
})
