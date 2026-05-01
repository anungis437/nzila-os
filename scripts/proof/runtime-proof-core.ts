import { z } from 'zod'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
export type RuntimeStatus = 'healthy' | 'degraded' | 'critical' | 'unknown'
export type GateEnv = 'staging' | 'production'

export interface RuntimeMetric {
  name: string
  value: number | string | boolean | null
  unit: string
  status: RuntimeStatus
}

export interface ScoringDimension {
  dimension: 'release' | 'deploy' | 'health' | 'drift' | 'restore' | 'security' | 'seal'
  weight: number
  earned: number
  rationale: string
  bootstrapEvidence: boolean
}

export interface ArtifactSet {
  ledgerEntries: Record<string, unknown>[]
  ciRuns: Record<string, unknown>[]
  azureRuntime: Record<string, unknown> | null
  healthReport: Record<string, unknown> | null
  securityProof: Record<string, unknown> | null
  driftReport: Record<string, unknown> | null
  restoreDrill: Record<string, unknown> | null
  snapshot: Record<string, unknown> | null
  manifests: number
}

export interface ScoredProofDetails {
  breakdown: ScoringDimension[]
  score: number
  maxScore: number
  grade: Grade
  bootstrapSources: string[]
  blockingFindings: string[]
  advisoryFindings: string[]
  unknowns: string[]
}

export interface ScoreDetailsOptions {
  forcedBlockingFindings?: string[]
  forcedAdvisoryFindings?: string[]
  forcedUnknowns?: string[]
}

export interface SecurityProofClassification {
  earned: number
  rationale: string
  bootstrapEvidence: boolean
  criticalMissing: boolean
}

export interface SealVerificationClassification {
  earned: number
  rationale: string
  verified: boolean
}

export interface RestoreProofSummary {
  hasReport: boolean
  overallStatus: 'pass' | 'fail' | 'partial' | 'unknown'
  passedChecks: number
  totalChecks: number
  drillTimestamp: string | null
  drillAgeDays: number | null
  freshnessScore: 0 | 3 | 6 | 10
}

export interface RuntimeProofForGate {
  period: string
  score: number
  grade: Grade
  blockingFindings: string[]
  unknowns: string[]
  bootstrapSources: string[]
  scoringBreakdown: ScoringDimension[]
}

export interface GateDecision {
  pass: boolean
  reasons: string[]
}

const SENSITIVE_KEY_RE = /token|secret|key|password|credential/i

export const RuntimeProofGateSchema = z.object({
  schemaVersion: z.number(),
  period: z.string(),
  score: z.number(),
  maxScore: z.number().optional(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  blockingFindings: z.array(z.string()),
  unknowns: z.array(z.string()).optional().default([]),
  bootstrapSources: z.array(z.string()),
  scoringBreakdown: z
    .array(
      z.object({
        dimension: z.enum(['release', 'deploy', 'health', 'drift', 'restore', 'security', 'seal']),
        weight: z.number(),
        earned: z.number(),
        rationale: z.string(),
        bootstrapEvidence: z.boolean(),
      }),
    )
    .optional()
    .default([]),
  generatedBy: z.string(),
})

export function scoreToGrade(score: number, hasBootstrap: boolean): Grade {
  const unclamped: Grade =
    score >= 90 ? 'A'
    : score >= 75 ? 'B'
    : score >= 60 ? 'C'
    : score >= 45 ? 'D'
    : 'F'
  if (hasBootstrap && unclamped === 'A') {
    return 'B'
  }
  return unclamped
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs((b.getTime() - a.getTime()) / 86_400_000)
}

export function scoreRestoreDrillFreshness(
  drillTimestamp: string | undefined,
  now: Date = new Date(),
): 0 | 3 | 6 | 10 {
  if (!drillTimestamp) return 0
  const parsed = new Date(drillTimestamp)
  if (Number.isNaN(parsed.getTime())) return 0
  const ageDays = daysBetween(parsed, now)
  if (ageDays < 90) return 10
  if (ageDays < 180) return 6
  return 3
}

export function isBootstrapReleaseEntry(entry: Record<string, unknown>): boolean {
  if (entry['bootstrapEntry'] === true) return true
  const releaseId = typeof entry['releaseId'] === 'string' ? entry['releaseId'].toLowerCase() : ''
  const notes = typeof entry['notes'] === 'string' ? entry['notes'].toLowerCase() : ''
  return releaseId.includes('bootstrap') || notes.includes('bootstrap')
}

export function isBootstrapCiRun(entry: Record<string, unknown>): boolean {
  if (entry['bootstrapEvidence'] === true) return true
  const workflow = typeof entry['workflowName'] === 'string' ? entry['workflowName'].toLowerCase() : ''
  const notes = typeof entry['notes'] === 'string' ? entry['notes'].toLowerCase() : ''
  return workflow.includes('bootstrap') || notes.includes('bootstrap')
}

export function isValidReleaseLedgerEntry(entry: Record<string, unknown>): boolean {
  const hasTimestamp =
    (typeof entry['timestamp'] === 'string' && entry['timestamp'].length > 0) ||
    (typeof entry['date'] === 'string' && entry['date'].length > 0)
  const hasReleaseId = typeof entry['releaseId'] === 'string' && entry['releaseId'].length > 0
  const hasVersion = typeof entry['version'] === 'string' && entry['version'].length > 0
  return hasTimestamp && hasReleaseId && hasVersion
}

export function classifyReleaseLedgerEvidence(
  ledgerEntries: Record<string, unknown>[],
  manifests: number,
): ScoringDimension {
  const malformed = ledgerEntries.filter((entry) => !isValidReleaseLedgerEntry(entry))
  const validEntries = ledgerEntries.filter((entry) => isValidReleaseLedgerEntry(entry))
  const nonBootstrap = validEntries.filter((entry) => !isBootstrapReleaseEntry(entry))

  const hasManifest = manifests > 0
  const hasRealReleaseEntry = nonBootstrap.length > 0
  const bootstrapOnly = validEntries.length > 0 && nonBootstrap.length === 0

  let earned = (hasRealReleaseEntry ? 10 : 0) + (hasManifest ? 10 : 0)

  let rationale =
    !hasRealReleaseEntry && bootstrapOnly
      ? `bootstrap ledger only (${validEntries.length} entries)`
      : !hasRealReleaseEntry
        ? 'no valid release ledger entries'
        : !hasManifest
          ? `${nonBootstrap.length} real ledger entries; no release manifests found`
          : `${nonBootstrap.length} real ledger entries + ${manifests} manifests`

  if (malformed.length > 0) {
    rationale = `${rationale}; malformed entries: ${malformed.length}`
    if (!hasRealReleaseEntry) {
      earned = 0
    }
  }

  return {
    dimension: 'release',
    weight: 20,
    earned,
    rationale,
    bootstrapEvidence: bootstrapOnly,
  }
}

export function classifySecurityProof(
  securityProof: Record<string, unknown> | null,
): SecurityProofClassification {
  if (!securityProof) {
    return {
      earned: 0,
      rationale: 'no security proof',
      bootstrapEvidence: false,
      criticalMissing: true,
    }
  }

  const status = typeof securityProof['overallStatus'] === 'string' ? securityProof['overallStatus'] : 'unknown'
  const bootstrapEvidence = securityProof['bootstrapEvidence'] === true

  if (bootstrapEvidence) {
    return {
      earned: 0,
      rationale: 'bootstrap security proof',
      bootstrapEvidence: true,
      criticalMissing: false,
    }
  }

  if (status === 'pass') {
    return {
      earned: 10,
      rationale: 'security checks pass',
      bootstrapEvidence: false,
      criticalMissing: false,
    }
  }

  if (status === 'warn') {
    return {
      earned: 5,
      rationale: 'security checks warn',
      bootstrapEvidence: false,
      criticalMissing: false,
    }
  }

  return {
    earned: 0,
    rationale: `security status: ${status}`,
    bootstrapEvidence: false,
    criticalMissing: false,
  }
}

export function classifySealVerification(
  snapshot: Record<string, unknown> | null,
): SealVerificationClassification {
  if (!snapshot) {
    return { earned: 0, rationale: 'no evidence pack snapshot', verified: false }
  }

  const sources = snapshot['sources']
  if (!Array.isArray(sources)) {
    return {
      earned: 5,
      rationale: 'snapshot present but sources are unreadable',
      verified: false,
    }
  }

  const hasSha = sources.some((source) => {
    if (!source || typeof source !== 'object') return false
    return typeof (source as Record<string, unknown>)['sha256'] === 'string'
  })

  if (!hasSha) {
    return {
      earned: 5,
      rationale: 'snapshot present but missing sha256 integrity evidence',
      verified: false,
    }
  }

  return {
    earned: 10,
    rationale: 'snapshot present with sha256 integrity',
    verified: true,
  }
}

function scoreDeployDimension(artifacts: ArtifactSet): ScoringDimension {
  const realRuns = artifacts.ciRuns.filter((run) => !isBootstrapCiRun(run))
  const successRuns = realRuns.filter((run) => {
    const status = typeof run['status'] === 'string' ? run['status'].toLowerCase() : ''
    const conclusion =
      typeof run['conclusion'] === 'string' ? run['conclusion'].toLowerCase() : ''
    return status === 'success' || status === 'pass' || conclusion === 'success'
  })
  const ciBootstrapOnly = artifacts.ciRuns.length > 0 && realRuns.length === 0

  const azureStatus =
    typeof artifacts.azureRuntime?.['overallStatus'] === 'string'
      ? artifacts.azureRuntime['overallStatus']
      : undefined
  const azureBootstrap = artifacts.azureRuntime?.['bootstrapEvidence'] === true
  const azureHealthy =
    (azureStatus === 'healthy' || azureStatus === 'pass') && !azureBootstrap

  const earned = (successRuns.length > 0 ? 10 : 0) + (azureHealthy ? 10 : 0)

  const ciRationale =
    ciBootstrapOnly
      ? 'CI: bootstrap only'
      : successRuns.length > 0
        ? `CI: ${successRuns.length}/${realRuns.length} success`
        : `CI: no success runs (${realRuns.length} total)`

  const azureRationale =
    azureBootstrap
      ? 'Azure: bootstrap'
      : azureStatus
        ? `Azure: ${azureStatus}`
        : 'Azure: unknown'

  return {
    dimension: 'deploy',
    weight: 20,
    earned,
    rationale: `${ciRationale}; ${azureRationale}`,
    bootstrapEvidence: ciBootstrapOnly || azureBootstrap,
  }
}

function scoreHealthDimension(artifacts: ArtifactSet): ScoringDimension {
  const status = typeof artifacts.healthReport?.['overallStatus'] === 'string' ? artifacts.healthReport['overallStatus'] : undefined
  const bootstrapEvidence = artifacts.healthReport?.['bootstrapEvidence'] === true

  let earned = 0
  let rationale = 'no health report'

  if (artifacts.healthReport && bootstrapEvidence) {
    rationale = 'bootstrap health report'
  } else if (status === 'pass') {
    earned = 15
    rationale = 'all health checks pass'
  } else if (status === 'warn') {
    earned = 8
    rationale = 'health checks warn'
  } else if (status) {
    rationale = `health status: ${status}`
  }

  return {
    dimension: 'health',
    weight: 15,
    earned,
    rationale,
    bootstrapEvidence,
  }
}

function scoreDriftDimension(artifacts: ArtifactSet): ScoringDimension {
  const drift = artifacts.driftReport
  if (!drift) {
    return {
      dimension: 'drift',
      weight: 15,
      earned: 0,
      rationale: 'no drift report',
      bootstrapEvidence: false,
    }
  }

  const items = drift['driftItems']
  if (!Array.isArray(items)) {
    return {
      dimension: 'drift',
      weight: 15,
      earned: 5,
      rationale: 'drift report unreadable (no driftItems array)',
      bootstrapEvidence: false,
    }
  }

  const blocking = items.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const cls = (item as Record<string, unknown>)['classification']
    return cls === 'blocking-drift'
  })

  if (blocking.length > 0) {
    return {
      dimension: 'drift',
      weight: 15,
      earned: 0,
      rationale: `blocking drift detected (${blocking.length} item${blocking.length === 1 ? '' : 's'})`,
      bootstrapEvidence: false,
    }
  }

  return {
    dimension: 'drift',
    weight: 15,
    earned: items.length === 0 ? 15 : 10,
    rationale: items.length === 0 ? 'drift report: 0 items' : `drift report: ${items.length} non-blocking items`,
    bootstrapEvidence: false,
  }
}

function normalizeRestoreCheck(check: unknown): boolean {
  if (!check || typeof check !== 'object') return false
  const c = check as Record<string, unknown>
  if (typeof c['passed'] === 'boolean') return c['passed']
  if (typeof c['status'] === 'string') return c['status'].toLowerCase() === 'pass'
  return false
}

function isRestoreCheckFailure(check: unknown): boolean {
  if (!check || typeof check !== 'object') return false
  const c = check as Record<string, unknown>
  if (typeof c['passed'] === 'boolean') return c['passed'] === false
  if (typeof c['status'] === 'string') return c['status'].toLowerCase() === 'fail'
  return false
}

function getRestoreCheckName(check: unknown): string {
  if (!check || typeof check !== 'object') return 'unknown-check'
  const c = check as Record<string, unknown>
  return typeof c['check'] === 'string' ? c['check'] : 'unknown-check'
}

export function summarizeRestoreProof(
  restoreDrill: Record<string, unknown> | null,
  now: Date = new Date(),
): RestoreProofSummary {
  if (!restoreDrill) {
    return {
      hasReport: false,
      overallStatus: 'unknown',
      passedChecks: 0,
      totalChecks: 0,
      drillTimestamp: null,
      drillAgeDays: null,
      freshnessScore: 0,
    }
  }

  const checks = Array.isArray(restoreDrill['checks']) ? restoreDrill['checks'] : []
  const passedChecks = checks.filter((check) => normalizeRestoreCheck(check)).length
  const totalChecks = checks.length
  const timestamp = typeof restoreDrill['timestamp'] === 'string' ? restoreDrill['timestamp'] : undefined

  const freshnessScore = scoreRestoreDrillFreshness(timestamp, now)
  const drillAgeDays = timestamp ? Math.round(daysBetween(new Date(timestamp), now)) : null
  const statusRaw = typeof restoreDrill['overallStatus'] === 'string' ? restoreDrill['overallStatus'] : 'unknown'
  const overallStatus =
    statusRaw === 'pass' || statusRaw === 'fail' || statusRaw === 'partial' ? statusRaw : 'unknown'

  return {
    hasReport: true,
    overallStatus,
    passedChecks,
    totalChecks,
    drillTimestamp: timestamp ?? null,
    drillAgeDays,
    freshnessScore,
  }
}

function scoreRestoreDimension(artifacts: ArtifactSet, now: Date = new Date()): ScoringDimension {
  const summary = summarizeRestoreProof(artifacts.restoreDrill, now)
  if (!summary.hasReport) {
    return {
      dimension: 'restore',
      weight: 10,
      earned: 0,
      rationale: 'no restore drill report',
      bootstrapEvidence: false,
    }
  }

  const checks = Array.isArray(artifacts.restoreDrill?.['checks'])
    ? artifacts.restoreDrill['checks']
    : []
  const failedChecks = checks
    .filter((check) => isRestoreCheckFailure(check))
    .map((check) => getRestoreCheckName(check))
    .filter((name, index, all) => all.indexOf(name) === index)

  if (summary.overallStatus !== 'pass') {
    const failedSuffix =
      failedChecks.length > 0
        ? ` (${failedChecks.slice(0, 5).join(', ')}${failedChecks.length > 5 ? ', ...' : ''})`
        : ''
    return {
      dimension: 'restore',
      weight: 10,
      earned: 0,
      rationale: `restore drill ${summary.overallStatus}${failedSuffix}`,
      bootstrapEvidence: false,
    }
  }

  if (summary.totalChecks === 0) {
    return {
      dimension: 'restore',
      weight: 10,
      earned: 0,
      rationale: 'restore drill has no checks',
      bootstrapEvidence: false,
    }
  }

  return {
    dimension: 'restore',
    weight: 10,
    earned: summary.freshnessScore,
    rationale: `restore drill passed; age ${summary.drillAgeDays ?? 'unknown'}d`,
    bootstrapEvidence: false,
  }
}

function scoreSecurityDimension(artifacts: ArtifactSet): ScoringDimension {
  const classified = classifySecurityProof(artifacts.securityProof)
  return {
    dimension: 'security',
    weight: 10,
    earned: classified.earned,
    rationale: classified.rationale,
    bootstrapEvidence: classified.bootstrapEvidence,
  }
}

function scoreSealDimension(artifacts: ArtifactSet): ScoringDimension {
  const classified = classifySealVerification(artifacts.snapshot)
  return {
    dimension: 'seal',
    weight: 10,
    earned: classified.earned,
    rationale: classified.rationale,
    bootstrapEvidence: false,
  }
}

export function calculateScoringBreakdown(
  artifacts: ArtifactSet,
  now: Date = new Date(),
): ScoringDimension[] {
  return [
    classifyReleaseLedgerEvidence(artifacts.ledgerEntries, artifacts.manifests),
    scoreDeployDimension(artifacts),
    scoreHealthDimension(artifacts),
    scoreDriftDimension(artifacts),
    scoreRestoreDimension(artifacts, now),
    scoreSecurityDimension(artifacts),
    scoreSealDimension(artifacts),
  ]
}

export function classifyZeroEarnedFindings(
  breakdown: ScoringDimension[],
): { blocking: string[]; advisory: string[] } {
  const blocking: string[] = []
  const advisory: string[] = []

  for (const dimension of breakdown) {
    if (dimension.bootstrapEvidence) {
      advisory.push(`[${dimension.dimension}] bootstrap evidence — replace with real operational data`)
      continue
    }

    if (dimension.earned === 0) {
      if (dimension.dimension === 'release' || dimension.dimension === 'deploy') {
        blocking.push(`[${dimension.dimension}] ${dimension.rationale}`)
      } else {
        advisory.push(`[${dimension.dimension}] ${dimension.rationale}`)
      }
    }
  }

  return { blocking, advisory }
}

export function classifyFindings(
  breakdown: ScoringDimension[],
): { blocking: string[]; advisory: string[]; unknowns: string[] } {
  const { blocking, advisory } = classifyZeroEarnedFindings(breakdown)
  const unknowns: string[] = []

  for (const dimension of breakdown) {
    if (dimension.earned > 0 && dimension.earned < dimension.weight) {
      advisory.push(`[${dimension.dimension}] partial — ${dimension.rationale}`)
    }

    const lower = dimension.rationale.toLowerCase()
    if (lower.includes('unknown') || lower.includes('no ')) {
      unknowns.push(`[${dimension.dimension}] ${dimension.rationale}`)
    }
  }

  return { blocking, advisory, unknowns }
}

export function calculateScoreDetails(
  breakdown: ScoringDimension[],
  options: ScoreDetailsOptions = {},
): ScoredProofDetails {
  const rawScore = breakdown.reduce((sum, item) => sum + item.earned, 0)
  const maxScore = breakdown.reduce((sum, item) => sum + item.weight, 0)
  const bootstrapSources = breakdown
    .filter((item) => item.bootstrapEvidence)
    .map((item) => item.dimension)
  const findings = classifyFindings(breakdown)

  const blockingFindings = [
    ...findings.blocking,
    ...(options.forcedBlockingFindings ?? []),
  ].filter((value, idx, all) => all.indexOf(value) === idx)
  const advisoryFindings = [
    ...findings.advisory,
    ...(options.forcedAdvisoryFindings ?? []),
  ].filter((value, idx, all) => all.indexOf(value) === idx)
  const unknowns = [
    ...findings.unknowns,
    ...(options.forcedUnknowns ?? []),
  ].filter((value, idx, all) => all.indexOf(value) === idx)

  // A critical runtime posture can never be represented as A/B; cap score accordingly.
  const score = blockingFindings.length > 0 ? Math.min(rawScore, 79) : rawScore
  const grade = scoreToGrade(score, bootstrapSources.length > 0)

  return {
    breakdown,
    score,
    maxScore,
    grade,
    bootstrapSources,
    blockingFindings,
    advisoryFindings,
    unknowns,
  }
}

function getDimension(
  breakdown: ScoringDimension[],
  name: ScoringDimension['dimension'],
): ScoringDimension | undefined {
  return breakdown.find((item) => item.dimension === name)
}

export function evaluateRuntimeGate(
  proof: RuntimeProofForGate,
  env: GateEnv,
): GateDecision {
  if (env === 'staging') {
    return { pass: true, reasons: [] }
  }

  const reasons: string[] = []

  if (proof.score < 80) {
    reasons.push(`score ${proof.score} is below production threshold (80)`)
  }

  if (proof.blockingFindings.length > 0) {
    reasons.push(`${proof.blockingFindings.length} blocking finding(s) present`)
  }

  if (proof.blockingFindings.some((finding) => finding.toLowerCase().includes('expected app missing'))) {
    reasons.push('expected production app footprint is incomplete')
  }

  if (proof.blockingFindings.some((finding) => finding.toLowerCase().includes('dns unresolved'))) {
    reasons.push('production DNS validation failed')
  }

  if (proof.blockingFindings.some((finding) => finding.toLowerCase().includes('sensitive env vars configured as plain values'))) {
    reasons.push('production secret posture failed (plain sensitive env values detected)')
  }

  if (proof.blockingFindings.some((finding) => finding.toLowerCase().includes('no rollback candidate revision'))) {
    reasons.push('rollback readiness failed (no rollback candidates)')
  }

  if (proof.unknowns.length > 0) {
    reasons.push(`unknown evidence remains (${proof.unknowns.length})`)
  }

  if (proof.bootstrapSources.includes('deploy')) {
    reasons.push('deploy evidence is bootstrap-only')
  }

  const deploy = getDimension(proof.scoringBreakdown, 'deploy')
  if (deploy && deploy.earned < deploy.weight) {
    reasons.push(`deploy evidence incomplete (${deploy.earned}/${deploy.weight})`)
  }

  const health = getDimension(proof.scoringBreakdown, 'health')
  if (health && health.earned < health.weight) {
    reasons.push(`health checks not fully passing (${health.earned}/${health.weight})`)
  }

  const drift = getDimension(proof.scoringBreakdown, 'drift')
  if (drift && drift.rationale.toLowerCase().includes('blocking drift')) {
    reasons.push('blocking drift detected')
  }

  const restore = getDimension(proof.scoringBreakdown, 'restore')
  if (restore && restore.earned < restore.weight) {
    reasons.push(`restore drill stale or failed (${restore.earned}/${restore.weight})`)
  }

  const seal = getDimension(proof.scoringBreakdown, 'seal')
  if (seal && seal.earned < seal.weight) {
    reasons.push(`seal verification incomplete (${seal.earned}/${seal.weight})`)
  }

  const security = getDimension(proof.scoringBreakdown, 'security')
  if (security && security.earned === 0 && security.rationale.toLowerCase().includes('no security proof')) {
    reasons.push('critical missing security proof')
  }

  return { pass: reasons.length === 0, reasons }
}

export function redactSensitiveData<T>(value: T): T {
  return redactDeep(value) as T
}

function redactDeep(value: unknown, parentKey = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, parentKey))
  }

  if (value && typeof value === 'object') {
    const out = Object.create(null) as Record<string, unknown>
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue
      }
      const nextValue =
        SENSITIVE_KEY_RE.test(key) ? '[REDACTED]' : redactDeep(child, key)
      if (SENSITIVE_KEY_RE.test(key)) {
        Object.defineProperty(out, key, {
          value: nextValue,
          enumerable: true,
          configurable: true,
          writable: true,
        })
        continue
      }
      Object.defineProperty(out, key, {
        value: nextValue,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return out
  }

  if (typeof value === 'string' && SENSITIVE_KEY_RE.test(parentKey)) {
    return '[REDACTED]'
  }

  return value
}
