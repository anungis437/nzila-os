import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { replayHash, replayDigest, replayText, replayRecords } from './post-w4p-replay'
import { catalogQueries } from './platform-baseline-promotion'
import { compileEnumWrapper, makeEnumReplayHandler } from './replay-enum-inspection'
import type { ReplayExecutionContext, ReplayExecutionUnit } from './post-w4p-execution'

const { frozen, sourceBytes } = loadFrozenReplay()
const wrappers = frozen.order
  .map((ordered) => frozen.nodes.find((node) => node.REPLAY_UNIT_ID === ordered.REPLAY_UNIT_ID)!)
  .filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT')
const context: ReplayExecutionContext = {
  scope: 'UE_OPERATIONAL',
  actorClass: 'MIGRATION_ADMIN',
  actorPrincipal: 'fake-only',
  targetDigest: replayDigest('fake-op'),
  w4pPlanDigest: replayText(frozen.input.promotionPlan.PLAN_DIGEST),
  w4pVerificationDigest: replayDigest('w4p'),
  supplementPlanDigest: replayDigest('pkplan'),
  supplementVerificationDigest: replayDigest('pk'),
  exclusiveExecutionReference: 'fake-only',
}
function unitFor(node: (typeof wrappers)[number]) {
  const binding = replayRecords(frozen.register.BOUND_REPLAY_RECORDS).find(
    (entry) => entry.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID,
  )!
  const range = binding.SOURCE_RANGE
  if (!Array.isArray(range) || typeof range[0] !== 'number' || typeof range[1] !== 'number')
    throw new Error('EXACT_RANGE_REQUIRED')
  const sql = sourceBytes[replayText(node.SOURCE_FILE)].slice(range[0], range[1])
  const contract = compileEnumWrapper(sql, replayText(node.EXACT_UNIT_SHA256))
  const unit: ReplayExecutionUnit = {
    node,
    sql,
    contractDigest: contract.contractDigest,
    transactionClass: 'TRANSACTION_COMPATIBLE',
    predecessors: frozen.edges
      .filter((edge) => edge.TO === node.REPLAY_UNIT_ID)
      .map((edge) => replayText(edge.FROM)),
  }
  return { unit, contract }
}
describe('all41concrete source-anchored enum inspectors and postcondition verifiers', () => {
  it('binds exactly41wholeDOwrappers with uniqueunitIDs and preserved source bytes', () => {
    expect(wrappers).toHaveLength(41)
    expect(new Set(wrappers.map((node) => node.REPLAY_UNIT_ID)).size).toBe(41)
  })
  for (const node of wrappers) {
    const { unit, contract } = unitFor(node)
    it(`exact entire ordered definition:${node.REPLAY_UNIT_ID}`, async () => {
      const calls: { sql: string; parameters: string[] }[] = []
      const handler = makeEnumReplayHandler(unit)
      const reader = {
        async query(sql: string, parameters: string[]) {
          calls.push({ sql, parameters })
          return [{ kind: 'e', members: [...contract.members] }]
        },
      }
      const result = await handler.inspect(reader, context, unit, null)
      expect(result.state).toBe('ALREADY_COMPLETE')
      expect(calls).toEqual([
        { sql: catalogQueries.type, parameters: [contract.schema, contract.name] },
      ])
      expect(replayHash(unit.sql)).toBe(unit.node.EXACT_UNIT_SHA256)
    })
    it(`absent state needs namespace proof;drift/extra/reordered members deny:${node.REPLAY_UNIT_ID}`, async () => {
      const handler = makeEnumReplayHandler(unit)
      const absent = {
        async query(sql: string) {
          return sql === catalogQueries.type ? [] : [{ name: 'public' }]
        },
      }
      expect((await handler.inspect(absent, context, unit, null)).state).toBe('REPLAY_REQUIRED')
      for (const members of [
        [...contract.members, 'unapproved'],
        contract.members.slice(1),
        [...contract.members].reverse(),
      ]) {
        const result = await handler.inspect(
          {
            async query() {
              return [{ kind: 'e', members }]
            },
          },
          context,
          unit,
          null,
        )
        expect(result.state).toBe('DRIFTED')
      }
      expect(
        (
          await handler.inspect(
            {
              async query() {
                return []
              },
            },
            context,
            unit,
            null,
          )
        ).state,
      ).toBe('PRECONDITION_MISSING')
      expect(
        (
          await handler.inspect(
            {
              async query() {
                return [{ kind: 'c', members: contract.members }]
              },
            },
            context,
            unit,
            null,
          )
        ).state,
      ).toBe('DRIFTED')
    })
  }
  it('does not treat source hashes or adapter completion booleans as enum proof', async () => {
    const { unit } = unitFor(wrappers[0]),
      handler = makeEnumReplayHandler(unit)
    await expect(
      handler.inspect(
        {
          async query() {
            return [{ complete: true }]
          },
        },
        context,
        unit,
        null,
      ),
    ).rejects.toThrow('REPLAY_ENUM_CATALOG_ROW_INVALID')
    await expect(
      handler.inspect(
        {
          async query() {
            return [{ kind: 'e', members: 'a,b' }]
          },
        },
        context,
        unit,
        null,
      ),
    ).rejects.toThrow('REPLAY_ENUM_CATALOG_ROW_INVALID')
    expect(
      (
        await handler.inspect(
          {
            async query() {
              throw new Error('NO_QUERY_EXPECTED')
            },
          },
          { ...context, scope: 'FINANCIAL_SERVICE' },
          unit,
          null,
        )
      ).state,
    ).toBe('PRECONDITION_MISSING')
  })
  it('rejects changed source,extra operations,altered exception behavior and changed handler binding', () => {
    const { unit } = unitFor(wrappers[0])
    expect(() =>
      compileEnumWrapper(unit.sql + ' ', replayText(unit.node.EXACT_UNIT_SHA256)),
    ).toThrow('REPLAY_ENUM_SOURCE_HASH_DRIFT')
    const changed = unit.sql.replace(/duplicate_object/i, 'undefined_object')
    expect(() => compileEnumWrapper(changed, replayHash(changed))).toThrow(
      'REPLAY_ENUM_WRAPPER_SEMANTICS_UNSUPPORTED',
    )
    const extra = unit.sql + '\nSELECT 1;'
    expect(() => compileEnumWrapper(extra, replayHash(extra))).toThrow(
      'REPLAY_ENUM_WRAPPER_SEMANTICS_UNSUPPORTED',
    )
    expect(() => makeEnumReplayHandler({ ...unit, contractDigest: 'wrong' })).toThrow(
      'REPLAY_ENUM_CONTRACT_BINDING_DRIFT',
    )
  })
})
