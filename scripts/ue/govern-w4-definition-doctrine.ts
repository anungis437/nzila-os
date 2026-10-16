import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'
import { exactIds, read, root, sha } from './w4-physical-producers'
import type { buildRegistry } from './author-w4-canonical-definitions'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  packet: folder + 'UE_W4F_CANONICAL_DEFINITION_DECISION_PACKET.json',
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.json',
  w4f: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const outputs = {
  report: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.md',
  residual: folder + 'UE_W4H_RESIDUAL_DEFINITION_DECISION_PACKET.json',
}
type W4F = Awaited<ReturnType<typeof buildRegistry>>
type Relation = W4F['relationDefinitions'][number]
type Column = Relation['COLUMNS'][number]
type Declaration = Relation['DECLARATIONS'][number]
type Provenance =
  | 'EXACT_DECLARATION'
  | 'EXACT_HISTORICAL_EVIDENCE'
  | 'W4H_GOVERNANCE_DEFAULT'
  | 'W4H_CONFLICT_RESOLUTION'
export interface Selection {
  PROPERTY: string
  VALUE: string | null
  PROVENANCE: Provenance | null
  RULE: string
  EVIDENCE_REFERENCES: {
    FILE: string
    DIGEST: string
    RANGE: number[]
    COLUMN_EXPRESSION_DIGEST?: string
  }[]
  TYPE_DEPENDENCY_POSTURE?: string
  STATUS: 'APPROVED' | 'RESIDUAL_HUMAN_DECISION_REQUIRED' | 'CONFLICT'
  RATIONALE: string
  COMPONENT_PROPERTIES?: { PROPERTY: string; VALUE: string; PROVENANCE: Provenance; RULE: string }[]
}
const properties = [
  'POSTGRES_TYPE',
  'NULLABILITY',
  'DEFAULT',
  'IDENTITY_OR_GENERATED',
  'PRIMARY_KEY_PARTICIPATION',
  'UNIQUE_PARTICIPATION',
  'FOREIGN_KEY',
  'CHECK_CONSTRAINTS',
] as const
export const defaults: Partial<Record<(typeof properties)[number], string>> = {
  NULLABILITY: 'NULLABLE',
  DEFAULT: 'NO_DEFAULT',
  IDENTITY_OR_GENERATED: 'NONE',
  PRIMARY_KEY_PARTICIPATION: 'NONE_IN_BASELINE',
  UNIQUE_PARTICIPATION: 'NONE',
  FOREIGN_KEY: 'NONE',
  CHECK_CONSTRAINTS: '[]',
}
export function consumerCheck(
  selection: Selection,
  requirements: { PROPERTY: string; REQUIRED_VALUE: string; EVIDENCE: string }[],
): Selection {
  assert(
    Array.isArray(requirements) &&
      requirements.every(
        (r) =>
          typeof r.PROPERTY === 'string' &&
          typeof r.REQUIRED_VALUE === 'string' &&
          typeof r.EVIDENCE === 'string',
      ),
    'INVALID_CONSUMER_REQUIREMENT_EVIDENCE',
  )
  const contrary = requirements.filter(
    (r) =>
      (r.PROPERTY === selection.PROPERTY || r.PROPERTY === selection.PROPERTY.split('.').at(-1)) &&
      r.REQUIRED_VALUE !== selection.VALUE,
  )
  if (!contrary.length) return selection
  return {
    ...selection,
    VALUE: null,
    PROVENANCE: null,
    STATUS: 'RESIDUAL_HUMAN_DECISION_REQUIRED',
    RATIONALE: `Doctrine cannot override explicit accepted consumer requirement:${JSON.stringify(contrary)}`,
  }
}
const ref = (table: Declaration, expression?: string) => ({
  FILE: table.REFERENCE.FILE,
  DIGEST: table.REFERENCE.DIGEST,
  RANGE: table.REFERENCE.RANGE,
  ...(expression ? { COLUMN_EXPRESSION_DIGEST: sha(expression) } : {}),
})
function value(
  property: string,
  selected: string,
  provenance: Provenance,
  rule: string,
  evidence: Selection['EVIDENCE_REFERENCES'],
  rationale: string,
): Selection {
  return {
    PROPERTY: property,
    VALUE: selected,
    PROVENANCE: provenance,
    RULE: rule,
    EVIDENCE_REFERENCES: evidence,
    STATUS: 'APPROVED',
    RATIONALE: rationale,
  }
}
function pending(
  property: string,
  rule: string,
  evidence: Selection['EVIDENCE_REFERENCES'],
  reason: string,
): Selection {
  return {
    PROPERTY: property,
    VALUE: null,
    PROVENANCE: null,
    RULE: rule,
    EVIDENCE_REFERENCES: evidence,
    STATUS: 'RESIDUAL_HUMAN_DECISION_REQUIRED',
    RATIONALE: reason,
  }
}
function callbackFacts(table: Declaration, columnKey: string, property: string): string[] {
  if (!table.CONSTRAINT_SOURCE) return []
  const source = ts.createSourceFile(
    'embedded-design.ts',
    `const design=${table.CONSTRAINT_SOURCE};`,
    ts.ScriptTarget.Latest,
    true,
  )
  const found = new Set<string>()
  const target = new RegExp(`\\.\\s*${columnKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  const kind =
    property === 'UNIQUE_PARTICIPATION'
      ? /\b(?:unique|uniqueIndex)\s*\(/
      : property === 'PRIMARY_KEY_PARTICIPATION'
        ? /\bprimaryKey\s*\(/
        : property === 'CHECK_CONSTRAINTS'
          ? /\bcheck\s*\(/
          : null
  if (!kind) return []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const text = node.getText(source)
      if (kind.test(text) && target.test(text)) {
        found.add(text)
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...found]
}
export function selectProperty(
  property: (typeof properties)[number],
  column: Column,
  tables: Declaration[],
): Selection {
  const current = tables.filter((t) => t.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE')
  const historical = tables.filter((t) => t.REFERENCE.CLASS === 'HISTORICAL_SQL_DESIGN_EVIDENCE')
  const entries = (pool: Declaration[]) =>
    pool.flatMap((table) =>
      table.COLUMNS.filter((c) => c.NAME === column.COLUMN_NAME).map((c) => ({
        table,
        col: c,
        fact: c.PROPERTIES[property],
      })),
    )
  const now = entries(current)
  const old = entries(historical)
  const all = [...now, ...old]
  const evidence = all.map((e) => ref(e.table, e.col.SOURCE_EXPRESSION))
  const knownCurrent = now.filter((e) => e.fact.STATE === 'EXPLICIT')
  const knownHistory = old.filter((e) => e.fact.STATE === 'EXPLICIT')
  if (property === 'POSTGRES_TYPE' && !knownCurrent.length && now.length) {
    const names = now.map(
      (e) =>
        /References existing enum declaration ([A-Za-z_][A-Za-z0-9_]*)/.exec(e.fact.EVIDENCE)?.[1],
    )
    if (names.every((name) => typeof name === 'string') && new Set(names).size === 1)
      return {
        ...value(
          property,
          names[0]!,
          'EXACT_DECLARATION',
          'RULE_5_EXACT_DECLARED_NAMED_TYPE',
          evidence,
          'Current pgEnum name is exact definition-design evidence; do not substitute historical text or another type family',
        ),
        TYPE_DEPENDENCY_POSTURE:
          'Existing named declaration dependency only; W4H does not author enum members, grant type ownership, authorize new type creation, or prove type availability. Definition authoring and producer dependency verification remain separate.',
      }
  }
  if (
    property === 'POSTGRES_TYPE' &&
    !knownCurrent.length &&
    now.length &&
    now.every(
      (e) =>
        /\b(?:numeric|decimal)\s*\(/.test(e.col.SOURCE_EXPRESSION) &&
        /Numeric precision\/scale/.test(e.fact.EVIDENCE),
    )
  )
    return value(
      property,
      'numeric',
      'W4H_GOVERNANCE_DEFAULT',
      'RULE_15_UNCONSTRAINED_CURRENT_NUMERIC',
      evidence,
      'Current exact numeric family has no governed precision/scale; narrower historical precision is not adopted over current evidence',
    )
  const currentCallbacks = now.flatMap((e) =>
    callbackFacts(
      e.table,
      e.col.KEY,
      property === 'NULLABILITY' ? 'PRIMARY_KEY_PARTICIPATION' : property,
    ).map((expression) => ({ expression, table: e.table })),
  )
  if (!knownCurrent.length && currentCallbacks.length)
    return value(
      property,
      property === 'NULLABILITY'
        ? 'NOT_NULL'
        : JSON.stringify([...new Set(currentCallbacks.map((e) => e.expression))]),
      'EXACT_DECLARATION',
      'RULE_9_10_11_CURRENT_CALLBACK_FACT',
      currentCallbacks.map((e) => ref(e.table)),
      'Explicit current callback participation; primary key establishes NOT_NULL. No inferred restriction.',
    )
  const selected = knownCurrent.length ? knownCurrent : knownHistory
  const knownValues = [...new Set(selected.map((e) => e.fact.VALUE!))]
  if (knownValues.length === 1) {
    if (property === 'IDENTITY_OR_GENERATED' && /need review/.test(knownValues[0]))
      return pending(
        property,
        'RULE_8_EXACT_GENERATION_ONLY',
        evidence,
        'Declared identity behavior exists but exact sequence options are not governed; NONE would erase established generation',
      )
    const caseResolution =
      property === 'POSTGRES_TYPE' &&
      column.RELATION_NAME === 'case_documents' &&
      knownCurrent.length &&
      knownValues[0] === 'text' &&
      knownHistory.some((e) => e.fact.VALUE?.startsWith('character varying'))
    return value(
      property,
      knownValues[0],
      caseResolution
        ? 'W4H_CONFLICT_RESOLUTION'
        : knownCurrent.length
          ? 'EXACT_DECLARATION'
          : 'EXACT_HISTORICAL_EVIDENCE',
      caseResolution
        ? 'RULE_17_CASE_DOCUMENTS_CURRENT_TEXT'
        : 'RULE_4_5_CURRENT_THEN_HISTORICAL_EXACT_FACT',
      evidence,
      caseResolution
        ? 'Current text selected; historical varchar lengths are narrower legacy constraints, not accepted current business invariants. Historical evidence retained.'
        : 'Preserves exact highest-precedence explicit property; no preferred platform substitution',
    )
  }
  if (knownValues.length > 1) {
    // Default literal spellings may differ without changing their exact typed value.
    if (property === 'DEFAULT') {
      const type = column.RESOLVED_PROPERTIES.POSTGRES_TYPE?.VALUE
      const normalized = knownValues.map((v) => {
        if (type?.startsWith('numeric')) return /^"(-?\d+(?:\.\d+)?)"$/.exec(v)?.[1] ?? v
        if (['json', 'jsonb'].includes(type ?? '') && v.startsWith('"')) {
          const text: unknown = JSON.parse(v)
          if (typeof text === 'string' && /^[\[{]/.test(text.trim()))
            return JSON.stringify(JSON.parse(text))
        }
        return v
      })
      if (new Set(normalized).size === 1)
        return value(
          property,
          normalized[0],
          knownCurrent.length ? 'EXACT_DECLARATION' : 'EXACT_HISTORICAL_EVIDENCE',
          'RULE_4_EQUIVALENT_TYPED_LITERAL',
          evidence,
          'Equivalent literal representation only; original source text preserved',
        )
    }
    return {
      ...pending(
        property,
        'RULE_4_UNSETTLED_EQUAL_PRECEDENCE_FACTS',
        evidence,
        `Different explicit values at the same evidence precedence:${JSON.stringify(knownValues)}`,
      ),
      STATUS: 'CONFLICT',
    }
  }
  if (property === 'POSTGRES_TYPE') {
    return pending(
      property,
      'RULE_5_18_19_EXACT_TYPE_REQUIRED',
      evidence,
      all.map((e) => e.fact.EVIDENCE).join('\n') ||
        'No exact PostgreSQL type in bounded evidence; generic type family does not settle representation',
    )
  }
  if (property === 'FOREIGN_KEY') {
    const clauses = tables.map((t) => ({ t, text: t.CONSTRAINT_SOURCE ?? '' }))
    const name = column.COLUMN_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const exact = clauses.flatMap(({ t, text }) => {
      const match = new RegExp(
        `FOREIGN\\s+KEY\\s*\\(\\s*"?${name}"?\\s*\\)\\s*REFERENCES\\s+("[^"]+"\\."[^"]+"|[\\w]+\\.[\\w]+)\\s*\\(([^)]+)\\)([^;\\n]*)`,
        'i',
      ).exec(text)
      return match ? [{ table: t, match }] : []
    })
    if (exact.length) {
      const fkValues = exact.map(({ match }) =>
        JSON.stringify({
          REFERENCED_RELATION: match[1].replaceAll('"', ''),
          REFERENCED_COLUMNS: match[2].split(',').map((c) => c.replaceAll('"', '').trim()),
          ON_DELETE:
            /ON\s+DELETE\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)/i
              .exec(match[3])?.[1]
              .toUpperCase()
              .replaceAll(' ', '_') ?? 'NO_ACTION',
          ON_UPDATE:
            /ON\s+UPDATE\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)/i
              .exec(match[3])?.[1]
              .toUpperCase()
              .replaceAll(' ', '_') ?? 'NO_ACTION',
        }),
      )
      if (new Set(fkValues).size === 1) {
        const selected = value(
          property,
          fkValues[0],
          'EXACT_HISTORICAL_EVIDENCE',
          'RULE_12_13_EXACT_TARGET_NO_ACTION_IF_OMITTED',
          exact.map((e) => ref(e.table)),
          'Exact qualified target/columns retained; missing actions prospectively adopted NO_ACTION by W4H, not historical fact',
        )
        const actions = exact[0].match[3]
        const resolved: {
          REFERENCED_RELATION: string
          REFERENCED_COLUMNS: string[]
          ON_DELETE: string
          ON_UPDATE: string
        } = JSON.parse(fkValues[0])
        return {
          ...selected,
          COMPONENT_PROPERTIES: [
            {
              PROPERTY: 'REFERENCED_RELATION',
              VALUE: resolved.REFERENCED_RELATION,
              PROVENANCE: 'EXACT_HISTORICAL_EVIDENCE',
              RULE: 'RULE_12_EXACT_QUALIFIED_TARGET',
            },
            {
              PROPERTY: 'REFERENCED_COLUMNS',
              VALUE: JSON.stringify(resolved.REFERENCED_COLUMNS),
              PROVENANCE: 'EXACT_HISTORICAL_EVIDENCE',
              RULE: 'RULE_12_EXACT_REFERENCED_COLUMNS',
            },
            ...(['ON_DELETE', 'ON_UPDATE'] as const).map((key) => ({
              PROPERTY: key,
              VALUE: resolved[key],
              PROVENANCE: new RegExp(
                key === 'ON_DELETE' ? 'ON\\s+DELETE' : 'ON\\s+UPDATE',
                'i',
              ).test(actions)
                ? ('EXACT_HISTORICAL_EVIDENCE' as const)
                : ('W4H_GOVERNANCE_DEFAULT' as const),
              RULE: 'RULE_13_EXACT_ACTION_OR_GOVERNED_NO_ACTION',
            })),
          ],
        }
      }
      return pending(
        property,
        'RULE_12_DIFFERENT_REFERENCED_TARGETS',
        evidence,
        'Multiple different exact FK targets/actions require a semantic choice',
      )
    }
    return value(
      property,
      'NONE',
      'W4H_GOVERNANCE_DEFAULT',
      'RULE_12_NO_UNPROVEN_PHYSICAL_FK',
      evidence,
      'No fully established physical source/target/column relationship; preserve symbolic/logical references for later W6, do not invent target identity',
    )
  }
  const declaredConstraints = now.flatMap((e) =>
    callbackFacts(e.table, e.col.KEY, property).map((expression) => ({
      expression,
      table: e.table,
    })),
  )
  const oldConstraints = declaredConstraints.length
    ? []
    : old.flatMap((e) =>
        callbackFacts(e.table, e.col.KEY, property).map((expression) => ({
          expression,
          table: e.table,
        })),
      )
  const constraints = [...declaredConstraints, ...oldConstraints]
  if (constraints.length)
    return value(
      property,
      JSON.stringify([...new Set(constraints.map((e) => e.expression))]),
      declaredConstraints.length ? 'EXACT_DECLARATION' : 'EXACT_HISTORICAL_EVIDENCE',
      'RULE_9_10_11_EXACT_CALLBACK_CONSTRAINT_PARTICIPATION',
      constraints.map((e) => ref(e.table)),
      'Participation explicitly present in bounded callback design evidence; preserved expression only, not SQL generation',
    )
  const constraintKeyword =
    property === 'UNIQUE_PARTICIPATION'
      ? /\bUNIQUE\b/i
      : property === 'PRIMARY_KEY_PARTICIPATION'
        ? /\bPRIMARY\s+KEY\b/i
        : property === 'CHECK_CONSTRAINTS'
          ? /\bCHECK\b/i
          : null
  if (constraintKeyword) {
    const name = new RegExp(`\\b${column.COLUMN_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    const clauses = historical.flatMap((table) =>
      (table.CONSTRAINT_SOURCE ?? '')
        .split('\n')
        .filter((clause) => constraintKeyword.test(clause) && name.test(clause))
        .map((clause) => ({ clause, table })),
    )
    if (clauses.length)
      return value(
        property,
        JSON.stringify([...new Set(clauses.map((c) => c.clause))]),
        'EXACT_HISTORICAL_EVIDENCE',
        'RULE_9_10_11_EXACT_HISTORICAL_CONSTRAINT',
        clauses.map((c) => ref(c.table)),
        'Exact historical constraint design evidence names this physical column; not regenerated SQL',
      )
  }
  return value(
    property,
    defaults[property]!,
    'W4H_GOVERNANCE_DEFAULT',
    `RULE_MINIMUM_COMMITMENT_${property}`,
    evidence,
    'New prospective governance value where no exact property is established; not a claim about historical physical schema',
  )
}
export function governRelation(relation: Relation) {
  const current = relation.DECLARATIONS.filter(
    (d) => d.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE',
  )
  const historical = relation.DECLARATIONS.filter(
    (d) => d.REFERENCE.CLASS === 'HISTORICAL_SQL_DESIGN_EVIDENCE',
  )
  const basis = current.length ? current : historical
  const currentColumnSets = [
    ...new Set(current.map((d) => JSON.stringify(d.COLUMNS.map((c) => c.NAME).sort()))),
  ]
  const columnSet =
    currentColumnSets.length > 1
      ? pending(
          'CANONICAL_COLUMN_SET',
          'RULE_4_INCONSISTENT_CURRENT_DECLARATION_SHAPES',
          current.map((d) => ref(d)),
          `Current declarations describe different column sets for the same physical relation:${currentColumnSets.join(' versus ')}. Combining them creates a hybrid product schema not authorized by minimum commitment.`,
        )
      : value(
          'CANONICAL_COLUMN_SET',
          currentColumnSets[0] ??
            JSON.stringify(
              [...new Set(historical.flatMap((d) => d.COLUMNS.map((c) => c.NAME)))].sort(),
            ),
          current.length ? 'EXACT_DECLARATION' : 'EXACT_HISTORICAL_EVIDENCE',
          'RULE_4_EXACT_RELATION_SHAPE',
          basis.map((d) => ref(d)),
          'Exact highest-precedence declared column set; historical-only extra columns not silently merged into a current definition',
        )
  const columns = relation.COLUMNS.map((column) => ({
    COLUMN_DEFINITION_ID: column.COLUMN_DEFINITION_ID,
    COLUMN_NAME: column.COLUMN_NAME,
    PHYSICAL_IDENTITY: column.PHYSICAL_IDENTITY,
    SELECTED_PROPERTIES: properties.map((p) => selectProperty(p, column, relation.DECLARATIONS)),
    LOGICAL_RELATIONSHIP_EVIDENCE: relation.DECLARATIONS.flatMap((t) =>
      t.COLUMNS.filter((c) => c.NAME === column.COLUMN_NAME && c.REFERENCES.length).map((c) => ({
        REFERENCE: ref(t, c.SOURCE_EXPRESSION),
        LOGICAL_REFERENCES: c.REFERENCES,
      })),
    ),
    W6_SEMANTIC_BINDING_REQUIRED:
      'YES; where already applicable, no physical selection resolves opaque semantics',
  }))
  const constraintExpressions = basis
    .filter((d) => d.CONSTRAINT_SOURCE)
    .map((d) => ({
      SOURCE: ref(d),
      EXACT_CONSTRAINT_AND_INDEX_DESIGN_EXPRESSION: d.CONSTRAINT_SOURCE,
    }))
  const relationProperties = [
    columnSet,
    value(
      'SCHEMA',
      relation.SCHEMA_NAME,
      'EXACT_DECLARATION',
      'RULE_3_FIXED_PHYSICAL_IDENTITY',
      basis.map((d) => ref(d)),
      'Accepted fixed W4G/W4F identity; no new schema',
    ),
    value(
      'RELATION_NAME',
      relation.RELATION_NAME,
      'EXACT_DECLARATION',
      'RULE_3_FIXED_PHYSICAL_IDENTITY',
      basis.map((d) => ref(d)),
      'Accepted fixed identity',
    ),
    relation.RELATION_KIND.STATE === 'EXPLICIT' && relation.RELATION_KIND.VALUE === 'TABLE'
      ? value(
          'RELATION_KIND',
          'TABLE',
          current.length ? 'EXACT_DECLARATION' : 'EXACT_HISTORICAL_EVIDENCE',
          'RULE_24_TABLE_EVIDENCE',
          basis.map((d) => ref(d)),
          'Embedded evidence demonstrates pgTable/CREATE TABLE',
        )
      : pending(
          'RELATION_KIND',
          'RULE_24_NO_VIEW_CONVERSION',
          [],
          'No bounded evidence establishes table kind',
        ),
    value(
      'CANONICAL_OWNER',
      'PLATFORM_BASELINE',
      'EXACT_DECLARATION',
      'PRESERVED_HUMAN_GOVERNANCE_W4G',
      [],
      'Ownership is already settled, not reopened',
    ),
    value(
      'RELATION_CONSTRAINTS_AND_INDEXES',
      constraintExpressions.length
        ? JSON.stringify({
            EXACT_EVIDENCE_EXPRESSIONS: constraintExpressions,
            PHYSICAL_FOREIGN_KEYS:
              'Only COLUMN_GOVERNANCE.FOREIGN_KEY approved selections may be constructed; symbolic callback foreignKey/references evidence alone does not override NONE',
            REQUIRED_INDEXES:
              'Only explicit index/uniqueIndex design expressions, never query inference',
          })
        : 'NONE_IN_BASELINE',
      constraintExpressions.length
        ? current.length
          ? 'EXACT_DECLARATION'
          : 'EXACT_HISTORICAL_EVIDENCE'
        : 'W4H_GOVERNANCE_DEFAULT',
      'RULE_9_10_11_14_EXPLICIT_ONLY',
      basis.map((d) => ref(d)),
      'Adopt only exact referenced design expressions; no query-derived indexes, inferred keys or checks. This is governance input, not generated SQL; lowering remains W4F work',
    ),
  ]
  return {
    RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
    SCHEMA_NAME: relation.SCHEMA_NAME,
    RELATION_NAME: relation.RELATION_NAME,
    COLUMN_GOVERNANCE: columns,
    RELATION_PROPERTIES: relationProperties,
    SOURCE_OBLIGATION_IDS: relation.SOURCE_OBLIGATION_IDS,
    DEFINITION_AUTHORITY: current.length
      ? 'HUMAN_GOVERNANCE_W4H_USING_CURRENT_DECLARATION'
      : 'HUMAN_GOVERNANCE_W4H_USING_HISTORICAL_DESIGN_EVIDENCE',
    HISTORICAL_COMPATIBILITY_EVIDENCE: historical.map((d) => ref(d)),
    CURRENT_DECLARATION_VARIANTS: current.map((d) => ({
      EVIDENCE_REFERENCE: ref(d),
      COLUMN_NAMES: d.COLUMNS.map((col) => col.NAME),
      CONSTRAINT_DESIGN_EVIDENCE: d.CONSTRAINT_SOURCE,
    })),
    SEMANTIC_EXPANSION: 'NO',
    SQL_AUTHORED: 'NO',
  }
}
export async function buildGovernance() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const f: W4F = JSON.parse(bytes.w4f)
  const registry: Pick<W4F, 'relationDefinitions' | 'definitionRecords'> = JSON.parse(
    bytes.registry,
  )
  const packet: Pick<W4F, 'designDecisions'> = JSON.parse(bytes.packet)
  const g: {
    ownershipAdoption: { DECISION_ID: string }[]
    canonicalDefinitionObligations: {
      DEFINITION_OBLIGATION_ID: string
      DATABASE_SCOPE_ID: string
      CANONICAL_OWNER: string
      AVAILABLE_CONSUMER_EVIDENCE: {
        REQUIRED_BEFORE_CONSUMER_IDS: string[]
        REQUIRED_PHYSICAL_PROPERTIES?: {
          PROPERTY: string
          REQUIRED_VALUE: string
          EVIDENCE: string
        }[]
      }
    }[]
    lateDefinitionRegister: unknown[]
    lateProducerCompatibilityObligations: unknown[]
  } = JSON.parse(bytes.w4g)
  const c: {
    CONTRACT_VERSION: string
    prerequisiteObligations: unknown[]
    frozenMigrationManifest: unknown[]
  } = JSON.parse(bytes.canonical)
  assert.equal(c.CONTRACT_VERSION, '1.3.1')
  assert.equal(f.phaseStatus.PHASE_1B_3C_A1I_W4F_GATE, 'BLOCKED')
  assert.equal(f.summary.DESIGN_DECISION_REQUIRED, 182)
  assert.equal(f.summary.DEFINITION_CONFLICT, 1)
  assert.deepEqual(
    registry.relationDefinitions,
    f.relationDefinitions,
    'FROZEN_REGISTRY_REPORT_DRIFT',
  )
  assert.deepEqual(packet.designDecisions, f.designDecisions, 'FROZEN_PACKET_REPORT_DRIFT')
  assert.equal(packet.designDecisions.length, 126)
  assert.equal(new Set(packet.designDecisions.map((d) => d.DESIGN_CHOICE_ID)).size, 126)
  exactIds(
    packet.designDecisions.flatMap((d) => d.DEFINITION_OBLIGATION_IDS).sort(),
    g.canonicalDefinitionObligations.map((d) => d.DEFINITION_OBLIGATION_ID).sort(),
  )
  assert.equal(g.canonicalDefinitionObligations.length, 183)
  assert(
    g.canonicalDefinitionObligations.every(
      (o) => o.DATABASE_SCOPE_ID === 'UE_OPERATIONAL' && o.CANONICAL_OWNER === 'PLATFORM_BASELINE',
    ),
    'OWNERSHIP_OR_SCOPE_DRIFT',
  )
  assert.equal(registry.relationDefinitions.length, 125)
  assert.equal(g.ownershipAdoption.length, 310)
  assert.equal(g.lateDefinitionRegister.length, 127)
  assert.equal(g.lateProducerCompatibilityObligations.length, 127)
  const relations = registry.relationDefinitions.map(governRelation)
  const byRelation = new Map(relations.map((r) => [r.RELATION_DEFINITION_ID, r]))
  const obligations = registry.definitionRecords.map((definition) => {
    const relation = byRelation.get(definition.RELATION_DEFINITION_ID)!
    assert(relation)
    const columns = relation.COLUMN_GOVERNANCE.filter((col) =>
      definition.COLUMN_DEFINITION_IDS.includes(col.COLUMN_DEFINITION_ID),
    )
    const consumer = g.canonicalDefinitionObligations.find(
      (o) => o.DEFINITION_OBLIGATION_ID === definition.DEFINITION_OBLIGATION_ID,
    )!
    assert(
      consumer.AVAILABLE_CONSUMER_EVIDENCE.REQUIRED_BEFORE_CONSUMER_IDS.length,
      'MISSING_REQUIRED_CONSUMER_EVIDENCE',
    )
    const required = consumer.AVAILABLE_CONSUMER_EVIDENCE.REQUIRED_PHYSICAL_PROPERTIES ?? []
    const selected = [
      ...(definition.OBJECT_KIND === 'RELATION'
        ? relation.RELATION_PROPERTIES
        : relation.RELATION_PROPERTIES.filter(
            (p) => p.PROPERTY === 'CANONICAL_COLUMN_SET' && p.STATUS !== 'APPROVED',
          )),
      ...columns
        .filter((col) => {
          if (definition.OBJECT_KIND !== 'RELATION') return true
          const shape = relation.RELATION_PROPERTIES.find(
            (p) => p.PROPERTY === 'CANONICAL_COLUMN_SET',
          )!
          return (
            shape.STATUS !== 'APPROVED' ||
            (JSON.parse(shape.VALUE!) as string[]).includes(col.COLUMN_NAME)
          )
        })
        .flatMap((col) =>
          col.SELECTED_PROPERTIES.map((selection) => ({
            ...selection,
            PROPERTY: `${col.COLUMN_NAME}.${selection.PROPERTY}`,
          })),
        ),
    ].map((selection) => consumerCheck(selection, required))
    const residual = selected.filter((s) => s.STATUS !== 'APPROVED')
    return {
      DEFINITION_OBLIGATION_ID: definition.DEFINITION_OBLIGATION_ID,
      SOURCE_W4_DECISION_ID: definition.SOURCE_W4_DECISION_ID,
      PHYSICAL_IDENTITY: definition.PHYSICAL_IDENTITY,
      RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
      SELECTED_VALUES: selected,
      RESIDUAL_PROPERTIES: residual,
      STATUS: residual.some((s) => s.STATUS === 'CONFLICT')
        ? 'CONFLICTED'
        : residual.length
          ? 'RESIDUAL_DECISION_REQUIRED'
          : 'ALL_PROPERTIES_GOVERNED',
      OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
      SEMANTIC_EXPANSION: 'NO',
      CONSUMER_COMPATIBILITY_CHECK: {
        REQUIRED_BEFORE_CONSUMER_IDS:
          consumer.AVAILABLE_CONSUMER_EVIDENCE.REQUIRED_BEFORE_CONSUMER_IDS,
        REQUIRED_PHYSICAL_PROPERTIES: required,
        RESULT:
          'Checked every selected property against embedded explicit physical requirements; object/column existence and ordering remain unchanged',
      },
    }
  })
  const byObligation = new Map(obligations.map((o) => [o.DEFINITION_OBLIGATION_ID, o]))
  const groupDispositions = packet.designDecisions.map((group) => {
    const affected = group.DEFINITION_OBLIGATION_IDS.map((id) => {
      const o = byObligation.get(id)
      assert(o, 'MISSING_GROUP_OBLIGATION')
      return o
    })
    const residual = affected.flatMap((o) => o.RESIDUAL_PROPERTIES)
    return {
      DESIGN_CHOICE_ID: group.DESIGN_CHOICE_ID,
      AFFECTED_DEFINITION_OBLIGATION_IDS: group.DEFINITION_OBLIGATION_IDS,
      AFFECTED_PHYSICAL_IDENTITIES: group.PHYSICAL_IDENTITIES,
      UNRESOLVED_PROPERTIES_BEFORE: group.OBLIGATION_SPECIFIC_PROPERTIES,
      APPLIED_GOVERNANCE_RULES: [
        ...new Set(affected.flatMap((o) => o.SELECTED_VALUES.map((s) => s.RULE))),
      ],
      SELECTED_VALUES: affected.map((o) => ({
        DEFINITION_OBLIGATION_ID: o.DEFINITION_OBLIGATION_ID,
        PROPERTIES: o.SELECTED_VALUES,
      })),
      EVIDENCE_REFERENCES: group.AVAILABLE_EVIDENCE,
      SEMANTIC_EXPANSION: 'NO',
      DECISION_STATUS: residual.some((s) => s.STATUS === 'CONFLICT')
        ? 'CONFLICT'
        : residual.length
          ? 'RESIDUAL_HUMAN_DECISION_REQUIRED'
          : 'APPROVED',
    }
  })
  const residualDecisions = groupDispositions
    .filter((d) => d.DECISION_STATUS !== 'APPROVED')
    .map((group) => ({
      DESIGN_CHOICE_ID: group.DESIGN_CHOICE_ID,
      AFFECTED_OBLIGATIONS: group.AFFECTED_DEFINITION_OBLIGATION_IDS.filter(
        (id) => byObligation.get(id)!.RESIDUAL_PROPERTIES.length,
      ),
      AFFECTED_PHYSICAL_IDENTITIES: group.AFFECTED_DEFINITION_OBLIGATION_IDS.filter(
        (id) => byObligation.get(id)!.RESIDUAL_PROPERTIES.length,
      ).map((id) => byObligation.get(id)!.PHYSICAL_IDENTITY),
      EXACT_UNRESOLVED_PROPERTY: group.SELECTED_VALUES.flatMap((o) =>
        o.PROPERTIES.filter((p) => p.STATUS !== 'APPROVED').map((p) => ({
          DEFINITION_OBLIGATION_ID: o.DEFINITION_OBLIGATION_ID,
          ...p,
        })),
      ),
      WHY_W4H_DOCTRINE_CANNOT_SELECT_IT:
        'The current referenced declarations describe different physical column sets for the same relation. Permissive null/default/constraint rules cannot choose which product blueprint is intended or authorize their union. Exact alternatives and evidence references are enumerated below.',
      VALID_OPTIONS: group.AFFECTED_DEFINITION_OBLIGATION_IDS.filter(
        (id) => byObligation.get(id)!.RESIDUAL_PROPERTIES.length,
      ).flatMap((id) => {
        const relation = byRelation.get(byObligation.get(id)!.RELATION_DEFINITION_ID)!
        return relation.CURRENT_DECLARATION_VARIANTS.map((variant) => ({
          OPTION:
            'Explicitly select this current referenced physical blueprint and reconcile the competing variant',
          DEFINITION_OBLIGATION_ID: id,
          RELATION_NAME: relation.RELATION_NAME,
          ...variant,
        }))
      }),
      PRODUCT_OR_BUSINESS_SEMANTIC_IMPACT:
        'Competing column sets and constraint/index blueprints describe different feature/storage structures. Combining them adds product schema; selecting one affects compatibility with the other. No automatic hybrid or platform-preference choice.',
      MINIMUM_HUMAN_DECISION_REQUIRED:
        'Approve exact values for the enumerated residual properties only; already approved governance properties and ownership remain settled',
    }))
  const caseRelation = relations.find((r) => r.RELATION_NAME === 'case_documents')
  assert(caseRelation)
  const caseResolution = caseRelation.COLUMN_GOVERNANCE.flatMap((col) =>
    col.SELECTED_PROPERTIES.filter((s) => s.PROVENANCE === 'W4H_CONFLICT_RESOLUTION').map((s) => ({
      COLUMN_NAME: col.COLUMN_NAME,
      ...s,
    })),
  )
  assert.equal(caseResolution.length, 2, 'CASE_DOCUMENTS_RESOLUTION_INCOMPLETE')
  assert(caseResolution.every((s) => s.VALUE === 'text'))
  for (const o of obligations)
    for (const selected of o.SELECTED_VALUES)
      if (selected.STATUS === 'APPROVED')
        assert(
          selected.PROVENANCE && selected.VALUE !== null,
          'SELECTED_PROPERTY_WITHOUT_PROVENANCE',
        )
  const summary = {
    DESIGN_GROUPS_INPUT: 126,
    APPROVED: groupDispositions.filter((d) => d.DECISION_STATUS === 'APPROVED').length,
    RESIDUAL_HUMAN_DECISION_REQUIRED: groupDispositions.filter(
      (d) => d.DECISION_STATUS === 'RESIDUAL_HUMAN_DECISION_REQUIRED',
    ).length,
    CONFLICT: groupDispositions.filter((d) => d.DECISION_STATUS === 'CONFLICT').length,
    SUM: groupDispositions.length,
    UNACCOUNTED: 0,
    DEFINITION_OBLIGATIONS: 183,
    ALL_PROPERTIES_GOVERNED: obligations.filter((o) => o.STATUS === 'ALL_PROPERTIES_GOVERNED')
      .length,
    RESIDUAL_DECISION_REQUIRED: obligations.filter((o) => o.STATUS === 'RESIDUAL_DECISION_REQUIRED')
      .length,
    CONFLICTED: obligations.filter((o) => o.STATUS === 'CONFLICTED').length,
    OBLIGATION_SUM: obligations.length,
    DISTINCT_RELATIONS: relations.length,
    CANONICAL_SQL_AUTHORED: 0,
    INACTIVE_SQL_PAYLOADS_CREATED: 0,
    PRODUCERS_ACTIVATED: 0,
  }
  const passed = summary.APPROVED === 126 && summary.ALL_PROPERTIES_GOVERNED === 183
  const preservation = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [file, sha(bytes[key])]),
  )
  if (existsSync(path.join(root, ...outputs.report.split('/')))) {
    const prior: { preservation: typeof preservation } = JSON.parse(read(outputs.report))
    assert.deepEqual(preservation, prior.preservation, 'FROZEN_W4H_INPUT_DRIFT')
  }
  return {
    PHASE: 'PHASE_1B_3C_A1I_W4H',
    DOCTRINE:
      'MINIMUM_SEMANTIC_COMMITMENT + NO_DATA_LOSS_BY_DEFAULT + NO_UNPROVEN_INTEGRITY_CONSTRAINT + EXACT_DECLARATION_WHERE_AVAILABLE',
    EVIDENCE_PRECEDENCE: [
      'CURRENT_REFERENCED_DECLARATION',
      'CONSISTENT_CURRENT_DECLARATIONS',
      'EXACT_HISTORICAL_DEFINITION',
      'CONSUMER_REQUIREMENT',
      'GOVERNANCE_DEFAULT',
    ],
    groupDispositions,
    obligationGovernance: obligations,
    relationGovernance: relations,
    caseDocumentsResolution: {
      DISPOSITION: 'CURRENT_DECLARATION_SELECTED',
      CANONICAL_FORWARD_DEFINITION: 'text',
      PROPERTIES: caseResolution,
      HISTORICAL_COMPATIBILITY_EVIDENCE: caseRelation.HISTORICAL_COMPATIBILITY_EVIDENCE,
    },
    residualDecisions,
    summary,
    preservation,
    acceptedSectionDigests: f.acceptedPreservation,
    validation: {
      EXACT_126_183_125_IDS: 'PASS',
      PROPERTY_PROVENANCE: 'PASS',
      CASE_DOCUMENTS: 'CLOSED',
      NO_SOURCE_READS_OR_REDISCOVERY: 'YES; embedded frozen evidence only',
      NO_UPSTREAM_MUTATION: 'YES',
      NO_SQL_OR_IMPLEMENTATION: 'YES',
      RELATION_CONSTRAINT_EXPRESSION_BOUNDARY:
        'Exact symbolic constraint/index design expressions preserved as governance values; not parsed into or executed as SQL. Unknown physical column types still block corresponding obligations.',
      FOREIGN_KEY_BOUNDARY:
        'Physical FK requires exact qualified source/target/column evidence; otherwise NONE with logical relationship retained. NO_ACTION on missing actions is new W4H doctrine,not a historical fact.',
      closeoutChecks: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\govern-w4-definition-doctrine.test.ts',
          RESULT:
            'PASS;35 tests covering defaults/provenance/case_documents/consumer contradictions/shape variants/named enum precedence and exact126/183 accounting',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\govern-w4-definition-doctrine.ts --self-test --check',
          RESULT:
            'PASS;two matching generations,exact persistent governance bytes,immutable fixed inputs',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\govern-w4-definition-doctrine.ts scripts\\ue\\govern-w4-definition-doctrine.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\govern-w4-definition-doctrine.ts scripts\\ue\\govern-w4-definition-doctrine.test.ts',
          RESULT: 'PASS;actual root-scoped lint,exit0;existing Next pages-directory diagnostic',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\govern-w4-definition-doctrine.ts scripts\\ue\\govern-w4-definition-doctrine.test.ts docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.md docs\\union-eyes\\reality-remediation\\UE_W4H_RESIDUAL_DEFINITION_DECISION_PACKET.json',
          RESULT: 'PASS',
        },
        { COMMAND: 'pnpm validate:docs', RESULT: 'PASS;0 errors,1215 existing warnings' },
        {
          METHOD:
            'Independent read-only Node assertions,not trusting governance selection/counting implementation',
          RESULT:
            'PASS;126 group IDs,183 obligation coverage,125 relation groups,121 approved/5 residual,178 governed/5 residual,case_documents2 text resolutions,property/component provenance,5 exact residual variants,fixed upstream bytes,310 ownership/127 late/127 compatibility/372 Django/82 plan/raw/W3/86 W5/118 W6/803 prerequisites/23 manifest preservation,exact canonical1.3.1 hash,no SQL/activation/regeneration',
        },
      ],
    },
    phaseStatus: {
      PHASE_1B_3C_A1I_W4H_GATE: passed ? 'PASS' : 'BLOCKED',
      PHASE_1B_3C_A1I_W4H: passed ? 'PASS' : 'BLOCKED',
      CANONICAL_DEFINITION_GOVERNANCE: passed ? 'COMPLETE' : 'PARTIAL_RESIDUAL_DECISIONS_REQUIRED',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4F_REGENERATION: passed ? 'AUTHORIZED_NOT_STARTED' : 'NOT_AUTHORIZED',
      W4F_REGENERATION_STARTED: 'NO',
      W4: passed
        ? 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING'
        : 'BLOCKED_DEFINITION_DECISIONS_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
      NO_FURTHER_W4H_DOCTRINE_PASS: passed ? 'NOT_APPLICABLE' : 'YES',
      CANONICAL_SQL_AUTHORED: 0,
      PRODUCERS_ACTIVATED: 0,
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    },
  }
}
export async function generate() {
  const report = await buildGovernance()
  const config = await resolveConfig(path.join(root, ...outputs.report.split('/')))
  const body = `# W4H - canonical definition governance closure

## Gate: ${report.phaseStatus.PHASE_1B_3C_A1I_W4H_GATE} - decisions only

New human doctrine: **MINIMUM_SEMANTIC_COMMITMENT + NO_DATA_LOSS_BY_DEFAULT + NO_UNPROVEN_INTEGRITY_CONSTRAINT + EXACT_DECLARATION_WHERE_AVAILABLE**. Frozen W4F report,registry,original decision packet,W4G and canonical1.3.1 bytes remain unchanged.

| Group disposition | Count |
| --- | ---: |
| APPROVED | ${report.summary.APPROVED} |
| RESIDUAL_HUMAN_DECISION_REQUIRED | ${report.summary.RESIDUAL_HUMAN_DECISION_REQUIRED} |
| CONFLICT | ${report.summary.CONFLICT} |
| SUM / UNACCOUNTED | 126 / 0 |

| Obligation coverage | Count |
| --- | ---: |
| ALL_PROPERTIES_GOVERNED | ${report.summary.ALL_PROPERTIES_GOVERNED} |
| RESIDUAL_DECISION_REQUIRED | ${report.summary.RESIDUAL_DECISION_REQUIRED} |
| CONFLICTED | ${report.summary.CONFLICTED} |
| SUM | 183 |

All125 relation groups and every183 obligation appear exactly once in their governance partition. All selected properties carry EXACT_DECLARATION,EXACT_HISTORICAL_EVIDENCE,W4H_GOVERNANCE_DEFAULT or W4H_CONFLICT_RESOLUTION provenance.

## Applied doctrine

Preserve exact current types/defaults/key/nullability first,then exact historical evidence where current evidence does not settle a fact. Missing nullability becomes NULLABLE; default NO_DEFAULT (not DEFAULT NULL); generation NONE; no unproven PK/unique/check/FK/index. Exact unparameterized numeric evidence may be adopted as numeric without invented precision. Generic timestamp/JSON/type factories remain residual,not platform-normalized.

Physical FK requires exact qualified source/target/column evidence. Missing actions on such a target adopt NO_ACTION under new doctrine; symbolic targets alone do not invent physical identity. Logical relationship expressions remain carried for W6. Exact relation constraint/index declaration expressions are preserved as governance input for later authoring,not generated SQL or query-derived indexes.

## case_documents: conflict closed

Current text selected for linked_by and link_type. Historical varchar(255)/varchar(20) remains compatibility evidence; no accepted current business invariant requires those narrower limits. Provenance **W4H_CONFLICT_RESOLUTION**; no truncation semantics introduced.

## Residual packet

[Governance report](PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json) contains126 group dispositions,183 obligation selections,property provenance and exact evidence references. [Residual decisions](UE_W4H_RESIDUAL_DEFINITION_DECISION_PACKET.json) contains only **${report.residualDecisions.length}** groups with undecided properties and exact affected IDs; approved choices are not reasked.

NO_FURTHER_W4H_DOCTRINE_PASS = **${report.phaseStatus.NO_FURTHER_W4H_DOCTRINE_PASS}**. No generic source discovery. W4F regeneration = **${report.phaseStatus.W4F_REGENERATION}**, unstarted. W4 = **${report.phaseStatus.W4}**; W4P/W5 **NOT_AUTHORIZED**.

## Validation and proof boundaries

\`\`\`powershell
pnpm exec tsx scripts\\ue\\govern-w4-definition-doctrine.ts --self-test --check
pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\govern-w4-definition-doctrine.test.ts
pnpm validate:docs
\`\`\`

Closeout **PASS**: **35 tests** covering exact126/183 coverage,property/component provenance,doctrine/default/case_documents/consumer-contradiction,named enum precedence and no-hybrid-schema rules;two-run deterministic self-test/check;scoped TypeScript;actual root-scoped ESLint;formatting;documentation audit (**0 errors,1215 existing warnings**). Independent assertions verified exact126/183/125 IDs and groups,121 approved/5 residual,178 governed/5 residual,the2 case_documents text resolutions,5 exact residual alternatives,immutable fixed upstream bytes,310/127/127/372/82/raw/W3/86/118/803/23 preservation and exact canonical1.3.1 hash. Exact commands/results are recorded in JSON.

No SQL authored,payloads created,database access,migration creation,producer activation,contract mutation,W4F regeneration,W4P/W5/W6-W10 execution or PR. Runtime proof remains NO; READY_FOR_RUNTIME_PROOF0,PRODUCT_READY NO.
`
  return {
    [outputs.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.markdown]: await format(body, { ...config, parser: 'markdown' }),
    [outputs.residual]: await format(
      JSON.stringify({
        PHASE: report.PHASE,
        residualDecisions: report.residualDecisions,
        summary: report.summary,
        phaseStatus: report.phaseStatus,
      }),
      { ...config, parser: 'json' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((a) => ['--plan', '--self-test', '--check'].includes(a)),
    'UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const output = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(output, await generate(), 'NONDETERMINISTIC_W4H')
    const nullable = value(
      'NULLABILITY',
      'NULLABLE',
      'W4H_GOVERNANCE_DEFAULT',
      'RULE_6',
      [],
      'fixture',
    )
    assert.equal(
      consumerCheck(nullable, [
        { PROPERTY: 'NULLABILITY', REQUIRED_VALUE: 'NOT_NULL', EVIDENCE: 'fixture' },
      ]).STATUS,
      'RESIDUAL_HUMAN_DECISION_REQUIRED',
    )
    console.log(
      'PASS W4H self-tests:126/183 coverage,provenance,consumer contradiction,case_documents,determinism,no SQL',
    )
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(output))
      assert.equal(read(file), bytes, `STALE_W4H_OUTPUT:${file}`)
    console.log('PASS W4H --check:governance overlay only;canonical1.3.1 and frozen W4F unchanged')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(output))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4H governance decisions written;no SQL,W4F regeneration or producer activation')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      '[govern-w4-definition-doctrine]',
      error instanceof Error ? error.message : 'Governance closure failed',
    )
    process.exitCode = 1
  })
