/** Orchestration/response component tests. Private SQL authority is qualified
 * separately; these transport doubles do not prove database authorization. */
import { createHash } from 'node:crypto'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ execute: vi.fn(), context: vi.fn(), blob: vi.fn(), events: [] as string[], commits: 0, failCommit: 0 }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: state.context }))
vi.mock('@/lib/blob-client', () => ({ readBlobBounded: state.blob, BlobTooLargeError: class extends Error {} }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { EXTERNAL_READ_MAX_BYTES, readCanonicalExternalResource } from '../reader'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const resource = { organizationId: id(1), matterType: 'grievance', matterId: id(2), documentId: id(3) }
const bytes = Buffer.from('Synthetic exact reviewed bytes')
const located = () => ({ qualificationId: id(4), qualificationHash: hash('binding'), documentId: id(3), versionId: id(5),
  versionNo: 2, storageKey: 'synthetic/fixture.bin', storageKeySha256: hash('synthetic/fixture.bin'),
  checksumSha256: hash(bytes), sizeBytes: bytes.length, filename: '../fixture.bin', mimeType: 'application/octet-stream' })

beforeEach(() => {
  vi.clearAllMocks(); state.events.length = 0; state.commits = 0; state.failCommit = 0
  state.context.mockImplementation(async (work: (tx: { execute: typeof state.execute }) => Promise<unknown>) => {
    expect(typeof work).toBe('function') // target organization is never bound as a tenant context
    state.events.push('begin')
    const result = await work({ execute: state.execute })
    state.commits++
    if (state.failCommit === state.commits) throw new Error('Synthetic commit/audit failure')
    state.events.push('commit'); return result
  })
  state.execute.mockImplementation(async (statement: SQL) => {
    const compiled = new PgDialect().sqlToQuery(statement)
    expect(compiled.sql).toContain('public.ue_external_resource_read_v1(')
    expect(compiled.params.slice(0, 3)).toEqual([resource.organizationId, resource.matterId, resource.documentId])
    const operation = compiled.params[3]
    state.events.push(String(operation))
    return [{ payload: operation === 'locate_download' ? located() : {
      released: true, qualificationId: id(4), qualificationHash: hash('binding'),
    } }]
  })
  state.blob.mockImplementation(async () => {
    expect(state.events.at(-1)).toBe('commit')
    state.events.push('blob'); return bytes
  })
})

describe('canonical protected external-read orchestration', () => {
  it('releases exact verified bytes only after revalidation and final audit commit', async () => {
    const response = await readCanonicalExternalResource('download', resource)
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    expect(state.events).toEqual(['begin', 'locate_download', 'commit', 'blob', 'begin', 'finalize_download', 'commit'])
    expect(state.blob).toHaveBeenCalledWith('synthetic/fixture.bin', EXTERNAL_READ_MAX_BYTES)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-disposition')).toBe("attachment; filename*=UTF-8''fixture.bin")
    const finalize = new PgDialect().sqlToQuery(state.execute.mock.calls[1][0])
    expect(finalize.params[4]).toBe(hash('binding'))
    expect(JSON.parse(String(finalize.params[5]))).toEqual({ qualificationId: id(4), documentId: id(3), versionId: id(5),
      versionNo: 2, checksumSha256: hash(bytes), sizeBytes: bytes.length })
  })

  it.each(['42501', 'MEMBERSHIP_REQUIRED', 'ACTOR_MISMATCH', 'SESSION_AUTHORITY_REQUIRED'])(
    'releases nothing when final source revalidation refuses %s after the storage gap', async code => {
      state.execute.mockImplementationOnce(async () => [{ payload: located() }])
        .mockRejectedValueOnce(Object.assign(new Error('Synthetic revoked/changed authority'), { code }))
      const response = await readCanonicalExternalResource('download', resource)
      expect(response.status).toBe(403)
      expect(await response.text()).not.toContain(bytes.toString())
      expect(state.commits).toBe(1)
    })

  it('releases nothing if the final audit/transaction commit fails', async () => {
    state.failCommit = 2
    const response = await readCanonicalExternalResource('download', resource)
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain(bytes.toString())
  })

  it.each([Buffer.from('Different bytes'), Buffer.from('')])('refuses mismatching actual bytes before final audit', async replacement => {
    state.blob.mockResolvedValue(replacement)
    const response = await readCanonicalExternalResource('download', resource)
    expect(response.status).toBe(503)
    expect(state.execute).toHaveBeenCalledTimes(1)
  })

  it('refuses a substituted storage key before touching storage', async () => {
    state.execute.mockResolvedValue([{ payload: { ...located(), storageKey: 'another/key' } }])
    expect((await readCanonicalExternalResource('download', resource)).status).toBe(403)
    expect(state.blob).not.toHaveBeenCalled()
  })

  it('refuses substituted qualification identity returned by finalization', async () => {
    state.execute.mockResolvedValueOnce([{ payload: located() }]).mockResolvedValueOnce([{ payload: {
      released: true, qualificationId: id(99), qualificationHash: hash('binding'),
    } }])
    expect((await readCanonicalExternalResource('download', resource)).status).toBe(403)
  })

  it('denies a missing protected qualification without reading storage', async () => {
    state.execute.mockResolvedValue([])
    expect((await readCanonicalExternalResource('download', resource)).status).toBe(403)
    expect(state.blob).not.toHaveBeenCalled()
  })

  it('returns only the strict matter projection after its read/audit commit', async () => {
    const projection = { id: id(2), caseNumber: 'SYNTHETIC', title: 'Synthetic matter', status: 'new', step: null,
      filedDate: null, responseDeadline: null, summary: null }
    state.execute.mockResolvedValue([{ payload: projection }])
    const response = await readCanonicalExternalResource('matter', resource)
    expect(await response.json()).toEqual({ data: projection })
    expect(state.events.at(-1)).toBe('commit')
    state.execute.mockResolvedValue([{ payload: { ...projection, description: 'internal-only' } }])
    const refused = await readCanonicalExternalResource('matter', resource)
    expect(refused.status).toBe(503)
    expect(await refused.text()).not.toContain('internal-only')
  })

  it.each([{ ...resource, matterId: 'bad' }, { ...resource, organizationId: 'bad' }, { ...resource, documentId: 'bad' },
    { ...resource, matterType: 'wcb_claim' }, { ...resource, documentId: undefined }])('refuses invalid or unsupported scope before calling the private reader', async invalid => {
    expect((await readCanonicalExternalResource('download', invalid)).status).toBe(403)
    expect(state.context).not.toHaveBeenCalled()
  })
})
