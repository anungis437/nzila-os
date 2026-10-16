import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import type { buildTypeClosure } from './close-w4t-named-types'
import { enumDescriptor } from './close-w4t-named-types'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  registry: folder + 'UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json',
  packet: folder + 'UE_W4T_NAMED_TYPE_HUMAN_DECISION_PACKET.json',
  w4t: folder + 'PHASE_1B_3C_A1I_W4T_NAMED_TYPE_PRODUCTION_CLOSURE.json',
  w4fr: folder + 'PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.json',
}
export const outputs = {
  registry: files.registry,
  registryMarkdown: folder + 'UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.md',
  report: folder + 'PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.md',
}
type Model = ReturnType<typeof buildTypeClosure>
type Registry = Model['registry']
type Record = Registry['typeRecords'][number]
type Candidate = Record['TYPE_DEFINITION_EVIDENCE'][number]
export const selectedIdentities = [
  'public.fee_adjustment_type',
  'public.ledger_event_type',
  'public.ledger_source_type',
  'public.platform_cost_type',
]
export const rationale =
  'Current product schema declaration is selected as the forward canonical named-type definition. Historical declarations remain compatibility evidence for predecessor states and do not constrain the current canonical enum to the older member set.'
const authority = 'HUMAN_ARCHITECTURE_W4T1'
const inputHashes = {
  registry: '276f37596f4f4f01fabdb722b5484c4315ab4f4c89d57113d5e335c4df289b9a',
  packet: '5202d0fb78a1365ae84f70b309f1129962a2ada13dd3f06a70d79c454092f352',
  w4t: '2e422dc1ae5aa221588e66dabc8fa9cbf5398f575b3fd9a70e2f51af03488721',
  w4fr: 'b8fef92a25d7c9c0bbc14c5770aca25c086405a85239508d309da69c00d8fe54',
}
export function verifyCandidate(candidate: Candidate, source: string) {
  assert.equal(sha(source), candidate.SOURCE_SHA256, `FROZEN_SOURCE_DRIFT:${candidate.SOURCE_FILE}`)
  assert.equal(
    sha(candidate.EXACT_DEFINITION_TEXT),
    candidate.DEFINITION_DIGEST,
    'DEFINITION_DIGEST_MISMATCH',
  )
  const [start, end] = candidate.SOURCE_RANGE
  assert(start >= 1 && end >= start)
  const range = source
    .split('\n')
    .slice(start - 1, end)
    .join('\n')
  assert(range.includes(candidate.EXACT_DEFINITION_TEXT), 'DEFINITION_RANGE_TEXT_MISMATCH')
  assert(candidate.DEFINITION_COMPLETE && candidate.TYPE_KIND === 'ENUM')
  assert(candidate.ORDERED_ENUM_MEMBERS !== null)
}
export function selectCurrent(record: Record, frozen: Candidate[]) {
  assert.deepEqual(record.TYPE_DEFINITION_EVIDENCE, frozen, 'CANDIDATE_PACKET_REGISTRY_MISMATCH')
  assert.equal(record.OWNERSHIP_STATUS, 'PLATFORM_BASELINE_GOVERNANCE_ADOPTED')
  assert.equal(record.OWNERSHIP_AUTHORITY, 'HUMAN_GOVERNANCE_W4T')
  assert.equal(record.CANONICAL_CREATION_AUTHORITY, 'PLATFORM_BASELINE')
  assert.equal(record.DEFINITION_STATUS, 'HOLD_DEFINITION_CONFLICT')
  const current = frozen.filter((candidate) => candidate.EVIDENCE_CLASS === 'CURRENT')
  assert.equal(current.length, 1, 'EXACTLY_ONE_CURRENT_CANDIDATE_REQUIRED')
  const selected = current[0]
  assert(selected.DEFINITION_COMPLETE && selected.TYPE_KIND === 'ENUM')
  assert(selected.ORDERED_ENUM_MEMBERS)
  assert.equal(`${selected.SCHEMA_NAME}.${selected.TYPE_NAME}`, record.CANONICAL_TYPE_IDENTITY)
  const members = selected.ORDERED_ENUM_MEMBERS
  switch (record.GOVERNED_TYPE_NAME) {
    case 'fee_adjustment_type':
      assert.equal(members[members.indexOf('reversal') + 1], 'partial_reversal')
      break
    case 'ledger_event_type':
      assert.deepEqual(members.slice(-2), ['fee_captured', 'settlement_closed'])
      break
    case 'ledger_source_type':
      assert.deepEqual(members.slice(-2), ['transaction_fee', 'settlement_batch'])
      break
    case 'platform_cost_type':
      assert.deepEqual(
        members.slice(members.indexOf('support_fee') + 1, members.indexOf('support_fee') + 3),
        ['transaction_fee', 'settlement'],
      )
      break
    default:
      assert.fail('OUTSIDE_FOUR_HUMAN_SELECTIONS')
  }
  return {
    ...record,
    SELECTED: selected,
    DEFINITION_STATUS: 'EXACT_DEFINITION_AVAILABLE',
    TYPE_APPROVAL_STATUS: 'APPROVED',
    DEFINITION_AUTHORITY: authority,
    DEFINITION_DECISION_AUTHORITY: authority,
    FORWARD_CANONICAL_ENUM_DEFINITION: 'EXACT_CURRENT_ORDERED_DECLARATION',
    RATIONALE: rationale,
    TYPE_DEFINITION_EVIDENCE: frozen.map((candidate) => ({
      ...candidate,
      DISPOSITION:
        candidate.EVIDENCE_CLASS === 'CURRENT'
          ? 'CANONICAL_FORWARD_TYPE_DEFINITION'
          : 'NON_CANONICAL_HISTORICAL_TYPE_DEFINITION',
      PRESERVED: 'YES',
      COMPATIBILITY_EVIDENCE: candidate.EVIDENCE_CLASS === 'HISTORICAL' ? 'YES' : 'NO',
    })),
    INACTIVE_TYPE_DESCRIPTOR: enumDescriptor(selected.SCHEMA_NAME, selected.TYPE_NAME, members),
  }
}
export function buildSelection() {
  const bytes = {
    registry: read(files.registry),
    packet: read(files.packet),
    w4t: read(files.w4t),
    w4fr: read(files.w4fr),
  }
  for (const key of ['packet', 'w4t', 'w4fr'] as const)
    assert.equal(sha(bytes[key]), inputHashes[key], `FROZEN_INPUT_DRIFT:${key}`)
  const packet: Model['residual'] = JSON.parse(bytes.packet)
  const priorReport: Model['report'] & {
    REGISTRY_SHA256: string
    TYPE_RECORDS_SHA256: string
    REFERENCE_LINKS_SHA256: string
  } = JSON.parse(bytes.w4t)
  const currentRegistry: Registry = JSON.parse(bytes.registry)
  let priorRegistry = currentRegistry
  let previous: {
    preDecisionRegistry: Registry
    preservation: {
      historicalByteCommitments: { [file: string]: string }
      sourceHashes: { [file: string]: string }
    }
    NORMALIZED_REGISTRY_SHA256: string
  } | null = null
  if (sha(bytes.registry) !== inputHashes.registry) {
    assert(
      existsSync(path.join(root, ...outputs.report.split('/'))),
      'UNRECOGNIZED_REGISTRY_CHANGE',
    )
    previous = JSON.parse(read(outputs.report))
    assert(previous)
    assert.equal(
      sha(bytes.registry),
      previous.NORMALIZED_REGISTRY_SHA256,
      'NORMALIZED_REGISTRY_DRIFT',
    )
    priorRegistry = previous.preDecisionRegistry
  }
  assert.equal(priorReport.REGISTRY_SHA256, inputHashes.registry)
  assert.equal(digest(priorRegistry.typeRecords), priorReport.TYPE_RECORDS_SHA256)
  assert.equal(digest(priorRegistry.referenceLinks), priorReport.REFERENCE_LINKS_SHA256)
  assert.equal(priorRegistry.typeRecords.length, 36)
  assert.equal(priorRegistry.referenceLinks.length, 38)
  assert.equal(packet.HELD_TYPE_IDENTITIES, 4)
  assert.deepEqual(
    packet.residual.map((entry) => entry.CANONICAL_TYPE_IDENTITY).sort(),
    selectedIdentities,
  )
  assert.deepEqual(
    priorRegistry.typeRecords
      .filter((record) => record.TYPE_APPROVAL_STATUS === 'HELD')
      .map((record) => record.CANONICAL_TYPE_IDENTITY)
      .sort(),
    selectedIdentities,
  )
  const sourceHashes: { [file: string]: string } = {}
  const fourSelections = packet.residual.map((entry) => {
    const record = priorRegistry.typeRecords.find(
      (candidate) => candidate.CANONICAL_TYPE_IDENTITY === entry.CANONICAL_TYPE_IDENTITY,
    )
    assert(record)
    for (const candidate of entry.AVAILABLE_DEFINITION_CANDIDATES) {
      verifyCandidate(candidate, read(candidate.SOURCE_FILE))
      sourceHashes[candidate.SOURCE_FILE] = candidate.SOURCE_SHA256
    }
    const normalized = selectCurrent(record, entry.AVAILABLE_DEFINITION_CANDIDATES)
    return {
      CANONICAL_TYPE_IDENTITY: entry.CANONICAL_TYPE_IDENTITY,
      HUMAN_SELECTION: 'CURRENT',
      DEFINITION_DECISION_AUTHORITY: authority,
      RATIONALE: rationale,
      SELECTED_DEFINITION: normalized.SELECTED,
      ORDERED_MEMBERS_SHA256: digest(normalized.SELECTED.ORDERED_ENUM_MEMBERS),
      HISTORICAL_ALTERNATIVES: normalized.TYPE_DEFINITION_EVIDENCE.filter(
        (candidate) => candidate.EVIDENCE_CLASS === 'HISTORICAL',
      ),
      NORMALIZED_TYPE_RECORD: normalized,
    }
  })
  const typeRecords = priorRegistry.typeRecords.map(
    (record) =>
      fourSelections.find(
        (selection) => selection.CANONICAL_TYPE_IDENTITY === record.CANONICAL_TYPE_IDENTITY,
      )?.NORMALIZED_TYPE_RECORD ?? record,
  )
  assert.equal(
    typeRecords.filter((record) => record.TYPE_APPROVAL_STATUS === 'APPROVED').length,
    36,
  )
  assert.equal(
    typeRecords.filter((record) => record.DEFINITION_STATUS === 'EXACT_DEFINITION_AVAILABLE')
      .length,
    36,
  )
  assert(
    typeRecords.every(
      (record) =>
        record.OWNERSHIP_STATUS === 'PLATFORM_BASELINE_GOVERNANCE_ADOPTED' &&
        record.OWNERSHIP_AUTHORITY === 'HUMAN_GOVERNANCE_W4T' &&
        record.CANONICAL_CREATION_AUTHORITY === 'PLATFORM_BASELINE',
    ),
  )
  assert(
    typeRecords.every(
      (record) =>
        record.INACTIVE_TYPE_DESCRIPTOR?.EXECUTION_ALLOWED === 'NO' &&
        record.INACTIVE_TYPE_DESCRIPTOR.SQL_STATUS === 'DEFINITION_ONLY_NOT_EXECUTABLE',
    ),
  )
  const unchanged32 = priorRegistry.typeRecords.filter(
    (record) => !selectedIdentities.includes(record.CANONICAL_TYPE_IDENTITY),
  )
  assert.equal(unchanged32.length, 32)
  assert.deepEqual(
    typeRecords.filter((record) => !selectedIdentities.includes(record.CANONICAL_TYPE_IDENTITY)),
    unchanged32,
  )
  const typeAccounting = {
    HUMAN_TYPE_DECISIONS_INPUT: 4,
    DISTINCT_NAMED_TYPES: 36,
    EXISTING_CANONICAL_AUTHORITY: 0,
    PLATFORM_BASELINE_GOVERNANCE_ADOPTED: 36,
    HELD_CONFLICTING_AUTHORITY: 0,
    EXACT_DEFINITION_AVAILABLE: 36,
    HELD_DEFINITION_INCOMPLETE: 0,
    HELD_DEFINITION_CONFLICT: 0,
    SUM_OWNERSHIP: 36,
    SUM_DEFINITION: 36,
    MERGED_ENUM_DEFINITIONS: 0,
    SELECTED_DEFINITIONS_MATCH_W4T_EVIDENCE: 'YES',
  }
  const referenceAccounting = {
    NAMED_TYPE_REFERENCES: 38,
    REFERENCES_WITH_APPROVED_TYPE: 38,
    REFERENCES_WITH_HELD_TYPE: 0,
    SUM: 38,
    UNACCOUNTED: 0,
    TYPE_REFERENCES_RESOLVED: 38,
    CONSUMER_IDENTITIES_CHANGED: 0,
  }
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4T1: 'PASS',
    PHASE_1B_3C_A1I_W4T1_GATE: 'PASS',
    PHASE_1B_3C_A1I_W4T: 'PASS',
    PHASE_1B_3C_A1I_W4T_GATE: 'PASS',
    NAMED_TYPE_PRODUCTION_MODEL: 'COMPLETE_NOT_EXECUTED',
    DISTINCT_NAMED_TYPES: 36,
    TYPE_REFERENCES_RESOLVED: 38,
    TYPE_AUTHORITY_HOLDS: 0,
    TYPE_DEFINITION_HOLDS: 0,
    W4FR_RETRY: 'AUTHORIZED_NOT_STARTED',
    W4FR_RETRY_STARTED: 'NO',
    CANONICAL_CONTRACT_VERSION: '1.3.1',
    CONTRACT_1_3_2_CREATED: 'NO',
    W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
    W4P: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
    READY_FOR_RUNTIME_PROOF: 0,
    PRODUCT_READY: 'NO',
  }
  const registry = {
    ...priorRegistry,
    typeRecords,
    summary: {
      ...priorRegistry.summary,
      ...typeAccounting,
      ...referenceAccounting,
      INACTIVE_TYPE_DESCRIPTORS: 36,
    },
    phaseStatus: { ...priorRegistry.phaseStatus, ...phaseStatus },
  }
  if (previous) assert.deepEqual(currentRegistry, registry, 'OVERLAY_REGISTRY_MODEL_DRIFT')
  const historicalByteCommitments = {
    [files.packet]: inputHashes.packet,
    [files.w4t]: inputHashes.w4t,
    [files.w4fr]: inputHashes.w4fr,
    [files.w4t.replace(/\.json$/, '.md')]: sha(read(files.w4t.replace(/\.json$/, '.md'))),
  }
  if (previous) {
    assert.deepEqual(
      historicalByteCommitments,
      previous.preservation.historicalByteCommitments,
      'HISTORICAL_W4T_BYTE_DRIFT',
    )
    assert.deepEqual(
      sourceHashes,
      previous.preservation.sourceHashes,
      'FROZEN_CANDIDATE_SOURCE_DRIFT',
    )
  }
  return {
    registry,
    report: {
      metadata: {
        PHASE: 'PHASE_1B_3C_A1I_W4T1',
        INPUT_SHA256: inputHashes,
        SCOPE: 'FOUR_EXPLICIT_CURRENT_SELECTIONS_NO_DISCOVERY',
      },
      humanDecisionAuthority: {
        AUTHORITY: authority,
        RULE: 'FORWARD_CANONICAL_ENUM_DEFINITION=EXACT_CURRENT_ORDERED_DECLARATION',
        RATIONALE: rationale,
        STATIC_TIEBREAK_CLAIM: 'NO',
      },
      fourSelections,
      selectedDefinitions: fourSelections.map((selection) => selection.SELECTED_DEFINITION),
      historicalAlternatives: fourSelections.flatMap(
        (selection) => selection.HISTORICAL_ALTERNATIVES,
      ),
      typeAccounting,
      referenceAccounting,
      preDecisionRegistry: priorRegistry,
      preservation: {
        historicalByteCommitments,
        sourceHashes,
        HISTORICAL_W4T_BYTES_CHANGED: 'NO',
        PREVIOUS_32_RECORDS_SHA256: digest(unchanged32),
        REFERENCE_LINKS_SHA256: digest(priorRegistry.referenceLinks),
        OWNERSHIP_36_SHA256: digest(
          priorRegistry.typeRecords.map((record) => ({
            ID: record.CANONICAL_TYPE_IDENTITY,
            STATUS: record.OWNERSHIP_STATUS,
            AUTHORITY: record.OWNERSHIP_AUTHORITY,
            OWNER: record.CANONICAL_CREATION_AUTHORITY,
            EVIDENCE: record.EXISTING_AUTHORITY_EVIDENCE,
          })),
        ),
        UPSTREAM_BYTE_COMMITMENTS: priorReport.preservation,
        PRESERVED_SECTIONS: priorReport.preservedSections,
        PRIOR_GOVERNANCE: priorReport.priorGovernancePreservation,
        RELATION_COLUMN_GOVERNANCE: priorReport.governanceAccounting,
        PRESERVATION_SCOPE:
          '183/126/125;A/A/B;case_documents;310/127/127/372/82/4/86/118/803/23/four extensions/22 vector consumers;unchanged fixed upstream commitments inherited,no rediscovery',
      },
      inactiveDescriptors: {
        COUNT: 36,
        SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
        EXECUTION_ALLOWED: 'NO',
        EXECUTION_INTEGRATION: 'NONE',
      },
      validation: {
        closeoutChecks: [
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts',
            RESULT: 'PASS;26 tests;predecision and normalized persisted input modes',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\close-w4t-named-types.test.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
            RESULT:
              'PASS;171 tests;historical blocked model preserved;no predecessor generator CLI run',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts',
            RESULT: 'PASS;44 tests;frozen W4F behavior unchanged',
          },
          {
            COMMAND:
              'pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --types node scripts\\ue\\record-w4t1-human-type-selections.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts',
            RESULT:
              'PASS;exit0;negative ownership fixture corrected to preserve proper union types',
          },
          {
            COMMAND:
              'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\record-w4t1-human-type-selections.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts',
            RESULT: 'PASS;exit0;existing Next pages-directory diagnostic',
          },
          {
            COMMAND:
              'pnpm exec tsx scripts\\ue\\record-w4t1-human-type-selections.ts --self-test --check',
            RESULT: 'PASS;exact-byte two-generation equality and persisted registry/report check',
          },
          {
            COMMAND:
              'pnpm exec prettier --check scripts\\ue\\record-w4t1-human-type-selections.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.md docs\\union-eyes\\reality-remediation\\UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json docs\\union-eyes\\reality-remediation\\UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.md',
            RESULT: 'PASS;repository formatting',
          },
          {
            COMMAND: 'pnpm validate:docs',
            RESULT: 'PASS;0 errors;1215 existing warnings;2608 files scanned',
          },
          {
            COMMAND:
              'Independent Node crypto hash-only verification of fixed upstream/history/candidate files;exact32 records/38 links/36 nonexecutable definitions',
            RESULT: 'PASS;23 distinct frozen byte commitments;historical W4T remains BLOCKED',
          },
        ],
        EXACT_FOUR_CURRENT_CANDIDATES: 'PASS',
        EXACT_ORDER_TEXT_RANGE_DIGEST_SOURCE_HASH: 'PASS',
        ZERO_MERGED_DEFINITIONS: 'PASS',
        UNCHANGED_32_RECORDS: 'PASS',
        UNCHANGED_38_REFERENCES: 'PASS',
        UNCHANGED_36_OWNERSHIPS: 'PASS',
        FIXED_UPSTREAM_HASH_POSTURE:
          'Frozen W4T/W4FR hash commitments retained;independent verification at closeout;no source discovery',
      },
      proofBoundaries: {
        ...priorReport.proofBoundaries,
        TYPE_SQL_EXECUTED: 'NO',
        NAMED_TYPES_MATERIALIZED: 'NO',
        DATABASE_RUNTIME_CONFIGURATION_APPLIED: 'NO',
      },
      phaseStatus,
    },
  }
}
export async function generate() {
  const model = buildSelection()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  assert.equal(
    sha(
      await format(JSON.stringify(model.report.preDecisionRegistry), { ...config, parser: 'json' }),
    ),
    inputHashes.registry,
    'PREDECISION_REGISTRY_EXACT_BYTES_MISMATCH',
  )
  const registryBytes = await format(JSON.stringify(model.registry), { ...config, parser: 'json' })
  const report = { ...model.report, NORMALIZED_REGISTRY_SHA256: sha(registryBytes) }
  const selections = report.fourSelections
    .map((selection) => {
      const candidate = selection.SELECTED_DEFINITION
      return `## ${selection.CANONICAL_TYPE_IDENTITY}

Human selection: **CURRENT**;definition authority **HUMAN_ARCHITECTURE_W4T1**.
Source: [${candidate.SOURCE_FILE}](../../../${candidate.SOURCE_FILE}),lines${candidate.SOURCE_RANGE.join('-')}.
Source SHA256: \`${candidate.SOURCE_SHA256}\`.
Definition digest: \`${candidate.DEFINITION_DIGEST}\`.
Ordered member digest: \`${selection.ORDERED_MEMBERS_SHA256}\`.

Exact ordered members copied from the frozen candidate:

\`\`\`json
${JSON.stringify(candidate.ORDERED_ENUM_MEMBERS, null, 2)}
\`\`\`

${selection.HISTORICAL_ALTERNATIVES.map((alternative) => `Historical [${alternative.SOURCE_FILE}](../../../${alternative.SOURCE_FILE}),digest \`${alternative.DEFINITION_DIGEST}\`: **NON_CANONICAL_HISTORICAL_TYPE_DEFINITION**,PRESERVED=YES,COMPATIBILITY_EVIDENCE=YES.`).join('\n\n')}
`
    })
    .join('\n')
  const markdown = `# W4T1 - final four named-type human definition selections

**W4T1=PASS;normalized W4T=PASS;COMPLETE_NOT_EXECUTED.**

${report.humanDecisionAuthority.RATIONALE}

This is explicit human architecture authority,not a static-evidence tiebreaker. Ownership remains HUMAN_GOVERNANCE_W4T/PLATFORM_BASELINE for all36 types. The frozen blocked W4T evidence is unchanged.

${selections}
## Normalized accounting and inactive descriptors

Four exact CURRENT selections;MERGED_ENUM_DEFINITIONS=0;SELECTED_DEFINITIONS_MATCH_W4T_EVIDENCE=YES.
36/36 exact definitions,36 prospective platform authorities,0 authority/definition holds.
38/38 approved consumer references;0 held/unaccounted;exact consumer identities unchanged.
32 previously approved records are semantic-identical,including member lists and descriptors.
All36 inactive type descriptors have SQL_STATUS=DEFINITION_ONLY_NOT_EXECUTABLE,EXECUTION_ALLOWED=NO;none are wired to execution.

## Historical preservation

All current/historical candidate evidence remains. Historical alternatives are marked noncanonical compatibility evidence,not rewritten. Predecision registry is embedded in the [selection report](./PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json) for exact repeated checks of the32 records and38 links. Historical W4T JSON/Markdown/held packet and W4FR artifacts remain unchanged;upstream section/byte commitments are retained. No discovery or compatibility normalization.

## Validation

${report.validation.closeoutChecks.map((check) => `- \`${check.COMMAND}\`: **${check.RESULT}**.`).join('\n')}

Total distinct test coverage:241 passed. The original W4T --check is not run against the intentionally normalized registry;W4T1 --check validates the overlay and embedded exact predecision registry. Historical generators/artifacts are not rewritten or retried.

## State and proof boundaries

W4FR_RETRY=AUTHORIZED_NOT_STARTED;W4FR_RETRY_STARTED=NO.
CANONICAL_CONTRACT_VERSION=1.3.1;no1.3.2.
W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;W4P/W5=NOT_AUTHORIZED.
NAMED_TYPES_MATERIALIZED=NO;TYPE_SQL_EXECUTED=NO;all historical no-runtime proof boundaries retained.
READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
`
  return {
    [outputs.registry]: registryBytes,
    [outputs.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
    [outputs.registryMarkdown]: await format(
      `# W4 named-type dependency registry - W4T1 normalized overlay

**W4T1=PASS;W4T=PASS;COMPLETE_NOT_EXECUTED.**36 exact definitions/36 prospective platform authorities/38 approved references;0 holds.

The four frozen CURRENT candidates were selected under HUMAN_ARCHITECTURE_W4T1. Ownership remains HUMAN_GOVERNANCE_W4T. The32 previously exact records and38-reference consumer map are unchanged;current/historical evidence retained. All36 descriptors are DEFINITION_ONLY_NOT_EXECUTABLE/EXECUTION_ALLOWED=NO.

See [machine registry](./UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json) and [four exact selections and integrity evidence](./PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.md). The [blocked historical W4T report](./PHASE_1B_3C_A1I_W4T_NAMED_TYPE_PRODUCTION_CLOSURE.md) remains unchanged.

W4FR_RETRY=AUTHORIZED_NOT_STARTED;canonical1.3.1 unchanged;W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;W4P/W5=NOT_AUTHORIZED. No SQL execution,materialization,runtime proof or later phase.
`,
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_W4T1_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4T1')
    console.log('PASS W4T1 exact-byte two-generation self-test')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4T1_OUTPUT:${file}`)
    console.log('PASS W4T1 persisted registry/report check;historical bytes unchanged')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4T1 PASS;four exact CURRENT selections;W4FR retry authorized not started')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[record-w4t1-human-type-selections]', error)
    process.exitCode = 1
  })
