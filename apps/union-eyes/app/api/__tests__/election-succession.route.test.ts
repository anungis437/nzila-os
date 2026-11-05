import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const m = vi.hoisted(() => ({
  load: vi.fn(),
  record: vi.fn(),
}))

vi.mock('@/lib/api/framework', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/framework')>('@/lib/api/framework')
  return { ...actual, withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => handler }
})
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}),
  withSystemContext: async (fn: (tx: unknown) => unknown) => fn({}),
}))
vi.mock('@/lib/authority/store/route-adapter', () => ({ drizzleExecutor: (tx: unknown) => tx }))
vi.mock('@/lib/voting/election-succession-grant', () => ({ loadCertifiedSupersessionGrant: m.load }))
vi.mock('@/lib/voting/election-succession', () => ({ recordCertifiedSupersession: m.record }))

const ELECTION = '11111111-1111-4111-8111-111111111111'
const ORG = '22222222-2222-4222-8222-222222222222'
const grant = {
  loadedBy: 'authority-kernel',
  action: 'election:supersede_certified_result',
  electionId: ELECTION,
  organizationId: ORG,
  issued: true,
  issuerUserId: 'issuer',
  reviewerUserId: 'reviewer',
  decisionReference: 'Council minute 14',
  provenanceHash: 'a'.repeat(64),
}

describe('POST /api/elections/[id]/succession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for a missing or foreign election and does not write', async () => {
    m.load.mockResolvedValue({ ok: false, code: 'NOT_FOUND', message: 'Election not found.' })
    const { POST } = await import('../elections/[id]/succession/route')
    await expect(POST({ params: { id: ELECTION }, organizationId: ORG, userId: 'reviewer' } as never)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.record).not.toHaveBeenCalled()
  })

  it('returns 501 when the ownership relation is not installed', async () => {
    m.load.mockResolvedValue({ ok: false, code: 'STORE_UNAPPLIED', message: 'unapplied' })
    const { POST } = await import('../elections/[id]/succession/route')
    await expect(POST({ params: { id: ELECTION }, organizationId: ORG, userId: 'reviewer' } as never)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    expect(m.record).not.toHaveBeenCalled()
  })

  it('returns 409 when no mandate has been issued', async () => {
    m.load.mockResolvedValue({ ok: false, code: 'CORRECTION_UNISSUED', message: 'unissued' })
    const { POST } = await import('../elections/[id]/succession/route')
    await expect(POST({ params: { id: ELECTION }, organizationId: ORG, userId: 'reviewer' } as never)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('writes with the kernel grant and returns the receipt', async () => {
    m.load.mockResolvedValue({ ok: true, grant })
    const receipt = { ok: true, replayed: false, successionId: 's', successorElectionId: 'n', predecessorElectionId: ELECTION, version: 1 }
    m.record.mockResolvedValue(receipt)
    const { POST } = await import('../elections/[id]/succession/route')
    await expect(POST({ params: { id: ELECTION }, organizationId: ORG, userId: 'reviewer' } as never)).resolves.toEqual({ data: receipt })
    expect(m.record).toHaveBeenCalledWith(expect.anything(), ELECTION, grant, ORG)
  })

  it('keeps the council vote route unimplemented', () => {
    const vote = readFileSync(join(__dirname, '..', 'elections', '[id]', 'vote', 'route.ts'), 'utf8')
    expect(vote).toContain('notImplemented')
    expect(vote).not.toContain('recordCertifiedSupersession')
  })
})
