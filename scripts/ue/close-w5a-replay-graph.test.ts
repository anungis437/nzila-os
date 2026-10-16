import { describe, expect, it } from 'vitest'
import {
  bindFrozenUnit,
  buildGraph,
  files,
  fixedHashes,
  frozenStatements,
  generate,
  main,
  outputs,
  topologicalPlan,
} from './close-w5a-replay-graph'
import { digest, read, sha } from './w4-physical-producers'

const model = buildGraph()
const register = model.graph.downstreamRegister
const rawLate = JSON.parse(read(files.late)).records
const rawOrdering = JSON.parse(read(files.producer)).w5OrderingHandoff
const positions = new Map(
  model.plan.ORDER.map((node) => [node.REPLAY_UNIT_ID, node.REQUIRED_REPLAY_POSITION]),
)
const nodes = new Map(model.graph.nodes.map((node) => [node.REPLAY_UNIT_ID, node]))

describe('W5A exact immutable record accounting', () => {
  it('accounts for127 records,86 handoffs,7 deferred handoffs,9 residuals without merging sets', () => {
    expect(register.BOUND_REPLAY_RECORDS).toHaveLength(127)
    expect(register.BOUND_ORDERING_HANDOFFS).toHaveLength(86)
    expect(register.DEFERRED_CONSTRAINT_HANDOFFS).toHaveLength(7)
    expect(register.UNRESOLVED_OPERAND_BINDINGS).toHaveLength(9)
    expect(register.BOUND_REPLAY_RECORDS.map((record) => record.ORIGINAL_RECORD)).toEqual(rawLate)
    expect(register.BOUND_ORDERING_HANDOFFS.map((record) => record.SOURCE_EVIDENCE)).toEqual(
      rawOrdering,
    )
  })
  for (const record of register.BOUND_REPLAY_RECORDS) {
    it(`preserves complete mechanic and exact unit:${record.COMPATIBILITY_OBLIGATION_ID}`, () => {
      const original = rawLate.find(
        (entry: { COMPATIBILITY_OBLIGATION_ID: string }) =>
          entry.COMPATIBILITY_OBLIGATION_ID === record.COMPATIBILITY_OBLIGATION_ID,
      )
      expect(record.ORIGINAL_RECORD).toEqual(original)
      expect(record.COMPATIBILITY_MECHANIC).toEqual(original.COMPATIBILITY_MECHANIC)
      expect(record.PRECONDITIONS).toEqual(original.PRECONDITION)
      expect(record.POSTCONDITIONS).toEqual(original.POSTCONDITION)
      expect(original.OTHER_COMPATIBILITY_CLASS).toBe(
        'NO_W4FR4_PRECREATION_COLLISION_EXACT_LATE_PROMOTION_REPLAY_REQUIRED',
      )
      const node = nodes.get(record.REPLAY_UNIT_ID)!
      expect(node.COMPATIBILITY_OBLIGATION_IDS).toContain(record.COMPATIBILITY_OBLIGATION_ID)
      expect(node.SOURCE_SHA256).toBe(sha(read(record.SOURCE_FILE)))
      const [start, end] = record.SOURCE_RANGE
      expect(sha(read(record.SOURCE_FILE).slice(start, end))).toBe(record.EXACT_UNIT_SHA256)
      expect(record.EXACT_OPERATION_SHA256).toBe(original.EXACT_LATE_DEFINITION_DIGEST)
      expect(['FROZEN_STATEMENT_UNIT', 'FROZEN_WRAPPER_UNIT']).toContain(record.REPLAY_UNIT_CLASS)
      expect(record.WRAPPER_BEHAVIOR_PRESERVED).toBe('YES')
      for (const key of [
        'VALIDATE_EXPECTED_PRESTATE',
        'FAIL_ON_DRIFT',
        'PRESERVE_ENCLOSING_WRAPPER',
        'PRESERVE_POSTCREATE_BEHAVIOR',
      ] as const)
        expect(record[key]).toBe('REQUIRED')
      expect(record.EXECUTION_ALLOWED).toBe('NO')
      expect(positions.get(record.REPLAY_UNIT_ID)!).toBeLessThan(
        positions.get(record.ORIGINAL_POSITION_RECHECK_UNIT_ID)!,
      )
    })
  }
  for (const record of register.BOUND_ORDERING_HANDOFFS) {
    it(`binds accepted ordering endpoint/provenance:${record.ORDERING_RECORD_ID}`, () => {
      const edge = model.graph.edges.find((edge) => edge.EDGE_ID === record.EDGE_ID)!
      expect(edge.EDGE_CLASS).toBe('ACCEPTED_W5_HANDOFF')
      expect(edge.SOURCE_RECORD_ID).toBe(record.ORDERING_RECORD_ID)
      expect(edge.FROM).toBe(record.FROM_REPLAY_UNIT_ID)
      expect(edge.TO).toBe(record.TO_REPLAY_UNIT_ID)
      expect(edge.SOURCE_EVIDENCE).toEqual(record.SOURCE_EVIDENCE)
      expect(nodes.has(edge.FROM) && nodes.has(edge.TO)).toBe(true)
      expect(record.HISTORICAL_PROVIDER_POSITION).toBeGreaterThan(
        record.HISTORICAL_CONSUMER_POSITION,
      )
      expect(record.REQUIRED_PROVIDER_REPLAY_POSITION!).toBeLessThan(
        record.REQUIRED_CONSUMER_REPLAY_POSITION!,
      )
      expect(record.ORDER_OVERRIDE_SOURCE).toBe('ACCEPTED_W5_HANDOFF')
      expect(record.ATOMICITY_CLASS).toBe('SATISFIABLE_WITH_UNIT_ORDERING')
      expect(record.EXECUTION_ALLOWED).toBe('NO')
    })
  }
  for (const record of register.DEFERRED_CONSTRAINT_HANDOFFS) {
    it(`preserves deferred handoff:${record.DEFERRED_CONSTRAINT_HANDOFF_ID}`, () => {
      const original = JSON.parse(read(files.bindings)).records.find(
        (entry: { DEFERRED_CONSTRAINT_HANDOFF_ID: string }) =>
          entry.DEFERRED_CONSTRAINT_HANDOFF_ID === record.DEFERRED_CONSTRAINT_HANDOFF_ID,
      )
      expect(record.ORIGINAL_BINDING_RESULT).toEqual(original)
      expect(record.STATUS).toBe('DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION')
      expect(record.MATERIALIZATION_POSITION).toBe('UNRESOLVED_DOWNSTREAM')
      expect(record.EXECUTION_ALLOWED).toBe('NO')
      expect(
        model.graph.nodes.some(
          (node) => node.REPLAY_UNIT_ID === record.DEFERRED_CONSTRAINT_HANDOFF_ID,
        ),
      ).toBe(false)
    })
  }
  for (const record of register.UNRESOLVED_OPERAND_BINDINGS) {
    it(`retains unresolved exact operand:${record.PHYSICAL_OPERAND_IDENTITY}`, () => {
      expect(record.STATUS).toBe('UNRESOLVED_DOWNSTREAM')
      expect(record.ORIGINAL_RESIDUAL).toEqual(
        JSON.parse(read(files.operands)).records.find(
          (entry: { PHYSICAL_OPERAND_IDENTITY: string }) =>
            entry.PHYSICAL_OPERAND_IDENTITY === record.PHYSICAL_OPERAND_IDENTITY,
        ),
      )
      expect(record.EXECUTION_ALLOWED).toBe('NO')
    })
  }
})

describe('W5A frozen atomicity and wrapper preservation', () => {
  it('keeps semicolons inside quoted strings,comments and DO bodies atomic', () => {
    const sql =
      "-- ;\nDO $tag$ BEGIN PERFORM 'x;'; END $tag$;\nCREATE TABLE t (v text DEFAULT ';'); /* ; */"
    const statements = frozenStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0].TEXT).toContain("PERFORM 'x;'")
    expect(statements[1].TEXT).toContain("DEFAULT ';'")
  })
  it('supports nested comments,escaped quote delimiters and quoted identifiers', () => {
    expect(
      frozenStatements('/* a /* ; */ b */ CREATE TABLE "a;""b" (v text DEFAULT \'a\'\'b;\');'),
    ).toHaveLength(1)
  })
  for (const sql of ["CREATE TABLE t (v text DEFAULT 'x);", 'DO $$ BEGIN END;', '/* not closed'])
    it(`rejects unclosed frozen lexical boundary:${sql}`, () => {
      expect(() => frozenStatements(sql)).toThrow()
    })
  it('binds complete standalone CREATE with its exact source line', () => {
    const clause = 'CREATE TABLE t (id uuid);'
    const binding = bindFrozenUnit(`-- provenance\n${clause}\nCREATE INDEX i ON t(id);`, clause, 2)
    expect(binding.REPLAY_UNIT_CLASS).toBe('FROZEN_STATEMENT_UNIT')
    expect(binding.ATOMICITY_CLASS).toBe('SATISFIABLE_WITH_UNIT_ORDERING')
    expect(binding.STATEMENT.TEXT).not.toContain('CREATE INDEX')
    expect(binding.EXACT_OPERATION_SHA256).toBe(sha(clause))
  })
  it('keeps full enum DO/exception wrapper as one state-aware unit', () => {
    const clause = "CREATE TYPE status AS ENUM ('active','off');"
    const binding = bindFrozenUnit(
      `DO $$ BEGIN ${clause} EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      clause,
      1,
    )
    expect(binding.REPLAY_UNIT_CLASS).toBe('FROZEN_WRAPPER_UNIT')
    expect(binding.ATOMICITY_CLASS).toBe('SATISFIABLE_WITH_STATE_AWARE_WRAPPER')
    expect(binding.WRAPPER_BEHAVIOR_PRESERVED).toBe('YES')
    expect(binding.STATEMENT.TEXT).toContain('EXCEPTION WHEN duplicate_object')
  })
  for (const extra of ['PERFORM audit();', "UPDATE t SET v='seen';", 'CREATE INDEX i ON t(id);'])
    it(`blocks extraction that would discard legitimate wrapper behavior:${extra}`, () => {
      const clause = 'CREATE TABLE t (id uuid);'
      const binding = bindFrozenUnit(`DO $$ BEGIN ${clause} ${extra} END $$;`, clause, 1)
      expect(binding.REPLAY_UNIT_CLASS).toBe('FROZEN_MIGRATION_UNIT')
      expect(binding.ATOMICITY_CLASS).toBe('ATOMICITY_CONFLICT')
      expect(binding.SAFE_STATE_AWARE_PRECONSUMER_BOUNDARY).toBe(false)
      expect(binding.STATEMENT.TEXT).toContain(extra)
    })
  it('blocks enum wrapper with additional statements even if duplicate boilerplate is present', () => {
    const clause = "CREATE TYPE status AS ENUM ('active');"
    const binding = bindFrozenUnit(
      `DO $$ BEGIN ${clause} PERFORM audit(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      clause,
      1,
    )
    expect(binding.ATOMICITY_CLASS).toBe('ATOMICITY_CONFLICT')
  })
  it('does not use file positions to manufacture a binding', () => {
    expect(() =>
      bindFrozenUnit('CREATE TABLE t (id uuid);', 'CREATE TABLE t (id uuid);', 2),
    ).toThrow('EXACT_RECORDED_OPERATION_NOT_UNIQUELY_BOUND')
  })
  it('rejects ambiguous same-line CREATE clauses rather than choosing one', () => {
    expect(() =>
      bindFrozenUnit(
        'CREATE TABLE t (id uuid); CREATE TABLE t (id uuid);',
        'CREATE TABLE t (id uuid);',
        1,
      ),
    ).toThrow()
  })
  it('shares84 exact CREATE units without merging127 obligations', () => {
    expect(model.report.summary.DISTINCT_COMPATIBILITY_REPLAY_UNITS).toBe(84)
    expect(model.report.summary.FROZEN_STATEMENT_UNITS).toBe(43)
    expect(model.report.summary.FROZEN_WRAPPER_UNITS).toBe(41)
    expect(
      model.graph.nodes
        .filter((node) => node.PHASE === 'LATE_DEFINITION_STATE_BOUNDARY')
        .flatMap((node) => node.COMPATIBILITY_OBLIGATION_IDS),
    ).toHaveLength(127)
  })
})

describe('W5A provenance and topological closure', () => {
  for (const edge of model.graph.edges)
    it(`proves edge endpoint,digest and required order:${edge.EDGE_ID}`, () => {
      expect(edge.SOURCE_RECORD_ID).toBeTruthy()
      expect(edge.SOURCE_FILE_OR_CONTRACT).toBeTruthy()
      expect(sha(read(edge.SOURCE_FILE_OR_CONTRACT))).toBe(edge.SOURCE_DIGEST)
      expect(edge.SOURCE_EVIDENCE).toBeTruthy()
      expect(nodes.has(edge.FROM) && nodes.has(edge.TO)).toBe(true)
      expect(positions.get(edge.FROM)!).toBeLessThan(positions.get(edge.TO)!)
      expect([
        'ACCEPTED_W5_HANDOFF',
        'RECORDED_REPLAY_PRESTATE_PRECONDITION',
        'RECORDED_SCOPE_REPLAY_ORDER_PRECONDITION',
        'EXACT_FROZEN_COLUMN_TYPE_DEPENDENCY',
      ]).toContain(edge.EDGE_CLASS)
    })
  it('retains86 provenance records for43 distinct accepted ordering endpoint pairs', () => {
    expect(model.report.summary.ACCEPTED_HANDOFF_EDGE_RECORDS).toBe(86)
    expect(model.report.summary.UNIQUE_ACCEPTED_HANDOFF_ENDPOINT_EDGES).toBe(43)
  })
  it('closes107 nodes without unresolved endpoints or cycles', () => {
    expect(model.plan.ORDER).toHaveLength(107)
    expect(new Set(model.plan.ORDER.map((node) => node.REPLAY_UNIT_ID)).size).toBe(107)
    expect(model.plan.CYCLE_OR_CYCLE_DEPENDENT_UNIT_IDS).toEqual([])
    expect(model.plan.UNRESOLVED_ORDERING_ENDPOINT_IDS).toEqual([])
    expect(model.plan.ATOMICITY_CONFLICT_OBLIGATION_IDS).toEqual([])
  })
  it('detects a genuine cycle and returns the affected exact unit IDs', () => {
    const [a, b] = model.graph.nodes
    const edge = model.graph.edges[0]
    const result = topologicalPlan(
      [a, b],
      [
        { ...edge, EDGE_ID: 'cycle1', FROM: a.REPLAY_UNIT_ID, TO: b.REPLAY_UNIT_ID },
        { ...edge, EDGE_ID: 'cycle2', FROM: b.REPLAY_UNIT_ID, TO: a.REPLAY_UNIT_ID },
      ],
    )
    expect(result.COMPLETE).toBe(false)
    expect(result.CYCLE_OR_CYCLE_DEPENDENT_UNIT_IDS).toEqual([a.REPLAY_UNIT_ID, b.REPLAY_UNIT_ID])
  })
  it('detects a self-cycle', () => {
    const a = model.graph.nodes[0]
    expect(
      topologicalPlan(
        [a],
        [{ ...model.graph.edges[0], FROM: a.REPLAY_UNIT_ID, TO: a.REPLAY_UNIT_ID }],
      ).COMPLETE,
    ).toBe(false)
  })
  it('rejects unresolved endpoints with exact edge IDs', () => {
    const result = topologicalPlan(model.graph.nodes, [
      { ...model.graph.edges[0], EDGE_ID: 'missing', TO: 'unbound' },
    ])
    expect(result.UNRESOLVED_ORDERING_ENDPOINT_IDS).toEqual(['missing'])
    expect(result.COMPLETE).toBe(false)
  })
  it('rejects duplicate node identities', () => {
    expect(() => topologicalPlan([model.graph.nodes[0], model.graph.nodes[0]], [])).toThrow(
      'DUPLICATE_REPLAY_UNIT',
    )
  })
  it('sorts identically from reversed input arrays,without relying on insertion order', () => {
    expect(
      topologicalPlan([...model.graph.nodes].reverse(), [...model.graph.edges].reverse()).ORDER,
    ).toEqual(model.plan.ORDER)
  })
  it('keeps original UE migration relative order,and never crosses operational/financial edges', () => {
    const replay = model.plan.ORDER.filter(
      (node) => node.PHASE === 'ORIGINAL_FROZEN_REPLAY' && node.DATABASE_SCOPE === 'UE_OPERATIONAL',
    )
    expect(replay.map((node) => node.HISTORICAL_POSITION)).toEqual(
      Array.from({ length: 22 }, (_, index) => index),
    )
    for (const edge of model.graph.edges)
      expect(nodes.get(edge.FROM)!.DATABASE_SCOPE).toBe(nodes.get(edge.TO)!.DATABASE_SCOPE)
    expect(
      model.plan.ORDER.filter((node) => node.DATABASE_SCOPE === 'FINANCIAL_SERVICE'),
    ).toHaveLength(1)
  })
  it('uses only exact recorded column-type operand ranges for40 bound type prerequisites', () => {
    const edges = model.graph.edges.filter(
      (edge) => edge.EDGE_CLASS === 'EXACT_FROZEN_COLUMN_TYPE_DEPENDENCY',
    )
    expect(edges).toHaveLength(40)
    for (const edge of edges) {
      const evidence = edge.SOURCE_EVIDENCE as {
        OPERATION_RELATIVE_TOKEN_RANGE: number[]
        EXACT_TYPE_REFERENCE: string
        REQUIRED_PHYSICAL_IDENTITY: string
      }
      const record = register.BOUND_REPLAY_RECORDS.find(
        (record) => record.REPLAY_UNIT_ID === edge.TO,
      )!
      const clause = String(
        (record.ORIGINAL_RECORD.EXACT_LATE_DEFINITION as { EXACT_CREATE_CLAUSE: string })
          .EXACT_CREATE_CLAUSE,
      )
      expect(clause.slice(...(evidence.OPERATION_RELATIVE_TOKEN_RANGE as [number, number]))).toBe(
        evidence.EXACT_TYPE_REFERENCE,
      )
      expect(
        register.BOUND_REPLAY_RECORDS.some(
          (record) =>
            record.REPLAY_UNIT_ID === edge.FROM &&
            record.PHYSICAL_IDENTITY === evidence.REQUIRED_PHYSICAL_IDENTITY,
        ),
      ).toBe(true)
    }
  })
})

describe('W5A preservation,determinism and deny-by-default boundaries', () => {
  for (const [file, commitment] of Object.entries(model.report.preservation.BYTE_COMMITMENTS))
    it(`preserves fixed input/source bytes:${file}`, () => {
      expect(sha(read(file))).toBe(commitment)
    })
  it('preserves inherited counts183/162/36/38 and exact W4P plan digest', () => {
    expect(model.report.preservation.W4_DEFINITIONS).toBe(183)
    expect(model.report.preservation.W4_PAYLOADS).toBe(162)
    expect(model.report.preservation.NAMED_TYPES).toBe(36)
    expect(model.report.preservation.CONTEXTUAL_TYPE_REFERENCES).toBe(38)
    expect(model.report.preservation.W4P_PLAN_DIGEST).toBe(
      'b213e1b6e5773d2f513ef2a0b55e199d0055ea7f3fb8202c96e761e75d04346a',
    )
    expect(model.report.preservation.UPSTREAM_BYTES_CHANGED).toBe(0)
    expect(Object.keys(fixedHashes)).toHaveLength(12)
  })
  it('preserves exact record digests and all five deterministic output commitments', () => {
    const again = buildGraph()
    expect(again.report.determinismDigests).toEqual(model.report.determinismDigests)
    expect(model.report.determinismDigests.REPLAY_GRAPH_SHA256).toBe(digest(model.graph))
    expect(model.report.determinismDigests.TOPOLOGICAL_PLAN_SHA256).toBe(digest(model.plan))
    expect(model.report.preservation.COMPATIBILITY_RECORDS_SHA256).toBe(digest(rawLate))
    expect(model.report.preservation.ORDERING_HANDOFFS_SHA256).toBe(digest(rawOrdering))
  })
  it('creates only six authorized artifact byte sets identically twice', async () => {
    const first = await generate()
    expect(Object.keys(first).sort()).toEqual(Object.values(outputs).sort())
    expect(first).toEqual(await generate())
  }, 30000)
  it('checks persisted output bytes without executing or regenerating predecessors', async () => {
    await expect(main(['--check'])).resolves.toBeUndefined()
  }, 30000)
  for (const flag of [
    '--apply',
    '--execute',
    '--activate',
    '--materialize',
    '--connect',
    '--unknown',
  ])
    it(`denies unauthorized flag:${flag}`, async () => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W5A_FLAG')
    })
  it('authorizes only implementation ofW5B,not W5 completion or runtime work', () => {
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W5A_GATE: 'PASS',
      W5: 'IN_PROGRESS',
      W5B_REPLAY_IMPLEMENTATION: 'AUTHORIZED_NOT_STARTED',
      W4P_RUNTIME_EXECUTION: 'NOT_AUTHORIZED',
      CANONICAL_CONTRACT_VERSION: '1.3.3',
    })
    expect(model.report.proofBoundaries).toEqual({
      DATABASE_CONNECTIONS: 0,
      SQL_EXECUTED: 0,
      W4P_EXECUTED: 'NO',
      FROZEN_MIGRATIONS_EXECUTED: 0,
      COMPATIBILITY_MECHANICS_EXECUTED: 0,
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      W5_EXECUTED: 'NO',
      PRODUCERS_ACTIVATED: 0,
      BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
      FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
      RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
      TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
    expect(model.report.summary.W4P_PRECONDITION_GRAPH_CHANGED).toBe('NO')
    expect(model.report.summary.POST_W4P_ITEMS_MOVED_BACK_BEFORE_W4P).toBe(0)
  })
})
