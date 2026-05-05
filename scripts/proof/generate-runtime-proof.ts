#!/usr/bin/env npx tsx

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  calculateScoreDetails,
  calculateScoringBreakdown,
  classifySecurityProof,
  classifySealVerification,
  isBootstrapCiRun,
  scoreToGrade,
  summarizeRestoreProof,
  type ArtifactSet,
  type RuntimeMetric,
  type ScoringDimension,
} from './runtime-proof-core'
import { computeRuntimeScore } from '@nzila/platform-ops/runtime/computeRuntimeScore'

const ROOT = (() => {
  if (typeof __dirname !== 'undefined') {
    return path.resolve(path.join(__dirname, '..', '..'))
  }
  const fileUrl = new URL(import.meta.url)
  const filePath = fileUrl.pathname.replace(/^\/([A-Z]:)/, '$1')
  return path.resolve(path.join(path.dirname(filePath), '..', '..'))
})()

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function canonicalPath(value: string): string {
  const normalized = normalizePath(value)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isWithinBase(candidate: string, base: string): boolean {
  const candidateCanonical = canonicalPath(candidate)
  const baseCanonical = canonicalPath(base)
  return candidateCanonical === baseCanonical || candidateCanonical.startsWith(`${baseCanonical}/`)
}

function safeJoinUnder(base: string, ...parts: string[]): string | null {
  if (parts.some((part) => part.includes('\0') || /(^|[\\/])\.\.([\\/]|$)/.test(part))) return null
  const candidate = normalizePath([base, ...parts].join('/'))
  return isWithinBase(candidate, base) ? candidate : null
}

function safeResolveUnderRoot(...segments: string[]): string {
  const candidate = safeJoinUnder(ROOT, ...segments)
  if (!candidate) {
    throw new Error(`Unsafe path outside repository root: ${segments.join('/')}`)
  }
  return candidate
}

function readUtf8(filePath: string): string {
  return execFileSync(
    process.execPath,
    ['-e', 'const fs=require("node:fs");process.stdout.write(fs.readFileSync(process.argv[1],"utf8"));', filePath],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  )
}

interface RuntimeProofV2 {
  schemaVersion: 2
  proofId: string
  timestamp: string
  period: string
  periodType: 'monthly' | 'quarterly'
  metrics: RuntimeMetric[]
  sources: { name: string; path: string; exists: boolean; entries: number }[]
  overallHealth: 'healthy' | 'degraded' | 'critical'
  score: number
  maxScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  scoringBreakdown: ScoringDimension[]
  blockingFindings: string[]
  advisoryFindings: string[]
  unknowns: string[]
  nextRequiredEvidence: string[]
  bootstrapSources: string[]
  restoreProof: ReturnType<typeof summarizeRestoreProof>
  securityProof: ReturnType<typeof classifySecurityProof>
  sealVerification: ReturnType<typeof classifySealVerification>
  generatedBy: string
}

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return undefined
  return process.argv[idx + 1]
}

function isValidPeriod(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}

function assertPeriod(value: string): string {
  if (!isValidPeriod(value)) {
    throw new Error(`Invalid period format: ${value}. Expected YYYY-MM.`)
  }
  return value
}

function readJsonSafe<T>(filePath: string): T | null {
  if (!isWithinBase(filePath, ROOT) || !fs.existsSync(filePath)) return null
  try {
    return JSON.parse(readUtf8(filePath)) as T
  } catch {
    return null
  }
}

function readJsonlSafe(filePath: string): Record<string, unknown>[] {
  if (!isWithinBase(filePath, ROOT) || !fs.existsSync(filePath)) return []
  try {
    return readUtf8(filePath)
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
  } catch {
    return []
  }
}

function sourceEntry(
  name: string,
  relPath: string,
  entries: number,
): RuntimeProofV2['sources'][number] {
  const abs = safeResolveUnderRoot(relPath)
  return { name, path: relPath, exists: fs.existsSync(abs), entries }
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

interface RestoreCandidate {
  path: string
  period: string
  timestamp: string
}

function getRestoreTimestamp(value: Record<string, unknown>): string | null {
  const ts = value['timestamp']
  if (typeof ts !== 'string') return null
  const parsed = new Date(ts)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function isSuccessfulRestoreDrill(value: Record<string, unknown>): boolean {
  const status = typeof value['overallStatus'] === 'string' ? value['overallStatus'].toLowerCase() : ''
  return status === 'pass'
}

function resolveRestoreDrillPath(period: string): { selectedPath: string; selectedPeriod: string } {
  const periodPath = safeResolveUnderRoot('reports', 'db', `restore-drill-${period}.json`)
  const reportsDir = safeResolveUnderRoot('reports', 'db')

  if (!fs.existsSync(reportsDir)) {
    return { selectedPath: periodPath, selectedPeriod: period }
  }

  const candidates: RestoreCandidate[] = []
  for (const name of fs.readdirSync(reportsDir)) {
    const match = /^restore-drill-(\d{4}-\d{2})\.json$/.exec(name)
    if (!match) continue

    const candidatePath = safeJoinUnder(reportsDir, name)
    if (!candidatePath) continue
    const raw = readJsonSafe<Record<string, unknown>>(candidatePath)
    if (!raw) continue
    if (!isSuccessfulRestoreDrill(raw)) continue

    const timestamp = getRestoreTimestamp(raw)
    if (!timestamp) continue

    candidates.push({
      path: candidatePath,
      period: match[1],
      timestamp,
    })
  }

  if (candidates.length === 0) {
    return { selectedPath: periodPath, selectedPeriod: period }
  }

  candidates.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return {
    selectedPath: candidates[0].path,
    selectedPeriod: candidates[0].period,
  }
}

function buildMetrics(artifacts: ArtifactSet): RuntimeMetric[] {
  const metrics: RuntimeMetric[] = []
  const { ledgerEntries, ciRuns, azureRuntime, healthReport } = artifacts

  const deployCount = ledgerEntries.length
  const rollbacks = ledgerEntries.filter((entry) => entry['rollbackCandidate']).length
  const hotfixes = ledgerEntries.filter((entry) => entry['hotfix']).length

  metrics.push({
    name: 'deploy_count',
    value: deployCount,
    unit: 'deployments',
    status: deployCount > 0 ? 'healthy' : 'unknown',
  })

  metrics.push({
    name: 'rollback_count',
    value: rollbacks,
    unit: 'rollbacks',
    status: rollbacks === 0 ? 'healthy' : rollbacks <= 1 ? 'degraded' : 'critical',
  })

  metrics.push({
    name: 'hotfix_count',
    value: hotfixes,
    unit: 'hotfixes',
    status: hotfixes <= 1 ? 'healthy' : 'degraded',
  })

  const realCiRuns = ciRuns.filter((run) => !isBootstrapCiRun(run))
  const successCi = realCiRuns.filter((run) => {
    const status = typeof run['status'] === 'string' ? run['status'].toLowerCase() : ''
    const conclusion = typeof run['conclusion'] === 'string' ? run['conclusion'].toLowerCase() : ''
    return status === 'success' || status === 'pass' || conclusion === 'success'
  }).length
  const totalCi = realCiRuns.length
  const ciRate = totalCi > 0 ? Math.round((successCi / totalCi) * 100) : null
  metrics.push({
    name: 'ci_success_rate',
    value: ciRate,
    unit: '%',
    status: ciRate === null ? 'unknown' : ciRate >= 95 ? 'healthy' : ciRate >= 80 ? 'degraded' : 'critical',
  })

  const azureStatus = azureRuntime?.['overallStatus']
  const normalizedAzure =
    azureStatus === 'healthy' || azureStatus === 'degraded' || azureStatus === 'critical'
      ? azureStatus
      : azureStatus === 'pass'
        ? 'healthy'
        : azureStatus === 'fail'
          ? 'critical'
          : 'unknown'
  metrics.push({
    name: 'azure_runtime_status',
    value: typeof azureStatus === 'string' ? azureStatus : null,
    unit: 'status',
    status: normalizedAzure,
  })

  const healthStatus = healthReport?.['overallStatus']
  metrics.push({
    name: 'health_check_status',
    value: typeof healthStatus === 'string' ? healthStatus : null,
    unit: 'status',
    status:
      healthStatus === 'pass' ? 'healthy'
      : healthStatus === 'warn' ? 'degraded'
      : healthStatus === 'fail' ? 'critical'
      : 'unknown',
  })

  return metrics
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function deriveForcedFindings(
  artifacts: ArtifactSet,
  metrics: RuntimeMetric[],
): { blocking: string[]; advisory: string[]; unknowns: string[] } {
  const blocking: string[] = []
  const advisory: string[] = []
  const unknowns: string[] = []

  for (const finding of toStringArray(artifacts.azureRuntime?.['blockingFindings'])) {
    blocking.push(`[deploy] ${finding}`)
  }
  for (const finding of toStringArray(artifacts.azureRuntime?.['advisoryFindings'])) {
    advisory.push(`[deploy] ${finding}`)
  }

  for (const finding of toStringArray(artifacts.healthReport?.['blockingFindings'])) {
    blocking.push(`[health] ${finding}`)
  }
  for (const finding of toStringArray(artifacts.healthReport?.['advisoryFindings'])) {
    advisory.push(`[health] ${finding}`)
  }

  for (const metric of metrics) {
    if (metric.status === 'unknown') {
      unknowns.push(`[metric:${metric.name}] unknown`)
      continue
    }
    if (metric.status === 'critical') {
      if (metric.name === 'ci_success_rate' || metric.name === 'azure_runtime_status' || metric.name === 'health_check_status') {
        blocking.push(`[metric:${metric.name}] critical (${metric.value ?? 'n/a'}${metric.unit ? ` ${metric.unit}` : ''})`)
      } else {
        advisory.push(`[metric:${metric.name}] critical (${metric.value ?? 'n/a'}${metric.unit ? ` ${metric.unit}` : ''})`)
      }
      continue
    }
    if (metric.status === 'degraded') {
      advisory.push(`[metric:${metric.name}] degraded (${metric.value ?? 'n/a'}${metric.unit ? ` ${metric.unit}` : ''})`)
    }
  }

  return {
    blocking: [...new Set(blocking)],
    advisory: [...new Set(advisory)],
    unknowns: [...new Set(unknowns)],
  }
}

function nextRequiredEvidence(
  breakdown: RuntimeProofV2['scoringBreakdown'],
  period: string,
): string[] {
  const next: string[] = []
  for (const dimension of breakdown) {
    if (dimension.earned >= dimension.weight) {
      continue
    }

    switch (dimension.dimension) {
      case 'release':
        next.push(`Release ledger: add valid non-bootstrap entry for ${period} (reports/releases/release-ledger.jsonl)`)
        next.push(`Release manifest: add ops/releases/release-v<version>.json for ${period}`)
        break
      case 'deploy':
        next.push('CI: record a successful non-bootstrap run in reports/runtime/ci-runs.jsonl')
        next.push('Azure: update reports/runtime/azure-runtime-latest.json with overallStatus="healthy"')
        break
      case 'health':
        next.push('Health: run check-health.ts and resolve any failing checks')
        break
      case 'drift':
        next.push(`Drift: produce ops/drift/drift-${period}.json with no blocking-drift items`)
        break
      case 'restore':
        next.push(`Restore: run and pass restore drill reports/db/restore-drill-${period}.json`)
        break
      case 'security':
        next.push('Security: run collect-security-proof.ts and resolve critical findings')
        break
      case 'seal':
        next.push(`Seal: produce proof-artifacts/evidence-packs/${period}/snapshot.json with sha256 values`)
        break
    }
  }
  return [...new Set(next)]
}

export function generateRuntimeProof(periodInput?: string): RuntimeProofV2 {
  const rawPeriod = periodInput ?? parseArg('--period') ?? parseArg('--month') ?? getCurrentMonth()
  const period = assertPeriod(rawPeriod)

  const ledgerPath = safeResolveUnderRoot('reports', 'releases', 'release-ledger.jsonl')
  const ciRunsPath = safeResolveUnderRoot('reports', 'runtime', 'ci-runs.jsonl')
  const azurePath = safeResolveUnderRoot('reports', 'runtime', 'azure-runtime-latest.json')
  const healthPath = safeResolveUnderRoot('reports', 'runtime', 'health-latest.json')
  const securityPath = safeResolveUnderRoot('reports', 'runtime', 'security-proof-latest.json')
  const driftPath = safeResolveUnderRoot('ops', 'drift', `drift-${period}.json`)
  const restoreSelection = resolveRestoreDrillPath(period)
  const restorePath = restoreSelection.selectedPath
  const snapshotPath = safeResolveUnderRoot('proof-artifacts', 'evidence-packs', period, 'snapshot.json')
  const manifestDir = safeResolveUnderRoot('proof-artifacts', 'evidence-packs', period)

  const allLedger = readJsonlSafe(ledgerPath)
  const periodLedger = allLedger.filter((entry) => {
    const ts = entry['timestamp'] ?? entry['date']
    return typeof ts === 'string' ? ts.startsWith(period) : true
  })

  const ciRuns = readJsonlSafe(ciRunsPath).filter((entry) => {
    const ts = entry['timestamp'] ?? entry['completedAt']
    return typeof ts === 'string' ? ts.startsWith(period) : true
  })

  const artifacts: ArtifactSet = {
    ledgerEntries: periodLedger,
    ciRuns,
    azureRuntime: readJsonSafe<Record<string, unknown>>(azurePath),
    healthReport: readJsonSafe<Record<string, unknown>>(healthPath),
    securityProof: readJsonSafe<Record<string, unknown>>(securityPath),
    driftReport: readJsonSafe<Record<string, unknown>>(driftPath),
    restoreDrill: readJsonSafe<Record<string, unknown>>(restorePath),
    snapshot: readJsonSafe<Record<string, unknown>>(snapshotPath),
    manifests:
      fs.existsSync(manifestDir)
        ? fs
            .readdirSync(manifestDir)
            .filter((name) => name.endsWith('.json') && name !== 'snapshot.json').length
        : 0,
  }

  const breakdown = calculateScoringBreakdown(artifacts)
  const metrics = buildMetrics(artifacts)
  const forcedFindings = deriveForcedFindings(artifacts, metrics)
  const scoreDetails = calculateScoreDetails(breakdown, {
    forcedBlockingFindings: forcedFindings.blocking,
    forcedAdvisoryFindings: forcedFindings.advisory,
    forcedUnknowns: forcedFindings.unknowns,
  })

  const runtimeTruth = computeRuntimeScore(artifacts.healthReport)
  const healthOverallStatus =
    typeof artifacts.healthReport?.['overallStatus'] === 'string'
      ? artifacts.healthReport['overallStatus']
      : 'unknown'

  if (runtimeTruth.score === 100 && healthOverallStatus !== 'pass') {
    throw new Error(
      `Runtime score invalid: score=100 but health overallStatus=${healthOverallStatus}`,
    )
  }

  const restoreProof = summarizeRestoreProof(artifacts.restoreDrill)
  const securityProof = classifySecurityProof(artifacts.securityProof)
  const sealVerification = classifySealVerification(artifacts.snapshot)

  const overallHealth: RuntimeProofV2['overallHealth'] =
    runtimeTruth.status === 'unhealthy' ? 'critical'
    : runtimeTruth.status === 'degraded' ? 'degraded'
    : scoreDetails.blockingFindings.length > 0 ? 'critical'
    : scoreDetails.advisoryFindings.length > 0 || scoreDetails.unknowns.length > 0 ? 'degraded'
    : 'healthy'

  const derivedScore = runtimeTruth.score
  const derivedGrade = scoreToGrade(derivedScore, scoreDetails.bootstrapSources.length > 0)

  const proof: RuntimeProofV2 = {
    schemaVersion: 2,
    proofId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    period,
    periodType: 'monthly',
    metrics,
    sources: [
      sourceEntry('release-ledger', path.relative(ROOT, ledgerPath), periodLedger.length),
      sourceEntry('ci-runs', path.relative(ROOT, ciRunsPath), ciRuns.length),
      sourceEntry('azure-runtime', path.relative(ROOT, azurePath), artifacts.azureRuntime ? 1 : 0),
      sourceEntry('health', path.relative(ROOT, healthPath), artifacts.healthReport ? 1 : 0),
      sourceEntry('security', path.relative(ROOT, securityPath), artifacts.securityProof ? 1 : 0),
      sourceEntry('drift', path.relative(ROOT, driftPath), artifacts.driftReport ? 1 : 0),
      sourceEntry(
        'restore-drill',
        path.relative(ROOT, restorePath),
        artifacts.restoreDrill ? 1 : 0,
      ),
      sourceEntry('snapshot', path.relative(ROOT, snapshotPath), artifacts.snapshot ? 1 : 0),
    ],
    overallHealth,
    score: derivedScore,
    maxScore: scoreDetails.maxScore,
    grade: derivedGrade,
    scoringBreakdown: scoreDetails.breakdown,
    blockingFindings: scoreDetails.blockingFindings,
    advisoryFindings: scoreDetails.advisoryFindings,
    unknowns: scoreDetails.unknowns,
    nextRequiredEvidence: nextRequiredEvidence(scoreDetails.breakdown, period),
    bootstrapSources: scoreDetails.bootstrapSources,
    restoreProof,
    securityProof,
    sealVerification,
    generatedBy: 'scripts/proof/generate-runtime-proof.ts@v3',
  }

  const monthlyDir = safeResolveUnderRoot('reports', 'runtime', 'monthly')
  fs.mkdirSync(monthlyDir, { recursive: true })
  const monthlyFile = safeResolveUnderRoot('reports', 'runtime', 'monthly', `runtime-${period}.json`)
  fs.writeFileSync(monthlyFile, JSON.stringify(proof, null, 2))

  const latestFile = safeResolveUnderRoot('reports', 'runtime', 'runtime-latest.json')
  fs.writeFileSync(latestFile, JSON.stringify(proof, null, 2))

  return proof
}

export function main(): void {
  const proof = generateRuntimeProof()

  console.log(`✓ Runtime proof generated for ${proof.period}`)
  console.log(`  Score: ${proof.score}/${proof.maxScore} → Grade ${proof.grade}`)

  if (proof.bootstrapSources.length > 0) {
    console.log(`  ⚠ Bootstrap cap active (sources: ${proof.bootstrapSources.join(', ')})`)
  }

  if (proof.blockingFindings.length > 0) {
    console.log(`  ✗ Blocking findings (${proof.blockingFindings.length}):`)
    for (const finding of proof.blockingFindings) {
      console.log(`    ${finding}`)
    }
  }

  console.log(`  → reports/runtime/monthly/runtime-${proof.period}.json`)
  console.log('  → reports/runtime/runtime-latest.json')
}

const isDirectRun = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main()
}
