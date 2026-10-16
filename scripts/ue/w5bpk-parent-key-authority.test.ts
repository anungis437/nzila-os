import { describe, expect, it } from 'vitest'
import {
  buildParentKeyAuthority,
  recoverKeyAuthority,
  keySources,
} from './w5bpk-parent-key-authority'
import { buildSupplement, generate, main, outputs } from './implement-w5bpk-parent-key-supplement'
import { read } from './w4-physical-producers'
import { replayHash } from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'
import { frozenStatements } from './close-w5a-replay-graph'
import { tableDefinition } from './w5bc-boundary-semantics'

const authority = buildParentKeyAuthority(),
  model = buildSupplement()
describe('bounded ten-key evidence-backed prospective authority', () => {
  it('binds exactly10UUIDPKdefault definitions without a convention-derived policy', () => {
    expect(authority.RECORDS).toHaveLength(10)
    expect(authority.EXACT).toBe(10)
    expect(authority.CONFLICTING_AUTHORITY).toBe(0)
    expect(new Set(authority.RECORDS.map((entry) => entry.PHYSICAL_IDENTITY)).size).toBe(10)
  })
  for (const record of authority.RECORDS) {
    it(`corroborates exact schema/migration semantics:${record.PHYSICAL_IDENTITY}`, () => {
      expect(record.DEFINITION_STATUS).toBe('EXACT')
      expect(record.DATA_TYPE).toBe('uuid')
      expect(record.PRIMARY_KEY_STATUS).toBe('SINGLE_COLUMN_ID')
      expect(record.DEFAULT).toBe('gen_random_uuid()')
      expect(record.IDENTITY_BEHAVIOR).toBe('NONE')
      for (const source of record.EVIDENCE_SOURCES) {
        expect(replayHash(read(source.FILE))).toBe(source.SOURCE_SHA256)
        expect(replayHash(source.EXACT_DEFINITION)).toBe(source.DEFINITION_SHA256)
      }
    })
    it(`detects authoritative type/default conflicts rather than silently choosing:${record.RELATION}`, () => {
      const files = keySources[record.RELATION]
      const schema = read(files.schema),
        migration = read(files.migration)
      const statement = frozenStatements(migration).find(
        (statement) => tableDefinition(statement.TEXT)?.name === record.RELATION,
      )!
      const changedStatement = statement.TEXT.replace(
        record.EVIDENCE_SOURCES[1].EXACT_DEFINITION,
        record.EVIDENCE_SOURCES[1].EXACT_DEFINITION.replace(/UUID/i, 'bigint'),
      )
      expect(changedStatement).not.toBe(statement.TEXT)
      const conflict = recoverKeyAuthority(
        record.RELATION,
        schema,
        migration.slice(0, statement.START) + changedStatement + migration.slice(statement.END),
      )
      expect(conflict.DEFINITION_STATUS).toBe('CONFLICTING_AUTHORITY')
      expect(conflict.EXACT_CANONICAL_DDL).toBeNull()
    })
  }
  it('covers12exact0014keypreconditions but does not fake fullW5eligibility', () => {
    expect(model.supplement.BLOCKED_0014_PARENT_KEY_PRECONDITIONS).toHaveLength(12)
    for (const effect of model.supplement.BLOCKED_0014_PARENT_KEY_PRECONDITIONS) {
      expect(effect.PARENT_KEY_PRECONDITION_AFTER_VERIFIED_SUPPLEMENT).toBe(
        'PROVEN_EXACT_UUID_PRIMARY_KEY',
      )
      expect(effect.SAFE_REPLAY_ELIGIBILITY_AFTER_SUPPLEMENT).toBe(
        'NOT_YET_PROVEN_FULL_BOUNDARY_INSPECTOR_REQUIRED',
      )
    }
    expect(model.supplement.TERMINAL_KEY_AUTHORITY_BLOCKER_COUNT).toBe(0)
  })
  it('preserves all fixed W4P/W5A/migration/W5BC source bytes and evidence', () => {
    for (const [file, hash] of Object.entries(model.supplement.FROZEN_INPUT_COMMITMENTS))
      expect(replayHash(read(file))).toBe(hash)
    expect(model.supplement.DEFERRED_CONSTRAINTS).toBe(7)
    expect(model.supplement.UNRESOLVED_DOWNSTREAM_OPERANDS).toBe(9)
    expect(model.supplement.DATABASE_CONNECTIONS).toBe(0)
    expect(model.supplement.SQL_EXECUTED).toBe(0)
    expect(model.supplement.CANONICAL_CONTRACT_VERSION).toBe('1.3.3')
  })
  it('records10producer/inspector/verifier paths only outside the frozen graph', () => {
    expect(model.plan.PRODUCER_COUNT).toBe(10)
    expect(model.plan.INSPECTOR_COUNT).toBe(10)
    expect(model.plan.VERIFIER_COUNT).toBe(10)
    expect(model.supplement.MUTATING_OPERATIONS).toEqual([])
    expect(model.supplement.EXECUTION_ALLOWED).toBe('NO')
  })
  it('emits exactlysixparent-key artifacts deterministically and verifies persisted bytes', async () => {
    const first = await generate()
    expect(Object.keys(first).sort()).toEqual(Object.values(outputs).sort())
    expect(first).toEqual(await generate())
    await expect(main(['--check', '--self-test'])).resolves.toBeUndefined()
  }, 60000)
  for (const flag of ['--apply', '--connect', '--execute', '--replay', '--publish'])
    it(`denies unauthorized invocation:${flag}`, async () => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_PARENT_KEY_FLAG')
    })
})
