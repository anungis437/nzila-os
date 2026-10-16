import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildAdjudication,
  exactSqlDefinition,
  files,
  generate,
  main,
  outputs,
  selectAuthority,
  tally,
  type AuthorityEvidence,
} from './adjudicate-w4-ownership'
import { digest, exactIds, read, sha } from './w4-physical-producers'

const fixture = (overrides: Partial<AuthorityEvidence> = {}): AuthorityEvidence => ({
  id: 'creator',
  disposition: 'EXISTING_CANONICAL_PRODUCER',
  active: true,
  exactDefinition: true,
  beforeConsumer: true,
  explicitArchitectureAssignment: false,
  w2QualifiedDefinition: false,
  externalLockVerified: false,
  securityDefiner: false,
  trustedSearchPath: false,
  qualifiedSensitiveReferences: false,
  publicExecuteDefined: false,
  ownerDefined: false,
  frozen: false,
  ...overrides,
})
const candidate = (kind = 'TYPE', physical = 'public.example', line = 1) => ({
  PHYSICAL_OBJECT: physical,
  PREREQUISITE_KIND: kind,
  SOURCE_EVIDENCE: { FILE: 'fixture.sql', LINE: line, FILE_SHA256: 'fixture-only' },
})

describe('W4D positive authority and exact definitions', () => {
  it.each([{ active: false }, { exactDefinition: false }, { beforeConsumer: false }])(
    'holds insufficient evidence %j',
    (change) => {
      expect(selectAuthority([fixture(change)]).disposition).toBe(
        'GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY',
      )
    },
  )
  it('does not approve absent evidence or infer platform from not Django', () => {
    expect(selectAuthority([]).disposition).toBe('GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY')
    expect(selectAuthority([fixture({ disposition: 'PLATFORM_BASELINE' })]).selected).toBeNull()
  })
  it('requires explicit architecture and qualified definition for platform', () => {
    const platform = fixture({
      disposition: 'PLATFORM_BASELINE',
      explicitArchitectureAssignment: true,
    })
    expect(selectAuthority([platform]).selected).toBeNull()
    expect(selectAuthority([{ ...platform, w2QualifiedDefinition: true }]).disposition).toBe(
      'PLATFORM_BASELINE',
    )
  })
  it('does not approve later frozen creation as prior', () => {
    const prior = fixture({ disposition: 'PRIOR_FROZEN_SECURITY_MIGRATION', frozen: true })
    expect(selectAuthority([prior]).strength).toBe('PRIOR_FROZEN_PRODUCER')
    expect(selectAuthority([{ ...prior, beforeConsumer: false }]).selected).toBeNull()
    expect(selectAuthority([{ ...prior, frozen: false }]).selected).toBeNull()
  })
  it('requires locked external package authority', () => {
    const pkg = fixture({ disposition: 'EXTERNAL_DJANGO_PACKAGE' })
    expect(selectAuthority([pkg]).selected).toBeNull()
    expect(selectAuthority([{ ...pkg, externalLockVerified: true }]).strength).toBe(
      'ACTIVE_AUTHORITY_WITH_EXTERNAL_LOCK',
    )
  })
  it('does not treat historical or declaration evidence as conflicting active authority', () => {
    expect(
      selectAuthority([fixture(), fixture({ id: 'history', active: false })]).disposition,
    ).toBe('EXISTING_CANONICAL_PRODUCER')
  })
  it('holds both active creators even when one or both are later or otherwise ineligible', () => {
    const a = fixture({ beforeConsumer: false })
    const b = fixture({ id: 'later', beforeConsumer: false })
    expect(selectAuthority([a, b]).disposition).toBe('GOVERNANCE_HOLD_CONFLICTING_AUTHORITY')
    expect(selectAuthority([fixture(), b]).selected).toBeNull()
  })
  it('rejects duplicate candidate identities', () => {
    expect(() => selectAuthority([fixture(), fixture()])).toThrow('DUPLICATE_AUTHORITY_CANDIDATE')
  })
  it.each([
    'trustedSearchPath',
    'qualifiedSensitiveReferences',
    'publicExecuteDefined',
    'ownerDefined',
  ] as const)('holds elevated function when %s evidence missing', (key) => {
    const elevated = fixture({
      securityDefiner: true,
      trustedSearchPath: true,
      qualifiedSensitiveReferences: true,
      publicExecuteDefined: true,
      ownerDefined: true,
    })
    expect(selectAuthority([{ ...elevated, [key]: false }]).selected).toBeNull()
    expect(selectAuthority([elevated]).disposition).toBe('EXISTING_CANONICAL_PRODUCER')
  })
  it('preserves enum labels and exact bytes, including escaped quotes and semicolons', () => {
    const source = "CREATE TYPE public.example AS ENUM ('a;b', 'it''s', 'last');\n"
    const definition = exactSqlDefinition(source, candidate(), null)
    expect(definition.EXACT_CREATE_CLAUSE).toBe(source.trimEnd())
    expect(definition.ENUM_MEMBERS_SOURCE).toBe("'a;b', 'it''s', 'last'")
    expect(definition.DEFINITION_SHA256).toBe(sha(source.trimEnd()))
    expect(definition.USED_AS_EXECUTABLE_SQL).toBe('NO; evidence only')
  })
  it('checks exact required column, defaults, nullability and types without inventing them', () => {
    const source =
      "CREATE TABLE public.example (\n id uuid PRIMARY KEY,\n required text NOT NULL DEFAULT 'a;b'\n);"
    expect(exactSqlDefinition(source, candidate('RELATION'), 'required').EXACT_CREATE_CLAUSE).toBe(
      source,
    )
    expect(() => exactSqlDefinition(source, candidate('RELATION'), 'missing')).toThrow(
      'REQUIRED_COLUMN_NOT_IN_EXACT_DEFINITION',
    )
    expect(() => exactSqlDefinition(source, candidate('RELATION'), 'require')).toThrow(
      'REQUIRED_COLUMN_NOT_IN_EXACT_DEFINITION',
    )
  })
  it('records unqualified definition as insufficient for privileged W4 SQL', () => {
    expect(
      exactSqlDefinition("CREATE TYPE example AS ENUM ('one');", candidate(), null)
        .SCHEMA_QUALIFIED_IN_SOURCE,
    ).toBe(false)
  })
  it.each([
    ["ALTER TYPE public.example ADD VALUE 'new';", 'EXACT_CREATE_STATEMENT_MISSING'],
    ["-- CREATE TYPE public.example AS ENUM ('one');", 'EXACT_CREATE_STATEMENT_MISSING'],
    ["CREATE TYPE public.other AS ENUM ('one');", 'DEFINITION_OBJECT_IDENTITY_DRIFT'],
    ["CREATE TYPE public.example AS ENUM ('one')", 'DEFINITION_CLAUSE_UNTERMINATED'],
    ['CREATE TABLE public.example (id uuid);', 'DEFINITION_KIND_DRIFT'],
  ])(
    'rejects noncreation, comment, identity/kind drift and incomplete definitions',
    (source, error) => {
      expect(() => exactSqlDefinition(source, candidate(), null)).toThrow(error)
    },
  )
  it('does not pretend a partial function body parser proves a safe function definition', () => {
    expect(() =>
      exactSqlDefinition(
        'CREATE FUNCTION public.example() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$;',
        candidate('FUNCTION'),
        null,
      ),
    ).toThrow('FUNCTION_DEFINITION_REQUIRES_COMPLETE_BODY_AND_SECURITY_PARSER')
  })
  it('rejects source line drift', () => {
    expect(() => exactSqlDefinition('', candidate('TYPE', 'public.example', 3), null)).toThrow(
      'DEFINITION_SOURCE_LINE_DRIFT',
    )
  })
  it('accounts for all dispositions with explicit requested arithmetic', () => {
    const result = tally([
      { DISPOSITION: 'DJANGO' },
      { DISPOSITION: 'GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY' },
    ])
    expect(result.APPROVED_DJANGO).toBe(1)
    expect(result.HELD_NO_ACTIVE_AUTHORITY).toBe(1)
    expect(result.SUM).toBe(2)
    expect(result.UNACCOUNTED).toBe(0)
  })
})

describe('W4D fixed-artifact closure, no runtime', () => {
  let report: Awaited<ReturnType<typeof buildAdjudication>>
  beforeAll(async () => {
    report = await buildAdjudication()
  })
  it('adjudicates exact310/269/41 once without lost or invented IDs', () => {
    const canonical = JSON.parse(read(files.canonical))
    const work = canonical.remediationWorkstreams.find(
      (w: { WORKSTREAM_ID: string }) => w.WORKSTREAM_ID === 'W4',
    )
    exactIds(
      report.decisionAdjudication.map((d) => d.DECISION_ID),
      work.INPUT_DECISION_IDS,
    )
    expect(report.relationColumnDisposition).toHaveLength(269)
    expect(report.typeFunctionDisposition).toHaveLength(41)
    expect(report.summary.TOTAL.SUM).toBe(310)
    expect(report.summary.TOTAL.HELD_NO_ACTIVE_AUTHORITY).toBe(310)
    expect(report.summary.TOTAL.UNACCOUNTED).toBe(0)
  })
  it('distinguishes127 exact later definitions from183 with no active creator', () => {
    expect(report.summary.DECISIONS_WITH_EXACT_LATER_ACTIVE_DEFINITIONS).toBe(127)
    expect(report.summary.DECISIONS_WITH_NO_ACTIVE_CREATION_SOURCE).toBe(183)
    for (const d of report.decisionAdjudication)
      for (const a of d.ACTIVE_CREATION_CANDIDATES) {
        expect(a.PRODUCER_PRECEDES_FIRST_CONSUMER).toBe('NO')
        expect(a.FROZEN_PRODUCER_POSITION!).toBeGreaterThanOrEqual(a.FIRST_CONSUMER_POSITION)
        expect(a.DEFINITION_EVIDENCE).not.toBeNull()
        expect(a.W4_PRECONSUMER_AUTHORITY_ESTABLISHED).toBe('NO')
      }
  })
  it('41 type decisions are exact enums, not inferred function signatures or cast shapes', () => {
    const types = report.decisionAdjudication.filter((d) => d.OBJECT_KIND === 'TYPE')
    expect(types).toHaveLength(41)
    expect(
      types.every(
        (d) =>
          d.ACTIVE_DEFINITION_CANDIDATES.length === 1 &&
          d.ACTIVE_DEFINITION_CANDIDATES[0].DEFINITION_EVIDENCE?.ENUM_MEMBERS_SOURCE,
      ),
    ).toBe(true)
    expect(types.every((d) => d.SELECTED_AUTHORITY === null)).toBe(true)
  })
  it('preserves creation vs alteration and never approves historical/schema evidence', () => {
    for (const d of report.decisionAdjudication) {
      expect(d.APPROVED).toBe('NO')
      expect(
        d.HISTORICAL_CANDIDATES.every(
          (a) => a.SOURCE_CATEGORY === 'HISTORICAL_SUPPORTING_EVIDENCE',
        ),
      ).toBe(true)
      expect(
        d.DECLARATION_ONLY_CANDIDATES.every((a) => a.SOURCE_CATEGORY === 'DECLARATION_ONLY'),
      ).toBe(true)
      expect(d.ALTERATION_AUTHORITIES.every((a) => a.CREATION_AUTHORITY === 'NO')).toBe(true)
    }
  })
  it('hash-checks source-backed definitions and all23 frozen migrations', () => {
    for (const [file, hash] of Object.entries(report.sourceHashes))
      expect(sha(read(file))).toBe(hash)
    for (const d of report.decisionAdjudication)
      for (const a of d.ACTIVE_DEFINITION_CANDIDATES)
        expect(sha(a.DEFINITION_EVIDENCE!.EXACT_CREATE_CLAUSE)).toBe(
          a.DEFINITION_EVIDENCE!.DEFINITION_SHA256,
        )
    expect(report.validation.FROZEN_MIGRATION_HASHES_VERIFIED).toBe(23)
    expect(report.validation.GUARDED_VECTOR_CONSUMERS_PRESERVED).toBe(22)
  })
  it('retains768 closure records and explicit downstream/runtime boundaries', () => {
    const producer = JSON.parse(read(files.producer))
    exactIds(
      report.obligationLinkage.map((o) => o.OBLIGATION_ID),
      producer.obligationLinkage.map((o: { OBLIGATION_ID: string }) => o.OBLIGATION_ID),
    )
    expect(report.obligationLinkage).toHaveLength(768)
    expect(
      report.obligationLinkage.every(
        (o) => o.DOWNSTREAM_OWNER && o.RUNTIME_PROVEN === 'NO' && o.W4_IMPLEMENTATION_COMPLETE,
      ),
    ).toBe(true)
  })
  it('refreshes all86 handoffs without closing W5 and preserves118 opaque handoffs byte-semantically', () => {
    const producer = JSON.parse(read(files.producer))
    exactIds(
      report.w5OrderingHandoff.map((h) => h.ORDERING_RECORD_ID),
      producer.w5OrderingHandoff.map((h: { ORDERING_RECORD_ID: string }) => h.ORDERING_RECORD_ID),
    )
    expect(
      report.w5OrderingHandoff.every(
        (h) =>
          h.W5_ADJUDICATION_REQUIRED === 'YES' &&
          h.FINAL_W4_CREATION_AUTHORITY &&
          h.PRODUCER_POSITION_CLASS,
      ),
    ).toBe(true)
    expect(report.w6OpaqueBindingHandoff).toEqual(producer.w6OpaqueBindingHandoff)
    expect(report.w6OpaqueBindingHandoff).toHaveLength(118)
  })
  it('preserves372 mappings,82 plan nodes,raw duties and all fixed bytes', () => {
    const producer = JSON.parse(read(files.producer))
    expect(producer.djangoProducerRegistry).toHaveLength(372)
    expect(producer.canonicalProducerPlan).toHaveLength(82)
    expect(report.acceptedW4SectionHashes.DJANGO_372_MAPPING).toBe(
      digest(producer.djangoProducerRegistry),
    )
    expect(report.acceptedW4SectionHashes.RAW_WRAPPERS).toBe(
      digest(producer.rawOperationProducerRegistry),
    )
    for (const [file, p] of Object.entries(report.preservation))
      expect(sha(read(file))).toBe(p.BEFORE_SHA256)
  })
  it('produces a bounded310-hold packet with human decision and downstream impact', () => {
    expect(report.remainingDecisionHolds).toHaveLength(310)
    expect(
      report.remainingDecisionHolds.every(
        (h) =>
          h.PHYSICAL_IDENTITY &&
          h.WHY_ACTIVE_AUTHORITY_IS_INSUFFICIENT &&
          h.MINIMUM_HUMAN_DECISION_REQUIRED &&
          h.DOWNSTREAM_IMPACT.BLOCKS_W4 === 'YES',
      ),
    ).toBe(true)
    expect(report.phaseStatus.NO_FURTHER_W4_GENERIC_STATIC_DISCOVERY).toBe('YES')
  })
  it('never generates mutating operations or synthetic substitute Django DDL', () => {
    expect(report.approvedProducerUpdates).toEqual([])
    expect(report.summary.MUTATING_SQL_GENERATED).toBe(0)
    expect(report.summary.GENERATED_SUBSTITUTE_DJANGO_DDL).toBe(0)
    expect(report.platformProducerRegistry.every((p) => p.MUTATING_OPERATIONS.length === 0)).toBe(
      true,
    )
  })
  it('retains honest W4/W4D gates,1.3 and no W5 or runtime authorization', () => {
    expect(report.phaseStatus.PHASE_1B_3C_A1I_W4D).toBe('BLOCKED')
    expect(report.phaseStatus.PHASE_1B_3C_A1I_W4_GATE).toBe('BLOCKED')
    expect(report.phaseStatus.CONTRACT_VERSION).toBe('1.3')
    expect(report.phaseStatus.CONTRACT_1_4_CREATED).toBe('NO')
    expect(report.phaseStatus.W5_STARTED).toBe('NO')
    expect(report.phaseStatus.PHYSICAL_PRODUCERS_EXECUTED).toBe('NO')
    expect(report.phaseStatus.PRODUCT_READY).toBe('NO')
  })
  it('generates deterministic persistent artifacts without rewriting fixed sources', async () => {
    const a = await generate()
    expect(Object.keys(a)).toEqual([outputs.json, outputs.holds, outputs.markdown])
    for (const [file, bytes] of Object.entries(a)) expect(bytes).toBe(read(file))
    for (const [file, p] of Object.entries(report.preservation))
      expect(sha(read(file))).toBe(p.AFTER_SHA256)
  })
  it('checks generated bytes', async () => {
    await expect(main(['--self-test', '--check'])).resolves.toBeUndefined()
  })
  it.each([['--apply'], ['--execute'], ['--check', '--check']])(
    'rejects unsafe/unknown/duplicate flags %j',
    async (...args) => {
      await expect(main(args)).rejects.toThrow()
    },
  )
})
