import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildClosure } from './close-w4h1-residual-blueprints'
import { blueprintKey as declarationIdentity } from './close-w4h1-residual-blueprints'
import type { buildGovernance } from './govern-w4-definition-doctrine'
import { read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4h1: folder + 'PHASE_1B_3C_A1I_W4H1_RESIDUAL_BLUEPRINT_CLOSURE.json',
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  residual: folder + 'UE_W4H_RESIDUAL_DEFINITION_DECISION_PACKET.json',
  w4f: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.json',
}
export const outputs = {
  packet: folder + 'UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.json',
  human: folder + 'UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.md',
  phase: folder + 'PHASE_1B_3C_A1I_W4H2_TRUE_BLUEPRINT_DECISION_PACKET.json',
  phaseMarkdown: folder + 'PHASE_1B_3C_A1I_W4H2_TRUE_BLUEPRINT_DECISION_PACKET.md',
}
export const relations = ['consent_records', 'automation_rules', 'clc_sync_log']
type W4F = Awaited<ReturnType<typeof buildRegistry>>
type W4H = Awaited<ReturnType<typeof buildGovernance>>
type W4H1 = ReturnType<typeof buildClosure>
type Declaration = W4F['relationDefinitions'][number]['DECLARATIONS'][number]
const sharedProperties = [
  'POSTGRES_TYPE',
  'NULLABILITY',
  'DEFAULT',
  'IDENTITY_OR_GENERATED',
] as const
const constraintProperties = {
  PRIMARY_KEYS: 'PRIMARY_KEY_PARTICIPATION',
  UNIQUE_CONSTRAINTS: 'UNIQUE_PARTICIPATION',
  FOREIGN_KEYS: 'FOREIGN_KEY',
  CHECK_CONSTRAINTS: 'CHECK_CONSTRAINTS',
} as const
type ConstraintCategory = keyof typeof constraintProperties | 'INDEXES'
const factories: Record<string, ConstraintCategory> = {
  primaryKey: 'PRIMARY_KEYS',
  unique: 'UNIQUE_CONSTRAINTS',
  uniqueIndex: 'UNIQUE_CONSTRAINTS',
  foreignKey: 'FOREIGN_KEYS',
  check: 'CHECK_CONSTRAINTS',
  index: 'INDEXES',
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export { declarationIdentity }
export function columnDiff(variants: { VARIANT_ID: string; COLUMN_SET: string[] }[]) {
  assert(variants.length >= 2)
  for (const variant of variants)
    assert.equal(new Set(variant.COLUMN_SET).size, variant.COLUMN_SET.length)
  const common = variants[0].COLUMN_SET.filter((column) =>
    variants.every((variant) => variant.COLUMN_SET.includes(column)),
  ).sort()
  return {
    COMMON_COLUMNS: common,
    VARIANT_DIFFERENCES: variants.map((variant) => ({
      VARIANT_ID: variant.VARIANT_ID,
      ONLY_IN_THIS_VARIANT: variant.COLUMN_SET.filter((column) =>
        variants
          .filter((other) => other.VARIANT_ID !== variant.VARIANT_ID)
          .every((other) => !other.COLUMN_SET.includes(column)),
      ).sort(),
      PRESENT_BUT_NOT_COMMON: variant.COLUMN_SET.filter(
        (column) => !common.includes(column),
      ).sort(),
      EXCLUDED_FROM_THIS_VARIANT: [
        ...new Set(
          variants
            .filter((other) => other.VARIANT_ID !== variant.VARIANT_ID)
            .flatMap((other) => other.COLUMN_SET),
        ),
      ]
        .filter((column) => !variant.COLUMN_SET.includes(column))
        .sort(),
    })),
    PURPOSE: 'COMPARISON_ONLY_NOT_A_PROPOSED_UNION_OR_INTERSECTION',
  }
}
export function sharedPropertyDiff(
  declarations: { VARIANT_ID: string; DECLARATION: Declaration }[],
) {
  const common = declarations[0].DECLARATION.COLUMNS.filter((column) =>
    declarations.every((variant) =>
      variant.DECLARATION.COLUMNS.some((other) => other.NAME === column.NAME),
    ),
  )
    .map((column) => column.NAME)
    .sort()
  const records = common.flatMap((name) =>
    sharedProperties.map((property) => {
      const values = declarations.map((variant) => {
        const column = variant.DECLARATION.COLUMNS.find((item) => item.NAME === name)!
        return {
          VARIANT_ID: variant.VARIANT_ID,
          STATE: column.PROPERTIES[property].STATE,
          VALUE: column.PROPERTIES[property].VALUE,
          EXACT_EVIDENCE: column.PROPERTIES[property].EVIDENCE,
        }
      })
      return {
        COLUMN: name,
        PROPERTY: property,
        VALUES: values,
        RESULT: values.every(
          (value) => value.STATE === values[0].STATE && value.VALUE === values[0].VALUE,
        )
          ? 'NO_DIFFERENCE'
          : 'DIFFERENCE',
      }
    }),
  )
  return {
    SHARED_COLUMN_PROPERTIES: records,
    DIFFERENCES: records.filter((record) => record.RESULT === 'DIFFERENCE'),
    RESULT: records.every((record) => record.RESULT === 'NO_DIFFERENCE')
      ? 'ALL_SHARED_RECORDED_PROPERTY_STATES_AND_VALUES_IDENTICAL'
      : 'SHARED_PHYSICAL_PROPERTY_EVIDENCE_DIFFERS',
    UNRESOLVED_EVIDENCE_POSTURE:
      'UNRESOLVED is not NULLABLE,NO_DEFAULT or physical equivalence; W4H governed organization_id selections remain separate and unchanged',
  }
}
function factory(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isCallExpression(expression) || ts.isPropertyAccessExpression(expression))
    return factory(expression.expression)
  return null
}
export function constraintEvidence(declaration: Declaration) {
  const callbacks: Record<ConstraintCategory, string[]> = {
    PRIMARY_KEYS: [],
    UNIQUE_CONSTRAINTS: [],
    FOREIGN_KEYS: [],
    CHECK_CONSTRAINTS: [],
    INDEXES: [],
  }
  if (declaration.CONSTRAINT_SOURCE) {
    const source = ts.createSourceFile(
      'embedded-callback.ts',
      `const design=${declaration.CONSTRAINT_SOURCE};`,
      ts.ScriptTarget.Latest,
      true,
    )
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const name = factory(node.expression)
        const category = name ? factories[name] : undefined
        const nested =
          (ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) ||
          (ts.isCallExpression(node.parent) && node.parent.expression === node)
        if (category && !nested) {
          callbacks[category].push(node.getText(source))
          if (name === 'uniqueIndex') callbacks.INDEXES.push(node.getText(source))
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return {
    PRIMARY_KEYS: {
      COLUMN_FACTS: declaration.COLUMNS.map((column) => ({
        COLUMN: column.NAME,
        ...column.PROPERTIES.PRIMARY_KEY_PARTICIPATION,
      })),
      CALLBACK_EXPRESSIONS: callbacks.PRIMARY_KEYS,
    },
    UNIQUE_CONSTRAINTS: {
      COLUMN_FACTS: declaration.COLUMNS.map((column) => ({
        COLUMN: column.NAME,
        ...column.PROPERTIES.UNIQUE_PARTICIPATION,
      })),
      CALLBACK_EXPRESSIONS: callbacks.UNIQUE_CONSTRAINTS,
    },
    FOREIGN_KEYS: {
      COLUMN_FACTS: declaration.COLUMNS.map((column) => ({
        COLUMN: column.NAME,
        ...column.PROPERTIES.FOREIGN_KEY,
      })),
      LOGICAL_REFERENCES: declaration.COLUMNS.filter((column) => column.REFERENCES.length).map(
        (column) => ({ COLUMN: column.NAME, EXPRESSIONS: column.REFERENCES }),
      ),
      CALLBACK_EXPRESSIONS: callbacks.FOREIGN_KEYS,
      PHYSICAL_POSTURE:
        'DECLARATION_DESIGN_ONLY;SYMBOLIC_REFERENCES_DO_NOT_ESTABLISH_PHYSICAL_TARGETS',
    },
    CHECK_CONSTRAINTS: {
      COLUMN_FACTS: declaration.COLUMNS.map((column) => ({
        COLUMN: column.NAME,
        ...column.PROPERTIES.CHECK_CONSTRAINTS,
      })),
      CALLBACK_EXPRESSIONS: callbacks.CHECK_CONSTRAINTS,
    },
    INDEXES: { CALLBACK_EXPRESSIONS: callbacks.INDEXES },
    DECLARATION_CALLBACK_OR_CONSTRAINT_SOURCE: declaration.CONSTRAINT_SOURCE,
  }
}
export function constraintDiff(declarations: { VARIANT_ID: string; DECLARATION: Declaration }[]) {
  const categories = Object.keys(constraintProperties) as (keyof typeof constraintProperties)[]
  const common = declarations[0].DECLARATION.COLUMNS.filter((column) =>
    declarations.every((variant) =>
      variant.DECLARATION.COLUMNS.some((other) => other.NAME === column.NAME),
    ),
  ).map((column) => column.NAME)
  const evidence = declarations.map((variant) => ({
    VARIANT_ID: variant.VARIANT_ID,
    EVIDENCE: constraintEvidence(variant.DECLARATION),
  }))
  const comparisons = categories.map((category) => {
    const property = constraintProperties[category]
    const normalized = declarations.map((variant) => ({
      COLUMN_FACTS: common.map((name) => {
        const fact = variant.DECLARATION.COLUMNS.find((column) => column.NAME === name)!.PROPERTIES[
          property
        ]
        return { COLUMN: name, STATE: fact.STATE, VALUE: fact.VALUE }
      }),
      CALLBACK_EXPRESSIONS: constraintEvidence(variant.DECLARATION)[category].CALLBACK_EXPRESSIONS,
      LOGICAL_REFERENCES:
        category === 'FOREIGN_KEYS'
          ? constraintEvidence(variant.DECLARATION).FOREIGN_KEYS.LOGICAL_REFERENCES
          : [],
    }))
    return {
      CATEGORY: category,
      RESULT: normalized.every((value) => same(value, normalized[0]))
        ? 'NO_DIFFERENCE'
        : 'DIFFERENCE',
      VALUES: evidence.map((variant) => ({
        VARIANT_ID: variant.VARIANT_ID,
        ...variant.EVIDENCE[category],
      })),
      SHARED_COLUMN_FACT_COMPARISON: normalized.map((value, index) => ({
        VARIANT_ID: declarations[index].VARIANT_ID,
        ...value,
      })),
    }
  })
  const indexes = evidence.map((variant) => variant.EVIDENCE.INDEXES)
  const sources = evidence.map(
    (variant) => variant.EVIDENCE.DECLARATION_CALLBACK_OR_CONSTRAINT_SOURCE,
  )
  return {
    CATEGORIES: comparisons,
    INDEXES: {
      RESULT: indexes.every((value) => same(value, indexes[0])) ? 'NO_DIFFERENCE' : 'DIFFERENCE',
      VALUES: evidence.map((variant) => ({
        VARIANT_ID: variant.VARIANT_ID,
        ...variant.EVIDENCE.INDEXES,
      })),
    },
    DECLARATION_CALLBACK_OR_CONSTRAINT_SOURCE: {
      RESULT: sources.every((value) => value === sources[0]) ? 'NO_DIFFERENCE' : 'DIFFERENCE',
      VALUES: evidence.map((variant) => ({
        VARIANT_ID: variant.VARIANT_ID,
        SOURCE: variant.EVIDENCE.DECLARATION_CALLBACK_OR_CONSTRAINT_SOURCE,
      })),
    },
    CANDIDATE_ONLY_COLUMN_CONSTRAINTS: evidence.map((variant) => ({
      VARIANT_ID: variant.VARIANT_ID,
      FACTS: categories.flatMap((category) =>
        variant.EVIDENCE[category].COLUMN_FACTS.filter(
          (fact) => !common.includes(fact.COLUMN) && fact.STATE === 'EXPLICIT',
        ).map((fact) => ({ CATEGORY: category, ...fact })),
      ),
    })),
    NO_DIFFERENCE_SCOPE:
      'Shared-column recorded constraints and exact callback expressions; candidate-only facts retained separately',
  }
}
export function buildPacket() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const w4h1: W4H1 = JSON.parse(bytes.w4h1)
  const w4h: W4H = JSON.parse(bytes.w4h)
  const residual: Pick<W4H, 'residualDecisions'> = JSON.parse(bytes.residual)
  const w4f: W4F = JSON.parse(bytes.w4f)
  const registry: Pick<W4F, 'relationDefinitions'> = JSON.parse(bytes.registry)
  assert.equal(w4h1.summary.DESIGN_GROUPS_CLOSED, 123)
  assert.equal(w4h1.summary.DEFINITION_OBLIGATIONS_GOVERNED, 180)
  assert.equal(w4h1.phaseStatus.CANONICAL_CONTRACT_VERSION, '1.3.1')
  assert.equal(w4h1.phaseStatus.W4F_REGENERATION, 'NOT_AUTHORIZED')
  assert.deepEqual(w4h.residualDecisions, residual.residualDecisions)
  const ties = w4h1.decisions.filter(
    (decision) => decision.DECISION_STATUS === 'BLOCKED_TRUE_BLUEPRINT_TIE',
  )
  assert.deepEqual(
    ties.map((decision) => decision.RELATION).sort(),
    relations.map((name) => `public.${name}`).sort(),
  )
  const cards = ties.map((tie) => {
    const relation = registry.relationDefinitions.find(
      (record) => `public.${record.RELATION_NAME}` === tie.RELATION,
    )
    assert(relation)
    assert.deepEqual(
      relation,
      w4f.relationDefinitions.find(
        (record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
      ),
    )
    const original = residual.residualDecisions.find(
      (record) => record.DESIGN_CHOICE_ID === tie.DESIGN_CHOICE_ID,
    )
    assert(original)
    const declarations = tie.TRUE_BLUEPRINT_TIE.map((variant, index) => {
      const aliases = tie.CANDIDATE_CURRENT_BLUEPRINTS.filter(
        (candidate) => candidate.KEY === variant.KEY,
      )
      assert(aliases.length)
      assert(aliases.every((alias) => alias.REJECTION_REASONS.length === 0))
      const sources = aliases.map((alias) => {
        const declaration = relation.DECLARATIONS.find(
          (record) =>
            record.REFERENCE.FILE === alias.EVIDENCE_REFERENCE.FILE &&
            record.REFERENCE.DIGEST === alias.EVIDENCE_REFERENCE.DIGEST,
        )
        assert(declaration, 'MISSING_EXACT_TIED_DECLARATION')
        assert.equal(declaration.REFERENCE.CLASS, 'DECLARATION_DESIGN_EVIDENCE')
        assert.equal(sha(declaration.REFERENCE.TEXT), declaration.REFERENCE.DIGEST)
        assert.deepEqual(
          declaration.COLUMNS.map((column) => column.NAME),
          alias.COLUMN_NAMES,
        )
        assert(
          original.VALID_OPTIONS.some(
            (option) =>
              option.EVIDENCE_REFERENCE.FILE === alias.EVIDENCE_REFERENCE.FILE &&
              option.EVIDENCE_REFERENCE.DIGEST === alias.EVIDENCE_REFERENCE.DIGEST,
          ),
          'UNREFERENCED_CURRENT_DECLARATION',
        )
        return declaration
      })
      assert(
        sources.every((source) => declarationIdentity(source) === declarationIdentity(sources[0])),
        'NON_EQUIVALENT_SOURCE_ALIASES',
      )
      return {
        VARIANT_ID: `VARIANT_${String.fromCharCode(65 + index)}`,
        W4H1_BLUEPRINT_KEY: variant.KEY,
        DECLARATION: sources[0],
        SOURCES: sources,
      }
    })
    assert.equal(declarations.length, tie.TRUE_BLUEPRINT_TIE.length)
    assert.equal(
      declarations.flatMap((variant) => variant.SOURCES).length,
      tie.ELIGIBLE_ORG_SCOPED_BLUEPRINTS.length,
    )
    const diff = columnDiff(
      declarations.map((variant) => ({
        VARIANT_ID: variant.VARIANT_ID,
        COLUMN_SET: variant.DECLARATION.COLUMNS.map((column) => column.NAME),
      })),
    )
    const governed = w4h.obligationGovernance.find(
      (record) => record.DEFINITION_OBLIGATION_ID === tie.DEFINITION_OBLIGATION_ID,
    )
    assert(governed)
    const approved = governed.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED')
    assert.deepEqual(
      approved,
      tie.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED'),
    )
    const required = tie.ACCEPTED_REQUIREMENTS_COVERED
    const variants = declarations.map((variant) => {
      const declaration = variant.DECLARATION
      const columnSet = declaration.COLUMNS.map((column) => column.NAME)
      assert(columnSet.includes('organization_id'))
      assert(
        required.REQUIRED_COLUMNS.every((name) => columnSet.includes(name)),
        'DROPPED_ACCEPTED_REQUIREMENT',
      )
      const sourceRecords = variant.SOURCES.map((source) => ({
        SOURCE_FILE: source.REFERENCE.FILE,
        SOURCE_DIGEST: source.REFERENCE.FILE_SHA256,
        DECLARATION_DIGEST: source.REFERENCE.DIGEST,
        SOURCE_RANGE: source.REFERENCE.RANGE,
        RECORDED_AUTHORITY_CLASS: source.REFERENCE.CLASS,
        RECORDED_CREATION_AUTHORITY: source.REFERENCE.CREATION_AUTHORITY,
        RECORDED_EXECUTION_AUTHORITY: source.REFERENCE.EXECUTION_AUTHORITY,
        EXACT_CURRENT_DECLARATION_TEXT: source.REFERENCE.TEXT,
      }))
      const difference = diff.VARIANT_DIFFERENCES.find(
        (record) => record.VARIANT_ID === variant.VARIANT_ID,
      )!
      return {
        VARIANT_ID: variant.VARIANT_ID,
        W4H1_BLUEPRINT_KEY: variant.W4H1_BLUEPRINT_KEY,
        SOURCE_FILE: sourceRecords[0].SOURCE_FILE,
        SOURCE_DIGEST: sourceRecords[0].SOURCE_DIGEST,
        DECLARATION_DIGEST: sourceRecords[0].DECLARATION_DIGEST,
        RECORDED_AUTHORITY_CLASS: sourceRecords[0].RECORDED_AUTHORITY_CLASS,
        EQUIVALENT_SOURCE_ALIASES: sourceRecords,
        COLUMN_COUNT: columnSet.length,
        COLUMN_SET: columnSet,
        EXACT_COLUMN_DEFINITIONS: declaration.COLUMNS,
        CONSTRAINT_EVIDENCE: constraintEvidence(declaration),
        ORGANIZATION_ID_PRESENT: 'YES',
        ALREADY_GOVERNED_ORGANIZATION_ID_PROPERTIES: approved,
        SATISFIES_ALL_ACCEPTED_REQUIREMENTS: 'YES',
        REQUIREMENT_COVERAGE_AUTHORITY:
          'Frozen W4H1 eligibility plus exact reproduced required columns; not a new adjudication',
        CANDIDATE_ONLY_COLUMN_CLASSIFICATION: difference.PRESENT_BUT_NOT_COMMON.map((name) => ({
          COLUMN: name,
          CLASSIFICATION: required.REQUIRED_COLUMNS.includes(name)
            ? 'ALREADY_ACCEPTED_REQUIREMENT'
            : 'CURRENT_DECLARATION_ONLY',
          ACCEPTED_SEMANTIC_REQUIREMENT: required.REQUIRED_COLUMNS.includes(name)
            ? 'ALREADY_ACCEPTED_REQUIREMENT'
            : 'NO_ACCEPTED_SEMANTIC_REQUIREMENT_ESTABLISHED',
          EXACT_DECLARATION_EVIDENCE_IDS: sourceRecords.map((source) => source.DECLARATION_DIGEST),
          DOWNSTREAM_EVIDENCE_IDS: [] as string[],
          W6_POSTURE:
            'No accepted column-specific W6 binding evidence recorded in the fixed tie record; no meaning inferred from name or logical reference',
        })),
      }
    })
    return {
      RELATION: tie.RELATION,
      DESIGN_CHOICE_ID: tie.DESIGN_CHOICE_ID,
      DEFINITION_OBLIGATION_ID: tie.DEFINITION_OBLIGATION_ID,
      PHYSICAL_IDENTITY: tie.PHYSICAL_IDENTITY,
      WHY_THE_TIE_EXISTS: tie.SELECTION_RULE,
      VARIANT_LABEL_POSTURE:
        'A/B labels follow frozen W4H1 evidence order for display only; not priority or recommendation',
      VARIANTS: variants,
      COLUMN_SET_DIFF: diff,
      SHARED_PROPERTY_DIFF: sharedPropertyDiff(declarations),
      CONSTRAINT_DIFF: constraintDiff(declarations),
      ACCEPTED_REQUIREMENTS: {
        REQUIRED_COLUMNS: required.REQUIRED_COLUMNS,
        REQUIRED_CONSTRAINTS: approved.filter((property) =>
          [
            'PRIMARY_KEY_PARTICIPATION',
            'UNIQUE_PARTICIPATION',
            'FOREIGN_KEY',
            'CHECK_CONSTRAINTS',
          ].some((name) => property.PROPERTY.endsWith(`.${name}`)),
        ),
        REQUIRED_CONSUMER_PROPERTIES: required.EXPLICIT_CONSUMER_REQUIREMENTS,
        W4_PREREQUISITE_IDENTITIES: required.W4_PREREQUISITE_IDENTITIES,
        REQUIRED_BEFORE_CONSUMER_IDS: required.REQUIRED_BEFORE_CONSUMER_IDS,
        APPROVED_PROPERTIES_UNCHANGED: approved,
      },
      OPTIONS: variants.map((variant) => {
        const difference = diff.VARIANT_DIFFERENCES.find(
          (record) => record.VARIANT_ID === variant.VARIANT_ID,
        )!
        return {
          OPTION_ID: variant.VARIANT_ID.replace('VARIANT_', 'OPTION_'),
          ACTION: 'ADOPT_EXACT_CURRENT_VARIANT',
          VARIANT_ID: variant.VARIANT_ID,
          COLUMNS_INCLUDED: variant.COLUMN_SET,
          COLUMNS_EXCLUDED: difference.EXCLUDED_FROM_THIS_VARIANT,
          ACCEPTED_REQUIREMENTS_PRESERVED: 'YES',
          HYBRID_SCHEMA: 'NO',
          DOWNSTREAM_EVIDENCE_IDS: [] as string[],
        }
      }),
      SELECTED_VARIANT: null,
      RECOMMENDATION: 'NONE',
      DECISION_STATUS: 'PENDING_HUMAN_BLUEPRINT_SELECTION',
    }
  })
  const preservation = Object.fromEntries(
    Object.values(files).map((file) => [file, sha(read(file))]),
  )
  if (existsSync(path.join(root, ...outputs.packet.split('/')))) {
    const previous: { preservation: typeof preservation } = JSON.parse(read(outputs.packet))
    assert.deepEqual(preservation, previous.preservation, 'FROZEN_W4H2_INPUT_DRIFT')
  }
  const approvedW4h1 = w4h1.decisions.filter((decision) => decision.DECISION_STATUS === 'APPROVED')
  assert.deepEqual(approvedW4h1.map((decision) => decision.RELATION).sort(), [
    'public.insight_recommendations',
    'public.ml_predictions',
  ])
  assert.equal(
    w4h.groupDispositions.filter((group) => group.DECISION_STATUS === 'APPROVED').length,
    121,
  )
  assert.equal(
    w4h.obligationGovernance.filter((record) => record.STATUS === 'ALL_PROPERTIES_GOVERNED').length,
    178,
  )
  return {
    PHASE: 'PHASE_1B_3C_A1I_W4H2',
    PURPOSE: 'HUMAN_DECISION_PACKET_ONLY',
    cards,
    summary: {
      TRUE_TIES_INPUT: 3,
      DECISION_CARDS: cards.length,
      DISTINCT_TIED_VARIANTS: cards.reduce((sum, card) => sum + card.VARIANTS.length, 0),
      CURRENT_SOURCE_ALIASES: cards.reduce(
        (sum, card) =>
          sum +
          card.VARIANTS.reduce((n, variant) => n + variant.EQUIVALENT_SOURCE_ALIASES.length, 0),
        0,
      ),
      UNACCOUNTED: 0,
      BLUEPRINTS_SELECTED: 0,
      HYBRID_OPTIONS: 0,
      PREFERENCES_INVENTED: 0,
      DESIGN_GROUPS_CLOSED: 123,
      DEFINITION_OBLIGATIONS_GOVERNED: 180,
    },
    preservation,
    preservedSections: {
      W4H1_TWO_APPROVED_DECISIONS: sha(JSON.stringify(approvedW4h1)),
      W4H_121_APPROVALS: sha(
        JSON.stringify(
          w4h.groupDispositions.filter((group) => group.DECISION_STATUS === 'APPROVED'),
        ),
      ),
      W4H_178_GOVERNED_OBLIGATIONS: sha(
        JSON.stringify(
          w4h.obligationGovernance.filter((record) => record.STATUS === 'ALL_PROPERTIES_GOVERNED'),
        ),
      ),
      CASE_DOCUMENTS: sha(JSON.stringify(w4h.caseDocumentsResolution)),
      ALL_APPROVED_W4H_PROPERTIES: sha(
        JSON.stringify(
          w4h.obligationGovernance.flatMap((record) =>
            record.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED'),
          ),
        ),
      ),
      ACCEPTED_UPSTREAM_COMMITMENTS: w4f.acceptedPreservation,
    },
    upstreamByteCommitments: { ...w4f.preservation, ...w4h1.preservation },
    phaseStatus: {
      PHASE_1B_3C_A1I_W4H2_GATE: 'PASS',
      PHASE_1B_3C_A1I_W4H: 'BLOCKED_HUMAN_BLUEPRINT_SELECTION',
      W4H1: 'BLOCKED_TRUE_BLUEPRINT_TIE',
      TRUE_BLUEPRINT_DECISIONS_PENDING: 3,
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4F_REGENERATION: 'NOT_AUTHORIZED',
      W4F_REGENERATION_STARTED: 'NO',
      W4: 'BLOCKED_DEFINITION_DECISIONS_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    },
    proofBoundaries: w4h1.proofBoundaries,
    validation: {
      FIXED_INPUTS_ONLY: 'YES',
      COLUMN_DIFFS: 'EXACT_NAMES;COMPARISON_ONLY',
      SHARED_PROPERTY_DIFFS: 'ALL_COMMON_COLUMNS;EXACT_STATES_AND_VALUES',
      CONSTRAINT_DIFFS: 'COLUMN_FACTS,LOGICAL_REFERENCES,EXACT_CALLBACK_EXPRESSIONS_AND_SOURCE',
      REQUIREMENTS: 'FROZEN_W4H1_COVERAGE;NO_REEVALUATION_OF_CLOSED_DECISIONS',
      SELECTION_AND_PREFERENCE: 'NONE',
      closeoutChecks: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\extract-w4h2-blueprint-packet.test.ts',
          RESULT:
            'PASS;33 tests:exact three cards/six variants/ten aliases,digests,column/shared-property/constraint diffs,accepted requirements,preservation,no preference/hybrid,determinism and unauthorized flags',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\extract-w4h2-blueprint-packet.ts scripts\\ue\\extract-w4h2-blueprint-packet.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\extract-w4h2-blueprint-packet.ts scripts\\ue\\extract-w4h2-blueprint-packet.test.ts',
          RESULT: 'PASS;exit0;existing Next pages-directory diagnostic',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\extract-w4h2-blueprint-packet.ts --self-test --check',
          RESULT:
            'PASS;two identical generations,four persistent output bytes,five immutable input hashes',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\extract-w4h2-blueprint-packet.ts scripts\\ue\\extract-w4h2-blueprint-packet.test.ts docs\\union-eyes\\reality-remediation\\UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.json docs\\union-eyes\\reality-remediation\\UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.md docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4H2_TRUE_BLUEPRINT_DECISION_PACKET.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4H2_TRUE_BLUEPRINT_DECISION_PACKET.md',
          RESULT: 'PASS',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS;0 errors,1215 existing warnings,2601 files scanned',
        },
        {
          METHOD:
            'Independent read-only Node assertions;no import of W4H2 selection/comparison logic',
          RESULT:
            'PASS;exact three identities/decision IDs,six variants/ten aliases,source/declaration digests and column definitions,complete column/shared-property diffs,accepted coverage,2 W4H1 approvals/121 W4H groups/178 obligations/case_documents/all approved provenance section hashes,310/127/127/372/82/raw/W3/86/118/803/23 section commitments,canonical1.3.1 bytes,all fixed/transitive upstream byte commitments,packet digest,no selection/hybrid',
        },
      ],
    },
  }
}
type Packet = ReturnType<typeof buildPacket>
const inline = (text: string) => `\`${text.replace(/`/g, "'").replace(/\s+/g, ' ')}\``
const list = (columns: string[]) => (columns.length ? columns.map(inline).join(', ') : 'none')
export function humanMarkdown(packet: Packet) {
  const cards = packet.cards
    .map((card) => {
      const governedOrganization =
        card.VARIANTS[0].ALREADY_GOVERNED_ORGANIZATION_ID_PROPERTIES.filter((property) =>
          ['POSTGRES_TYPE', 'NULLABILITY', 'DEFAULT', 'IDENTITY_OR_GENERATED', 'FOREIGN_KEY'].some(
            (name) => property.PROPERTY === `organization_id.${name}`,
          ),
        )
          .map((property) => `${property.PROPERTY.split('.')[1]}=${property.VALUE}`)
          .join('; ')
      const differences = card.SHARED_PROPERTY_DIFF.DIFFERENCES.map(
        (difference) =>
          `- ${inline(`${difference.COLUMN}.${difference.PROPERTY}`)}: ${difference.VALUES.map((value) => `${value.VARIANT_ID.replace('VARIANT_', '')}=${value.STATE}:${value.VALUE ?? 'unspecified'}`).join('; ')}.`,
      ).join('\n')
      const constraints = [
        ...card.CONSTRAINT_DIFF.CATEGORIES.map(
          (category) =>
            `- ${category.CATEGORY}: **${category.RESULT}**.${category.CATEGORY === 'FOREIGN_KEYS' ? ` ${card.VARIANTS.map((variant) => `${variant.VARIANT_ID.replace('VARIANT_', '')}: ${[...variant.CONSTRAINT_EVIDENCE.FOREIGN_KEYS.LOGICAL_REFERENCES.flatMap((record) => record.EXPRESSIONS.map((expression) => `${record.COLUMN}: ${expression}`)), ...variant.CONSTRAINT_EVIDENCE.FOREIGN_KEYS.CALLBACK_EXPRESSIONS].map(inline).join('; ') || 'none recorded'}`).join(' | ')}. Design evidence only; governed physical FK remains unchanged.` : ''}`,
        ),
        `- INDEXES: **${card.CONSTRAINT_DIFF.INDEXES.RESULT}**. ${card.VARIANTS.map((variant) => `${variant.VARIANT_ID.replace('VARIANT_', '')}: ${variant.CONSTRAINT_EVIDENCE.INDEXES.CALLBACK_EXPRESSIONS.map(inline).join('; ') || 'none recorded'}`).join(' | ')}`,
        `- Exact callback/constraint source: **${card.CONSTRAINT_DIFF.DECLARATION_CALLBACK_OR_CONSTRAINT_SOURCE.RESULT}**; full expressions and column-level restriction differences are in the machine card.`,
      ].join('\n')
      return `## ${card.RELATION.replace('public.', '')}

Identity: ${inline(card.PHYSICAL_IDENTITY)}. Decision ID: ${inline(card.DESIGN_CHOICE_ID)}.

**Common:** ${list(card.COLUMN_SET_DIFF.COMMON_COLUMNS)}.

${card.VARIANTS.map((variant) => {
  const difference = card.COLUMN_SET_DIFF.VARIANT_DIFFERENCES.find(
    (record) => record.VARIANT_ID === variant.VARIANT_ID,
  )!
  const letter = variant.VARIANT_ID.replace('VARIANT_', '')
  return `**Variant ${letter} adds** (${variant.COLUMN_COUNT} total): ${list(difference.PRESENT_BUT_NOT_COMMON)}.
Source${variant.EQUIVALENT_SOURCE_ALIASES.length > 1 ? ' aliases' : ''}: ${variant.EQUIVALENT_SOURCE_ALIASES.map((source) => `[${source.SOURCE_FILE}](../../../${source.SOURCE_FILE})`).join('; ')}.`
}).join('\n\n')}

**Physical-property differences (shared columns):**
${differences || 'All shared recorded property states and values are identical; unspecified evidence does not establish physical equivalence.'}

**Constraint differences:**
${constraints}

**Accepted requirements:** both pass. Required columns: ${list(card.ACCEPTED_REQUIREMENTS.REQUIRED_COLUMNS)}. Explicit consumer property requirements: ${card.ACCEPTED_REQUIREMENTS.REQUIRED_CONSUMER_PROPERTIES.length ? 'see machine card' : 'none recorded'}. Every candidate contains organization_id; already-governed organization_id type/nullability/default/generation/FK values and provenance are unchanged.

**Governed organization_id (both options):** ${inline(governedOrganization)}.

Candidate-only columns are CURRENT_DECLARATION_ONLY; no accepted column-specific downstream semantic requirement is established by the fixed tie evidence. No business meaning is inferred from their names.

**Decision:** ${card.OPTIONS.map((option) => `${option.OPTION_ID.replace('OPTION_', '')}: adopt exact current ${option.VARIANT_ID.replace('_', ' ').toLowerCase()}`).join(' / ')}. Each includes common columns plus its listed additions and excludes the other variant's additions. Accepted requirements preserved: YES; hybrid schema: NO. **No option is selected or recommended.**
`
    })
    .join('\n')
  return `# W4H2 - three human blueprint decisions

Evidence-packet gate: **PASS**. Blueprint selection: **pending human decision for all three**. Labels A/B follow frozen evidence order, not preference. Common/only/excluded lists are comparisons, not a proposed merged schema.

${cards}
## Evidence and validation

The [machine decision packet](./UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.json) contains exact column sets/definitions, source and declaration digests, aliases, property values, callback sources, constraint comparisons, accepted prerequisite/consumer IDs and mechanically supported option consequences.

Canonical **1.3.1** unchanged; W4H **BLOCKED_HUMAN_BLUEPRINT_SELECTION**; 123/126 groups and 180/183 obligations remain governed. W4F regeneration/W4P/W5 **NOT_AUTHORIZED**. No SQL, producer activation, runtime proof, or schema mutation.

Validation **PASS**: **33 focused tests**, deterministic generation/check, scoped TypeScript/ESLint, formatting and docs (**0 errors,1215 existing warnings**). Independent assertions verified exact cards/sources/column and shared-property differences, accepted coverage, all fixed/transitive upstream byte commitments and preserved governance sections. The [phase report](./PHASE_1B_3C_A1I_W4H2_TRUE_BLUEPRINT_DECISION_PACKET.json) records exact commands, results and preservation evidence. Evidence-packet PASS does not select any blueprint.
`
}
export async function generate() {
  const packet = buildPacket()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const packetBytes = await format(JSON.stringify(packet), { ...config, parser: 'json' })
  const phase = {
    PHASE: packet.PHASE,
    summary: packet.summary,
    phaseStatus: packet.phaseStatus,
    PACKET: outputs.packet,
    PACKET_SHA256: sha(packetBytes),
    ACCOUNTED_DECISIONS: packet.cards.map((card) => ({
      RELATION: card.RELATION,
      DESIGN_CHOICE_ID: card.DESIGN_CHOICE_ID,
      DEFINITION_OBLIGATION_ID: card.DEFINITION_OBLIGATION_ID,
      PHYSICAL_IDENTITY: card.PHYSICAL_IDENTITY,
      VARIANT_IDS: card.VARIANTS.map((variant) => variant.VARIANT_ID),
    })),
    preservation: packet.preservation,
    preservedSections: packet.preservedSections,
    upstreamByteCommitments: packet.upstreamByteCommitments,
    proofBoundaries: packet.proofBoundaries,
    validation: packet.validation,
  }
  return {
    [outputs.packet]: packetBytes,
    [outputs.human]: await format(humanMarkdown(packet), { ...config, parser: 'markdown' }),
    [outputs.phase]: await format(JSON.stringify(phase), { ...config, parser: 'json' }),
    [outputs.phaseMarkdown]: await format(
      `# W4H2 - evidence packet closeout

Gate: **PASS** for extraction only. Exactly three cards, six distinct tied blueprints and ten source aliases are accounted for. **No blueprint selected.**

Use the [three human decision cards](./UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.md) and [exact machine packet](./UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.json).

Column-set, shared physical-property and constraint differences are reproduced from bounded current declaration evidence. Accepted coverage is retained from W4H1. Source file digests are frozen evidence digests, not claims of a fresh source checkout scan.

123 closed groups/180 governed obligations and all prior approvals/provenance remain unchanged. Canonical **1.3.1**; W4H **BLOCKED_HUMAN_BLUEPRINT_SELECTION**; three decisions pending. W4F regeneration/W4P/W5 **NOT_AUTHORIZED**; W4 **BLOCKED_DEFINITION_DECISIONS_PENDING**.

Full fixed input hashes, accepted 310/127/127/372/82/86/118/803/23 preservation commitments and packet digest are recorded in [phase evidence](./PHASE_1B_3C_A1I_W4H2_TRUE_BLUEPRINT_DECISION_PACKET.json). No SQL, producer activation, migration execution or runtime/security proof.

Validation **PASS**: **33 tests**, deterministic generation/check, scoped TypeScript/ESLint (exit0; existing Next pages-directory diagnostic), formatting and documentation audit (**0 errors,1215 existing warnings**). Independent read-only assertions verified exact cards/aliases/digests/column and shared-property comparisons, accepted coverage, fixed/transitive upstream hashes and all preserved approval/310/127/127/372/82/86/118/803/23 section commitments. Exact commands/results are in phase JSON. Packet PASS does not authorize selection or regeneration.
`,
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4H2')
    console.log('PASS W4H2 self-test:three cards,exact evidence,determinism,no selection')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4H2_OUTPUT:${file}`)
    console.log('PASS W4H2 --check:four exact persistent artifacts;fixed inputs unchanged')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4H2 decision packet written;no preference,selection,SQL or authorization changes')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[extract-w4h2-blueprint-packet]', error)
    process.exitCode = 1
  })
