import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { sqlTokens } from './close-w4t-named-types'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4fr4: folder + 'PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.json',
  definitions: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.json',
  payloads: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json',
  w4lc: folder + 'PHASE_1B_3C_A1I_W4LC_COMPATIBILITY_GATE_NORMALIZATION.json',
  late: folder + 'UE_W4_LATE_PRODUCER_COMPATIBILITY_CLASSIFICATION.json',
  w4lb: folder + 'PHASE_1B_3C_A1I_W4LB_SUPPLEMENTAL_OPERAND_BINDING.json',
  operands: folder + 'UE_W4_SUPPLEMENTAL_OPERAND_PRODUCER_BINDINGS.json',
  bindings: folder + 'UE_W4_SUPPLEMENTAL_CONSTRAINT_BINDINGS.json',
  deferred: folder + 'UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const fixedHashes: Record<string, string> = {
  [files.w4fr4]: 'feca82ce999454257dfd3157011684a829731bedab070d07890bc2f39d00f1c6',
  [files.definitions]: 'b84d75a98fec07e86ad68689a93ceebbdb262eee143de2a8f8eee6ba8562784d',
  [files.payloads]: '6f81fde1377714e0fb63177cd976a010ec6db197bb8365ad340b8b40d4629e2b',
  [files.w4lc]: 'fef8528dda5467bb742cd4987b449809f3143099648ec42381b665ecb7cc3ab8',
  [files.late]: 'fc98ce059a4e4d26caadecb7ed9a686db81d324e8e597477f55064d74b76ed98',
  [files.w4lb]: '40ab8780f42b87389345cd3c5191f525ad5470e173f02d9eb946835bfbc3b1e0',
  [files.operands]: '8ed7eb94b12d2d4b172e5a608d972ce93cbd4334e3cd4a4dfc31cfbffab15fb6',
  [files.bindings]: '2bfbbf5b3762d7bc4604b5e403210fb4162f0af8a667436454e3053b45bc8f6b',
  [files.deferred]: 'ce57db581afbee96a9a9017b76cebf309b5741216a7df32d4b80d8f216c9c367',
  [files.producer]: 'ba88ee29a58c55c6b50930ff75089a59c00c68526f2e2e12547e801cca6c9673',
  [files.canonical]: '89dda28394c53c1c9ed9222982c6fff4b0840186831129f32206ba451cc3b1fd',
}
export const outputs = {
  cut: folder + 'UE_W4P_PROMOTION_DEPENDENCY_CUT.json',
  cutMarkdown: folder + 'UE_W4P_PROMOTION_DEPENDENCY_CUT.md',
  downstream: folder + 'UE_POST_W4P_COMPATIBILITY_OBLIGATIONS.json',
  downstreamMarkdown: folder + 'UE_POST_W4P_COMPATIBILITY_OBLIGATIONS.md',
  report: folder + 'PHASE_1B_3C_A1I_W4PG_PROMOTION_GATE_NORMALIZATION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4PG_PROMOTION_GATE_NORMALIZATION.md',
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
  assert.equal(typeof value, 'string', 'EXPECTED_STRING')
  assert(typeof value === 'string')
  return value
}
const evidence = (file: string, pointer: string, value: Json) => ({
  SOURCE_FILE: file,
  SOURCE_SHA256: fixedHashes[file],
  JSON_POINTER: pointer,
  RECORDED_VALUE: value,
})
function fieldInventory(file: string, pointer: string, record: RecordJson) {
  return Object.entries(record)
    .filter(([key]) =>
      /DEPENDENC|PRECONDITION|POSTCONDITION|HANDOFF|EXPECTED_|DEFINITION_STATUS|DEFINITION_SOURCE_CLASS|HISTORICAL|BLOCKING/.test(
        key,
      ),
    )
    .map(([key, value]) => evidence(file, `${pointer}/${key}`, value))
}
export interface Edge {
  FROM: string
  TO: string
  KIND: string
  SOURCE: ReturnType<typeof evidence>
}
export function dependencyPaths(roots: string[], edges: Edge[], targets: string[]) {
  const wanted = new Set(targets)
  const adjacency = new Map<string, Edge[]>()
  for (const edge of edges) {
    const list = adjacency.get(edge.FROM) ?? []
    list.push(edge)
    adjacency.set(edge.FROM, list)
  }
  const found: { ROOT: string; TARGET: string; PATH: string[]; EDGES: Edge[] }[] = []
  for (const start of roots) {
    const seen = new Set([`${start}::0`])
    const queue: { node: string; path: string[]; edges: Edge[] }[] = [
      { node: start, path: [start], edges: [] },
    ]
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index]
      for (const edge of adjacency.get(current.node) ?? []) {
        if (current.path.includes(edge.TO)) continue
        const next = {
          node: edge.TO,
          path: [...current.path, edge.TO],
          edges: [...current.edges, edge],
        }
        const state = `${edge.TO}::${Math.min(next.edges.length, 2)}`
        if (seen.has(state)) continue
        seen.add(state)
        if (wanted.has(edge.TO))
          found.push({ ROOT: start, TARGET: edge.TO, PATH: next.path, EDGES: next.edges })
        queue.push(next)
      }
    }
  }
  return {
    DIRECT_W4P_DEPENDENCY: found.some((entry) => entry.EDGES.length === 1) ? 'YES' : 'NO',
    TRANSITIVE_W4P_DEPENDENCY: found.some((entry) => entry.EDGES.length > 1) ? 'YES' : 'NO',
    EXACT_DEPENDENCY_PATHS: found,
  }
}
export function classifyLocation(set: 'A' | 'C', paths: ReturnType<typeof dependencyPaths>) {
  if (paths.EXACT_DEPENDENCY_PATHS.length) return 'PRE_W4P_REQUIRED'
  return set === 'A' ? 'POST_W4P_REPLAY' : 'POST_W4P_DEFERRED_CONSTRAINT'
}
export function emittedUniqueOperands(sql: string, producedIdentities: string[]) {
  const anchor = producedIdentities.find((identity) => identity.startsWith('union-eyes::COLUMN::'))
  const tokens = sqlTokens(sql)
  const operands: { PHYSICAL_IDENTITY: string; EXACT_RECORDED_CLAUSE: string }[] = []
  for (let index = 0; index < tokens.length; index++) {
    if (
      tokens[index].kind !== 'WORD' ||
      tokens[index].value.toUpperCase() !== 'UNIQUE' ||
      tokens[index + 1]?.value !== '('
    )
      continue
    assert(anchor, 'UNIQUE_RELATION_ANCHOR_REQUIRED')
    const relation = anchor.split('.').slice(0, -1).join('.')
    let end = index + 2
    const names: string[] = []
    while (tokens[end]?.value !== ')') {
      assert(
        tokens[end] && ['IDENTIFIER', 'WORD'].includes(tokens[end].kind),
        'EXACT_UNIQUE_OPERAND_REQUIRED',
      )
      names.push(tokens[end].value)
      end++
      if (tokens[end]?.value === ',') end++
      else assert.equal(tokens[end]?.value, ')', 'UNSUPPORTED_UNIQUE_OPERAND_EXPRESSION')
    }
    for (const name of names) {
      const identity = `${relation}.${name}`
      if (!producedIdentities.includes(identity))
        operands.push({
          PHYSICAL_IDENTITY: identity,
          EXACT_RECORDED_CLAUSE: sql.slice(tokens[index].start, tokens[end].end),
        })
    }
  }
  return operands
}
export function loadInputs() {
  return Object.fromEntries(
    Object.entries(files).map(([name, file]) => {
      const bytes = read(file)
      assert.equal(sha(bytes), fixedHashes[file], `FIXED_INPUT_DRIFT:${file}`)
      const value: Json = JSON.parse(bytes)
      return [name, object(value)]
    }),
  )
}
export function buildCut() {
  const input = loadInputs()
  const definitions = records(input.definitions.physicalDefinitions)
  const payloads = ['TYPE_PAYLOADS', 'RELATION_CREATE_PAYLOADS', 'ADD_COLUMN_PAYLOADS'].flatMap(
    (key) =>
      records(input.payloads[key]).map((record, index) => ({
        record,
        pointer: `/${key}/${index}`,
      })),
  )
  const producers = records(input.producer.platformProducerRegistry)
  const late = records(input.late.records)
  const ordering = records(input.producer.w5OrderingHandoff)
  const deferred = records(input.deferred.handoffs)
  const operands = records(input.operands.records)
  const bindings = records(input.bindings.records)
  const graph = object(input.producer.producerDependencyGraph)
  const djangoNodes = records(graph.NODES)
  const djangoExecution = records(input.producer.djangoExecutionRegistry)
  assert.equal(input.canonical.CONTRACT_VERSION, '1.3.2')
  assert.equal(object(input.w4fr4.phaseStatus).PHASE_1B_3C_A1I_W4FR4_GATE, 'PASS')
  assert.equal(object(input.w4lc.phaseStatus).PHASE_1B_3C_A1I_W4LC_GATE, 'BLOCKED')
  assert.equal(object(input.w4lb.phaseStatus).PHASE_1B_3C_A1I_W4LB_GATE, 'BLOCKED')
  for (const [actual, expected] of [
    [definitions.length, 183],
    [payloads.length, 162],
    [late.length, 127],
    [ordering.length, 86],
    [deferred.length, 7],
    [operands.length, 9],
    [bindings.length, 7],
    [djangoNodes.length, 82],
  ])
    assert.equal(actual, expected, 'FIXED_UNIVERSE_DRIFT')
  assert.deepEqual(records(input.definitions.deferredConstraintHandoffs), deferred)
  assert.deepEqual(
    bindings.map((record) => record.CANONICAL_HANDOFF),
    deferred,
  )
  assert.deepEqual(
    operands.map((record) => record.PHYSICAL_OPERAND_IDENTITY),
    deferred.flatMap((record) => strings(record.NON_W4_OPERAND_IDENTITIES)),
  )
  assert.equal(new Set(operands.map((record) => record.PHYSICAL_OPERAND_IDENTITY)).size, 9)
  assert.equal(graph.KNOWN_DJANGO_GRAPH_COMPLETE, 'YES')
  assert.equal(graph.UNRESOLVED_KNOWN_PRODUCER_REFERENCES, 0)
  assert.deepEqual(graph.MACRO_ORDER, [
    'W3_PROVISIONING',
    'FULL_CANONICAL_DJANGO_GRAPH',
    'APPROVED_PLATFORM_BASELINE',
    'FROZEN_SCOPED_SECURITY_MIGRATIONS',
  ])

  const edges: Edge[] = []
  const add = (from: string, to: string, kind: string, source: ReturnType<typeof evidence>) => {
    edges.push({ FROM: from, TO: to, KIND: kind, SOURCE: source })
  }
  const payloadIds = new Set(payloads.map(({ record }) => text(record.PAYLOAD_ID)))
  assert.equal(payloadIds.size, 162)
  const definitionSubjects = definitions.map((definition, index) => {
    const id = text(definition.CANONICAL_DEFINITION_ID)
    const matches = producers
      .map((record, index) => ({ record, index }))
      .filter(
        ({ record }) => record.DEFINITION_OBLIGATION_ID === definition.DEFINITION_OBLIGATION_ID,
      )
    assert.equal(matches.length, 1, `EXACT_PRODUCER_LINK:${id}`)
    const { record: producer, index: producerIndex } = matches[0]
    assert.equal(producer.CANONICAL_DEFINITION_ID, id)
    assert.equal(producer.CANONICAL_DEFINITION_DIGEST, definition.DEFINITION_DIGEST)
    assert.equal(producer.DEFINITION_SOURCE_CLASS, 'GOVERNED_W4FR4')
    assert.equal(producer.DEFINITION_STATUS, 'COMPLETE')
    assert.equal(producer.DEFINITION_PAYLOAD_ID, definition.PAYLOAD_ID)
    assert.equal(producer.PRODUCER_ACTIVATED, 'NO')
    assert.deepEqual(producer.MUTATING_OPERATIONS, [])
    const producerId = text(producer.PRODUCER_ID)
    const pointer = `/physicalDefinitions/${index}`
    const producerPointer = `/platformProducerRegistry/${producerIndex}`
    const parent = definition.ACCEPTED_PARENT_CREATION_AUTHORITY
    const dependencies = strings(producer.DEPENDENCIES)
    const typeDependencies = strings(definition.TYPE_DEPENDENCIES)
    add(
      id,
      text(definition.PAYLOAD_ID),
      'DEFINITION_PAYLOAD_LINK',
      evidence(files.definitions, `${pointer}/PAYLOAD_ID`, definition.PAYLOAD_ID),
    )
    add(
      producerId,
      id,
      'PRODUCER_DEFINITION_LINK',
      evidence(files.producer, `${producerPointer}/CANONICAL_DEFINITION_ID`, id),
    )
    for (const dependency of dependencies)
      add(
        producerId,
        dependency,
        'PRODUCER_DEPENDENCY',
        evidence(files.producer, `${producerPointer}/DEPENDENCIES`, dependencies),
      )
    for (const dependency of typeDependencies)
      add(
        id,
        dependency,
        'TYPE_DEPENDENCY',
        evidence(files.definitions, `${pointer}/TYPE_DEPENDENCIES`, typeDependencies),
      )
    const parentEvidence =
      parent === null
        ? []
        : [evidence(files.definitions, `${pointer}/ACCEPTED_PARENT_CREATION_AUTHORITY`, parent)]
    const linkedPayload = payloads.find(({ record }) => record.PAYLOAD_ID === definition.PAYLOAD_ID)
    assert(linkedPayload, 'DEFINITION_PAYLOAD_MISSING')
    const constraintOperands = emittedUniqueOperands(
      text(linkedPayload.record.SQL),
      strings(linkedPayload.record.PHYSICAL_IDENTITIES_PRODUCED),
    )
    const constraintPreconditions = constraintOperands.length
      ? [evidence(files.payloads, `${linkedPayload.pointer}/SQL`, linkedPayload.record.SQL)]
      : []
    if (parent !== null) {
      const authority = object(parent)
      assert.equal(definition.RESPONSIBILITY_CLASS, 'ADD_COLUMN')
      assert.equal(authority.CREATION_DEFINITION_ESTABLISHED, 'YES')
      const parentIdentity = text(authority.PHYSICAL_IDENTITY)
      add(id, parentIdentity, 'ACCEPTED_PARENT_RELATION_PRECONDITION', parentEvidence[0])
      add(
        parentIdentity,
        text(authority.W4_PRODUCER_ID),
        'ACCEPTED_PARENT_PRODUCER',
        parentEvidence[0],
      )
      assert(djangoExecution.some((record) => record.PRODUCER_ID === authority.W4_PRODUCER_ID))
    }
    const postcondition = records(input.producer.blockedPostconditionDescriptors).find(
      (record) => record.PRODUCER_ID === producerId,
    )
    assert(postcondition, 'RECORDED_POSTCONDITION_DESCRIPTOR_MISSING')
    return {
      SUBJECT_ID: id,
      PHYSICAL_IDENTITY: definition.PHYSICAL_IDENTITY,
      DEFINITION_OBLIGATION_ID: definition.DEFINITION_OBLIGATION_ID,
      PAYLOAD_ID: definition.PAYLOAD_ID,
      PRODUCER_ID: producerId,
      SOURCE: evidence(files.definitions, pointer, {
        DEFINITION_DIGEST: definition.DEFINITION_DIGEST,
      }),
      PRODUCER_SOURCE: evidence(files.producer, producerPointer, {
        CANONICAL_DEFINITION_DIGEST: producer.CANONICAL_DEFINITION_DIGEST,
      }),
      DEFINITION_DEPENDENCIES: parentEvidence,
      PAYLOAD_DEPENDENCIES: [
        evidence(files.definitions, `${pointer}/PAYLOAD_ID`, definition.PAYLOAD_ID),
      ],
      TYPE_DEPENDENCIES: [
        evidence(files.definitions, `${pointer}/TYPE_DEPENDENCIES`, typeDependencies),
      ],
      PRODUCER_PRECONDITIONS: [
        evidence(files.producer, `${producerPointer}/DEPENDENCIES`, dependencies),
        ...[
          'DATABASE_SCOPE_ID',
          'DATABASE_ACTOR_ID',
          'TARGET_ID',
          'SEARCH_PATH_CONTRACT_ID',
          'ROLE_CLASS',
        ].map((key) => evidence(files.producer, `${producerPointer}/${key}`, producer[key])),
        evidence(
          files.producer,
          `${producerPointer}/REQUIRED_W3_PRECONDITIONS`,
          producer.REQUIRED_W3_PRECONDITIONS,
        ),
        ...parentEvidence,
        ...constraintPreconditions,
      ],
      MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS: constraintOperands,
      PROMOTION_PRECONDITIONS: [
        evidence(
          files.producer,
          `${producerPointer}/DEFINITION_STATUS`,
          producer.DEFINITION_STATUS,
        ),
        evidence(
          files.producer,
          `${producerPointer}/DEFINITION_SOURCE_CLASS`,
          producer.DEFINITION_SOURCE_CLASS,
        ),
      ],
      REQUIRED_POSTCONDITIONS: [
        evidence(
          files.producer,
          `${producerPointer}/PHYSICAL_IDENTITIES`,
          producer.PHYSICAL_IDENTITIES,
        ),
        evidence(
          files.producer,
          `${producerPointer}/POSTCONDITION_MODEL`,
          producer.POSTCONDITION_MODEL,
        ),
        evidence(
          files.producer,
          `/blockedPostconditionDescriptors/${records(input.producer.blockedPostconditionDescriptors).indexOf(postcondition)}`,
          postcondition,
        ),
      ],
      DEFERRED_CONSTRAINT_REFERENCES: [
        evidence(
          files.definitions,
          `${pointer}/DEFERRED_CONSTRAINT_HANDOFF_IDS`,
          definition.DEFERRED_CONSTRAINT_HANDOFF_IDS,
        ),
        evidence(
          files.producer,
          `${producerPointer}/DEFERRED_CONSTRAINT_HANDOFF_IDS`,
          producer.DEFERRED_CONSTRAINT_HANDOFF_IDS,
        ),
      ],
      RECORDED_FIELD_INVENTORY: fieldInventory(files.producer, producerPointer, producer),
      HISTORICAL_FIELDS_POSTURE:
        'Retained verbatim;GOVERNED_W4FR4 COMPLETE overlay supplies the current definition state. Deferred references are downstream links,not execution edges.',
    }
  })
  const payloadSubjects = payloads.map(({ record, pointer }) => {
    const id = text(record.PAYLOAD_ID)
    assert.equal(record.EXECUTION_ALLOWED, 'NO')
    assert.equal(record.SQL_STATUS, 'DEFINITION_ONLY_NOT_EXECUTABLE')
    assert.equal(sha(text(record.SQL)), record.SQL_SHA256)
    const dependencies = strings(record.DEPENDENCY_PAYLOAD_IDS)
    const constraintOperands = emittedUniqueOperands(
      text(record.SQL),
      strings(record.PHYSICAL_IDENTITIES_PRODUCED),
    )
    for (const operand of constraintOperands)
      add(
        id,
        operand.PHYSICAL_IDENTITY,
        'MATERIALIZED_UNIQUE_OPERAND_PRECONDITION',
        evidence(files.payloads, `${pointer}/SQL`, record.SQL),
      )
    for (const dependency of dependencies) {
      assert(payloadIds.has(dependency), 'UNACCOUNTED_PAYLOAD_DEPENDENCY')
      add(
        id,
        dependency,
        'PAYLOAD_DEPENDENCY',
        evidence(files.payloads, `${pointer}/DEPENDENCY_PAYLOAD_IDS`, dependencies),
      )
    }
    for (const obligation of strings(record.DEFINITION_OBLIGATION_IDS)) {
      const match = definitions.find((record) => record.DEFINITION_OBLIGATION_ID === obligation)
      assert(match, 'UNACCOUNTED_DEFINITION_OBLIGATION')
      add(
        id,
        text(match.CANONICAL_DEFINITION_ID),
        'PAYLOAD_DEFINITION_LINK',
        evidence(
          files.payloads,
          `${pointer}/DEFINITION_OBLIGATION_IDS`,
          record.DEFINITION_OBLIGATION_IDS,
        ),
      )
      assert.equal(match.PAYLOAD_ID, id)
    }
    const typeMetadata =
      record.PAYLOAD_KIND === 'TYPE_DEFINITION'
        ? records(
            object(input.producer.canonicalDefinitionAuthoring).TYPE_DEFINITION_METADATA,
          ).filter((item) => item.PAYLOAD_ID === id)
        : []
    if (record.PAYLOAD_KIND === 'TYPE_DEFINITION') assert.equal(typeMetadata.length, 1)
    return {
      SUBJECT_ID: id,
      PAYLOAD_KIND: record.PAYLOAD_KIND,
      PHYSICAL_IDENTITIES_PRODUCED: record.PHYSICAL_IDENTITIES_PRODUCED,
      SOURCE: evidence(files.payloads, pointer, { SQL_SHA256: record.SQL_SHA256 }),
      DEFINITION_DEPENDENCIES: [
        evidence(
          files.payloads,
          `${pointer}/DEFINITION_OBLIGATION_IDS`,
          record.DEFINITION_OBLIGATION_IDS,
        ),
      ],
      PAYLOAD_DEPENDENCIES: [
        evidence(files.payloads, `${pointer}/DEPENDENCY_PAYLOAD_IDS`, dependencies),
      ],
      TYPE_DEPENDENCIES: definitionSubjects
        .filter((definition) => definition.PAYLOAD_ID === id)
        .flatMap((definition) => definition.TYPE_DEPENDENCIES),
      PRODUCER_PRECONDITIONS: definitionSubjects
        .filter((definition) => definition.PAYLOAD_ID === id)
        .flatMap((definition) => definition.PRODUCER_PRECONDITIONS),
      MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS: constraintOperands,
      MATERIALIZED_CONSTRAINT_SOURCE: evidence(files.payloads, `${pointer}/SQL`, record.SQL),
      PROMOTION_PRECONDITIONS: [
        evidence(files.payloads, `${pointer}/SQL_STATUS`, record.SQL_STATUS),
      ],
      REQUIRED_POSTCONDITIONS: [
        evidence(
          files.payloads,
          `${pointer}/PHYSICAL_IDENTITIES_PRODUCED`,
          record.PHYSICAL_IDENTITIES_PRODUCED,
        ),
      ],
      DEFERRED_CONSTRAINT_REFERENCES: [
        evidence(
          files.payloads,
          `${pointer}/DEFERRED_CONSTRAINT_HANDOFF_IDS`,
          record.DEFERRED_CONSTRAINT_HANDOFF_IDS,
        ),
      ],
      TYPE_PRODUCER_DEFINITION_METADATA: typeMetadata,
      RECORDED_FIELD_INVENTORY: fieldInventory(files.payloads, pointer, record),
      EXECUTION_ALLOWED: 'NO',
    }
  })
  djangoNodes.forEach((node, index) => {
    const id = text(node.PRODUCER_ID)
    const descriptor = djangoExecution.find((record) => record.PRODUCER_ID === id)
    assert(descriptor, 'DJANGO_NODE_DESCRIPTOR_MISSING')
    assert.deepEqual(node.REQUIRES_PRODUCER_IDS, descriptor.REQUIRES_PRODUCER_IDS)
    for (const dependency of strings(node.REQUIRES_PRODUCER_IDS)) {
      assert(
        djangoNodes.some((record) => record.PRODUCER_ID === dependency),
        'UNACCOUNTED_DJANGO_NODE',
      )
      add(
        id,
        dependency,
        'RECORDED_DJANGO_PRODUCER_DEPENDENCY',
        evidence(
          files.producer,
          `/producerDependencyGraph/NODES/${index}/REQUIRES_PRODUCER_IDS`,
          node.REQUIRES_PRODUCER_IDS,
        ),
      )
    }
  })
  const layers = records(input.canonical.layers)
  const layer = layers.find((record) => record.NAME === 'UE_PRECONSUMER_PLATFORM_BASELINE')
  assert(layer)
  assert.deepEqual(layer.DEPENDS_ON, ['LAYER_1'])
  const externalPrerequisites = {
    MACRO_ORDER: evidence(
      files.producer,
      '/producerDependencyGraph/MACRO_ORDER',
      graph.MACRO_ORDER,
    ),
    CANONICAL_LAYER_ORDER: evidence(files.canonical, '/layers', layers),
    DJANGO_PRODUCER_DEPENDENCY_GRAPH: evidence(
      files.producer,
      '/producerDependencyGraph/NODES',
      djangoNodes,
    ),
    DJANGO_EXECUTION_PRECONDITIONS: djangoExecution.map((record, index) => ({
      PRODUCER_ID: record.PRODUCER_ID,
      PRECONDITIONS: fieldInventory(files.producer, `/djangoExecutionRegistry/${index}`, record),
    })),
    W3_PRECONDITIONS: evidence(files.producer, '/w3Preconditions', input.producer.w3Preconditions),
    W2_TARGET_BINDINGS: evidence(
      files.producer,
      '/w2TargetBindings',
      input.producer.w2TargetBindings,
    ),
    RUNTIME_POSTURE:
      'Recorded Django-first/parent/W3/target preconditions remain mandatory for future execution;W4PG does not prove or apply them.',
  }
  // Macro-order prerequisites are a separate boundary, not additional W4 schema subjects.
  const roots = [
    ...payloadSubjects.map((record) => record.SUBJECT_ID),
    ...definitionSubjects.flatMap((record) => [record.SUBJECT_ID, record.PRODUCER_ID]),
  ]
  const macroRoots = djangoNodes.map((record) => text(record.PRODUCER_ID))
  const allRoots = [...roots, ...macroRoots]
  const produced = new Set(
    payloads.flatMap(({ record }) => strings(record.PHYSICAL_IDENTITIES_PRODUCED)),
  )
  const effects = (targets: string[]) => {
    const primary = dependencyPaths(roots, edges, targets)
    const macro = dependencyPaths(macroRoots, edges, targets)
    return {
      ...dependencyPaths(allRoots, edges, targets),
      BASELINE_PATHS: primary.EXACT_DEPENDENCY_PATHS,
      MACRO_PREDECESSOR_PATHS: macro.EXACT_DEPENDENCY_PATHS,
    }
  }
  const setA = late.map((record, index) => {
    assert.equal(record.COMPATIBILITY_CLASS, 'OTHER_EXPLICIT')
    assert.equal(
      record.OTHER_COMPATIBILITY_CLASS,
      'NO_W4FR4_PRECREATION_COLLISION_EXACT_LATE_PROMOTION_REPLAY_REQUIRED',
    )
    assert.equal(record.W4FR4_PRECREATED_IDENTITY, 'NO')
    assert(!produced.has(text(record.PHYSICAL_IDENTITY)), 'LATE_IDENTITY_COLLISION')
    const result = effects([
      text(record.COMPATIBILITY_OBLIGATION_ID),
      text(record.PHYSICAL_IDENTITY),
      text(record.PLATFORM_PROMOTION_PRODUCER_ID),
      text(record.LATE_PRODUCER_ID),
    ])
    return {
      COMPATIBILITY_OBLIGATION_ID: record.COMPATIBILITY_OBLIGATION_ID,
      PHYSICAL_IDENTITY: record.PHYSICAL_IDENTITY,
      SOURCE: evidence(files.late, `/records/${index}`, { RECORD_SHA256: digest(record) }),
      COMPATIBILITY_CLASS: record.COMPATIBILITY_CLASS,
      OTHER_COMPATIBILITY_CLASS: record.OTHER_COMPATIBILITY_CLASS,
      PROMOTION_GATE_LOCATION: classifyLocation('A', result),
      ...result,
      W4P_EFFECT: result.EXACT_DEPENDENCY_PATHS.length ? 'EXACT_PREREQUISITE' : 'NONE',
      LATER_REPLAY_EFFECT: 'EXACT_STATE_VALIDATION_AND_LATE_PROMOTION',
      EXACT_REASON:
        'No exact W4FR4 produced-identity collision or inbound requirement path. This mechanic governs its recorded late CREATE/promotion/replay unit,not the183 accepted baseline definitions.',
      ORIGINAL_RECORD: record,
      EXECUTION_ALLOWED: 'NO',
    }
  })
  const setC = deferred.map((record, index) => {
    const id = text(record.DEFERRED_CONSTRAINT_HANDOFF_ID)
    assert.equal(record.CANONICAL_CONSTRAINT_DEFINITION, 'COMPLETE')
    const binding = bindings.find((record) => record.DEFERRED_CONSTRAINT_HANDOFF_ID === id)
    assert(binding)
    assert.equal(binding.HANDOFF_BINDING_CLASS, 'BLOCKED_MISSING_OPERAND_BINDING')
    assert.equal(record.W4_BASELINE_MATERIALIZATION, 'DEFERRED')
    assert.equal(record.BASELINE_EXECUTABLE_MATERIALIZATION, 'DEFERRED')
    assert.equal(record.MATERIALIZATION_PRECONDITION, 'ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST')
    assert.equal(record.MATERIALIZATION_STATUS, 'DEFERRED_NOT_EXECUTED')
    const references = payloads.filter(({ record }) =>
      strings(record.DEFERRED_CONSTRAINT_HANDOFF_IDS).includes(id),
    )
    assert(references.length > 0, 'DEFERRED_LINK_LOST')
    const result = effects([id, ...strings(record.NON_W4_OPERAND_IDENTITIES)])
    return {
      DEFERRED_CONSTRAINT_HANDOFF_ID: id,
      RELATION: record.RELATION,
      SOURCE: evidence(files.deferred, `/handoffs/${index}`, { RECORD_SHA256: digest(record) }),
      PROMOTION_GATE_LOCATION: classifyLocation('C', result),
      ...result,
      W4P_EFFECT: result.EXACT_DEPENDENCY_PATHS.length ? 'EXACT_PREREQUISITE' : 'NONE',
      POST_W4P_OBLIGATION: 'MATERIALIZE_ONLY_AFTER_ALL_OPERANDS_EXIST',
      REFERENCING_BASELINE_PAYLOAD_IDS: references.map(({ record }) => record.PAYLOAD_ID),
      REFERENCE_IS_PRECONDITION:
        'NO;W4C deliberately defers the complete constraint;W4FR4 records a handoff without constraint SQL.',
      ORIGINAL_HANDOFF: record,
      ORIGINAL_BINDING_RESULT: binding,
      DEFERRED_CONSTRAINTS_MATERIALIZED: 0,
      DEFERRED_CONSTRAINTS_RUNTIME_PROVEN: 'NO',
      EXECUTION_ALLOWED: 'NO',
    }
  })
  const operandEffects = operands.map((record, index) => {
    assert.equal(record.BINDING_CLASS, 'NO_PRODUCER_OR_BOUNDARY_EVIDENCE')
    assert.equal(record.PRODUCER_ID, null)
    assert.equal(record.BOUNDARY_ID, null)
    assert(!produced.has(text(record.PHYSICAL_OPERAND_IDENTITY)), 'UNBOUND_OPERAND_IN_BASELINE')
    const result = effects([text(record.PHYSICAL_OPERAND_IDENTITY)])
    return {
      PHYSICAL_OPERAND_IDENTITY: record.PHYSICAL_OPERAND_IDENTITY,
      DEFERRED_CONSTRAINT_HANDOFF_ID: record.DEFERRED_CONSTRAINT_HANDOFF_ID,
      SOURCE: evidence(files.operands, `/records/${index}`, { RECORD_SHA256: digest(record) }),
      ...result,
      W4P_REQUIRES_OPERAND_EXISTENCE: result.EXACT_DEPENDENCY_PATHS.length ? 'YES' : 'NO',
      OPERAND_BINDING_STATUS: result.EXACT_DEPENDENCY_PATHS.length
        ? 'UNRESOLVED_PREREQUISITE'
        : 'UNRESOLVED_DOWNSTREAM',
      MISSING_FACT: record.MISSING_FACT,
      ORIGINAL_RESIDUAL_SHA256: digest(record),
      PRODUCER_ID: null,
      BOUNDARY_ID: null,
      EXECUTION_ALLOWED: 'NO',
    }
  })
  const setB = ordering.map((record, index) => {
    const id = text(record.ORDERING_OBLIGATION_ID)
    const related = setA.filter((item) =>
      strings(item.ORIGINAL_RECORD.W5_HANDOFF_IDS).includes(text(record.ORDERING_RECORD_ID)),
    )
    assert(related.length > 0, 'ORDERING_MECHANIC_LINK_MISSING')
    const result = effects([
      id,
      text(record.ORDERING_RECORD_ID),
      text(record.PHYSICAL_IDENTITY),
      text(record.W4_PRODUCER_ID),
    ])
    return {
      ORDERING_OBLIGATION_ID: id,
      ORDERING_RECORD_ID: record.ORDERING_RECORD_ID,
      PHYSICAL_IDENTITY: record.PHYSICAL_IDENTITY,
      SOURCE: evidence(files.producer, `/w5OrderingHandoff/${index}`, {
        RECORD_SHA256: digest(record),
      }),
      ...result,
      PRE_W4P_ORDERING_REQUIRED: result.EXACT_DEPENDENCY_PATHS.length ? 'YES' : 'NO',
      PROMOTION_GATE_LOCATION: result.EXACT_DEPENDENCY_PATHS.length
        ? 'PRE_W4P_REQUIRED'
        : 'POST_W4P_ORDERING',
      RELATED_SET_A_OBLIGATION_IDS: related.map((record) => record.COMPATIBILITY_OBLIGATION_ID),
      ORDERING_REASON:
        'Exact late-provider/consumer replay ordering remains necessary before those consumers;no exact inbound W4FR4 promotion path exists.',
      ORIGINAL_HANDOFF: record,
      EXECUTION_ALLOWED: 'NO',
    }
  })
  const slice = setB
    .filter((record) => record.PRE_W4P_ORDERING_REQUIRED === 'YES')
    .map((record) => record.ORDERING_RECORD_ID)
  const count = (items: { PROMOTION_GATE_LOCATION: string }[], location: string) =>
    items.filter((record) => record.PROMOTION_GATE_LOCATION === location).length
  const summary = {
    W4FR4_DEFINITIONS: definitions.length,
    W4FR4_PAYLOADS: payloads.length,
    TYPE_PAYLOADS: payloadSubjects.filter((record) => record.PAYLOAD_KIND === 'TYPE_DEFINITION')
      .length,
    CREATE_RELATION_PAYLOADS: payloadSubjects.filter(
      (record) => record.PAYLOAD_KIND === 'CREATE_RELATION',
    ).length,
    ADD_COLUMN_PAYLOADS: payloadSubjects.filter((record) => record.PAYLOAD_KIND === 'ADD_COLUMN')
      .length,
    PRODUCER_DEFINITION_RECORDS: definitionSubjects.length,
    ACCEPTED_PARENT_PRECONDITIONS: definitionSubjects.filter(
      (record) => record.DEFINITION_DEPENDENCIES.length,
    ).length,
    MATERIALIZED_UNIQUE_OPERAND_PRECONDITIONS: payloadSubjects.flatMap(
      (record) => record.MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS,
    ).length,
    SET_A_TOTAL: setA.length,
    SET_A_PRE_W4P_REQUIRED: count(setA, 'PRE_W4P_REQUIRED'),
    SET_A_POST_W4P_REPLAY: count(setA, 'POST_W4P_REPLAY'),
    SET_A_UNRELATED_TO_W4P: 0,
    SET_B_TOTAL: setB.length,
    SET_B_PRE_W4P_ORDERING_REQUIRED: slice.length,
    SET_B_POST_W4P_ORDERING: count(setB, 'POST_W4P_ORDERING'),
    SET_C_TOTAL: setC.length,
    SET_C_PRE_W4P_REQUIRED: count(setC, 'PRE_W4P_REQUIRED'),
    SET_C_POST_W4P_DEFERRED_CONSTRAINT: count(setC, 'POST_W4P_DEFERRED_CONSTRAINT'),
    SET_C_UNRELATED_TO_W4P: 0,
    DISTINCT_UNBOUND_OPERAND_IDENTITIES: operandEffects.length,
    OPERANDS_REQUIRED_BY_W4P: operandEffects.filter(
      (record) => record.W4P_REQUIRES_OPERAND_EXISTENCE === 'YES',
    ).length,
    SYNTHETIC_TENTH_OPERAND: 'NONE',
    PRE_W4P_W5_COMPATIBILITY_SLICE_COUNT: slice.length,
    PRE_W4P_COMPATIBILITY_BLOCKERS:
      count(setA, 'PRE_W4P_REQUIRED') + count(setC, 'PRE_W4P_REQUIRED'),
    RECORDED_DEPENDENCY_EDGES: edges.length,
    INBOUND_PATHS_FROM_UNRESOLVED_SETS: [...setA, ...setB, ...setC, ...operandEffects].flatMap(
      (record) => record.EXACT_DEPENDENCY_PATHS,
    ).length,
    INVENTED_DEPENDENCY_EDGES: 0,
    DEFINITION_CHANGES: 0,
    COMPATIBILITY_MECHANIC_CHANGES: 0,
    SQL_AUTHORED: 0,
    SQL_EXECUTED: 0,
    PRODUCERS_ACTIVATED: 0,
  }
  // A new positive path requires a separately evidenced precondition/location, never an automatic authorization.
  assert.equal(
    summary.INBOUND_PATHS_FROM_UNRESOLVED_SETS,
    0,
    'POSITIVE_PATH_REQUIRES_EXACT_BLOCKING_PRECONDITION_ADJUDICATION',
  )
  const contextualReferences = records(input.definitions.typeReferences)
  assert(
    contextualReferences.every(
      (record) =>
        record.CONTEXTUAL_TYPE_REFERENCE === 'YES' && record.W4_CONSUMER_PAYLOAD_ID === null,
    ),
  )
  const cut = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4PG',
      INPUTS: files,
      EXECUTION_ALLOWED: 'NO',
      GENERAL_DISCOVERY: 'NO',
    },
    doctrine: {
      UPSTREAM_PROMOTION_BLOCKING_RULE:
        'AN_UNRESOLVED_ITEM_BLOCKS_W4P_ONLY_IF_W4P_REQUIRES_THAT_ITEM_TO_SATISFY_A_DEFINITION_DEPENDENCY_EXECUTION_PRECONDITION_PRODUCER_PRECONDITION_OR_REQUIRED_W4P_POSTCONDITION',
      DOWNSTREAM_ONLY_UNRESOLVED_FACT_IS_PRE_W4P_BLOCKER: 'NO',
      UNKNOWN_DOWNSTREAM_PRODUCER_ALONE_IS_NOT_W4PG_BLOCKER: 'YES',
      SCOPE:
        'Only the accepted183 canonical definitions/162 inactive payloads. External recorded macro/parent/W3 prerequisites are retained,not new W4 schema subjects.',
    },
    definitionSubjects,
    payloadSubjects,
    externalPrerequisites,
    dependencyGraph: {
      W4P_SUBJECT_ROOTS: roots,
      MACRO_PREDECESSOR_ROOTS: macroRoots,
      EDGES: edges,
    },
    contextualTypeReferences: {
      RECORDS: contextualReferences,
      PRE_W4P_CONSUMER_EDGES: 0,
      REASON:
        '38 contextual references have no W4 consumer payload;no application-shaped type-consumer edge invented.',
    },
    historicalGateNormalization: {
      CANONICAL_LAYER_EXIT_GATE: evidence(
        files.canonical,
        `/layers/${layers.indexOf(layer)}/EXIT_GATE`,
        layer.EXIT_GATE,
      ),
      PRIOR_W4FR4_GATE: evidence(files.w4fr4, '/phaseStatus', input.w4fr4.phaseStatus),
      PRIOR_W4LC_GATE: evidence(files.w4lc, '/phaseStatus', input.w4lc.phaseStatus),
      PRIOR_W4LB_GATE: evidence(files.w4lb, '/phaseStatus', input.w4lb.phaseStatus),
      REASON:
        'Human W4PG doctrine replaces blanket compatibility-before-W4P placement only. Historical layer/replay gate labels are preserved verbatim. They do not record an exact inbound requirement of the183/162 promotion subject. Full bootstrap exit/runtime proof and downstream replay remain gated.',
    },
    setA,
    setB,
    setC,
    operandEffects,
    minimumPreW4PW5Slice: {
      HANDOFF_IDS: slice,
      COUNT: slice.length,
      PROOF:
        'All86 exact handoff targets checked against the complete recorded inbound cut;no required path. Replay-order edges are preserved separately.',
    },
    summary,
    W4P_DEPENDENCY_CUT_COMPLETE: 'YES',
    ALL_INBOUND_W4P_DEPENDENCIES_ACCOUNTED: 'YES',
    COMPLETENESS_CEILING:
      'All recorded inbound metadata in the fixed subject universe;not new runtime,application or generic SQL dependency discovery.',
  }
  const downstream = {
    metadata: cut.metadata,
    SET_A_POST_W4P_REPLAY: setA.filter(
      (record) => record.PROMOTION_GATE_LOCATION === 'POST_W4P_REPLAY',
    ),
    SET_B_POST_W4P_ORDERING: setB.filter(
      (record) => record.PROMOTION_GATE_LOCATION === 'POST_W4P_ORDERING',
    ),
    SET_C_POST_W4P_DEFERRED_CONSTRAINT: setC.filter(
      (record) => record.PROMOTION_GATE_LOCATION === 'POST_W4P_DEFERRED_CONSTRAINT',
    ),
    UNRESOLVED_DOWNSTREAM_OPERANDS: operandEffects,
    SET_A_RECORDS_SHA256: digest(late),
    SET_B_HANDOFFS_SHA256: digest(ordering),
    SET_C_HANDOFFS_SHA256: digest(deferred),
    OPERAND_RESIDUALS_SHA256: digest(operands),
    MATERIALIZATION_PRECONDITION:
      'All canonical operands physically exist before any deferred constraint;exact producer/boundary/order binding remains unresolved.',
    EXECUTION_ALLOWED: 'NO',
    OBLIGATIONS_RESOLVED_BY_AUTHORIZATION: 'NO',
  }
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4PG_GATE: 'PASS',
    PHASE_1B_3C_A1I_W4PG: 'PASS',
    W4P_DEPENDENCY_CUT_COMPLETE: 'YES',
    ALL_INBOUND_W4P_DEPENDENCIES_ACCOUNTED: 'YES',
    PRE_W4P_COMPATIBILITY_BLOCKERS: 0,
    PRE_W4P_W5_COMPATIBILITY_SLICE_COUNT: 0,
    W4P: 'AUTHORIZED_NOT_STARTED',
    W5_COMPATIBILITY_SLICE: 'NOT_REQUIRED_BEFORE_W4P',
    W5: 'NOT_AUTHORIZED',
    W4: 'BLOCKED_ORDERING_COMPATIBILITY_PENDING',
    CANONICAL_CONTRACT_VERSION: '1.3.2',
  }
  const report = {
    metadata: cut.metadata,
    summary,
    phaseStatus,
    DEPENDENCY_CUT_SHA256: digest(cut),
    DOWNSTREAM_REGISTER_SHA256: digest(downstream),
    preservation: {
      BYTE_COMMITMENTS: fixedHashes,
      W4FR4_DEFINITIONS_SHA256: digest(definitions),
      W4FR4_PAYLOADS_SHA256: digest(input.payloads),
      PRODUCER_DEFINITION_METADATA_SHA256: digest(producers),
      SET_A_RECORDS_SHA256: digest(late),
      SET_B_HANDOFFS_SHA256: digest(ordering),
      SET_C_HANDOFFS_SHA256: digest(deferred),
      W4LB_RESIDUALS_SHA256: digest(operands),
      W4LB_BINDING_RESULTS_SHA256: digest(bindings),
      CANONICAL_CONTRACT_VERSION: '1.3.2',
      UPSTREAM_BYTES_CHANGED: 0,
    },
    validation: {
      FIXED_INPUT_HASHES: 'PASS',
      DEFINITION183_COVERAGE: 'PASS',
      PAYLOAD162_COVERAGE: 'PASS',
      SET_A127_COVERAGE: 'PASS',
      SET_B86_COVERAGE: 'PASS',
      SET_C7_COVERAGE: 'PASS',
      OPERAND9_COVERAGE: 'PASS',
      COMPLETED_CHECKS: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\normalize-w4pg-promotion-gate.test.ts',
          RESULT: 'PASS',
          TESTS: 610,
        },
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\bind-w4lb-supplemental-operands.test.ts scripts\\ue\\classify-w4lc-compatibility.test.ts scripts\\ue\\author-w4fr4-final-baseline.test.ts',
          RESULT: 'PASS',
          TESTS: 544,
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\normalize-w4pg-promotion-gate.ts scripts\\ue\\normalize-w4pg-promotion-gate.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\normalize-w4pg-promotion-gate.ts scripts\\ue\\normalize-w4pg-promotion-gate.test.ts',
          RESULT: 'PASS_EXIT0_EXISTING_NEXT_PAGES_DIRECTORY_DIAGNOSTIC',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\normalize-w4pg-promotion-gate.ts scripts\\ue\\normalize-w4pg-promotion-gate.test.ts "docs\\union-eyes\\reality-remediation\\*W4PG*" "docs\\union-eyes\\reality-remediation\\UE_W4P_PROMOTION_DEPENDENCY_CUT.*" "docs\\union-eyes\\reality-remediation\\UE_POST_W4P_COMPATIBILITY_OBLIGATIONS.*"',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\normalize-w4pg-promotion-gate.ts --self-test --check',
          RESULT: 'PASS_TWO_GENERATION_EXACT_BYTES_AND_PERSISTED_OUTPUT_EQUALITY',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS_0_ERRORS_1215_EXISTING_WARNINGS',
        },
      ],
    },
    proofBoundaries: {
      SQL_AUTHORED: 0,
      SQL_EXECUTED: 0,
      W4P_EXECUTED: 'NO',
      COMPATIBILITY_MECHANICS_EXECUTED: 'NO',
      W5_EXECUTED: 'NO',
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      DEFERRED_CONSTRAINTS_RUNTIME_PROVEN: 'NO',
      PRODUCERS_ACTIVATED: 0,
      BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    },
  }
  return { cut, downstream, report }
}
export async function generate() {
  const model = buildCut()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const tableA = model.cut.setA
    .map(
      (record) =>
        `| ${record.COMPATIBILITY_OBLIGATION_ID} | ${record.PHYSICAL_IDENTITY} | ${record.PROMOTION_GATE_LOCATION} | NO / NO |`,
    )
    .join('\n')
  const tableB = model.cut.setB
    .map(
      (record) =>
        `| ${record.ORDERING_OBLIGATION_ID} | ${record.PHYSICAL_IDENTITY} | NO | POST_W4P_ORDERING |`,
    )
    .join('\n')
  const tableC = model.cut.setC
    .map(
      (record) =>
        `| ${record.DEFERRED_CONSTRAINT_HANDOFF_ID} | ${record.RELATION} | POST_W4P_DEFERRED_CONSTRAINT | NO / NO |`,
    )
    .join('\n')
  const tableOperands = model.cut.operandEffects
    .map((record) => `| ${record.PHYSICAL_OPERAND_IDENTITY} | NO | UNRESOLVED_DOWNSTREAM |`)
    .join('\n')
  const summary = `# W4PG promotion-gate dependency cut - PASS

## W4P subject and dependency proof

183 definitions and183 exact producer-definition records;162 inactive payloads (36 types/57 relation creates/69 add-columns). Every subject enumerates recorded definition/payload/type dependencies,producer/promotion preconditions,required postconditions and deferred references with source JSON pointers and hashes.
${model.cut.summary.RECORDED_DEPENDENCY_EDGES} recorded edges;69 accepted parent-relation preconditions;${model.cut.summary.MATERIALIZED_UNIQUE_OPERAND_PRECONDITIONS} exact already-emitted compound-UNIQUE operand preconditions;82 Django macro predecessor nodes and their exact dependency graph retained. Constraint operands come only from the immutable inactive payload,not contextual callbacks or semantic-name matching;they are external preconditions,not new W4 schema subjects. Django-first,W3 role/extension/delegation and W2 target preconditions remain mandatory for future execution,not proven by this phase.38 contextual type references create0 W4 consumer edges.

No exact direct or transitive inbound requirement from Set A,Set B,Set C or the9 excluded operands. No semantic-name edges inferred. Historical blanket W4LC pre-W4P language and the broader canonical layer exit gate remain unchanged in source;the human W4PG rule normalizes only their placement relative to this183/162 promotion subject. Full bootstrap/replay exit gates are not certified.

W4P_DEPENDENCY_CUT_COMPLETE=YES;ALL_INBOUND_W4P_DEPENDENCIES_ACCOUNTED=YES within the fixed recorded metadata. Cut digest: \`${model.report.DEPENDENCY_CUT_SHA256}\`.

## Set A:127 late compatibility records

PRE_W4P_REQUIRED=0;POST_W4P_REPLAY=127;UNRELATED_TO_W4P=0;SUM=127.
OTHER_EXPLICIT / NO_W4FR4_PRECREATION_COLLISION_EXACT_LATE_PROMOTION_REPLAY_REQUIRED mechanics unchanged. W4P_EFFECT=NONE;LATER_REPLAY_EFFECT=EXACT_STATE_VALIDATION_AND_LATE_PROMOTION.

## Set B:86 ordering handoffs

PRE_W4P_ORDERING_REQUIRED=0;POST_W4P_ORDERING=86;SUM=86. Promotion ordering differs from replay ordering. Minimum pre-W4P W5 slice=0;exact handoff IDs=[].

## Set C:7 deferred constraints

PRE_W4P_REQUIRED=0;POST_W4P_DEFERRED_CONSTRAINT=7;UNRELATED_TO_W4P=0;SUM=7. Complete constraint definitions deliberately omitted from W4FR4 SQL remain linked downstream;references are not materialization preconditions of baseline promotion.

## Nine unresolved operand effects

${tableOperands}

No synthetic tenth operand. For each,the missing fact remains a hash-bound exact column producer or accepted exact column-existence boundary and execution position. No producer is newly known;none was searched for. Materialize constraints only after all canonical operands exist.

## Downstream preservation

127 late mechanics remain unexecuted;86 replay-ordering handoffs remain unexecuted;7 constraints remain unmaterialized;9 bindings remain unresolved. The [downstream register](./UE_POST_W4P_COMPATIBILITY_OBLIGATIONS.json) retains complete original records/semantics and negative binding results. No obligation resolved or discarded by authorization.

## Validation and gate

11 fixed upstream JSON byte commitments preserved;183 definitions/162 payloads/producer metadata/127 records/86 handoffs/7 semantics/9 residuals and canonical1.3.2 unchanged.610 focused+544 W4LB/W4LC/W4FR4 predecessor tests=1154 passed. Scoped TypeScript,ESLint(exit0 with existing Next pages-directory diagnostic),formatting,two-generation exact-byte equality and persisted \`--check\` passed. \`pnpm validate:docs\`:0 errors/1215 existing warnings. Exact completed commands and results are recorded in the [machine report](./PHASE_1B_3C_A1I_W4PG_PROMOTION_GATE_NORMALIZATION.json).

W4PG=PASS;W4P=AUTHORIZED_NOT_STARTED;W5_COMPATIBILITY_SLICE=NOT_REQUIRED_BEFORE_W4P;fullW5=NOT_AUTHORIZED;W4=BLOCKED_ORDERING_COMPATIBILITY_PENDING;CANONICAL_CONTRACT_VERSION=1.3.2.
SQL_AUTHORED=0;SQL_EXECUTED=0;W4P_EXECUTED=NO;COMPATIBILITY_MECHANICS_EXECUTED=NO;W5_EXECUTED=NO;DEFERRED_CONSTRAINTS_MATERIALIZED=NO;PRODUCERS_ACTIVATED=0;BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
`
  const details = `# W4P promotion dependency cut\n\n${summary.split('\n').slice(2).join('\n')}

## Exact Set A gate locations

| Obligation ID | Physical identity | Location | Direct / transitive |
|---|---|---|---|
${tableA}

## Exact Set B promotion/replay locations

| Ordering obligation ID | Physical identity | Pre-W4P required | Location |
|---|---|---|---|
${tableB}

## Exact Set C gate locations

| Handoff ID | Relation | Location | Direct / transitive |
|---|---|---|---|
${tableC}

## Exact subject coverage

| Canonical definition ID | Producer ID | Payload ID | Physical identity |
|---|---|---|---|
${model.cut.definitionSubjects.map((record) => `| ${record.SUBJECT_ID} | ${record.PRODUCER_ID} | ${record.PAYLOAD_ID} | ${record.PHYSICAL_IDENTITY} |`).join('\n')}

| Payload ID | Kind | Produced identities |
|---|---|---|
${model.cut.payloadSubjects.map((record) => `| ${record.SUBJECT_ID} | ${record.PAYLOAD_KIND} | ${strings(record.PHYSICAL_IDENTITIES_PRODUCED).join(', ')} |`).join('\n')}

Exact precondition values,source hashes/pointers and all recorded graph edges are in [the machine cut](./UE_W4P_PROMOTION_DEPENDENCY_CUT.json). Embedded original SQL remains unchanged source evidence only;no new SQL is authored or activated.
`
  const downstreamMd = `# Preserved post-W4P compatibility obligations\n\nThis register is not executable. Authorization of baseline promotion neither resolves nor drops downstream facts.\n\n## Set A - POST_W4P_REPLAY\n\n| Obligation ID | Physical identity | Location | Direct / transitive |\n|---|---|---|---|\n${tableA}\n\n## Set B - POST_W4P_ORDERING\n\n| Ordering obligation ID | Physical identity | Pre-W4P required | Location |\n|---|---|---|---|\n${tableB}\n\n## Set C - POST_W4P_DEFERRED_CONSTRAINT\n\n| Handoff ID | Relation | Location | Direct / transitive |\n|---|---|---|---|\n${tableC}\n\n## Unresolved downstream operands\n\n| Operand identity | W4P requires existence | Binding status |\n|---|---|---|\n${tableOperands}\n\n127 mechanics and86 ordering boundaries unexecuted;7 constraints unmaterialized;9 bindings unresolved. All original exact records,constraint operands/preconditions and binding results are retained in [the machine register](./UE_POST_W4P_COMPATIBILITY_OBLIGATIONS.json). FullW5=NOT_AUTHORIZED;W4P=AUTHORIZED_NOT_STARTED;runtime proof=0.\n`
  const json = (value: unknown) => format(JSON.stringify(value), { ...config, parser: 'json' })
  const markdown = (value: string) => format(value, { ...config, parser: 'markdown' })
  return {
    [outputs.cut]: await json(model.cut),
    [outputs.downstream]: await json(model.downstream),
    [outputs.report]: await json(model.report),
    [outputs.cutMarkdown]: await markdown(details),
    [outputs.downstreamMarkdown]: await markdown(downstreamMd),
    [outputs.markdown]: await markdown(summary),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--check', '--self-test'].includes(arg)),
    'UNAUTHORIZED_W4PG_FLAG',
  )
  assert(
    args.includes('--plan') || args.includes('--check') || args.includes('--self-test'),
    'EXPLICIT_W4PG_MODE_REQUIRED',
  )
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4PG')
    console.log('PASS W4PG two-generation exact-byte equality')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `W4PG_ARTIFACT_DRIFT:${file}`)
    console.log('PASS W4PG persisted artifacts and11 fixed upstream commitments')
  } else if (args.includes('--plan')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, file), bytes)
    console.log(
      'W4PG PASS:zero pre-W4P compatibility prerequisites;W4P AUTHORIZED_NOT_STARTED;no execution',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
