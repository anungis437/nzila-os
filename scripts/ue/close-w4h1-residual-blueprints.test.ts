import { describe, expect, it } from 'vitest'
import {
  buildClosure,
  blueprintKey,
  candidateRejections,
  chooseCandidate,
  files,
  generate,
  identities,
  main,
  preservationSections,
  type Candidate,
} from './close-w4h1-residual-blueprints'
import { read, sha } from './w4-physical-producers'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildGovernance } from './govern-w4-definition-doctrine'

type W4F = Awaited<ReturnType<typeof buildRegistry>>
type W4H = Awaited<ReturnType<typeof buildGovernance>>
const frozen: W4F = JSON.parse(read(files.w4f))
const w4h: W4H = JSON.parse(read(files.w4h))
const candidate = (key: string, columns: string[]): Candidate => ({
  KEY: key,
  COLUMN_NAMES: columns,
  CURRENT_AUTHORITY_CLASS: 'DECLARATION_DESIGN_EVIDENCE',
  REJECTION_REASONS: [],
})
function fixture(name = 'consent_records') {
  const relation = structuredClone(
    frozen.relationDefinitions.find((record) => record.RELATION_NAME === name)!,
  )
  const declaration = relation.DECLARATIONS.find(
    (record) => record.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE',
  )!
  const approved = w4h.obligationGovernance
    .filter((record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID)
    .flatMap((record) =>
      record.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED'),
    )
  return { relation, declaration, approved }
}
describe('W4H1 bounded candidate filtering', () => {
  it('rejects a current variant without the mandatory organization_id', () => {
    const { relation, declaration } = fixture()
    declaration.COLUMNS = declaration.COLUMNS.filter((column) => column.NAME !== 'organization_id')
    expect(candidateRejections(declaration, relation, ['organization_id'], [], [])).toContain(
      'OMITS_REQUIRED_ORGANIZATION_ID',
    )
  })
  it('rejects historical-only authority even if it includes organization_id', () => {
    const { relation, declaration } = fixture()
    declaration.REFERENCE.CLASS = 'HISTORICAL_SQL_DESIGN_EVIDENCE'
    expect(candidateRejections(declaration, relation, ['organization_id'], [], [])).toContain(
      'HISTORICAL_ONLY_NOT_CURRENT_AUTHORITY',
    )
  })
  it('rejects dropping any accepted obligation-backed column', () => {
    const { relation, declaration } = fixture()
    expect(
      candidateRejections(declaration, relation, ['missing_accepted_column'], [], []),
    ).toContain('DROPS_ACCEPTED_COLUMN:missing_accepted_column')
  })
  it('rejects explicit type contradiction without overriding frozen provenance', () => {
    const { relation, declaration, approved } = fixture()
    declaration.COLUMNS.find(
      (column) => column.NAME === 'organization_id',
    )!.PROPERTIES.POSTGRES_TYPE.VALUE = 'text'
    expect(candidateRejections(declaration, relation, ['organization_id'], approved, [])).toContain(
      'CONTRADICTS_APPROVED_W4H_PROPERTY:organization_id.POSTGRES_TYPE',
    )
    expect(
      approved.find((property) => property.PROPERTY === 'organization_id.POSTGRES_TYPE')!.VALUE,
    ).toBe('uuid')
  })
  it('retains settled values on omitted properties,not new doctrine defaults', () => {
    const { relation, declaration, approved } = fixture()
    declaration.COLUMNS.find(
      (column) => column.NAME === 'organization_id',
    )!.PROPERTIES.NULLABILITY = {
      STATE: 'UNRESOLVED',
      VALUE: null,
      EVIDENCE: 'fixture omission',
    }
    expect(candidateRejections(declaration, relation, ['organization_id'], approved, [])).toEqual(
      [],
    )
  })
  it('rejects analytics variant lacking the already-approved ML unique restriction', () => {
    const { relation, declaration, approved } = fixture('ml_predictions')
    expect(candidateRejections(declaration, relation, ['organization_id'], approved, [])).toContain(
      'CONTRADICTS_APPROVED_W4H_PROPERTY:organization_id.UNIQUE_PARTICIPATION',
    )
  })
  it('retains physical FK NONE despite symbolic logical references', () => {
    const { relation, declaration, approved } = fixture()
    expect(
      declaration.COLUMNS.find((column) => column.NAME === 'organization_id')!.REFERENCES.length,
    ).toBeGreaterThan(0)
    expect(candidateRejections(declaration, relation, ['organization_id'], approved, [])).toEqual(
      [],
    )
  })
  it('requires every column in the already-approved ML unique constraint', () => {
    const { relation, approved } = fixture('ml_predictions')
    const declaration = relation.DECLARATIONS.find((record) =>
      record.REFERENCE.FILE.endsWith('domains/ml/predictions.ts'),
    )!
    declaration.COLUMNS = declaration.COLUMNS.filter((column) => column.NAME !== 'prediction_date')
    expect(candidateRejections(declaration, relation, ['organization_id'], approved, [])).toContain(
      'DROPS_APPROVED_CONSTRAINT_COLUMN:prediction_date',
    )
  })
  it('rejects explicit consumer property contradictions', () => {
    const { relation, declaration, approved } = fixture()
    expect(
      candidateRejections(declaration, relation, ['organization_id'], approved, [
        {
          PROPERTY: 'organization_id.NULLABILITY',
          REQUIRED_VALUE: 'NULLABLE',
          EVIDENCE: 'fixture',
        },
      ]),
    ).toContain('CONTRADICTS_EXPLICIT_CONSUMER_REQUIREMENT:organization_id.NULLABILITY')
  })
  it('rejects an explicit consumer column missing from the current blueprint', () => {
    const { relation, declaration } = fixture()
    expect(
      candidateRejections(
        declaration,
        relation,
        ['organization_id'],
        [],
        [{ PROPERTY: 'unavailable.POSTGRES_TYPE', REQUIRED_VALUE: 'uuid', EVIDENCE: 'fixture' }],
      ),
    ).toContain('DROPS_EXPLICIT_CONSUMER_COLUMN:unavailable')
  })
})
describe('W4H1 subset and recorded-authority tiebreakers', () => {
  it('groups exact aliases despite source-file evidence narration differences', () => {
    const { declaration } = fixture()
    const alias = structuredClone(declaration)
    alias.REFERENCE.FILE = 'another-alias.ts'
    alias.COLUMNS[0].PROPERTIES.NULLABILITY.EVIDENCE = 'same fact in another-alias.ts'
    expect(blueprintKey(alias)).toBe(blueprintKey(declaration))
  })
  it('does not group different physical facts or constraints as aliases', () => {
    const { declaration } = fixture()
    const different = structuredClone(declaration)
    different.COLUMNS[0].PROPERTIES.POSTGRES_TYPE.VALUE = 'text'
    expect(blueprintKey(different)).not.toBe(blueprintKey(declaration))
    different.COLUMNS = declaration.COLUMNS
    different.CONSTRAINT_SOURCE = 'different explicit constraint'
    expect(blueprintKey(different)).not.toBe(blueprintKey(declaration))
  })
  it('selects a strict subset only after eligibility filtering', () => {
    const small = candidate('small', ['organization_id'])
    const large = candidate('large', ['organization_id', 'extra'])
    expect(chooseCandidate([large, small]).selected).toBe(small)
    small.REJECTION_REASONS.push('DROPS_ACCEPTED_COLUMN:extra')
    expect(chooseCandidate([large, small]).selected).toBe(large)
  })
  it('does not select by column count when eligible sets are incomparable', () => {
    expect(
      chooseCandidate([
        candidate('a', ['organization_id', 'a']),
        candidate('b', ['organization_id', 'b', 'c']),
      ]).selected,
    ).toBeNull()
  })
  it('does not choose a minimal subset if another incomparable minimum remains', () => {
    const result = chooseCandidate([
      candidate('a', ['organization_id', 'a']),
      candidate('large-a', ['organization_id', 'a', 'extra']),
      candidate('b', ['organization_id', 'b']),
    ])
    expect(result.selected).toBeNull()
    expect(result.ties.map((item) => item.KEY)).toEqual(['a', 'b'])
  })
  it('records equal current authority as a true tie,not a filename ranking', () => {
    const a = candidate('z.ts', ['organization_id', 'x'])
    const b = candidate('a.ts', ['organization_id', 'y'])
    expect(chooseCandidate([a, b]).rule).toBe(
      'EQUAL_RECORDED_CURRENT_AUTHORITY_INCOMPARABLE_BLUEPRINTS',
    )
    expect(chooseCandidate([b, a]).selected).toBeNull()
  })
  it('current evidence beats rejected historical evidence without a new hierarchy', () => {
    const current = candidate('current', ['organization_id', 'extra'])
    const history = candidate('historical', ['organization_id'])
    history.CURRENT_AUTHORITY_CLASS = 'HISTORICAL_SQL_DESIGN_EVIDENCE'
    history.REJECTION_REASONS.push('HISTORICAL_ONLY_NOT_CURRENT_AUTHORITY')
    expect(chooseCandidate([history, current]).selected).toBe(current)
  })
  it('fails explicitly rather than inventing an authority ranking', () => {
    const unknown = candidate('unknown', ['organization_id'])
    unknown.CURRENT_AUTHORITY_CLASS = 'PREFERRED_BY_FILENAME'
    expect(() => chooseCandidate([unknown])).toThrow('UNRECORDED_CURRENT_AUTHORITY_CLASS')
  })
  it('fails explicitly on no eligible variants', () => {
    const rejected = candidate('bad', ['other'])
    rejected.REJECTION_REASONS.push('OMITS_REQUIRED_ORGANIZATION_ID')
    expect(() => chooseCandidate([rejected])).toThrow('NO_ELIGIBLE_CURRENT_BLUEPRINT')
  })
})
describe('W4H1 exact fixed-universe governance overlay', () => {
  const report = buildClosure()
  it('accounts for exact five original group IDs and physical identities', () => {
    expect(report.decisions.map((record) => record.DESIGN_CHOICE_ID).sort()).toEqual(
      w4h.residualDecisions.map((record) => record.DESIGN_CHOICE_ID).sort(),
    )
    expect(report.decisions.map((record) => record.PHYSICAL_IDENTITY).sort()).toEqual(
      [...identities].sort(),
    )
    expect(new Set(report.decisions.map((record) => record.DEFINITION_OBLIGATION_ID)).size).toBe(5)
  })
  it('approves ML unique-compatible current variant and insight strict subset only', () => {
    const approved = report.decisions.filter((record) => record.DECISION_STATUS === 'APPROVED')
    expect(approved.map((record) => record.RELATION).sort()).toEqual([
      'public.insight_recommendations',
      'public.ml_predictions',
    ])
    const ml = approved.find((record) => record.RELATION === 'public.ml_predictions')!
    expect(ml.SELECTED_BLUEPRINT_SOURCE).toBe('apps/union-eyes/db/schema/domains/ml/predictions.ts')
    expect(ml.SELECTION_RULE).toBe('ONLY_ELIGIBLE_CURRENT_VARIANT')
    const insight = approved.find((record) => record.RELATION === 'public.insight_recommendations')!
    expect(insight.SELECTED_BLUEPRINT_SOURCE).toBe(
      'apps/union-eyes/db/schema/domains/analytics/analytics.ts',
    )
    expect(insight.SELECTION_RULE).toBe('STRICT_SUBSET_ACCEPTED_REQUIREMENTS')
    expect(insight.SELECTED_COLUMN_SET).not.toContain('ai_reference_id')
  })
  it('retains only three exact equal-authority true ties', () => {
    expect(
      report.decisions
        .filter((record) => record.DECISION_STATUS !== 'APPROVED')
        .map((record) => record.RELATION)
        .sort(),
    ).toEqual(['public.automation_rules', 'public.clc_sync_log', 'public.consent_records'])
    expect(report.summary).toMatchObject({
      ORGANIZATION_SCOPED_BLUEPRINT_APPROVED: 2,
      TRUE_BLUEPRINT_TIE_REMAINING: 3,
      SUM: 5,
      UNACCOUNTED: 0,
      DESIGN_GROUPS_CLOSED: 123,
      DEFINITION_OBLIGATIONS_GOVERNED: 180,
      HYBRID_BLUEPRINTS_CREATED: 0,
    })
  })
  it('selects one exact current column list,never a union or intersection', () => {
    for (const record of report.decisions.filter((item) => item.DECISION_STATUS === 'APPROVED')) {
      const selected = record.CANDIDATE_CURRENT_BLUEPRINTS.find(
        (variant) => variant.EVIDENCE_REFERENCE.DIGEST === record.SELECTED_BLUEPRINT_DIGEST,
      )!
      expect(record.SELECTED_COLUMN_SET).toEqual(selected.COLUMN_NAMES)
      expect(record.SELECTED_COLUMN_SET).toContain('organization_id')
      expect(
        record.ACCEPTED_REQUIREMENTS_COVERED.REQUIRED_COLUMNS.every((column) =>
          record.SELECTED_COLUMN_SET!.includes(column),
        ),
      ).toBe(true)
      expect(selected.REJECTION_REASONS).toEqual([])
    }
  })
  it('preserves every approved residual property including FK component provenance', () => {
    for (const record of report.decisions) {
      const before = w4h.obligationGovernance.find(
        (item) => item.DEFINITION_OBLIGATION_ID === record.DEFINITION_OBLIGATION_ID,
      )!
      expect(
        record.SELECTED_VALUES.filter((property) => property.PROPERTY !== 'CANONICAL_COLUMN_SET'),
      ).toEqual(
        before.SELECTED_VALUES.filter((property) => property.PROPERTY !== 'CANONICAL_COLUMN_SET'),
      )
    }
  })
  it('preserves the 121 groups/178 obligations/case_documents/named types through hashes', () => {
    expect(
      w4h.groupDispositions.filter((group) => group.DECISION_STATUS === 'APPROVED'),
    ).toHaveLength(121)
    expect(
      w4h.obligationGovernance.filter((record) => record.STATUS === 'ALL_PROPERTIES_GOVERNED'),
    ).toHaveLength(178)
    expect(report.preservedSections).toEqual(preservationSections(w4h))
    expect(
      w4h.caseDocumentsResolution.PROPERTIES.every((property) => property.VALUE === 'text'),
    ).toBe(true)
  })
  it('keeps canonical 1.3.1 and regeneration/downstream gates closed on any true tie', () => {
    expect(report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4H1_GATE: 'BLOCKED_TRUE_BLUEPRINT_TIE',
      PHASE_1B_3C_A1I_W4H: 'BLOCKED',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4F_REGENERATION: 'NOT_AUTHORIZED',
      W4F_REGENERATION_STARTED: 'NO',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    })
    expect(report.proofBoundaries).toMatchObject({
      CANONICAL_SQL_AUTHORED: 0,
      PRODUCERS_ACTIVATED: 0,
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
  })
  it('locks the exact five fixed input hashes without rewriting them', () => {
    expect(Object.keys(report.preservation).sort()).toEqual(Object.values(files).sort())
    for (const [file, digest] of Object.entries(report.preservation))
      expect(sha(read(file))).toBe(digest)
  })
  it('produces deterministic supplemental outputs', async () => {
    const first = await generate()
    const second = await generate()
    expect(Object.keys(first)).toHaveLength(2)
    expect(second).toEqual(first)
  })
  it.each(['--apply', '--execute', '--regenerate', '--sql', '--unknown'])(
    'rejects unauthorized flag %s before file writes',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG')
    },
  )
})
