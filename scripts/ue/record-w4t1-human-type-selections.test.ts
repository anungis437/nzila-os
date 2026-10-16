import { describe, expect, it } from 'vitest'
import {
  buildSelection,
  files,
  main,
  selectedIdentities,
  selectCurrent,
  verifyCandidate,
} from './record-w4t1-human-type-selections'
import { digest, read, sha } from './w4-physical-producers'

const model = buildSelection()
const prior = model.report.preDecisionRegistry
const held = prior.typeRecords.find(
  (record) => record.GOVERNED_TYPE_NAME === 'fee_adjustment_type',
)!
const current = held.TYPE_DEFINITION_EVIDENCE.find(
  (candidate) => candidate.EVIDENCE_CLASS === 'CURRENT',
)!
describe('W4T1 exact explicit human architecture selections', () => {
  it('selects exactly four frozen current candidates,not inferred supersets', () => {
    expect(
      model.report.fourSelections.map((selection) => selection.CANONICAL_TYPE_IDENTITY),
    ).toEqual(selectedIdentities)
    for (const selection of model.report.fourSelections) {
      const frozen = prior.typeRecords.find(
        (record) => record.CANONICAL_TYPE_IDENTITY === selection.CANONICAL_TYPE_IDENTITY,
      )!
      expect(selection.SELECTED_DEFINITION).toEqual(
        frozen.TYPE_DEFINITION_EVIDENCE.find((candidate) => candidate.EVIDENCE_CLASS === 'CURRENT'),
      )
      expect(selection.HUMAN_SELECTION).toBe('CURRENT')
      expect(selection.DEFINITION_DECISION_AUTHORITY).toBe('HUMAN_ARCHITECTURE_W4T1')
      expect(selection.NORMALIZED_TYPE_RECORD.EVIDENCE_CLASS).toBe('CONFLICTING_TYPE_DEFINITIONS')
      expect(selection.ORDERED_MEMBERS_SHA256).toBe(
        digest(selection.SELECTED_DEFINITION.ORDERED_ENUM_MEMBERS),
      )
    }
  })
  it.each([
    [
      'fee_adjustment_type',
      ['reversal', 'partial_reversal', 'waiver', 'correction', 'dispute_credit'],
    ],
    [
      'ledger_event_type',
      [
        'invoice_generated',
        'payment_received',
        'allocation_run',
        'adjustment_posted',
        'credit_applied',
        'subsidy_applied',
        'writeoff_posted',
        'period_closed',
        'reversal',
        'fee_captured',
        'settlement_closed',
      ],
    ],
    [
      'ledger_source_type',
      [
        'subscription',
        'invoice',
        'payment',
        'adjustment',
        'allocation',
        'manual',
        'system',
        'transaction_fee',
        'settlement_batch',
      ],
    ],
    [
      'platform_cost_type',
      [
        'base_subscription',
        'local_fee',
        'seat_fee',
        'module_fee',
        'usage_fee',
        'onboarding_fee',
        'support_fee',
        'transaction_fee',
        'settlement',
        'adjustment',
        'credit',
        'subsidy',
        'writeoff',
      ],
    ],
  ])('retains exact selected ordered list for %s', (name, members) => {
    expect(
      model.report.selectedDefinitions.find((candidate) => candidate.TYPE_NAME === name)
        ?.ORDERED_ENUM_MEMBERS,
    ).toEqual(members)
  })
  it('verifies every recorded candidate source hash,exact text/range and digest without extraction', () => {
    for (const selection of model.report.fourSelections)
      for (const candidate of selection.NORMALIZED_TYPE_RECORD.TYPE_DEFINITION_EVIDENCE)
        expect(() => verifyCandidate(candidate, read(candidate.SOURCE_FILE))).not.toThrow()
    expect(Object.keys(model.report.preservation.sourceHashes)).toHaveLength(5)
  })
  it('fails source-byte drift', () => {
    expect(() => verifyCandidate(current, read(current.SOURCE_FILE) + '\n')).toThrow(
      'FROZEN_SOURCE_DRIFT',
    )
  })
  it('fails recorded declaration digest drift', () => {
    expect(() =>
      verifyCandidate({ ...current, DEFINITION_DIGEST: 'bad' }, read(current.SOURCE_FILE)),
    ).toThrow('DEFINITION_DIGEST_MISMATCH')
  })
  it('fails range drift', () => {
    expect(() =>
      verifyCandidate({ ...current, SOURCE_RANGE: [1, 1] }, read(current.SOURCE_FILE)),
    ).toThrow('DEFINITION_RANGE_TEXT_MISMATCH')
  })
  it('refuses mismatching packet/registry member lists', () => {
    expect(() =>
      selectCurrent(
        held,
        held.TYPE_DEFINITION_EVIDENCE.map((candidate) =>
          candidate.EVIDENCE_CLASS === 'CURRENT'
            ? { ...candidate, ORDERED_ENUM_MEMBERS: ['synthetic'] }
            : candidate,
        ),
      ),
    ).toThrow('CANDIDATE_PACKET_REGISTRY_MISMATCH')
  })
  it('refuses zero or duplicate current candidates rather than guessing', () => {
    const historical = held.TYPE_DEFINITION_EVIDENCE.filter(
      (candidate) => candidate.EVIDENCE_CLASS === 'HISTORICAL',
    )
    expect(() =>
      selectCurrent({ ...held, TYPE_DEFINITION_EVIDENCE: historical }, historical),
    ).toThrow('EXACTLY_ONE_CURRENT_CANDIDATE_REQUIRED')
    const duplicate = [...held.TYPE_DEFINITION_EVIDENCE, current]
    expect(() =>
      selectCurrent({ ...held, TYPE_DEFINITION_EVIDENCE: duplicate }, duplicate),
    ).toThrow('EXACTLY_ONE_CURRENT_CANDIDATE_REQUIRED')
  })
  it('does not reopen settled ownership or approve an incomplete current candidate', () => {
    expect(() =>
      selectCurrent(
        { ...held, OWNERSHIP_AUTHORITY: null, CANONICAL_CREATION_AUTHORITY: null },
        held.TYPE_DEFINITION_EVIDENCE,
      ),
    ).toThrow()
    const incomplete = held.TYPE_DEFINITION_EVIDENCE.map((candidate) =>
      candidate.EVIDENCE_CLASS === 'CURRENT'
        ? { ...candidate, DEFINITION_COMPLETE: false }
        : candidate,
    )
    expect(() =>
      selectCurrent({ ...held, TYPE_DEFINITION_EVIDENCE: incomplete }, incomplete),
    ).toThrow()
  })
  it('retains exact historical candidates with separate noncanonical dispositions', () => {
    expect(model.report.historicalAlternatives).toHaveLength(6)
    for (const selection of model.report.fourSelections) {
      const frozen = prior.typeRecords.find(
        (record) => record.CANONICAL_TYPE_IDENTITY === selection.CANONICAL_TYPE_IDENTITY,
      )!
      expect(
        selection.HISTORICAL_ALTERNATIVES.map(
          ({ DISPOSITION, PRESERVED, COMPATIBILITY_EVIDENCE, ...candidate }) => {
            expect(DISPOSITION).toBe('NON_CANONICAL_HISTORICAL_TYPE_DEFINITION')
            expect(PRESERVED).toBe('YES')
            expect(COMPATIBILITY_EVIDENCE).toBe('YES')
            return candidate
          },
        ),
      ).toEqual(
        frozen.TYPE_DEFINITION_EVIDENCE.filter(
          (candidate) => candidate.EVIDENCE_CLASS === 'HISTORICAL',
        ),
      )
    }
  })
  it('records human forward-definition authority,not a fabricated static evidence class', () => {
    expect(model.report.humanDecisionAuthority.STATIC_TIEBREAK_CLAIM).toBe('NO')
    expect(model.report.typeAccounting.MERGED_ENUM_DEFINITIONS).toBe(0)
    expect(model.report.typeAccounting.SELECTED_DEFINITIONS_MATCH_W4T_EVIDENCE).toBe('YES')
  })
  it('preserves all32 previously approved records semantic-identically', () => {
    const unchanged = (records: typeof prior.typeRecords) =>
      records.filter((record) => !selectedIdentities.includes(record.CANONICAL_TYPE_IDENTITY))
    expect(unchanged(model.registry.typeRecords)).toEqual(unchanged(prior.typeRecords))
    expect(unchanged(prior.typeRecords)).toHaveLength(32)
    expect(digest(unchanged(model.registry.typeRecords))).toBe(
      model.report.preservation.PREVIOUS_32_RECORDS_SHA256,
    )
  })
  it('normalizes exactly36 definitions and retains36 prospective platform authorities', () => {
    expect(model.report.typeAccounting).toMatchObject({
      DISTINCT_NAMED_TYPES: 36,
      EXISTING_CANONICAL_AUTHORITY: 0,
      PLATFORM_BASELINE_GOVERNANCE_ADOPTED: 36,
      HELD_CONFLICTING_AUTHORITY: 0,
      EXACT_DEFINITION_AVAILABLE: 36,
      HELD_DEFINITION_INCOMPLETE: 0,
      HELD_DEFINITION_CONFLICT: 0,
      SUM_OWNERSHIP: 36,
      SUM_DEFINITION: 36,
    })
    for (const record of model.registry.typeRecords) {
      const before = prior.typeRecords.find(
        (candidate) => candidate.TYPE_DEPENDENCY_ID === record.TYPE_DEPENDENCY_ID,
      )!
      expect(record.OWNERSHIP_STATUS).toBe(before.OWNERSHIP_STATUS)
      expect(record.OWNERSHIP_AUTHORITY).toBe(before.OWNERSHIP_AUTHORITY)
      expect(record.CANONICAL_CREATION_AUTHORITY).toBe(before.CANONICAL_CREATION_AUTHORITY)
      expect(record.EXISTING_AUTHORITY_EVIDENCE).toEqual(before.EXISTING_AUTHORITY_EVIDENCE)
      expect(record.TYPE_APPROVAL_STATUS).toBe('APPROVED')
    }
  })
  it('preserves exact38 consumer identities/obligations/evidence and resolves them all', () => {
    expect(model.registry.referenceLinks).toEqual(prior.referenceLinks)
    expect(model.registry.referenceLinks).toHaveLength(38)
    expect(digest(model.registry.referenceLinks)).toBe(
      model.report.preservation.REFERENCE_LINKS_SHA256,
    )
    expect(model.report.referenceAccounting).toMatchObject({
      REFERENCES_WITH_APPROVED_TYPE: 38,
      REFERENCES_WITH_HELD_TYPE: 0,
      UNACCOUNTED: 0,
      CONSUMER_IDENTITIES_CHANGED: 0,
    })
  })
  it('has36 safe inactive descriptors,exact selected order,and no execution binding', () => {
    expect(
      model.registry.typeRecords.filter((record) => record.INACTIVE_TYPE_DESCRIPTOR),
    ).toHaveLength(36)
    for (const record of model.registry.typeRecords) {
      expect(record.INACTIVE_TYPE_DESCRIPTOR).toMatchObject({
        EXECUTION_ALLOWED: 'NO',
        SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
      })
      expect(record.INACTIVE_TYPE_DESCRIPTOR!.SQL).toMatch(
        /^CREATE TYPE "public"\."[a-z_]+" AS ENUM \(/,
      )
      expect(sha(record.INACTIVE_TYPE_DESCRIPTOR!.SQL)).toBe(
        record.INACTIVE_TYPE_DESCRIPTOR!.SQL_SHA256,
      )
    }
  })
  it('preserves historical blocked W4T/W4FR bytes and inherited section commitments', () => {
    for (const [file, hash] of Object.entries(model.report.preservation.historicalByteCommitments))
      expect(sha(read(file))).toBe(hash)
    const historical: {
      preservedSections: unknown
      phaseStatus: { PHASE_1B_3C_A1I_W4T_GATE: string }
    } = JSON.parse(read(files.w4t))
    expect(historical.phaseStatus.PHASE_1B_3C_A1I_W4T_GATE).toBe('BLOCKED')
    expect(model.report.preservation.PRESERVED_SECTIONS).toEqual(historical.preservedSections)
  })
  it('authorizes only a not-started retry,not materialization or later phases', () => {
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4T1: 'PASS',
      PHASE_1B_3C_A1I_W4T: 'PASS',
      W4FR_RETRY: 'AUTHORIZED_NOT_STARTED',
      W4FR_RETRY_STARTED: 'NO',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    })
    expect(model.report.proofBoundaries).toMatchObject({
      TYPE_SQL_EXECUTED: 'NO',
      NAMED_TYPES_MATERIALIZED: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
  })
  it('is deterministic across normalized or predecision input mode', () => {
    expect(digest(buildSelection())).toBe(digest(model))
  })
  it.each(['--execute', '--retry-w4fr', '--publish', '--discover', '--activate'])(
    'rejects forbidden action %s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4T1_FLAG')
    },
  )
})
