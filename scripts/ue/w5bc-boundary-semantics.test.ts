import { describe, expect, it } from 'vitest'
import {
  buildBoundaryClosure,
  effectClass,
  payloadFile,
  tableDefinition,
  transactionInventory,
} from './w5bc-boundary-semantics'
import { loadFrozenReplay, buildImplementation } from './implement-w5b-post-w4p-replay'
import { frozenStatements } from './close-w5a-replay-graph'
import { sqlTokens } from './close-w4t-named-types'
import { read } from './w4-physical-producers'
import {
  replayHash,
  replayRecords,
} from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'

const { frozen, sourceBytes } = loadFrozenReplay()
const model = buildBoundaryClosure(frozen, sourceBytes, read(payloadFile))
describe('23-boundary exact executable/trivia accounting', () => {
  it('accounts23 boundaries and762 indivisible executable effects,not commented financial design DDL', () => {
    expect(model.ledger.BOUNDARY_COUNT).toBe(23)
    expect(model.ledger.EFFECT_COUNT).toBe(762)
    expect(model.ledger.UNACCOUNTED_EXECUTABLE_EFFECTS).toBe(0)
    expect(model.ledger.W5A_GRAPH_RECOMPUTED_SEMANTICALLY).toBe('NO')
    const financial = model.ledger.BOUNDARIES.find(
      (boundary) => boundary.DATABASE_SCOPE === 'FINANCIAL_SERVICE',
    )!
    expect(financial.EFFECTS).toEqual([])
    expect(financial.STATEMENT_COUNT).toBe(0)
    expect(financial.BYTE_OWNERSHIP).toEqual([
      {
        RANGE: [0, 284147],
        OWNER: 'NON_EXECUTABLE_TRIVIA',
        SHA256: financial.SOURCE_SHA256,
      },
    ])
  })
  for (const boundary of model.ledger.BOUNDARIES)
    it(`owns every UTF8 byte exactly once:${boundary.BOUNDARY_ID}`, () => {
      const bytes = Buffer.from(sourceBytes[boundary.SOURCE_PATH], 'utf8')
      expect(boundary.SOURCE_SHA256).toBe(replayHash(bytes.toString('utf8')))
      let end = 0
      for (const owner of boundary.BYTE_OWNERSHIP) {
        expect(owner.RANGE[0]).toBe(end)
        expect(owner.RANGE[1]).toBeGreaterThan(end)
        const owned = bytes.subarray(owner.RANGE[0], owner.RANGE[1]).toString('utf8')
        expect(replayHash(owned)).toBe(owner.SHA256)
        if (owner.OWNER === 'NON_EXECUTABLE_TRIVIA') expect(sqlTokens(owned)).toEqual([])
        end = owner.RANGE[1]
      }
      expect(end).toBe(bytes.length)
      expect(frozenStatements(bytes.toString('utf8'))).toHaveLength(boundary.EFFECT_COUNT)
      expect(boundary.EFFECTS.map((effect) => effect.SOURCE_ORDINAL)).toEqual(
        Array.from({ length: boundary.EFFECT_COUNT }, (_, i) => i + 1),
      )
    })
  for (const boundary of model.ledger.BOUNDARIES)
    for (const effect of boundary.EFFECTS)
      it(`binds whole effect and explicit inspection/transaction evidence:${effect.EFFECT_ID}`, () => {
        const source = Buffer.from(sourceBytes[boundary.SOURCE_PATH], 'utf8')
        const exact = source
          .subarray(effect.SOURCE_BYTE_RANGE[0], effect.SOURCE_BYTE_RANGE[1])
          .toString('utf8')
        expect(exact).toBe(effect.COMPARATOR.EXACT_SOURCE_SEMANTICS)
        expect(replayHash(exact)).toBe(effect.EXACT_EFFECT_SHA256)
        expect(effect.COMPARATOR.CLASS).not.toBe('OBJECT_EXISTS')
        expect(effect.COMPARATOR.READ_ONLY_EVIDENCE_PLAN.length).toBeGreaterThan(0)
        expect(effect.COMPARATOR.IMPLEMENTATION_STATUS).toBe(
          'SOURCE_BOUND_INSPECTION_PLAN_ONLY_NOT_FULL_COMPARATOR',
        )
        expect(effect.TRANSACTION_INVENTORY.CLASS).toBe('TRANSACTION_COMPATIBLE')
        expect(effect.TRANSACTION_INVENTORY.ROLLBACK_PROOF).toBe('NOT_EXECUTED')
        if (effect.INDIVISIBLE) expect(frozenStatements(exact)).toHaveLength(1)
        if (effect.HELPER_DEFINITION)
          expect(effect.HELPER_DEFINITION.hash).toBe(replayHash(effect.HELPER_DEFINITION.sql))
      })
  it('does not silently accept unknown source effects or nontransactional commands', () => {
    expect(() => effectClass('VACUUM x;')).toThrow('UNCLASSIFIED_EXECUTABLE_EFFECT')
    for (const sql of [
      'COMMIT;',
      'ROLLBACK;',
      'CREATE INDEX CONCURRENTLY x ON y(z);',
      "SELECT nextval('seq');",
      "SELECT setval('seq',2);",
    ])
      expect(() => transactionInventory(sql)).toThrow('UNPROVEN_NONTRANSACTIONAL_SOURCE_EFFECT')
    expect(() =>
      transactionInventory("DO $$ BEGIN EXECUTE 'CREATE INDEX CONCURRENTLY x ON y(z)'; END $$;"),
    ).toThrow('UNPROVEN_DYNAMIC_TRANSACTION_EFFECT')
  })
  it('handles quoted identifiers,UTF8,commas/semicolons inside strings and nested comments without flattening DO', () => {
    const sql =
      '/* outer /* nested */ comment */ CREATE TABLE "Mixed" ("é" varchar(3) DEFAULT \'a,;\', "id" uuid, CONSTRAINT "pk" PRIMARY KEY("id")); DO $tag$ BEGIN RAISE NOTICE \'x;\'; END $tag$;'
    expect(frozenStatements(sql)).toHaveLength(2)
    const definition = tableDefinition(frozenStatements(sql)[0].TEXT)!
    expect(definition.name).toBe('Mixed')
    expect(definition.fields.map((field) => field.name)).toEqual(['é', 'id'])
    expect(definition.constraints).toEqual(['CONSTRAINT "pk" PRIMARY KEY("id")'])
  })
  it('rejects source/payload drift before emitting a closure', () => {
    expect(() =>
      buildBoundaryClosure(
        frozen,
        { ...sourceBytes, [model.ledger.BOUNDARIES[0].SOURCE_PATH]: 'SELECT 1;' },
        read(payloadFile),
      ),
    ).toThrow('BOUNDARY_SOURCE_DRIFT')
    expect(() => buildBoundaryClosure(frozen, sourceBytes, read(payloadFile) + ' ')).toThrow(
      'W4P_PAYLOAD_SOURCE_DRIFT',
    )
  })
})

describe('irreducible source-native policy-parent-key counterexample', () => {
  it('narrows the final ceiling to exactly one boundary,12 source effects and10 parent keys', () => {
    expect(model.closure.IRREDUCIBLE_BOUNDARY_COUNT).toBe(1)
    expect(model.closure.IRREDUCIBLE_EFFECT_COUNT).toBe(12)
    expect(
      new Set(model.closure.IRREDUCIBLE_BLOCKERS.map((entry) => entry.PHYSICAL_IDENTITY)).size,
    ).toBe(10)
    const rows = model.closure.ROWS.filter((row) => row.STATUS === 'IRREDUCIBLE_BLOCKER')
    expect(rows).toHaveLength(1)
    expect(rows[0].BOUNDARY_ID).toBe('UE-W5A-MIGRATION-c1a4ed09468e3478')
    expect(rows[0].EXACT_BLOCKING_EFFECT_IDS).toEqual(
      [86, 87, 88, 89, 90, 91, 92, 94, 96, 99, 100, 101].map(
        (ordinal) => `UE-W5A-MIGRATION-c1a4ed09468e3478:E${String(ordinal).padStart(3, '0')}`,
      ),
    )
  })
  for (const blocker of model.closure.IRREDUCIBLE_BLOCKERS)
    it(`binds mandatory W4P parent shape,source helper and zero-send denial:${blocker.EFFECT_ID}`, () => {
      expect(blocker.W4P_SQL_SHA256).toBe(replayHash(String(blocker.W4P_SQL)))
      expect(
        tableDefinition(String(blocker.W4P_SQL))?.fields.some((field) => field.name === 'id'),
      ).toBe(false)
      expect(blocker.MISSING_COLUMNS).toEqual(['id'])
      expect(blocker.HELPER_SOURCE_DEFINITION?.sql).toContain('parent.id = %I.%I')
      expect(blocker.EXECUTABLE_PARENT_COLUMN_WRITERS).toEqual([])
      expect(blocker.W4P_ADD_COLUMN_WRITERS).toEqual([])
      expect(blocker.SEND_ATTEMPTS).toBe(0)
      expect(blocker.SAFE_REPLAY_REQUIRED_ELIGIBILITY).toBe('NO')
      expect(blocker.RECEIPT_CAN_REPAIR_MISSING_DEFINITION).toBe('NO')
      expect(blocker.WHY_NO_COMPLETION_COMPARATOR_EXISTS).toContain('DOES exist')
      expect(
        replayRecords(frozen.register.UNRESOLVED_OPERAND_BINDINGS).some(
          (operand) =>
            operand.PHYSICAL_OPERAND_IDENTITY ===
            `union-eyes::COLUMN::${blocker.PHYSICAL_IDENTITY}.id`,
        ),
      ).toBe(false)
    })
  it('keeps107-unit coverage claims honest and original downstream/frozen commitments intact', () => {
    const final = buildImplementation()
    expect(final.registryPacket.REGISTRY).toHaveLength(107)
    expect(final.report.summary.IMPLEMENTED_REPLAY_UNITS).toBe(0)
    expect(final.report.summary.IRREDUCIBLE_BOUNDARY_COUNT).toBe(1)
    expect(final.report.summary.UNPROVEN_TRANSACTION_ASSIGNMENTS).toBe(0)
    expect(
      final.report.priorStaticAssessment.HISTORICAL_SUMMARY.UNPROVEN_TRANSACTION_ASSIGNMENTS,
    ).toBe(23)
    expect(final.report.blockers).toHaveLength(12)
    expect(final.report.phaseStatus.CANONICAL_CONTRACT_VERSION).toBe('1.3.3')
    expect(final.report.phaseStatus.W6).toBe('NOT_AUTHORIZED')
    expect(final.report.finalStaticClosure.FAKE_ROLLBACK).toBe('NOT_IMPLEMENTED_NOT_PROVEN')
    expect(final.report.finalStaticClosure.REPLAY_NOOP).toBe('NOT_ESTABLISHED_0_OF_107_HANDLERS')
    expect(final.report.proofBoundaries.DATABASE_CONNECTIONS).toBe(0)
    expect(final.report.proofBoundaries.SQL_EXECUTED).toBe(0)
  })
})
