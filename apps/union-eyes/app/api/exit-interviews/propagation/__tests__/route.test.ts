import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  build: vi.fn(),
  badRequest: vi.fn((message: string) => ({ status: 400, message })),
  notFound: vi.fn((resource: string, id?: string) => ({ status: 404, resource, id })),
}))

vi.mock('@/lib/api/framework', async () => ({
  withApi: (_config: unknown, handler: unknown) => handler,
  ApiError: { badRequest: m.badRequest, notFound: m.notFound },
  z: (await vi.importActual<typeof import('zod')>('zod')).z,
}))
vi.mock('@/lib/knowledge-transfer/propagation', () => ({ buildDependencyPropagationMap: m.build }))

const request = (query = '') => ({ url: `https://example.test/api/exit-interviews/propagation${query}` })
const loadHandler = async () => (await import('../route')).GET as unknown as (context: {
  organizationId?: string
  request: { url: string }
}) => Promise<unknown>
const map = (nodes: Array<{ id: string }> = []) => ({
  nodes, downstreamImpacts: [], upstreamDependencies: [], couplingAnalysis: [],
})

describe('Gate 0 propagation route behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.build.mockResolvedValue(map([{ id: 'node-1' }]))
  })

  it('rejects a missing organization before querying any interviews', async () => {
    const GET = await loadHandler()
    await expect(GET({ organizationId: undefined, request: request() })).rejects.toMatchObject({ status: 400 })
    expect(m.build).not.toHaveBeenCalled()
  })

  it('rejects invalid or unexpected analysis parameters before reading the map', async () => {
    const GET = await loadHandler()
    for (const query of ['?analysisType=other', '?nodeId=', '?organizationId=another-org']) {
      await expect(GET({ organizationId: 'org-a', request: request(query) })).rejects.toMatchObject({ status: 400 })
    }
    expect(m.build).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown node even when there are no published interviews', async () => {
    const GET = await loadHandler()
    m.build.mockResolvedValueOnce(map())
    await expect(GET({ organizationId: 'org-a', request: request('?nodeId=missing') })).rejects.toMatchObject({
      status: 404, resource: 'node', id: 'missing',
    })
    expect(m.build).toHaveBeenCalledWith('org-a')
  })

  it('returns 404 for an unknown node in a nonempty map', async () => {
    const GET = await loadHandler()
    await expect(GET({ organizationId: 'org-a', request: request('?nodeId=missing') })).rejects.toMatchObject({ status: 404 })
  })

  it('preserves a truthful empty-map response without a node selector', async () => {
    const GET = await loadHandler()
    m.build.mockResolvedValueOnce(map())
    const result = await GET({ organizationId: 'org-a', request: request() })
    expect(result).toMatchObject({ data: { nodes: [] }, meta: { message: 'No published interviews found to analyze' } })
  })
})
