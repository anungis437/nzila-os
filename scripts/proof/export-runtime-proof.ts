#!/usr/bin/env npx tsx

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { redactSensitiveData } from './runtime-proof-core'

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

interface ProofDocument {
  schemaVersion: number
  proofId: string
  timestamp: string
  period: string
  score: number
  maxScore?: number
  grade: string
  overallHealth: string
  bootstrapSources: string[]
  blockingFindings: string[]
  advisoryFindings: string[]
  nextRequiredEvidence: string[]
  scoringBreakdown: {
    dimension: string
    weight: number
    earned: number
    rationale: string
    bootstrapEvidence: boolean
  }[]
  metrics: {
    name: string
    value: number | string | boolean | null
    unit: string
    status: string
  }[]
  restoreProof?: unknown
  securityProof?: unknown
  sealVerification?: unknown
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

function readJsonSafe<T>(targetPath: string): T | null {
  if (!isWithinBase(targetPath, ROOT)) return null
  if (!fs.existsSync(targetPath)) return null
  try {
    return JSON.parse(readUtf8(targetPath)) as T
  } catch {
    return null
  }
}

function readJsonlSafe(targetPath: string): Record<string, unknown>[] {
  if (!isWithinBase(targetPath, ROOT)) return []
  if (!fs.existsSync(targetPath)) return []
  try {
    return readUtf8(targetPath)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
  } catch {
    return []
  }
}

function renderGradeEmoji(grade: string): string {
  return grade === 'A' ? 'A'
    : grade === 'B' ? 'B'
    : grade === 'C' ? 'C'
    : grade === 'D' ? 'D'
    : 'F'
}

function renderHealthEmoji(status: string): string {
  return status === 'healthy' ? 'Healthy'
    : status === 'degraded' ? 'Degraded'
    : 'Critical'
}

function buildSummary(proof: ProofDocument): string {
  const lines: string[] = []
  const generated = new Date(proof.timestamp).toUTCString()

  lines.push('# Nzila OS - Runtime Proof Summary')
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| Period | ${proof.period} |`)
  lines.push(`| Generated | ${generated} |`)
  lines.push(`| Proof ID | ${proof.proofId} |`)
  lines.push(`| Schema | v${proof.schemaVersion} |`)
  lines.push(`| Overall Health | ${renderHealthEmoji(proof.overallHealth)} |`)
  lines.push(`| Score | ${proof.score} / ${proof.maxScore ?? 100} |`)
  lines.push(`| Grade | ${renderGradeEmoji(proof.grade)} |`)
  lines.push('')

  if (proof.bootstrapSources.length > 0) {
    lines.push(`Bootstrap cap active due to: ${proof.bootstrapSources.join(', ')}`)
    lines.push('')
  }

  lines.push('## Scoring Breakdown')
  lines.push('')
  lines.push('| Dimension | Weight | Earned | Bootstrap | Notes |')
  lines.push('|-----------|-------:|-------:|:---------:|-------|')
  for (const dimension of proof.scoringBreakdown) {
    lines.push(
      `| ${dimension.dimension} | ${dimension.weight} | ${dimension.earned} | ${dimension.bootstrapEvidence ? 'yes' : 'no'} | ${dimension.rationale} |`,
    )
  }
  lines.push('')

  if (proof.blockingFindings.length > 0) {
    lines.push('## Blocking Findings')
    lines.push('')
    for (const finding of proof.blockingFindings) {
      lines.push(`- ${finding}`)
    }
    lines.push('')
  }

  if (proof.advisoryFindings.length > 0) {
    lines.push('## Advisory Findings')
    lines.push('')
    for (const finding of proof.advisoryFindings) {
      lines.push(`- ${finding}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function writeJson(targetPath: string, value: unknown): void {
  fs.writeFileSync(targetPath, JSON.stringify(redactSensitiveData(value), null, 2))
}

function collectReleaseManifestSummary(period: string): Record<string, unknown> {
  const ledgerPath = safeResolveUnderRoot('reports', 'releases', 'release-ledger.jsonl')
  const entries = readJsonlSafe(ledgerPath).filter((entry) => {
    const ts = entry['timestamp'] ?? entry['date']
    return typeof ts === 'string' && ts.startsWith(period)
  })

  const versionSet = new Set<string>()
  for (const entry of entries) {
    if (typeof entry['version'] === 'string' && entry['version'].length > 0) {
      versionSet.add(entry['version'])
    }
  }

  const manifests: Record<string, unknown>[] = []
  for (const version of versionSet) {
    const manifestPath = safeResolveUnderRoot('ops', 'releases', `release-v${version}.json`)
    const manifest = readJsonSafe<Record<string, unknown>>(manifestPath)
    if (manifest) {
      manifests.push({ version, path: path.relative(ROOT, manifestPath), manifest })
    }
  }

  return {
    period,
    ledgerEntries: entries.length,
    manifestsFound: manifests.length,
    manifests,
  }
}

export function runRuntimeProofExport(period?: string): { exportDir: string; proofPeriod: string } {
  const requestedPeriodRaw = period ?? parseArg('--period')
  const requestedPeriod = requestedPeriodRaw ? assertPeriod(requestedPeriodRaw) : undefined

  const sourcePath = requestedPeriod
    ? safeResolveUnderRoot('reports', 'runtime', 'monthly', `runtime-${requestedPeriod}.json`)
    : safeResolveUnderRoot('reports', 'runtime', 'runtime-latest.json')

  if (!fs.existsSync(sourcePath)) {
    console.error(`✗ Source proof not found: ${sourcePath}`)
    console.error('  Run "pnpm exec tsx scripts/proof/run-proof.tstime" first, or specify --period YYYY-MM')
    process.exit(1)
  }

  const proof = readJsonSafe<ProofDocument>(sourcePath)
  if (!proof) {
    console.error(`✗ Failed to parse ${sourcePath}`)
    process.exit(1)
  }
  const safeProofPeriod = assertPeriod(proof.period)

  const exportDir = safeResolveUnderRoot('reports', 'runtime', 'export')
  fs.mkdirSync(exportDir, { recursive: true })

  const summaryPath = safeResolveUnderRoot('reports', 'runtime', 'export', 'summary.md')
  fs.writeFileSync(summaryPath, buildSummary(proof))

  writeJson(safeResolveUnderRoot('reports', 'runtime', 'export', 'runtime-latest.json'), proof)

  const ledgerPath = safeResolveUnderRoot('reports', 'releases', 'release-ledger.jsonl')
  const releaseLedgerExcerpt = readJsonlSafe(ledgerPath).filter((entry) => {
    const ts = entry['timestamp'] ?? entry['date']
    return typeof ts === 'string' && ts.startsWith(safeProofPeriod)
  })
  writeJson(safeResolveUnderRoot('reports', 'runtime', 'export', 'release-ledger-excerpt.json'), {
    period: safeProofPeriod,
    entries: releaseLedgerExcerpt,
  })

  const releaseManifestSummary = collectReleaseManifestSummary(safeProofPeriod)
  writeJson(safeResolveUnderRoot('reports', 'runtime', 'export', 'release-manifest-summary.json'), releaseManifestSummary)

  const driftSummary = readJsonSafe<Record<string, unknown>>(
    safeResolveUnderRoot('ops', 'drift', `drift-${safeProofPeriod}.json`),
  ) ?? { period: safeProofPeriod, available: false }
  writeJson(safeResolveUnderRoot('reports', 'runtime', 'export', 'drift-summary.json'), driftSummary)

  const restoreSummary = readJsonSafe<Record<string, unknown>>(
    safeResolveUnderRoot('reports', 'db', `restore-drill-${safeProofPeriod}.json`),
  ) ?? { period: safeProofPeriod, available: false }
  writeJson(safeResolveUnderRoot('reports', 'runtime', 'export', 'restore-drill-summary.json'), restoreSummary)

  const securitySummary = readJsonSafe<Record<string, unknown>>(
    safeResolveUnderRoot('reports', 'runtime', 'security-proof-latest.json'),
  ) ?? proof.securityProof ?? { period: safeProofPeriod, available: false }
  writeJson(safeResolveUnderRoot('reports', 'runtime', 'export', 'security-proof-summary.json'), securitySummary)

  const sealSummary =
    proof.sealVerification
    ?? readJsonSafe<Record<string, unknown>>(safeResolveUnderRoot('proof-artifacts', 'evidence-packs', safeProofPeriod, 'snapshot.json'))
    ?? { period: safeProofPeriod, available: false }
  writeJson(safeResolveUnderRoot('reports', 'runtime', 'export', 'seal-verification-summary.json'), sealSummary)

  console.log(`✓ Runtime proof exported for ${proof.period}`)
  console.log(`  → ${path.join(exportDir, 'summary.md')}`)
  console.log(`  → ${path.join(exportDir, 'runtime-latest.json')}`)
  console.log(`  → ${path.join(exportDir, 'release-ledger-excerpt.json')}`)
  console.log(`  → ${path.join(exportDir, 'release-manifest-summary.json')}`)
  console.log(`  → ${path.join(exportDir, 'drift-summary.json')}`)
  console.log(`  → ${path.join(exportDir, 'restore-drill-summary.json')}`)
  console.log(`  → ${path.join(exportDir, 'security-proof-summary.json')}`)
  console.log(`  → ${path.join(exportDir, 'seal-verification-summary.json')}`)

  return { exportDir, proofPeriod: proof.period }
}

export function main(): void {
  runRuntimeProofExport()
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
