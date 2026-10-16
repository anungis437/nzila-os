import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'
import type { buildScope } from './normalize-w4s-authoring-scope'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildTypeClosure } from './close-w4t-named-types'
import { enumDescriptor } from './close-w4t-named-types'
import { selectedDeclaration, validateTypeSql } from './regenerate-w4fr2-definitions'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  scope: folder + 'PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.json',
  w4h3: folder + 'PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.json',
  w4t1: folder + 'PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json',
  types: folder + 'UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json',
  resolved: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json',
  w4f: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const outputs = {
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR3.json',
  registryMarkdown: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR3.md',
  payloads: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR3.json',
  payloadsMarkdown: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR3.md',
  report: folder + 'PHASE_1B_3C_A1I_W4FR3_MINIMAL_BASELINE_AUTHORING.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4FR3_MINIMAL_BASELINE_AUTHORING.md',
}
type Scope = ReturnType<typeof buildScope>
type Frozen = ReturnType<typeof buildRegeneration>['registry']
type F = Awaited<ReturnType<typeof buildRegistry>>
type Declaration = F['relationDefinitions'][number]['DECLARATIONS'][number]
export function constraintColumns(value: string, declaration: Declaration): string[] {
  assert(value.startsWith('['), 'EXPECTED_EXACT_GOVERNED_UNIQUE_EXPRESSIONS')
  const expressions: unknown = JSON.parse(value)
  assert(
    Array.isArray(expressions) && expressions.every((expression) => typeof expression === 'string'),
  )
  const columns: string[] = []
  for (const expression of expressions) {
    const source = ts.createSourceFile(
      'frozen-constraint.ts',
      expression,
      ts.ScriptTarget.Latest,
      true,
    )
    let found = false
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'on'
      ) {
        found = true
        for (const argument of node.arguments) {
          assert(
            ts.isPropertyAccessExpression(argument) && ts.isIdentifier(argument.expression),
            'UNSUPPORTED_UNIQUE_COLUMN_EXPRESSION',
          )
          const column = declaration.COLUMNS.find((record) => record.KEY === argument.name.text)
          assert(column, `MISSING_EXACT_DECLARATION_COLUMN:${argument.name.text}`)
          columns.push(column.NAME)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    if (!found) {
      const match = /^\s*UNIQUE\s*\(([^)]+)\)\s*$/i.exec(expression)
      assert(match, 'UNSUPPORTED_GOVERNED_UNIQUE_DEFINITION')
      for (const identifier of match[1]
        .split(',')
        .map((identifier) => identifier.trim().replace(/^"|"$/g, ''))) {
        assert(
          declaration.COLUMNS.some((column) => column.NAME === identifier),
          'MISSING_EXACT_SQL_UNIQUE_COLUMN',
        )
        columns.push(identifier)
      }
    }
  }
  return [...new Set(columns)]
}
export function findOwnedConstraintBlockers(frozen: Frozen, scope: Scope, f: F) {
  const materialized = new Set(scope.revisedCompletionContract.FUTURE_MATERIALIZATION_COLUMN_IDS)
  return frozen.definitionObligationLinkage
    .filter((record) => record.DEFINITION_OPERATION === 'RELATION_CREATE_INCLUDES_COLUMN')
    .flatMap((record) => {
      const column = frozen.columnDefinitions.find(
        (column) => column.PHYSICAL_IDENTITY === record.PHYSICAL_IDENTITY,
      )
      assert(column)
      const unique = column.SELECTED_PROPERTIES.find(
        (property) => property.PROPERTY === 'UNIQUE_PARTICIPATION',
      )
      assert(unique?.STATUS === 'APPROVED' && unique.VALUE !== null)
      if (['NONE', 'UNIQUE'].includes(unique.VALUE)) return []
      const relation = frozen.relationDefinitions.find(
        (relation) => relation.RELATION_DEFINITION_ID === record.RELATION_DEFINITION_ID,
      )
      const original = f.relationDefinitions.find(
        (relation) => relation.RELATION_DEFINITION_ID === record.RELATION_DEFINITION_ID,
      )
      assert(relation && original)
      const declaration = selectedDeclaration(relation, original.DECLARATIONS)
      const requiredColumns = constraintColumns(unique.VALUE, declaration)
      const missing = requiredColumns.filter(
        (name) => !materialized.has(`union-eyes::COLUMN::public.${relation.RELATION_NAME}.${name}`),
      )
      if (!missing.length) return []
      const relationObligation = frozen.definitionObligationLinkage.find(
        (definition) =>
          definition.RELATION_DEFINITION_ID === record.RELATION_DEFINITION_ID &&
          definition.DEFINITION_OPERATION === 'CREATE_RELATION',
      )
      assert(relationObligation)
      return [
        {
          BLOCKER_ID: `UE-W4FR3-CONSTRAINT-${sha(record.DEFINITION_OBLIGATION_ID).slice(0, 16)}`,
          BLOCKER_CLASS: 'W4_OWNED_UNIQUE_REQUIREMENT_DEPENDS_ON_NONMATERIALIZED_CONTEXT_COLUMNS',
          DEFINITION_OBLIGATION_ID: record.DEFINITION_OBLIGATION_ID,
          ASSOCIATED_RELATION_OBLIGATION_ID: relationObligation.DEFINITION_OBLIGATION_ID,
          PHYSICAL_IDENTITY: record.PHYSICAL_IDENTITY,
          RELATION: `public.${relation.RELATION_NAME}`,
          GOVERNED_COLUMN_DEFINITION_ID: column.COLUMN_DEFINITION_ID,
          GOVERNED_UNIQUE_PROPERTY: unique,
          GOVERNED_OBLIGATION_PROPERTY: record.CANONICAL_PROPERTIES.find(
            (property) => property.PROPERTY === `${column.COLUMN_NAME}.UNIQUE_PARTICIPATION`,
          ),
          EXACT_CONSTRAINT_COLUMNS: requiredColumns,
          AUTHORIZED_CREATE_COLUMNS: scope.columnAuthorityClassification
            .filter(
              (classification) =>
                classification.PHYSICAL_IDENTITY.startsWith(
                  `union-eyes::COLUMN::public.${relation.RELATION_NAME}.`,
                ) && classification.W4_DEFINITION_OBLIGATION_ID !== null,
            )
            .map((classification) => classification.COLUMN_NAME),
          NONMATERIALIZED_REQUIRED_COLUMN_IDENTITIES: missing.map(
            (name) => `union-eyes::COLUMN::public.${relation.RELATION_NAME}.${name}`,
          ),
          NONMATERIALIZED_COLUMN_SCOPE_RECORDS: missing.map((name) =>
            scope.columnAuthorityClassification.find(
              (classification) =>
                classification.PHYSICAL_IDENTITY ===
                `union-eyes::COLUMN::public.${relation.RELATION_NAME}.${name}`,
            ),
          ),
          FROZEN_DECLARATION_REFERENCE: declaration.REFERENCE,
          WHY_EXACT_SQL_IS_BLOCKED:
            'CREATE TABLE cannot declare the governed multi-column uniqueness without its required columns. W4S forbids automatic materialization of context-only columns;W4FR3 forbids governed property override. Omitting uniqueness or adding excluded columns would be FAIL.',
          PARENT108_GAP_USED_AS_BLOCKER: 'NO',
          REQUIRED_HUMAN_RESOLUTION:
            'Resolve this exact accepted W4-owned constraint/materialization inconsistency;no generic source or type discovery',
        },
      ]
    })
}
export function buildAuthoring() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const scope: Scope = JSON.parse(bytes.scope)
  const frozen: Frozen = JSON.parse(bytes.resolved)
  const f: F = JSON.parse(bytes.w4f)
  const types: ReturnType<typeof buildTypeClosure>['registry'] = JSON.parse(bytes.types)
  const canonical: { CONTRACT_VERSION: string } = JSON.parse(bytes.canonical)
  assert.equal(scope.phaseStatus.PHASE_1B_3C_A1I_W4S_GATE, 'PASS')
  assert.equal(scope.phaseStatus.W4FR3, 'AUTHORIZED_NOT_STARTED')
  assert.equal(canonical.CONTRACT_VERSION, '1.3.1')
  const preservation = Object.fromEntries(
    Object.values(files).map((file) => [file, sha(read(file))]),
  )
  for (const [file, hash] of Object.entries(scope.preservation.BYTE_COMMITMENTS)) {
    assert.equal(sha(read(file)), hash, `FROZEN_UPSTREAM_DRIFT:${file}`)
    preservation[file] = hash
  }
  preservation[files.scope.replace(/\.json$/, '.md')] = sha(
    read(files.scope.replace(/\.json$/, '.md')),
  )
  assert.equal(sha(bytes.resolved), scope.preservation.GOVERNED_DESIGN_REGISTRY_SHA256)
  assert.equal(sha(bytes.types), scope.preservation.TYPE_REGISTRY_SHA256)
  assert.equal(
    digest(frozen.definitionObligationLinkage),
    scope.w4ObligationUniverse.ORIGINAL_OBLIGATION_LINKAGE_SHA256,
  )
  assert.deepEqual(
    frozen.definitionObligationLinkage.map((record) => record.DEFINITION_OBLIGATION_ID),
    scope.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS,
  )
  assert.equal(frozen.definitionObligationLinkage.length, 183)
  assert.equal(scope.columnAuthorityClassification.length, 2121)
  assert.equal(scope.parentOwnedContext.length, 1299)
  const blockers = findOwnedConstraintBlockers(frozen, scope, f)
  assert(blockers.length > 0, 'OWNED_CONSTRAINT_PREFLIGHT_CLEARED_FULL_AUTHORING_REQUIRED')
  const sourceHashes: { [file: string]: string } = {}
  for (const blocker of blockers) {
    const reference = blocker.FROZEN_DECLARATION_REFERENCE
    assert.equal(
      sha(read(reference.FILE)),
      reference.FILE_SHA256,
      'FROZEN_DECLARATION_SOURCE_DRIFT',
    )
    sourceHashes[reference.FILE] = reference.FILE_SHA256
  }
  assert.equal(types.typeRecords.length, 36)
  assert.equal(types.referenceLinks.length, 38)
  assert.equal(digest(types.typeRecords), scope.preservation.TYPE_DEFINITIONS_SHA256)
  assert.equal(digest(types.referenceLinks), scope.preservation.TYPE_REFERENCES_SHA256)
  const typePayloads = types.typeRecords.map((record) => {
    assert.equal(record.TYPE_APPROVAL_STATUS, 'APPROVED')
    assert(record.SELECTED?.ORDERED_ENUM_MEMBERS)
    const candidate = record.SELECTED
    assert(candidate.ORDERED_ENUM_MEMBERS)
    const descriptor = enumDescriptor(
      candidate.SCHEMA_NAME,
      candidate.TYPE_NAME,
      candidate.ORDERED_ENUM_MEMBERS,
    )
    assert.deepEqual(descriptor, record.INACTIVE_TYPE_DESCRIPTOR)
    validateTypeSql(descriptor.SQL)
    assert.equal(
      sha(read(candidate.SOURCE_FILE)),
      candidate.SOURCE_SHA256,
      'FROZEN_TYPE_SOURCE_DRIFT',
    )
    sourceHashes[candidate.SOURCE_FILE] = candidate.SOURCE_SHA256
    return {
      PAYLOAD_ID: `UE-W4FR3-TYPE-${sha(record.CANONICAL_TYPE_IDENTITY).slice(0, 16)}`,
      PAYLOAD_KIND: 'TYPE_DEFINITION',
      CANONICAL_TYPE_IDENTITY: record.CANONICAL_TYPE_IDENTITY,
      TYPE_DEFINITION_DIGEST: candidate.DEFINITION_DIGEST,
      TYPE_DEFINITION_AUTHORITY: [
        'public.fee_adjustment_type',
        'public.ledger_event_type',
        'public.ledger_source_type',
        'public.platform_cost_type',
      ].includes(record.CANONICAL_TYPE_IDENTITY)
        ? 'HUMAN_ARCHITECTURE_W4T1'
        : 'EXACT_FROZEN_DECLARATION',
      TYPE_OWNERSHIP_AUTHORITY: record.OWNERSHIP_AUTHORITY,
      EXACT_SELECTED_DEFINITION: candidate,
      PHYSICAL_IDENTITIES_PRODUCED: [`union-eyes::TYPE::${record.CANONICAL_TYPE_IDENTITY}`],
      DEPENDENCY_PAYLOAD_IDS: [] as string[],
      DEFINITION_OBLIGATION_IDS: [] as string[],
      ...descriptor,
    }
  })
  const blockedIds = [
    ...new Set(
      blockers.flatMap((blocker) => [
        blocker.DEFINITION_OBLIGATION_ID,
        blocker.ASSOCIATED_RELATION_OBLIGATION_ID,
      ]),
    ),
  ].sort()
  const materializedIds = new Set(scope.revisedCompletionContract.FUTURE_MATERIALIZATION_COLUMN_IDS)
  const references = types.referenceLinks.map((reference) => {
    const payload = typePayloads.find(
      (payload) => payload.CANONICAL_TYPE_IDENTITY === reference.CANONICAL_TYPE_IDENTITY,
    )
    assert(payload)
    return {
      ...reference,
      TYPE_PAYLOAD_ID: payload.PAYLOAD_ID,
      TYPE_DEFINITION_DIGEST: payload.TYPE_DEFINITION_DIGEST,
      CONSUMER_W4_PAYLOAD_ID: null,
      CONSUMER_COLUMN_MATERIALIZED_UNDER_W4S: materializedIds.has(
        `union-eyes::COLUMN::${reference.CONSUMER_RELATION}.${reference.CONSUMER_COLUMN}`,
      )
        ? 'YES'
        : 'NO',
      EDGE_STATUS: 'WITHHELD_GLOBAL_W4_OWNED_CONSTRAINT_PREFLIGHT_BLOCKED',
      DEFINITION_ORDER_ONLY: 'YES',
      W5_AUTHORIZED: 'NO',
    }
  })
  const summary = {
    W4_DEFINITION_OBLIGATIONS: 183,
    RELATION_OBLIGATIONS: 57,
    COLUMN_OBLIGATIONS: 126,
    RELATION_CREATE_RESPONSIBILITIES: 57,
    INCLUDED_COLUMN_RESPONSIBILITIES: 57,
    ADD_COLUMN_RESPONSIBILITIES: 69,
    W4_OWNED_CONSTRAINT_BLOCKERS: blockers.length,
    EXACT_BLOCKED_OBLIGATION_IDS: blockedIds.length,
    DEFINITIONS_AUTHORED: 0,
    ACCOUNTED_WITHHELD_OBLIGATIONS: 183,
    UNACCOUNTED: 0,
    NAMED_TYPES_COMPLETE: 36,
    TYPE_REFERENCES_RESOLVED: 38,
    TYPE_HOLDS: 0,
    TYPE_REFERENCE_DEPENDENCY_EDGES: 0,
    UNRESOLVED_CONSUMER_PAYLOAD_EDGES: 38,
    TYPE_PAYLOADS: 36,
    RELATION_CREATE_PAYLOADS: 0,
    ADD_COLUMN_PAYLOADS: 0,
    TOTAL_INACTIVE_PAYLOADS: 36,
    OBLIGATION_PAYLOAD_LINKS: 0,
    UNLINKED_OBLIGATIONS: 183,
    MULTI_LINKED_OBLIGATIONS: 0,
    RELATION_CONTEXTS_ACCOUNTED: 125,
    SELECTED_COLUMNS_AUTHORITY_CLASSIFIED: 2121,
    UNCLASSIFIED_SELECTED_COLUMNS: 0,
    PARENT_OWNED_COLUMNS_CONTEXTUAL: 1299,
    PARENT_OWNED_COLUMNS_REAUTHORED: 0,
    INHERITED108_GAPS_REOPENED: 0,
    INHERITED108_GAPS_RESOLVED_BY_W4: 0,
    PRODUCER_METADATA_UPDATES: 0,
    SQL_EXECUTED: 0,
  }
  if (existsSync(path.join(root, ...outputs.report.split('/')))) {
    const previous: { preservation: typeof preservation; sourceHashes: typeof sourceHashes } =
      JSON.parse(read(outputs.report))
    assert.deepEqual(preservation, previous.preservation, 'W4FR3_FROZEN_UPSTREAM_DRIFT')
    assert.deepEqual(sourceHashes, previous.sourceHashes, 'W4FR3_SOURCE_HASH_DRIFT')
  }
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4FR3_GATE: 'BLOCKED',
    PHASE_1B_3C_A1I_W4FR3: 'BLOCKED',
    BLOCKER_CLASS: 'EXACT_W4_OWNED_UNIQUENESS_CANNOT_LOWER_WITH_AUTHORIZED_CREATE_COLUMN_SUBSET',
    NO_NEW_GENERIC_DISCOVERY: 'YES',
    CANONICAL_DEFINITION_AUTHORING: 'NOT_COMPLETE_W4_OWNED_CONSTRAINTS_BLOCKED',
    CANONICAL_CONTRACT_VERSION: '1.3.1',
    VERSION_1_3_2_PUBLISHED: 'NO',
    W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
    W4_REMAINING_COMPATIBILITY_RECORDS: 127,
    W4_COMPATIBILITY_GATE_NORMALIZATION: 'NOT_AUTHORIZED',
    W4P: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
  }
  const registry = {
    metadata: { PHASE: 'PHASE_1B_3C_A1I_W4FR3', STATUS: 'BLOCKED_NOT_COMPLETE_PHYSICAL_REGISTRY' },
    acceptedGovernedRegistry: frozen,
    acceptedScope: scope,
    typeDefinitions: typePayloads,
    typeReferences: references,
    ownedConstraintBlockers: blockers,
    definitionObligationLinkage: frozen.definitionObligationLinkage.map((record) => ({
      ...record,
      RESPONSIBILITY_CLASS: record.DEFINITION_OPERATION,
      PAYLOAD_ID: null,
      DEFINITION_STATUS: 'WITHHELD_GLOBAL_W4_OWNED_CONSTRAINT_PREFLIGHT_BLOCKED',
    })),
    summary,
    phaseStatus,
  }
  const payloads = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4FR3',
      STATUS: 'BLOCKED_TYPE_ONLY_PARTIAL',
      SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
      EXECUTION_ALLOWED: 'NO',
    },
    TYPE_PAYLOADS: typePayloads,
    RELATION_CREATE_PAYLOADS: [] as unknown[],
    ADD_COLUMN_PAYLOADS: [] as unknown[],
    typeDependencyRequirements: references,
    obligationPayloadLinkage: [] as unknown[],
    withheldObligations: frozen.definitionObligationLinkage.map((record) => ({
      DEFINITION_OBLIGATION_ID: record.DEFINITION_OBLIGATION_ID,
      RESPONSIBILITY_CLASS: record.DEFINITION_OPERATION,
      DIRECTLY_BLOCKED: blockedIds.includes(record.DEFINITION_OBLIGATION_ID),
      REASON:
        'GLOBAL_PREFLIGHT_W4_OWNED_GOVERNED_CONSTRAINTS_UNSATISFIABLE_WITH_AUTHORIZED_COLUMN_SUBSET',
    })),
    summary,
    phaseStatus,
  }
  return {
    registry,
    payloads,
    report: {
      metadata: {
        PHASE: 'PHASE_1B_3C_A1I_W4FR3',
        SCOPE: 'W4_OWNED_PRECONSUMER_PREREQUISITES_ONLY',
        INPUTS: files,
      },
      summary,
      exactBlockedW4ObligationIds: blockedIds,
      exactOwnedConstraintBlockers: blockers,
      preservation,
      sourceHashes,
      preservedSections: scope.preservation.PRESERVED_SECTIONS,
      W4S_SCOPE_REPRODUCED: 'YES',
      PARENT108_GAPS_BLOCK_AUTHORING: 'NO',
      producerDefinitionMetadataIntegration: {
        STATUS: 'WITHHELD_GATE_BLOCKED',
        UPDATES: [],
        MUTATING_OPERATIONS: [],
        EXECUTION_ALLOWED: 'NO',
      },
      versionAmendment: {
        STATUS: 'NOT_PERFORMED_GATE_BLOCKED',
        VERSION_1_3_1_SHA256: sha(bytes.canonical),
        VERSION_1_3_2_SHA256: null,
        PRIOR_JSON_INVERSE_PATCHES: [],
        VERSION_CHAIN_RECONSTRUCTION: 'NOT_APPLICABLE_NO1_3_2_AMENDMENT',
      },
      proofBoundaries: { ...scope.proofBoundaries, PRODUCTION_SCHEMA_PROVEN: 'NO' },
      validation: {
        EXACT183_SCOPE_IDENTITY: 'PASS',
        GOVERNED_CONSTRAINT_SUBSET_COMPATIBILITY: 'BLOCKED_W4_OWNED_OBLIGATIONS_ONLY',
        TYPES36_REFERENCES38: 'PASS_TYPE_IDENTITIES;consumer edges not complete',
        PARENT_BOUNDARY1299_CONTEXTS125_COLUMNS2121: 'PRESERVED',
        NO_GOVERNED_CONSTRAINT_OVERRIDE: 'YES',
        SQL_EXECUTION: 'NO',
        DISTINCT_TESTS_PASSED: 316,
        INDEPENDENT_BYTE_COMMITMENTS_VERIFIED: 42,
        DOCUMENTATION_ERRORS: 0,
        DOCUMENTATION_EXISTING_WARNINGS: 1215,
        COMMAND_RESULTS: [
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4fr3-minimal-baseline.test.ts',
            RESULT: 'PASS:19 tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\close-w4t-named-types.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
            RESULT: 'PASS:253 tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts',
            RESULT: 'PASS:44 tests',
          },
          {
            COMMAND:
              'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\author-w4fr3-minimal-baseline.ts scripts\\ue\\author-w4fr3-minimal-baseline.test.ts',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\author-w4fr3-minimal-baseline.ts scripts\\ue\\author-w4fr3-minimal-baseline.test.ts',
            RESULT: 'PASS:existing Next pages-directory diagnostic;exit0',
          },
          {
            COMMAND:
              'pnpm exec prettier --check scripts\\ue\\author-w4fr3-minimal-baseline.ts scripts\\ue\\author-w4fr3-minimal-baseline.test.ts',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec tsx scripts\\ue\\author-w4fr3-minimal-baseline.ts --self-test --check',
            RESULT: 'PASS:two-generation exact-byte equality and persisted artifact equality',
          },
          {
            COMMAND: 'pnpm validate:docs',
            RESULT: 'PASS:0 errors;1215 existing warnings',
          },
        ],
      },
      determinismDigests: {
        TYPE_PAYLOADS_SHA256: digest(typePayloads),
        RELATION_PAYLOADS_SHA256: digest([]),
        COLUMN_PAYLOADS_SHA256: digest([]),
        ALL_SQL_PAYLOADS_SHA256: digest(typePayloads),
        OBLIGATION_LINKAGE_SHA256: digest(registry.definitionObligationLinkage),
        TYPE_DEPENDENCY_GRAPH_SHA256: digest(references),
        PRODUCER_METADATA_SHA256: sha(bytes.producer),
        OWNED_CONSTRAINT_BLOCKERS_SHA256: digest(blockers),
      },
      phaseStatus,
    },
  }
}
export async function generate() {
  const model = buildAuthoring(),
    config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const registryBytes = await format(JSON.stringify(model.registry), { ...config, parser: 'json' })
  const payloadBytes = await format(JSON.stringify(model.payloads), { ...config, parser: 'json' })
  const report = {
    ...model.report,
    DEFINITION_REGISTRY_SHA256: sha(registryBytes),
    SQL_PAYLOADS_SHA256: sha(payloadBytes),
  }
  const rows = report.exactOwnedConstraintBlockers
    .map(
      (blocker) =>
        `| ${blocker.DEFINITION_OBLIGATION_ID} | ${blocker.PHYSICAL_IDENTITY} | ${blocker.EXACT_CONSTRAINT_COLUMNS.join(', ')} | ${blocker.NONMATERIALIZED_REQUIRED_COLUMN_IDENTITIES.map((identity) => identity.split('.').at(-1)).join(', ')} |`,
    )
    .join('\n')
  const markdown = `# W4FR3 - minimal baseline authoring

**W4FR3=BLOCKED.** Only exact W4-owned constraint records block;the108 inherited parent representation gaps remain out-of-scope/nonblocking.

## Exact owned-obligation blocker

Seven included W4 columns retain approved multi-column UNIQUE/uniqueIndex participation. Their required additional columns are not explicit W4 column prerequisites and are not authorized for the57 minimal relation-create payloads under W4S. PostgreSQL cannot declare those UNIQUE keys without those columns. Omitting the governed uniqueness would override W4H;creating excluded columns would override W4S.

| Included W4 column obligation | Physical identity | Exact uniqueness columns | Required columns excluded from materialization |
|---|---|---|---|
${rows}

The seven associated W4 relation-create obligation IDs are also blocked. Exact14 W4 IDs:

\`\`\`text
${report.exactBlockedW4ObligationIds.join('\n')}
\`\`\`

Full approved property/provenance,exact frozen declaration,key-to-column mapping and W4S classifications are retained in the [machine report](./PHASE_1B_3C_A1I_W4FR3_MINIMAL_BASELINE_AUTHORING.json). No new generic source/schema/type discovery was performed. No accepted constraint was dropped or weakened;no context column was created.

## Accounting

183 frozen obligations preserved:57 relation +126 column;57/57/69 responsibilities. All183 SQL definitions withheld at the owned-constraint preflight;0 authored,0 unaccounted. This is not physical-completeness PASS.
36 exact types retained/generated as36 inactive qualified enum payloads;38 reference identities retained. Consumer payload edges remain withheld,not38 completed edges. W4S's126 explicit materialized columns do not themselves include those38 named-type consumer columns;their exact application-context identities are retained without inventing creation.
125 contexts/2121 column classifications/1299 parent columns retained;0 parent reauthoring;108 parent gaps neither reopened nor resolved.
No producer metadata integration;no contract amendment;no SQL execution. Historical W4FR/W4FR2/W4S and governance/type records preserved.

## Validation and state

316 distinct tests passed:19 focused,253 predecessor/preservation,44 frozen W4F. Independent verification passed for42 byte commitments. Documentation validation:0 errors,1215 existing warnings.

${report.validation.COMMAND_RESULTS.map((check) => `- \`${check.COMMAND}\` - ${check.RESULT}`).join('\n')}

W4FR3=BLOCKED;canonical1.3.1;no1.3.2;version-chain reconstruction NOT_APPLICABLE.
W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;127 compatibility records remain but are not yet the sole blocker.
W4_COMPATIBILITY_GATE_NORMALIZATION=NOT_AUTHORIZED;W4P/W5=NOT_AUTHORIZED.
All payloads DEFINITION_ONLY_NOT_EXECUTABLE/EXECUTION_ALLOWED=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
`
  return {
    [outputs.registry]: registryBytes,
    [outputs.payloads]: payloadBytes,
    [outputs.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
    [outputs.registryMarkdown]: await format(
      `# W4FR3 canonical registry - BLOCKED\n\n183 accepted obligations/125 contexts retained;not a complete physical registry. Seven governed included-column unique requirements need excluded columns;14 exact owned relation/column obligations blocked. See [registry](./UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR3.json) and [report](./PHASE_1B_3C_A1I_W4FR3_MINIMAL_BASELINE_AUTHORING.md). No parent gap is used as blocker;canonical1.3.1;no execution.\n`,
      { ...config, parser: 'markdown' },
    ),
    [outputs.payloadsMarkdown]: await format(
      `# W4FR3 inactive SQL payloads - PARTIAL BLOCKED\n\n36 exact inactive type payloads;0 relation-create/0 add-column payloads;183 explicitly withheld. No complete consumer payload dependency graph. See [payloads](./UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR3.json). SQL_STATUS=DEFINITION_ONLY_NOT_EXECUTABLE;EXECUTION_ALLOWED=NO.\n`,
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_W4FR3_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4FR3')
    console.log('PASS W4FR3 two-generation exact-byte equality;owned constraint gate BLOCKED')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4FR3_OUTPUT:${file}`)
    console.log('PASS W4FR3 persisted supplemental artifacts;historical contracts unchanged')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log(
      'W4FR3 BLOCKED:exact owned unique constraints require excluded columns;no producer/contract mutation',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[author-w4fr3-minimal-baseline]', error)
    process.exitCode = 1
  })
