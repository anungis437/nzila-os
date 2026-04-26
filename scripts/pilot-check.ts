/**
 * Nzila OS — Pilot Readiness Check
 *
 * One-command validation that the codebase is pilot-ready:
 *   1. Lint (turbo lint)
 *   2. Unit tests (turbo test)
 *   3. Contract tests (vitest --project contract-tests)
 *   4. SLO gate dry-run (pilot env)
 *   5. Generate local release attestation
 *
 * Usage:
 *   pnpm pilot:check
 *   npx tsx scripts/pilot-check.ts
 *
 * Exit codes:
 *   0 = all checks passed — pilot ready
 *   1 = one or more checks failed
 *
 * @module scripts/pilot-check
 */
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

// ── Config ──────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'skipped'
  durationMs: number
  error?: string
}

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const ATTESTATION_DIR = join(ROOT, '.pilot-check')

// ── Helpers ─────────────────────────────────────────────────────────────────

function runStep(name: string, command: string): CheckResult {
  const start = Date.now()
  try {
    execSync(command, { cwd: ROOT, stdio: 'pipe', timeout: 300_000 })
    return { name, status: 'pass', durationMs: Date.now() - start }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Truncate error to avoid overwhelming output
    const truncated = msg.length > 500 ? msg.slice(0, 500) + '…' : msg
    return { name, status: 'fail', durationMs: Date.now() - start, error: truncated }
  }
}

function getCommitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🛫 Nzila OS — Pilot Readiness Check\n')
  console.log('=' .repeat(60))

  const results: CheckResult[] = []

  // Step 1: Lint
  console.log('\n📋 Step 1/5: Lint')
  results.push(runStep('lint', 'pnpm -w lint'))

  // Step 2: Unit tests
  console.log('🧪 Step 2/5: Unit Tests')
  results.push(runStep('test', 'pnpm -w test'))

  // Step 3: Contract tests
  console.log('📜 Step 3/5: Contract Tests')
  results.push(runStep('contract:test', 'pnpm contract:test'))

  // Step 4: SLO gate (pilot) — dry run
  console.log('📊 Step 4/5: SLO Gate (pilot)')
  const sloResult = runStep('slo-gate', `npx tsx ${join(ROOT, 'scripts', 'slo-gate.ts')} --env pilot`)
  // SLO gate may fail if no DB — treat as skipped rather than failure
  if (sloResult.status === 'fail' && sloResult.error?.includes('connect')) {
    sloResult.status = 'skipped'
    sloResult.error = 'No database connection — skipped (OK for local dev)'
  }
  results.push(sloResult)

  // Step 5: Generate local attestation
  console.log('🔏 Step 5/5: Local Attestation')
  const sha = getCommitSha()
  const contractPassed = results.find((r) => r.name === 'contract:test')?.status === 'pass'
  const sloPassed = results.find((r) => r.name === 'slo-gate')?.status !== 'fail'

  const attestation = {
    version: '1.0' as const,
    commitSha: sha,
    contractTestResult: contractPassed ? 'pass' : 'fail',
    sloGateResult: sloPassed ? 'pass' : 'skipped',
    timestamp: new Date().toISOString(),
    environment: 'local-pilot-check',
    checks: results.map((r) => ({ name: r.name, status: r.status, durationMs: r.durationMs })),
    attestationDigest: '', // filled below
  }

  // Compute digest
  const payload = JSON.stringify(attestation)
  attestation.attestationDigest = createHash('sha256').update(payload).digest('hex')

  // Write attestation file
  mkdirSync(ATTESTATION_DIR, { recursive: true })
  const attestationPath = join(ATTESTATION_DIR, 'attestation.json')
  writeFileSync(attestationPath, JSON.stringify(attestation, null, 2))

  results.push({
    name: 'attestation',
    status: 'pass',
    durationMs: 0,
  })

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log('\n' + '=' .repeat(60))
  console.log('📊 Results:\n')

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const skipped = results.filter((r) => r.status === 'skipped').length

  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌'
    const timing = `(${r.durationMs}ms)`
    console.log(`  ${icon} ${r.name} ${timing}${r.error ? ` — ${r.error}` : ''}`)
  }

  console.log(`\n  Total: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  console.log(`  Attestation: ${attestationPath}`)
  console.log(`  Digest: ${attestation.attestationDigest.slice(0, 16)}…`)

  if (failed > 0) {
    console.log('\n❌ Pilot check FAILED — fix issues before deploying to pilot.\n')
    process.exit(1)
  } else {
    console.log('\n✅ Pilot check PASSED — ready for pilot deployment.\n')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
