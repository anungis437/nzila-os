/**
 * In-process TREASURER gates.
 * This module re-executes checks. It is not an independent VERIFIER.
 * certificationFromGates never emits TREASURER_CERTIFIED YES.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { authorizationAttacks, authorityPosture } from './authority'
import {
  allocateMinor,
  benchmarkExcess,
  envelopeUnreleased,
  holdingPeriodReturnBps,
  maxDrawdownBps,
  opportunityCostBps,
} from './calculations'
import { inheritPeerAuthority } from './boundaries'
import { BOUNDARY_STATEMENTS } from './boundaries'
import { FLEET_PEERS, TREASURER_IDENTITY } from './kernel'
import {
  fleetCertifiedFromImplementerAssessment,
  type ImplementerAssessment,
} from './certification-authority'
import { ACCEPTED_LIMITATIONS, RED_TEAM_ATTACKS, renderRedTeamReport, runRedTeam } from './red-team'
import { SCHEMA_REQUIRED_FIELDS } from './schemas'
import { sampleEnvelope } from './fixtures'

export const DOCTRINE_MARKERS = [
  'TREASURER',
  'Personal investment-capital intelligence',
  'Aubert Nungisa',
  'PRODUCTION AUTHORITY: NO',
  'FINANCIAL TRANSACTION AUTHORITY: NEVER',
  'FACT',
  'ASSUMPTION',
  'ESTIMATE',
  'SCENARIO',
  'THESIS',
  'DECISION',
  'AUTHORIZATION',
  'corporate capital',
  'personal capital',
  'fail closed',
  'ANALYSIS_COMPLETE',
  'DECISION_READY',
  'HUMAN_AUTHORIZED',
  'TRANSACTION_EXTERNALLY_CONFIRMED',
  'CAPITAL_ENVELOPE_EXISTS',
  'INVESTMENT_AUTHORIZED',
  'TRANSACTION_EXECUTED',
  'NORTHSTAR',
] as const

export interface GateResults {
  readonly TREASURER_DOCTRINE: 'VALID' | 'INVALID'
  readonly TREASURER_BOUNDARIES: 'ENFORCED' | 'NOT_ENFORCED'
  readonly TREASURER_CALCULATIONS: 'VERIFIED' | 'FAILED'
  readonly TREASURER_AUTHORITY: 'FAIL_CLOSED' | 'OPEN'
  /** Resolved catalog attacks blocked. This is not RED_TEAM_PASS and not Fleet REDTEAM. */
  readonly RESOLVED_ATTACKS_BLOCKED: 'PASS' | 'FAIL'
  readonly TREASURER_REGRESSION: 'PASS' | 'FAIL'
  readonly notes: readonly string[]
}

/** Package-local regression is not a full-repo PASS. */
export type ScopedRegression = 'PASS_PACKAGE_LOCAL' | 'FAIL'

export interface CertificationRecord {
  readonly RECORD_KIND: 'IMPLEMENTER_ASSESSMENT'
  readonly IMPLEMENTER_ASSESSMENT: ImplementerAssessment
  readonly FLEET_CERTIFIED: 'NO'
  readonly TREASURER_DOCTRINE: GateResults['TREASURER_DOCTRINE']
  readonly TREASURER_BOUNDARIES: GateResults['TREASURER_BOUNDARIES']
  readonly TREASURER_CALCULATIONS: GateResults['TREASURER_CALCULATIONS']
  readonly TREASURER_AUTHORITY: GateResults['TREASURER_AUTHORITY']
  readonly RESOLVED_ATTACKS_BLOCKED: GateResults['RESOLVED_ATTACKS_BLOCKED']
  readonly TREASURER_REGRESSION: ScopedRegression
  readonly TREASURER_CERTIFIED: 'NO'
  readonly PRODUCTION_AUTHORITY: 'NO'
  readonly FINANCIAL_TRANSACTION_AUTHORITY: 'NEVER'
  readonly acceptedLimitations: readonly string[]
  readonly notes: readonly string[]
}

/**
 * Standing honesty notes. These record the independent VERIFIER refusal
 * and keep package-local evidence from being read as full-repo certification.
 */
export const CERTIFICATION_HONESTY_NOTES = [
  'RECORD_KIND is IMPLEMENTER_ASSESSMENT. This module cannot issue FLEET_CERTIFIED.',
  'IMPLEMENTER_PASS is not FLEET_CERTIFIED. LOCAL_RED_TEAM pass is not FLEET_CERTIFIED. PACKAGE_TESTS pass is not FLEET_CERTIFIED.',
  'Independent VERIFIER on PR #859 at 5f25a566 returned a NO verdict. VERIFIER NO implies TREASURER_CERTIFIED NO.',
  'Candidate eef575eec5600a28c041126785490e0f79d42b19 is INVALID. Independent Fleet REDTEAM returned RED_TEAM_PASS NO on that SHA. This record remains an IMPLEMENTER_ASSESSMENT and FLEET_CERTIFIED stays NO.',
  'Candidate 28ac10067df4fd571a87d0119b0f86e88b2f4175 is INVALID. Independent Fleet REDTEAM returned RED_TEAM_PASS NO on that SHA because unrelated-id-concentration-split was OPEN. This record remains an IMPLEMENTER_ASSESSMENT and FLEET_CERTIFIED stays NO.',
  'RESOLVED_ATTACKS_BLOCKED records only that resolved local attacks were blocked. It is not RED_TEAM_PASS and it is not Fleet REDTEAM.',
  'Findings recorded here: CI merge was BLOCKED (branch-policy, secret-scan integration 403, Trivy SARIF upload 403, repository inventory drift, governance gate cascade); monorepo suites had not been run at that gate; certification was previously self-certified by this module.',
  'TREASURER_REGRESSION PASS_PACKAGE_LOCAL is package-local static anchors and in-package checks only. It is not a full-repo PASS of pnpm lint, pnpm typecheck, pnpm test:fast, or pnpm governance:audit, and it is not independent re-execution of corporate treasury, doctrine-enforcement, or capital contract suites.',
  'PRODUCTION AUTHORITY remains NO. FINANCIAL TRANSACTION AUTHORITY remains NEVER.',
] as const

export function repoRootFromHere(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  throw new Error('repo root not found')
}

function read(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function doctrineGate(root: string): { pass: boolean; notes: string[] } {
  const notes: string[] = []
  const path = 'docs/doctrine/treasurer/TREASURER_DOCTRINE.md'
  if (!existsSync(join(root, path))) {
    notes.push('doctrine file missing')
    return { pass: false, notes }
  }
  const text = read(root, path)
  for (const marker of DOCTRINE_MARKERS) {
    if (!text.includes(marker)) notes.push(`doctrine missing marker: ${marker}`)
  }
  if (!text.includes('CAPITAL')) notes.push('doctrine missing CAPITAL')
  return { pass: notes.length === 0, notes }
}

function boundariesGate(root: string): { pass: boolean; notes: string[] } {
  const notes: string[] = []
  for (const peer of FLEET_PEERS) {
    const inherited = inheritPeerAuthority(peer)
    if (inherited.ok) notes.push(`${peer} authority was inherited`)
  }
  const mapPath = 'governance/personal-capital/treasurer/TREASURER_INTEGRATION_MAP.md'
  if (!existsSync(join(root, mapPath))) {
    notes.push('integration map missing')
  } else {
    const map = read(root, mapPath)
    for (const peer of FLEET_PEERS) {
      if (!map.includes(peer)) notes.push(`integration map missing ${peer}`)
    }
    if (!map.includes(BOUNDARY_STATEMENTS.CAPITAL)) notes.push('integration map missing CAPITAL statement')
    if (!map.includes(BOUNDARY_STATEMENTS.TREASURER)) notes.push('integration map missing TREASURER statement')
    if (!map.includes('does not inherit')) notes.push('integration map missing non-inheritance')
  }
  const contract = 'governance/personal-capital/treasurer/TREASURER_AGENT_CONTRACT.md'
  const matrix = 'governance/personal-capital/treasurer/TREASURER_AUTHORITY_MATRIX.md'
  if (!existsSync(join(root, contract))) notes.push('agent contract missing')
  if (!existsSync(join(root, matrix))) notes.push('authority matrix missing')
  return { pass: notes.length === 0, notes }
}

function calculationsGate(): { pass: boolean; notes: string[] } {
  const notes: string[] = []
  const allocation = allocateMinor(100, [
    { id: 'a', bps: 3333 },
    { id: 'b', bps: 3333 },
    { id: 'c', bps: 3334 },
  ])
  if (!allocation.ok || allocation.value.map((row) => row.minor).join(',') !== '33,33,34') {
    notes.push('allocation fixture failed')
  }
  const tie = allocateMinor(1, [
    { id: 'a', bps: 5000 },
    { id: 'b', bps: 5000 },
  ])
  if (!tie.ok || tie.value.map((row) => `${row.id}:${row.minor}`).join(',') !== 'a:1,b:0') {
    notes.push('allocation tie-break failed')
  }
  const ret = holdingPeriodReturnBps(10_000, 11_000)
  if (!ret.ok || ret.value !== 1000) notes.push('return fixture failed')
  const drawdown = maxDrawdownBps([100, 120, 90])
  if (!drawdown.ok || drawdown.value !== -2500) notes.push('drawdown fixture failed')
  const unreleased = envelopeUnreleased(100_000, 25_000)
  if (!unreleased.ok || unreleased.value !== 75_000) notes.push('envelope math failed')
  const cost = opportunityCostBps({
    chosenReturnBps: 1000,
    chosenClass: 'FACT',
    alternativeReturnBps: 1500,
    alternativeClass: 'FACT',
  })
  if (!cost.ok || cost.value.costBps !== 500 || cost.value.epistemicClass !== 'ESTIMATE') {
    notes.push('opportunity cost fixture failed')
  }
  const mismatch = benchmarkExcess({
    portfolioReturnBps: 1000,
    portfolioClass: 'FACT',
    portfolioPeriodStart: '2026-01-01',
    portfolioPeriodEnd: '2026-09-01',
    portfolioCurrency: 'CAD',
    benchmark: {
      id: 'b',
      name: 'other',
      epistemicClass: 'FACT',
      returnBps: 800,
      periodStart: '2025-01-01',
      periodEnd: '2025-09-01',
      currency: 'CAD',
      evidenceId: 'e',
    },
  })
  if (mismatch.ok) notes.push('mismatched benchmark period was accepted')
  const zeroBase = holdingPeriodReturnBps(0, 10)
  if (zeroBase.ok) notes.push('zero-base return was accepted')
  return { pass: notes.length === 0, notes }
}

function authorityGate(): { pass: boolean; notes: string[] } {
  const notes: string[] = []
  const posture = authorityPosture()
  if (posture.productionAuthority !== 'NO' || posture.financialTransactionAuthority !== 'NEVER') {
    notes.push('authority posture drifted')
  }
  if (TREASURER_IDENTITY.productionAuthority !== 'NO') notes.push('production authority drifted')
  const envelope = sampleEnvelope()
  for (const attack of authorizationAttacks(envelope)) {
    if (attack.ok) notes.push('authorization attack succeeded')
  }
  if (envelope.investmentAuthorized || envelope.transactionExecuted || envelope.committedMinor !== 0) {
    notes.push('fresh envelope looks authorized or executed')
  }
  return { pass: notes.length === 0, notes }
}

function redTeamGate(): { pass: boolean; notes: string[] } {
  const notes: string[] = []
  const executed = runRedTeam()
  if (!executed.pass) notes.push('one or more resolved red-team attacks were not blocked')
  const report = renderRedTeamReport()
  for (const attack of RED_TEAM_ATTACKS) {
    if (!report.includes(attack.id)) notes.push(`report missing attack ${attack.id}`)
    const outcome = executed.results.find((result) => result.id === attack.id)
    if (attack.disposition === 'RESOLVED' && outcome?.blocked !== true) {
      notes.push(`resolved attack ${attack.id} was not blocked`)
    }
    if (attack.disposition === 'OPEN' && outcome?.blocked === true) {
      notes.push(`attack ${attack.id} is marked OPEN but was blocked`)
    }
  }
  if (!report.includes('## Findings') || !report.includes('## Remediations') || !report.includes('## Accepted limitations')) {
    notes.push('red-team report sections missing')
  }
  for (const limitation of ACCEPTED_LIMITATIONS) {
    if (!report.includes(limitation.id)) notes.push(`report missing limitation ${limitation.id}`)
  }
  if (executed.openIds.length > 0 && !report.includes('Disposition: OPEN')) {
    notes.push('red-team report hides an OPEN finding')
  }
  return { pass: notes.length === 0 && executed.pass, notes }
}

function walkSources(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walkSources(path, acc)
    else if (entry.name.endsWith('.ts')) acc.push(path)
  }
  return acc
}

function regressionGate(root: string): { pass: boolean; notes: string[] } {
  const notes: string[] = []
  const treasury = read(root, 'packages/executive-os/src/agents/treasury.ts')
  if (!treasury.includes("key: 'treasury'") || !treasury.includes('Protect cash reality')) {
    notes.push('corporate treasury agent anchor drifted')
  }
  const contract = read(root, 'packages/executive-os/src/contract.ts')
  if (!contract.includes('return { ...action, requiresApproval: true }')) {
    notes.push('executive approval default anchor drifted')
  }
  const capital = read(root, 'scripts/lib/capital-allocation.ts')
  if (!capital.includes("'FUND NOW'") || !capital.includes('export type CapitalDecision')) {
    notes.push('corporate CAPITAL decision anchor drifted')
  }
  const treasuryTest = read(root, 'packages/executive-os/src/agents/treasury.test.ts')
  if (!treasuryTest.includes('below minimum')) notes.push('corporate treasury test anchor drifted')
  if (!existsSync(join(root, 'tooling/contract-tests/capital-allocation.test.ts'))) {
    notes.push('corporate capital contract test missing')
  }
  const pkg = JSON.parse(read(root, 'packages/treasurer/package.json')) as { dependencies?: Record<string, string> }
  const deps = Object.keys(pkg.dependencies ?? {})
  if (deps.length !== 1 || deps[0] !== 'zod') notes.push('TREASURER dependencies drifted')
  const forbidden = ['@nzila/payments-stripe', '@nzila/finance-core', '@nzila/executive-os', 'capital-allocation', 'stripe']
  for (const file of walkSources(join(root, 'packages/treasurer/src'))) {
    const text = readFileSync(file, 'utf8')
    const specifiers = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g), ...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
      (match) => match[1] ?? '',
    )
    for (const specifier of specifiers) {
      for (const token of forbidden) {
        if (specifier.includes(token)) notes.push(`${file} imports forbidden ${token}`)
      }
    }
  }
  for (const [name, fields] of Object.entries(SCHEMA_REQUIRED_FIELDS)) {
    const path = join(root, 'packages/treasurer/schemas', name)
    if (!existsSync(path)) {
      notes.push(`schema missing ${name}`)
      continue
    }
    const schema = JSON.parse(readFileSync(path, 'utf8')) as { required?: string[] }
    for (const field of fields) {
      if (!schema.required?.includes(field)) notes.push(`${name} missing required ${field}`)
    }
  }
  return { pass: notes.length === 0, notes }
}

export function evaluateGates(root = repoRootFromHere()): GateResults {
  const doctrine = doctrineGate(root)
  const boundaries = boundariesGate(root)
  const calculations = calculationsGate()
  const authority = authorityGate()
  const redTeam = redTeamGate()
  const regression = regressionGate(root)
  return {
    TREASURER_DOCTRINE: doctrine.pass ? 'VALID' : 'INVALID',
    TREASURER_BOUNDARIES: boundaries.pass ? 'ENFORCED' : 'NOT_ENFORCED',
    TREASURER_CALCULATIONS: calculations.pass ? 'VERIFIED' : 'FAILED',
    TREASURER_AUTHORITY: authority.pass ? 'FAIL_CLOSED' : 'OPEN',
    RESOLVED_ATTACKS_BLOCKED: redTeam.pass ? 'PASS' : 'FAIL',
    TREASURER_REGRESSION: regression.pass ? 'PASS' : 'FAIL',
    notes: [
      ...doctrine.notes,
      ...boundaries.notes,
      ...calculations.notes,
      ...authority.notes,
      ...redTeam.notes,
      ...regression.notes,
    ],
  }
}

export function implementerAssessmentFromGates(gates: GateResults): ImplementerAssessment {
  const pass =
    gates.TREASURER_DOCTRINE === 'VALID' &&
    gates.TREASURER_BOUNDARIES === 'ENFORCED' &&
    gates.TREASURER_CALCULATIONS === 'VERIFIED' &&
    gates.TREASURER_AUTHORITY === 'FAIL_CLOSED' &&
    gates.RESOLVED_ATTACKS_BLOCKED === 'PASS' &&
    gates.TREASURER_REGRESSION === 'PASS'
  return pass ? 'IMPLEMENTER_PASS' : 'IMPLEMENTER_FAIL'
}

export function certificationFromGates(gates: GateResults): CertificationRecord {
  const assessment = implementerAssessmentFromGates(gates)
  const regression: ScopedRegression = gates.TREASURER_REGRESSION === 'PASS' ? 'PASS_PACKAGE_LOCAL' : 'FAIL'
  const openIds = runRedTeam().openIds
  const openNotes =
    openIds.length > 0
      ? [
          `Material OPEN local red-team findings block fleet certification claims: ${openIds.join(', ')}. LOCAL_RED_TEAM is not Fleet REDTEAM.`,
        ]
      : []
  return {
    RECORD_KIND: 'IMPLEMENTER_ASSESSMENT',
    IMPLEMENTER_ASSESSMENT: assessment,
    FLEET_CERTIFIED: fleetCertifiedFromImplementerAssessment(assessment),
    TREASURER_DOCTRINE: gates.TREASURER_DOCTRINE,
    TREASURER_BOUNDARIES: gates.TREASURER_BOUNDARIES,
    TREASURER_CALCULATIONS: gates.TREASURER_CALCULATIONS,
    TREASURER_AUTHORITY: gates.TREASURER_AUTHORITY,
    RESOLVED_ATTACKS_BLOCKED: gates.RESOLVED_ATTACKS_BLOCKED,
    TREASURER_REGRESSION: regression,
    TREASURER_CERTIFIED: 'NO',
    PRODUCTION_AUTHORITY: 'NO',
    FINANCIAL_TRANSACTION_AUTHORITY: 'NEVER',
    acceptedLimitations: ACCEPTED_LIMITATIONS.map((item) => item.id),
    notes: [...gates.notes, ...CERTIFICATION_HONESTY_NOTES, ...openNotes],
  }
}

export function renderCertificationMarkdown(record: CertificationRecord): string {
  return [
    '# TREASURER certification record',
    '',
    'Produced by `packages/treasurer/src/verifier.ts` as an IMPLEMENTER_ASSESSMENT. This record does not issue fleet certification. PASS_PACKAGE_LOCAL is not a full-repo regression PASS.',
    '',
    `RECORD_KIND: ${record.RECORD_KIND}`,
    `IMPLEMENTER_ASSESSMENT: ${record.IMPLEMENTER_ASSESSMENT}`,
    `FLEET_CERTIFIED: ${record.FLEET_CERTIFIED}`,
    `TREASURER_DOCTRINE: ${record.TREASURER_DOCTRINE}`,
    `TREASURER_BOUNDARIES: ${record.TREASURER_BOUNDARIES}`,
    `TREASURER_CALCULATIONS: ${record.TREASURER_CALCULATIONS}`,
    `TREASURER_AUTHORITY: ${record.TREASURER_AUTHORITY}`,
    `RESOLVED_ATTACKS_BLOCKED: ${record.RESOLVED_ATTACKS_BLOCKED}`,
    `TREASURER_REGRESSION: ${record.TREASURER_REGRESSION}`,
    `TREASURER_CERTIFIED: ${record.TREASURER_CERTIFIED}`,
    `PRODUCTION_AUTHORITY: ${record.PRODUCTION_AUTHORITY}`,
    `FINANCIAL_TRANSACTION_AUTHORITY: ${record.FINANCIAL_TRANSACTION_AUTHORITY}`,
    '',
    '## Accepted limitations',
    '',
    ...record.acceptedLimitations.map((id) => `- ${id}`),
    '',
    '## Gate notes',
    '',
    ...(record.notes.length > 0 ? record.notes.map((note) => `- ${note}`) : ['- none']),
    '',
  ].join('\n')
}
