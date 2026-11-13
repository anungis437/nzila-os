import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const state = vi.hoisted(() => ({
  context: vi.fn(), execute: vi.fn(), audit: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/lib/auth/canonical-context', () => ({getCanonicalOrganizationContext: state.context}))
vi.mock('@/lib/db/with-rls-context', () => ({withRLSContext: state.transaction}))
vi.mock('@/lib/audit/atomic-audit', () => ({persistAtomicAudit: state.audit}))
import { buildCanonicalUnionEvidencePack } from '../canonical-evidence'

const orgId = '11111111-1111-4111-8111-111111111111'
const actorId = '22222222-2222-4222-8222-222222222222'
const action = { actionType: 'CASE_CREATED', orgId, actorId,
  artifacts: [{type: 'case_record', data: {greeting: 'Bonjour, ça va? 😀', n: 0.000001}}] }

describe('canonical V2 action evidence', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.context.mockResolvedValue({userId: actorId, organizationId: orgId})
    state.execute.mockResolvedValue([{id: 'sealed'}])
    state.transaction.mockImplementation(async (_scope, fn) => fn({execute: state.execute}))
  })
  it('uses the admitted Django pack/artifact models and a Python-compatible seal, without platform document/blob claims', async () => {
    const result = await buildCanonicalUnionEvidencePack(action)
    expect(state.context).toHaveBeenCalledWith({organizationId: orgId, expectedActorUserId: actorId})
    expect(state.transaction).toHaveBeenCalledWith({organizationId: orgId}, expect.any(Function))
    const queries = state.execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query))
    expect(queries.map(query => query.sql).join('\n')).toContain('INSERT INTO public.evidence_artifacts')
    expect(queries.map(query => query.sql).join('\n')).not.toMatch(/INSERT INTO (?:public\.)?documents|evidence_pack_artifacts|blob_path/)
    const artifact = queries[1]
    // Independent vector from Python hashlib.sha256(json.dumps(content, sort_keys=True).encode()).
    expect(artifact.params).toContain('ca8833725260850b211fe04acee8695c8ea9aee4371259800be9e48d94619421')
    expect(artifact.params).toContain(150)
    expect(result).toMatchObject({orgId, status: 'sealed', artifactCount: 1, storage: 'canonical-postgres'})
    expect(result).not.toHaveProperty('indexBlobPath')
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({execute: state.execute}), expect.objectContaining({
      organizationId: orgId, userId: actorId, resourceId: result.packId, action: 'evidence.pack.seal',
      details: {actionType: 'CASE_CREATED', artifactCount: 1, packHash: result.packHash},
    }))
  })
  it('does not create evidence when the supplied actor or organization cannot bind to the real session', async () => {
    state.context.mockRejectedValue(new Error('ACTOR_MISMATCH'))
    await expect(buildCanonicalUnionEvidencePack(action)).rejects.toThrow('ACTOR_MISMATCH')
    expect(state.transaction).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })
  it('rejects empty or non-serializable evidence before requesting a tenant transaction', async () => {
    await expect(buildCanonicalUnionEvidencePack({...action, artifacts: []})).rejects.toThrow('between 1 and 20')
    await expect(buildCanonicalUnionEvidencePack({...action, artifacts: [{type: 'case', data: undefined}]})).rejects.toThrow('Invalid canonical')
    expect(state.transaction).not.toHaveBeenCalled()
  })
  it('never reports a sealed pack if the mandatory in-transaction audit fails', async () => {
    state.audit.mockRejectedValue(new Error('AUDIT_UNAVAILABLE'))
    await expect(buildCanonicalUnionEvidencePack(action)).rejects.toThrow('AUDIT_UNAVAILABLE')
    expect(state.audit.mock.calls[0][0].execute).toBe(state.execute)
  })
  it('refuses an unsealed result if the tenant-scoped update did not affect exactly one draft', async () => {
    state.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await expect(buildCanonicalUnionEvidencePack(action)).rejects.toThrow('could not be sealed')
    expect(state.audit).not.toHaveBeenCalled()
  })
})
