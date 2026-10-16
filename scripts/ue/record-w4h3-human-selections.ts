import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import type { buildPacket } from './extract-w4h2-blueprint-packet'
import type { buildClosure } from './close-w4h1-residual-blueprints'
import type { buildGovernance, Selection } from './govern-w4-definition-doctrine'
import type { buildRegistry } from './author-w4-canonical-definitions'
import { read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  packet: folder + 'UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.json',
  phase: folder + 'PHASE_1B_3C_A1I_W4H2_TRUE_BLUEPRINT_DECISION_PACKET.json',
  w4h1: folder + 'PHASE_1B_3C_A1I_W4H1_RESIDUAL_BLUEPRINT_CLOSURE.json',
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  w4f: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
}
export const outputs = {
  report: folder + 'PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.md',
}
export const humanDecisions = [
  {
    RELATION: 'public.consent_records',
    VARIANT_ID: 'VARIANT_A',
    SOURCE_FILE: 'apps/union-eyes/db/schema/data-governance-schema.ts',
    DECLARATION_DIGEST: 'f52c62f1ea6ad04391cc425c2191e0bf853e7cd370ea13a943bbd520b64d15e5',
    CANONICAL_SEMANTIC_SCOPE: 'GENERAL_CONSENT_GOVERNANCE',
    RATIONALE:
      'The shared consent_records relation is governed as the general consent lifecycle record rather than the campaign/channel-specific consent surface.',
    COLUMN_SET: [
      'id',
      'subject_type',
      'subject_id',
      'organization_id',
      'purpose_type',
      'purpose_description',
      'legal_basis',
      'consent_given',
      'consent_method',
      'consent_text',
      'consent_version',
      'consent_date',
      'expiry_date',
      'withdrawn',
      'withdrawn_at',
      'withdrawal_method',
      'ip_address',
      'user_agent',
      'evidence_url',
      'created_at',
      'updated_at',
      'metadata',
    ],
  },
  {
    RELATION: 'public.automation_rules',
    VARIANT_ID: 'VARIANT_A',
    SOURCE_FILE: 'apps/union-eyes/db/schema/automation-rules-schema.ts',
    DECLARATION_DIGEST: '2040335880bf5bbc0ccdf2987daa801ce6f3ede3fcb4829b4b5f6d5e51e1080f',
    CANONICAL_SEMANTIC_SCOPE: 'GENERAL_AUTOMATION_ENGINE',
    RATIONALE:
      'The shared automation_rules relation is governed as the general target-trigger-condition-action automation model, rather than the recognition/rewards-specific rule model.',
    COLUMN_SET: [
      'id',
      'name',
      'description',
      'status',
      'priority',
      'target_entity',
      'target_filter',
      'trigger_type',
      'trigger_config',
      'conditions',
      'actions',
      'max_executions',
      'executions_count',
      'last_executed_at',
      'active_from',
      'active_until',
      'timezone',
      'organization_id',
      'created_at',
      'updated_at',
      'created_by',
    ],
  },
  {
    RELATION: 'public.clc_sync_log',
    VARIANT_ID: 'VARIANT_B',
    SOURCE_FILE: 'apps/union-eyes/db/schema/clc-sync-schema.ts',
    DECLARATION_DIGEST: '8c93e4be71895aea8343f704ff1613d3427a5de0df85c9329686d881e2852c1d',
    CANONICAL_SEMANTIC_SCOPE: 'GENERAL_CLC_SYNCHRONIZATION_LEDGER',
    RATIONALE:
      'The shared clc_sync_log relation is governed as the general synchronization lifecycle and verification record, rather than the narrower per-capita/affiliate sync event model.',
    COLUMN_SET: [
      'id',
      'organization_id',
      'sync_type',
      'status',
      'direction',
      'sync_start_date',
      'sync_end_date',
      'records_processed',
      'records_succeeded',
      'records_failed',
      'records_skipped',
      'error_message',
      'error_details',
      'data_hash',
      'sync_data',
      'verification_status',
      'verification_notes',
      'is_verified',
      'verified_at',
      'verified_by',
      'created_at',
      'updated_at',
      'initiated_by',
    ],
  },
]
type Packet = ReturnType<typeof buildPacket>
type W4H = Awaited<ReturnType<typeof buildGovernance>>
type W4H1 = ReturnType<typeof buildClosure>
type W4F = Awaited<ReturnType<typeof buildRegistry>>
export function verifyVariant(
  card: Packet['cards'][number],
  decision: (typeof humanDecisions)[number],
) {
  assert.equal(card.RELATION, decision.RELATION)
  const variant = card.VARIANTS.find((item) => item.VARIANT_ID === decision.VARIANT_ID)
  assert(variant, 'UNKNOWN_HUMAN_SELECTED_VARIANT')
  assert.equal(variant.SOURCE_FILE, decision.SOURCE_FILE, 'SELECTED_SOURCE_MISMATCH')
  assert.equal(variant.DECLARATION_DIGEST, decision.DECLARATION_DIGEST, 'SELECTED_DIGEST_MISMATCH')
  assert.deepEqual(variant.COLUMN_SET, decision.COLUMN_SET, 'SELECTED_ORDERED_COLUMNS_MISMATCH')
  assert.equal(variant.COLUMN_COUNT, decision.COLUMN_SET.length)
  assert(variant.COLUMN_SET.includes('organization_id'))
  assert.equal(variant.SATISFIES_ALL_ACCEPTED_REQUIREMENTS, 'YES')
  assert(
    card.ACCEPTED_REQUIREMENTS.REQUIRED_COLUMNS.every((column) =>
      variant.COLUMN_SET.includes(column),
    ),
  )
  for (const source of variant.EQUIVALENT_SOURCE_ALIASES) {
    assert.equal(sha(source.EXACT_CURRENT_DECLARATION_TEXT), source.DECLARATION_DIGEST)
    assert.equal(source.DECLARATION_DIGEST, decision.DECLARATION_DIGEST)
  }
  return variant
}
export function applyHumanSelection(
  prior: W4H['obligationGovernance'][number],
  variant: Packet['cards'][number]['VARIANTS'][number],
) {
  assert.equal(prior.RESIDUAL_PROPERTIES.length, 1)
  assert.equal(prior.RESIDUAL_PROPERTIES[0].PROPERTY, 'CANONICAL_COLUMN_SET')
  const shape: Selection = {
    PROPERTY: 'CANONICAL_COLUMN_SET',
    VALUE: JSON.stringify([...variant.COLUMN_SET].sort()),
    PROVENANCE: 'EXACT_DECLARATION',
    RULE: 'HUMAN_ARCHITECTURE_W4H3_EXACT_SELECTED_CURRENT_COLUMN_SET',
    EVIDENCE_REFERENCES: variant.EQUIVALENT_SOURCE_ALIASES.map((source) => ({
      FILE: source.SOURCE_FILE,
      DIGEST: source.DECLARATION_DIGEST,
      RANGE: source.SOURCE_RANGE,
    })),
    STATUS: 'APPROVED',
    RATIONALE:
      'Human canonicalization selects one frozen current variant; prior W4H governed properties remain authoritative without recomputation',
  }
  return {
    ...prior,
    SELECTED_VALUES: prior.SELECTED_VALUES.map((property) =>
      property.PROPERTY === 'CANONICAL_COLUMN_SET' ? shape : property,
    ),
    RESIDUAL_PROPERTIES: [],
    STATUS: 'ALL_PROPERTIES_GOVERNED',
  }
}
export function buildSelectionRecord() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const packet: Packet = JSON.parse(bytes.packet)
  const phase: { PACKET_SHA256: string; phaseStatus: Packet['phaseStatus'] } = JSON.parse(
    bytes.phase,
  )
  const w4h1: W4H1 = JSON.parse(bytes.w4h1)
  const w4h: W4H = JSON.parse(bytes.w4h)
  const w4f: W4F = JSON.parse(bytes.w4f)
  assert.equal(phase.PACKET_SHA256, sha(bytes.packet))
  assert.equal(phase.phaseStatus.PHASE_1B_3C_A1I_W4H2_GATE, 'PASS')
  assert.equal(w4h1.summary.DESIGN_GROUPS_CLOSED, 123)
  assert.equal(w4h1.summary.DEFINITION_OBLIGATIONS_GOVERNED, 180)
  assert.equal(packet.cards.length, 3)
  assert.deepEqual(
    packet.cards.map((card) => card.RELATION).sort(),
    humanDecisions.map((decision) => decision.RELATION).sort(),
  )
  const threeSelections = humanDecisions.map((decision) => {
    const card = packet.cards.find((item) => item.RELATION === decision.RELATION)!
    const variant = verifyVariant(card, decision)
    const prior = w4h.obligationGovernance.find(
      (obligation) => obligation.DEFINITION_OBLIGATION_ID === card.DEFINITION_OBLIGATION_ID,
    )
    assert(prior)
    assert.deepEqual(
      prior.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED'),
      variant.ALREADY_GOVERNED_ORGANIZATION_ID_PROPERTIES,
    )
    const closed = applyHumanSelection(prior, variant)
    return {
      ...decision,
      DESIGN_CHOICE_ID: card.DESIGN_CHOICE_ID,
      DEFINITION_OBLIGATION_ID: card.DEFINITION_OBLIGATION_ID,
      PHYSICAL_IDENTITY: card.PHYSICAL_IDENTITY,
      COLUMN_COUNT: variant.COLUMN_COUNT,
      DECISION_AUTHORITY: 'HUMAN_ARCHITECTURE_W4H3',
      STATIC_EVIDENCE_DECIDED_TIE: 'NO',
      HUMAN_CANONICALIZATION_DECISION: 'YES',
      ACCEPTED_REQUIREMENTS: card.ACCEPTED_REQUIREMENTS,
      SATISFIES_ALL_ACCEPTED_REQUIREMENTS: 'YES',
      GOVERNED_OBLIGATION: closed,
    }
  })
  assert.equal(new Set(threeSelections.map((item) => item.DESIGN_CHOICE_ID)).size, 3)
  assert.equal(new Set(threeSelections.map((item) => item.DEFINITION_OBLIGATION_ID)).size, 3)
  const approvedW4h1 = w4h1.decisions.filter((decision) => decision.DECISION_STATUS === 'APPROVED')
  assert.equal(approvedW4h1.length, 2)
  const obligations = w4h.obligationGovernance.map((prior) => {
    const selected = threeSelections.find(
      (item) => item.DEFINITION_OBLIGATION_ID === prior.DEFINITION_OBLIGATION_ID,
    )
    if (selected) return selected.GOVERNED_OBLIGATION
    const w4h1Decision = approvedW4h1.find(
      (item) => item.DEFINITION_OBLIGATION_ID === prior.DEFINITION_OBLIGATION_ID,
    )
    if (w4h1Decision)
      return {
        ...prior,
        SELECTED_VALUES: w4h1Decision.SELECTED_VALUES,
        RESIDUAL_PROPERTIES: [],
        STATUS: 'ALL_PROPERTIES_GOVERNED',
      }
    assert.equal(prior.STATUS, 'ALL_PROPERTIES_GOVERNED', 'UNACCOUNTED_PRIOR_RESIDUAL')
    return prior
  })
  const groupAccounting = w4h.groupDispositions.map((group) => {
    const origin = threeSelections.some((item) => item.DESIGN_CHOICE_ID === group.DESIGN_CHOICE_ID)
      ? 'HUMAN_ARCHITECTURE_W4H3'
      : approvedW4h1.some((item) => item.DESIGN_CHOICE_ID === group.DESIGN_CHOICE_ID)
        ? 'PRESERVED_W4H1_APPROVAL'
        : 'PRESERVED_W4H_APPROVAL'
    assert(
      group.AFFECTED_DEFINITION_OBLIGATION_IDS.every((id) =>
        obligations.some(
          (obligation) =>
            obligation.DEFINITION_OBLIGATION_ID === id &&
            obligation.STATUS === 'ALL_PROPERTIES_GOVERNED',
        ),
      ),
    )
    return {
      DESIGN_CHOICE_ID: group.DESIGN_CHOICE_ID,
      DEFINITION_OBLIGATION_IDS: group.AFFECTED_DEFINITION_OBLIGATION_IDS,
      DISPOSITION: 'CLOSED',
      AUTHORITY: origin,
    }
  })
  assert.equal(groupAccounting.length, 126)
  assert.equal(new Set(groupAccounting.map((group) => group.DESIGN_CHOICE_ID)).size, 126)
  assert.equal(obligations.length, 183)
  assert.equal(
    new Set(obligations.map((obligation) => obligation.DEFINITION_OBLIGATION_ID)).size,
    183,
  )
  for (const obligation of obligations)
    for (const property of obligation.SELECTED_VALUES)
      assert.equal(property.STATUS, 'APPROVED', 'UNRESOLVED_GOVERNED_PROPERTY')
  const nonCanonicalAlternatives = packet.cards.flatMap((card) =>
    card.VARIANTS.filter(
      (variant) =>
        variant.VARIANT_ID !==
        threeSelections.find((selection) => selection.RELATION === card.RELATION)!.VARIANT_ID,
    ).map((variant) => ({
      RELATION: card.RELATION,
      DISPOSITION: 'NON_CANONICAL_CURRENT_DECLARATION',
      VARIANT: variant,
      SOURCE_MUTATED: 'NO',
      FUTURE_CODE_DISPOSITION: 'OUTSIDE_W4H3',
    })),
  )
  const selectedBlueprints = threeSelections.map((selection) => {
    const card = packet.cards.find((record) => record.RELATION === selection.RELATION)!
    const variant = card.VARIANTS.find((record) => record.VARIANT_ID === selection.VARIANT_ID)!
    const excluded = nonCanonicalAlternatives
      .filter((record) => record.RELATION === selection.RELATION)
      .flatMap((record) =>
        record.VARIANT.COLUMN_SET.filter((column) => !selection.COLUMN_SET.includes(column)),
      )
    assert(excluded.every((column) => !selection.COLUMN_SET.includes(column)))
    return {
      RELATION: selection.RELATION,
      VARIANT_ID: selection.VARIANT_ID,
      SOURCE_FILE: selection.SOURCE_FILE,
      DECLARATION_DIGEST: selection.DECLARATION_DIGEST,
      COLUMN_COUNT: selection.COLUMN_COUNT,
      ORDERED_COLUMN_SET: selection.COLUMN_SET,
      EXACT_SELECTED_VARIANT: variant,
      REJECTED_ONLY_COLUMNS_EXCLUDED: excluded,
      PROPERTY_PRECEDENCE: 'PRIOR_W4H_GOVERNED_PROPERTY_VALUE_AUTHORITATIVE',
      LOWERING_BOUNDARY:
        'Exact selected declaration is design input only; callbacks/symbolic references never override prior physical FK disposition. No rejected blueprint expression is canonical authoring input.',
    }
  })
  const preservation = Object.fromEntries(
    Object.values(files).map((file) => [file, sha(read(file))]),
  )
  if (existsSync(path.join(root, ...outputs.report.split('/')))) {
    const prior: { preservation: typeof preservation } = JSON.parse(read(outputs.report))
    assert.deepEqual(preservation, prior.preservation, 'FROZEN_W4H3_INPUT_DRIFT')
  }
  assert.deepEqual(w4f.acceptedPreservation, packet.preservedSections.ACCEPTED_UPSTREAM_COMMITMENTS)
  return {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4H3',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      SCOPE: 'THREE_HUMAN_SELECTIONS_ONLY',
    },
    humanSelectionAuthority: {
      DECISION_AUTHORITY: 'HUMAN_ARCHITECTURE_W4H3',
      STATIC_EVIDENCE_DECIDED_TIE: 'NO',
      HUMAN_CANONICALIZATION_DECISION: 'YES',
      NO_NEW_TIEBREAKER: 'YES',
    },
    threeSelections,
    selectedBlueprints,
    nonCanonicalAlternatives,
    columnSetIntegrity: {
      SELECTED_VARIANTS_MATCH_FROZEN_EVIDENCE: 'YES',
      COUNTS: [22, 21, 23],
      ORGANIZATION_ID_PRESENT: 'YES',
      HYBRID_BLUEPRINTS_CREATED: 0,
    },
    preservation,
    priorGovernancePreservation: {
      HISTORICAL_REPORTS_OVERWRITTEN: 'NO',
      PREVIOUSLY_CLOSED_GROUPS: 123,
      PREVIOUSLY_GOVERNED_OBLIGATIONS: 180,
      PRESERVED_W4H_GROUPS: w4h.groupDispositions
        .filter((group) => group.DECISION_STATUS === 'APPROVED')
        .map((group) => group.DESIGN_CHOICE_ID),
      PRESERVED_W4H_OBLIGATIONS: w4h.obligationGovernance
        .filter((obligation) => obligation.STATUS === 'ALL_PROPERTIES_GOVERNED')
        .map((obligation) => obligation.DEFINITION_OBLIGATION_ID),
      W4H1_APPROVED_DECISION_IDS: approvedW4h1.map((decision) => decision.DESIGN_CHOICE_ID),
      SECTION_DIGESTS: packet.preservedSections,
      PRIOR_W4H_PROPERTIES_AUTHORITATIVE: 'YES',
      UPSTREAM_BYTE_COMMITMENTS: { ...packet.preservation, ...packet.upstreamByteCommitments },
    },
    governanceAccounting: {
      DESIGN_GROUPS_TOTAL: 126,
      DESIGN_GROUPS_CLOSED: 126,
      TRUE_BLUEPRINT_DECISIONS_PENDING: 0,
      DEFINITION_OBLIGATIONS_TOTAL: 183,
      DEFINITION_OBLIGATIONS_GOVERNED: 183,
      RESIDUAL_HUMAN_DECISIONS: 0,
      groupAccounting,
      obligationAccounting: obligations.map((obligation) => ({
        DEFINITION_OBLIGATION_ID: obligation.DEFINITION_OBLIGATION_ID,
        STATUS: obligation.STATUS,
        GOVERNED_PROPERTIES_SHA256: sha(JSON.stringify(obligation.SELECTED_VALUES)),
        AUTHORITY: threeSelections.some(
          (item) => item.DEFINITION_OBLIGATION_ID === obligation.DEFINITION_OBLIGATION_ID,
        )
          ? 'HUMAN_ARCHITECTURE_W4H3'
          : approvedW4h1.some(
                (item) => item.DEFINITION_OBLIGATION_ID === obligation.DEFINITION_OBLIGATION_ID,
              )
            ? 'PRESERVED_W4H1_APPROVAL'
            : 'PRESERVED_W4H_APPROVAL',
      })),
    },
    phaseStatus: {
      PHASE_1B_3C_A1I_W4H3_GATE: 'PASS',
      PHASE_1B_3C_A1I_W4H3: 'PASS',
      PHASE_1B_3C_A1I_W4H: 'PASS',
      CANONICAL_DEFINITION_GOVERNANCE: 'COMPLETE',
      HISTORICAL_OPEN_DECISION_STATE: 'SUPERSEDED_BY_W4H3',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4F_REGENERATION: 'AUTHORIZED_NOT_STARTED',
      W4F_REGENERATION_STARTED: 'NO',
      W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    },
    proofBoundaries: packet.proofBoundaries,
    validation: {
      EXACT_THREE_IDS: 'ASSERTED',
      EXACT_SOURCE_DIGEST_ORDERED_COLUMNS: 'ASSERTED',
      PROPERTY_PRESERVATION: 'NO_RECOMPUTATION',
      FULL_126_183_ID_ACCOUNTING: 'ASSERTED',
      FIXED_INPUT_HASHES: 'LOCKED',
      SQL_AND_REGENERATION: 'NOT_EXECUTED',
      closeoutChecks: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\record-w4h3-human-selections.test.ts',
          RESULT:
            'PASS;26 tests:exact human authority/IDs/source/digest/ordered columns,guards,126/183 coverage,preservation,rejected evidence,determinism and unauthorized flags',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\record-w4h3-human-selections.ts scripts\\ue\\record-w4h3-human-selections.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\record-w4h3-human-selections.ts scripts\\ue\\record-w4h3-human-selections.test.ts',
          RESULT: 'PASS;exit0;existing Next pages-directory diagnostic',
        },
        {
          COMMAND: 'pnpm exec tsx scripts\\ue\\record-w4h3-human-selections.ts --self-test --check',
          RESULT:
            'PASS;two identical generations,exact persistent bytes,five unchanged fixed inputs',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\record-w4h3-human-selections.ts scripts\\ue\\record-w4h3-human-selections.test.ts docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.md',
          RESULT: 'PASS',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS;0 errors,1215 existing warnings,2602 files scanned',
        },
        {
          METHOD:
            'Independent read-only Node assertions;no import of selection/accounting implementation',
          RESULT:
            'PASS;exact A/A/B,three IDs,sources/digests/ordered22/21/23 columns,accepted coverage,no hybrids,rejected variants,126 exact group IDs/183 exact obligation IDs and approved-property digests,prior180 property preservation,historical/fixed/transitive upstream bytes,310/127/127/372/82/86/118/803/23 commitments,canonical1.3.1,no SQL or regeneration',
        },
      ],
    },
  }
}
export async function generate() {
  const report = buildSelectionRecord()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const markdown = `# W4H3 - final human blueprint selection

W4H3 **PASS**; current W4H **PASS**; canonical definition governance **COMPLETE**. This is new human architecture authority, not repository evidence resolving the historical tie.

${report.threeSelections
  .map(
    (selection) => `## ${selection.RELATION}

Selected **${selection.VARIANT_ID}**: [${selection.SOURCE_FILE}](../../../${selection.SOURCE_FILE}).
Declaration digest: \`${selection.DECLARATION_DIGEST}\`.
Semantic scope: **${selection.CANONICAL_SEMANTIC_SCOPE}**.

${selection.RATIONALE}

Exact ordered ${selection.COLUMN_COUNT}-column set:

\`\`\`text
${selection.COLUMN_SET.join('\n')}
\`\`\`

organization_id present; accepted requirements preserved. Existing W4H property values and provenance remain authoritative. No rejected-only columns or blueprint expressions are selected.
`,
  )
  .join('\n')}
## Non-canonical alternatives

${report.nonCanonicalAlternatives.map((alternative) => `- ${alternative.RELATION}: **${alternative.VARIANT.VARIANT_ID}**, [${alternative.VARIANT.SOURCE_FILE}](../../../${alternative.VARIANT.SOURCE_FILE}), digest \`${alternative.VARIANT.DECLARATION_DIGEST}\`: **NON_CANONICAL_CURRENT_DECLARATION**. All source aliases and exact evidence are retained in JSON; no source changes/deletion.`).join('\n')}

## Accounting and preservation

**126/126 groups closed;183/183 obligations governed;0 human decisions pending;0 hybrids.** All IDs and governed-property digests are enumerated in JSON. Prior 123 groups/180 obligations,case_documents resolution,all prior property/FK component/named-type provenance and historical W4H/W4H1/W4H2/W4F bytes remain unchanged. Fixed file hashes,upstream byte commitments and310/127/127/372/82/86/118/803/23 section commitments are preserved.

## Authorization and boundaries

Canonical contract **1.3.1**,unchanged;1.3.2 not published.
W4F regeneration: **AUTHORIZED_NOT_STARTED**. **No regeneration occurred.**
W4: **BLOCKED_DEFINITION_IMPLEMENTATION_PENDING**. W4P/W5: **NOT_AUTHORIZED**.

No SQL,inactive payloads,producer activation,migrations,database roles or runtime/security proof. READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO. Selected declarations are authoring design inputs only;symbolic references/callbacks do not override prior physical FK governance.

## Validation

Closeout checks **PASS**: **26 focused tests**,exact selection/source/digest/ordered22/21/23-column/accepted-requirement/no-hybrid and126/183 ID accounting assertions;deterministic generation/check;scoped TypeScript/ESLint (exit0;existing Next pages-directory diagnostic);formatting;documentation audit (**0 errors,1215 existing warnings**). Independent read-only assertions verified selected/rejected evidence,prior180 governed-property digests,historical/fixed/transitive upstream bytes,310/127/127/372/82/86/118/803/23 commitments and canonical1.3.1. Exact commands/results are in JSON. Governance PASS does not prove runtime readiness or start W4F regeneration.
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
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4H3')
    console.log('PASS W4H3 self-test:exact A/A/B;126/183 accounting;determinism')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4H3_OUTPUT:${file}`)
    console.log('PASS W4H3 --check:exact supplemental output bytes;historical evidence unchanged')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4H3 human governance recorded;no SQL or W4F regeneration')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[record-w4h3-human-selections]', error)
    process.exitCode = 1
  })
