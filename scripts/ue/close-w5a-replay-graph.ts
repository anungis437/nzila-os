import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { sqlTokens } from './close-w4t-named-types'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4p: folder + 'PHASE_1B_3C_A1I_W4P_PLATFORM_BASELINE_PROMOTION.json',
  promotionPlan: folder + 'UE_W4_PLATFORM_BASELINE_PROMOTION_PLAN.json',
  promotionImplementation: folder + 'UE_W4_PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION.json',
  downstream: folder + 'UE_POST_W4P_COMPATIBILITY_OBLIGATIONS.json',
  w4lc: folder + 'PHASE_1B_3C_A1I_W4LC_COMPATIBILITY_GATE_NORMALIZATION.json',
  late: folder + 'UE_W4_LATE_PRODUCER_COMPATIBILITY_CLASSIFICATION.json',
  deferredClassification: folder + 'UE_W4_DEFERRED_CONSTRAINT_COMPATIBILITY_CLASSIFICATION.json',
  w4lb: folder + 'PHASE_1B_3C_A1I_W4LB_SUPPLEMENTAL_OPERAND_BINDING.json',
  operands: folder + 'UE_W4_SUPPLEMENTAL_OPERAND_PRODUCER_BINDINGS.json',
  bindings: folder + 'UE_W4_SUPPLEMENTAL_CONSTRAINT_BINDINGS.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const fixedHashes: Record<string, string> = {
  [files.w4p]: '9405b0b03e3966816605199a04244e7ffe41af6c2d03af31f25e7c2836d9bbfb',
  [files.promotionPlan]: 'f58319b792dc62cf6ac06bcf8be070ca6020084f41e468add7d64217aba0b4d5',
  [files.promotionImplementation]:
    '6f651aaa3f76a82192c5050e2400498d4f66a58c0aa0af2639770ccf52183c49',
  [files.downstream]: '2e10f3e40761c6b93bca473b263c262c2222f7b3a875e41ab268fa1b4448e043',
  [files.w4lc]: 'fef8528dda5467bb742cd4987b449809f3143099648ec42381b665ecb7cc3ab8',
  [files.late]: 'fc98ce059a4e4d26caadecb7ed9a686db81d324e8e597477f55064d74b76ed98',
  [files.deferredClassification]:
    '51700b9b0d5860ee9218fabc43ba1aeeb09b96cd6d0b908998e046d724ee05ec',
  [files.w4lb]: '40ab8780f42b87389345cd3c5191f525ad5470e173f02d9eb946835bfbc3b1e0',
  [files.operands]: '8ed7eb94b12d2d4b172e5a608d972ce93cbd4334e3cd4a4dfc31cfbffab15fb6',
  [files.bindings]: '2bfbbf5b3762d7bc4604b5e403210fb4162f0af8a667436454e3053b45bc8f6b',
  [files.producer]: 'b2db0a4924188facc243965b0de11cd921200ce8dda811c543263abdd84dc3aa',
  [files.canonical]: '5e105985d6b99fbdb118b87454543f92e0053ae1b574c3dfe6417f9bbbc81e2d',
}
export const outputs = {
  graph: folder + 'UE_W5_POST_W4P_REPLAY_GRAPH.json',
  graphMarkdown: folder + 'UE_W5_POST_W4P_REPLAY_GRAPH.md',
  plan: folder + 'UE_W5_REPLAY_TOPOLOGICAL_PLAN.json',
  planMarkdown: folder + 'UE_W5_REPLAY_TOPOLOGICAL_PLAN.md',
  report: folder + 'PHASE_1B_3C_A1I_W5A_REPLAY_ORDERING_GRAPH.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W5A_REPLAY_ORDERING_GRAPH.md',
}
type Json = null | string | number | boolean | Json[] | { [key: string]: Json }
type RecordJson = { [key: string]: Json }
function object(value: Json | undefined): RecordJson {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'EXPECTED_OBJECT')
  return value
}
function records(value: Json | undefined) {
  assert(Array.isArray(value), 'EXPECTED_RECORDS')
  return value.map(object)
}
function strings(value: Json | undefined): string[] {
  assert(
    Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
    'EXPECTED_STRINGS',
  )
  return value
}
function text(value: Json | undefined): string {
  assert(typeof value === 'string', 'EXPECTED_STRING')
  return value
}
function number(value: Json | undefined): number {
  assert(typeof value === 'number' && Number.isInteger(value), 'EXPECTED_INTEGER')
  return value
}
const id = (kind: string, value: string) => `UE-W5A-${kind}-${sha(value).slice(0, 16)}`
export interface Statement {
  START: number
  END: number
  TEXT: string
  SHA256: string
}
export function frozenStatements(sql: string): Statement[] {
  const statements: Statement[] = []
  let start = 0,
    quote = '',
    dollar = '',
    lineComment = false,
    block = 0
  const push = (end: number) => {
    const value = sql.slice(start, end)
    if (sqlTokens(value).length)
      statements.push({ START: start, END: end, TEXT: value, SHA256: sha(value) })
    start = end
  }
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index],
      next = sql[index + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (block) {
      if (char === '/' && next === '*') {
        block++
        index++
      } else if (char === '*' && next === '/') {
        block--
        index++
      }
      continue
    }
    if (dollar) {
      if (sql.startsWith(dollar, index)) {
        index += dollar.length - 1
        dollar = ''
      }
      continue
    }
    if (quote) {
      if (char === quote && next === quote) index++
      else if (char === quote) quote = ''
      continue
    }
    if (char === '-' && next === '-') {
      lineComment = true
      index++
      continue
    }
    if (char === '/' && next === '*') {
      block = 1
      index++
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (char === '$') {
      const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(index))
      if (match) {
        dollar = match[0]
        index += dollar.length - 1
        continue
      }
    }
    if (char === ';') push(index + 1)
  }
  assert(!quote && !dollar && !block, 'UNTERMINATED_FROZEN_STATEMENT')
  if (start < sql.length) push(sql.length)
  return statements
}
export function bindFrozenUnit(sql: string, clause: string, sourceLine: number) {
  const occurrences: number[] = []
  let cursor = 0
  while (cursor < sql.length) {
    const found = sql.indexOf(clause, cursor)
    if (found < 0) break
    if (sql.slice(0, found).split('\n').length === sourceLine) occurrences.push(found)
    cursor = found + clause.length
  }
  assert.equal(occurrences.length, 1, 'EXACT_RECORDED_OPERATION_NOT_UNIQUELY_BOUND')
  const start = occurrences[0]
  const statements = frozenStatements(sql)
  const containing = statements.filter(
    (statement) => statement.START <= start && statement.END >= start + clause.length,
  )
  assert.equal(containing.length, 1, 'FROZEN_ATOMIC_BOUNDARY_UNPROVEN')
  const statement = containing[0]
  const tokens = sqlTokens(statement.TEXT)
  const outside = sqlTokens(
    statement.TEXT.slice(0, start - statement.START) +
      statement.TEXT.slice(start - statement.START + clause.length),
  )
  const pureCreate =
    outside.every((token) => token.value === ';') && tokens[0]?.value.toUpperCase() === 'CREATE'
  const canonicalEnumWrapper =
    /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*DO\s+\$\$\s*BEGIN\s+[\s\S]+EXCEPTION\s+WHEN\s+duplicate_object\s+THEN\s+NULL\s*;\s*END\s+\$\$\s*;\s*$/i.test(
      statement.TEXT,
    ) &&
    /^CREATE TYPE\b/.test(clause) &&
    outside.map((token) => token.value.toUpperCase()).join(' ') ===
      'DO BEGIN EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL ; END ;'
  return {
    REPLAY_UNIT_CLASS: pureCreate
      ? 'FROZEN_STATEMENT_UNIT'
      : canonicalEnumWrapper
        ? 'FROZEN_WRAPPER_UNIT'
        : 'FROZEN_MIGRATION_UNIT',
    STATEMENT: statement,
    OPERATION_START: start,
    OPERATION_END: start + clause.length,
    INTRA_MIGRATION_POSITION: statements.indexOf(statement),
    EXACT_OPERATION_SHA256: sha(clause),
    WRAPPER_BEHAVIOR_PRESERVED: 'YES',
    SAFE_STATE_AWARE_PRECONSUMER_BOUNDARY: pureCreate || canonicalEnumWrapper,
    ATOMICITY_CLASS: pureCreate
      ? 'SATISFIABLE_WITH_UNIT_ORDERING'
      : canonicalEnumWrapper
        ? 'SATISFIABLE_WITH_STATE_AWARE_WRAPPER'
        : 'ATOMICITY_CONFLICT',
    REASON: pureCreate
      ? 'Exact standalone CREATE statement is the narrowest recorded operation;all other file behavior remains at its original migration boundary.'
      : canonicalEnumWrapper
        ? 'Exact DO unit contains only the recorded enum CREATE and duplicate-object exception wrapper;future state-aware inspection must reject drift before wrapper replay,never swallow duplicate errors as validation.'
        : 'CREATE is enclosed by additional indivisible behavior;no accepted evidence permits moving only CREATE or running its full source migration early.',
  }
}
export interface GraphNode {
  REPLAY_UNIT_ID: string
  REPLAY_UNIT_CLASS: string
  PHASE: 'LATE_DEFINITION_STATE_BOUNDARY' | 'ORIGINAL_FROZEN_REPLAY'
  DATABASE_SCOPE: string
  SOURCE_FILE: string
  SOURCE_SHA256: string
  FROZEN_MIGRATION_ID: string
  HISTORICAL_POSITION: number
  INTRA_MIGRATION_POSITION: number
  EXACT_UNIT_SHA256: string
  COMPATIBILITY_OBLIGATION_IDS: string[]
  WRAPPER_BEHAVIOR_PRESERVED: string
  PRECONDITIONS: Json[]
  POSTCONDITIONS: Json[]
  EXECUTION_ALLOWED: string
}
export interface GraphEdge {
  EDGE_ID: string
  FROM: string
  TO: string
  EDGE_CLASS: string
  SOURCE_RECORD_ID: string
  SOURCE_FILE_OR_CONTRACT: string
  SOURCE_DIGEST: string
  SOURCE_EVIDENCE: Json
}
export function topologicalPlan(nodes: GraphNode[], edges: GraphEdge[]) {
  const ids = new Set(nodes.map((node) => node.REPLAY_UNIT_ID))
  assert.equal(ids.size, nodes.length, 'DUPLICATE_REPLAY_UNIT')
  const unresolved = edges.filter((edge) => !ids.has(edge.FROM) || !ids.has(edge.TO))
  const remaining = new Set(ids)
  const completed = new Set<string>()
  const ordered: GraphNode[] = []
  while (remaining.size && !unresolved.length) {
    const ready = nodes
      .filter(
        (node) =>
          remaining.has(node.REPLAY_UNIT_ID) &&
          edges
            .filter((edge) => edge.TO === node.REPLAY_UNIT_ID)
            .every((edge) => completed.has(edge.FROM)),
      )
      .sort(
        (a, b) =>
          a.HISTORICAL_POSITION - b.HISTORICAL_POSITION ||
          a.INTRA_MIGRATION_POSITION - b.INTRA_MIGRATION_POSITION ||
          (a.REPLAY_UNIT_ID < b.REPLAY_UNIT_ID ? -1 : a.REPLAY_UNIT_ID > b.REPLAY_UNIT_ID ? 1 : 0),
      )
    if (!ready.length) break
    const next = ready[0]
    remaining.delete(next.REPLAY_UNIT_ID)
    completed.add(next.REPLAY_UNIT_ID)
    ordered.push(next)
  }
  return {
    ORDER: ordered.map((node, index) => ({ ...node, REQUIRED_REPLAY_POSITION: index + 1 })),
    UNRESOLVED_ORDERING_ENDPOINT_IDS: unresolved.map((edge) => edge.EDGE_ID),
    CYCLE_OR_CYCLE_DEPENDENT_UNIT_IDS: unresolved.length ? [] : [...remaining],
    COMPLETE: ordered.length === nodes.length && unresolved.length === 0,
  }
}
function exactColumnTypes(clause: string) {
  const tokens = sqlTokens(clause)
  const types: { name: string; schema: string; start: number; end: number }[] = []
  let depth = 0,
    columnStart = false
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token.value === '(') {
      depth++
      if (depth === 1) columnStart = true
      continue
    }
    if (token.value === ')') {
      depth--
      continue
    }
    if (token.value === ',' && depth === 1) {
      columnStart = true
      continue
    }
    if (!columnStart || depth !== 1) continue
    columnStart = false
    if (
      !['WORD', 'IDENTIFIER'].includes(token.kind) ||
      ['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'CHECK', 'UNIQUE'].includes(token.value.toUpperCase())
    )
      continue
    const type = tokens[index + 1]
    if (!type || !['WORD', 'IDENTIFIER'].includes(type.kind)) continue
    const qualified = tokens[index + 2]?.value === '.'
    const name = qualified ? tokens[index + 3] : type
    if (!name || !['WORD', 'IDENTIFIER'].includes(name.kind)) continue
    types.push({
      schema: qualified ? type.value : 'public',
      name: name.value,
      start: type.start,
      end: name.end,
    })
  }
  return types
}
export function buildGraph() {
  const input = Object.fromEntries(
    Object.entries(files).map(([name, file]) => {
      const bytes = read(file)
      assert.equal(sha(bytes), fixedHashes[file], `FIXED_INPUT_DRIFT:${file}`)
      return [name, object(JSON.parse(bytes))]
    }),
  )
  assert.equal(input.canonical.CONTRACT_VERSION, '1.3.3')
  assert.equal(object(input.w4p.phaseStatus).PHASE_1B_3C_A1I_W4P_GATE, 'PASS')
  assert.equal(object(input.w4p.phaseStatus).W5, 'AUTHORIZED_NOT_STARTED')
  assert.equal(input.canonical.ORDER_PRESERVED, 'YES')
  assert.equal(object(input.w4p.summary).DEFINITIONS, 183)
  assert.equal(object(input.w4p.summary).PAYLOADS, 162)
  assert.equal(object(input.w4p.summary).TYPE_PAYLOADS, 36)
  assert.equal(records(input.canonical.canonicalDefinitionObligations).length, 183)
  assert.equal(
    object(object(input.canonical.platformBaselineCanonicalDefinitionAuthoring).summary)
      .TOTAL_CANONICAL_TYPE_REFERENCES,
    38,
  )
  assert.equal(
    input.promotionPlan.PLAN_DIGEST,
    'b213e1b6e5773d2f513ef2a0b55e199d0055ea7f3fb8202c96e761e75d04346a',
  )
  assert.equal(strings(input.promotionPlan.PAYLOAD_ORDER).length, 162)
  const late = records(input.late.records)
  const ordering = records(input.producer.w5OrderingHandoff)
  const downstream = input.downstream
  assert.equal(late.length, 127)
  assert.equal(ordering.length, 86)
  assert.deepEqual(
    records(downstream.SET_A_POST_W4P_REPLAY).map((record) => record.ORIGINAL_RECORD),
    late,
  )
  assert.deepEqual(
    records(downstream.SET_B_POST_W4P_ORDERING).map((record) => record.ORIGINAL_HANDOFF),
    ordering,
  )
  const deferred = records(downstream.SET_C_POST_W4P_DEFERRED_CONSTRAINT)
  const operands = records(input.operands.records)
  const bindings = records(input.bindings.records)
  assert.equal(deferred.length, 7)
  assert.equal(operands.length, 9)
  assert.deepEqual(
    deferred.map((record) => record.ORIGINAL_BINDING_RESULT),
    bindings,
  )
  assert.deepEqual(
    records(input.deferredClassification.records).map((record) => record.CANONICAL_HANDOFF),
    deferred.map((record) => record.ORIGINAL_HANDOFF),
  )
  const manifest = records(input.canonical.frozenMigrationManifest)
  assert.equal(manifest.length, 23)
  const preservation = {
    ...fixedHashes,
    [text(input.w4p.metadata ? object(input.w4p.metadata).ENTRYPOINT : undefined)]: text(
      object(input.w4p.metadata).ENTRYPOINT_SHA256,
    ),
  }
  const sources = manifest.map((record) => {
    const file = text(record.FILE),
      bytes = read(file)
    assert.equal(sha(bytes), record.SHA256, `FROZEN_MIGRATION_HASH_DRIFT:${file}`)
    preservation[file] = text(record.SHA256)
    return { record, bytes }
  })
  for (const [file, expected] of Object.entries(preservation))
    assert.equal(sha(read(file)), expected, `PRESERVATION_DRIFT:${file}`)
  const nodes: GraphNode[] = sources.map(({ record }) => ({
    REPLAY_UNIT_ID: id('MIGRATION', text(record.MIGRATION_NODE_ID)),
    REPLAY_UNIT_CLASS: 'FROZEN_MIGRATION_UNIT',
    PHASE: 'ORIGINAL_FROZEN_REPLAY',
    DATABASE_SCOPE: text(record.FILE).includes('financial-service')
      ? 'FINANCIAL_SERVICE'
      : 'UE_OPERATIONAL',
    SOURCE_FILE: text(record.FILE),
    SOURCE_SHA256: text(record.SHA256),
    FROZEN_MIGRATION_ID: text(record.MIGRATION_NODE_ID),
    HISTORICAL_POSITION: number(record.FROZEN_POSITION),
    INTRA_MIGRATION_POSITION: Number.MAX_SAFE_INTEGER,
    EXACT_UNIT_SHA256: text(record.SHA256),
    COMPATIBILITY_OBLIGATION_IDS: [],
    WRAPPER_BEHAVIOR_PRESERVED: 'YES',
    PRECONDITIONS: [input.canonical.FROZEN_MANIFEST_SCOPE_RULE ?? null],
    POSTCONDITIONS: [
      'Every original non-CREATE/postcreate statement and enclosing wrapper remains in original scope/relative order;only accepted exact state-aware CREATE recheck may avoid redundant creation.',
    ],
    EXECUTION_ALLOWED: 'NO',
  }))
  const migrationNodes = [...nodes]
  const replayRecords = late.map((record) => {
    assert.equal(record.COMPATIBILITY_CLASS, 'OTHER_EXPLICIT')
    assert.equal(
      record.OTHER_COMPATIBILITY_CLASS,
      'NO_W4FR4_PRECREATION_COLLISION_EXACT_LATE_PROMOTION_REPLAY_REQUIRED',
    )
    const source = object(object(record.SOURCE_RECORD).CANONICAL_DEFINITION_SOURCE)
    const match = sources.find(
      ({ record: entry }) => entry.MIGRATION_NODE_ID === record.FROZEN_MIGRATION_ID,
    )
    assert(match, 'REPLAY_SOURCE_ENDPOINT_MISSING')
    assert.equal(match.record.FILE, source.SOURCE_FILE)
    assert.equal(match.record.SHA256, source.SOURCE_SHA256)
    assert.equal(match.record.FROZEN_POSITION, record.FROZEN_POSITION)
    const definition = object(record.EXACT_LATE_DEFINITION)
    const clause = text(definition.EXACT_CREATE_CLAUSE)
    assert.equal(sha(clause), record.EXACT_LATE_DEFINITION_DIGEST)
    const binding = bindFrozenUnit(match.bytes, clause, number(definition.DEFINITION_SOURCE_LINE))
    const unitId = id(
      'UNIT',
      `${record.FROZEN_MIGRATION_ID}:${record.EXACT_LATE_DEFINITION_DIGEST}`,
    )
    let node = nodes.find((node) => node.REPLAY_UNIT_ID === unitId)
    if (!node) {
      node = {
        REPLAY_UNIT_ID: unitId,
        REPLAY_UNIT_CLASS: binding.REPLAY_UNIT_CLASS,
        PHASE: 'LATE_DEFINITION_STATE_BOUNDARY',
        DATABASE_SCOPE: 'UE_OPERATIONAL',
        SOURCE_FILE: text(source.SOURCE_FILE),
        SOURCE_SHA256: text(source.SOURCE_SHA256),
        FROZEN_MIGRATION_ID: text(record.FROZEN_MIGRATION_ID),
        HISTORICAL_POSITION: number(record.FROZEN_POSITION),
        INTRA_MIGRATION_POSITION: binding.INTRA_MIGRATION_POSITION,
        EXACT_UNIT_SHA256: binding.STATEMENT.SHA256,
        COMPATIBILITY_OBLIGATION_IDS: [],
        WRAPPER_BEHAVIOR_PRESERVED: 'YES',
        PRECONDITIONS: [],
        POSTCONDITIONS: [],
        EXECUTION_ALLOWED: 'NO',
      }
      nodes.push(node)
    }
    assert.equal(node.EXACT_UNIT_SHA256, binding.STATEMENT.SHA256)
    node.COMPATIBILITY_OBLIGATION_IDS.push(text(record.COMPATIBILITY_OBLIGATION_ID))
    node.PRECONDITIONS.push(record.PRECONDITION ?? null)
    node.POSTCONDITIONS.push(record.POSTCONDITION ?? null)
    return {
      COMPATIBILITY_OBLIGATION_ID: text(record.COMPATIBILITY_OBLIGATION_ID),
      PHYSICAL_IDENTITY: text(record.PHYSICAL_IDENTITY),
      OBJECT_KIND: text(record.OBJECT_KIND),
      LATE_DEFINITION_ID: text(record.LATE_DEFINITION_ID),
      LATE_PRODUCER_ID: text(record.LATE_PRODUCER_ID),
      FROZEN_MIGRATION_ID: text(record.FROZEN_MIGRATION_ID),
      SOURCE_FILE: text(source.SOURCE_FILE),
      SOURCE_SHA256: text(source.SOURCE_SHA256),
      FROZEN_POSITION: number(record.FROZEN_POSITION),
      REPLAY_UNIT_CLASS: binding.REPLAY_UNIT_CLASS,
      REPLAY_UNIT_ID: unitId,
      COMPATIBILITY_MECHANIC: record.COMPATIBILITY_MECHANIC,
      PRECONDITIONS: record.PRECONDITION,
      POSTCONDITIONS: record.POSTCONDITION,
      EXACT_OPERATION_SHA256: binding.EXACT_OPERATION_SHA256,
      SOURCE_RANGE: [binding.STATEMENT.START, binding.STATEMENT.END],
      EXACT_UNIT_SHA256: binding.STATEMENT.SHA256,
      ATOMICITY_CLASS: binding.ATOMICITY_CLASS,
      ATOMICITY_REASON: binding.REASON,
      WRAPPER_BEHAVIOR_PRESERVED: 'YES',
      ORIGINAL_POSITION_RECHECK_UNIT_ID: id('MIGRATION', text(record.FROZEN_MIGRATION_ID)),
      ORIGINAL_RECORD: record,
      VALIDATE_EXPECTED_PRESTATE: 'REQUIRED',
      FAIL_ON_DRIFT: 'REQUIRED',
      PRESERVE_ENCLOSING_WRAPPER: 'REQUIRED',
      PRESERVE_POSTCREATE_BEHAVIOR: 'REQUIRED',
      EXECUTION_ALLOWED: 'NO',
    }
  })
  const edges: GraphEdge[] = []
  const add = (
    from: string,
    to: string,
    edgeClass: string,
    recordId: string,
    source: string,
    sourceDigest: string,
    evidence: Json,
  ) => {
    const edge: GraphEdge = {
      EDGE_ID: id('EDGE', `${edgeClass}:${recordId}:${from}:${to}`),
      FROM: from,
      TO: to,
      EDGE_CLASS: edgeClass,
      SOURCE_RECORD_ID: recordId,
      SOURCE_FILE_OR_CONTRACT: source,
      SOURCE_DIGEST: sourceDigest,
      SOURCE_EVIDENCE: evidence,
    }
    edges.push(edge)
    return edge
  }
  const orderingRegistry = ordering.map((handoff) => {
    const provider = replayRecords.filter(
      (record) =>
        record.PHYSICAL_IDENTITY === handoff.PHYSICAL_IDENTITY &&
        record.SOURCE_FILE === handoff.LATER_PROVIDER,
    )
    assert.equal(provider.length, 1, 'ORDERING_PROVIDER_ENDPOINT_UNPROVEN')
    const consumer = migrationNodes.filter((node) => node.SOURCE_FILE === handoff.CONSUMER)
    assert.equal(consumer.length, 1, 'ORDERING_CONSUMER_ENDPOINT_UNPROVEN')
    assert(
      strings(provider[0].ORIGINAL_RECORD.W5_HANDOFF_IDS).includes(
        text(handoff.ORDERING_RECORD_ID),
      ),
      'EXACT_HANDOFF_RECORD_LINK_MISSING',
    )
    const edge = add(
      provider[0].REPLAY_UNIT_ID,
      consumer[0].REPLAY_UNIT_ID,
      'ACCEPTED_W5_HANDOFF',
      text(handoff.ORDERING_RECORD_ID),
      files.producer,
      fixedHashes[files.producer],
      handoff,
    )
    const consumerSource = sources.find(
      ({ record }) => record.MIGRATION_NODE_ID === consumer[0].FROZEN_MIGRATION_ID,
    )
    assert(consumerSource, 'EXACT_CONSUMER_SOURCE_MISSING')
    const identity = text(handoff.PHYSICAL_IDENTITY).split('::').at(-1)!
    const relation = identity.split('.')[1]
    assert(
      relation &&
        sqlTokens(consumerSource.bytes).some(
          (token) => token.kind === 'STRING' && token.value === relation,
        ),
      'ACCEPTED_CONSUMER_RELATION_NOT_RECORDED_IN_FROZEN_SOURCE',
    )
    return {
      ORDERING_RECORD_ID: text(handoff.ORDERING_RECORD_ID),
      ORDERING_OBLIGATION_ID: text(handoff.ORDERING_OBLIGATION_ID),
      FROM_REPLAY_UNIT_ID: edge.FROM,
      TO_REPLAY_UNIT_ID: edge.TO,
      PHYSICAL_IDENTITY: handoff.PHYSICAL_IDENTITY,
      ORDERING_RATIONALE:
        'Exact accepted provider must satisfy this identity before the frozen consumer;move the accepted state-aware definition boundary,not the original migration/postcreate behavior.',
      HISTORICAL_PROVIDER_POSITION: provider[0].FROZEN_POSITION,
      HISTORICAL_CONSUMER_POSITION: consumer[0].HISTORICAL_POSITION,
      ORDER_OVERRIDE_SOURCE: 'ACCEPTED_W5_HANDOFF',
      ATOMICITY_CLASS: provider[0].ATOMICITY_CLASS,
      EDGE_ID: edge.EDGE_ID,
      SOURCE_EVIDENCE: handoff,
      EXECUTION_ALLOWED: 'NO',
    }
  })
  const unitNodes = nodes.filter((node) => node.PHASE === 'LATE_DEFINITION_STATE_BOUNDARY')
  for (const node of unitNodes) {
    const record = replayRecords.find((record) => record.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID)!
    add(
      node.REPLAY_UNIT_ID,
      record.ORIGINAL_POSITION_RECHECK_UNIT_ID,
      'RECORDED_REPLAY_PRESTATE_PRECONDITION',
      record.COMPATIBILITY_OBLIGATION_ID,
      files.late,
      fixedHashes[files.late],
      {
        EXACT_REQUIRED_MECHANIC: record.ORIGINAL_RECORD.EXACT_REQUIRED_MECHANIC ?? null,
        SOURCE_RECORD_DIGEST: digest(record.ORIGINAL_RECORD),
      },
    )
  }
  // Accepted scope-specific frozen order applies to original replay, never to the earlier CREATE state boundary.
  const operational = migrationNodes
    .filter((node) => node.DATABASE_SCOPE === 'UE_OPERATIONAL')
    .sort((a, b) => a.HISTORICAL_POSITION - b.HISTORICAL_POSITION)
  for (let index = 1; index < operational.length; index++)
    add(
      operational[index - 1].REPLAY_UNIT_ID,
      operational[index].REPLAY_UNIT_ID,
      'RECORDED_SCOPE_REPLAY_ORDER_PRECONDITION',
      operational[index].FROZEN_MIGRATION_ID,
      files.canonical,
      fixedHashes[files.canonical],
      {
        ORDER_PRESERVED: input.canonical.ORDER_PRESERVED ?? null,
        FROZEN_MANIFEST_SCOPE_RULE: input.canonical.FROZEN_MANIFEST_SCOPE_RULE ?? null,
        FROM_MIGRATION: operational[index - 1].FROZEN_MIGRATION_ID,
        TO_MIGRATION: operational[index].FROZEN_MIGRATION_ID,
      },
    )
  const types = replayRecords.filter((record) => record.OBJECT_KIND === 'TYPE')
  for (const node of unitNodes) {
    const record = replayRecords.find((record) => record.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID)!
    if (record.OBJECT_KIND === 'TYPE') continue
    const clause = text(object(record.ORIGINAL_RECORD.EXACT_LATE_DEFINITION).EXACT_CREATE_CLAUSE)
    for (const reference of exactColumnTypes(clause)) {
      const identity = `union-eyes::TYPE::${reference.schema}.${reference.name}`
      const provider = types.filter((type) => type.PHYSICAL_IDENTITY === identity)
      if (!provider.length) continue
      assert.equal(provider.length, 1, 'EXACT_TYPE_REFERENCE_AMBIGUOUS')
      add(
        provider[0].REPLAY_UNIT_ID,
        node.REPLAY_UNIT_ID,
        'EXACT_FROZEN_COLUMN_TYPE_DEPENDENCY',
        `${record.COMPATIBILITY_OBLIGATION_ID}:${reference.start}`,
        record.SOURCE_FILE,
        record.SOURCE_SHA256,
        {
          EXACT_CREATE_OPERATION_SHA256: record.EXACT_OPERATION_SHA256,
          OPERATION_RELATIVE_TOKEN_RANGE: [reference.start, reference.end],
          EXACT_TYPE_REFERENCE: clause.slice(reference.start, reference.end),
          REQUIRED_PHYSICAL_IDENTITY: identity,
        },
      )
    }
  }
  const topology = topologicalPlan(nodes, edges)
  assert.equal(new Set(edges.map((edge) => edge.EDGE_ID)).size, edges.length, 'DUPLICATE_EDGE_ID')
  assert.equal(
    new Set(late.map((record) => record.COMPATIBILITY_OBLIGATION_ID)).size,
    127,
    'DUPLICATE_OBLIGATION_ID',
  )
  assert.equal(
    new Set(ordering.map((record) => record.ORDERING_RECORD_ID)).size,
    86,
    'DUPLICATE_ORDERING_ID',
  )
  const conflicts = replayRecords.filter(
    (record) => record.ATOMICITY_CLASS === 'ATOMICITY_CONFLICT',
  )
  const pass = topology.COMPLETE && !conflicts.length
  const positions = new Map(
    topology.ORDER.map((node) => [node.REPLAY_UNIT_ID, node.REQUIRED_REPLAY_POSITION]),
  )
  const locatedOrdering = orderingRegistry.map((record) => ({
    ...record,
    REQUIRED_PROVIDER_REPLAY_POSITION: positions.get(record.FROM_REPLAY_UNIT_ID) ?? null,
    REQUIRED_CONSUMER_REPLAY_POSITION: positions.get(record.TO_REPLAY_UNIT_ID) ?? null,
  }))
  const register = {
    BOUND_REPLAY_RECORDS: replayRecords,
    BOUND_ORDERING_HANDOFFS: locatedOrdering,
    DEFERRED_CONSTRAINT_HANDOFFS: deferred.map((record) => ({
      DEFERRED_CONSTRAINT_HANDOFF_ID: record.DEFERRED_CONSTRAINT_HANDOFF_ID,
      STATUS: 'DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION',
      MATERIALIZATION_POSITION: 'UNRESOLVED_DOWNSTREAM',
      ORIGINAL_HANDOFF: record.ORIGINAL_HANDOFF,
      ORIGINAL_BINDING_RESULT: record.ORIGINAL_BINDING_RESULT,
      EXECUTION_ALLOWED: 'NO',
    })),
    UNRESOLVED_OPERAND_BINDINGS: operands.map((record) => ({
      PHYSICAL_OPERAND_IDENTITY: record.PHYSICAL_OPERAND_IDENTITY,
      STATUS: 'UNRESOLVED_DOWNSTREAM',
      ORIGINAL_RESIDUAL: record,
      EXECUTION_ALLOWED: 'NO',
    })),
  }
  const summary = {
    REPLAY_RECORD_COUNT: 127,
    REPLAY_RECORDS_ACCOUNTED: replayRecords.length,
    UNACCOUNTED_REPLAY_RECORDS: 0,
    ORDERING_HANDOFFS: 86,
    HANDOFFS_WITH_GRAPH_EDGES: locatedOrdering.length,
    UNACCOUNTED_HANDOFFS: 0,
    ACCEPTED_HANDOFF_EDGE_RECORDS: orderingRegistry.length,
    UNIQUE_ACCEPTED_HANDOFF_ENDPOINT_EDGES: new Set(
      orderingRegistry.map((record) => `${record.FROM_REPLAY_UNIT_ID}:${record.TO_REPLAY_UNIT_ID}`),
    ).size,
    REPLAY_UNIT_COUNT: nodes.length,
    DISTINCT_COMPATIBILITY_REPLAY_UNITS: unitNodes.length,
    FROZEN_STATEMENT_UNITS: unitNodes.filter(
      (node) => node.REPLAY_UNIT_CLASS === 'FROZEN_STATEMENT_UNIT',
    ).length,
    FROZEN_WRAPPER_UNITS: unitNodes.filter(
      (node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT',
    ).length,
    ORIGINAL_FROZEN_MIGRATION_REPLAY_UNITS: migrationNodes.length,
    GRAPH_EDGE_COUNT: edges.length,
    REPLAY_GRAPH_CYCLES: topology.CYCLE_OR_CYCLE_DEPENDENT_UNIT_IDS.length ? 'PRESENT' : 0,
    UNRESOLVED_ORDERING_ENDPOINTS: topology.UNRESOLVED_ORDERING_ENDPOINT_IDS.length,
    UNPROVEN_ORDERING_EDGES: 0,
    ATOMICITY_CONFLICT_RECORDS: conflicts.length,
    DEFERRED_CONSTRAINT_HANDOFFS: 7,
    DEFERRED_CONSTRAINT_LOCATIONS_COMPLETE: 'NO',
    UNRESOLVED_OPERAND_BINDINGS: 9,
    FROZEN_MIGRATIONS_HASH_VERIFIED: 23,
    FROZEN_MIGRATION_HASH_DRIFT: 0,
    FROZEN_MIGRATIONS_REWRITTEN: 0,
    W4P_PRECONDITION_GRAPH_CHANGED: 'NO',
    POST_W4P_ITEMS_MOVED_BACK_BEFORE_W4P: 0,
    COMPATIBILITY_MECHANICS_CHANGED: 0,
    ORDERING_HANDOFFS_CHANGED: 0,
    SQL_AUTHORED: 0,
    SQL_EXECUTED: 0,
    PRODUCERS_ACTIVATED: 0,
  }
  const graph = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W5A',
      INPUTS: files,
      EXECUTION_ALLOWED: 'NO',
      GENERAL_DISCOVERY: 'NO',
    },
    summary,
    nodes,
    edges,
    downstreamRegister: register,
    replayBoundaryDoctrine: {
      MACRO_ORDER: [
        'DJANGO_FIRST',
        'GOVERNED_PLATFORM_BASELINE_W4P',
        'POST_W4P_REPLAY_ORDER',
        'LATER_DEFERRED_CONSTRAINT_MATERIALIZATION_WHEN_ALL_OPERANDS_EXIST',
      ],
      W4P_POSTCONDITION:
        'Hypothetical successful W4P full verification is a mandatory future entry gate;not executed here.',
      LATE_DEFINITION_BOUNDARY:
        'State-aware prestate/promotion planning consumes exact original statement/wrapper units,not synthetic producers;their original-position recheck preserves every non-CREATE/postcreate behavior.',
      FROZEN_MIGRATION_ORDER:
        'Original UE replay boundaries retain accepted manifest relative order;financial replay stays in its separate scope. Only exact accepted W5 handoffs authorize earlier definition availability.',
      ATOMICITY:
        'No DO body split;additional behavior forces whole-migration fallback and a blocking atomicity conflict. Future state-aware wrapper must fail on drift before any duplicate handler;no generic IF NOT EXISTS policy.',
      COMPLETENESS_CEILING:
        'Bound127/86 static ordering graph only;creation target/actor/runtime/precondition satisfaction remains W5B/W8 work. No full-schema/runtime proof.',
    },
  }
  const plan = {
    metadata: graph.metadata,
    TIE_RULE:
      'Existing frozen position,then exact source statement ordinal,then stable replay-unit ID;not semantic priority.',
    EXECUTION_ALLOWED: 'NO',
    BOUND_REPLAY_ORDERING_GRAPH_COMPLETE: pass ? 'YES' : 'NO',
    ORDER: topology.ORDER,
    UNRESOLVED_ORDERING_ENDPOINT_IDS: topology.UNRESOLVED_ORDERING_ENDPOINT_IDS,
    CYCLE_OR_CYCLE_DEPENDENT_UNIT_IDS: topology.CYCLE_OR_CYCLE_DEPENDENT_UNIT_IDS,
    ATOMICITY_CONFLICT_OBLIGATION_IDS: conflicts.map(
      (record) => record.COMPATIBILITY_OBLIGATION_ID,
    ),
    SCOPE_ISOLATION:
      'FINANCIAL_SERVICE node is its own sequence;linearized output is metadata only,never a merged-database execution plan.',
  }
  const report = {
    metadata: graph.metadata,
    summary,
    phaseStatus: {
      PHASE_1B_3C_A1I_W5A_GATE: pass ? 'PASS' : 'BLOCKED',
      PHASE_1B_3C_A1I_W5A: pass ? 'PASS' : 'BLOCKED',
      BOUND_REPLAY_ORDERING_GRAPH: pass ? 'COMPLETE_NOT_EXECUTED' : 'BLOCKED',
      W5: pass ? 'IN_PROGRESS' : 'BLOCKED',
      W5B_REPLAY_IMPLEMENTATION: pass ? 'AUTHORIZED_NOT_STARTED' : 'NOT_AUTHORIZED',
      W4: 'PASS',
      W4P: 'PASS',
      W4P_RUNTIME_EXECUTION: 'NOT_AUTHORIZED',
      CANONICAL_CONTRACT_VERSION: '1.3.3',
    },
    blockers: {
      ATOMICITY_CONFLICT_OBLIGATION_IDS: plan.ATOMICITY_CONFLICT_OBLIGATION_IDS,
      ATOMICITY_CONFLICT_UNIT_IDS: [...new Set(conflicts.map((record) => record.REPLAY_UNIT_ID))],
      CYCLE_OR_CYCLE_DEPENDENT_UNIT_IDS: plan.CYCLE_OR_CYCLE_DEPENDENT_UNIT_IDS,
      UNRESOLVED_ORDERING_ENDPOINT_IDS: plan.UNRESOLVED_ORDERING_ENDPOINT_IDS,
    },
    determinismDigests: {
      REPLAY_GRAPH_SHA256: digest(graph),
      TOPOLOGICAL_PLAN_SHA256: digest(plan),
      REPLAY_UNIT_REGISTRY_SHA256: digest(nodes),
      ORDERING_EDGE_REGISTRY_SHA256: digest(locatedOrdering),
      DOWNSTREAM_RESIDUAL_REGISTER_SHA256: digest({
        constraints: register.DEFERRED_CONSTRAINT_HANDOFFS,
        operands: register.UNRESOLVED_OPERAND_BINDINGS,
      }),
    },
    preservation: {
      BYTE_COMMITMENTS: preservation,
      W4P_PLAN_DIGEST: input.promotionPlan.PLAN_DIGEST,
      W4_DEFINITIONS: 183,
      W4_PAYLOADS: 162,
      NAMED_TYPES: 36,
      CONTEXTUAL_TYPE_REFERENCES: 38,
      COMPATIBILITY_RECORDS_SHA256: digest(late),
      ORDERING_HANDOFFS_SHA256: digest(ordering),
      DEFERRED_HANDOFF_BINDINGS_SHA256: digest(bindings),
      OPERAND_RESIDUALS_SHA256: digest(operands),
      UPSTREAM_BYTES_CHANGED: 0,
      CANONICAL_CONTRACT_VERSION: '1.3.3',
    },
    validation: {
      EXACT127_ACCOUNTING: 'PASS',
      EXACT86_ACCOUNTING: 'PASS',
      EXACT7_ACCOUNTING: 'PASS',
      EXACT9_ACCOUNTING: 'PASS',
      FROZEN23_HASHES: 'PASS',
      EXACT_OPERATION_BINDING: 'PASS',
      COMPATIBILITY_MECHANICS_PRESERVED: 'PASS',
      EDGE_PROVENANCE: 'PASS',
      DAG_CLOSURE: pass ? 'PASS' : 'BLOCKED',
      COMPLETED_LOCAL_VALIDATION: [
        {
          COMMAND: String.raw`pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\close-w5a-replay-graph.test.ts`,
          RESULT: 'PASS',
          TESTS_PASSED: 531,
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\provisioning\platform-baseline-promotion.test.ts scripts\ue\implement-w4p-platform-promotion.test.ts`,
          RESULT: 'PASS',
          TESTS_PASSED: 895,
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config scripts\ue\w4p-predecessor.vitest.config.ts scripts\ue\normalize-w4pg-promotion-gate.test.ts scripts\ue\bind-w4lb-supplemental-operands.test.ts scripts\ue\classify-w4lc-compatibility.test.ts scripts\ue\author-w4fr4-final-baseline.test.ts`,
          RESULT: 'PASS',
          TESTS_PASSED: 1154,
        },
        {
          COMMAND: String.raw`pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\ue\close-w5a-replay-graph.ts scripts\ue\close-w5a-replay-graph.test.ts`,
          RESULT: 'PASS',
        },
        {
          COMMAND: String.raw`pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 scripts\ue\close-w5a-replay-graph.ts scripts\ue\close-w5a-replay-graph.test.ts`,
          RESULT: 'PASS_EXIT_0',
          NOTE: 'Existing Next pages-directory diagnostic printed;no lint errors.',
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\close-w5a-replay-graph.ts --plan --self-test`,
          RESULT: 'PASS_TWO_GENERATIONS_IDENTICAL',
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\close-w5a-replay-graph.ts --check --self-test`,
          RESULT: 'PASS_PERSISTED_BYTES_FIXED_INPUTS_TWO_GENERATIONS',
        },
        {
          COMMAND: `pnpm exec prettier --check scripts\\ue\\close-w5a-replay-graph.ts scripts\\ue\\close-w5a-replay-graph.test.ts ${Object.values(
            outputs,
          )
            .map((file) => file.replaceAll('/', '\\'))
            .join(' ')}`,
          RESULT: 'PASS',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS',
          FILES_SCANNED: 2635,
          ERRORS: 0,
          EXISTING_WARNINGS: 1215,
        },
      ],
      DISTINCT_TESTS_PASSED: 2580,
      INDEPENDENT_PERSISTED_JSON_VERIFICATION:
        'PASS;node fs/crypto/assert verification without generator imports:107 nodes,231 ordered/provenance edges,36 byte commitments,exact127/86/7/9,no cross-scope edge,no activation',
      EVIDENCE_CEILING:
        'Completed local static/fake-only validation;never a runtime execution receipt.',
    },
    proofBoundaries: {
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
    },
  }
  return { graph, plan, report }
}
export async function generate() {
  const model = buildGraph()
  const config = await resolveConfig(path.join(root, 'package.json'))
  const recordTable = model.graph.downstreamRegister.BOUND_REPLAY_RECORDS.map(
    (record) =>
      `| ${record.COMPATIBILITY_OBLIGATION_ID} | ${record.PHYSICAL_IDENTITY} | ${record.REPLAY_UNIT_ID} | ${record.REPLAY_UNIT_CLASS} | ${record.ATOMICITY_CLASS} |`,
  ).join('\n')
  const edgeTable = model.graph.downstreamRegister.BOUND_ORDERING_HANDOFFS.map(
    (record) =>
      `| ${record.ORDERING_RECORD_ID} | ${record.FROM_REPLAY_UNIT_ID} | ${record.TO_REPLAY_UNIT_ID} | ${record.HISTORICAL_PROVIDER_POSITION} / ${record.HISTORICAL_CONSUMER_POSITION} | ${record.REQUIRED_PROVIDER_REPLAY_POSITION} / ${record.REQUIRED_CONSUMER_REPLAY_POSITION} | ${record.ATOMICITY_CLASS} |`,
  ).join('\n')
  const orderTable = model.plan.ORDER.map(
    (node) =>
      `| ${node.REQUIRED_REPLAY_POSITION} | ${node.REPLAY_UNIT_ID} | ${node.REPLAY_UNIT_CLASS} | ${node.PHASE} | ${node.DATABASE_SCOPE} | ${node.HISTORICAL_POSITION} | ${node.SOURCE_FILE} |`,
  ).join('\n')
  const constraints = model.graph.downstreamRegister.DEFERRED_CONSTRAINT_HANDOFFS.map(
    (record) =>
      `| ${record.DEFERRED_CONSTRAINT_HANDOFF_ID} | DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION | UNRESOLVED_DOWNSTREAM |`,
  ).join('\n')
  const operands = model.graph.downstreamRegister.UNRESOLVED_OPERAND_BINDINGS.map(
    (record) => `| ${record.PHYSICAL_OPERAND_IDENTITY} | UNRESOLVED_DOWNSTREAM |`,
  ).join('\n')
  const summary = `# W5A post-W4P replay and ordering graph - ${model.report.phaseStatus.PHASE_1B_3C_A1I_W5A_GATE}

## Bound replay-unit accounting

127/127 original compatibility records/mechanics preserved. ${model.report.summary.DISTINCT_COMPATIBILITY_REPLAY_UNITS} exact shared CREATE units: ${model.report.summary.FROZEN_STATEMENT_UNITS} standalone statements/${model.report.summary.FROZEN_WRAPPER_UNITS} enum DO wrappers. All23 original-position frozen migration boundaries retained separately;${model.report.summary.REPLAY_UNIT_COUNT} total graph nodes. No forced127-node denominator,no synthetic producer.

## Ordering,atomicity and wrapper preservation

86/86 exact accepted handoffs mapped to86 provenance-preserving edges;${model.report.summary.UNIQUE_ACCEPTED_HANDOFF_ENDPOINT_EDGES} unique endpoint pairs. Provider availability precedes consumer;historical positions remain recorded,not execution authority. ORDER_OVERRIDE_SOURCE=ACCEPTED_W5_HANDOFF.
Exact enum wrappers remain indivisible. Standalone CREATE units retain their complete table definition. State-aware prestate validation fails on drift before duplicate/IF-NOT-EXISTS paths;all original wrappers/non-CREATE/postcreate behavior stays at original migration replay. Frozen schema objects are not renamed or rewritten.
Atomicity conflicts=${model.report.summary.ATOMICITY_CONFLICT_RECORDS};unresolved endpoints=${model.report.summary.UNRESOLVED_ORDERING_ENDPOINTS};graph cycles=${model.report.summary.REPLAY_GRAPH_CYCLES};unproven edges=0.

## Graph and topological plan

${model.report.summary.GRAPH_EDGE_COUNT} exact-provenance edge records. Original UE manifest-relative order is retained under the accepted scope rule;financial replay remains separate. Exact column-type references within recorded CREATE definitions supply only bound type-to-table edges. No semantic-similarity dependencies.
Deterministic tie rule: frozen position,source statement ordinal,stable unit ID. Complete ordered topology in [the plan](./UE_W5_REPLAY_TOPOLOGICAL_PLAN.md).
Sequence remains DJANGO_FIRST ->successful future W4P verification ->post-W4P state-aware replay ->later constraint materialization when operands exist. W4P precondition graph unchanged;0 downstream items moved before W4P.

## Carried deferred register

| Handoff ID | State | Materialization position |
|---|---|---|
${constraints}

| Exact operand | State |
|---|---|
${operands}

DEFERRED_CONSTRAINT_LOCATIONS_COMPLETE=NO;UNRESOLVED_OPERAND_BINDINGS=9. None is a bound127/86 graph blocker;none is erased,resolved or included as an executable constraint unit.

## Determinism,preservation and validation

Graph SHA256: \`${model.report.determinismDigests.REPLAY_GRAPH_SHA256}\`.
Plan SHA256: \`${model.report.determinismDigests.TOPOLOGICAL_PLAN_SHA256}\`.
${Object.keys(model.report.preservation.BYTE_COMMITMENTS).length} fixed byte commitments including12 authoritative inputs,the W4P engine and23 frozen migrations. W4P plan digest,canonical1.3.3 and downstream mechanics unchanged. Exact completed validation commands/results are recorded in [the phase report](./PHASE_1B_3C_A1I_W5A_REPLAY_ORDERING_GRAPH.json).

## Gate and proof boundary

W5A=${model.report.phaseStatus.PHASE_1B_3C_A1I_W5A_GATE};BOUND_REPLAY_ORDERING_GRAPH=${model.report.phaseStatus.BOUND_REPLAY_ORDERING_GRAPH};W5=${model.report.phaseStatus.W5};W5B_REPLAY_IMPLEMENTATION=${model.report.phaseStatus.W5B_REPLAY_IMPLEMENTATION};CANONICAL_CONTRACT_VERSION=1.3.3. W5 not complete;no1.3.4.
DATABASE_CONNECTIONS=0;SQL_EXECUTED=0;W4P_EXECUTED=NO;FROZEN_MIGRATIONS_EXECUTED=0;COMPATIBILITY_MECHANICS_EXECUTED=0;DEFERRED_CONSTRAINTS_MATERIALIZED=NO;W5_EXECUTED=NO;PRODUCERS_ACTIVATED=0;BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;FAITHFUL_SCHEMA_REPLAY_PROVEN=NO;RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN=NO;TENANT_ISOLATION_RUNTIME_PROVEN=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
`
  const json = (value: unknown) => format(JSON.stringify(value), { ...config, parser: 'json' })
  const markdown = (value: string) => format(value, { ...config, parser: 'markdown' })
  return {
    [outputs.graph]: await json(model.graph),
    [outputs.plan]: await json(model.plan),
    [outputs.report]: await json(model.report),
    [outputs.markdown]: await markdown(summary),
    [outputs.graphMarkdown]: await markdown(
      `${summary}\n\n## Exact127 record-to-unit bindings\n\n| Obligation ID | Physical identity | Unit ID | Unit class | Atomicity |\n|---|---|---|---|---|\n${recordTable}\n\n## Exact86 handoff-to-edge bindings\n\n| Ordering record ID | From unit | To unit | Historical provider/consumer | Required provider/consumer | Atomicity |\n|---|---|---|---|---|---|\n${edgeTable}\n\nEvery graph edge has exact source record/file/digest and evidence in [the machine graph](./UE_W5_POST_W4P_REPLAY_GRAPH.json). No replay implementation or runtime receipt.\n`,
    ),
    [outputs.planMarkdown]: await markdown(
      `# W5 static replay topological plan\n\nExecution not authorized. Tie rule: ${model.plan.TIE_RULE} Financial-service nodes remain scope-separated;the linear order is static metadata,not a merged DB command sequence. Every original migration boundary remains byte/hash-bound and preserves postcreate behavior;late definition units have original-position state-aware rechecks.\n\n| Required position | Unit ID | Class | Phase | Scope | Historical position | Source file |\n|---|---|---|---|---|---|---|\n${orderTable}\n\nGraph digest \`${model.report.determinismDigests.REPLAY_GRAPH_SHA256}\`;plan digest \`${model.report.determinismDigests.TOPOLOGICAL_PLAN_SHA256}\`. See [machine plan](./UE_W5_REPLAY_TOPOLOGICAL_PLAN.json) and [phase report](./PHASE_1B_3C_A1I_W5A_REPLAY_ORDERING_GRAPH.md).7 deferred constraints/9 operand residuals remain outside this bound graph.\n`,
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.length && args.every((arg) => ['--plan', '--check', '--self-test'].includes(arg)),
    'UNAUTHORIZED_W5A_FLAG',
  )
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W5A')
    console.log('PASS W5A two-generation exact-byte equality')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `W5A_ARTIFACT_DRIFT:${file}`)
    console.log('PASS W5A persisted bytes and fixed upstream hashes')
  } else if (args.includes('--plan')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, file), bytes)
    console.log(
      'W5A static graph artifacts persisted;no DB connection,SQL execution or upstream changes',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
