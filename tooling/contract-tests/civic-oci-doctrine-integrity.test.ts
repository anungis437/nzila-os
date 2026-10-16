import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  lstatSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  CIVIC_OCI_CONTRACT_PATH,
  CIVIC_SLICE0_APPROVAL,
  CIVIC_SLICE1_APPROVAL,
  CIVIC_SLICE1_REVIEW_PACKET,
  CIVIC_SLICE2_REVIEW_PACKET,
  CIVIC_SLICE2_RECORDED_DECISION,
  CIVIC_SLICE2_APPROVAL,
  validateCivicSlice2Admission,
  assertCivicSlice2Authorized,
  CIVIC_SLICE2_TERMINATED_AT,
  CIVIC_HUMAN_VALIDATION_PLAN,
  CIVIC_HUMAN_ROUND1_AUTHORIZATION,
  CIVIC_HUMAN_ROUND1_MATERIALS,
  CIVIC_HUMAN_ROUND1_APPROVAL,
  validateCivicHumanRound1Admission,
  scanCivicProofStorageSymlinks,
  assertCivicSlice0Authorized,
  assertCivicSlice1Authorized,
  type CivicDoctrineValidationContext,
  validateCivicOciDoctrine,
} from '../../scripts/lib/civic-oci-doctrine'

const ROOT = join(__dirname, '..', '..')
const FIXTURE_PATHS = [
  CIVIC_OCI_CONTRACT_PATH,
  'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_AUTHORIZATION_PACKET.md',
  'apps/civic',
  'apps/union-eyes/lib/oci/frameworks/index.ts',
  'docs/CIVIC_OCI_ALIGNMENT.md',
  'docs/doctrine/ANTI_SURVEILLANCE_DOCTRINE.md',
  'docs/oci/CANON.md',
  'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md',
  'docs/oci/OCI_AI_BOUNDARY.md',
  'docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md',
  'docs/oci/OCI_METHOD.md',
  'docs/oci/README.md',
  'docs/oci/SUPERSEDED.md',
  'docs/public-service/civic-faq.md',
  'docs/public-service/civic-one-page-brief.md',
  'docs/public-service/civic-thesis.md',
  'docs/public-service/clear-method-canonical.md',
  'docs/public-service/forwardable/civic-one-page-brief-executive.md',
  'docs/public-service/human-review-and-evidence-principles.md',
  'governance/portfolio/product-catalog.json',
]

const fixtures: string[] = []
const APPROVED_CONTEXT: CivicDoctrineValidationContext = {
  now: new Date('2026-10-10T17:00:00Z'),
  branch: CIVIC_SLICE0_APPROVAL.branch,
  worktree: CIVIC_SLICE0_APPROVAL.worktree,
  descendsFromApprovedSha: true,
  changedPaths: [],
}

function validate(root: string, context = APPROVED_CONTEXT) {
  return validateCivicOciDoctrine(root, context)
}

function createFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'civic-oci-doctrine-'))
  fixtures.push(root)
  for (const artifact of FIXTURE_PATHS) {
    const source = join(ROOT, artifact)
    const target = join(root, artifact)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(source, target, { recursive: true })
  }
  mutateContract(root, (contract) => {
    delete contract.runtimeAuthorization.slice1
    delete contract.runtimeAuthorization.slice2
  })
  for (const directory of [
    'apps/civic/src/slice1',
    'apps/civic/tests/slice1',
    'apps/civic/src/slice2',
    'apps/civic/tests/slice2',
  ])
    rmSync(join(root, directory), { recursive: true, force: true })
  for (const config of [
    'apps/civic/slice1.tsconfig.json',
    'apps/civic/slice1.vitest.config.ts',
    'apps/civic/slice2.tsconfig.json',
    'apps/civic/slice2.vitest.config.ts',
  ])
    rmSync(join(root, config), { force: true })
  return root
}

function mutateText(root: string, artifact: string, mutate: (value: string) => string): void {
  const path = join(root, artifact)
  writeFileSync(path, mutate(readFileSync(path, 'utf8')))
}

function mutateContract(root: string, mutate: (value: Record<string, any>) => void): void {
  const path = join(root, CIVIC_OCI_CONTRACT_PATH)
  const contract = JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>
  mutate(contract)
  writeFileSync(path, `${JSON.stringify(contract, null, 2)}\n`)
}

function ids(root: string): string[] {
  return validate(root).map((item) => item.id)
}

function createReviewFixture(): string {
  const root = createFixture()
  for (const artifact of [
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md',
    CIVIC_SLICE1_REVIEW_PACKET,
  ])
    cpSync(join(ROOT, artifact), join(root, artifact))
  mutateText(
    root,
    CIVIC_SLICE1_REVIEW_PACKET,
    (text) =>
      text
        .replace(/\r/g, '')
        .replace(
          '**Implementation authorization:** TERMINATED_AT_PROOF_CLOSEOUT',
          '**Implementation authorization:** NONE',
        )
        .split('## MAINTAINER DECISION\n')[0] +
      '## MAINTAINER DECISION\n\n**Decision:** `PENDING_HUMAN_MAINTAINER`\n' +
      '\n**Maintainer:** PENDING\n\n**Decision date:** PENDING\n\n**Conditions:** PENDING\n' +
      '\n**Authorized starting SHA:** PENDING\n\n**Authorized branch/worktree:** PENDING\n',
  )
  return root
}

function copyBlockedDecision(root: string): void {
  const packet = readFileSync(join(ROOT, CIVIC_SLICE1_REVIEW_PACKET), 'utf8')
    .replace(
      '**Activation disposition:** `CIVIC_SLICE_1_ACTIVATION_PASS`',
      '**Activation disposition:** `CIVIC_SLICE_1_ACTIVATION_BLOCKED`',
    )
    .replace(
      '**Implementation authorization:** TERMINATED_AT_PROOF_CLOSEOUT',
      '**Implementation authorization:** NONE',
    )
  writeFileSync(join(root, CIVIC_SLICE1_REVIEW_PACKET), packet)
}

function createSlice1Fixture(): string {
  const root = createReviewFixture()
  cpSync(join(ROOT, CIVIC_OCI_CONTRACT_PATH), join(root, CIVIC_OCI_CONTRACT_PATH))
  mutateContract(root, (contract) => {
    delete contract.runtimeAuthorization.slice2
  })
  cpSync(join(ROOT, CIVIC_SLICE1_REVIEW_PACKET), join(root, CIVIC_SLICE1_REVIEW_PACKET))
  mutateText(root, CIVIC_SLICE1_REVIEW_PACKET, (text) =>
    text.replace(
      '**Implementation authorization:** TERMINATED_AT_PROOF_CLOSEOUT',
      '**Implementation authorization:** NONE',
    ),
  )
  for (const artifact of [
    'apps/civic/src/slice1',
    'apps/civic/tests/slice1',
    'apps/civic/slice1.tsconfig.json',
    'apps/civic/slice1.vitest.config.ts',
  ])
    cpSync(join(ROOT, artifact), join(root, artifact), { recursive: true })
  return root
}

const SLICE1_CONTEXT = { ...APPROVED_CONTEXT, now: new Date('2026-10-10T18:30:00Z') }
const SLICE2_REVIEW_CONTEXT = {
  ...SLICE1_CONTEXT,
  now: new Date('2026-10-12T14:00:00Z'),
  changedPaths: [CIVIC_SLICE2_REVIEW_PACKET],
}

function createSlice2ReviewFixture(): string {
  const root = createSlice1Fixture()
  for (const artifact of [
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md',
    CIVIC_SLICE2_REVIEW_PACKET,
  ])
    cpSync(join(ROOT, artifact), join(root, artifact))
  mutateText(
    root,
    CIVIC_SLICE2_REVIEW_PACKET,
    (text) =>
      text.replace(/\r/g, '').split('## MAINTAINER DECISION\n')[0] +
      '## MAINTAINER DECISION\n\n**Decision:** `PENDING_HUMAN_MAINTAINER`\n\n' +
      [
        'Maintainer',
        'Decision date',
        'Conditions',
        'Authorized starting SHA',
        'Authorized branch/worktree',
        'Storage locations',
        'Integrity-anchor custody/location',
        'Proof owner',
      ]
        .map((field) => `**${field}:** PENDING`)
        .join('\n\n') +
      '\n',
  )
  mutateText(root, CIVIC_SLICE2_REVIEW_PACKET, (text) =>
    text
      .replace(
        '**Implementation authorization:** TERMINATED_AT_PROOF_CLOSEOUT',
        '**Implementation authorization:** NONE',
      )
      .replace('**Execution state:** TERMINATED', '**Execution state:** NOT_AUTHORIZED')
      .replace(
        '**Activation disposition:** `CIVIC_SLICE_2_ACTIVATION_PASS`',
        '**Activation disposition:** `CIVIC_SLICE_2_ACTIVATION_BLOCKED`',
      ),
  )
  return root
}

afterEach(() => {
  while (fixtures.length > 0) rmSync(fixtures.pop()!, { recursive: true, force: true })
})

function createActiveSlice2Fixture(): string {
  const root = createSlice1Fixture()
  for (const artifact of [
    CIVIC_OCI_CONTRACT_PATH,
    CIVIC_SLICE2_REVIEW_PACKET,
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md',
  ])
    cpSync(join(ROOT, artifact), join(root, artifact))
  for (const artifact of [
    'apps/civic/src/slice2',
    'apps/civic/tests/slice2',
    'apps/civic/slice2.tsconfig.json',
    'apps/civic/slice2.vitest.config.ts',
  ])
    cpSync(join(ROOT, artifact), join(root, artifact), { recursive: true })
  return root
}
const ACTIVE_SLICE2_CONTEXT = { ...SLICE2_REVIEW_CONTEXT, now: new Date('2026-10-12T15:00:00Z') }

const HUMAN_PLAN_CONTEXT: CivicDoctrineValidationContext = {
  ...ACTIVE_SLICE2_CONTEXT,
  now: new Date('2026-10-12T23:50:00Z'),
  changedPaths: [CIVIC_HUMAN_VALIDATION_PLAN],
}

function createHumanPlanFixture(): string {
  const root = createActiveSlice2Fixture()
  for (const artifact of [
    CIVIC_HUMAN_VALIDATION_PLAN,
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md',
    '.civic-runtime/slice1',
    '.civic-runtime/slice2',
    '.civic-anchor/slice2',
  ]) {
    mkdirSync(dirname(join(root, artifact)), { recursive: true })
    cpSync(join(ROOT, artifact), join(root, artifact), { recursive: true })
  }
  return root
}

const ROUND1_CONTEXT: CivicDoctrineValidationContext = {
  ...HUMAN_PLAN_CONTEXT,
  now: new Date('2026-10-13T01:00:00Z'),
  changedPaths: [
    CIVIC_HUMAN_VALIDATION_PLAN,
    CIVIC_HUMAN_ROUND1_AUTHORIZATION,
    CIVIC_HUMAN_ROUND1_MATERIALS,
  ],
}

function createRound1Fixture(): string {
  const root = createHumanPlanFixture()
  for (const artifact of [CIVIC_HUMAN_ROUND1_AUTHORIZATION, CIVIC_HUMAN_ROUND1_MATERIALS])
    cpSync(join(ROOT, artifact), join(root, artifact))
  for (const directory of ['administration', 'sessions', 'observations', 'synthesis', 'consent'])
    mkdirSync(join(root, '.civic-research/round1', directory), { recursive: true })
  return root
}

function writeRound1Record(
  root: string,
  category: string,
  code: string,
  values: Record<string, unknown>,
): void {
  writeFileSync(
    join(root, '.civic-research/round1', category, `${code}.json`),
    JSON.stringify({
      participantCode: code,
      classification: CIVIC_HUMAN_ROUND1_APPROVAL.classification,
      scenarioBoundary: 'SYNTHETIC_SCENARIO_ONLY',
      identityTreatment: 'CODED_ONLY',
      ...values,
    }),
  )
}

function addRound1Session(root: string, code = 'R1-D-01', index = 1): void {
  writeRound1Record(root, 'consent', code, {
    consentState: 'GRANTED',
    noticeVersion: 'R1-STATIC-1',
    recording: false,
  })
  writeRound1Record(root, 'sessions', code, {
    sessionIndex: index,
    sessionDate: '2026-10-13T01:00:00Z',
    lens: `${code.slice(3, 4)}_GATE`,
    status: 'COMPLETED',
    consentState: 'GRANTED',
  })
}

describe('bounded Round 1 evidence governance and admission', () => {
  it('admits reviewed six-session preparation without reopening runtime or creating results', () => {
    const root = createRound1Fixture()
    expect(validate(root, ROUND1_CONTEXT)).toEqual([])
    expect(validateCivicHumanRound1Admission(root, ROUND1_CONTEXT)).toEqual([])
    expect(CIVIC_HUMAN_ROUND1_APPROVAL.maximumSessions).toBe(6)
    expect(() => assertCivicSlice0Authorized(root)).toThrow('authorization terminated')
    expect(() => assertCivicSlice1Authorized(root)).toThrow('authorization terminated')
    expect(() => assertCivicSlice2Authorized(root)).toThrow('authorization terminated')
  })

  it.each([
    ['2026-10-12T23:59:13.955Z', false],
    ['2026-10-12T23:59:13.956Z', true],
    ['2026-11-11T23:59:13.955Z', true],
    ['2026-11-11T23:59:13.956Z', false],
    ['2026-11-12T00:00:00Z', false],
  ])(
    'checks exact human window at %s admitted=%s while preserving archival review',
    (now, admitted) => {
      const root = createRound1Fixture()
      const context = { ...ROUND1_CONTEXT, now: new Date(now) }
      expect(validate(root, context)).toEqual([])
      expect(validateCivicHumanRound1Admission(root, context).length === 0).toBe(admitted)
    },
  )

  it.each([
    ['"maximumSessions": 6', '"maximumSessions": 7'],
    ['"custodian": "Aubert Nungisa"', '"custodian": ""'],
    ['"recordingDefault": "NO_AUDIO_VIDEO_RECORDING"', '"recordingDefault": "RECORD_BY_DEFAULT"'],
    ['"retention": "90_DAYS_AFTER_ROUND_1_CLOSEOUT"', '"retention": "INDEFINITE"'],
    ['"scenarioBoundary": "SYNTHETIC_SCENARIO_ONLY"', '"scenarioBoundary": "REAL_DATA_ALLOWED"'],
    ['"runtimeAuthorized": false', '"runtimeAuthorized": true'],
    ['"revokedAt": null', '"revokedAt": "2026-10-13T00:00:00Z"'],
    ['2026-11-11T23:59:13.9553409+00:00', '2026-12-11T23:59:13.9553409+00:00'],
    ['.civic-research\\\\round1', '.civic-research\\\\round2'],
  ])('rejects altered grant %s', (before, after) => {
    const root = createRound1Fixture()
    mutateText(root, CIVIC_HUMAN_ROUND1_AUTHORIZATION, (text) => text.replaceAll(before, after))
    expect(validateCivicHumanRound1Admission(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it.each([CIVIC_HUMAN_ROUND1_AUTHORIZATION, CIVIC_HUMAN_ROUND1_MATERIALS])(
    'requires complete exact artifact %s and rejects premature findings',
    (artifact) => {
      const root = createRound1Fixture()
      mutateText(root, artifact, (text) => text + '\nCompleted human validation: PASS\n')
      expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
        'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
      )
      rmSync(join(root, artifact))
      expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
        'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
      )
    },
  )

  it.each([
    'docs/public-service/operations/CIVIC_HUMAN_VALIDATION_ROUND_2_AUTHORIZATION.md',
    'docs/public-service/operations/CIVIC_HUMAN_VALIDATION_ROUND_1_FINDINGS.md',
    'docs/public-service/operations/CIVIC_HUMAN_VALIDATION_ROUND_1_PARTICIPANTS.md',
    '.civic-research/round1/sessions/tracked.json',
    'apps/civic/app/page.tsx',
    'apps/civic/src/slice2/network.ts',
    'apps/civic/migrations/001.sql',
    'apps/civic/database.sqlite',
    'apps/civic/deployment.yaml',
  ])('does not inherit new document/runtime/evidence permission for %s', (artifact) => {
    const root = createRound1Fixture()
    mkdirSync(dirname(join(root, artifact)), { recursive: true })
    writeFileSync(join(root, artifact), 'Unapproved')
    expect(
      validate(root, {
        ...ROUND1_CONTEXT,
        changedPaths: [...ROUND1_CONTEXT.changedPaths, artifact],
      }).length,
    ).toBeGreaterThan(0)
  })

  it('requires the exact recorded reconciliation decision', () => {
    const root = createRound1Fixture()
    mutateText(
      root,
      'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md',
      (text) => text.split('## Round 1 evidence governance and plan reconciliation\n')[0],
    )
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it.each(['unknown.txt', 'sessions/nested', 'round2'])(
    'rejects unknown research content %s',
    (entry) => {
      const root = createRound1Fixture()
      const path = join(root, '.civic-research/round1', entry)
      if (entry.endsWith('.txt')) writeFileSync(path, 'Not participant evidence')
      else mkdirSync(path)
      expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
        'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
      )
    },
  )

  it('rejects a research junction without touching canonical proof', () => {
    const root = createRound1Fixture()
    const observations = join(root, '.civic-research/round1/observations')
    rmSync(observations, { recursive: true })
    const target = join(root, 'unapproved-evidence')
    mkdirSync(target)
    symlinkSync(target, observations, 'junction')
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it('accepts a bounded synthetic coded consent/session fixture', () => {
    const root = createRound1Fixture()
    addRound1Session(root)
    expect(validate(root, ROUND1_CONTEXT)).toEqual([])
  })

  it('accepts all six independently counted coded sessions and stops at six', () => {
    const root = createRound1Fixture()
    for (const [index, code] of [
      'R1-D-01',
      'R1-D-02',
      'R1-R-01',
      'R1-R-02',
      'R1-T-01',
      'R1-T-02',
    ].entries())
      addRound1Session(root, code, index + 1)
    expect(validate(root, ROUND1_CONTEXT)).toEqual([])
    writeRound1Record(root, 'sessions', 'R1-T-03', { sessionIndex: 7 })
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it.each([
    { sessionIndex: 7 },
    { sessionIndex: 1.5 },
    { sessionDate: '2026-11-12T00:00:00Z' },
    { sessionDate: '2026-10-12T23:59:13.955Z' },
    { sessionDate: '2026-10-13T01:00:00' },
    { lens: 'T_GATE' },
    { participantName: 'Unauthorized identity' },
    { email: 'private@example.invalid' },
    { identityTreatment: 'IDENTIFIED' },
    { scenarioBoundary: 'REAL_INSTITUTIONAL_DATA' },
    { recording: true },
    { consentState: 'ASSUMED' },
  ])('rejects invalid coded session %j', (change) => {
    const root = createRound1Fixture()
    addRound1Session(root)
    mutateText(root, '.civic-research/round1/sessions/R1-D-01.json', (text) =>
      JSON.stringify({ ...JSON.parse(text), ...change }),
    )
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it('rejects duplicate indices and unsupported seventh sessions', () => {
    const root = createRound1Fixture()
    addRound1Session(root, 'R1-D-01', 1)
    addRound1Session(root, 'R1-D-02', 1)
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
    rmSync(join(root, '.civic-research/round1/sessions/R1-D-02.json'))
    writeRound1Record(root, 'sessions', 'R1-D-03', { sessionIndex: 7 })
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it.each([{ recording: true }, { consentState: 'WITHDRAWN' }, { noticeVersion: 'OTHER' }])(
    'denies capture for invalid or withdrawn consent %j',
    (change) => {
      const root = createRound1Fixture()
      addRound1Session(root)
      mutateText(root, '.civic-research/round1/consent/R1-D-01.json', (text) =>
        JSON.stringify({ ...JSON.parse(text), ...change }),
      )
      expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
        'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
      )
    },
  )

  it('does not allow observations or outcome synthesis before consented sessions', () => {
    const root = createRound1Fixture()
    writeRound1Record(root, 'observations', 'R1-D-01', { records: [] })
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
    rmSync(join(root, '.civic-research/round1/observations/R1-D-01.json'))
    writeFileSync(
      join(root, '.civic-research/round1/synthesis/round1.json'),
      JSON.stringify({
        classification: CIVIC_HUMAN_ROUND1_APPROVAL.classification,
        scenarioBoundary: 'SYNTHETIC_SCENARIO_ONLY',
        identityTreatment: 'CODED_ONLY',
        participantCodes: ['R1-D-01'],
        findings: [],
        disposition: 'HUMAN_VALIDATION_PASS',
      }),
    )
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it('blocks missing affirmative consent even if a session asserts consent', () => {
    const root = createRound1Fixture()
    addRound1Session(root)
    rmSync(join(root, '.civic-research/round1/consent/R1-D-01.json'))
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it('preserves evidence bases and requires complete coverage before any PASS', () => {
    const root = createRound1Fixture()
    addRound1Session(root)
    const observation = {
      task: 'T01',
      basis: 'OBSERVED_BEHAVIOR',
      gate: 'D_GATE',
      severity: 'MODERATE',
      outcome: 1,
      activeSeconds: 4,
      manualEntries: 0,
      duplicateEntries: 0,
      externalLookups: 0,
      reconciliationSteps: 0,
      clarifications: 1,
      facilitatorInterventions: 1,
      note: 'Synthetic governance fixture only; no actual participant.',
    }
    writeRound1Record(root, 'observations', 'R1-D-01', { records: [observation] })
    expect(validate(root, ROUND1_CONTEXT)).toEqual([])
    writeFileSync(
      join(root, '.civic-research/round1/synthesis/round1.json'),
      JSON.stringify({
        classification: CIVIC_HUMAN_ROUND1_APPROVAL.classification,
        scenarioBoundary: 'SYNTHETIC_SCENARIO_ONLY',
        identityTreatment: 'CODED_ONLY',
        participantCodes: ['R1-D-01'],
        findings: [observation],
        disposition: 'HUMAN_VALIDATION_PASS',
      }),
    )
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
    rmSync(join(root, '.civic-research/round1/synthesis/round1.json'))
    writeRound1Record(root, 'observations', 'R1-D-01', {
      records: [{ ...observation, basis: 'MIXED_WITH_OPINION' }],
    })
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })

  it('reports malformed research JSON without echoing potentially identifying content', () => {
    const root = createRound1Fixture()
    writeFileSync(
      join(root, '.civic-research/round1/administration/R1-D-01.json'),
      '{"contactName": "PRIVATE_TEST_MARKER", malformed',
    )
    const findings = validate(root, ROUND1_CONTEXT)
    expect(findings.map((x) => x.id)).toContain('CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID')
    expect(JSON.stringify(findings)).not.toContain('PRIVATE_TEST_MARKER')
  })

  it('allows minimal contact administration separately, but blocks identifiers in observations', () => {
    const root = createRound1Fixture()
    writeRound1Record(root, 'administration', 'R1-D-01', {
      contactName: 'Fictional test contact',
      contactChannel: 'fixture@example.invalid',
    })
    addRound1Session(root)
    expect(validate(root, ROUND1_CONTEXT)).toEqual([])
    writeRound1Record(root, 'observations', 'R1-D-01', {
      records: [
        {
          task: 'T01',
          basis: 'OBSERVED_BEHAVIOR',
          gate: 'D_GATE',
          severity: 'MODERATE',
          outcome: 1,
          activeSeconds: 4,
          manualEntries: 0,
          duplicateEntries: 0,
          externalLookups: 0,
          reconciliationSteps: 0,
          clarifications: 1,
          facilitatorInterventions: 1,
          note: 'Contact fixture@example.invalid',
        },
      ],
    })
    expect(validate(root, ROUND1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
    )
  })
})

describe('exact human-validation plan archival gate', () => {
  it('admits the exact reviewed plan with accepted closed slices and unchanged retained proof', () => {
    const root = createHumanPlanFixture()
    expect(validate(root, HUMAN_PLAN_CONTEXT)).toEqual([])
    const contract = JSON.parse(readFileSync(join(root, CIVIC_OCI_CONTRACT_PATH), 'utf8'))
    expect(contract.runtimeAuthorization.authorized).toBe(false)
    expect(contract.runtimeAuthorization.slice3).toBeUndefined()
    expect(contract.humanSessionAuthorization).toBeUndefined()
    expect(contract.outreachAuthorization).toBeUndefined()
    expect(contract.realDataAuthorization).toBeUndefined()
    expect(() => assertCivicSlice0Authorized(root)).toThrow('authorization terminated')
    expect(() => assertCivicSlice1Authorized(root)).toThrow('authorization terminated')
    expect(() => assertCivicSlice2Authorized(root)).toThrow('authorization terminated')
    expect(validateCivicSlice2Admission(root, HUMAN_PLAN_CONTEXT).map((x) => x.observed)).toContain(
      JSON.stringify('Slice 2 authorization terminated'),
    )
  })

  it.each([
    'docs/public-service/operations/CIVIC_CONTROLLED_HUMAN_VALIDATION_PLAN_2.md',
    'docs/public-service/operations/CIVIC_NEW_RESEARCH.md',
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_3_AUTHORIZATION_PACKET.md',
    'docs/public-service/operations/CIVIC_VALIDATION_FINDINGS.md',
    'packages/platform-auth/src/civic.ts',
    'apps/civic/src/slice2/new-code.ts',
    'apps/civic/app/page.tsx',
    'apps/civic/src/slice2/network.ts',
    'apps/civic/deployment.yaml',
    'apps/civic/database.sqlite',
    'apps/civic/migrations/001.sql',
  ])(
    'does not admit unapproved documentation or executable/deployment/data surface %s',
    (artifact) => {
      const root = createHumanPlanFixture()
      mkdirSync(dirname(join(root, artifact)), { recursive: true })
      writeFileSync(join(root, artifact), 'Unapproved surface')
      expect(
        validate(root, {
          ...HUMAN_PLAN_CONTEXT,
          changedPaths: [CIVIC_HUMAN_VALIDATION_PLAN, artifact],
        }).length,
      ).toBeGreaterThan(0)
    },
  )

  it.each([0, 1, 2])('blocks missing Slice %s human acceptance', (slice) => {
    const root = createHumanPlanFixture()
    mutateText(
      root,
      `docs/public-service/operations/CIVIC_RUNTIME_SLICE_${slice}_PROOF.md`,
      (text) =>
        text.replace(
          `**Human proof-owner acceptance:** \`CIVIC_RUNTIME_SLICE_${slice}_ACCEPTED_WITH_LIMITATIONS\``,
          '**Human proof-owner acceptance:** PENDING',
        ),
    )
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
  })

  it.each([0, 1, 2])('blocks reopened Slice %s execution', (slice) => {
    const root = createHumanPlanFixture()
    mutateText(
      root,
      `docs/public-service/operations/CIVIC_RUNTIME_SLICE_${slice}_PROOF.md`,
      (text) =>
        text.replace('**Authorization terminated:** YES', '**Authorization terminated:** NO'),
    )
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
  })

  it('blocks absent hardening completion and conflicting acceptance declarations', () => {
    const root = createHumanPlanFixture()
    mutateText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md', (text) =>
      text.replace('`CIVIC_SYNTHETIC_TECHNICAL_HARDENING_COMPLETE`', 'INCOMPLETE'),
    )
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
    cpSync(
      join(ROOT, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md'),
      join(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md'),
    )
    mutateText(
      root,
      'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md',
      (text) => text + '\n**Human proof-owner acceptance:** PENDING\n',
    )
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
  })

  it.each(['general', 'slice3', 'outreach', 'sessions', 'realData'])(
    'does not admit added %s authorization',
    (permission) => {
      const root = createHumanPlanFixture()
      mutateContract(root, (contract) => {
        if (permission === 'general') contract.runtimeAuthorization.authorized = true
        else if (permission === 'slice3') contract.runtimeAuthorization.slice3 = { enabled: true }
        else contract[`${permission}Authorization`] = { authorized: true }
      })
      expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
        'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
      )
    },
  )

  it.each([
    'apps/civic/src/kernel.ts',
    'apps/civic/src/slice1/store.ts',
    'apps/civic/src/slice2/store.ts',
  ])('still rejects changed archived fingerprint %s', (artifact) => {
    const root = createHumanPlanFixture()
    mutateText(root, artifact, (text) => text + '\nexport const unapproved=true\n')
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
  })

  it.each([
    '.civic-runtime/slice1/checkpoints/retained-inventory.json',
    '.civic-runtime/slice2/final-retained-manifest.json',
    '.civic-runtime/slice2/final-source-inventory.json',
    '.civic-runtime/slice1/checkpoints/final-proof-summary.json',
    '.civic-runtime/slice2/final-performance-summary.json',
  ])('blocks changed or missing retained evidence %s', (artifact) => {
    const root = createHumanPlanFixture()
    const original = readFileSync(join(root, artifact))
    writeFileSync(join(root, artifact), Buffer.concat([original, Buffer.from(' ')]))
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
    rmSync(join(root, artifact))
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
  })

  it('blocks independent-anchor alteration', () => {
    const root = createHumanPlanFixture()
    const manifest = JSON.parse(
      readFileSync(join(root, '.civic-runtime/slice2/final-retained-manifest.json'), 'utf8'),
    )
    const anchor = manifest.entries.find((entry: { file: string }) =>
      entry.file.startsWith('.civic-anchor\\slice2\\'),
    )
    expect(anchor).toBeDefined()
    writeFileSync(join(root, anchor.file), 'Altered anchor')
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
  })

  it.each([
    '**Runtime execution:** `RUNTIME_EXECUTION_AUTHORIZED`',
    '**Human session execution:** `HUMAN_SESSION_EXECUTION_AUTHORIZED`',
    '**Outreach:** `AUTHORIZED`',
    '**Real data:** `AUTHORIZED`',
    '**Document kind:** `VALIDATION_FINDINGS`',
    'Daphne validated CIVIC.',
    'Richard validated CIVIC.',
    'Tom validated CIVIC.',
    'D-GATE passed.',
    'R-GATE passed.',
    'T-GATE passed.',
    'Users accepted the workflow.',
    'Burden reduction was demonstrated.',
  ])('rejects permission conversion or completed findings claim %s', (claim) => {
    const root = createHumanPlanFixture()
    mutateText(root, CIVIC_HUMAN_VALIDATION_PLAN, (text) => text + `\n${claim}\n`)
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
  })

  it.each(['remove', 'duplicate', 'session', 'outreach', 'runtime', 'data'])(
    'requires the exact amendment and rejects %s conversion',
    (conversion) => {
      const root = createHumanPlanFixture()
      mutateText(root, 'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md', (text) => {
        const heading = '## Human validation plan documentation-only archival gate amendment\n'
        const [prior, section] = text.replace(/\r/g, '').split(heading)
        if (conversion === 'remove') return prior
        if (conversion === 'duplicate') return text + '\n' + heading + section
        const field = {
          session: 'Human session execution',
          outreach: 'Outreach',
          runtime: 'Runtime execution',
          data: 'Real data',
        }[conversion]
        return (
          prior +
          heading +
          section.replace(`**${field}:** \`NOT_AUTHORIZED\``, `**${field}:** \`AUTHORIZED\``)
        )
      })
      expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
        'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
      )
    },
  )

  it('requires a present regular plan and denies symlink traversal', () => {
    const root = createHumanPlanFixture()
    rmSync(join(root, CIVIC_HUMAN_VALIDATION_PLAN))
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
    const target = join(root, 'plan-target')
    mkdirSync(target)
    cpSync(
      join(ROOT, CIVIC_HUMAN_VALIDATION_PLAN),
      join(target, 'CIVIC_CONTROLLED_HUMAN_VALIDATION_PLAN.md'),
    )
    const operations = join(root, 'docs/public-service/operations')
    rmSync(operations, { recursive: true })
    symlinkSync(target, operations, 'junction')
    expect(validate(root, HUMAN_PLAN_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
    )
  })
})

describe('CIVIC / OCI doctrine integrity', () => {
  it('detects a storage junction without traversing the linked directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'civic-storage-junction-'))
    fixtures.push(root)
    const target = join(root, 'target')
    const storage = join(root, 'storage')
    mkdirSync(target)
    mkdirSync(storage)
    const link = join(storage, 'anchor-link')
    symlinkSync(target, link, 'junction')
    expect(scanCivicProofStorageSymlinks(storage)).toBe(link)
  })

  it.each(['-journal', '-wal', '-shm'])(
    'tolerates only vanished regular SQLite sidecar %s',
    (suffix) => {
      const root = mkdtempSync(join(tmpdir(), 'civic-storage-race-'))
      fixtures.push(root)
      const file = join(root, `proof.sqlite${suffix}`)
      writeFileSync(file, 'Synthetic transient sidecar')
      const inspect = (path: string) => {
        if (path === file) throw Object.assign(new Error('disappeared'), { code: 'ENOENT' })
        return lstatSync(path)
      }
      expect(scanCivicProofStorageSymlinks(root, inspect)).toBeUndefined()
    },
  )

  it.each([
    ['proof.sqlite', 'ENOENT'],
    ['proof.sqlite-journal', 'EACCES'],
  ])('does not suppress %s inspection failure %s', (name, code) => {
    const root = mkdtempSync(join(tmpdir(), 'civic-storage-error-'))
    fixtures.push(root)
    const file = join(root, name)
    writeFileSync(file, 'Synthetic test artifact')
    const inspect = (path: string) => {
      if (path === file) throw Object.assign(new Error('inspection failure'), { code })
      return lstatSync(path)
    }
    expect(() => scanCivicProofStorageSymlinks(root, inspect)).toThrow('inspection failure')
  })
  it('passes the current canonical repository state', () => {
    expect(
      validate(ROOT, { ...SLICE2_REVIEW_CONTEXT, now: new Date('2026-10-12T15:00:00Z') }),
    ).toEqual([])
  })

  it('admits the immediate amended window before the superseded future timestamp', () => {
    const root = createActiveSlice2Fixture()
    expect(validate(root, ACTIVE_SLICE2_CONTEXT)).toEqual([])
    expect(validateCivicSlice2Admission(root, ACTIVE_SLICE2_CONTEXT)).toEqual([])
    expect(
      Date.parse(CIVIC_SLICE2_APPROVAL.expiresAt) - Date.parse(CIVIC_SLICE2_APPROVAL.effectiveAt),
    ).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it.each([
    new Date(Date.parse(CIVIC_SLICE2_APPROVAL.effectiveAt) - 1),
    new Date(Date.parse(CIVIC_SLICE2_APPROVAL.effectiveAt)),
    new Date(Date.parse(CIVIC_SLICE2_APPROVAL.expiresAt) + 1),
    new Date('2026-10-20T00:00:00Z'),
    new Date(NaN),
  ])('denies admission outside amended window %s', (now) => {
    expect(
      validateCivicSlice2Admission(createActiveSlice2Fixture(), {
        ...ACTIVE_SLICE2_CONTEXT,
        now,
      }).map((x) => x.id),
    ).toContain('CIVIC_SLICE2_AUTHORIZATION_INVALID')
  })

  it('preserves sub-millisecond host timestamp precision at admission', () => {
    const root = createActiveSlice2Fixture()
    expect(
      validateCivicSlice2Admission(root, {
        ...ACTIVE_SLICE2_CONTEXT,
        now: new Date(Date.parse(CIVIC_SLICE2_APPROVAL.effectiveAt) + 1),
      }),
    ).toEqual([])
    expect(
      validateCivicSlice2Admission(root, {
        ...ACTIVE_SLICE2_CONTEXT,
        now: new Date(Date.parse(CIVIC_SLICE2_APPROVAL.expiresAt)),
      }).map((x) => x.observed),
    ).toContain(JSON.stringify('Slice 2 authorization terminated'))
  })

  it('never returns a successful admission without a Slice 2 grant', () => {
    const root = createActiveSlice2Fixture()
    mutateContract(root, (c) => {
      delete c.runtimeAuthorization.slice2
    })
    expect(validateCivicSlice2Admission(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE2_AUTHORIZATION_INVALID',
    )
  })

  it('denies live Slice 2 guard under production environment', () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(() => assertCivicSlice2Authorized(ROOT)).toThrow('production prohibited')
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previous
    }
  })

  it.each([
    [
      `**Effective:** \`${CIVIC_SLICE2_APPROVAL.effectiveAt}\``,
      '**Effective:** `2026-10-12T18:00:00Z`',
    ],
    [
      `**Expires:** \`${CIVIC_SLICE2_APPROVAL.expiresAt}\``,
      '**Expires:** `2026-10-20T14:38:49.5329498+00:00`',
    ],
    [
      '**Immediate activation amendment:** HUMAN_MAINTAINER_APPROVED',
      '**Immediate activation amendment:** PENDING',
    ],
    [
      '**Integrity-anchor custodian:** Aubert Nungisa',
      '**Integrity-anchor custodian:** unapproved',
    ],
  ])('denies amended active decision drift %s', (before, after) => {
    const root = createActiveSlice2Fixture()
    mutateText(root, CIVIC_SLICE2_REVIEW_PACKET, (text) => text.replace(before, after))
    expect(validateCivicSlice2Admission(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE2_AUTHORIZATION_INVALID',
    )
  })

  it.each(['.civic-runtime', '.civic-anchor'])(
    'rejects a file in place of approved %s storage ancestor',
    (ancestor) => {
      const root = createActiveSlice2Fixture()
      writeFileSync(join(root, ancestor), 'Unrelated existing file')
      expect(validate(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.id)).toContain(
        ancestor === '.civic-runtime'
          ? 'CIVIC_SLICE1_AUTHORIZATION_INVALID'
          : 'CIVIC_SLICE2_AUTHORIZATION_INVALID',
      )
    },
  )

  it.each([
    ['effectiveAt', '2026-10-12T18:00:00Z'],
    ['expiresAt', '2027-10-19T18:00:00Z'],
    ['revokedAt', '2026-10-12T15:00:00Z'],
    ['dataBoundary', 'LIVE_DATA'],
    ['production', true],
    ['deployment', true],
    ['slice3', true],
    ['anchorCustodian', 'unapproved'],
    ['anchorDirectory', 'C:\\unapproved'],
  ])('denies altered Slice 2 grant %s', (key, value) => {
    const root = createActiveSlice2Fixture()
    mutateContract(root, (c) => {
      c.runtimeAuthorization.slice2[key] = value
    })
    expect(validate(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE2_AUTHORIZATION_INVALID',
    )
  })

  it.each([
    { branch: 'main' },
    { descendsFromApprovedSha: false },
    { worktree: 'C:\\unapproved' },
    { changedPaths: ['packages/platform-contracts/src/new.ts'] },
  ])('denies Slice 2 isolation drift %j', (override) => {
    expect(
      validate(createActiveSlice2Fixture(), { ...ACTIVE_SLICE2_CONTEXT, ...override }).map(
        (x) => x.id,
      ),
    ).toContain('CIVIC_SLICE2_AUTHORIZATION_INVALID')
  })

  it('rejects new network and unapproved entrypoints while keeping original archives intact', () => {
    const root = createActiveSlice2Fixture()
    mkdirSync(join(root, 'apps/civic/src/slice2'), { recursive: true })
    writeFileSync(
      join(root, 'apps/civic/src/slice2/network.ts'),
      'fetch("https://example.invalid")',
    )
    expect(validate(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE2_SURFACE_INVALID',
    )
    writeFileSync(join(root, 'apps/civic/src/other.ts'), 'export const unauthorized=true')
    expect(validate(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE2_AUTHORIZATION_INVALID',
    )
  })

  it('denies final Slice 2 termination without reopening older slices', () => {
    const root = createActiveSlice2Fixture()
    writeFileSync(
      join(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md'),
      '**Authorization terminated:** YES\n',
    )
    expect(
      validateCivicSlice2Admission(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.observed),
    ).toContain(JSON.stringify('Slice 2 authorization terminated'))
    expect(() => assertCivicSlice0Authorized(root)).toThrow()
    expect(() => assertCivicSlice1Authorized(root)).toThrow('authorization terminated')
    expect(() => assertCivicSlice2Authorized(root)).toThrow('Slice 2 authorization terminated')
  })

  it.each(['apps/civic/src/slice2/store.ts', 'apps/civic/src/slice2/worker.ts'])(
    'rejects changed final Slice 2 archive %s',
    (artifact) => {
      const root = createActiveSlice2Fixture()
      writeFileSync(
        join(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md'),
        '**Authorization terminated:** YES\n',
      )
      mutateText(root, artifact, (text) => text + '\nexport const unapprovedChange=true\n')
      expect(validate(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.id)).toContain(
        'CIVIC_SLICE0_ARCHIVE_INVALID',
      )
    },
  )

  it('rejects missing or added Slice 2 source after termination', () => {
    const root = createActiveSlice2Fixture()
    writeFileSync(
      join(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md'),
      '**Authorization terminated:** YES\n',
    )
    rmSync(join(root, 'apps/civic/src/slice2/anchor.ts'))
    writeFileSync(join(root, 'apps/civic/src/slice2/new-code.ts'), 'export const x=true')
    expect(validate(root, ACTIVE_SLICE2_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE0_ARCHIVE_INVALID',
    )
  })

  it('does not reopen execution by removing the final proof marker or restoring the old grant', () => {
    const root = createActiveSlice2Fixture()
    const afterClosure = { ...ACTIVE_SLICE2_CONTEXT, now: new Date('2026-10-12T21:00:00Z') }
    expect(CIVIC_SLICE2_TERMINATED_AT).not.toBeNull()
    expect(validateCivicSlice2Admission(root, afterClosure).map((x) => x.observed)).toContain(
      JSON.stringify('Slice 2 authorization terminated'),
    )
    mutateContract(root, (c) => {
      c.runtimeAuthorization.slice2.revokedAt = null
    })
    expect(validateCivicSlice2Admission(root, afterClosure).map((x) => x.observed)).toContain(
      JSON.stringify('Slice 2 authorization terminated'),
    )
    expect(validate(root, afterClosure).map((x) => x.id)).toContain(
      'CIVIC_SLICE2_AUTHORIZATION_INVALID',
    )
  })

  it('retains only the exact blocked Slice 2 human decision without a runtime grant', () => {
    const root = createSlice2ReviewFixture()
    mutateText(
      root,
      CIVIC_SLICE2_REVIEW_PACKET,
      (text) =>
        text.split('## MAINTAINER DECISION\n')[0] +
        '## MAINTAINER DECISION\n\n' +
        CIVIC_SLICE2_RECORDED_DECISION +
        '\n',
    )
    expect(validate(root, SLICE2_REVIEW_CONTEXT)).toEqual([])
    expect(
      validate(root, { ...SLICE2_REVIEW_CONTEXT, now: new Date('2026-10-20T00:00:00Z') }),
    ).toEqual([])
    expect(() => assertCivicSlice0Authorized(root)).toThrow('authorization terminated')
    expect(() => assertCivicSlice1Authorized(root)).toThrow('authorization terminated')
    const contract = JSON.parse(readFileSync(join(root, CIVIC_OCI_CONTRACT_PATH), 'utf8'))
    expect(contract.runtimeAuthorization.authorized).toBe(false)
    expect(contract.runtimeAuthorization.slice2).toBeUndefined()
  })

  it.each([
    [
      `**Effective:** \`${CIVIC_SLICE2_APPROVAL.effectiveAt}\``,
      '**Effective:** `2026-10-12T14:00:00Z`',
    ],
    [`**Expires:** \`${CIVIC_SLICE2_APPROVAL.expiresAt}\``, '**Expires:** `2027-10-19T18:00:00Z`'],
    ['**Proof owner:** Aubert Nungisa', '**Proof owner:** unapproved'],
    ['.civic-anchor\\slice2', '.civic-anchor\\other'],
    [
      '**Conditions:** Activation and bounded technical-hardening proof;',
      '**Conditions:** Unbounded implementation;',
    ],
    [
      '**Activation disposition:** `CIVIC_SLICE_2_ACTIVATION_BLOCKED`',
      '**Activation disposition:** `CIVIC_SLICE_2_ACTIVATION_PASS`',
    ],
  ])('rejects altered blocked decision %s', (before, after) => {
    const root = createSlice2ReviewFixture()
    mutateText(root, CIVIC_SLICE2_REVIEW_PACKET, (text) =>
      (
        text.split('## MAINTAINER DECISION\n')[0] +
        '## MAINTAINER DECISION\n\n' +
        CIVIC_SLICE2_RECORDED_DECISION +
        '\n'
      ).replace(before, after),
    )
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it('admits only pending Slice 2 documentation with both archives closed', () => {
    const root = createSlice2ReviewFixture()
    expect(validate(root, SLICE2_REVIEW_CONTEXT)).toEqual([])
    expect(
      validate(root, {
        ...SLICE2_REVIEW_CONTEXT,
        now: new Date('2026-10-18T00:00:00Z'),
      }),
    ).toEqual([])
    expect(() => assertCivicSlice0Authorized(root)).toThrow('authorization terminated')
    expect(() => assertCivicSlice1Authorized(root)).toThrow('Slice 1 authorization terminated')
    const contract = JSON.parse(readFileSync(join(root, CIVIC_OCI_CONTRACT_PATH), 'utf8'))
    expect(contract.runtimeAuthorization.authorized).toBe(false)
    expect(contract.runtimeAuthorization.slice2).toBeUndefined()
  })

  it.each([
    'docs/public-service/operations/arbitrary-new-packet.md',
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_3_AUTHORIZATION_PACKET.md',
    'packages/platform-contracts/src/civic-runtime.ts',
  ])('rejects unrelated changed path %s during Slice 2 review', (artifact) => {
    const root = createSlice2ReviewFixture()
    mkdirSync(dirname(join(root, artifact)), { recursive: true })
    writeFileSync(join(root, artifact), 'Unapproved artifact\n')
    expect(
      validate(root, {
        ...SLICE2_REVIEW_CONTEXT,
        changedPaths: [CIVIC_SLICE2_REVIEW_PACKET, artifact],
      }).map((x) => x.id),
    ).toContain('CIVIC_SLICE1_AUTHORIZATION_INVALID')
  })

  it.each([
    'src/slice2/new-runtime.ts',
    'src/new-entrypoint.ts',
    'src/network.ts',
    'app/page.ts',
    'public/index.html',
    'Dockerfile',
    'migrations/001.sql',
    'state.sqlite',
    'queues/worker.ts',
    'fixtures/real.json',
  ])('rejects new application surface %s during Slice 2 review', (artifact) => {
    const root = createSlice2ReviewFixture()
    mkdirSync(dirname(join(root, 'apps/civic', artifact)), { recursive: true })
    writeFileSync(join(root, 'apps/civic', artifact), 'Unapproved runtime/data\n')
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it.each([
    ['apps/civic/src/kernel.ts', false],
    ['apps/civic/src/kernel.ts', true],
    ['apps/civic/src/slice1/model.ts', false],
    ['apps/civic/src/slice1/model.ts', true],
    ['apps/civic/package.json', false],
  ])('rejects archived file %s with missing=%s during review', (artifact, missing) => {
    const root = createSlice2ReviewFixture()
    if (missing) rmSync(join(root, artifact))
    else mutateText(root, artifact, (text) => text + '\nUnapproved change\n')
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it.each([
    ['**Implementation authorization:** NONE', '**Implementation authorization:** AUTHORIZED'],
    ['**Execution state:** NOT_AUTHORIZED', '**Execution state:** RUNTIME_EXECUTION_AUTHORIZED'],
    ['SLICE_2_DATA_BOUNDARY = SYNTHETIC_ONLY', 'SLICE_2_DATA_BOUNDARY = LIVE_DATA'],
    ['**Decision:** `PENDING_HUMAN_MAINTAINER`', '**Decision:** `AUTHORIZE_CIVIC_RUNTIME_SLICE_2`'],
    ['**Maintainer:** PENDING', '**Maintainer:** Aubert Nungisa'],
    ['**Decision date:** PENDING', '**Decision date:** 2026-10-12'],
    ['**Conditions:** PENDING', '**Conditions:** approved'],
    ['**Authorized starting SHA:** PENDING', '**Authorized starting SHA:** approved'],
    ['**Authorized branch/worktree:** PENDING', '**Authorized branch/worktree:** approved'],
    [
      '**Integrity-anchor custody/location:** PENDING',
      '**Integrity-anchor custody/location:** approved',
    ],
    ['**Storage locations:** PENDING', '**Storage locations:** approved'],
    ['**Proof owner:** PENDING', '**Proof owner:** Aubert Nungisa'],
  ])('denies converted Slice 2 packet declaration %s', (before, after) => {
    const root = createSlice2ReviewFixture()
    mutateText(root, CIVIC_SLICE2_REVIEW_PACKET, (text) => text.replace(before, after))
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it('rejects a second contradictory human decision', () => {
    const root = createSlice2ReviewFixture()
    mutateText(
      root,
      CIVIC_SLICE2_REVIEW_PACKET,
      (text) => text + '\n**Decision:** `AUTHORIZE_CIVIC_RUNTIME_SLICE_2`\n',
    )
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it('rejects contradictory implementation declarations', () => {
    const root = createSlice2ReviewFixture()
    mutateText(root, CIVIC_SLICE2_REVIEW_PACKET, (text) =>
      text.replace(
        '**Implementation authorization:** NONE',
        '**Implementation authorization:** NONE\n\n**Implementation authorization:** AUTHORIZED',
      ),
    )
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it.each([0, 1])('denies review if Slice %s acceptance or termination is removed', (slice) => {
    const root = createSlice2ReviewFixture()
    const proof = `docs/public-service/operations/CIVIC_RUNTIME_SLICE_${slice}_PROOF.md`
    mutateText(root, proof, (text) =>
      text.replace('**Authorization terminated:** YES', '**Authorization terminated:** NO'),
    )
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
    expect(() => assertCivicSlice1Authorized(root)).toThrow()
  })

  it.each([0, 1])('denies unaccepted Slice %s archive', (slice) => {
    const root = createSlice2ReviewFixture()
    mutateText(
      root,
      `docs/public-service/operations/CIVIC_RUNTIME_SLICE_${slice}_PROOF.md`,
      (text) => text.replace(`CIVIC_RUNTIME_SLICE_${slice}_ACCEPTED_WITH_LIMITATIONS`, 'PENDING'),
    )
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it('requires the exact recorded Slice 2 documentation amendment', () => {
    const root = createSlice2ReviewFixture()
    mutateText(
      root,
      'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md',
      (text) => text.split('## Slice 2 documentation-only archival gate amendment')[0],
    )
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it.each(['general', 'slice2'])('rejects %s runtime permission conversion', (permission) => {
    const root = createSlice2ReviewFixture()
    mutateContract(root, (contract) => {
      if (permission === 'general') contract.runtimeAuthorization.authorized = true
      else contract.runtimeAuthorization.slice2 = { enabled: true }
    })
    expect(validate(root, SLICE2_REVIEW_CONTEXT).map((x) => x.id)).toContain(
      permission === 'slice2'
        ? 'CIVIC_SLICE2_AUTHORIZATION_INVALID'
        : 'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
    expect(() => assertCivicSlice1Authorized(root)).toThrow()
  })

  it('rejects CIVIC becoming an independent methodology', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.identity.civicRole = 'independent-methodology'
    })
    expect(ids(root)).toContain('CIVIC_METHOD_AUTHORITY_DRIFT')
  })

  it('reports a malformed contract without throwing', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      delete contract.identity.authority
    })
    expect(ids(root)).toEqual(['CIVIC_CONTRACT_INVALID'])
  })

  it('rejects a CIVIC-owned scoring dimension', () => {
    const root = createFixture()
    mutateText(
      root,
      'docs/public-service/civic-thesis.md',
      (value) => `${value}\nCIVIC introduces the institutional velocity scoring dimension.\n`,
    )
    expect(ids(root)).toContain('CIVIC_INDEPENDENT_SCORING_DRIFT')
  })

  it('rejects an OCI phase mutation when canonical method authority is unchanged', () => {
    const root = createFixture()
    mutateText(root, 'apps/union-eyes/lib/oci/frameworks/index.ts', (value) =>
      value.replace("name: 'Recognition'", "name: 'Diagnosis'"),
    )
    expect(ids(root)).toContain('OCI_METHOD_STRUCTURE_DRIFT')
  })

  it('rejects autonomous institutional decision authority for AI', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.humanAuthority.autonomousInstitutionalDecisioningPermitted = true
    })
    expect(ids(root)).toContain('CIVIC_HUMAN_AUTHORITY_DRIFT')
  })

  it('rejects removing behavioural profiling from the AI prohibitions', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.aiBoundary.prohibited = contract.aiBoundary.prohibited.filter(
        (item: string) => item !== 'behavioural-inference',
      )
    })
    expect(ids(root)).toContain('CIVIC_AI_BOUNDARY_DRIFT')
  })

  it('rejects removal of canonical human-review authority', () => {
    const root = createFixture()
    mutateText(root, 'docs/public-service/human-review-and-evidence-principles.md', (value) =>
      value.replace('human review remains authoritative', 'automation remains authoritative'),
    )
    expect(ids(root)).toContain('CIVIC_HUMAN_AUTHORITY_DRIFT')
  })

  it('rejects permitting institutional leaderboards', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.antiSurveillance.prohibited = contract.antiSurveillance.prohibited.filter(
        (item: string) => item !== 'institutional-leaderboards',
      )
    })
    expect(ids(root)).toContain('CIVIC_ANTI_SURVEILLANCE_DRIFT')
  })

  it('rejects active-pilot claims while portfolio authority remains pre-product', () => {
    const root = createFixture()
    mutateText(
      root,
      'docs/public-service/civic-one-page-brief.md',
      (value) => `${value}\nCIVIC now offers an active pilot for departments.\n`,
    )
    expect(ids(root)).toContain('CIVIC_FRONT_DOOR_POSTURE_DRIFT')
  })

  it('rejects runtime source while runtime authorization remains false', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      delete contract.runtimeAuthorization.slice0
    })
    const runtime = join(root, 'apps/civic/src/index.ts')
    mkdirSync(dirname(runtime), { recursive: true })
    writeFileSync(runtime, 'export const civicRuntime = true\n')
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it('rejects a CIVIC route introduced through another application', () => {
    const root = createFixture()
    const runtime = join(root, 'apps/union-eyes/app/[locale]/civic/page.tsx')
    mkdirSync(dirname(runtime), { recursive: true })
    writeFileSync(runtime, 'export default function CivicPage() { return null }\n')
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it('rejects a CIVIC package alias introduced through another application', () => {
    const root = createFixture()
    const runtime = join(root, 'apps/platform-admin/civic/package.json')
    mkdirSync(dirname(runtime), { recursive: true })
    writeFileSync(runtime, '{"scripts":{"start":"next start"}}\n')
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it('allows non-runtime CIVIC governance metadata outside the placeholder', () => {
    const root = createFixture()
    const metadata = join(root, 'apps/union-eyes/docs/civic/decision-record.json')
    mkdirSync(dirname(metadata), { recursive: true })
    writeFileSync(metadata, '{"runtime":false,"status":"rejected"}\n')
    expect(validate(root)).toEqual([])
  })

  it('ignores historical doctrine even when it contains obsolete claims', () => {
    const root = createFixture()
    const historical = join(root, 'docs/oci/superseded/old-method.md')
    mkdirSync(dirname(historical), { recursive: true })
    writeFileSync(
      historical,
      'CIVIC is an independent methodology with autonomous rankings and active pilots.\n',
    )
    expect(validate(root)).toEqual([])
  })

  it('does not apply first-touch restrictions to OCI technical material', () => {
    const root = createFixture()
    mutateText(
      root,
      'docs/oci/OCI_METHOD.md',
      (value) => `${value}\nTechnical procurement may request an OCI assessment or pilot.\n`,
    )
    expect(validate(root)).toEqual([])
  })

  it('allows additional non-runtime governance metadata in the CIVIC placeholder', () => {
    const root = createFixture()
    writeFileSync(
      join(root, 'apps/civic/decision-record.json'),
      '{"status":"placeholder","runtime":false}\n',
    )
    expect(validate(root)).toEqual([])
  })

  it('allows the exact local synthetic exception without general authorization', () => {
    const root = createFixture()
    const runtime = join(root, 'apps/civic/src/example.ts')
    mkdirSync(dirname(runtime), { recursive: true })
    writeFileSync(runtime, 'export const syntheticOnly = true\n')
    expect(validate(root)).toEqual([])
  })

  it.each([
    ['disabled', 'enabled', false],
    ['scope', 'scope', 'slice-1'],
    ['revoked', 'revokedAt', '2026-10-10T16:30:00Z'],
    ['production', 'production', true],
    ['deployment', 'deployment', true],
    ['slice1', 'slice1', true],
    ['real-data', 'dataBoundary', 'GOVERNMENT'],
    ['wrong-base', 'startingSha', 'invalid'],
    ['unknown-field', 'extra', true],
    ['extended-expiry', 'expiresAt', '2099-01-01T00:00:00Z'],
  ])('fails closed for %s grant', (_label, key, value) => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.runtimeAuthorization.slice0[key] = value
    })
    expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
  })

  it.each([
    { now: new Date('2026-10-10T16:17:49Z') },
    { now: new Date('2026-10-17T16:17:50Z') },
    { now: new Date('invalid') },
    { branch: 'main' },
    { worktree: 'C:\\APPS\\nzila-os' },
    { descendsFromApprovedSha: false },
    { changedPaths: ['apps/cora/package.json'] },
  ])('fails closed for invalid execution context %j', (override) => {
    expect(
      validate(createFixture(), { ...APPROVED_CONTEXT, ...override }).map((f) => f.id),
    ).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
  })

  it.each(['PENDING_HUMAN_MAINTAINER', 'DO_NOT_AUTHORIZE'])(
    'rejects human decision %s',
    (decision) => {
      const root = createFixture()
      mutateText(root, CIVIC_SLICE0_APPROVAL.decisionArtifact, (text) =>
        text.replace('**Decision:** `AUTHORIZE_WITH_CONDITIONS`', `**Decision:** \`${decision}\``),
      )
      expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
    },
  )

  it('rejects unrestricted boolean even alongside scoped grant', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.runtimeAuthorization.authorized = true
    })
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it.each([
    ['src/bad.ts', "import '@nzila/sage-core'"],
    ['src/bad.ts', "import '../../../apps/cora/lib/resolve-org'"],
    ['src/bad.ts', "export * from 'node:http'"],
    ['src/bad.ts', "const module = import('node:http')"],
    ['src/bad.ts', "fetch('https://example.invalid')"],
    ['app/page.ts', 'export const page = true'],
    ['fixtures/real.json', '{"syntheticOnly":false}'],
  ])('continues scanning and rejects %s: %s', (path, source) => {
    const root = createFixture()
    const target = join(root, 'apps/civic', path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
    expect(ids(root)).toContain('CIVIC_SLICE0_SURFACE_INVALID')
  })

  it('denies execution but continues archival scanning after proof termination', () => {
    const root = createFixture()
    writeFileSync(
      join(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md'),
      '**Authorization terminated:** YES\n',
    )
    expect(() => assertCivicSlice0Authorized(root)).toThrow(
      'bounded proof authorization terminated',
    )
    expect(validate(root, { ...APPROVED_CONTEXT, now: new Date('2026-10-18T00:00:00Z') })).toEqual(
      [],
    )
    writeFileSync(join(root, 'apps/civic/src/unauthorized.ts'), 'fetch("https://example.invalid")')
    expect(ids(root)).toContain('CIVIC_SLICE0_SURFACE_INVALID')
  })

  it('allows only the exact pending documentation packet while retaining scan-only source', () => {
    const root = createReviewFixture()
    expect(
      validate(root, { ...APPROVED_CONTEXT, changedPaths: [CIVIC_SLICE1_REVIEW_PACKET] }),
    ).toEqual([])
    expect(() => assertCivicSlice0Authorized(root)).toThrow(
      'bounded proof authorization terminated',
    )
    const contract = JSON.parse(readFileSync(join(root, CIVIC_OCI_CONTRACT_PATH), 'utf8'))
    expect(contract.runtimeAuthorization.authorized).toBe(false)
    expect(contract.runtimeAuthorization.slice1).toBeUndefined()
    expect(readFileSync(join(root, CIVIC_SLICE1_REVIEW_PACKET), 'utf8')).toContain(
      '**Decision:** `PENDING_HUMAN_MAINTAINER`',
    )
  })

  it('does not allow arbitrary documentation beside the exact review packet', () => {
    const root = createReviewFixture()
    const other = 'docs/public-service/operations/arbitrary-new-packet.md'
    writeFileSync(join(root, other), 'Governance proposal only\n')
    expect(
      validate(root, {
        ...APPROVED_CONTEXT,
        changedPaths: [CIVIC_SLICE1_REVIEW_PACKET, other],
      }).map((item) => item.id),
    ).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
  })

  it.each([
    ['src/slice1.ts', 'export const continuity = true'],
    ['src/new-entrypoint.ts', "import './proof'"],
    ['app/page.ts', 'export const page = true'],
    ['public/index.html', '<html></html>'],
    ['Dockerfile', 'FROM node:24'],
    ['migrations/001.sql', 'CREATE TABLE civic_records (id text);'],
    ['fixtures/real.json', '{"syntheticOnly":false}'],
    ['state.sqlite', 'database bytes'],
  ])('rejects new archival surface %s even when the packet is reviewable', (path, contents) => {
    const root = createReviewFixture()
    const target = join(root, 'apps/civic', path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, contents)
    expect(ids(root)).toContain('CIVIC_SLICE0_ARCHIVE_INVALID')
  })

  it.each([
    ['apps/civic/src/kernel.ts', '\nexport const newRuntime = true\n'],
    ['apps/civic/src/proof.ts', '\nfetch("https://example.invalid")\n'],
    ['apps/civic/package.json', ' '],
  ])('rejects changed retained proof bytes in %s', (artifact, extra) => {
    const root = createReviewFixture()
    mutateText(root, artifact, (text) => text + extra)
    expect(ids(root)).toContain('CIVIC_SLICE0_ARCHIVE_INVALID')
    if (extra.includes('fetch')) expect(ids(root)).toContain('CIVIC_SLICE0_SURFACE_INVALID')
  })

  it('rejects missing retained source rather than approving a different archive', () => {
    const root = createReviewFixture()
    rmSync(join(root, 'apps/civic/src/scenario.ts'))
    expect(ids(root)).toContain('CIVIC_SLICE0_ARCHIVE_INVALID')
  })

  it('rejects new shared dependencies in archived package metadata', () => {
    const root = createReviewFixture()
    mutateText(root, 'apps/civic/package.json', (text) =>
      JSON.stringify({
        ...JSON.parse(text),
        dependencies: { '@nzila/db': 'workspace:*' },
      }),
    )
    expect(ids(root)).toContain('CIVIC_SLICE0_ARCHIVE_INVALID')
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it.each(['AUTHORIZE_CIVIC_RUNTIME_SLICE_1', 'AUTHORIZE_WITH_CONDITIONS'])(
    'does not interpret a changed Slice 1 decision %s as runtime permission',
    (decision) => {
      const root = createReviewFixture()
      mutateText(root, CIVIC_SLICE1_REVIEW_PACKET, (text) =>
        text.replace('**Decision:** `PENDING_HUMAN_MAINTAINER`', `**Decision:** \`${decision}\``),
      )
      expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
      expect(() => assertCivicSlice0Authorized(root)).toThrow(
        'bounded proof authorization terminated',
      )
    },
  )

  it('rejects an added Slice 1 exception and unrestricted runtime authorization', () => {
    const root = createReviewFixture()
    mutateContract(root, (contract) => {
      contract.runtimeAuthorization.slice1 = { enabled: true }
    })
    expect(ids(root)).toContain('CIVIC_SLICE1_AUTHORIZATION_INVALID')
    mutateContract(root, (contract) => {
      contract.runtimeAuthorization.authorized = true
    })
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it('requires the recorded human documentation amendment', () => {
    const root = createReviewFixture()
    mutateText(root, 'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md', (text) =>
      text.replace('**Amendment:** `DOCUMENTATION_REVIEW_ALLOWED`', '**Amendment:** PENDING'),
    )
    expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
  })

  it.each([
    ['**Implementation authorization:** NONE', '**Implementation authorization:** ENABLED'],
    ['**Proposed data boundary:** `SYNTHETIC_ONLY`', '**Proposed data boundary:** `LIVE_DATA`'],
    ['## MAINTAINER DECISION', '## UNRECORDED DECISION'],
  ])('rejects a review packet that changes its governance boundary %s', (before, after) => {
    const root = createReviewFixture()
    mutateText(root, CIVIC_SLICE1_REVIEW_PACKET, (text) => text.replace(before, after))
    expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
  })

  it('requires explicit human Slice 0 acceptance for the documentation allowance', () => {
    const root = createReviewFixture()
    mutateText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md', (text) =>
      text.replace(
        '**Human proof-owner acceptance:** `CIVIC_RUNTIME_SLICE_0_ACCEPTED_WITH_LIMITATIONS`',
        '**Human proof-owner acceptance:** PENDING',
      ),
    )
    expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
  })

  it('rejects a directory at the exact packet path without treating it as a document', () => {
    const root = createReviewFixture()
    rmSync(join(root, CIVIC_SLICE1_REVIEW_PACKET))
    mkdirSync(join(root, CIVIC_SLICE1_REVIEW_PACKET))
    expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
  })

  it('cannot reopen runtime by removing the termination marker', () => {
    const root = createReviewFixture()
    mutateText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md', (text) =>
      text.replace('**Authorization terminated:** YES', '**Authorization terminated:** NO'),
    )
    expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
    expect(() => assertCivicSlice0Authorized(root)).toThrow(
      'archival review only; runtime remains closed',
    )
  })

  it('scans the supplied conditional decision without creating an executable Slice 1 grant', () => {
    const root = createReviewFixture()
    copyBlockedDecision(root)
    expect(
      validate(root, { ...APPROVED_CONTEXT, changedPaths: [CIVIC_SLICE1_REVIEW_PACKET] }),
    ).toEqual([])
    expect(() => assertCivicSlice0Authorized(root)).toThrow(
      'bounded proof authorization terminated',
    )
    const contract = JSON.parse(readFileSync(join(root, CIVIC_OCI_CONTRACT_PATH), 'utf8'))
    expect(contract.runtimeAuthorization.authorized).toBe(false)
    expect(contract.runtimeAuthorization.slice1).toBeUndefined()
  })

  it.each([
    [
      '**Activation disposition:** `CIVIC_SLICE_1_ACTIVATION_BLOCKED`',
      '**Activation disposition:** `CIVIC_SLICE_1_ACTIVATION_PASS`',
    ],
    ['**Effective:** `2026-10-10T17:56:14Z`', '**Effective:** PENDING'],
    ['**Expires:** `2026-10-17T17:56:14Z`', '**Expires:** `2099-01-01T00:00:00Z`'],
    ['**Slice 1 proof owner:** Aubert Nungisa', '**Slice 1 proof owner:** PENDING'],
    ['**Implementation authorization:** NONE', '**Implementation authorization:** ENABLED'],
  ])(
    'does not convert a changed blocked authorization record into permission: %s',
    (before, after) => {
      const root = createReviewFixture()
      copyBlockedDecision(root)
      mutateText(root, CIVIC_SLICE1_REVIEW_PACKET, (text) => text.replace(before, after))
      expect(ids(root)).toContain('CIVIC_SLICE0_AUTHORIZATION_INVALID')
      expect(() => assertCivicSlice0Authorized(root)).toThrow(
        'bounded proof authorization terminated',
      )
    },
  )
  it('activates the exact finite Slice 1 grant without reopening Slice 0', () => {
    const root = createSlice1Fixture()
    expect(validate(root, SLICE1_CONTEXT)).toEqual([])
    expect(() => assertCivicSlice0Authorized(root)).toThrow(
      'bounded proof authorization terminated',
    )
    const contract = JSON.parse(readFileSync(join(root, CIVIC_OCI_CONTRACT_PATH), 'utf8'))
    expect(contract.runtimeAuthorization.authorized).toBe(false)
    expect(contract.runtimeAuthorization.slice1).toEqual(CIVIC_SLICE1_APPROVAL)
  })

  it.each([
    ['scope', 'slice2'],
    ['enabled', false],
    ['revokedAt', '2026-10-10T18:00:00Z'],
    ['production', true],
    ['deployment', true],
    ['slice2', true],
    ['dataBoundary', 'LIVE'],
    ['storageDirectory', 'C:\\other'],
    ['checkpointCustodian', 'agent'],
    ['expiresAt', '2099-01-01T00:00:00Z'],
  ])('rejects Slice 1 grant modification %s', (key, value) => {
    const root = createSlice1Fixture()
    mutateContract(root, (contract) => {
      contract.runtimeAuthorization.slice1[key] = value
    })
    expect(validate(root, SLICE1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it.each([
    { now: new Date('2026-10-10T17:56:13Z') },
    { now: new Date('2026-10-17T17:56:14Z') },
    { now: new Date('invalid') },
    { branch: 'main' },
    { worktree: 'C:\\other' },
    { descendsFromApprovedSha: false },
    { changedPaths: ['packages/db/src/client.ts'] },
  ])('rejects invalid Slice 1 context %j', (override) => {
    expect(
      validate(createSlice1Fixture(), { ...SLICE1_CONTEXT, ...override }).map((x) => x.id),
    ).toContain('CIVIC_SLICE1_AUTHORIZATION_INVALID')
  })

  it.each([
    ['src/slice1/network.ts', 'fetch("https://example.invalid")'],
    ['src/slice1/bad.ts', "import '@nzila/db'"],
    ['src/slice1/bad.ts', "import 'node:http'"],
    ['src/slice1/bad.ts', "import 'node:sqlite'"],
    ['src/slice1/bad.ts', "const x=import('node:sqlite')"],
    ['src/slice1/bad.ts', "import '../../../../../packages/sage-core/src/index'"],
    ['migrations/001.sql', 'CREATE TABLE prod (id text);'],
    ['app/page.ts', 'export const page=true'],
    ['Dockerfile', 'FROM node:24'],
  ])('continues rejecting unapproved Slice 1 surface %s', (path, contents) => {
    const root = createSlice1Fixture()
    const target = join(root, 'apps/civic', path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, contents)
    const findings = validate(root, SLICE1_CONTEXT)
    expect(findings.length).toBeGreaterThan(0)
  })

  it('does not authorize a pending Slice 1 decision with a grant present', () => {
    const root = createSlice1Fixture()
    mutateText(root, CIVIC_SLICE1_REVIEW_PACKET, (text) =>
      text.replace(
        '**Decision:** `AUTHORIZE_WITH_CONDITIONS`',
        '**Decision:** `PENDING_HUMAN_MAINTAINER`',
      ),
    )
    expect(validate(root, SLICE1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE1_AUTHORIZATION_INVALID',
    )
  })

  it('denies Slice 1 termination while retaining source scanning after expiry', () => {
    const root = createSlice1Fixture()
    writeFileSync(
      join(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md'),
      '**Authorization terminated:** YES\n',
    )
    expect(() => assertCivicSlice1Authorized(root)).toThrow('Slice 1 authorization terminated')
    expect(validate(root, { ...SLICE1_CONTEXT, now: new Date('2026-10-18T00:00:00Z') })).toEqual([])
    writeFileSync(join(root, 'apps/civic/src/slice1-network.ts'), 'export const bad=true')
    expect(validate(root, SLICE1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE0_ARCHIVE_INVALID',
    )
  })

  it('rejects changed or newly introduced Slice 1 source after proof closeout', () => {
    const root = createSlice1Fixture()
    writeFileSync(
      join(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md'),
      '**Authorization terminated:** YES\n',
    )
    mutateText(
      root,
      'apps/civic/src/slice1/model.ts',
      (text) => text + '\nexport const unapprovedChange=true\n',
    )
    expect(validate(root, SLICE1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE0_ARCHIVE_INVALID',
    )
    writeFileSync(
      join(root, 'apps/civic/src/slice1/new-runtime.ts'),
      'export const newFeature=true\n',
    )
    expect(validate(root, SLICE1_CONTEXT).map((x) => x.id)).toContain(
      'CIVIC_SLICE0_ARCHIVE_INVALID',
    )
  })
})
