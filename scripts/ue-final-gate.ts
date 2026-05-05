#!/usr/bin/env npx tsx

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeRuntimeScore } from '@nzila/platform-ops/runtime/computeRuntimeScore'
import { GET as getUnionEyesHealth } from '../apps/union-eyes/app/api/health/route'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(path.join(__dirname, '..'))

function resolveUnderRoot(...segments: string[]): string {
  const candidate = path.resolve(ROOT, ...segments)
  const relative = path.relative(ROOT, candidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`Unsafe path outside repository root: ${segments.join('/')}`)
  }
  return candidate
}

function fail(message: string): never {
  console.error(`✗ UE final gate failed: ${message}`)
  process.exit(1)
}

function ensureFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    fail(`Required file is missing: ${path.relative(ROOT, filePath)}`)
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function verifyHealthContractIsReal(): Promise<void> {
  process.env.NODE_ENV = 'test'
  const response = await getUnionEyesHealth(new Request('http://localhost/api/health?forceFail=1'))
  if (response.status !== 503) {
    fail(`Union Eyes /api/health forceFail contract failed: expected 503, got ${response.status}`)
  }
}

function verifyRuntimeTruth(): void {
  const healthPath = resolveUnderRoot('reports', 'runtime', 'health-latest.json')
  const runtimePath = resolveUnderRoot('reports', 'runtime', 'runtime-latest.json')

  ensureFileExists(healthPath)
  ensureFileExists(runtimePath)

  let health: Record<string, unknown>
  let runtime: { score?: unknown }

  try {
    health = JSON.parse(fs.readFileSync(healthPath, 'utf8')) as Record<string, unknown>
  } catch {
    fail(`Invalid JSON: ${path.relative(ROOT, healthPath)}`)
  }

  try {
    runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8')) as { score?: unknown }
  } catch {
    fail(`Invalid JSON: ${path.relative(ROOT, runtimePath)}`)
  }
  const derived = computeRuntimeScore(health)

  if (typeof runtime.score !== 'number') {
    fail('runtime-latest.json is missing numeric score')
  }

  if (runtime.score !== derived.score) {
    fail(`Runtime score mismatch: runtime=${runtime.score}, derived-from-health=${derived.score}`)
  }

  const overallStatus = typeof health.overallStatus === 'string' ? health.overallStatus : 'unknown'
  if (runtime.score === 100 && overallStatus !== 'pass') {
    fail(`Runtime contradiction: score=100 but health overallStatus=${overallStatus}`)
  }
}

async function verifyOrchestratorEndpoints(): Promise<void> {
  const healthUrl = process.env.ORCHESTRATOR_HEALTH_URL ?? 'http://localhost:4000/health'
  const readyUrl = process.env.ORCHESTRATOR_READY_URL ?? 'http://localhost:4000/ready'

  const healthStart = Date.now()
  let healthResponse: Response
  try {
    healthResponse = await fetchWithTimeout(healthUrl, 5000)
  } catch {
    fail(`Orchestrator /health timeout or unreachable: ${healthUrl}`)
  }
  const healthLatencyMs = Date.now() - healthStart

  if (healthResponse.status !== 200) {
    fail(`Orchestrator /health must return 200, got ${healthResponse.status}`)
  }
  if (healthLatencyMs > 500) {
    fail(`Orchestrator /health exceeded 500ms target: ${healthLatencyMs}ms`)
  }

  let readyResponse: Response
  try {
    readyResponse = await fetchWithTimeout(readyUrl, 5000)
  } catch {
    fail(`Orchestrator /ready timeout or unreachable: ${readyUrl}`)
  }

  if (readyResponse.status !== 200 && readyResponse.status !== 503) {
    fail(`Orchestrator /ready must return 200 or 503, got ${readyResponse.status}`)
  }
}

function verifyApprovalEvidence(): void {
  const approvalPath = resolveUnderRoot('artifacts', 'ue-qa', 'human-approval.json')
  const indexPath = resolveUnderRoot('reports', 'release-evidence-index.json')

  ensureFileExists(approvalPath)
  ensureFileExists(indexPath)

  let approval: { decision?: unknown }
  let index: { entries?: Array<{ path?: string }> }

  try {
    approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8')) as { decision?: unknown }
  } catch {
    fail(`Invalid JSON: ${path.relative(ROOT, approvalPath)}`)
  }

  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as { entries?: Array<{ path?: string }> }
  } catch {
    fail(`Invalid JSON: ${path.relative(ROOT, indexPath)}`)
  }

  if (approval.decision !== 'APPROVED_FOR_PRODUCTION') {
    fail('human-approval.json must contain decision=APPROVED_FOR_PRODUCTION')
  }

  const referencesApproval = Array.isArray(index.entries)
    ? index.entries.some((entry) => entry.path === 'artifacts/ue-qa/human-approval.json')
    : false

  if (!referencesApproval) {
    fail('reports/release-evidence-index.json does not reference artifacts/ue-qa/human-approval.json')
  }
}

async function main(): Promise<void> {
  await verifyHealthContractIsReal()
  verifyRuntimeTruth()
  await verifyOrchestratorEndpoints()
  verifyApprovalEvidence()

  console.log('✓ UE final gate passed')
  console.log('  - Real health contract semantics verified')
  console.log('  - Runtime truth derived from health artifact')
  console.log('  - Orchestrator /health and /ready responded within contract')
  console.log('  - Human approval artifact and release linkage present')
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Unexpected UE final gate error')
})
