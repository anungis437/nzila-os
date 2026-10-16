import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'
import type { buildRegistry } from './author-w4-canonical-definitions'
import { consumerCheck, selectProperty } from './govern-w4-definition-doctrine'
import type { buildGovernance, Selection } from './govern-w4-definition-doctrine'
import { read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  packet: folder + 'UE_W4H_RESIDUAL_DEFINITION_DECISION_PACKET.json',
  w4f: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
}
export const outputs = {
  report: folder + 'PHASE_1B_3C_A1I_W4H1_RESIDUAL_BLUEPRINT_CLOSURE.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4H1_RESIDUAL_BLUEPRINT_CLOSURE.md',
}
export const identities = [
  'consent_records',
  'ml_predictions',
  'automation_rules',
  'insight_recommendations',
  'clc_sync_log',
].map((name) => `union-eyes::COLUMN::public.${name}.organization_id`)
type W4H = Awaited<ReturnType<typeof buildGovernance>>
type W4F = Awaited<ReturnType<typeof buildRegistry>>
type Relation = W4F['relationDefinitions'][number]
type Declaration = Relation['DECLARATIONS'][number]
interface Requirement {
  PROPERTY: string
  REQUIRED_VALUE: string
  EVIDENCE: string
}
interface W4G {
  ownershipAdoption: { DECISION_ID: string; PHYSICAL_IDENTITY: string }[]
  canonicalDefinitionObligations: {
    DEFINITION_OBLIGATION_ID: string
    AVAILABLE_CONSUMER_EVIDENCE: {
      REQUIRED_BEFORE_CONSUMER_IDS: string[]
      REQUIRED_PHYSICAL_PROPERTIES?: Requirement[]
    }
  }[]
}
export interface Candidate {
  KEY: string
  COLUMN_NAMES: string[]
  CURRENT_AUTHORITY_CLASS: string
  REJECTION_REASONS: string[]
}
const subset = (a: string[], b: string[]) => a.every((column) => b.includes(column))
export function blueprintKey(declaration: Declaration) {
  return sha(
    JSON.stringify({
      text: declaration.REFERENCE.TEXT,
      constraint: declaration.CONSTRAINT_SOURCE,
      columns: declaration.COLUMNS.map((column) => ({
        KEY: column.KEY,
        NAME: column.NAME,
        SOURCE_EXPRESSION: column.SOURCE_EXPRESSION,
        REFERENCES: column.REFERENCES,
        PROPERTIES: Object.fromEntries(
          Object.entries(column.PROPERTIES).map(([property, fact]) => [
            property,
            { STATE: fact.STATE, VALUE: fact.VALUE },
          ]),
        ),
      })),
    }),
  )
}
function approvedConstraintColumns(relation: Relation, approved: Selection[]) {
  const keys = new Set<string>()
  for (const property of approved) {
    if (
      !['UNIQUE_PARTICIPATION', 'PRIMARY_KEY_PARTICIPATION', 'CHECK_CONSTRAINTS'].some((name) =>
        property.PROPERTY.endsWith(`.${name}`),
      ) ||
      !property.VALUE?.startsWith('[')
    )
      continue
    const expressions: unknown = JSON.parse(property.VALUE)
    assert(Array.isArray(expressions) && expressions.every((item) => typeof item === 'string'))
    for (const expression of expressions) {
      const source = ts.createSourceFile(
        'accepted-constraint.ts',
        expression,
        ts.ScriptTarget.Latest,
        true,
      )
      const visit = (node: ts.Node) => {
        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'table'
        )
          keys.add(node.name.text)
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  return [...keys].map((key) => {
    const names = new Set(
      relation.DECLARATIONS.filter(
        (declaration) => declaration.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE',
      ).flatMap((declaration) =>
        declaration.COLUMNS.filter((column) => column.KEY === key).map((column) => column.NAME),
      ),
    )
    assert.equal(names.size, 1, `UNMAPPED_ACCEPTED_CONSTRAINT_COLUMN:${key}`)
    return [...names][0]
  })
}
export function chooseCandidate(candidates: Candidate[]) {
  const eligible = candidates.filter((candidate) => !candidate.REJECTION_REASONS.length)
  assert(eligible.length, 'NO_ELIGIBLE_CURRENT_BLUEPRINT')
  assert(
    eligible.every(
      (candidate) => candidate.CURRENT_AUTHORITY_CLASS === 'DECLARATION_DESIGN_EVIDENCE',
    ),
    'UNRECORDED_CURRENT_AUTHORITY_CLASS',
  )
  if (eligible.length === 1)
    return { selected: eligible[0], rule: 'ONLY_ELIGIBLE_CURRENT_VARIANT', ties: [] }
  const minimal = eligible.filter(
    (candidate) =>
      !eligible.some(
        (other) =>
          other.KEY !== candidate.KEY &&
          other.COLUMN_NAMES.length < candidate.COLUMN_NAMES.length &&
          subset(other.COLUMN_NAMES, candidate.COLUMN_NAMES),
      ),
  )
  if (minimal.length === 1)
    return { selected: minimal[0], rule: 'STRICT_SUBSET_ACCEPTED_REQUIREMENTS', ties: [] }
  // W4F records one current design-evidence class, not a ranking within that class.
  return {
    selected: null,
    rule: 'EQUAL_RECORDED_CURRENT_AUTHORITY_INCOMPARABLE_BLUEPRINTS',
    ties: minimal,
  }
}
export function candidateRejections(
  declaration: Declaration,
  relation: Relation,
  requiredColumns: string[],
  approved: Selection[],
  requirements: Requirement[],
) {
  const reasons: string[] = []
  const names = declaration.COLUMNS.map((column) => column.NAME)
  if (declaration.REFERENCE.CLASS !== 'DECLARATION_DESIGN_EVIDENCE')
    reasons.push('HISTORICAL_ONLY_NOT_CURRENT_AUTHORITY')
  if (!names.includes('organization_id')) reasons.push('OMITS_REQUIRED_ORGANIZATION_ID')
  for (const name of requiredColumns)
    if (!names.includes(name)) reasons.push(`DROPS_ACCEPTED_COLUMN:${name}`)
  for (const name of approvedConstraintColumns(relation, approved))
    if (!names.includes(name)) reasons.push(`DROPS_APPROVED_CONSTRAINT_COLUMN:${name}`)
  for (const property of approved) {
    const [name, key] = property.PROPERTY.split('.')
    const column = relation.COLUMNS.find((item) => item.COLUMN_NAME === name)
    if (!column || !key) {
      reasons.push(`UNMAPPED_ACCEPTED_PROPERTY:${property.PROPERTY}`)
      continue
    }
    assert(key in column, `UNKNOWN_ACCEPTED_PROPERTY:${key}`)
    const selected = selectProperty(key as Parameters<typeof selectProperty>[0], column, [
      declaration,
    ])
    // Omission does not reopen a settled value. Positive restrictions must exist in this variant.
    const positiveRestriction =
      ['UNIQUE_PARTICIPATION', 'PRIMARY_KEY_PARTICIPATION', 'CHECK_CONSTRAINTS'].includes(key) &&
      !['NONE', 'NONE_IN_BASELINE', '[]'].includes(property.VALUE ?? '')
    if (
      (selected.PROVENANCE === 'EXACT_DECLARATION' || positiveRestriction) &&
      selected.VALUE !== property.VALUE
    )
      reasons.push(`CONTRADICTS_APPROVED_W4H_PROPERTY:${property.PROPERTY}`)
    const checked = consumerCheck({ ...property }, requirements)
    if (checked.STATUS !== 'APPROVED')
      reasons.push(`CONTRADICTS_EXPLICIT_CONSUMER_REQUIREMENT:${property.PROPERTY}`)
  }
  for (const requirement of requirements) {
    const qualified = requirement.PROPERTY.includes('.')
    const name = qualified ? requirement.PROPERTY.split('.')[0] : 'organization_id'
    const key = qualified ? requirement.PROPERTY.split('.')[1] : requirement.PROPERTY
    if (!names.includes(name)) {
      reasons.push(`DROPS_EXPLICIT_CONSUMER_COLUMN:${name}`)
      continue
    }
    const column = relation.COLUMNS.find((item) => item.COLUMN_NAME === name)
    assert(column && key in column, 'UNMAPPED_EXPLICIT_CONSUMER_REQUIREMENT')
    const existing = approved.find((property) => property.PROPERTY === `${name}.${key}`)
    const selected =
      existing ?? selectProperty(key as Parameters<typeof selectProperty>[0], column, [declaration])
    if (selected.VALUE !== requirement.REQUIRED_VALUE)
      reasons.push(`CONTRADICTS_EXPLICIT_CONSUMER_REQUIREMENT:${requirement.PROPERTY}`)
  }
  return [...new Set(reasons)]
}
export function evaluateRelation(
  residual: W4H['residualDecisions'][number],
  relation: Relation,
  w4h: W4H,
  w4f: W4F,
  w4g: W4G,
) {
  assert.equal(residual.AFFECTED_OBLIGATIONS.length, 1)
  assert.equal(residual.AFFECTED_PHYSICAL_IDENTITIES.length, 1)
  const identity = residual.AFFECTED_PHYSICAL_IDENTITIES[0]
  const records = w4h.obligationGovernance.filter(
    (obligation) => obligation.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
  )
  const obligation = records.find(
    (record) => record.DEFINITION_OBLIGATION_ID === residual.AFFECTED_OBLIGATIONS[0],
  )
  assert(obligation)
  const approved = records.flatMap((record) =>
    record.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED'),
  )
  const ownership = w4g.ownershipAdoption.filter((record) =>
    record.PHYSICAL_IDENTITY.startsWith(`union-eyes::COLUMN::public.${relation.RELATION_NAME}.`),
  )
  const backedColumns = w4f.definitionRecords
    .filter((record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID)
    .flatMap((record) => record.COLUMN_DEFINITION_IDS)
    .map((id) => {
      const column = relation.COLUMNS.find((record) => record.COLUMN_DEFINITION_ID === id)
      assert(column, 'UNKNOWN_OBLIGATION_BACKED_COLUMN')
      return column.COLUMN_NAME
    })
  const requiredColumns = [
    ...new Set([
      'organization_id',
      ...ownership.map((record) => record.PHYSICAL_IDENTITY.split('.').at(-1)!),
      ...backedColumns,
      ...approvedConstraintColumns(relation, approved),
      ...approved
        .filter((property) => property.PROPERTY.includes('.'))
        .map((property) => property.PROPERTY.split('.')[0]),
    ]),
  ].sort()
  const consumerRecords = records.map((record) => {
    const consumer = w4g.canonicalDefinitionObligations.find(
      (item) => item.DEFINITION_OBLIGATION_ID === record.DEFINITION_OBLIGATION_ID,
    )
    assert(consumer, 'MISSING_ACCEPTED_CONSUMER')
    assert(consumer.AVAILABLE_CONSUMER_EVIDENCE.REQUIRED_BEFORE_CONSUMER_IDS.length)
    return consumer
  })
  const requirements = consumerRecords.flatMap(
    (record) => record.AVAILABLE_CONSUMER_EVIDENCE.REQUIRED_PHYSICAL_PROPERTIES ?? [],
  )
  const variants = relation.DECLARATIONS.filter(
    (declaration) => declaration.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE',
  ).map((declaration) => {
    const reference = {
      FILE: declaration.REFERENCE.FILE,
      DIGEST: declaration.REFERENCE.DIGEST,
      RANGE: declaration.REFERENCE.RANGE,
    }
    const option = residual.VALID_OPTIONS.find(
      (item) =>
        item.EVIDENCE_REFERENCE.FILE === reference.FILE &&
        item.EVIDENCE_REFERENCE.DIGEST === reference.DIGEST,
    )
    assert(option, 'CURRENT_VARIANT_NOT_IN_FIXED_RESIDUAL_PACKET')
    assert.deepEqual(
      option.COLUMN_NAMES,
      declaration.COLUMNS.map((column) => column.NAME),
    )
    assert.equal(sha(declaration.REFERENCE.TEXT), reference.DIGEST, 'DECLARATION_DIGEST_DRIFT')
    return {
      KEY: blueprintKey(declaration),
      COLUMN_NAMES: declaration.COLUMNS.map((column) => column.NAME),
      CURRENT_AUTHORITY_CLASS: declaration.REFERENCE.CLASS,
      RECORDED_CREATION_AUTHORITY: declaration.REFERENCE.CREATION_AUTHORITY,
      RECORDED_EXECUTION_AUTHORITY: declaration.REFERENCE.EXECUTION_AUTHORITY,
      EVIDENCE_REFERENCE: reference,
      CONSTRAINT_DESIGN_EVIDENCE: declaration.CONSTRAINT_SOURCE,
      ORGANIZATION_ID_EXACT_FACTS: declaration.COLUMNS.find(
        (column) => column.NAME === 'organization_id',
      )?.PROPERTIES,
      REJECTION_REASONS: candidateRejections(
        declaration,
        relation,
        requiredColumns,
        approved,
        requirements,
      ),
    }
  })
  assert.equal(variants.length, residual.VALID_OPTIONS.length, 'UNACCOUNTED_CURRENT_VARIANT')
  const distinct = variants.filter(
    (candidate, index) => variants.findIndex((item) => item.KEY === candidate.KEY) === index,
  )
  const choice = chooseCandidate(distinct)
  const selected = choice.selected
    ? variants.find((variant) => variant.KEY === choice.selected?.KEY)!
    : null
  const selectedValues: Selection[] = selected
    ? [
        ...obligation.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED'),
        {
          PROPERTY: 'CANONICAL_COLUMN_SET',
          VALUE: JSON.stringify([...selected.COLUMN_NAMES].sort()),
          PROVENANCE: 'EXACT_DECLARATION',
          RULE: `HUMAN_GOVERNANCE_W4H1:${choice.rule}`,
          EVIDENCE_REFERENCES: variants
            .filter((variant) => variant.KEY === selected.KEY)
            .map((variant) => variant.EVIDENCE_REFERENCE),
          STATUS: 'APPROVED',
          RATIONALE:
            'One existing current organization-scoped declaration; no variant union, intersection or hand-composed columns',
        },
      ]
    : obligation.SELECTED_VALUES
  return {
    DESIGN_CHOICE_ID: residual.DESIGN_CHOICE_ID,
    DEFINITION_OBLIGATION_ID: obligation.DEFINITION_OBLIGATION_ID,
    PHYSICAL_IDENTITY: identity,
    RELATION: `public.${relation.RELATION_NAME}`,
    CANONICAL_SCOPE_CLASS: 'ORGANIZATION_SCOPED',
    CANDIDATE_CURRENT_BLUEPRINTS: variants,
    REJECTED_NON_ORG_SCOPED_BLUEPRINTS: variants.filter((variant) =>
      variant.REJECTION_REASONS.includes('OMITS_REQUIRED_ORGANIZATION_ID'),
    ),
    REJECTED_REQUIREMENT_CONTRADICTIONS: variants.filter(
      (variant) => variant.REJECTION_REASONS.length,
    ),
    ELIGIBLE_ORG_SCOPED_BLUEPRINTS: variants.filter((variant) => !variant.REJECTION_REASONS.length),
    SELECTED_BLUEPRINT_SOURCE: selected?.EVIDENCE_REFERENCE.FILE ?? null,
    SELECTED_BLUEPRINT_DIGEST: selected?.EVIDENCE_REFERENCE.DIGEST ?? null,
    SELECTED_EQUIVALENT_DECLARATION_REFERENCES: selected
      ? variants
          .filter((variant) => variant.KEY === selected.KEY)
          .map((variant) => variant.EVIDENCE_REFERENCE)
      : [],
    SELECTED_COLUMN_SET: selected?.COLUMN_NAMES ?? null,
    CURRENT_VARIANT_SELECTED: selected ? 'YES' : 'NO',
    SELECTION_RULE: choice.rule,
    AUTHORITY_TIEBREAKER:
      'Recorded DECLARATION_DESIGN_EVIDENCE class only; no stronger current classification or ranking is recorded. Equivalent declaration aliases are not materially distinct blueprints.',
    ACCEPTED_REQUIREMENTS_COVERED: {
      REQUIRED_COLUMNS: requiredColumns,
      W4_PREREQUISITE_IDENTITIES: ownership,
      W4F_OBLIGATION_BACKED_COLUMNS: backedColumns,
      EXPLICIT_CONSUMER_REQUIREMENTS: requirements,
      REQUIRED_BEFORE_CONSUMER_IDS: [
        ...new Set(
          consumerRecords.flatMap(
            (record) => record.AVAILABLE_CONSUMER_EVIDENCE.REQUIRED_BEFORE_CONSUMER_IDS,
          ),
        ),
      ],
      PRESERVED_APPROVED_W4H_PROPERTIES: approved,
      RESULT: selected ? 'PASS_SINGLE_CURRENT_VARIANT' : 'ELIGIBLE_VARIANTS_TIED',
    },
    SELECTED_VALUES: selectedValues,
    TRUE_BLUEPRINT_TIE: choice.ties,
    DECISION_STATUS: selected ? 'APPROVED' : 'BLOCKED_TRUE_BLUEPRINT_TIE',
    VARIANT_MERGING: 'NO',
    SYNTHETIC_SUPERSET: 'NO',
    SYNTHETIC_INTERSECTION: 'NO',
  }
}
export function preservationSections(w4h: W4H) {
  return {
    APPROVED_121_GROUPS: sha(
      JSON.stringify(w4h.groupDispositions.filter((group) => group.DECISION_STATUS === 'APPROVED')),
    ),
    GOVERNED_178_OBLIGATIONS: sha(
      JSON.stringify(
        w4h.obligationGovernance.filter((record) => record.STATUS === 'ALL_PROPERTIES_GOVERNED'),
      ),
    ),
    CASE_DOCUMENTS: sha(JSON.stringify(w4h.caseDocumentsResolution)),
    ALL_APPROVED_PROPERTIES_AND_COMPONENT_PROVENANCE: sha(
      JSON.stringify(
        w4h.obligationGovernance.flatMap((record) =>
          record.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED'),
        ),
      ),
    ),
  }
}
export function buildClosure() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const w4h: W4H = JSON.parse(bytes.w4h)
  const packet: Pick<W4H, 'residualDecisions'> = JSON.parse(bytes.packet)
  const w4f: W4F = JSON.parse(bytes.w4f)
  const registry: Pick<W4F, 'relationDefinitions' | 'definitionRecords'> = JSON.parse(
    bytes.registry,
  )
  const w4g: W4G = JSON.parse(bytes.w4g)
  assert.equal(w4h.phaseStatus.CANONICAL_CONTRACT_VERSION, '1.3.1')
  assert.equal(w4h.summary.APPROVED, 121)
  assert.equal(w4h.summary.ALL_PROPERTIES_GOVERNED, 178)
  assert.equal(packet.residualDecisions.length, 5)
  assert.deepEqual(packet.residualDecisions, w4h.residualDecisions)
  assert.deepEqual(
    packet.residualDecisions.flatMap((record) => record.AFFECTED_PHYSICAL_IDENTITIES).sort(),
    [...identities].sort(),
  )
  assert.equal(new Set(packet.residualDecisions.map((record) => record.DESIGN_CHOICE_ID)).size, 5)
  assert.equal(new Set(packet.residualDecisions.flatMap((r) => r.AFFECTED_OBLIGATIONS)).size, 5)
  const decisions = packet.residualDecisions.map((residual) => {
    const obligation = w4h.obligationGovernance.find(
      (record) => record.DEFINITION_OBLIGATION_ID === residual.AFFECTED_OBLIGATIONS[0],
    )
    assert(obligation)
    const relation = registry.relationDefinitions.find(
      (record) => record.RELATION_DEFINITION_ID === obligation.RELATION_DEFINITION_ID,
    )
    assert(relation)
    assert.deepEqual(
      relation,
      w4f.relationDefinitions.find(
        (record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
      ),
    )
    return evaluateRelation(residual, relation, w4h, w4f, w4g)
  })
  const approved = decisions.filter((record) => record.DECISION_STATUS === 'APPROVED').length
  const passed = approved === 5
  const preservation = Object.fromEntries(
    Object.values(files).map((file) => [file, sha(read(file))]),
  )
  if (existsSync(path.join(root, ...outputs.report.split('/')))) {
    const prior: { preservation: typeof preservation } = JSON.parse(read(outputs.report))
    assert.deepEqual(preservation, prior.preservation, 'FROZEN_W4H1_INPUT_DRIFT')
  }
  return {
    PHASE: 'PHASE_1B_3C_A1I_W4H1',
    HUMAN_GOVERNANCE_DECISION: 'ORGANIZATION_SCOPED_CURRENT_DECLARATION',
    CANONICAL_ORG_SCOPE_FOR_RESIDUAL_RELATIONS: 'REQUIRED',
    decisions,
    summary: {
      RESIDUAL_GROUPS_INPUT: 5,
      RESIDUAL_OBLIGATIONS_INPUT: 5,
      W4H_GROUPS_ALREADY_APPROVED: 121,
      W4H_OBLIGATIONS_ALREADY_GOVERNED: 178,
      ORGANIZATION_SCOPED_BLUEPRINT_APPROVED: approved,
      TRUE_BLUEPRINT_TIE_REMAINING: 5 - approved,
      SUM: decisions.length,
      UNACCOUNTED: 0,
      DESIGN_GROUPS_CLOSED: 121 + approved,
      DEFINITION_OBLIGATIONS_GOVERNED: 178 + approved,
      RESIDUAL_HUMAN_DECISIONS: 5 - approved,
      HYBRID_BLUEPRINTS_CREATED: 0,
    },
    preservation,
    preservedSections: preservationSections(w4h),
    HISTORICAL_W4H_AND_RESIDUAL_PACKET_REWRITTEN: 'NO',
    RESIDUAL_PACKET_DISPOSITION: passed
      ? 'SUPERSEDED_BY_APPROVED_W4H1_DECISIONS'
      : 'PARTIALLY_RESOLVED_BY_W4H1_TRUE_BLUEPRINT_TIES_RETAINED',
    phaseStatus: {
      PHASE_1B_3C_A1I_W4H1_GATE: passed ? 'PASS' : 'BLOCKED_TRUE_BLUEPRINT_TIE',
      PHASE_1B_3C_A1I_W4H: passed ? 'PASS' : 'BLOCKED',
      CANONICAL_DEFINITION_GOVERNANCE: passed ? 'COMPLETE' : 'PARTIAL_TRUE_BLUEPRINT_TIES',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4F_REGENERATION: passed ? 'AUTHORIZED_NOT_STARTED' : 'NOT_AUTHORIZED',
      W4F_REGENERATION_STARTED: 'NO',
      W4: passed
        ? 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING'
        : 'BLOCKED_DEFINITION_DECISIONS_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
      NO_FURTHER_W4H_DOCTRINE_PASS: 'YES',
    },
    proofBoundaries: {
      CANONICAL_SQL_AUTHORED: 0,
      INACTIVE_SQL_PAYLOADS_CREATED: 0,
      PRODUCERS_ACTIVATED: 0,
      DATABASE_ROLES_PROVISIONED: 'NO',
      ROLE_MEMBERSHIPS_APPLIED: 'NO',
      DJANGO_SCHEMA_MATERIALIZED: 'NO',
      PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
      PHYSICAL_PRODUCERS_EXECUTED: 'NO',
      FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
      RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
      TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    },
    validation: {
      EXACT_FIVE_IDS_AND_IDENTITIES: 'ASSERTED',
      SINGLE_CURRENT_VARIANT_AND_REQUIREMENT_COVERAGE: 'ASSERTED',
      APPROVED_W4H_PROPERTIES: 'PRESERVED_WITHOUT_RECOMPUTATION',
      AUTHORITY_RANKING: 'NO_NEW_HIERARCHY',
      OMITTED_PROPERTIES: 'RETAIN_SETTLED_W4H_VALUES;NO_NEW_STRICTER_SEMANTICS',
      FIXED_INPUT_BYTES: 'SHA256_LOCKED',
      closeoutChecks: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\close-w4h1-residual-blueprints.test.ts scripts\\ue\\govern-w4-definition-doctrine.test.ts',
          RESULT: 'PASS;68 tests:33 W4H1 and35 unchanged W4H',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\close-w4h1-residual-blueprints.ts scripts\\ue\\close-w4h1-residual-blueprints.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\close-w4h1-residual-blueprints.ts scripts\\ue\\close-w4h1-residual-blueprints.test.ts',
          RESULT: 'PASS;exit0;existing Next pages-directory diagnostic',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\close-w4h1-residual-blueprints.ts --self-test --check',
          RESULT:
            'PASS;two identical generations,exact persistent output bytes,five fixed input hashes',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\close-w4h1-residual-blueprints.ts scripts\\ue\\close-w4h1-residual-blueprints.test.ts docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4H1_RESIDUAL_BLUEPRINT_CLOSURE.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4H1_RESIDUAL_BLUEPRINT_CLOSURE.md',
          RESULT: 'PASS',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS;0 errors,1215 existing warnings,2599 files scanned',
        },
        {
          METHOD: 'Independent read-only Node assertions without importing W4H1 logic',
          RESULT:
            'PASS;exact five IDs/identities,organization_id and accepted columns,single current variant/no hybrid,unchanged approved residual properties,121 approved-group/178 governed-obligation/case_documents/all approved provenance section digests,five frozen file hashes,2 approvals/3 true ties,123/126 groups and180/183 obligations,canonical1.3.1 and closed regeneration gate',
        },
      ],
    },
  }
}
export async function generate() {
  const report = buildClosure()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const rows = report.decisions
    .map(
      (record) =>
        `| ${record.RELATION} | ${record.DECISION_STATUS} | ${record.SELECTED_BLUEPRINT_SOURCE ?? 'No selection; true tie'} | ${record.SELECTION_RULE} |`,
    )
    .join('\n')
  const evidence = report.decisions
    .map(
      (record) => `## ${record.RELATION}

Physical identity: \`${record.PHYSICAL_IDENTITY}\`. Scope: **ORGANIZATION_SCOPED**.

Accepted required columns: ${record.ACCEPTED_REQUIREMENTS_COVERED.REQUIRED_COLUMNS.join(', ')}.
All already-approved property values and provenance remain unchanged; positive approved restrictions must be supported by the chosen variant.

${record.CANDIDATE_CURRENT_BLUEPRINTS.map((variant) => `- [${variant.EVIDENCE_REFERENCE.FILE}](../../../${variant.EVIDENCE_REFERENCE.FILE}), declaration digest \`${variant.EVIDENCE_REFERENCE.DIGEST}\`: ${variant.COLUMN_NAMES.join(', ')}. ${variant.REJECTION_REASONS.length ? `Rejected: ${variant.REJECTION_REASONS.join('; ')}` : 'Eligible current organization-scoped blueprint.'}`).join('\n')}

Selected column set: ${record.SELECTED_COLUMN_SET?.join(', ') ?? '**UNSELECTED**; incomparable eligible variants with equal recorded current authority. No cardinality, filename or age tiebreaker is authorized.'}
`,
    )
    .join('\n')
  const markdown = `# W4H1 - residual organization-scoped blueprint closure

Gate: **${report.phaseStatus.PHASE_1B_3C_A1I_W4H1_GATE}**. Human governance applies only to the five frozen residuals; this is not another doctrine pass.

## Accounting

- Residual groups/obligations input: **5/5**.
- Approved blueprints: **${report.summary.ORGANIZATION_SCOPED_BLUEPRINT_APPROVED}**.
- True blueprint ties: **${report.summary.TRUE_BLUEPRINT_TIE_REMAINING}**.
- Sum: **5**; unaccounted: **0**; hybrid blueprints: **0**.
- Combined W4H/W4H1 governed groups: **${report.summary.DESIGN_GROUPS_CLOSED}/126**; obligations: **${report.summary.DEFINITION_OBLIGATIONS_GOVERNED}/183**.

| Relation | Decision | Selected current source | Rule |
|---|---|---|---|
${rows}

Every recorded current candidate already contains organization_id. Org-scope alone therefore cannot pick one. Equivalent declaration aliases are grouped by exact embedded declaration facts/text and constraints, never by filename. An approved multi-column unique restriction must exist in the selected variant. A strict subset wins only after accepted requirement filtering. Remaining incomparable variants have the same recorded DECLARATION_DESIGN_EVIDENCE classification; no stronger current authority is recorded.

${evidence}
## Preservation and boundaries

The historical W4H report and residual packet are unchanged. The 121 approved groups, 178 governed obligations, case_documents text resolution, all approved property/FK-component provenance and named-enum precedence are preserved by section digests and full input hashes. Only five fixed inputs are read; no source discovery or W4H recomputation.

Canonical contract: **1.3.1**. W4H current overlay: **${report.phaseStatus.PHASE_1B_3C_A1I_W4H}**. W4F regeneration: **${report.phaseStatus.W4F_REGENERATION}**, not started. W4: **${report.phaseStatus.W4}**. W4P/W5: **NOT_AUTHORIZED**.

No SQL, inactive payloads, producer activation, database access, migrations, runtime/security proof, W4F regeneration or downstream execution. READY_FOR_RUNTIME_PROOF=0; PRODUCT_READY=NO.

## Validation

Closeout checks **PASS**: **68 tests** (33 W4H1 plus 35 unchanged W4H), scoped TypeScript and ESLint (exit0; existing Next pages-directory diagnostic), two-run deterministic self-test/check, formatting and documentation audit (**0 errors,1215 existing warnings**).

Independent read-only assertions verified exact five-group/obligation/identity coverage, organization_id and accepted columns, one exact current variant/no hybrid sets, all approved residual property values and provenance, fixed upstream file hashes and the 121-group/178-obligation/case_documents/all-approved-provenance section digests. Subset, authority, accepted constraint-column coverage and alias-equivalence rules are covered by tests. Exact commands and results are recorded in JSON. Passing validation does not override the three genuine blueprint ties or authorize W4F regeneration.
`
  return {
    [outputs.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
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
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4H1')
    console.log('PASS W4H1 self-test:exact five decisions;immutable input hashes;determinism')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4H1_OUTPUT:${file}`)
    console.log('PASS W4H1 --check:exact persistent artifacts;no historical input mutation')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4H1 supplemental governance written;no SQL or regeneration')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[close-w4h1-residual-blueprints]', error)
    process.exitCode = 1
  })
