/**
 * Acceptance contract for the Union Eyes native PostgreSQL job.
 *
 * The job runs the whole native Vitest project. This contract then proves that it actually did:
 *   - every native test file on disk appears in the results and passed (a file that did not run is a failure, so a new
 *     native test cannot silently go unrun);
 *   - no test failed, and the run reports success;
 *   - the only skipped tests are the ones named in ue-native-expected-skips.json, each with its reason, and each of
 *     those still skips (a stale entry would let the test skip again unnoticed once it can run).
 * A skip is recorded in the receipt as a skip. It is never counted as a pass.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const NATIVE_TEST_DIRECTORY = 'apps/union-eyes/db/__tests__'
// Must equal the include globs of apps/union-eyes/vitest.native.config.ts; the contract test compares them.
export const NATIVE_TEST_SUFFIXES = ['.postgres.test.ts', '.native.test.ts']
export const MINIMUM_NATIVE_FILES = 40

const normalise = (value) => String(value).replaceAll('\\', '/')
const isSkipped = (assertion) => ['pending', 'skipped', 'todo'].includes(assertion.status)

export function discoverNativeTestFiles(root, directory = NATIVE_TEST_DIRECTORY) {
  return readdirSync(resolve(root, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && NATIVE_TEST_SUFFIXES.some((suffix) => entry.name.endsWith(suffix)))
    .map((entry) => entry.name)
    .sort()
}

export function evaluateNativeResults({ results, discovered, expectedSkips = [], minimumFiles = MINIMUM_NATIVE_FILES }) {
  const problems = []
  const suites = new Map((results.testResults ?? []).map((suite) => [normalise(suite.name).split('/').pop(), suite]))
  const skippedByDesign = []
  const matchedSkips = new Set()
  let total = 0
  let passed = 0
  let failed = 0

  if (discovered.length < minimumFiles) problems.push(`only ${discovered.length} native test files were discovered; expected at least ${minimumFiles}`)
  if (results.success !== true) problems.push('the test run did not report success')

  for (const skip of expectedSkips) {
    if (!discovered.includes(skip.file)) problems.push(`expected skip names a file that does not exist: ${skip.file}`)
    if (!skip.reason || !String(skip.reason).trim()) problems.push(`expected skip has no reason: ${skip.file} :: ${skip.title}`)
  }

  for (const file of discovered) {
    const suite = suites.get(file)
    if (!suite) {
      problems.push(`${file} did not run`)
      continue
    }
    const assertions = suite.assertionResults ?? []
    if (suite.status !== 'passed') problems.push(`${file} did not pass (status ${suite.status})`)
    if (assertions.length === 0) problems.push(`${file} collected no tests`)
    for (const assertion of assertions) {
      total++
      if (assertion.status === 'passed') {
        passed++
      } else if (assertion.status === 'failed') {
        failed++
        problems.push(`${file} :: ${assertion.title} failed`)
      } else if (isSkipped(assertion)) {
        const index = expectedSkips.findIndex((skip) => skip.file === file && skip.title === assertion.title)
        if (index === -1) {
          problems.push(`${file} :: ${assertion.title} was skipped and is not an expected skip`)
        } else {
          matchedSkips.add(index)
          skippedByDesign.push({ file, title: assertion.title, reason: expectedSkips[index].reason })
        }
      } else {
        problems.push(`${file} :: ${assertion.title} has unrecognised status ${assertion.status}`)
      }
    }
  }

  expectedSkips.forEach((skip, index) => {
    if (!matchedSkips.has(index)) problems.push(`expected skip no longer skips, remove it from the list: ${skip.file} :: ${skip.title}`)
  })
  if (Number(results.numFailedTests ?? 0) !== failed) problems.push(`the run reports ${results.numFailedTests} failed tests, the files show ${failed}`)
  if (Number(results.numTotalTests ?? 0) !== total) problems.push(`the run reports ${results.numTotalTests} tests, the files show ${total}`)

  return { problems, summary: { files: discovered.length, total, passed, failed, skipped: skippedByDesign.length }, skippedByDesign }
}

export function buildReceipt({ summary, skippedByDesign }, env) {
  return {
    kind: 'UE-COMBINED-SCHEMA-NATIVE-PG',
    sourceSha: env.SOURCE_SHA,
    postgresMajor: env.PG_VERSION,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    files: summary.files,
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped,
    skippedByDesign,
    status: 'PASS',
    evidenceClass: 'NATIVE_POSTGRES',
    limitation: 'Disposable synthetic QA database on the legacy auth topology; not real-login, Canonical V2, Azure immutable-audit, or staging acceptance',
  }
}

function option(argv, name) {
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}

export function run(argv, env, root = process.cwd()) {
  const resultsFile = option(argv, '--results')
  const receiptFile = option(argv, '--receipt')
  const skipsFile = option(argv, '--expected-skips')
  if (!resultsFile || !receiptFile || !skipsFile) throw new Error('usage: --results <file> --expected-skips <file> --receipt <file>')
  const results = JSON.parse(readFileSync(resultsFile, 'utf8'))
  const expectedSkips = JSON.parse(readFileSync(skipsFile, 'utf8')).skippedTests
  const evaluation = evaluateNativeResults({ results, discovered: discoverNativeTestFiles(root), expectedSkips })
  if (evaluation.problems.length > 0) {
    console.error(JSON.stringify({ problems: evaluation.problems, summary: evaluation.summary }, null, 2))
    return 1
  }
  mkdirSync(dirname(resolve(receiptFile)), { recursive: true })
  writeFileSync(receiptFile, JSON.stringify(buildReceipt(evaluation, env), null, 2) + '\n')
  console.log(JSON.stringify(evaluation.summary))
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = run(process.argv.slice(2), process.env)
