import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  withRequiredRole: vi.fn(),
  listTrustcoreDataAssets: vi.fn(),
  listTrustcoreVendors: vi.fn(),
  listTrustcorePias: vi.fn(),
  listTrustcoreIncidents: vi.fn(),
  createInMemorySearchIndex: vi.fn(),
  indexEntity: vi.fn(),
  searchEntities: vi.fn(),
}))

vi.mock('@/lib/rbac/requireRole', () => ({
  withRequiredRole: mocks.withRequiredRole,
}))

vi.mock('@nzila/db/queries/trustcore', () => ({
  listTrustcoreDataAssets: mocks.listTrustcoreDataAssets,
  listTrustcoreVendors: mocks.listTrustcoreVendors,
  listTrustcorePias: mocks.listTrustcorePias,
  listTrustcoreIncidents: mocks.listTrustcoreIncidents,
}))

vi.mock('@nzila/platform-semantic-search', () => ({
  SearchModes: { LEXICAL: 'lexical', SEMANTIC: 'semantic' },
  createInMemorySearchIndex: mocks.createInMemorySearchIndex,
  indexEntity: mocks.indexEntity,
  searchEntities: mocks.searchEntities,
}))

const fakeCtx = { userId: 'user_1', orgId: 'org_1', role: 'org_admin' as const }
const fakeIndex = {}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withRequiredRole.mockImplementation(
      (_roles: unknown, handler: (...args: unknown[]) => unknown) =>
        (request: NextRequest) =>
          handler(request, fakeCtx),
    )
    mocks.listTrustcoreDataAssets.mockResolvedValue([])
    mocks.listTrustcoreVendors.mockResolvedValue([])
    mocks.listTrustcorePias.mockResolvedValue([])
    mocks.listTrustcoreIncidents.mockResolvedValue([])
    mocks.createInMemorySearchIndex.mockReturnValue(fakeIndex)
    mocks.indexEntity.mockResolvedValue(undefined)
    mocks.searchEntities.mockResolvedValue([])
  })

  it('returns 400 when query is missing', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ query: '' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/query/i)
  })

  it('returns 400 when body has no query field', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('calls all 4 list functions with orgId', async () => {
    const { POST } = await import('./route')
    await POST(makeRequest({ query: 'health data' }))
    expect(mocks.listTrustcoreDataAssets).toHaveBeenCalledWith('org_1')
    expect(mocks.listTrustcoreVendors).toHaveBeenCalledWith('org_1')
    expect(mocks.listTrustcorePias).toHaveBeenCalledWith('org_1')
    expect(mocks.listTrustcoreIncidents).toHaveBeenCalledWith('org_1')
  })

  it('calls searchEntities with query, orgId, and defaults', async () => {
    const { POST } = await import('./route')
    await POST(makeRequest({ query: 'health data' }))
    expect(mocks.searchEntities).toHaveBeenCalledWith(
      fakeIndex,
      expect.objectContaining({
        tenantId: 'org_1',
        query: 'health data',
        mode: 'lexical',
        limit: 10,
      }),
    )
  })

  it('respects explicit mode and limit', async () => {
    const { POST } = await import('./route')
    await POST(makeRequest({ query: 'vendor risk', mode: 'semantic', limit: 5 }))
    expect(mocks.searchEntities).toHaveBeenCalledWith(
      fakeIndex,
      expect.objectContaining({ mode: 'semantic', limit: 5 }),
    )
  })

  it('clamps limit to [1, 20]', async () => {
    const { POST } = await import('./route')
    await POST(makeRequest({ query: 'test', limit: 999 }))
    expect(mocks.searchEntities).toHaveBeenCalledWith(
      fakeIndex,
      expect.objectContaining({ limit: 20 }),
    )
  })

  it('returns search results in data field', async () => {
    const results = [{ resourceId: 'a1', score: 0.9 }]
    mocks.searchEntities.mockResolvedValue(results)
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ query: 'patient' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(results)
  })

  it('indexes data assets with correct entityType', async () => {
    mocks.listTrustcoreDataAssets.mockResolvedValue([
      {
        id: 'da1',
        name: 'PHI Records',
        description: 'Patient health info',
        processingPurpose: 'Care delivery',
        storageLocation: 'AWS S3',
        dataCategory: 'health',
        sensitivityLevel: 'high',
        crossBorderTransfer: false,
      },
    ])
    const { POST } = await import('./route')
    await POST(makeRequest({ query: 'PHI' }))
    expect(mocks.indexEntity).toHaveBeenCalledWith(
      fakeIndex,
      expect.objectContaining({
        entityType: 'data_asset',
        resourceId: 'da1',
        title: 'PHI Records',
      }),
    )
  })

  it('indexes vendors with correct entityType', async () => {
    mocks.listTrustcoreVendors.mockResolvedValue([
      {
        id: 'v1',
        name: 'AWS',
        serviceDescription: 'Cloud infra',
        dataSharedDescription: 'All data',
        country: 'US',
        riskLevel: 'medium',
        crossBorderTransfer: true,
      },
    ])
    const { POST } = await import('./route')
    await POST(makeRequest({ query: 'AWS' }))
    expect(mocks.indexEntity).toHaveBeenCalledWith(
      fakeIndex,
      expect.objectContaining({ entityType: 'vendor', resourceId: 'v1' }),
    )
  })

  it('indexes PIAs with correct entityType', async () => {
    mocks.listTrustcorePias.mockResolvedValue([
      {
        id: 'pia1',
        title: 'New System PIA',
        description: 'Assessment for new system',
        triggerType: 'new_system',
        mitigationPlan: 'Encrypt all',
        reviewerName: 'Jane',
        status: 'draft',
        riskScore: 7,
      },
    ])
    const { POST } = await import('./route')
    await POST(makeRequest({ query: 'assessment' }))
    expect(mocks.indexEntity).toHaveBeenCalledWith(
      fakeIndex,
      expect.objectContaining({ entityType: 'pia', resourceId: 'pia1' }),
    )
  })

  it('indexes incidents with correct entityType', async () => {
    mocks.listTrustcoreIncidents.mockResolvedValue([
      {
        id: 'inc1',
        title: 'Data Breach 2024',
        description: 'Unauthorized access',
        incidentType: 'breach',
        harmAssessment: 'Serious',
        containmentActions: 'Patched',
        severity: 'high',
        resolutionStatus: 'resolved',
        seriousHarmLikely: true,
      },
    ])
    const { POST } = await import('./route')
    await POST(makeRequest({ query: 'breach' }))
    expect(mocks.indexEntity).toHaveBeenCalledWith(
      fakeIndex,
      expect.objectContaining({ entityType: 'incident', resourceId: 'inc1' }),
    )
  })
})
