import { describe, expect, it } from 'vitest'
import {
  buildPacket,
  columnDiff,
  constraintDiff,
  constraintEvidence,
  declarationIdentity,
  files,
  generate,
  humanMarkdown,
  main,
  outputs,
  relations,
  sharedPropertyDiff,
} from './extract-w4h2-blueprint-packet'
import { read, sha } from './w4-physical-producers'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildClosure } from './close-w4h1-residual-blueprints'
import type { buildGovernance } from './govern-w4-definition-doctrine'

type W4F = Awaited<ReturnType<typeof buildRegistry>>
const frozen: W4F = JSON.parse(read(files.w4f))
const w4h1: ReturnType<typeof buildClosure> = JSON.parse(read(files.w4h1))
const w4h: Awaited<ReturnType<typeof buildGovernance>> = JSON.parse(read(files.w4h))
function fixture() {
  const relation = frozen.relationDefinitions.find(
    (record) => record.RELATION_NAME === 'consent_records',
  )!
  const a = structuredClone(
    relation.DECLARATIONS.find(
      (record) => record.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE',
    )!,
  )
  const b = structuredClone(a)
  return { a, b }
}
describe('W4H2 exact comparison helpers', () => {
  it('computes common,only and excluded sets without constructing a blueprint', () => {
    const result = columnDiff([
      { VARIANT_ID: 'A', COLUMN_SET: ['organization_id', 'a'] },
      { VARIANT_ID: 'B', COLUMN_SET: ['b', 'organization_id'] },
    ])
    expect(result.COMMON_COLUMNS).toEqual(['organization_id'])
    expect(result.VARIANT_DIFFERENCES[0]).toMatchObject({
      ONLY_IN_THIS_VARIANT: ['a'],
      PRESENT_BUT_NOT_COMMON: ['a'],
      EXCLUDED_FROM_THIS_VARIANT: ['b'],
    })
    expect(result.PURPOSE).toBe('COMPARISON_ONLY_NOT_A_PROPOSED_UNION_OR_INTERSECTION')
  })
  it('accounts for pairwise overlaps when more than two variants exist', () => {
    const result = columnDiff([
      { VARIANT_ID: 'A', COLUMN_SET: ['organization_id', 'ab', 'a'] },
      { VARIANT_ID: 'B', COLUMN_SET: ['organization_id', 'ab', 'b'] },
      { VARIANT_ID: 'C', COLUMN_SET: ['organization_id', 'c'] },
    ])
    expect(result.VARIANT_DIFFERENCES[0].ONLY_IN_THIS_VARIANT).toEqual(['a'])
    expect(result.VARIANT_DIFFERENCES[0].PRESENT_BUT_NOT_COMMON).toEqual(['a', 'ab'])
    expect(result.VARIANT_DIFFERENCES[0].EXCLUDED_FROM_THIS_VARIANT).toEqual(['b', 'c'])
  })
  it('rejects duplicate physical column names', () => {
    expect(() =>
      columnDiff([
        { VARIANT_ID: 'A', COLUMN_SET: ['id', 'id'] },
        { VARIANT_ID: 'B', COLUMN_SET: ['id'] },
      ]),
    ).toThrow()
  })
  it('ignores file-specific evidence narration when checking alias identity', () => {
    const { a, b } = fixture()
    b.REFERENCE.FILE = 'alias.ts'
    b.COLUMNS[0].PROPERTIES.NULLABILITY.EVIDENCE = 'same fact in alias.ts'
    expect(declarationIdentity(a)).toBe(declarationIdentity(b))
  })
  it('does not hide differing exact physical facts behind identical column sets', () => {
    const { a, b } = fixture()
    b.COLUMNS[0].PROPERTIES.POSTGRES_TYPE.VALUE = 'text'
    expect(declarationIdentity(a)).not.toBe(declarationIdentity(b))
    expect(
      sharedPropertyDiff([
        { VARIANT_ID: 'A', DECLARATION: a },
        { VARIANT_ID: 'B', DECLARATION: b },
      ]).DIFFERENCES[0],
    ).toMatchObject({ COLUMN: 'id', PROPERTY: 'POSTGRES_TYPE' })
  })
  it.each(['NULLABILITY', 'DEFAULT', 'IDENTITY_OR_GENERATED'] as const)(
    'detects shared-column %s differences',
    (property) => {
      const { a, b } = fixture()
      a.COLUMNS[0].PROPERTIES[property] = {
        STATE: 'EXPLICIT',
        VALUE: 'fixture exact value',
        EVIDENCE: 'explicit fixture',
      }
      b.COLUMNS[0].PROPERTIES[property] = { STATE: 'UNRESOLVED', VALUE: null, EVIDENCE: 'omitted' }
      const result = sharedPropertyDiff([
        { VARIANT_ID: 'A', DECLARATION: a },
        { VARIANT_ID: 'B', DECLARATION: b },
      ])
      expect(result.DIFFERENCES.some((record) => record.PROPERTY === property)).toBe(true)
    },
  )
  it('compares state as well as value without claiming unresolved physical equivalence', () => {
    const { a, b } = fixture()
    a.COLUMNS[0].PROPERTIES.DEFAULT = { STATE: 'UNRESOLVED', VALUE: null, EVIDENCE: 'a' }
    b.COLUMNS[0].PROPERTIES.DEFAULT = { STATE: 'UNRESOLVED', VALUE: null, EVIDENCE: 'b' }
    const result = sharedPropertyDiff([
      { VARIANT_ID: 'A', DECLARATION: a },
      { VARIANT_ID: 'B', DECLARATION: b },
    ])
    expect(result.DIFFERENCES).toEqual([])
    expect(result.UNRESOLVED_EVIDENCE_POSTURE).toContain('not NULLABLE,NO_DEFAULT')
  })
  it('extracts complete index/unique/FK/check/key chains without executing declarations', () => {
    const { a } = fixture()
    a.CONSTRAINT_SOURCE = `(t) => [
      index('i').on(t.id).where(sql\`true\`),
      uniqueIndex('u').on(t.id),
      unique('uc').on(t.id),
      primaryKey({columns:[t.id]}),
      foreignKey({columns:[t.id],foreignColumns:[x.id]}).onDelete('cascade'),
      check('c',sql\`true\`)
    ]`
    const result = constraintEvidence(a)
    expect(result.INDEXES.CALLBACK_EXPRESSIONS).toHaveLength(2)
    expect(result.INDEXES.CALLBACK_EXPRESSIONS[0]).toContain('.where(sql`true`)')
    expect(result.UNIQUE_CONSTRAINTS.CALLBACK_EXPRESSIONS).toHaveLength(2)
    expect(result.PRIMARY_KEYS.CALLBACK_EXPRESSIONS).toHaveLength(1)
    expect(result.FOREIGN_KEYS.CALLBACK_EXPRESSIONS[0]).toContain(".onDelete('cascade')")
    expect(result.CHECK_CONSTRAINTS.CALLBACK_EXPRESSIONS).toHaveLength(1)
  })
  it('reports identical constraints and callback source as NO_DIFFERENCE', () => {
    const { a, b } = fixture()
    const result = constraintDiff([
      { VARIANT_ID: 'A', DECLARATION: a },
      { VARIANT_ID: 'B', DECLARATION: b },
    ])
    expect(result.CATEGORIES.every((record) => record.RESULT === 'NO_DIFFERENCE')).toBe(true)
    expect(result.INDEXES.RESULT).toBe('NO_DIFFERENCE')
    expect(result.DECLARATION_CALLBACK_OR_CONSTRAINT_SOURCE.RESULT).toBe('NO_DIFFERENCE')
  })
  it('detects changed shared key/unique/check facts and logical FK evidence', () => {
    const { a, b } = fixture()
    b.COLUMNS[0].PROPERTIES.PRIMARY_KEY_PARTICIPATION.VALUE = 'NONE'
    b.COLUMNS[0].PROPERTIES.UNIQUE_PARTICIPATION.VALUE = 'unique'
    b.COLUMNS[0].PROPERTIES.CHECK_CONSTRAINTS.VALUE = 'positive'
    b.COLUMNS[0].REFERENCES = ['() => another.id']
    const result = constraintDiff([
      { VARIANT_ID: 'A', DECLARATION: a },
      { VARIANT_ID: 'B', DECLARATION: b },
    ])
    expect(result.CATEGORIES.every((record) => record.RESULT === 'DIFFERENCE')).toBe(true)
  })
  it('retains candidate-only restriction evidence separately from shared facts', () => {
    const { a, b } = fixture()
    b.COLUMNS = b.COLUMNS.filter((column) => column.NAME !== 'id')
    const result = constraintDiff([
      { VARIANT_ID: 'A', DECLARATION: a },
      { VARIANT_ID: 'B', DECLARATION: b },
    ])
    expect(result.CANDIDATE_ONLY_COLUMN_CONSTRAINTS[0].FACTS).toEqual(
      expect.arrayContaining([expect.objectContaining({ COLUMN: 'id', CATEGORY: 'PRIMARY_KEYS' })]),
    )
  })
})
describe('W4H2 exact frozen cards and proof boundaries', () => {
  const packet = buildPacket()
  it('accounts for only the three frozen tie IDs and obligations', () => {
    const ties = w4h1.decisions.filter((record) => record.DECISION_STATUS !== 'APPROVED')
    expect(packet.cards.map((card) => card.RELATION).sort()).toEqual(
      relations.map((name) => `public.${name}`).sort(),
    )
    expect(packet.cards.map((card) => card.DESIGN_CHOICE_ID)).toEqual(
      ties.map((record) => record.DESIGN_CHOICE_ID),
    )
    expect(packet.cards.map((card) => card.DEFINITION_OBLIGATION_ID)).toEqual(
      ties.map((record) => record.DEFINITION_OBLIGATION_ID),
    )
    expect(packet.summary).toMatchObject({
      TRUE_TIES_INPUT: 3,
      DISTINCT_TIED_VARIANTS: 6,
      CURRENT_SOURCE_ALIASES: 10,
      UNACCOUNTED: 0,
    })
  })
  it('reproduces every current variant and alias with exact digest/text/column definitions', () => {
    for (const card of packet.cards) {
      const relation = frozen.relationDefinitions.find(
        (record) => `public.${record.RELATION_NAME}` === card.RELATION,
      )!
      for (const variant of card.VARIANTS) {
        expect(variant.COLUMN_SET).toEqual(
          variant.EXACT_COLUMN_DEFINITIONS.map((column) => column.NAME),
        )
        expect(variant.COLUMN_COUNT).toBe(variant.COLUMN_SET.length)
        for (const source of variant.EQUIVALENT_SOURCE_ALIASES) {
          const declaration = relation.DECLARATIONS.find(
            (record) => record.REFERENCE.FILE === source.SOURCE_FILE,
          )!
          expect(source.SOURCE_DIGEST).toBe(declaration.REFERENCE.FILE_SHA256)
          expect(source.DECLARATION_DIGEST).toBe(sha(source.EXACT_CURRENT_DECLARATION_TEXT))
          expect(source.EXACT_CURRENT_DECLARATION_TEXT).toBe(declaration.REFERENCE.TEXT)
          expect(source.RECORDED_AUTHORITY_CLASS).toBe('DECLARATION_DESIGN_EVIDENCE')
        }
      }
    }
  })
  it('shows complete common/only/excluded sets for each card', () => {
    for (const card of packet.cards) {
      const [a, b] = card.VARIANTS
      expect(card.COLUMN_SET_DIFF.COMMON_COLUMNS).toEqual(
        a.COLUMN_SET.filter((name) => b.COLUMN_SET.includes(name)).sort(),
      )
      expect(card.COLUMN_SET_DIFF.VARIANT_DIFFERENCES[0].ONLY_IN_THIS_VARIANT).toEqual(
        a.COLUMN_SET.filter((name) => !b.COLUMN_SET.includes(name)).sort(),
      )
      expect(card.COLUMN_SET_DIFF.VARIANT_DIFFERENCES[1].ONLY_IN_THIS_VARIANT).toEqual(
        b.COLUMN_SET.filter((name) => !a.COLUMN_SET.includes(name)).sort(),
      )
    }
  })
  it('covers every shared property and exposes the CLC organization_id nullability difference', () => {
    for (const card of packet.cards)
      expect(card.SHARED_PROPERTY_DIFF.SHARED_COLUMN_PROPERTIES).toHaveLength(
        card.COLUMN_SET_DIFF.COMMON_COLUMNS.length * 4,
      )
    const clc = packet.cards.find((card) => card.RELATION === 'public.clc_sync_log')!
    expect(clc.SHARED_PROPERTY_DIFF.DIFFERENCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ COLUMN: 'organization_id', PROPERTY: 'NULLABILITY' }),
      ]),
    )
    expect(
      clc.VARIANTS.every(
        (variant) =>
          variant.ALREADY_GOVERNED_ORGANIZATION_ID_PROPERTIES.find(
            (property) => property.PROPERTY === 'organization_id.NULLABILITY',
          )!.VALUE === 'NOT_NULL',
      ),
    ).toBe(true)
  })
  it('exposes consent width/nullability and automation timestamp evidence differences', () => {
    const consent = packet.cards.find((card) => card.RELATION === 'public.consent_records')!
    expect(
      consent.SHARED_PROPERTY_DIFF.DIFFERENCES.map(
        (difference) => `${difference.COLUMN}.${difference.PROPERTY}`,
      ),
    ).toEqual(['created_at.NULLABILITY', 'ip_address.POSTGRES_TYPE'])
    const automation = packet.cards.find((card) => card.RELATION === 'public.automation_rules')!
    expect(
      automation.SHARED_PROPERTY_DIFF.DIFFERENCES.map(
        (difference) => `${difference.COLUMN}.${difference.PROPERTY}`,
      ),
    ).toEqual(['created_at.POSTGRES_TYPE', 'updated_at.POSTGRES_TYPE'])
  })
  it('covers all constraint categories and exact callbacks', () => {
    for (const card of packet.cards) {
      expect(card.CONSTRAINT_DIFF.CATEGORIES.map((category) => category.CATEGORY)).toEqual([
        'PRIMARY_KEYS',
        'UNIQUE_CONSTRAINTS',
        'FOREIGN_KEYS',
        'CHECK_CONSTRAINTS',
      ])
      expect(card.CONSTRAINT_DIFF.INDEXES.RESULT).toBe('DIFFERENCE')
      expect(card.CONSTRAINT_DIFF.DECLARATION_CALLBACK_OR_CONSTRAINT_SOURCE.RESULT).toBe(
        'DIFFERENCE',
      )
    }
  })
  it('traces accepted columns,constraints,consumer requirements and prerequisite IDs', () => {
    for (const card of packet.cards) {
      const tie = w4h1.decisions.find(
        (record) => record.DESIGN_CHOICE_ID === card.DESIGN_CHOICE_ID,
      )!
      expect(card.ACCEPTED_REQUIREMENTS.REQUIRED_COLUMNS).toEqual(
        tie.ACCEPTED_REQUIREMENTS_COVERED.REQUIRED_COLUMNS,
      )
      expect(card.ACCEPTED_REQUIREMENTS.W4_PREREQUISITE_IDENTITIES).toEqual(
        tie.ACCEPTED_REQUIREMENTS_COVERED.W4_PREREQUISITE_IDENTITIES,
      )
      expect(card.ACCEPTED_REQUIREMENTS.REQUIRED_CONSUMER_PROPERTIES).toEqual(
        tie.ACCEPTED_REQUIREMENTS_COVERED.EXPLICIT_CONSUMER_REQUIREMENTS,
      )
      for (const variant of card.VARIANTS) {
        expect(variant.COLUMN_SET).toContain('organization_id')
        expect(variant.SATISFIES_ALL_ACCEPTED_REQUIREMENTS).toBe('YES')
        expect(
          card.ACCEPTED_REQUIREMENTS.REQUIRED_COLUMNS.every((column) =>
            variant.COLUMN_SET.includes(column),
          ),
        ).toBe(true)
        const governed = w4h.obligationGovernance.find(
          (record) => record.DEFINITION_OBLIGATION_ID === card.DEFINITION_OBLIGATION_ID,
        )!
        expect(variant.ALREADY_GOVERNED_ORGANIZATION_ID_PROPERTIES).toEqual(
          governed.SELECTED_VALUES.filter((property) => property.STATUS === 'APPROVED'),
        )
      }
    }
  })
  it('classifies extra columns only from recorded declaration evidence,no guessed semantics', () => {
    for (const card of packet.cards)
      for (const variant of card.VARIANTS)
        for (const column of variant.CANDIDATE_ONLY_COLUMN_CLASSIFICATION) {
          expect(column.CLASSIFICATION).toBe('CURRENT_DECLARATION_ONLY')
          expect(column.ACCEPTED_SEMANTIC_REQUIREMENT).toBe(
            'NO_ACCEPTED_SEMANTIC_REQUIREMENT_ESTABLISHED',
          )
          expect(column.DOWNSTREAM_EVIDENCE_IDS).toEqual([])
        }
  })
  it('offers only exact-current-variant options,no hybrid or preferred choice', () => {
    for (const card of packet.cards) {
      expect(card.SELECTED_VARIANT).toBeNull()
      expect(card.RECOMMENDATION).toBe('NONE')
      expect(card.OPTIONS).toHaveLength(card.VARIANTS.length)
      card.OPTIONS.forEach((option, index) => {
        expect(option.ACTION).toBe('ADOPT_EXACT_CURRENT_VARIANT')
        expect(option.HYBRID_SCHEMA).toBe('NO')
        expect(option.COLUMNS_INCLUDED).toEqual(card.VARIANTS[index].COLUMN_SET)
        expect(option.COLUMNS_EXCLUDED).toEqual(
          card.COLUMN_SET_DIFF.VARIANT_DIFFERENCES[index].EXCLUDED_FROM_THIS_VARIANT,
        )
      })
    }
  })
  it('preserves closed W4H1 approvals and W4H original properties through exact section hashes', () => {
    expect(packet.preservedSections.W4H1_TWO_APPROVED_DECISIONS).toBe(
      sha(JSON.stringify(w4h1.decisions.filter((record) => record.DECISION_STATUS === 'APPROVED'))),
    )
    expect(packet.preservedSections.CASE_DOCUMENTS).toBe(
      sha(JSON.stringify(w4h.caseDocumentsResolution)),
    )
    expect(packet.preservedSections.ACCEPTED_UPSTREAM_COMMITMENTS).toEqual(
      frozen.acceptedPreservation,
    )
    expect(packet.summary.DESIGN_GROUPS_CLOSED).toBe(123)
    expect(packet.summary.DEFINITION_OBLIGATIONS_GOVERNED).toBe(180)
  })
  it('locks only five fixed input bytes without source discovery', () => {
    expect(Object.keys(packet.preservation).sort()).toEqual(Object.values(files).sort())
    for (const [file, hash] of Object.entries(packet.preservation))
      expect(sha(read(file))).toBe(hash)
  })
  it('keeps selection and downstream gates closed even when packet extraction passes', () => {
    expect(packet.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4H2_GATE: 'PASS',
      PHASE_1B_3C_A1I_W4H: 'BLOCKED_HUMAN_BLUEPRINT_SELECTION',
      TRUE_BLUEPRINT_DECISIONS_PENDING: 3,
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4F_REGENERATION: 'NOT_AUTHORIZED',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    })
    expect(packet.proofBoundaries).toEqual(w4h1.proofBoundaries)
  })
  it('renders three concise unselected A/B human cards', () => {
    const markdown = humanMarkdown(packet)
    for (const relation of relations) expect(markdown).toContain(`## ${relation}`)
    expect(markdown.match(/\*\*Decision:\*\*/g)).toHaveLength(3)
    expect(markdown).toContain('No option is selected or recommended')
    expect(markdown).toContain('organization_id.NULLABILITY')
  })
  it('generates four deterministic artifacts with an exact packet digest in phase evidence', async () => {
    const generated = await generate()
    expect(Object.keys(generated).sort()).toEqual(Object.values(outputs).sort())
    const phase = JSON.parse(generated[outputs.phase])
    expect(phase.PACKET_SHA256).toBe(sha(generated[outputs.packet]))
    expect(await generate()).toEqual(generated)
  })
  it.each(['--apply', '--execute', '--select', '--regenerate', '--sql', '--unknown'])(
    'rejects unauthorized flag %s before any output',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG')
    },
  )
})
