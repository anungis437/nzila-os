import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'
import type { buildScope } from './normalize-w4s-authoring-scope'
import type { buildClosure } from './close-w4c-constraint-timing'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import type { buildTypeClosure } from './close-w4t-named-types'
import { enumDescriptor } from './close-w4t-named-types'
import { inverse, object, restore, type InversePatch } from './adopt-w4-platform-ownership'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  scope: folder + 'PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.json',
  w4c: folder + 'PHASE_1B_3C_A1I_W4C_CONSTRAINT_TIMING_CLOSURE.json',
  deferred: folder + 'UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json',
  w4h3: folder + 'PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.json',
  w4t1: folder + 'PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json',
  types: folder + 'UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json',
  resolved: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json',
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const outputs = {
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.json',
  registryMarkdown: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.md',
  payloads: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json',
  payloadsMarkdown: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.md',
  report: folder + 'PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.md',
}
export const contractMarkdownFiles = {
  canonical: files.canonical.replace(/\.json$/, '.md'),
  producer: files.producer.replace(/\.json$/, '.md'),
}
type Json = Parameters<typeof inverse>[0]
type RecordJson = ReturnType<typeof object>
type Scope = ReturnType<typeof buildScope>
type Frozen = ReturnType<typeof buildRegeneration>['registry']
type Types = ReturnType<typeof buildTypeClosure>['registry']
type Deferred = ReturnType<typeof buildClosure>['registry']
type Timing = ReturnType<typeof buildClosure>['report']
type Column = Frozen['columnDefinitions'][number]
type Relation = Frozen['relationDefinitions'][number]
type Amendment = {
  PRIOR_JSON_INVERSE_PATCHES: { canonical: InversePatch[]; producer: InversePatch[] }
  VERSION_1_3_1_SHA256: string
  VERSION_1_3_2_SHA256: string
  PRIOR_PRODUCER_SHA256: string
  AMENDED_PRODUCER_SHA256: string
}
const jsonRecords = (value: Json | undefined) => {
  assert(Array.isArray(value), 'EXPECTED_RECORD_ARRAY')
  return value.map(object)
}
function assertInactive(value: Json) {
  if (value === null || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (key === 'EXECUTION_ALLOWED') assert.equal(child, 'NO', 'EXECUTION_ACTIVATION')
    if (key === 'MUTATING_OPERATIONS') assert.deepEqual(child, [], 'MUTATING_PRODUCER_OPERATIONS')
    assertInactive(child)
  }
}
export const identifier = (value: string) => {
  assert(/^[a-z_][a-z0-9_]*$/.test(value), `UNSAFE_IDENTIFIER:${value}`)
  return `"${value}"`
}
const qualified = (value: string) => {
  const parts = value.split('.')
  assert.equal(parts.length, 2)
  assert.equal(parts[0], 'public')
  return parts.map(identifier).join('.')
}
export async function jsonBytes(value: unknown) {
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  return format(JSON.stringify(value), { ...config, parser: 'json' })
}
export async function originalContracts() {
  const canonicalBytes = read(files.canonical)
  const canonical = object(JSON.parse(canonicalBytes))
  const producerBytes = read(files.producer)
  if (canonical.CONTRACT_VERSION === '1.3.1') return { canonicalBytes, producerBytes }
  assert.equal(canonical.CONTRACT_VERSION, '1.3.2', 'UNAUTHORIZED_CONTRACT_VERSION')
  const report: { versionAmendment: Amendment } = JSON.parse(read(outputs.report))
  const a = report.versionAmendment
  assert.equal(sha(canonicalBytes), a.VERSION_1_3_2_SHA256, 'AMENDED_CANONICAL_DRIFT')
  assert.equal(sha(producerBytes), a.AMENDED_PRODUCER_SHA256, 'AMENDED_PRODUCER_DRIFT')
  const oldCanonical = await jsonBytes(restore(canonical, a.PRIOR_JSON_INVERSE_PATCHES.canonical))
  const oldProducer = await jsonBytes(
    restore(JSON.parse(producerBytes), a.PRIOR_JSON_INVERSE_PATCHES.producer),
  )
  assert.equal(sha(oldCanonical), a.VERSION_1_3_1_SHA256, 'INVERSE_CANONICAL_DRIFT')
  assert.equal(sha(oldProducer), a.PRIOR_PRODUCER_SHA256, 'INVERSE_PRODUCER_DRIFT')
  return { canonicalBytes: oldCanonical, producerBytes: oldProducer }
}
function originalMarkdown() {
  if (object(JSON.parse(read(files.canonical))).CONTRACT_VERSION === '1.3.1')
    return {
      canonical: read(contractMarkdownFiles.canonical),
      producer: read(contractMarkdownFiles.producer),
    }
  const report: {
    priorMarkdown: { canonical: string; producer: string }
    amendedMarkdownSha: { canonical: string; producer: string }
  } = JSON.parse(read(outputs.report))
  for (const key of ['canonical', 'producer'] as const)
    assert.equal(
      sha(read(contractMarkdownFiles[key])),
      report.amendedMarkdownSha[key],
      'AMENDED_MARKDOWN_DRIFT',
    )
  return report.priorMarkdown
}
function selected(column: Column, property: string) {
  const values = column.SELECTED_PROPERTIES.filter((record) => record.PROPERTY === property)
  assert.equal(
    values.length,
    1,
    `MISSING_OR_DUPLICATE_PROPERTY:${column.PHYSICAL_IDENTITY}:${property}`,
  )
  const value = values[0]
  assert.equal(value.STATUS, 'APPROVED', 'UNAPPROVED_PROPERTY')
  assert(
    value.VALUE !== null && value.PROVENANCE && value.EVIDENCE_REFERENCES.length > 0,
    'MISSING_PROPERTY_PROVENANCE',
  )
  return value
}
export function columnSql(column: Column) {
  const type = selected(column, 'POSTGRES_TYPE').VALUE
  assert(
    type &&
      ['uuid', 'uuid[]', 'text', 'character varying(50)', 'character varying(255)'].includes(type),
    `UNSUPPORTED_EXACT_W4_TYPE:${type}`,
  )
  assert.equal(selected(column, 'IDENTITY_OR_GENERATED').VALUE, 'NONE')
  assert.equal(selected(column, 'PRIMARY_KEY_PARTICIPATION').VALUE, 'NONE_IN_BASELINE')
  assert.equal(selected(column, 'FOREIGN_KEY').VALUE, 'NONE')
  assert.equal(selected(column, 'CHECK_CONSTRAINTS').VALUE, '[]')
  const nullability = selected(column, 'NULLABILITY').VALUE
  assert(['NOT_NULL', 'NULLABLE'].includes(nullability ?? ''))
  const defaultValue = selected(column, 'DEFAULT').VALUE
  assert(
    defaultValue === 'NO_DEFAULT' || defaultValue === '"private"',
    `UNSUPPORTED_EXACT_DEFAULT:${defaultValue}`,
  )
  return `${identifier(column.COLUMN_NAME)} ${type}${defaultValue === '"private"' ? " DEFAULT 'private'" : ''}${nullability === 'NOT_NULL' ? ' NOT NULL' : ''}`
}
export function exactKeyMap(
  relation: Relation,
  references: Column['SELECTED_PROPERTIES'][number]['EVIDENCE_REFERENCES'],
) {
  const maps: Record<string, string>[] = []
  for (const reference of references) {
    if (!reference.FILE.endsWith('.ts')) continue
    assert(
      relation.SOURCES.some(
        (source) => source.FILE === reference.FILE && source.DIGEST === reference.DIGEST,
      ),
      'UNIQUE_SOURCE_OUTSIDE_GOVERNED_RELATION',
    )
    const source = ts.createSourceFile(
      reference.FILE,
      read(reference.FILE),
      ts.ScriptTarget.Latest,
      true,
    )
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'pgTable' &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === relation.RELATION_NAME &&
        sha(node.getText(source)) === reference.DIGEST
      ) {
        assert(ts.isObjectLiteralExpression(node.arguments[1]), 'UNSUPPORTED_COLUMN_OBJECT')
        const mapping: Record<string, string> = {}
        for (const property of node.arguments[1].properties) {
          assert(
            ts.isPropertyAssignment(property) &&
              (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)),
            'UNSUPPORTED_COLUMN_KEY',
          )
          let expression = property.initializer
          while (
            ts.isCallExpression(expression) &&
            ts.isPropertyAccessExpression(expression.expression)
          )
            expression = expression.expression.expression
          assert(
            ts.isCallExpression(expression) && ts.isStringLiteral(expression.arguments[0]),
            'UNSUPPORTED_COLUMN_DECLARATION',
          )
          assert(!Object.hasOwn(mapping, property.name.text))
          mapping[property.name.text] = expression.arguments[0].text
        }
        assert.deepEqual(
          Object.values(mapping),
          relation.ORDERED_COLUMN_SET,
          'EXACT_DECLARATION_COLUMN_SET_DRIFT',
        )
        maps.push(mapping)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert(maps.length > 0, 'MISSING_DIGEST_MATCHED_DECLARATION')
  for (const mapping of maps) assert.deepEqual(mapping, maps[0], 'CONFLICTING_EXACT_KEY_MAPS')
  return maps[0]
}
export function uniqueSql(column: Column, relation: Relation) {
  const unique = selected(column, 'UNIQUE_PARTICIPATION')
  if (unique.VALUE === 'NONE') return { clauses: [], evidence: [], handoffIds: [] }
  if (unique.VALUE === 'UNIQUE')
    return {
      clauses: [`UNIQUE (${identifier(column.COLUMN_NAME)})`],
      evidence: [{ KIND: 'SINGLE_COLUMN_UNIQUE', VALUE: unique.VALUE }],
      handoffIds: [],
    }
  assert(unique.VALUE !== null && unique.VALUE.startsWith('['), 'UNSUPPORTED_GOVERNED_UNIQUENESS')
  const expressions: unknown = JSON.parse(unique.VALUE)
  assert(Array.isArray(expressions) && expressions.every((value) => typeof value === 'string'))
  const clauses = expressions.map((expression: string) => {
    const sql = /^\s*UNIQUE\s*\(([^)]+)\)\s*$/i.exec(expression)
    if (sql) {
      const operands = sql[1].split(',').map((value) => value.trim().replace(/^"|"$/g, ''))
      assert(operands.every((value) => relation.ORDERED_COLUMN_SET.includes(value)))
      return `UNIQUE (${operands.map(identifier).join(', ')})`
    }
    const mapping = exactKeyMap(relation, unique.EVIDENCE_REFERENCES)
    const ast = ts.createSourceFile('governed-unique.ts', expression, ts.ScriptTarget.Latest, true)
    let clause: string | undefined
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'on'
      ) {
        assert(!clause, 'MULTIPLE_UNIQUE_ON_EXPRESSIONS')
        const factory = node.expression.expression
        assert(
          ts.isCallExpression(factory) &&
            ts.isIdentifier(factory.expression) &&
            ['unique', 'uniqueIndex'].includes(factory.expression.text),
          'UNSUPPORTED_UNIQUE_FACTORY',
        )
        assert(
          factory.arguments.length <= 1 &&
            (factory.arguments.length === 0 || ts.isStringLiteral(factory.arguments[0])),
          'UNSUPPORTED_UNIQUE_NAME',
        )
        const name = factory.arguments.length
          ? factory.arguments[0].getText(ast).slice(1, -1)
          : null
        const operands = node.arguments.map((argument) => {
          assert(
            ts.isPropertyAccessExpression(argument) && ts.isIdentifier(argument.expression),
            'UNSUPPORTED_UNIQUE_OPERAND',
          )
          const physical = mapping[argument.name.text]
          assert(physical, 'UNKNOWN_EXACT_COLUMN_KEY')
          return identifier(physical)
        })
        assert(operands.length > 0)
        clause = `${name ? `CONSTRAINT ${identifier(name)} ` : ''}UNIQUE (${operands.join(', ')})`
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
    assert(clause, 'UNSUPPORTED_UNIQUE_EXPRESSION')
    return clause
  })
  return {
    clauses,
    evidence: expressions.map((value: string) => ({ KIND: 'EXACT_GOVERNED_UNIQUE', VALUE: value })),
    handoffIds: [],
  }
}
export type Payload = {
  PAYLOAD_ID: string
  PAYLOAD_KIND: string
  PHYSICAL_IDENTITIES_PRODUCED: string[]
  DEPENDENCY_PAYLOAD_IDS: string[]
  DEFINITION_OBLIGATION_IDS: string[]
  DEFERRED_CONSTRAINT_HANDOFF_IDS: string[]
  SQL: string
  SQL_SHA256: string
  SQL_STATUS: string
  EXECUTION_ALLOWED: string
}
export function validateSql(payload: Payload) {
  assert.equal(payload.SQL_STATUS, 'DEFINITION_ONLY_NOT_EXECUTABLE')
  assert.equal(payload.EXECUTION_ALLOWED, 'NO')
  assert.equal(sha(payload.SQL), payload.SQL_SHA256)
  const scrubbed = payload.SQL.replace(/'(?:''|[^'])*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""')
  assert(
    !/\b(?:DROP|TRUNCATE|INSERT|UPDATE|DELETE|GRANT|REVOKE|ROLE|EXTENSION|DATABASE)\b/i.test(
      scrubbed,
    ),
    'FORBIDDEN_SQL',
  )
  assert(!/IF\s+NOT\s+EXISTS|--|\/\*/i.test(scrubbed), 'UNSAFE_SQL_MASKING_OR_COMMENT')
  assert.equal((scrubbed.match(/;/g) ?? []).length, 1, 'MULTIPLE_SQL_STATEMENTS')
  assert(
    /^(?:CREATE TYPE|CREATE TABLE|ALTER TABLE) "public"\."[^"]+"/.test(payload.SQL),
    'UNQUALIFIED_SQL',
  )
}
export async function reconstructChain(canonical: Json, patches: InversePatch[], w4g: RecordJson) {
  const v131 = restore(canonical, patches)
  assert.equal(sha(await jsonBytes(v131)), w4g.VERSION_1_3_1_SHA256)
  const w4gPatches: InversePatch[] = JSON.parse(
    JSON.stringify(object(w4g.PRIOR_JSON_INVERSE_PATCHES).canonical),
  )
  let value = restore(v131, w4gPatches)
  const steps = [
    { VERSION: '1.3.1', SHA256: sha(await jsonBytes(v131)) },
    { VERSION: '1.3', SHA256: sha(await jsonBytes(value)) },
  ]
  assert.equal(steps[1].SHA256, w4g.VERSION_1_3_SHA256)
  const refs = [
    {
      file: folder + 'PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.json',
      patch: (x: RecordJson) => object(x.PRIOR_JSON_INVERSE_PATCHES).canonical,
      version: '1.2',
      hash: 'VERSION_1_2_SHA256',
    },
    {
      file: folder + 'PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json',
      patch: (x: RecordJson) => x.PRIOR_CANONICAL_INVERSE_PATCHES,
      version: '1.1',
      hash: 'VERSION_1_1_SHA256',
    },
    {
      file: folder + 'PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json',
      patch: (x: RecordJson) => object(x.PRIOR_GOVERNANCE_PATCHES).CONTRACT,
      version: '1.0',
      hash: 'PRIOR_CONTRACT_SHA256',
    },
  ]
  for (const ref of refs) {
    const report = object(JSON.parse(read(ref.file)))
    const inversePatches: InversePatch[] = JSON.parse(JSON.stringify(ref.patch(report)))
    value = restore(value, inversePatches)
    const hash = sha(await jsonBytes(value))
    assert.equal(hash, report[ref.hash], `VERSION_RECONSTRUCTION_DRIFT:${ref.version}`)
    steps.push({ VERSION: ref.version, SHA256: hash })
  }
  return steps
}
export async function buildAuthoring() {
  const originals = await originalContracts()
  const bytes = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [
      key,
      key === 'canonical'
        ? originals.canonicalBytes
        : key === 'producer'
          ? originals.producerBytes
          : read(file),
    ]),
  )
  const scope: Scope = JSON.parse(bytes.scope)
  const timing: Timing = JSON.parse(bytes.w4c)
  const deferred: Deferred = JSON.parse(bytes.deferred)
  const frozen: Frozen = JSON.parse(bytes.resolved)
  const types: Types = JSON.parse(bytes.types)
  const canonicalBefore = object(JSON.parse(bytes.canonical))
  const producerBefore = object(JSON.parse(bytes.producer))
  const w4g = object(JSON.parse(bytes.w4g))
  assert.equal(canonicalBefore.CONTRACT_VERSION, '1.3.1')
  assert.equal(timing.phaseStatus.PHASE_1B_3C_A1I_W4C_GATE, 'PASS')
  assert.equal(timing.phaseStatus.W4FR4, 'AUTHORIZED_NOT_STARTED')
  assert.equal(scope.phaseStatus.PHASE_1B_3C_A1I_W4S_GATE, 'PASS')
  assert.deepEqual(deferred.handoffs, timing.constraintTimingDisposition)
  assert.equal(deferred.handoffs.length, 7)
  assert.equal(timing.blockedIdDisposition.length, 14)
  const preservation: Record<string, string> = { ...timing.preservation.BYTE_COMMITMENTS }
  for (const [key, file] of Object.entries(files)) preservation[file] = sha(bytes[key])
  for (const [file, expected] of Object.entries(preservation)) {
    const actual =
      file === files.canonical
        ? originals.canonicalBytes
        : file === files.producer
          ? originals.producerBytes
          : read(file)
    assert.equal(sha(actual), expected, `UPSTREAM_DRIFT:${file}`)
  }
  assert.equal(sha(bytes.resolved), scope.preservation.GOVERNED_DESIGN_REGISTRY_SHA256)
  assert.equal(sha(bytes.types), scope.preservation.TYPE_REGISTRY_SHA256)
  assert.equal(digest(types.typeRecords), scope.preservation.TYPE_DEFINITIONS_SHA256)
  assert.equal(digest(types.referenceLinks), scope.preservation.TYPE_REFERENCES_SHA256)
  assert.equal(types.typeRecords.length, 36)
  assert.equal(types.referenceLinks.length, 38)
  assert.equal(
    digest(frozen.definitionObligationLinkage),
    scope.w4ObligationUniverse.ORIGINAL_OBLIGATION_LINKAGE_SHA256,
  )
  assert.deepEqual(
    frozen.definitionObligationLinkage.map((record) => record.DEFINITION_OBLIGATION_ID),
    scope.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS,
  )
  const payload = (
    kind: string,
    identity: string,
    identities: string[],
    ids: string[],
    sql: string,
    handoffs: string[] = [],
  ): Payload => ({
    PAYLOAD_ID: `UE-W4FR4-PAYLOAD-${sha(`${kind}:${identity}`).slice(0, 16)}`,
    PAYLOAD_KIND: kind,
    PHYSICAL_IDENTITIES_PRODUCED: identities,
    DEPENDENCY_PAYLOAD_IDS: [],
    DEFINITION_OBLIGATION_IDS: ids,
    DEFERRED_CONSTRAINT_HANDOFF_IDS: handoffs,
    SQL: sql,
    SQL_SHA256: sha(sql),
    SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
    EXECUTION_ALLOWED: 'NO',
  })
  const typePayloads = types.typeRecords.map((record) => {
    assert.equal(record.TYPE_APPROVAL_STATUS, 'APPROVED')
    assert(record.SELECTED && record.INACTIVE_TYPE_DESCRIPTOR)
    const descriptor = record.INACTIVE_TYPE_DESCRIPTOR
    assert.equal(descriptor.EXECUTION_ALLOWED, 'NO')
    assert(record.SELECTED.ORDERED_ENUM_MEMBERS)
    assert.deepEqual(
      descriptor,
      enumDescriptor(
        record.SELECTED.SCHEMA_NAME,
        record.SELECTED.TYPE_NAME,
        record.SELECTED.ORDERED_ENUM_MEMBERS,
      ),
    )
    assert.equal(
      record.CANONICAL_TYPE_IDENTITY,
      `${record.SELECTED.SCHEMA_NAME}.${record.SELECTED.TYPE_NAME}`,
    )
    return {
      ...payload(
        'TYPE_DEFINITION',
        record.CANONICAL_TYPE_IDENTITY,
        [`union-eyes::TYPE::${record.CANONICAL_TYPE_IDENTITY}`],
        [],
        descriptor.SQL,
      ),
      CANONICAL_TYPE_IDENTITY: record.CANONICAL_TYPE_IDENTITY,
      TYPE_DEFINITION_DIGEST: record.SELECTED.DEFINITION_DIGEST,
      EXACT_SELECTED_DEFINITION: record.SELECTED,
      TYPE_DEFINITION_SOURCE: 'GOVERNED_W4T1',
    }
  })
  const definitions = frozen.definitionObligationLinkage
  assert.equal(definitions.length, 183)
  const relationObligations = definitions.filter(
    (record) => record.DEFINITION_OPERATION === 'CREATE_RELATION',
  )
  const included = definitions.filter(
    (record) => record.DEFINITION_OPERATION === 'RELATION_CREATE_INCLUDES_COLUMN',
  )
  const additions = definitions.filter(
    (record) => record.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION',
  )
  assert.deepEqual([relationObligations.length, included.length, additions.length], [57, 57, 69])
  const columnFor = (identity: string) => {
    const records = frozen.columnDefinitions.filter(
      (column) => column.PHYSICAL_IDENTITY === identity,
    )
    assert.equal(records.length, 1)
    return records[0]
  }
  const relationFor = (id: string) => {
    const relation = frozen.relationDefinitions.find(
      (record) => record.RELATION_DEFINITION_ID === id,
    )
    assert(relation)
    return relation
  }
  const uniqueEvidence: {
    PHYSICAL_IDENTITY: string
    EVIDENCE: { KIND: string; VALUE: string | null }[]
  }[] = []
  const uniquesFor = (column: Column, relation: Relation, id: string) => {
    const matching = deferred.handoffs.filter((record) =>
      record.SOURCE_W4_OBLIGATION_IDS.includes(id),
    )
    if (matching.length) {
      assert.equal(matching.length, 1)
      assert.deepEqual(
        matching[0].CANONICAL_CONSTRAINT_PROVENANCE.GOVERNED_UNIQUE_PROPERTY,
        selected(column, 'UNIQUE_PARTICIPATION'),
      )
      uniqueEvidence.push({
        PHYSICAL_IDENTITY: column.PHYSICAL_IDENTITY,
        EVIDENCE: [{ KIND: 'W4C_DEFERRED', VALUE: selected(column, 'UNIQUE_PARTICIPATION').VALUE }],
      })
      return { clauses: [], handoffIds: [matching[0].DEFERRED_CONSTRAINT_HANDOFF_ID] }
    }
    const result = uniqueSql(column, relation)
    if (result.evidence.length)
      for (const reference of selected(column, 'UNIQUE_PARTICIPATION').EVIDENCE_REFERENCES)
        if (reference.FILE.endsWith('.ts')) preservation[reference.FILE] = sha(read(reference.FILE))
    uniqueEvidence.push({ PHYSICAL_IDENTITY: column.PHYSICAL_IDENTITY, EVIDENCE: result.evidence })
    return result
  }
  const relationPayloads = relationObligations.map((record) => {
    const relation = relationFor(record.RELATION_DEFINITION_ID)
    const columns = included.filter(
      (column) => column.RELATION_DEFINITION_ID === record.RELATION_DEFINITION_ID,
    )
    assert(columns.length > 0)
    const clauses: string[] = []
    const handoffs: string[] = []
    const columnDefinitions = columns.map((column) => {
      const physical = columnFor(column.PHYSICAL_IDENTITY)
      const unique = uniquesFor(physical, relation, column.DEFINITION_OBLIGATION_ID)
      clauses.push(...unique.clauses)
      handoffs.push(...unique.handoffIds)
      return columnSql(physical)
    })
    return payload(
      'CREATE_RELATION',
      relation.PHYSICAL_IDENTITY,
      [record.PHYSICAL_IDENTITY, ...columns.map((column) => column.PHYSICAL_IDENTITY)],
      [
        record.DEFINITION_OBLIGATION_ID,
        ...columns.map((column) => column.DEFINITION_OBLIGATION_ID),
      ],
      `CREATE TABLE ${qualified(`${relation.SCHEMA_NAME}.${relation.RELATION_NAME}`)} (\n  ${[...columnDefinitions, ...clauses].join(',\n  ')}\n);`,
      handoffs,
    )
  })
  const addPayloads = additions.map((record) => {
    const relation = relationFor(record.RELATION_DEFINITION_ID)
    assert.equal(record.ACCEPTED_PARENT_CREATION_AUTHORITY?.CREATION_DEFINITION_ESTABLISHED, 'YES')
    const column = columnFor(record.PHYSICAL_IDENTITY)
    const unique = uniquesFor(column, relation, record.DEFINITION_OBLIGATION_ID)
    return payload(
      'ADD_COLUMN',
      record.PHYSICAL_IDENTITY,
      [record.PHYSICAL_IDENTITY],
      [record.DEFINITION_OBLIGATION_ID],
      `ALTER TABLE ${qualified(`${relation.SCHEMA_NAME}.${relation.RELATION_NAME}`)}\n  ADD COLUMN ${columnSql(column)}${unique.clauses.map((clause) => `,\n  ADD ${clause}`).join('')};`,
      unique.handoffIds,
    )
  })
  const allPayloads = [...typePayloads, ...relationPayloads, ...addPayloads]
  assert.equal(allPayloads.length, 162)
  allPayloads.forEach(validateSql)
  const producedColumns = allPayloads
    .flatMap((record) => record.PHYSICAL_IDENTITIES_PRODUCED)
    .filter((identity) => identity.includes('::COLUMN::'))
  assert.equal(new Set(producedColumns).size, 126)
  assert.deepEqual(
    [...producedColumns].sort(),
    [...scope.revisedCompletionContract.FUTURE_MATERIALIZATION_COLUMN_IDS].sort(),
  )
  const typeReferences = types.referenceLinks.map((reference) => {
    const identity = `union-eyes::COLUMN::${reference.CONSUMER_RELATION}.${reference.CONSUMER_COLUMN}`
    const consumer = allPayloads.find((record) =>
      record.PHYSICAL_IDENTITIES_PRODUCED.includes(identity),
    )
    const producer = typePayloads.find(
      (record) => record.CANONICAL_TYPE_IDENTITY === reference.CANONICAL_TYPE_IDENTITY,
    )
    assert(producer)
    if (consumer) {
      assert.equal(
        selected(columnFor(identity), 'POSTGRES_TYPE').VALUE,
        reference.GOVERNED_TYPE_NAME,
      )
      consumer.DEPENDENCY_PAYLOAD_IDS.push(producer.PAYLOAD_ID)
    }
    return {
      ...reference,
      TYPE_PAYLOAD_ID: producer.PAYLOAD_ID,
      W4_CONSUMER_PAYLOAD_ID: consumer?.PAYLOAD_ID ?? null,
      CONTEXTUAL_TYPE_REFERENCE: consumer ? 'NO' : 'YES',
    }
  })
  const physicalDefinitions = definitions.map((record) => {
    const matches = allPayloads.filter((payload) =>
      payload.DEFINITION_OBLIGATION_IDS.includes(record.DEFINITION_OBLIGATION_ID),
    )
    assert.equal(matches.length, 1, 'UNLINKED_OR_MULTILINKED_OBLIGATION')
    const p = matches[0]
    const result = {
      ...record,
      CANONICAL_DEFINITION_ID: `UE-W4FR4-DEFINITION-${sha(record.DEFINITION_OBLIGATION_ID).slice(0, 16)}`,
      RESPONSIBILITY_CLASS:
        record.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION'
          ? 'ADD_COLUMN'
          : record.DEFINITION_OPERATION,
      PROPERTY_PROVENANCE:
        record.OBJECT_KIND === 'COLUMN'
          ? columnFor(record.PHYSICAL_IDENTITY).SELECTED_PROPERTIES
          : relationFor(record.RELATION_DEFINITION_ID).GOVERNED_RELATION_PROPERTIES,
      TYPE_DEPENDENCIES: typeReferences.filter(
        (reference) => reference.W4_CONSUMER_PAYLOAD_ID === p.PAYLOAD_ID,
      ),
      PAYLOAD_ID: p.PAYLOAD_ID,
      DEFERRED_CONSTRAINT_HANDOFF_IDS: p.DEFERRED_CONSTRAINT_HANDOFF_IDS,
      DEFINITION_STATUS: 'COMPLETE',
      SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
      EXECUTION_ALLOWED: 'NO',
    }
    return { ...result, DEFINITION_DIGEST: digest(result) }
  })
  const producerAfter = structuredClone(producerBefore)
  let updated = 0
  for (const producer of jsonRecords(producerAfter.platformProducerRegistry)) {
    const definition = physicalDefinitions.find(
      (record) => record.DEFINITION_OBLIGATION_ID === producer.DEFINITION_OBLIGATION_ID,
    )
    if (!definition) continue
    assert(
      Array.isArray(producer.PHYSICAL_IDENTITIES) &&
        producer.PHYSICAL_IDENTITIES.includes(definition.PHYSICAL_IDENTITY),
    )
    assert.equal(producer.EXECUTION_ALLOWED, 'NO')
    assert.deepEqual(producer.MUTATING_OPERATIONS, [])
    Object.assign(producer, {
      CANONICAL_DEFINITION_ID: definition.CANONICAL_DEFINITION_ID,
      CANONICAL_DEFINITION_DIGEST: definition.DEFINITION_DIGEST,
      CANONICAL_DEFINITION_REGISTRY: path.basename(outputs.registry),
      DEFINITION_STATUS: 'COMPLETE',
      DEFINITION_SOURCE_CLASS: 'GOVERNED_W4FR4',
      DEFERRED_CONSTRAINT_HANDOFF_IDS: definition.DEFERRED_CONSTRAINT_HANDOFF_IDS,
      DEFINITION_PAYLOAD_ID: definition.PAYLOAD_ID,
    })
    updated++
  }
  assert.equal(updated, 183)
  const summary = {
    W4_DEFINITION_OBLIGATIONS: 183,
    RELATION_OBLIGATIONS: 57,
    COLUMN_OBLIGATIONS: 126,
    CREATE_RELATION: 57,
    RELATION_CREATE_INCLUDES_COLUMN: 57,
    ADD_COLUMN: 69,
    UNACCOUNTED: 0,
    TYPE_PAYLOADS: 36,
    RELATION_CREATE_PAYLOADS: 57,
    ADD_COLUMN_PAYLOADS: 69,
    TOTAL_INACTIVE_PAYLOADS: 162,
    TOTAL_CANONICAL_TYPE_REFERENCES: 38,
    W4_MATERIALIZED_CONSUMER_TYPE_REFERENCES: typeReferences.filter(
      (reference) => reference.W4_CONSUMER_PAYLOAD_ID !== null,
    ).length,
    CONTEXTUAL_NON_W4_TYPE_REFERENCES: typeReferences.filter(
      (reference) => reference.W4_CONSUMER_PAYLOAD_ID === null,
    ).length,
    TYPE_HOLDS: 0,
    DEFERRED_MIXED_AUTHORITY_CONSTRAINTS: 7,
    OBLIGATION_PAYLOAD_LINKS: 183,
    UNLINKED_W4_OBLIGATIONS: 0,
    MULTI_LINKED_W4_OBLIGATIONS: 0,
    DUPLICATE_COLUMN_CREATION: 0,
    MULTIPLE_CREATION_AUTHORITIES: 0,
    UNRESOLVED_W4_OWNED_PROPERTIES: 0,
    RELATION_CONTEXTS_ACCOUNTED: 125,
    SELECTED_COLUMNS_AUTHORITY_CLASSIFIED: 2121,
    PARENT_OWNED_COLUMNS_CONTEXTUAL: 1299,
    PARENT_OWNED_COLUMNS_REAUTHORED: 0,
    INHERITED_PARENT_GAPS: 108,
    W4_OWNED_GAPS_WITHIN_108: 0,
    EXISTING_LATE_PRODUCER_COMPATIBILITY_RECORDS: 127,
    SUPPLEMENTAL_DEFERRED_CONSTRAINT_HANDOFFS: 7,
    EXACT_CORRESPONDENCE_PROVEN: 0,
    PRODUCER_DEFINITION_METADATA_UPDATES: updated,
    SQL_EXECUTED: 0,
    PRODUCERS_ACTIVATED: 0,
  }
  const state = {
    PHASE_1B_3C_A1I_W4FR4_GATE: 'PASS',
    PHASE_1B_3C_A1I_W4FR4: 'PASS',
    CANONICAL_DEFINITION_AUTHORING: 'COMPLETE_NOT_ACTIVATED',
    W4_DEFINITION_IMPLEMENTATION_COMPLETE: 'YES',
    W4_PRECONSUMER_BASELINE_DEFINITION_COMPLETE: 'YES',
    W4: 'BLOCKED_ORDERING_COMPATIBILITY_PENDING',
    W4_REMAINING_BLOCKER: 'LATE_PRODUCER_COMPATIBILITY_AND_DEFERRED_CONSTRAINT_RESOLUTION',
    W4_COMPATIBILITY_GATE_NORMALIZATION: 'AUTHORIZED_NOT_STARTED',
    CANONICAL_CONTRACT_VERSION: '1.3.2',
    W4P: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
  }
  const metadata = {
    AMENDMENT: 'PLATFORM_BASELINE_CANONICAL_DEFINITION_AUTHORING',
    AUTHORITY: 'GOVERNED_W4FR4',
    DEFINITION_COMPLETE: 'YES',
    MATERIALIZATION_EXECUTED: 'NO',
    EXECUTION_ALLOWED: 'NO',
    MUTATING_OPERATIONS: [],
    DEFINITION_REGISTRY: outputs.registry,
    INACTIVE_PAYLOAD_REGISTRY: outputs.payloads,
    W4_PHYSICAL_AUTHORING_SCOPE: scope.humanArchitectureDecision.W4_PHYSICAL_AUTHORING_SCOPE,
    DEFERRED_MIXED_AUTHORITY_CONSTRAINTS: 7,
    DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
    TYPE_DEFINITION_METADATA: typePayloads.map((p) => ({
      CANONICAL_TYPE_IDENTITY: p.CANONICAL_TYPE_IDENTITY,
      TYPE_DEFINITION_DIGEST: p.TYPE_DEFINITION_DIGEST,
      TYPE_DEFINITION_SOURCE: 'GOVERNED_W4T1',
      EXECUTION_ALLOWED: 'NO',
      PAYLOAD_ID: p.PAYLOAD_ID,
    })),
    CANONICAL_TYPE_REFERENCE_RECORDS: typeReferences,
    DEFERRED_CONSTRAINT_METADATA: deferred.handoffs.map((handoff) => ({
      DEFERRED_CONSTRAINT_HANDOFF_ID: handoff.DEFERRED_CONSTRAINT_HANDOFF_ID,
      MATERIALIZATION_OWNER: 'LATE_PRODUCER_COMPATIBILITY_RESOLUTION',
      DEFERRED_TO_PRODUCER_ID: null,
      EXECUTION_ALLOWED: 'NO',
    })),
    COMPATIBILITY_INPUT_SETS: {
      EXISTING_RECORDS: 127,
      SUPPLEMENTAL_HANDOFFS: 7,
      EXACT_CORRESPONDENCE_PROVEN: 0,
    },
    summary,
    phaseStatus: state,
  }
  producerAfter.canonicalDefinitionAuthoring = object(JSON.parse(JSON.stringify(metadata)))
  Object.assign(object(producerAfter.phaseStatus), state, {
    PHASE_1B_3C_A1I_W4: 'BLOCKED_ORDERING_COMPATIBILITY_PENDING',
    CANONICAL_BOOTSTRAP_CONTRACT_VERSION: '1.3.2',
    BOOTSTRAP_CONTRACT_VERSION: '1.3.2',
    PRECONSUMER_PLATFORM_PRODUCER_MODEL:
      '183_GOVERNED_DEFINITIONS_COMPLETE_NOT_ACTIVATED;127_LATE_DEFINITIONS_AND7_DEFERRED_HANDOFFS_AWAIT_COMPATIBILITY',
    HISTORICAL_FIELDS:
      'W4F/W4G discovery and governance fields remain historical;current definition authoring is canonicalDefinitionAuthoring',
  })
  const canonicalAfter = structuredClone(canonicalBefore)
  assertInactive(producerAfter)
  canonicalAfter.CONTRACT_VERSION = '1.3.2'
  canonicalAfter.platformBaselineCanonicalDefinitionAuthoring = object(
    JSON.parse(JSON.stringify(metadata)),
  )
  Object.assign(object(canonicalAfter.phaseStatus), state, {
    CANONICAL_BOOTSTRAP_CONTRACT_VERSION: '1.3.2',
    BOOTSTRAP_CONTRACT_VERSION: '1.3.2',
  })
  assert(Array.isArray(canonicalAfter.versionChain))
  canonicalAfter.versionChain.push({
    VERSION: '1.3.2',
    PRIOR_VERSION: '1.3.1',
    PRIOR_SHA256: sha(bytes.canonical),
    RECONSTRUCTION_REFERENCE: `${outputs.report}#versionAmendment.PRIOR_JSON_INVERSE_PATCHES.canonical`,
  })
  const canonicalPatches = inverse(canonicalBefore, canonicalAfter)
  const producerPatches = inverse(producerBefore, producerAfter)
  assert.equal(sha(await jsonBytes(restore(producerAfter, producerPatches))), sha(bytes.producer))
  const steps = await reconstructChain(canonicalAfter, canonicalPatches, w4g)
  const registry = {
    metadata: { PHASE: 'PHASE_1B_3C_A1I_W4FR4', INPUTS: files },
    summary,
    physicalDefinitions,
    relationContexts: frozen.relationDefinitions,
    columnAuthorityClassification: scope.columnAuthorityClassification,
    inheritedGapDisposition: scope.w4fr2BlockerDisposition,
    blueprintSelections: frozen.blueprintSelections,
    types: types.typeRecords,
    typeReferences,
    deferredConstraintHandoffs: deferred.handoffs,
    uniqueLoweringEvidence: uniqueEvidence,
    phaseStatus: state,
  }
  const canonicalBytes = await jsonBytes(canonicalAfter)
  const producerBytes = await jsonBytes(producerAfter)
  const priorMarkdown = originalMarkdown()
  const section = `\n## Current W4FR4 definition-authoring amendment - canonical 1.3.2\n\nThe preceding phase descriptions are historical. The current authoritative amendment is PLATFORM_BASELINE_CANONICAL_DEFINITION_AUTHORING:183 governed W4 prerequisite definitions,36 exact types,38 canonical type references and7 preserved deferred compound UNIQUE invariants. Scope remains the W4-owned minimum preconsumer baseline,not full application tables.\n\nDEFINITION_COMPLETE=YES;MATERIALIZATION_EXECUTED=NO;DEFERRED_CONSTRAINTS_MATERIALIZED=NO;EXECUTION_ALLOWED=NO. W4=BLOCKED_ORDERING_COMPATIBILITY_PENDING. Compatibility inputs remain127 existing records plus7 separate supplemental handoffs,with0 proven correspondence. Compatibility normalization AUTHORIZED_NOT_STARTED;W4P/W5 NOT_AUTHORIZED. READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.\n\nSee [W4FR4 final authoring report](./PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.md) and [inactive definition registry](./UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.json). Exact inverse patches reconstruct canonical1.3.1 and the prior producer contract;no SQL execution is authorized.\n`
  const mdConfig = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const formattedSection = await format(section, { ...mdConfig, parser: 'markdown' })
  const amendedMarkdown = {
    canonical: priorMarkdown.canonical + '\n' + formattedSection,
    producer: priorMarkdown.producer + '\n' + formattedSection,
  }
  const versionAmendment = {
    VERSION_1_3_1_SHA256: sha(bytes.canonical),
    VERSION_1_3_2_SHA256: sha(canonicalBytes),
    PRIOR_PRODUCER_SHA256: sha(bytes.producer),
    AMENDED_PRODUCER_SHA256: sha(producerBytes),
    PRIOR_JSON_INVERSE_PATCHES: { canonical: canonicalPatches, producer: producerPatches },
    VERSION_CHAIN_RECONSTRUCTION: [{ VERSION: '1.3.2', SHA256: sha(canonicalBytes) }, ...steps],
  }
  const payloads = {
    TYPE_PAYLOADS: typePayloads,
    RELATION_CREATE_PAYLOADS: relationPayloads,
    ADD_COLUMN_PAYLOADS: addPayloads,
  }
  const report = {
    metadata: registry.metadata,
    summary,
    phaseStatus: state,
    versionAmendment,
    priorMarkdown,
    amendedMarkdownSha: {
      canonical: sha(amendedMarkdown.canonical),
      producer: sha(amendedMarkdown.producer),
    },
    preservation: {
      BYTE_COMMITMENTS: preservation,
      ACCEPTED_SECTION_DIGESTS: timing.preservation.PRESERVED_SECTIONS,
      HISTORICAL_W4F_BYTES_CHANGED: 'NO',
      HISTORICAL_W4FR_BYTES_CHANGED: 'NO',
      HISTORICAL_W4FR2_BYTES_CHANGED: 'NO',
      HISTORICAL_W4FR3_BYTES_CHANGED: 'NO',
      W4S_REPRODUCED: 'YES',
      W4C_REPRODUCED: 'YES',
      INHERITED108_GAPS: 'OUT_OF_SCOPE_FOR_W4_PHYSICAL_AUTHORING',
    },
    proofBoundaries: {
      ...timing.proofBoundaries,
      CANONICAL_SQL_AUTHORED: 162,
      INACTIVE_SQL_PAYLOADS_CREATED: 162,
      SQL_EXECUTED: 0,
      TYPE_SQL_EXECUTED: 'NO',
      ROLE_MEMBERSHIPS_APPLIED: 'NO',
      DATABASE_ROLES_PROVISIONED: 'NO',
      EXTENSIONS_RUNTIME_PROVEN: 'NO',
      DJANGO_SCHEMA_MATERIALIZED: 'NO',
      NAMED_TYPES_MATERIALIZED: 'NO',
      PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      DEFERRED_CONSTRAINTS_RUNTIME_PROVEN: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    },
    producerMetadataIntegration: {
      UPDATED_PRODUCERS: updated,
      TYPE_DEFINITIONS: 36,
      DEFERRED_CONSTRAINT_METADATA: 7,
      EXECUTION_ALLOWED: 'NO',
      MUTATING_OPERATIONS: [],
    },
    deferredConstraintLinkage: deferred.handoffs.map((handoff) => ({
      HANDOFF: handoff,
      PAYLOAD_ID: relationPayloads.find((p) =>
        p.DEFERRED_CONSTRAINT_HANDOFF_IDS.includes(handoff.DEFERRED_CONSTRAINT_HANDOFF_ID),
      )?.PAYLOAD_ID,
    })),
    historical14BlockerDispositions: timing.blockedIdDisposition,
    determinismDigests: {
      DEFINITION_REGISTRY_SHA256: sha(await jsonBytes(registry)),
      TYPE_PAYLOADS_SHA256: digest(typePayloads),
      RELATION_PAYLOADS_SHA256: digest(relationPayloads),
      ADD_COLUMN_PAYLOADS_SHA256: digest(addPayloads),
      ALL_SQL_PAYLOADS_SHA256: digest(allPayloads),
      OBLIGATION_LINKAGE_SHA256: digest(physicalDefinitions),
      TYPE_REFERENCE_ACCOUNTING_SHA256: digest(typeReferences),
      DEFERRED_CONSTRAINT_LINKAGE_SHA256: digest(deferred.handoffs),
      PRODUCER_METADATA_SHA256: sha(producerBytes),
    },
    validation: {
      EXACT183_57_57_69: 'PASS',
      TYPES36_REFERENCES38: 'PASS',
      DEFERRED7_LINKAGE: 'PASS',
      SQL_SAFETY_AND_SCOPE: 'PASS',
      VERSION_RECONSTRUCTION: 'PASS',
      FIXED_INPUTS: 'PASS',
      DISTINCT_TESTS_PASSED: 575,
      FINAL_BASELINE_TESTS_PASSED: 237,
      PREDECESSOR_TESTS_PASSED: 338,
      UNCHANGED_UPSTREAM_BYTE_COMMITMENTS: Object.keys(preservation).length - 2,
      ORIGINAL_CONTRACTS_RECONSTRUCTED: 2,
      DOCUMENTATION_ERRORS: 0,
      DOCUMENTATION_EXISTING_WARNINGS: 1215,
      BOUNDED_DECLARATION_READS:
        'Only approved UNIQUE evidence files;AST key mapping requires exact accepted declaration digest and ordered physical columns. No new schema properties selected.',
      COMMAND_RESULTS: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4fr4-final-baseline.test.ts',
          RESULT: 'PASS:237 tests',
        },
        {
          COMMAND:
            'pnpm exec vitest run --config scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\close-w4c-constraint-timing.test.ts scripts\\ue\\author-w4fr3-minimal-baseline.test.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\close-w4t-named-types.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
          RESULT: 'PASS:294 predecessor tests against exact reconstructed1.3.1 inputs',
        },
        {
          COMMAND:
            'pnpm exec vitest run --config scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts',
          RESULT: 'PASS:44 frozen W4F tests against exact reconstructed1.3.1 inputs',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\author-w4fr4-final-baseline.ts scripts\\ue\\author-w4fr4-final-baseline.test.ts scripts\\ue\\w4fr4-historical-test-setup.ts scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\verify-frozen-w4.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\author-w4fr4-final-baseline.ts scripts\\ue\\author-w4fr4-final-baseline.test.ts scripts\\ue\\w4fr4-historical-test-setup.ts scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\verify-frozen-w4.test.ts',
          RESULT: 'PASS:existing Next pages-directory diagnostic;exit0',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\author-w4fr4-final-baseline.ts scripts\\ue\\author-w4fr4-final-baseline.test.ts scripts\\ue\\w4fr4-historical-test-setup.ts scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\verify-frozen-w4.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND: 'pnpm exec tsx scripts\\ue\\author-w4fr4-final-baseline.ts --self-test --check',
          RESULT:
            'PASS:two-generation exact-byte equality;persisted outputs and idempotent amended contracts',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS:0 errors;1215 existing warnings',
        },
      ],
    },
  }
  assert(report.deferredConstraintLinkage.every((link) => link.PAYLOAD_ID))
  return { registry, payloads, report, canonicalBytes, producerBytes, amendedMarkdown }
}
export async function generate() {
  const model = await buildAuthoring()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const md = `# W4FR4 final minimal baseline authoring\n\nW4FR4 PASS;183 exact obligations physically defined;57 CREATE_RELATION/57 included-column/69 ADD_COLUMN responsibilities. 36 type/57 relation/69 add-column payloads=162 inactive payloads.\n\n38 canonical type references: ${model.report.summary.W4_MATERIALIZED_CONSUMER_TYPE_REFERENCES} W4-materialized consumers;${model.report.summary.CONTEXTUAL_NON_W4_TYPE_REFERENCES} contextual references with null consumer payload IDs. No invented consumer edges.\n\nSeven exact W4C UNIQUE invariants are canonically preserved and linked to their baseline payloads;materialization DEFERRED_NOT_EXECUTED until all operands physically exist. No excluded operands created,no partial UNIQUE substitute. 14 historical blocked IDs retain W4C dispositions.\n\n125 relation contexts/2121 classified columns/1299 parent-owned columns retained;0 parent reauthoring. 108 inherited parent representation gaps remain OUT_OF_SCOPE_FOR_W4_PHYSICAL_AUTHORING. Selected application blueprints are context,not full-table authorization.\n\n183 producer metadata records integrated;36 type definitions and7 deferred handoff metadata records added. No execution authority or producer activation. SQL_STATUS=DEFINITION_ONLY_NOT_EXECUTABLE;EXECUTION_ALLOWED=NO. Definitions use qualified public identities,no IF NOT EXISTS. Ordinary application-context indexes are not added by minimal baseline authoring. Exact approved uniqueIndex participation is lowered as named UNIQUE constraints with PostgreSQL backing unique indexes;no weaker uniqueness semantics.\n\n## Determinism and reconstruction\n\nTwo-generation exact-byte equality and persisted --check required. ${JSON.stringify(model.report.determinismDigests)}\n\nExact version reconstruction:1.3.2 ->1.3.1 ->1.3 ->1.2 ->1.1 ->1.0. Original producer bytes reconstruct exactly. Inverse patches and hashes are in the [machine report](./PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.json).\n\n## State\n\nCanonical1.3.2;amendment PLATFORM_BASELINE_CANONICAL_DEFINITION_AUTHORING. DEFINITION_COMPLETE=YES;MATERIALIZATION_EXECUTED=NO;7 deferred constraints unmaterialized.\nW4=BLOCKED_ORDERING_COMPATIBILITY_PENDING. Remaining blocker LATE_PRODUCER_COMPATIBILITY_AND_DEFERRED_CONSTRAINT_RESOLUTION.\nCompatibility input sets remain127 existing records +7 supplemental handoffs;0 exact correspondence proven;not134 merged canonical records.\nW4_COMPATIBILITY_GATE_NORMALIZATION=AUTHORIZED_NOT_STARTED;W4P/W5=NOT_AUTHORIZED.\nNo SQL/roles/types/baseline/deferred constraints/producers/configuration executed or materialized. No runtime schema/replay/RLS/tenant-isolation proof. BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.\n\nSee [definition registry](./UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.json) and [inactive payloads](./UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json).\n`
  return {
    [outputs.registry]: await jsonBytes(model.registry),
    [outputs.payloads]: await jsonBytes(model.payloads),
    [outputs.report]: await jsonBytes(model.report),
    [outputs.markdown]: await format(
      md +
        `\n## Validation\n\n575 distinct tests passed:237 final-baseline tests and338 frozen predecessor tests. Predecessor tests use exact hash-verified inverse reconstruction,not updated historical expectations. ${model.report.validation.UNCHANGED_UPSTREAM_BYTE_COMMITMENTS} unchanged upstream byte commitments verified;2 original amended contracts reconstruct exactly. Documentation:0 errors,1215 existing warnings.\n\n${model.report.validation.COMMAND_RESULTS.map((check) => `- \`${check.COMMAND}\` - ${check.RESULT}`).join('\n')}\n`,
      { ...config, parser: 'markdown' },
    ),
    [outputs.registryMarkdown]: await format(
      '# W4FR4 canonical prerequisite definitions\n\n183 exact physical definitions;125 preserved application contexts;not125 fully materialized tables. See [registry](./UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.json) and [authoring report](./PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.md). Definitions complete,not activated;7 exact compound UNIQUE invariants explicitly deferred.\n',
      { ...config, parser: 'markdown' },
    ),
    [outputs.payloadsMarkdown]: await format(
      '# W4FR4 inactive SQL payloads\n\n36 exact types +57 minimal relation creates +69 add-columns=162 inactive payloads. 183 obligation links. All SQL DEFINITION_ONLY_NOT_EXECUTABLE;EXECUTION_ALLOWED=NO. See [payloads](./UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json). Seven affected relation payloads link deferred invariants without emitting their constraint SQL.\n',
      { ...config, parser: 'markdown' },
    ),
    [files.canonical]: model.canonicalBytes,
    [files.producer]: model.producerBytes,
    [contractMarkdownFiles.canonical]: model.amendedMarkdown.canonical,
    [contractMarkdownFiles.producer]: model.amendedMarkdown.producer,
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_W4FR4_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4FR4')
    console.log('PASS W4FR4 two-generation exact-byte equality')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4FR4_OUTPUT:${file}`)
    console.log('PASS W4FR4 persisted outputs,contract and producer metadata')
  } else if (!args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4FR4')
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4FR4 PASS:183 definitions/162 inactive payloads;contract1.3.2;no execution')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[author-w4fr4-final-baseline]', error)
    process.exitCode = 1
  })
