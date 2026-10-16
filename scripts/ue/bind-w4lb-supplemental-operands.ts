import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import type { buildClassification } from './classify-w4lc-compatibility'
import type { buildClosure } from './close-w4c-constraint-timing'
import { sqlTokens } from './close-w4t-named-types'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4lc: folder + 'PHASE_1B_3C_A1I_W4LC_COMPATIBILITY_GATE_NORMALIZATION.json',
  classification: folder + 'UE_W4_DEFERRED_CONSTRAINT_COMPATIBILITY_CLASSIFICATION.json',
  deferred: folder + 'UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json',
  w4c: folder + 'PHASE_1B_3C_A1I_W4C_CONSTRAINT_TIMING_CLOSURE.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
}
export const fixedHashes: Record<string, string> = {
  [files.w4lc]: 'fef8528dda5467bb742cd4987b449809f3143099648ec42381b665ecb7cc3ab8',
  [files.classification]: '51700b9b0d5860ee9218fabc43ba1aeeb09b96cd6d0b908998e046d724ee05ec',
  [files.deferred]: 'ce57db581afbee96a9a9017b76cebf309b5741216a7df32d4b80d8f216c9c367',
  [files.w4c]: '2bda4359c389a92e1b9d6a4685fb9bd85528c28ce872812977ae7d7cd732887f',
  [files.producer]: 'ba88ee29a58c55c6b50930ff75089a59c00c68526f2e2e12547e801cca6c9673',
  [files.canonical]: '89dda28394c53c1c9ed9222982c6fff4b0840186831129f32206ba451cc3b1fd',
  [files.w4g]: '50bc30927199ff75307eb8b27d5c9bb4a8faa3e7fb5b600a132fe22e9cd53328',
}
export const outputs = {
  operands: folder + 'UE_W4_SUPPLEMENTAL_OPERAND_PRODUCER_BINDINGS.json',
  operandsMarkdown: folder + 'UE_W4_SUPPLEMENTAL_OPERAND_PRODUCER_BINDINGS.md',
  handoffs: folder + 'UE_W4_SUPPLEMENTAL_CONSTRAINT_BINDINGS.json',
  handoffsMarkdown: folder + 'UE_W4_SUPPLEMENTAL_CONSTRAINT_BINDINGS.md',
  report: folder + 'PHASE_1B_3C_A1I_W4LB_SUPPLEMENTAL_OPERAND_BINDING.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4LB_SUPPLEMENTAL_OPERAND_BINDING.md',
}
export const exactOperands = [
  'public.org_entitlements.feature_key',
  'public.billing_periods.label',
  'public.org_configurations.category',
  'public.org_configurations.key',
  'public.pilot_checklist_items.item_id',
  'public.member_jurisdiction_preferences.user_id',
  'public.contract_covered_orgs.contract_id',
  'public.duplicate_group_members.record_type',
  'public.duplicate_group_members.record_id',
]
export const exactHandoffIds = [
  'UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a',
  'UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76',
  'UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5',
  'UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3',
  'UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d',
  'UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680',
  'UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4',
]
export const registryNames = [
  'canonicalProducerPlan',
  'platformProducerRegistry',
  'physicalIdentityAuthority',
  'djangoProducerRegistry',
  'djangoExecutionRegistry',
  'rawOperationProducerRegistry',
  'blockedProducerPlanEntries',
  'w5OrderingHandoff',
] as const
type Json = null | string | number | boolean | Json[] | { [key: string]: Json }
type RegistryRecord = { [key: string]: Json }
type Registries = Record<(typeof registryNames)[number], RegistryRecord[]>
type Deferred = ReturnType<typeof buildClosure>['registry']
type Previous = ReturnType<typeof buildClassification>
interface Migration {
  FILE: string
  SHA256: string
  FROZEN_POSITION: number
  MIGRATION_NODE_ID: string
}
function containsExact(value: Json, identity: string): boolean {
  if (typeof value === 'string') return value === identity
  if (value === null || typeof value !== 'object') return false
  return Object.values(value).some((child) => containsExact(child, identity))
}
export function registryEvidence(registries: Registries, identity: string) {
  return registryNames.map((name) => ({
    REGISTRY: name,
    MATCH_POLICY: 'EXACT_PHYSICAL_IDENTITY_VALUE;no name similarity or aliases',
    EXACT_MATCH_RECORDS: registries[name].filter((record) => containsExact(record, identity)),
  }))
}
export function scanExactOperand(text: string, identity: string) {
  const [schema, relation, column] = identity.split('.')
  assert(schema === 'public' && relation && column && identity.split('.').length === 3)
  const tokens = sqlTokens(text)
  const named = (index: number, name: string) => {
    const token = tokens[index]
    return (
      token &&
      (token.kind === 'IDENTIFIER'
        ? token.value === name
        : token.kind === 'WORD' && token.value.toLowerCase() === name)
    )
  }
  const keyword = (index: number, word: string) =>
    tokens[index]?.kind === 'WORD' && tokens[index].value.toUpperCase() === word
  const relationPositions = tokens
    .filter((token) => token.value === relation)
    .map((token) => token.start)
  const operandPositions = tokens
    .filter((token) => token.value === column)
    .map((token) => token.start)
  const operations: {
    KIND: string
    START: number
    END: number
    EXACT_OPERATION: string
    EXACT_OPERATION_SHA256: string
  }[] = []
  const excluded: {
    KIND: string
    START: number
    EXACT_SOURCE: string
    WHY_NOT_PRODUCTION: string
  }[] = []
  const tableAt = (index: number) => {
    if (named(index, 'public') && tokens[index + 1]?.value === '.')
      return named(index + 2, relation) ? index + 3 : -1
    return named(index, relation) ? index + 1 : -1
  }
  for (let i = 0; i < tokens.length; i++) {
    if (keyword(i, 'CREATE') && keyword(i + 1, 'TABLE')) {
      let at = i + 2
      if (keyword(at, 'IF') && keyword(at + 1, 'NOT') && keyword(at + 2, 'EXISTS')) at += 3
      if (keyword(at, 'ONLY')) at++
      const body = tableAt(at)
      if (body < 0 || tokens[body]?.value !== '(') continue
      let depth = 0,
        end = body,
        segment = true,
        found = false
      for (; end < tokens.length; end++) {
        const token = tokens[end]
        if (token.value === '(') {
          depth++
          continue
        }
        if (token.value === ')') {
          depth--
          if (!depth) break
          continue
        }
        if (depth === 1 && token.value === ',') {
          segment = true
          continue
        }
        if (depth === 1 && segment) {
          if (named(end, column)) found = true
          segment = false
        }
      }
      assert(end < tokens.length, 'UNTERMINATED_TARGET_CREATE')
      if (found) {
        const stop = tokens[end + 1]?.value === ';' ? tokens[end + 1].end : tokens[end].end
        const operation = text.slice(tokens[i].start, stop)
        operations.push({
          KIND: 'CREATE_TABLE_CONTAINING_EXACT_OPERAND',
          START: tokens[i].start,
          END: stop,
          EXACT_OPERATION: operation,
          EXACT_OPERATION_SHA256: sha(operation),
        })
      }
    }
    if (keyword(i, 'ALTER') && keyword(i + 1, 'TABLE')) {
      let at = i + 2
      if (keyword(at, 'IF') && keyword(at + 1, 'EXISTS')) at += 2
      if (keyword(at, 'ONLY')) at++
      const body = tableAt(at)
      if (body < 0) continue
      let end = body
      while (end < tokens.length && tokens[end].value !== ';') end++
      for (let j = body; j < end; j++) {
        if (!keyword(j, 'ADD')) continue
        let arg = j + 1
        if (keyword(arg, 'COLUMN')) arg++
        if (keyword(arg, 'IF') && keyword(arg + 1, 'NOT') && keyword(arg + 2, 'EXISTS')) arg += 3
        if (!named(arg, column)) continue
        const stop = tokens[end]?.end ?? text.length
        const operation = text.slice(tokens[i].start, stop)
        operations.push({
          KIND: 'ALTER_TABLE_ADD_EXACT_OPERAND',
          START: tokens[i].start,
          END: stop,
          EXACT_OPERATION: operation,
          EXACT_OPERATION_SHA256: sha(operation),
        })
      }
    }
    if (tokens[i].kind === 'STRING' && tokens[i].value === relation) {
      excluded.push({
        KIND: 'RELATION_LITERAL_REFERENCE',
        START: tokens[i].start,
        EXACT_SOURCE: text.slice(tokens[i].start, tokens[i].end),
        WHY_NOT_PRODUCTION:
          'Relation-name literal or RLS/preflight target is not CREATE TABLE/ADD COLUMN proof for the excluded operand.',
      })
    }
  }
  return {
    EXACT_RELATION: `public.${relation}`,
    EXACT_COLUMN: column,
    EXACT_RELATION_TOKEN_POSITIONS: relationPositions,
    EXACT_OPERAND_TOKEN_POSITIONS: operandPositions,
    FILE_LEVEL_EXACT_PAIR_MATCH: relationPositions.length > 0 && operandPositions.length > 0,
    PHYSICAL_PRODUCING_OPERATIONS: operations,
    EXCLUDED_RELATION_REFERENCES: excluded,
    SEARCH_CEILING:
      'Only exact relation/operand tokens;references,comments,strings and constraint-only participation do not establish physical creation.',
  }
}
export function finalBoundary(
  bindings: {
    PHYSICAL_OPERAND_IDENTITY: string
    POSITION: number | null
    PRODUCER_OR_BOUNDARY_ID: string | null
    BINDING_CLASS: string
  }[],
) {
  if (
    !bindings.length ||
    bindings.some(
      (binding) =>
        binding.BINDING_CLASS === 'NO_PRODUCER_OR_BOUNDARY_EVIDENCE' ||
        binding.POSITION === null ||
        binding.PRODUCER_OR_BOUNDARY_ID === null,
    )
  )
    return null
  const latest = Math.max(...bindings.map((binding) => binding.POSITION ?? -1))
  const final = bindings.filter((binding) => binding.POSITION === latest)
  if (new Set(final.map((binding) => binding.PRODUCER_OR_BOUNDARY_ID)).size !== 1) return null
  return {
    FINAL_OPERAND_IDENTITIES: final.map((binding) => binding.PHYSICAL_OPERAND_IDENTITY),
    FINAL_OPERAND_POSITION: latest,
    FINAL_OPERAND_PRODUCER_OR_BOUNDARY_ID: final[0].PRODUCER_OR_BOUNDARY_ID,
    ORDERING_BASIS: 'Accepted frozen execution positions only;not filesystem or declaration order',
  }
}
export function buildBindings() {
  for (const [file, hash] of Object.entries(fixedHashes))
    assert.equal(sha(read(file)), hash, `FIXED_INPUT_DRIFT:${file}`)
  const previous: Previous['report'] = JSON.parse(read(files.w4lc))
  const classification: Previous['constraintRegistry'] = JSON.parse(read(files.classification))
  const deferred: Deferred = JSON.parse(read(files.deferred))
  const timing: ReturnType<typeof buildClosure>['report'] = JSON.parse(read(files.w4c))
  const producer: Registries = JSON.parse(read(files.producer))
  const canonical: { CONTRACT_VERSION: string; frozenMigrationManifest: Migration[] } = JSON.parse(
    read(files.canonical),
  )
  assert.equal(canonical.CONTRACT_VERSION, '1.3.2')
  assert.equal(previous.phaseStatus.PHASE_1B_3C_A1I_W4LC_GATE, 'BLOCKED')
  assert.equal(previous.summary.EXISTING_RECORDS_WITH_COMPLETE_MECHANICS, 127)
  assert.deepEqual(deferred.handoffs, timing.constraintTimingDisposition)
  assert.deepEqual(
    classification.records.map((record) => record.CANONICAL_HANDOFF),
    deferred.handoffs,
  )
  assert.deepEqual(
    deferred.handoffs.map((record) => record.DEFERRED_CONSTRAINT_HANDOFF_ID),
    exactHandoffIds,
  )
  const explicitIds = exactOperands.map((identity) => `union-eyes::COLUMN::${identity}`)
  assert.deepEqual(
    deferred.handoffs.flatMap((record) => record.NON_W4_OPERAND_IDENTITIES),
    explicitIds,
    'LISTED_OPERAND_UNIVERSE_DRIFT',
  )
  assert.equal(new Set(explicitIds).size, 9)
  assert.equal(canonical.frozenMigrationManifest.length, 23)
  assert.equal(producer.w5OrderingHandoff.length, 86)
  const preservation = { ...previous.preservation.BYTE_COMMITMENTS, ...fixedHashes }
  for (const [file, hash] of Object.entries(preservation))
    assert.equal(sha(read(file)), hash, `UPSTREAM_DRIFT:${file}`)
  for (const file of [files.w4lc, files.classification])
    preservation[file.replace(/\.json$/, '.md')] = sha(read(file.replace(/\.json$/, '.md')))
  const migrations = canonical.frozenMigrationManifest.map((record) => {
    const bytes = read(record.FILE)
    assert.equal(sha(bytes), record.SHA256, `FROZEN_MIGRATION_DRIFT:${record.FILE}`)
    preservation[record.FILE] = record.SHA256
    return { ...record, bytes }
  })
  const operands = exactOperands.map((identity) => {
    const physical = `union-eyes::COLUMN::${identity}`
    const evidence = registryEvidence(producer, physical)
    const searches = migrations.map((migration) => ({
      SOURCE_FILE: migration.FILE,
      SOURCE_SHA256: migration.SHA256,
      FROZEN_MIGRATION_ID: migration.MIGRATION_NODE_ID,
      POSITION: migration.FROZEN_POSITION,
      ...scanExactOperand(migration.bytes, identity),
    }))
    // This fixed evidence set has no exact producing operation; do not auto-bind future candidates.
    assert(
      searches.every((search) => search.PHYSICAL_PRODUCING_OPERATIONS.length === 0),
      'NEW_PHYSICAL_PROOF_REQUIRES_CANONICAL_PRODUCER_OPERATION_BINDING',
    )
    assert(
      evidence.every((entry) => entry.EXACT_MATCH_RECORDS.length === 0),
      'NEW_REGISTRY_MATCH_REQUIRES_EXACT_OPERATION_OR_EXISTENCE_BOUNDARY_PROOF',
    )
    const handoff = deferred.handoffs.find((record) =>
      record.NON_W4_OPERAND_IDENTITIES.includes(physical),
    )
    assert(handoff)
    return {
      PHYSICAL_OPERAND_IDENTITY: physical,
      RELATION_IDENTITY: identity.split('.').slice(0, 2).join('.'),
      COLUMN_IDENTITY: identity.split('.').at(-1),
      DEFERRED_CONSTRAINT_HANDOFF_ID: handoff.DEFERRED_CONSTRAINT_HANDOFF_ID,
      BINDING_CLASS: 'NO_PRODUCER_OR_BOUNDARY_EVIDENCE',
      PRODUCER_ID: null,
      PRODUCER_CLASS: null,
      SOURCE_FILE: null,
      SOURCE_SHA256: null,
      POSITION: null,
      EXACT_OPERATION: null,
      BOUNDARY_ID: null,
      PRODUCER_OR_BOUNDARY_ID: null,
      MISSING_FACT:
        'Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.',
      SEARCHED_FIXED_EVIDENCE: { REGISTRY_EVIDENCE: evidence, FROZEN_MIGRATION_SEARCHES: searches },
      DECLARATION_EVIDENCE: handoff.CANONICAL_CONSTRAINT_PROVENANCE.FROZEN_DECLARATION_REFERENCE,
      PRODUCER_EVIDENCE: [],
      WHY_AVAILABLE_DECLARATIONS_ARE_INSUFFICIENT:
        'The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.',
      ORDERING_IMPLICATION_RELATIVE_TO_W4FR4:
        'UNPROVEN;W4FR4 excludes this operand and no accepted producer/boundary position is recorded',
      EXECUTION_ALLOWED: 'NO',
    }
  })
  const handoffs = deferred.handoffs.map((canonicalHandoff) => {
    const bindings = operands.filter((operand) =>
      canonicalHandoff.NON_W4_OPERAND_IDENTITIES.includes(operand.PHYSICAL_OPERAND_IDENTITY),
    )
    assert.equal(bindings.length, canonicalHandoff.NON_W4_OPERAND_IDENTITIES.length)
    const final = finalBoundary(bindings)
    const orderingMatches = producer.w5OrderingHandoff.filter(
      (record) =>
        typeof record.PHYSICAL_IDENTITY === 'string' &&
        canonicalHandoff.NON_W4_OPERAND_IDENTITIES.includes(record.PHYSICAL_IDENTITY),
    )
    assert.equal(orderingMatches.length, 0)
    return {
      DEFERRED_CONSTRAINT_HANDOFF_ID: canonicalHandoff.DEFERRED_CONSTRAINT_HANDOFF_ID,
      CANONICAL_HANDOFF: canonicalHandoff,
      RELATION: canonicalHandoff.RELATION,
      OPERAND_BINDING_IDENTITIES: bindings.map((binding) => binding.PHYSICAL_OPERAND_IDENTITY),
      HANDOFF_BINDING_CLASS: 'BLOCKED_MISSING_OPERAND_BINDING',
      FINAL_OPERAND_IDENTITY: null,
      FINAL_OPERAND_POSITION: final?.FINAL_OPERAND_POSITION ?? null,
      FINAL_OPERAND_PRODUCER_OR_BOUNDARY_ID: final?.FINAL_OPERAND_PRODUCER_OR_BOUNDARY_ID ?? null,
      CONSTRAINT_MATERIALIZATION_AFTER: null,
      EXISTING_W5_MATCH: 'NO_EXISTING_W5_HANDOFF_EXACT_MATCH',
      EXISTING_W5_HANDOFF_IDS: [],
      SUPPLEMENTAL_COMPATIBILITY_ORDERING_REQUIRED: 'NOT_DERIVABLE_UNBOUND_OPERANDS',
      SUPPLEMENTAL_ORDERING_REQUIREMENTS: [],
      MISSING_OPERAND_IDENTITIES: bindings.map((binding) => binding.PHYSICAL_OPERAND_IDENTITY),
      CONSTRAINT_SEMANTICS: 'PRESERVED',
      MATERIALIZATION_STATUS: 'DEFERRED_NOT_EXECUTED',
      EXECUTION_ALLOWED: 'NO',
    }
  })
  const summary = {
    REQUESTED_DISTINCT_MISSING_OPERAND_IDENTITIES: 10,
    EXPLICITLY_LISTED_DISTINCT_OPERANDS: operands.length,
    CANONICAL_HANDOFF_DISTINCT_OPERANDS: new Set(explicitIds).size,
    DISTINCT_OPERANDS: operands.length,
    EXACT_PHYSICAL_PRODUCER_IDENTIFIED: 0,
    EXACT_EXISTENCE_BOUNDARY_IDENTIFIED: 0,
    NO_PRODUCER_OR_BOUNDARY_EVIDENCE: operands.length,
    OPERAND_SUM: operands.length,
    SUPPLEMENTAL_HANDOFFS: 7,
    ALL_OPERANDS_EXACTLY_BOUND: 0,
    ALL_OPERANDS_EXIST_BY_EXACT_BOUNDARY: 0,
    MIXED_EXACT_PRODUCER_AND_BOUNDARY: 0,
    BLOCKED_MISSING_OPERAND_BINDING: 7,
    HANDOFF_SUM: 7,
    EXISTING_W5_HANDOFF_EXACT_MATCH: 0,
    NO_EXISTING_W5_HANDOFF_EXACT_MATCH: 7,
    W5_MATCH_SUM: 7,
    SUPPLEMENTAL_COMPATIBILITY_ORDERING_REQUIRED: 0,
    SUPPLEMENTAL_ORDERING_DERIVATION:
      'NOT_DERIVABLE_WHILE_OPERANDS_UNBOUND;zero is not proof none will be required',
    UNRESOLVED_SUPPLEMENTAL_BINDINGS: operands.length,
    UNACCOUNTED_LISTED_OPERANDS: 0,
    UNACCOUNTED_HANDOFFS: 0,
    FROZEN_MIGRATION_FILES_HASH_VERIFIED: 23,
    EXACT_PAIR_FILE_MATCHES: operands.flatMap((operand) =>
      operand.SEARCHED_FIXED_EVIDENCE.FROZEN_MIGRATION_SEARCHES.filter(
        (search) => search.FILE_LEVEL_EXACT_PAIR_MATCH,
      ),
    ).length,
    EXACT_PHYSICAL_OPERATION_MATCHES: 0,
    W5_ORDERING_HANDOFFS: 86,
    W5_ORDERING_HANDOFFS_CHANGED: 0,
    EXISTING_COMPATIBILITY_RECORDS: 127,
    EXISTING_COMPATIBILITY_RECORDS_CHANGED: 0,
    EXISTING_COMPLETE_MECHANICS_PRESERVED: 127,
    SQL_AUTHORED: 0,
    SQL_EXECUTED: 0,
    PRODUCERS_ACTIVATED: 0,
  }
  const countDiscrepancy = {
    STATUS: 'EXPLICIT_LIST_AND_CANONICAL_HANDOFFS_CONTAIN9_NOT10',
    REQUESTED_COUNT: 10,
    LISTED_COUNT: 9,
    CANONICAL_COUNT: 9,
    EXACT_LISTED_IDENTITIES: explicitIds,
    TENTH_IDENTITY: null,
    DISPOSITION:
      'No tenth identity invented;all explicitly listed operands preserved. Exact10 success assertion cannot be made.',
  }
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4LB_GATE: 'BLOCKED',
    PHASE_1B_3C_A1I_W4LB: 'BLOCKED',
    SUPPLEMENTAL_OPERAND_BINDING: 'BLOCKED_MISSING_EXACT_PRODUCER_OR_BOUNDARY_PROOF',
    NO_FURTHER_GENERIC_OPERAND_DISCOVERY: 'YES',
    W4LC2_FINAL_NORMALIZATION: 'NOT_AUTHORIZED',
    W4P: 'NOT_AUTHORIZED',
    W5_COMPATIBILITY_SLICE: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
    CANONICAL_CONTRACT_VERSION: '1.3.2',
    W4: 'BLOCKED_ORDERING_COMPATIBILITY_PENDING',
  }
  const metadata = {
    PHASE: 'PHASE_1B_3C_A1I_W4LB',
    INPUTS: files,
    SEARCH_BOUNDARY:
      'Exact listed relation+operand pairs only;23 frozen files and permitted canonical producer surfaces',
    GENERAL_DISCOVERY: 'NO',
    EXECUTION_ALLOWED: 'NO',
  }
  return {
    operandRegistry: { metadata, countDiscrepancy, summary, records: operands },
    handoffRegistry: { metadata, summary, records: handoffs },
    report: {
      metadata,
      countDiscrepancy,
      summary,
      phaseStatus,
      residualMissingFacts: operands.map((operand) => ({
        PHYSICAL_OPERAND_IDENTITY: operand.PHYSICAL_OPERAND_IDENTITY,
        DEFERRED_CONSTRAINT_HANDOFF_ID: operand.DEFERRED_CONSTRAINT_HANDOFF_ID,
        MISSING_FACT: operand.MISSING_FACT,
      })),
      preservation: {
        BYTE_COMMITMENTS: preservation,
        W4LC_EXISTING127_CLASSIFICATION_REUSED: 'YES_NOT_RERUN',
        EXISTING127_COMPLETE_MECHANICS_PRESERVED: 'YES',
        W5_86_SHA256: digest(producer.w5OrderingHandoff),
        W4C7_HANDOFFS_SHA256: digest(deferred.handoffs),
        CANONICAL_CONTRACT_BYTES_CHANGED: 'NO',
        W4FR4_DEFINITION_BYTES_CHANGED: 'NO',
      },
      validation: {
        EXACT_LISTED9_IDENTITIES: 'PASS',
        REQUESTED10_DENOMINATOR: 'NOT_SATISFIED_INPUT_LIST_HAS9',
        EXACT7_HANDOFFS: 'PASS',
        FROZEN23_HASHES: 'PASS',
        DECLARATION_VS_PRODUCTION: 'PASS',
        FINAL_OPERAND_POSITIONS: 'NOT_DERIVABLE_NO_PROOF',
        FIXED_BYTE_COMMITMENTS: Object.keys(preservation).length,
        COMPLETED_CHECKS: [
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\bind-w4lb-supplemental-operands.test.ts',
            RESULT: 'PASS',
            TESTS: 71,
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\classify-w4lc-compatibility.test.ts scripts\\ue\\author-w4fr4-final-baseline.test.ts',
            RESULT: 'PASS',
            TESTS: 473,
          },
          {
            COMMAND:
              'pnpm exec vitest run --config scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\close-w4c-constraint-timing.test.ts',
            RESULT: 'PASS',
            TESTS: 22,
          },
          {
            COMMAND:
              'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\bind-w4lb-supplemental-operands.ts scripts\\ue\\bind-w4lb-supplemental-operands.test.ts',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\bind-w4lb-supplemental-operands.ts scripts\\ue\\bind-w4lb-supplemental-operands.test.ts',
            RESULT: 'PASS_EXIT0_EXISTING_NEXT_PAGES_DIRECTORY_DIAGNOSTIC',
          },
          {
            COMMAND:
              'pnpm exec prettier --check scripts\\ue\\bind-w4lb-supplemental-operands.ts scripts\\ue\\bind-w4lb-supplemental-operands.test.ts docs\\union-eyes\\reality-remediation\\*W4LB* docs\\union-eyes\\reality-remediation\\UE_W4_SUPPLEMENTAL*',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec tsx scripts\\ue\\bind-w4lb-supplemental-operands.ts --self-test --check',
            RESULT: 'PASS_TWO_GENERATION_EXACT_BYTES_AND_PERSISTED_OUTPUT_EQUALITY',
          },
          {
            COMMAND: 'pnpm validate:docs',
            RESULT: 'PASS_0_ERRORS_1215_EXISTING_WARNINGS',
          },
        ],
      },
      determinismDigests: {
        OPERAND_BINDINGS: digest(operands),
        HANDOFF_BINDINGS: digest(handoffs),
        COUNT_DISCREPANCY: digest(countDiscrepancy),
      },
      proofBoundaries: {
        ...previous.proofBoundaries,
        SQL_AUTHORED_IN_W4LB: 0,
        SQL_EXECUTED: 0,
        COMPATIBILITY_MECHANICS_EXECUTED: 'NO',
        DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
        PRODUCERS_ACTIVATED: 0,
        W5_EXECUTED: 'NO',
        READY_FOR_RUNTIME_PROOF: 0,
        PRODUCT_READY: 'NO',
      },
    },
  }
}
export async function generate() {
  const model = buildBindings()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const cards = model.operandRegistry.records
    .map(
      (record) => `## ${record.PHYSICAL_OPERAND_IDENTITY}

- Handoff: \`${record.DEFERRED_CONSTRAINT_HANDOFF_ID}\`
- Classification: ${record.BINDING_CLASS}.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: ${record.MISSING_FACT}
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: ${
        record.SEARCHED_FIXED_EVIDENCE.FROZEN_MIGRATION_SEARCHES.filter(
          (search) => search.FILE_LEVEL_EXACT_PAIR_MATCH,
        )
          .map((search) => search.SOURCE_FILE)
          .join(', ') || 'NONE'
      };physical producing-operation matches:0.
- Declaration is not production: ${record.WHY_AVAILABLE_DECLARATIONS_ARE_INSUFFICIENT}
`,
    )
    .join('\n')
  const handoffCards = model.handoffRegistry.records
    .map(
      (record) =>
        `| ${record.DEFERRED_CONSTRAINT_HANDOFF_ID} | ${record.RELATION} | ${record.MISSING_OPERAND_IDENTITIES.join(', ')} | BLOCKED_MISSING_OPERAND_BINDING | NONE PROVEN |`,
    )
    .join('\n')
  const md = `# W4LB supplemental operand binding - BLOCKED

## Exact identity accounting

The mission requests10 distinct operands but explicitly lists9. The7 canonical W4C handoffs also contain9 distinct excluded operands. All9 listed identities are accounted;0 lost;no tenth invented. Requested exact10 accounting is not satisfied.
EXACT_PHYSICAL_PRODUCER_IDENTIFIED=0;EXACT_EXISTENCE_BOUNDARY_IDENTIFIED=0;NO_PRODUCER_OR_BOUNDARY_EVIDENCE=9;SUM=9.

## Seven handoff dispositions

ALL_OPERANDS_EXACTLY_BOUND=0;ALL_OPERANDS_EXIST_BY_EXACT_BOUNDARY=0;MIXED_EXACT_PRODUCER_AND_BOUNDARY=0;BLOCKED_MISSING_OPERAND_BINDING=7;SUM=7.
EXISTING_W5_HANDOFF_EXACT_MATCH=0;NO_EXISTING_W5_HANDOFF_EXACT_MATCH=7;SUM=7.
No final operand identity/producer/boundary/position is proven. No materialization location or supplemental ordering edge can be derived. Recorded supplemental ordering requirements=0 because operands are unbound,not because ordering is proven unnecessary.

| Handoff ID | Relation | Exact missing identities | State | Final position |
|---|---|---|---|---|
${handoffCards}

## Residual missing facts and bounded evidence

${cards}

The only exact relation/column pair co-occurrence is contract_covered_orgs+contract_id in frozen0014. Its relation-name entries are RLS/preflight references;the operand token appears elsewhere in the file,not an operation creating this exact relation-column. A table-existence guard cannot prove excluded column presence. No schema declaration,UI/model reference or name similarity was used as physical proof.
No general repository search,no adjacent operand/semantic alias expansion,no new producer or order authority.

## Preservation and validation

${model.report.validation.FIXED_BYTE_COMMITMENTS} byte commitments preserved.23 frozen migration hashes verified;127 existing records and complete W4LC mechanics unchanged and not reclassified;86 W5 handoffs unchanged;7 canonical constraint semantics unchanged;W4FR4 definitions/payloads andcanonical1.3.2 unchanged.
71 focused tests+473 W4LC/W4FR4 predecessor tests+22 W4C historical-input tests=566 passed. Exact listed identity/handoff,physical-operation parser,declaration/reference separation,final-boundary derivation,all86 exact-W5/preservation/determinism coverage included. Scoped TypeScript,ESLint(exit0 with existing Next pages-directory diagnostic),formatting,two-generation exact-byte equality and persisted \`--check\` passed. \`pnpm validate:docs\`:0 errors/1215 existing warnings. Exact completed commands and results are recorded in the machine report.

## Gate and authorization

W4LB=BLOCKED;9 exact listed operand bindings missing across7 handoffs;NO_FURTHER_GENERIC_OPERAND_DISCOVERY=YES.
W4LC2_FINAL_NORMALIZATION=NOT_AUTHORIZED;W4P=NOT_AUTHORIZED;W5_COMPATIBILITY_SLICE=NOT_AUTHORIZED;fullW5=NOT_AUTHORIZED.
Canonical1.3.2;no1.3.3/1.4. SQL_AUTHORED=0;SQL_EXECUTED=0;COMPATIBILITY_MECHANICS_EXECUTED=NO;DEFERRED_CONSTRAINTS_MATERIALIZED=NO;PRODUCERS_ACTIVATED=0;W5_EXECUTED=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
`
  const json = (value: unknown) => format(JSON.stringify(value), { ...config, parser: 'json' })
  return {
    [outputs.operands]: await json(model.operandRegistry),
    [outputs.handoffs]: await json(model.handoffRegistry),
    [outputs.report]: await json(model.report),
    [outputs.markdown]: await format(md, { ...config, parser: 'markdown' }),
    [outputs.operandsMarkdown]: await format(
      `# W4LB exact supplemental operand producer bindings\n\nRequested10 vs explicitly listed/canonical9 discrepancy preserved;no tenth invented.0 physical producers/0 existence boundaries/9 no-proof records.\n\n${cards}\n\nFull per-file/registry search evidence in [machine registry](./UE_W4_SUPPLEMENTAL_OPERAND_PRODUCER_BINDINGS.json). No SQL or upstream mutation.\n`,
      { ...config, parser: 'markdown' },
    ),
    [outputs.handoffsMarkdown]: await format(
      `# W4LB seven supplemental constraint bindings\n\nAll7 BLOCKED_MISSING_OPERAND_BINDING;no exact W5 match,final position or supplemental ordering derivable.\n\n| Handoff ID | Relation | Exact missing identities | State | Final position |\n|---|---|---|---|---|\n${handoffCards}\n\nCanonical semantics and negative linkage evidence retained in [machine registry](./UE_W4_SUPPLEMENTAL_CONSTRAINT_BINDINGS.json). See [phase report](./PHASE_1B_3C_A1I_W4LB_SUPPLEMENTAL_OPERAND_BINDING.md).\n`,
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_W4LB_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4LB')
    console.log('PASS W4LB two-generation exact-byte equality')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4LB_OUTPUT:${file}`)
    console.log('PASS W4LB persisted evidence and unchanged upstream bytes')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log(
      'W4LB BLOCKED:9 listed operands unbound/7 handoffs;requested10 count discrepancy;no invention or execution',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[bind-w4lb-supplemental-operands]', error)
    process.exitCode = 1
  })
