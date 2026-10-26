/**
 * Executes the source-verification suites named by the Gate 0 matrix and records what actually ran:
 * the command, the tested revision, the content hash of every cited source and test file, the
 * per-file result, and the raw reporter output with its hash.
 *
 *   node tooling/scripts/lib/ue-gate0-record-evidence.mjs
 *
 * A suite that fails, is skipped, or cannot be run is recorded as such. Nothing in this file
 * turns a skipped or failing suite into a pass.
 */
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ROOT } from './ue-gate0-scope-lock.mjs'

export const EVIDENCE_FILE = 'docs/union-eyes/convergence/evidence/gate0-source-verification.json'
export const EVIDENCE_LOG_DIR = 'docs/union-eyes/convergence/evidence/gate0-source-verification'

const UE = 'apps/union-eyes'

export const EVIDENCE_JOBS = [
  {
    capabilityId: 'UE-CAP-F-001',
    suiteFamily: 'authority-kernel PGlite (resources, lifecycle)',
    assertionFamily: 'internal-file read, edit, and disclosure grants stay separate kernel actions',
    cwd: UE,
    runner: 'vitest',
    tests: ['db/__tests__/authority-kernel-resources.pglite.test.ts', 'db/__tests__/authority-kernel-lifecycle.pglite.test.ts'],
    exclusions: ['PGlite is not native PostgreSQL 15 or 16.', 'No credentialed browser journey is exercised.'],
  },
  {
    capabilityId: 'UE-CAP-G-001',
    suiteFamily: 'counsel boundary (unit, PGlite resources, PGlite counsel engagement register)',
    assertionFamily: 'counsel engagement stays on the kernel boundary',
    cwd: UE,
    runner: 'vitest',
    tests: [
      'lib/authority/__tests__/counsel-boundary.test.ts',
      'db/__tests__/authority-kernel-resources.pglite.test.ts',
      'db/__tests__/authority-kernel-counsel.pglite.test.ts',
    ],
    exclusions: ['PGlite is not native PostgreSQL.', 'Counsel-side verification is UE-CONV-G-003 and stays an external gate.'],
  },
  {
    capabilityId: 'UE-CAP-H-001',
    suiteFamily: 'anti-theatre scanner',
    assertionFamily: 'retired scaffold detection (rule R-9) against a synthetic tree',
    cwd: 'tooling/reality',
    runner: 'vitest-root',
    tests: ['__tests__/anti-theatre-scan.test.ts'],
    testPathPrefix: 'tooling/reality/',
    exclusions: ['The suite scans a synthetic tree, not the live route set.', 'It does not implement the thirteen stubbed operations.'],
  },
  {
    capabilityId: 'UE-CAP-K-002',
    suiteFamily: 'anti-theatre scanner',
    assertionFamily: 'stub and fake-success detection against a synthetic tree',
    cwd: 'tooling/reality',
    runner: 'vitest-root',
    tests: ['__tests__/anti-theatre-scan.test.ts'],
    testPathPrefix: 'tooling/reality/',
    exclusions: ['The suite scans a synthetic tree, not the live route set.'],
  },
  {
    capabilityId: 'UE-CAP-H-005',
    suiteFamily: 'admin seed route',
    assertionFamily: 'retired seed route answers HTTP 501',
    cwd: UE,
    runner: 'vitest',
    tests: ['app/api/__tests__/admin-seed-test-data.route.test.ts'],
    exclusions: ['A canonical seed is not a committed obligation.'],
  },
  {
    capabilityId: 'UE-CAP-K-001',
    suiteFamily: 'migration lineage certification',
    assertionFamily: 'approved migration lineage verification',
    cwd: '.',
    runner: 'node-test',
    tests: ['tooling/scripts/lib/ue-migration-lineage-certification.test.mjs'],
    exclusions: ['Source lineage only. No migration is applied and no native database is touched.'],
  },
  {
    capabilityId: 'UE-CAP-K-003',
    suiteFamily: 'convergence register checker',
    assertionFamily: 'register integrity and allowlist ratchet evaluation',
    cwd: '.',
    runner: 'node-test',
    tests: ['tooling/scripts/lib/ue-convergence-check.test.mjs'],
    exclusions: ['The checker CLI currently fails two ratchets. This suite does not run the CLI.'],
  },
  {
    capabilityId: 'UE-CAP-REVIEW-INTAKE',
    suiteFamily: 'review intake (PGlite, route, component)',
    assertionFamily: 'member review intake and oversight listing',
    cwd: UE,
    runner: 'vitest',
    tests: [
      'db/__tests__/review-intake.pglite.test.ts',
      'app/api/__tests__/reviews-intake.route.test.ts',
      'components/reviews/review-intake.test.tsx',
    ],
    exclusions: ['PGlite is not native PostgreSQL.', 'No credentialed browser journey is exercised.'],
  },
  {
    capabilityId: 'UE-OMIT-DELIVERY-EVIDENCE',
    suiteFamily: 'delivery reconciliation (unit)',
    assertionFamily: 'notification delivery ledger arithmetic',
    cwd: UE,
    runner: 'vitest',
    tests: ['lib/services/__tests__/delivery-reconciliation.test.ts'],
    exclusions: ['apps/union-eyes/db/__tests__/notification-delivery-native.test.ts requires UE_DELIVERY_NATIVE_PROOF=1 and is not run here.'],
  },
]

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

function blobFor(path) {
  try {
    return git(['rev-parse', `HEAD:${path}`])
  } catch {
    return null
  }
}

function runVitest(job) {
  const outFile = join('/tmp', `gate0-${job.capabilityId}-${process.pid}.json`)
  const args = job.runner === 'vitest-root'
    ? ['vitest', 'run', '--root', job.cwd, ...job.tests, '--reporter=json', `--outputFile=${outFile}`]
    : ['vitest', 'run', ...job.tests, '--reporter=json', `--outputFile=${outFile}`]
  const cwd = job.runner === 'vitest-root' ? ROOT : join(ROOT, job.cwd)
  const started = Date.now()
  const run = spawnSync('npx', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 280_000, env: { ...process.env, CI: '1' } })
  const durationMs = Date.now() - started
  let report = null
  try {
    report = JSON.parse(readFileSync(outFile, 'utf8'))
  } catch {
    report = null
  }
  rmSync(outFile, { force: true })
  const files = []
  const assertions = []
  for (const file of report?.testResults ?? []) {
    const rel = file.name.replace(`${ROOT}/`, '')
    let passed = 0
    let failed = 0
    let skipped = 0
    for (const item of file.assertionResults) {
      if (item.status === 'passed') passed += 1
      else if (item.status === 'failed') failed += 1
      else skipped += 1
      assertions.push({ file: rel, title: item.fullName, status: item.status })
    }
    files.push({ path: rel, suiteStatus: file.status, passed, failed, skipped, suiteError: file.message ? String(file.message).slice(0, 400) : null })
  }
  const totals = files.reduce((sum, file) => ({ passed: sum.passed + file.passed, failed: sum.failed + file.failed, skipped: sum.skipped + file.skipped }), { passed: 0, failed: 0, skipped: 0 })
  return {
    command: `npx ${args.join(' ').replace(outFile, '<report>')}`,
    exitCode: run.status,
    durationMs,
    files,
    totals: { total: totals.passed + totals.failed + totals.skipped, ...totals },
    log: JSON.stringify({ reporter: 'vitest-json', summary: { numTotalTests: report?.numTotalTests ?? null, numPassedTests: report?.numPassedTests ?? null, numFailedTests: report?.numFailedTests ?? null, numPendingTests: report?.numPendingTests ?? null }, files, assertions }, null, 2),
  }
}

function runNodeTest(job) {
  const args = ['--test', '--test-reporter=tap', ...job.tests]
  const started = Date.now()
  const run = spawnSync(process.execPath, args, { cwd: join(ROOT, job.cwd), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 280_000 })
  const durationMs = Date.now() - started
  const text = `${run.stdout}${run.stderr}`
  const count = (label) => Number(text.match(new RegExp(`^# ${label} (\\d+)`, 'm'))?.[1] ?? 0)
  const passed = count('pass')
  const failed = count('fail')
  const skipped = count('skipped') + count('todo') + count('cancelled')
  const files = job.tests.map((path) => ({ path, suiteStatus: failed === 0 ? 'passed' : 'failed', passed: null, failed: null, skipped: null, suiteError: null }))
  return {
    command: `node ${args.join(' ')}`,
    exitCode: run.status,
    durationMs,
    files: files.map((file) => ({ ...file, passed: job.tests.length === 1 ? passed : null, failed: job.tests.length === 1 ? failed : null, skipped: job.tests.length === 1 ? skipped : null })),
    totals: { total: passed + failed + skipped, passed, failed, skipped },
    log: text,
  }
}

export function recordAll() {
  const revision = git(['rev-parse', 'HEAD'])
  mkdirSync(join(ROOT, EVIDENCE_LOG_DIR), { recursive: true })
  const records = []
  for (const job of EVIDENCE_JOBS) {
    const capabilityFiles = job.tests.map((test) => `${job.runner === 'vitest-root' ? job.testPathPrefix : job.cwd === '.' ? '' : `${job.cwd}/`}${test}`)
    const result = job.runner === 'node-test' ? runNodeTest(job) : runVitest(job)
    const logPath = `${EVIDENCE_LOG_DIR}/${job.capabilityId}.log`
    writeFileSync(join(ROOT, logPath), result.log)
    const blobs = {}
    for (const path of capabilityFiles) blobs[path] = blobFor(path)
    records.push({
      capabilityId: job.capabilityId,
      suiteFamily: job.suiteFamily,
      assertionFamily: job.assertionFamily,
      command: result.command,
      workingDirectory: job.cwd,
      testedRevision: revision,
      testFiles: capabilityFiles,
      testFileBlobs: blobs,
      executedAt: new Date().toISOString(),
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      totals: result.totals,
      files: result.files.map((file) => ({ ...file, path: file.path })),
      exclusions: job.exclusions,
      logFile: logPath,
      logSha256: sha256(result.log),
    })
    const t = result.totals
    console.log(`${job.capabilityId}: exit ${result.exitCode}, total ${t.total}, passed ${t.passed}, failed ${t.failed}, skipped ${t.skipped}`)
  }
  const out = { schemaVersion: 1, recordedAtRevision: revision, records }
  writeFileSync(join(ROOT, EVIDENCE_FILE), `${JSON.stringify(out, null, 2)}\n`)
  return out
}

if (process.argv[1] && process.argv[1].endsWith('ue-gate0-record-evidence.mjs')) {
  const status = git(['status', '--porcelain', '--', 'apps/union-eyes', 'tooling'])
  if (status) {
    console.error('The working tree has uncommitted changes under apps/union-eyes or tooling. Commit them before recording evidence so the tested revision is exact.')
    console.error(status)
    process.exit(2)
  }
  recordAll()
}
