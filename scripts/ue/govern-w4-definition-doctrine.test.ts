import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildGovernance,
  consumerCheck,
  defaults,
  files,
  generate,
  governRelation,
  main,
  outputs,
  selectProperty,
  type Selection,
} from './govern-w4-definition-doctrine'
import { digest, exactIds, read, sha } from './w4-physical-producers'
import type { buildRegistry } from './author-w4-canonical-definitions'

type W4F = Awaited<ReturnType<typeof buildRegistry>>
const accepted: W4F = JSON.parse(read(files.w4f))
function fixture() {
  const relation = structuredClone(
    accepted.relationDefinitions.find((r) => r.RELATION_NAME === 'case_documents')!,
  )
  const column = structuredClone(relation.COLUMNS.find((c) => c.COLUMN_NAME === 'linked_by')!)
  return { relation, column }
}
const selection = (property: string, value: string): Selection => ({
  PROPERTY: property,
  VALUE: value,
  PROVENANCE: 'W4H_GOVERNANCE_DEFAULT',
  RULE: 'fixture',
  EVIDENCE_REFERENCES: [],
  STATUS: 'APPROVED',
  RATIONALE: 'offline fixture',
})
describe('W4H governance defaults and precise provenance', () => {
  it('closes case_documents text/varchar conflict with current text,not arbitrary limit', () => {
    const { relation, column } = fixture()
    const result = selectProperty('POSTGRES_TYPE', column, relation.DECLARATIONS)
    expect(result.VALUE).toBe('text')
    expect(result.PROVENANCE).toBe('W4H_CONFLICT_RESOLUTION')
    expect(result.EVIDENCE_REFERENCES.length).toBeGreaterThan(1)
    expect(result.RULE).toBe('RULE_17_CASE_DOCUMENTS_CURRENT_TEXT')
  })
  it('preserves exact declared PG types,not a platform-preferred replacement', () => {
    const relation = accepted.relationDefinitions.find(
      (r) => r.RELATION_NAME === 'committee_meetings',
    )!
    const column = relation.COLUMNS.find((c) => c.COLUMN_NAME === 'organization_id')!
    expect(selectProperty('POSTGRES_TYPE', column, relation.DECLARATIONS).VALUE).toBe('uuid')
  })
  it('preserves current named enum reference instead of historical text without authoring a new type', () => {
    const relation = accepted.relationDefinitions.find(
      (r) => r.RELATION_NAME === 'committee_meetings',
    )!
    const column = relation.COLUMNS.find((c) => c.COLUMN_NAME === 'status')!
    const result = selectProperty('POSTGRES_TYPE', column, relation.DECLARATIONS)
    expect(result.VALUE).toBe('committee_meeting_status')
    expect(result.PROVENANCE).toBe('EXACT_DECLARATION')
    expect(result.TYPE_DEPENDENCY_POSTURE).toContain('does not author enum members')
  })
  it.each(Object.entries(defaults))(
    'adopts explicit missing-property default %s',
    (property, expected) => {
      const { relation, column } = fixture()
      for (const table of relation.DECLARATIONS) {
        table.CONSTRAINT_SOURCE = null
        for (const col of table.COLUMNS) {
          const prop = property as keyof typeof col.PROPERTIES
          col.PROPERTIES[prop] = { STATE: 'UNRESOLVED', VALUE: null, EVIDENCE: 'Not established' }
        }
      }
      const result = selectProperty(
        property as Parameters<typeof selectProperty>[0],
        column,
        relation.DECLARATIONS,
      )
      expect(result.VALUE).toBe(expected)
      expect(result.PROVENANCE).toBe('W4H_GOVERNANCE_DEFAULT')
    },
  )
  it('NO_DEFAULT is not DEFAULT NULL and does not infer UUID generator', () => {
    expect(defaults.DEFAULT).toBe('NO_DEFAULT')
    expect(defaults.IDENTITY_OR_GENERATED).toBe('NONE')
  })
  it('uses exact historical facts only when current fact is not established', () => {
    const { relation, column } = fixture()
    for (const table of relation.DECLARATIONS)
      if (table.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE')
        for (const col of table.COLUMNS)
          col.PROPERTIES.POSTGRES_TYPE = { STATE: 'UNRESOLVED', VALUE: null, EVIDENCE: 'not exact' }
    const result = selectProperty('POSTGRES_TYPE', column, relation.DECLARATIONS)
    expect(result.VALUE).toBe('character varying(255)')
    expect(result.PROVENANCE).toBe('EXACT_HISTORICAL_EVIDENCE')
  })
  it('leaves generic timestamps and JSON-like types residual,not globally normalized', () => {
    for (const evidence of [
      'Timestamp timezone semantics not established',
      'JSON-like representation only',
    ]) {
      const { relation, column } = fixture()
      for (const table of relation.DECLARATIONS)
        for (const col of table.COLUMNS)
          col.PROPERTIES.POSTGRES_TYPE = {
            STATE: 'UNRESOLVED',
            VALUE: null,
            EVIDENCE: evidence,
          }
      const result = selectProperty('POSTGRES_TYPE', column, relation.DECLARATIONS)
      expect(result.STATUS).toBe('RESIDUAL_HUMAN_DECISION_REQUIRED')
      expect(result.VALUE).toBeNull()
    }
  })
  it('adopts numeric without inventing precision when exact numeric family exists', () => {
    const { relation, column } = fixture()
    relation.DECLARATIONS = relation.DECLARATIONS.filter(
      (d) => d.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE',
    )
    for (const table of relation.DECLARATIONS)
      for (const col of table.COLUMNS) {
        col.SOURCE_EXPRESSION = "amount:decimal('amount')"
        col.PROPERTIES.POSTGRES_TYPE = {
          STATE: 'UNRESOLVED',
          VALUE: null,
          EVIDENCE:
            'Numeric precision/scale or unconstrained representation requires explicit adoption',
        }
      }
    expect(selectProperty('POSTGRES_TYPE', column, relation.DECLARATIONS).VALUE).toBe('numeric')
  })
  it('does not erase explicitly established partial identity options with NONE', () => {
    const { relation, column } = fixture()
    for (const table of relation.DECLARATIONS)
      for (const col of table.COLUMNS)
        col.PROPERTIES.IDENTITY_OR_GENERATED = {
          STATE: 'EXPLICIT',
          VALUE: 'GENERATED_ALWAYS_AS_IDENTITY; exact sequence options need review',
          EVIDENCE: 'fixture',
        }
    expect(selectProperty('IDENTITY_OR_GENERATED', column, relation.DECLARATIONS).STATUS).toBe(
      'RESIDUAL_HUMAN_DECISION_REQUIRED',
    )
  })
  it('does not arbitrarily choose among different exact current values', () => {
    const { relation, column } = fixture()
    const current = structuredClone(
      relation.DECLARATIONS.find((d) => d.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE')!,
    )
    for (const col of current.COLUMNS)
      col.PROPERTIES.POSTGRES_TYPE = {
        STATE: 'EXPLICIT',
        VALUE: 'uuid',
        EVIDENCE: 'second current source',
      }
    relation.DECLARATIONS.push(current)
    expect(selectProperty('POSTGRES_TYPE', column, relation.DECLARATIONS).STATUS).toBe('CONFLICT')
  })
  it('refuses hybrid schemas when current declarations have different column sets', () => {
    const { relation } = fixture()
    const current = structuredClone(
      relation.DECLARATIONS.find((d) => d.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE')!,
    )
    current.COLUMNS.pop()
    relation.DECLARATIONS.push(current)
    const governed = governRelation(relation)
    expect(
      governed.RELATION_PROPERTIES.find((p) => p.PROPERTY === 'CANONICAL_COLUMN_SET')!.STATUS,
    ).toBe('RESIDUAL_HUMAN_DECISION_REQUIRED')
  })
  it('does not combine historical extra columns with exact current column set', () => {
    const { relation } = fixture()
    const governed = governRelation(relation)
    const current = relation.DECLARATIONS.find(
      (d) => d.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE',
    )!
    expect(
      JSON.parse(
        governed.RELATION_PROPERTIES.find((p) => p.PROPERTY === 'CANONICAL_COLUMN_SET')!.VALUE!,
      ),
    ).toEqual(current.COLUMNS.map((c) => c.NAME).sort())
  })
  it('does not choose governance defaults against explicit consumer requirements', () => {
    const result = consumerCheck(selection('NULLABILITY', 'NULLABLE'), [
      {
        PROPERTY: 'NULLABILITY',
        REQUIRED_VALUE: 'NOT_NULL',
        EVIDENCE: 'explicit accepted consumer invariant',
      },
    ])
    expect(result.STATUS).toBe('RESIDUAL_HUMAN_DECISION_REQUIRED')
    expect(result.VALUE).toBeNull()
    expect(result.PROVENANCE).toBeNull()
  })
  it('keeps compatible consumer requirements approved', () => {
    expect(
      consumerCheck(selection('DEFAULT', 'NO_DEFAULT'), [
        {
          PROPERTY: 'DEFAULT',
          REQUIRED_VALUE: 'NO_DEFAULT',
          EVIDENCE: 'fixture',
        },
      ]).STATUS,
    ).toBe('APPROVED')
  })
  it('also checks generic explicit consumer requirements against qualified column properties', () => {
    expect(
      consumerCheck(selection('organization_id.NULLABILITY', 'NULLABLE'), [
        {
          PROPERTY: 'NULLABILITY',
          REQUIRED_VALUE: 'NOT_NULL',
          EVIDENCE: 'explicit accepted input',
        },
      ]).STATUS,
    ).toBe('RESIDUAL_HUMAN_DECISION_REQUIRED')
  })
  it('does not invent FK physical targets from symbolic logical references', () => {
    const { relation, column } = fixture()
    for (const table of relation.DECLARATIONS) table.CONSTRAINT_SOURCE = null
    const result = selectProperty('FOREIGN_KEY', column, relation.DECLARATIONS)
    expect(result.VALUE).toBe('NONE')
    expect(result.RULE).toBe('RULE_12_NO_UNPROVEN_PHYSICAL_FK')
  })
  it('adopts NO_ACTION for exact qualified FK target with unspecified actions', () => {
    const { relation, column } = fixture()
    const historical = relation.DECLARATIONS.find(
      (d) => d.REFERENCE.CLASS === 'HISTORICAL_SQL_DESIGN_EVIDENCE',
    )!
    historical.CONSTRAINT_SOURCE = 'FOREIGN KEY ("linked_by") REFERENCES "public"."profiles"("id")'
    const result = selectProperty('FOREIGN_KEY', column, relation.DECLARATIONS)
    expect(JSON.parse(result.VALUE!)).toEqual({
      REFERENCED_RELATION: 'public.profiles',
      REFERENCED_COLUMNS: ['id'],
      ON_DELETE: 'NO_ACTION',
      ON_UPDATE: 'NO_ACTION',
    })
    expect(result.RATIONALE).toContain('prospectively')
    expect(result.COMPONENT_PROPERTIES!.find((p) => p.PROPERTY === 'ON_DELETE')!.PROVENANCE).toBe(
      'W4H_GOVERNANCE_DEFAULT',
    )
    expect(
      result.COMPONENT_PROPERTIES!.find((p) => p.PROPERTY === 'REFERENCED_RELATION')!.PROVENANCE,
    ).toBe('EXACT_HISTORICAL_EVIDENCE')
  })
  it('preserves explicit current unique/check participation in table callback', () => {
    const relation = accepted.relationDefinitions.find((r) => r.RELATION_NAME === 'votes')!
    const voter = { ...relation.COLUMNS[0], COLUMN_NAME: 'voter_id' }
    expect(selectProperty('UNIQUE_PARTICIPATION', voter, relation.DECLARATIONS).PROVENANCE).toBe(
      'EXACT_DECLARATION',
    )
    const governed = governRelation(relation)
    expect(
      governed.RELATION_PROPERTIES.find((p) => p.PROPERTY === 'RELATION_CONSTRAINTS_AND_INDEXES')!
        .VALUE,
    ).toContain('PHYSICAL_FOREIGN_KEYS')
  })
})
describe('W4H exact accounting,immutable inputs and honest gate', () => {
  let report: Awaited<ReturnType<typeof buildGovernance>>
  beforeAll(async () => {
    report = await buildGovernance()
  }, 120000)
  it('covers126 group IDs and183 obligation IDs once', () => {
    exactIds(
      report.groupDispositions.map((g) => g.DESIGN_CHOICE_ID),
      accepted.designDecisions.map((g) => g.DESIGN_CHOICE_ID),
    )
    exactIds(
      report.obligationGovernance.map((o) => o.DEFINITION_OBLIGATION_ID),
      accepted.definitionRecords.map((o) => o.DEFINITION_OBLIGATION_ID),
    )
    expect(report.summary.SUM).toBe(126)
    expect(report.summary.OBLIGATION_SUM).toBe(183)
    expect(report.summary.UNACCOUNTED).toBe(0)
    expect(report.relationGovernance).toHaveLength(125)
  })
  it('all approved selected properties carry exact provenance and non-null values', () => {
    const allowed = [
      'EXACT_DECLARATION',
      'EXACT_HISTORICAL_EVIDENCE',
      'W4H_GOVERNANCE_DEFAULT',
      'W4H_CONFLICT_RESOLUTION',
    ]
    for (const obligation of report.obligationGovernance)
      for (const selected of obligation.SELECTED_VALUES)
        if (selected.STATUS === 'APPROVED') {
          expect(allowed).toContain(selected.PROVENANCE)
          expect(selected.VALUE).not.toBeNull()
          expect(selected.RULE).toBeTruthy()
        }
  })
  it('closes case_documents conflict and preserves historical references', () => {
    expect(report.caseDocumentsResolution.DISPOSITION).toBe('CURRENT_DECLARATION_SELECTED')
    expect(report.caseDocumentsResolution.PROPERTIES).toHaveLength(2)
    expect(report.caseDocumentsResolution.PROPERTIES.every((p) => p.VALUE === 'text')).toBe(true)
    expect(report.caseDocumentsResolution.HISTORICAL_COMPATIBILITY_EVIDENCE.length).toBeGreaterThan(
      0,
    )
  })
  it('returns only residual group decisions,not all126 again', () => {
    expect(report.summary.APPROVED).toBe(121)
    expect(report.summary.ALL_PROPERTIES_GOVERNED).toBe(178)
    expect(report.residualDecisions).toHaveLength(5)
    expect(report.residualDecisions.length).toBeLessThan(126)
    expect(
      report.residualDecisions.every(
        (d) => d.EXACT_UNRESOLVED_PROPERTY.length && d.AFFECTED_OBLIGATIONS.length,
      ),
    ).toBe(true)
    expect(
      report.summary.APPROVED +
        report.summary.RESIDUAL_HUMAN_DECISION_REQUIRED +
        report.summary.CONFLICT,
    ).toBe(126)
    expect(
      report.summary.ALL_PROPERTIES_GOVERNED +
        report.summary.RESIDUAL_DECISION_REQUIRED +
        report.summary.CONFLICTED,
    ).toBe(183)
  })
  it('preserves frozen upstream bytes and section preservation commitments', () => {
    for (const [file, hash] of Object.entries(report.preservation))
      expect(sha(read(file))).toBe(hash)
    expect(report.acceptedSectionDigests).toEqual(accepted.acceptedPreservation)
    expect(digest(JSON.parse(read(files.w4f)).definitionRecords)).toBe(
      digest(accepted.definitionRecords),
    )
  })
  it('never authors SQL or activates/regenerates/version-bumps', () => {
    expect(report.summary.CANONICAL_SQL_AUTHORED).toBe(0)
    expect(report.summary.INACTIVE_SQL_PAYLOADS_CREATED).toBe(0)
    expect(report.summary.PRODUCERS_ACTIVATED).toBe(0)
    expect(report.phaseStatus.CANONICAL_CONTRACT_VERSION).toBe('1.3.1')
    expect(report.phaseStatus.W4F_REGENERATION_STARTED).toBe('NO')
    expect(report.phaseStatus.W4P).toBe('NOT_AUTHORIZED')
    expect(report.phaseStatus.W5).toBe('NOT_AUTHORIZED')
    expect(report.phaseStatus.PHASE_1B_3C_A1I_W4H_GATE).toBe('BLOCKED')
    expect(report.phaseStatus.NO_FURTHER_W4H_DOCTRINE_PASS).toBe('YES')
  })
  it('matches deterministic persistent governance output', async () => {
    const output = await generate()
    for (const [file, bytes] of Object.entries(output)) expect(read(file)).toBe(bytes)
    expect(Object.keys(output)).toEqual([outputs.report, outputs.markdown, outputs.residual])
  }, 240000)
  it.each([['--apply'], ['--execute'], ['--regenerate'], ['--check', '--check']])(
    'rejects unauthorized flag %j',
    async (...args) => {
      await expect(main(args)).rejects.toThrow()
    },
  )
})
