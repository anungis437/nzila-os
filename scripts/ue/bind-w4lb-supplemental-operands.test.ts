import { describe, expect, it } from 'vitest'
import {
  buildBindings,
  exactHandoffIds,
  exactOperands,
  files,
  finalBoundary,
  generate,
  main,
  registryEvidence,
  registryNames,
  scanExactOperand,
} from './bind-w4lb-supplemental-operands'
import type { buildClosure } from './close-w4c-constraint-timing'
import { digest, read, sha } from './w4-physical-producers'

const model = buildBindings()
const deferred: ReturnType<typeof buildClosure>['registry'] = JSON.parse(read(files.deferred))
const canonical: { frozenMigrationManifest: { FILE: string; SHA256: string }[] } = JSON.parse(
  read(files.canonical),
)
describe('W4LB bounded supplemental operand evidence', () => {
  it('records requested10 versus exact listed/canonical9 without inventing a tenth', () => {
    expect(model.operandRegistry.records).toHaveLength(9)
    expect(new Set(exactOperands).size).toBe(9)
    expect(model.report.countDiscrepancy).toMatchObject({
      REQUESTED_COUNT: 10,
      LISTED_COUNT: 9,
      CANONICAL_COUNT: 9,
      TENTH_IDENTITY: null,
    })
    expect(model.operandRegistry.records.map((record) => record.PHYSICAL_OPERAND_IDENTITY)).toEqual(
      deferred.handoffs.flatMap((record) => record.NON_W4_OPERAND_IDENTITIES),
    )
    expect(model.report.summary.UNACCOUNTED_LISTED_OPERANDS).toBe(0)
    expect(model.report.validation.REQUESTED10_DENOMINATOR).toBe('NOT_SATISFIED_INPUT_LIST_HAS9')
  })
  it.each(exactOperands)(
    'retains exact missing operand and bounded negative evidence:%s',
    (identity) => {
      const record = model.operandRegistry.records.find(
        (record) => record.PHYSICAL_OPERAND_IDENTITY === `union-eyes::COLUMN::${identity}`,
      )!
      expect(record.BINDING_CLASS).toBe('NO_PRODUCER_OR_BOUNDARY_EVIDENCE')
      expect(record.PRODUCER_ID).toBeNull()
      expect(record.BOUNDARY_ID).toBeNull()
      expect(record.POSITION).toBeNull()
      expect(record.EXACT_OPERATION).toBeNull()
      expect(record.PRODUCER_EVIDENCE).toEqual([])
      expect(
        record.SEARCHED_FIXED_EVIDENCE.REGISTRY_EVIDENCE.map((record) => record.REGISTRY),
      ).toEqual([...registryNames])
      expect(record.SEARCHED_FIXED_EVIDENCE.FROZEN_MIGRATION_SEARCHES).toHaveLength(23)
      expect(
        record.SEARCHED_FIXED_EVIDENCE.FROZEN_MIGRATION_SEARCHES.every(
          (search) => search.PHYSICAL_PRODUCING_OPERATIONS.length === 0,
        ),
      ).toBe(true)
      expect(
        record.SEARCHED_FIXED_EVIDENCE.REGISTRY_EVIDENCE.every(
          (search) => search.EXACT_MATCH_RECORDS.length === 0,
        ),
      ).toBe(true)
      expect(record.DECLARATION_EVIDENCE.CREATION_AUTHORITY).toBe('NO')
      expect(record.DECLARATION_EVIDENCE.EXECUTION_AUTHORITY).toBe('NO')
      expect(record.MISSING_FACT).toBeTruthy()
      expect(record.EXECUTION_ALLOWED).toBe('NO')
    },
  )
  it.each(exactHandoffIds)(
    'preserves exact canonical handoff and all missing operands:%s',
    (id) => {
      const record = model.handoffRegistry.records.find(
        (record) => record.DEFERRED_CONSTRAINT_HANDOFF_ID === id,
      )!
      const original = deferred.handoffs.find(
        (record) => record.DEFERRED_CONSTRAINT_HANDOFF_ID === id,
      )!
      expect(record.CANONICAL_HANDOFF).toEqual(original)
      expect(record.MISSING_OPERAND_IDENTITIES).toEqual(original.NON_W4_OPERAND_IDENTITIES)
      expect(record.HANDOFF_BINDING_CLASS).toBe('BLOCKED_MISSING_OPERAND_BINDING')
      expect(record.FINAL_OPERAND_IDENTITY).toBeNull()
      expect(record.FINAL_OPERAND_POSITION).toBeNull()
      expect(record.FINAL_OPERAND_PRODUCER_OR_BOUNDARY_ID).toBeNull()
      expect(record.CONSTRAINT_MATERIALIZATION_AFTER).toBeNull()
      expect(record.EXISTING_W5_MATCH).toBe('NO_EXISTING_W5_HANDOFF_EXACT_MATCH')
      expect(record.SUPPLEMENTAL_COMPATIBILITY_ORDERING_REQUIRED).toBe(
        'NOT_DERIVABLE_UNBOUND_OPERANDS',
      )
      expect(record.SUPPLEMENTAL_ORDERING_REQUIREMENTS).toEqual([])
    },
  )
  it.each(canonical.frozenMigrationManifest)(
    'hash-verifies frozen source without rewriting:$FILE',
    (source) => {
      expect(sha(read(source.FILE))).toBe(source.SHA256)
      expect(model.report.preservation.BYTE_COMMITMENTS[source.FILE]).toBe(source.SHA256)
    },
  )
  it.each([
    'CREATE TABLE public.example (id uuid, target text);',
    'CREATE TABLE IF NOT EXISTS "public"."example" ("target" text);',
    'DO $$ BEGIN CREATE TABLE example (target text); END $$;',
    'ALTER TABLE public.example ADD COLUMN target text;',
    'ALTER TABLE "public"."example" ADD COLUMN IF NOT EXISTS "target" text;',
    'ALTER TABLE public.example ADD target text;',
  ])('recognizes exact physical creation,not declarations:%s', (text) => {
    const result = scanExactOperand(text, 'public.example.target')
    expect(result.PHYSICAL_PRODUCING_OPERATIONS).toHaveLength(1)
    const operation = result.PHYSICAL_PRODUCING_OPERATIONS[0]
    expect(sha(operation.EXACT_OPERATION)).toBe(operation.EXACT_OPERATION_SHA256)
    expect(operation.EXACT_OPERATION).toContain('target')
  })
  it.each([
    '-- CREATE TABLE example (target text);\nSELECT 1;',
    "SELECT 'example', 'target';",
    "SELECT ue_create_direct_org_rls_policy('example'); SELECT target FROM elsewhere;",
    'CREATE TABLE example_similar (target text);',
    'CREATE TABLE example (target_similar text);',
    'CREATE TABLE example (id uuid, CONSTRAINT target UNIQUE(id));',
    'CREATE TABLE other.example (target text);',
    'ALTER TABLE example ADD CONSTRAINT target CHECK (id IS NOT NULL);',
    'ALTER TABLE example ALTER COLUMN target TYPE text;',
    "EXECUTE 'CREATE TABLE example (target text)';",
    '/* nested /* CREATE TABLE example (target text); */ comment */ SELECT 1;',
  ])('rejects references,aliases,constraints and dynamic strings as production:%s', (text) => {
    expect(scanExactOperand(text, 'public.example.target').PHYSICAL_PRODUCING_OPERATIONS).toEqual(
      [],
    )
  })
  it('does not treat file-wide pair co-occurrence/RLS relation guards as excluded-column proof', () => {
    const record = model.operandRegistry.records.find(
      (record) => record.COLUMN_IDENTITY === 'contract_id',
    )!
    const matches = record.SEARCHED_FIXED_EVIDENCE.FROZEN_MIGRATION_SEARCHES.filter(
      (search) => search.FILE_LEVEL_EXACT_PAIR_MATCH,
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].SOURCE_FILE).toContain('0014_lineage_restoration_rls_closure.sql')
    expect(matches[0].PHYSICAL_PRODUCING_OPERATIONS).toEqual([])
    expect(matches[0].EXCLUDED_RELATION_REFERENCES.length).toBeGreaterThan(0)
  })
  it('matches exact identity values only,not name similarity or substrings', () => {
    const registries = Object.fromEntries(registryNames.map((name) => [name, []]))
    const identity = 'union-eyes::COLUMN::public.example.target'
    const input: Parameters<typeof registryEvidence>[0] = {
      canonicalProducerPlan: [{ EXPECTED_OUTPUT_IDENTITIES: [identity] }],
      platformProducerRegistry: [{ PHYSICAL_IDENTITIES: [identity + '_similar'] }],
      physicalIdentityAuthority: [],
      djangoProducerRegistry: [],
      djangoExecutionRegistry: [],
      rawOperationProducerRegistry: [],
      blockedProducerPlanEntries: [],
      w5OrderingHandoff: [],
    }
    expect(Object.keys(registries)).toEqual([...registryNames])
    const result = registryEvidence(input, identity)
    expect(result[0].EXACT_MATCH_RECORDS).toHaveLength(1)
    expect(result[1].EXACT_MATCH_RECORDS).toEqual([])
  })
  it('derives final boundaries using accepted positions and never fabricates a missing position', () => {
    const binding = (id: string, position: number | null, producer: string | null) => ({
      PHYSICAL_OPERAND_IDENTITY: id,
      POSITION: position,
      PRODUCER_OR_BOUNDARY_ID: producer,
      BINDING_CLASS:
        position === null
          ? 'NO_PRODUCER_OR_BOUNDARY_EVIDENCE'
          : 'EXACT_PHYSICAL_PRODUCER_IDENTIFIED',
    })
    expect(finalBoundary([binding('a', 9, 'later'), binding('b', 2, 'earlier')])).toMatchObject({
      FINAL_OPERAND_IDENTITIES: ['a'],
      FINAL_OPERAND_POSITION: 9,
      FINAL_OPERAND_PRODUCER_OR_BOUNDARY_ID: 'later',
    })
    expect(finalBoundary([binding('a', 9, 'x'), binding('b', 9, 'y')])).toBeNull()
    expect(finalBoundary([binding('a', 9, 'x'), binding('b', 9, 'x')])).toMatchObject({
      FINAL_OPERAND_IDENTITIES: ['a', 'b'],
      FINAL_OPERAND_POSITION: 9,
      FINAL_OPERAND_PRODUCER_OR_BOUNDARY_ID: 'x',
    })
    expect(finalBoundary([binding('a', 9, null)])).toBeNull()
    expect(finalBoundary([binding('a', 9, 'x'), binding('b', null, null)])).toBeNull()
    expect(finalBoundary([])).toBeNull()
  })
  it('compares every existing86 W5 physical identity against all exact supplemental operands', () => {
    const producer: { w5OrderingHandoff: { PHYSICAL_IDENTITY: string }[] } = JSON.parse(
      read(files.producer),
    )
    expect(producer.w5OrderingHandoff).toHaveLength(86)
    const identities = model.operandRegistry.records.map(
      (record) => record.PHYSICAL_OPERAND_IDENTITY,
    )
    for (const handoff of producer.w5OrderingHandoff)
      expect(identities.includes(handoff.PHYSICAL_IDENTITY)).toBe(false)
    expect(model.report.preservation.W5_86_SHA256).toBe(digest(producer.w5OrderingHandoff))
    expect(model.report.summary.SUPPLEMENTAL_ORDERING_DERIVATION).toContain('NOT_DERIVABLE')
  })
  it('preserves previous127 mechanics,86 ordering records,contract and all fixed bytes', () => {
    for (const [file, hash] of Object.entries(model.report.preservation.BYTE_COMMITMENTS))
      expect(sha(read(file))).toBe(hash)
    expect(model.report.preservation.W4LC_EXISTING127_CLASSIFICATION_REUSED).toBe('YES_NOT_RERUN')
    expect(model.report.summary).toMatchObject({
      EXISTING_COMPATIBILITY_RECORDS_CHANGED: 0,
      W5_ORDERING_HANDOFFS_CHANGED: 0,
      EXISTING_COMPLETE_MECHANICS_PRESERVED: 127,
      SQL_AUTHORED: 0,
      SQL_EXECUTED: 0,
      PRODUCERS_ACTIVATED: 0,
    })
  })
  it('keeps all downstream authorization and runtime proof disabled', () => {
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4LB_GATE: 'BLOCKED',
      W4LC2_FINAL_NORMALIZATION: 'NOT_AUTHORIZED',
      W4P: 'NOT_AUTHORIZED',
      W5_COMPATIBILITY_SLICE: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
      CANONICAL_CONTRACT_VERSION: '1.3.2',
      NO_FURTHER_GENERIC_OPERAND_DISCOVERY: 'YES',
    })
    expect(model.report.proofBoundaries).toMatchObject({
      COMPATIBILITY_MECHANICS_EXECUTED: 'NO',
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      W5_EXECUTED: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
    })
  })
  it('is deterministic in model and exact generated bytes', async () => {
    expect(digest(buildBindings())).toBe(digest(model))
    expect(await generate()).toEqual(await generate())
  }, 120000)
  it.each(['--execute', '--discover', '--rewrite', '--sql', '--w4p', '--w5', '--publish'])(
    'rejects unauthorized flag:%s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4LB_FLAG')
    },
  )
})
