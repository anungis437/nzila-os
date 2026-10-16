import { describe, expect, it } from 'vitest'
import {
  applyHumanSelection,
  buildSelectionRecord,
  files,
  generate,
  humanDecisions,
  main,
  outputs,
  verifyVariant,
} from './record-w4h3-human-selections'
import type { buildPacket } from './extract-w4h2-blueprint-packet'
import type { buildGovernance } from './govern-w4-definition-doctrine'
import type { buildClosure } from './close-w4h1-residual-blueprints'
import { read, sha } from './w4-physical-producers'

const packet: ReturnType<typeof buildPacket> = JSON.parse(read(files.packet))
const w4h: Awaited<ReturnType<typeof buildGovernance>> = JSON.parse(read(files.w4h))
const w4h1: ReturnType<typeof buildClosure> = JSON.parse(read(files.w4h1))
function fixture() {
  return {
    card: structuredClone(packet.cards.find((card) => card.RELATION === 'public.consent_records')!),
    decision: structuredClone(humanDecisions[0]),
  }
}
describe('W4H3 human authority and exact frozen selection guards', () => {
  it('records precisely the human A/A/B selections with exact counts', () => {
    expect(
      humanDecisions.map((decision) => [
        decision.RELATION,
        decision.VARIANT_ID,
        decision.COLUMN_SET.length,
      ]),
    ).toEqual([
      ['public.consent_records', 'VARIANT_A', 22],
      ['public.automation_rules', 'VARIANT_A', 21],
      ['public.clc_sync_log', 'VARIANT_B', 23],
    ])
  })
  it('validates the exact source and declaration digest against the packet', () => {
    const { card, decision } = fixture()
    expect(verifyVariant(card, decision).DECLARATION_DIGEST).toBe(decision.DECLARATION_DIGEST)
  })
  it('rejects an unknown variant instead of choosing an alternative', () => {
    const { card, decision } = fixture()
    decision.VARIANT_ID = 'VARIANT_C'
    expect(() => verifyVariant(card, decision)).toThrow('UNKNOWN_HUMAN_SELECTED_VARIANT')
  })
  it('rejects source-file drift', () => {
    const { card, decision } = fixture()
    decision.SOURCE_FILE = 'another-source.ts'
    expect(() => verifyVariant(card, decision)).toThrow('SELECTED_SOURCE_MISMATCH')
  })
  it('rejects digest drift', () => {
    const { card, decision } = fixture()
    decision.DECLARATION_DIGEST = 'wrong'
    expect(() => verifyVariant(card, decision)).toThrow('SELECTED_DIGEST_MISMATCH')
  })
  it('rejects reordered columns even when set/count are unchanged', () => {
    const { card, decision } = fixture()
    decision.COLUMN_SET.reverse()
    expect(() => verifyVariant(card, decision)).toThrow('SELECTED_ORDERED_COLUMNS_MISMATCH')
  })
  it('rejects a union containing a rejected-only column', () => {
    const { card, decision } = fixture()
    decision.COLUMN_SET.push('channel')
    expect(() => verifyVariant(card, decision)).toThrow('SELECTED_ORDERED_COLUMNS_MISMATCH')
  })
  it('rejects losing an accepted column', () => {
    const { card, decision } = fixture()
    card.ACCEPTED_REQUIREMENTS.REQUIRED_COLUMNS.push('not_in_variant')
    expect(() => verifyVariant(card, decision)).toThrow()
  })
  it('rejects falsified declaration text despite a preserved digest label', () => {
    const { card, decision } = fixture()
    card.VARIANTS[0].EQUIVALENT_SOURCE_ALIASES[0].EXACT_CURRENT_DECLARATION_TEXT += 'changed'
    expect(() => verifyVariant(card, decision)).toThrow()
  })
  it('changes only the residual column-set property,not governed values or provenance', () => {
    const { card, decision } = fixture()
    const variant = verifyVariant(card, decision)
    const before = w4h.obligationGovernance.find(
      (record) => record.DEFINITION_OBLIGATION_ID === card.DEFINITION_OBLIGATION_ID,
    )!
    const result = applyHumanSelection(before, variant)
    expect(result.STATUS).toBe('ALL_PROPERTIES_GOVERNED')
    expect(result.RESIDUAL_PROPERTIES).toEqual([])
    expect(
      result.SELECTED_VALUES.filter((property) => property.PROPERTY !== 'CANONICAL_COLUMN_SET'),
    ).toEqual(
      before.SELECTED_VALUES.filter((property) => property.PROPERTY !== 'CANONICAL_COLUMN_SET'),
    )
    expect(before.STATUS).toBe('RESIDUAL_DECISION_REQUIRED')
  })
})
describe('W4H3 persistent complete governance overlay', () => {
  const report = buildSelectionRecord()
  it('records human rather than static-evidence authority and exact semantic scopes', () => {
    expect(report.humanSelectionAuthority).toMatchObject({
      DECISION_AUTHORITY: 'HUMAN_ARCHITECTURE_W4H3',
      STATIC_EVIDENCE_DECIDED_TIE: 'NO',
      HUMAN_CANONICALIZATION_DECISION: 'YES',
    })
    expect(report.threeSelections.map((selection) => selection.CANONICAL_SEMANTIC_SCOPE)).toEqual([
      'GENERAL_CONSENT_GOVERNANCE',
      'GENERAL_AUTOMATION_ENGINE',
      'GENERAL_CLC_SYNCHRONIZATION_LEDGER',
    ])
  })
  it('accounts for the exact three packet IDs and identities', () => {
    expect(report.threeSelections.map((selection) => selection.DESIGN_CHOICE_ID).sort()).toEqual(
      packet.cards.map((card) => card.DESIGN_CHOICE_ID).sort(),
    )
    expect(report.threeSelections.map((selection) => selection.PHYSICAL_IDENTITY).sort()).toEqual(
      packet.cards.map((card) => card.PHYSICAL_IDENTITY).sort(),
    )
    expect(
      new Set(report.threeSelections.map((selection) => selection.DEFINITION_OBLIGATION_ID)).size,
    ).toBe(3)
  })
  it('retains exact selected variants including source aliases and ordered column definitions', () => {
    for (const blueprint of report.selectedBlueprints) {
      const variant = packet.cards
        .find((card) => card.RELATION === blueprint.RELATION)!
        .VARIANTS.find((variant) => variant.VARIANT_ID === blueprint.VARIANT_ID)!
      expect(blueprint.EXACT_SELECTED_VARIANT).toEqual(variant)
      expect(blueprint.ORDERED_COLUMN_SET).toEqual(variant.COLUMN_SET)
      expect(blueprint.ORDERED_COLUMN_SET).toContain('organization_id')
      expect(
        blueprint.REJECTED_ONLY_COLUMNS_EXCLUDED.every(
          (column) => !blueprint.ORDERED_COLUMN_SET.includes(column),
        ),
      ).toBe(true)
    }
  })
  it('preserves all three rejected variants and aliases as non-canonical evidence', () => {
    expect(report.nonCanonicalAlternatives).toHaveLength(3)
    expect(report.nonCanonicalAlternatives.map((record) => record.VARIANT.VARIANT_ID)).toEqual([
      'VARIANT_B',
      'VARIANT_B',
      'VARIANT_A',
    ])
    for (const alternative of report.nonCanonicalAlternatives) {
      const before = packet.cards
        .find((card) => card.RELATION === alternative.RELATION)!
        .VARIANTS.find((variant) => variant.VARIANT_ID === alternative.VARIANT.VARIANT_ID)!
      expect(alternative.VARIANT).toEqual(before)
      expect(alternative.DISPOSITION).toBe('NON_CANONICAL_CURRENT_DECLARATION')
      expect(alternative.SOURCE_MUTATED).toBe('NO')
    }
  })
  it('accounts for all126 exact group IDs and183 exact obligation IDs,without residuals', () => {
    const accounting = report.governanceAccounting
    expect(accounting.groupAccounting.map((group) => group.DESIGN_CHOICE_ID).sort()).toEqual(
      w4h.groupDispositions.map((group) => group.DESIGN_CHOICE_ID).sort(),
    )
    expect(
      accounting.obligationAccounting
        .map((obligation) => obligation.DEFINITION_OBLIGATION_ID)
        .sort(),
    ).toEqual(
      w4h.obligationGovernance.map((obligation) => obligation.DEFINITION_OBLIGATION_ID).sort(),
    )
    expect(accounting).toMatchObject({
      DESIGN_GROUPS_TOTAL: 126,
      DESIGN_GROUPS_CLOSED: 126,
      DEFINITION_OBLIGATIONS_TOTAL: 183,
      DEFINITION_OBLIGATIONS_GOVERNED: 183,
      TRUE_BLUEPRINT_DECISIONS_PENDING: 0,
      RESIDUAL_HUMAN_DECISIONS: 0,
    })
    expect(
      accounting.obligationAccounting.every(
        (record) => record.STATUS === 'ALL_PROPERTIES_GOVERNED',
      ),
    ).toBe(true)
  })
  it('preserves every previously governed property digest for the180 prior obligations', () => {
    const priorGoverned = w4h.obligationGovernance.filter(
      (record) => record.STATUS === 'ALL_PROPERTIES_GOVERNED',
    )
    const approvals = w4h1.decisions.filter((record) => record.DECISION_STATUS === 'APPROVED')
    expect(priorGoverned.length + approvals.length).toBe(180)
    for (const prior of priorGoverned) {
      expect(
        report.governanceAccounting.obligationAccounting.find(
          (record) => record.DEFINITION_OBLIGATION_ID === prior.DEFINITION_OBLIGATION_ID,
        )!.GOVERNED_PROPERTIES_SHA256,
      ).toBe(sha(JSON.stringify(prior.SELECTED_VALUES)))
    }
    for (const approval of approvals) {
      expect(
        report.governanceAccounting.obligationAccounting.find(
          (record) => record.DEFINITION_OBLIGATION_ID === approval.DEFINITION_OBLIGATION_ID,
        )!.GOVERNED_PROPERTIES_SHA256,
      ).toBe(sha(JSON.stringify(approval.SELECTED_VALUES)))
    }
  })
  it('preserves the123 prior group dispositions and authority split', () => {
    const groups = report.governanceAccounting.groupAccounting
    expect(groups.filter((group) => group.AUTHORITY === 'PRESERVED_W4H_APPROVAL')).toHaveLength(121)
    expect(groups.filter((group) => group.AUTHORITY === 'PRESERVED_W4H1_APPROVAL')).toHaveLength(2)
    expect(groups.filter((group) => group.AUTHORITY === 'HUMAN_ARCHITECTURE_W4H3')).toHaveLength(3)
  })
  it('retains organization_id FK NONE/default/generation and all prior component provenance', () => {
    for (const selection of report.threeSelections) {
      const prior = w4h.obligationGovernance.find(
        (record) => record.DEFINITION_OBLIGATION_ID === selection.DEFINITION_OBLIGATION_ID,
      )!
      expect(
        selection.GOVERNED_OBLIGATION.SELECTED_VALUES.filter(
          (property) => property.PROPERTY !== 'CANONICAL_COLUMN_SET',
        ),
      ).toEqual(
        prior.SELECTED_VALUES.filter((property) => property.PROPERTY !== 'CANONICAL_COLUMN_SET'),
      )
      expect(
        selection.GOVERNED_OBLIGATION.SELECTED_VALUES.find(
          (property) => property.PROPERTY === 'organization_id.FOREIGN_KEY',
        )!.VALUE,
      ).toBe('NONE')
    }
  })
  it('normalizes W4H only in the new overlay,not the historical reports or canonical', () => {
    expect(report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4H3_GATE: 'PASS',
      PHASE_1B_3C_A1I_W4H: 'PASS',
      CANONICAL_DEFINITION_GOVERNANCE: 'COMPLETE',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4F_REGENERATION: 'AUTHORIZED_NOT_STARTED',
      W4F_REGENERATION_STARTED: 'NO',
      W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    })
    expect(w4h.phaseStatus.PHASE_1B_3C_A1I_W4H).toBe('BLOCKED')
    expect(w4h1.phaseStatus.PHASE_1B_3C_A1I_W4H1_GATE).toBe('BLOCKED_TRUE_BLUEPRINT_TIE')
    expect(report.proofBoundaries).toEqual(packet.proofBoundaries)
  })
  it('locks exact five fixed input bytes and prior preserved section commitments', () => {
    expect(Object.keys(report.preservation).sort()).toEqual(Object.values(files).sort())
    for (const [file, hash] of Object.entries(report.preservation))
      expect(sha(read(file))).toBe(hash)
    expect(report.priorGovernancePreservation.SECTION_DIGESTS).toEqual(packet.preservedSections)
  })
  it('creates exactly two deterministic supplemental outputs', async () => {
    const first = await generate()
    expect(Object.keys(first).sort()).toEqual(Object.values(outputs).sort())
    expect(await generate()).toEqual(first)
  })
  it.each(['--apply', '--execute', '--regenerate', '--sql', '--unknown'])(
    'rejects unauthorized flag %s before writes',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG')
    },
  )
})
