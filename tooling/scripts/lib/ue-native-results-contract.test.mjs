import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  MINIMUM_NATIVE_FILES,
  NATIVE_TEST_SUFFIXES,
  buildReceipt,
  discoverNativeTestFiles,
  evaluateNativeResults,
  run,
} from './ue-native-results-contract.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..', '..')

const discovered = Array.from({ length: MINIMUM_NATIVE_FILES }, (_, i) => `suite-${i}.postgres.test.ts`)
const passing = (title = 'works') => ({ title, status: 'passed' })
const suite = (file, assertions = [passing()], status = 'passed') => ({ name: `/work/apps/union-eyes/db/__tests__/${file}`, status, assertionResults: assertions })
const resultsFor = (suites, over = {}) => {
  const all = suites.flatMap((s) => s.assertionResults)
  return {
    success: true,
    numTotalTests: all.length,
    numFailedTests: all.filter((a) => a.status === 'failed').length,
    testResults: suites,
    ...over,
  }
}
const allPassing = () => discovered.map((file) => suite(file))
const evaluate = (results, expectedSkips = []) => evaluateNativeResults({ results, discovered, expectedSkips })

describe('native results contract', () => {
  it('accepts a run in which every discovered file ran and passed', () => {
    const { problems, summary } = evaluate(resultsFor(allPassing()))
    assert.deepEqual(problems, [])
    assert.equal(summary.files, MINIMUM_NATIVE_FILES)
    assert.equal(summary.skipped, 0)
  })

  it('treats a file that did not run as a failure, so a new native test cannot go unrun', () => {
    const suites = allPassing().slice(1)
    assert.ok(evaluate(resultsFor(suites)).problems.includes('suite-0.postgres.test.ts did not run'))
  })

  it('matches results to files on any path separator', () => {
    const suites = allPassing().map((s) => ({ ...s, name: s.name.replaceAll('/', '\\') }))
    assert.deepEqual(evaluate(resultsFor(suites)).problems, [])
  })

  it('fails on a failed test, a failed file, a file that collected nothing, and an unsuccessful run', () => {
    const failing = allPassing()
    failing[0] = suite(discovered[0], [passing(), { title: 'breaks', status: 'failed' }], 'failed')
    failing[1] = suite(discovered[1], [])
    const { problems } = evaluate(resultsFor(failing, { success: false }))
    assert.ok(problems.includes('suite-0.postgres.test.ts :: breaks failed'))
    assert.ok(problems.includes('suite-0.postgres.test.ts did not pass (status failed)'))
    assert.ok(problems.includes('suite-1.postgres.test.ts collected no tests'))
    assert.ok(problems.includes('the test run did not report success'))
  })

  it('never counts a skipped test as a pass', () => {
    const suites = allPassing()
    suites[2] = suite(discovered[2], [passing(), { title: 'needs a topology', status: 'pending' }])
    const { problems } = evaluate(resultsFor(suites))
    assert.deepEqual(problems, ['suite-2.postgres.test.ts :: needs a topology was skipped and is not an expected skip'])
  })

  it('allows a named, justified skip, records it, and keeps it out of the passed count', () => {
    const suites = allPassing()
    suites[2] = suite(discovered[2], [passing(), { title: 'needs a topology', status: 'pending' }])
    const expected = [{ file: discovered[2], title: 'needs a topology', reason: 'Canonical V2 only' }]
    const evaluation = evaluate(resultsFor(suites), expected)
    assert.deepEqual(evaluation.problems, [])
    assert.equal(evaluation.summary.skipped, 1)
    assert.equal(evaluation.summary.passed, evaluation.summary.total - 1)
    assert.deepEqual(evaluation.skippedByDesign, [{ file: discovered[2], title: 'needs a topology', reason: 'Canonical V2 only' }])
  })

  it('fails when an expected skip now runs, so the list cannot go stale', () => {
    const expected = [{ file: discovered[0], title: 'works', reason: 'was skipped once' }]
    assert.ok(evaluate(resultsFor(allPassing()), expected).problems.some((p) => p.startsWith('expected skip no longer skips')))
  })

  it('rejects an expected skip with no reason or for a file that does not exist', () => {
    const { problems } = evaluate(resultsFor(allPassing()), [
      { file: 'ghost.postgres.test.ts', title: 'x', reason: 'r' },
      { file: discovered[0], title: 'works', reason: '  ' },
    ])
    assert.ok(problems.includes('expected skip names a file that does not exist: ghost.postgres.test.ts'))
    assert.ok(problems.includes(`expected skip has no reason: ${discovered[0]} :: works`))
  })

  it('rejects results whose totals disagree with the files, and a vacuously small discovery', () => {
    const results = resultsFor(allPassing(), { numTotalTests: 5, numFailedTests: 2 })
    const { problems } = evaluate(results)
    assert.ok(problems.some((p) => p.startsWith('the run reports 2 failed tests')))
    assert.ok(problems.some((p) => p.startsWith('the run reports 5 tests')))
    const small = evaluateNativeResults({ results: resultsFor([]), discovered: ['a.postgres.test.ts'], expectedSkips: [] })
    assert.ok(small.problems.some((p) => p.includes('only 1 native test files were discovered')))
  })

  it('builds a receipt that lists skips explicitly', () => {
    const receipt = buildReceipt(
      { summary: { files: 47, total: 10, passed: 9, failed: 0, skipped: 1 }, skippedByDesign: [{ file: 'a', title: 'b', reason: 'c' }] },
      { SOURCE_SHA: 'abc', PG_VERSION: '16', GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1' },
    )
    assert.equal(receipt.status, 'PASS')
    assert.equal(receipt.skipped, 1)
    assert.deepEqual(receipt.skippedByDesign, [{ file: 'a', title: 'b', reason: 'c' }])
    assert.equal(receipt.postgresMajor, '16')
  })
})

describe('native results contract against the repository', () => {
  const files = discoverNativeTestFiles(root)

  it('discovers exactly what the native Vitest project includes', () => {
    const config = readFileSync(join(root, 'apps/union-eyes/vitest.native.config.ts'), 'utf8')
    const include = [...config.matchAll(/'db\/__tests__\/\*([^']+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual(include, [...NATIVE_TEST_SUFFIXES].sort())
    assert.ok(files.length >= MINIMUM_NATIVE_FILES)
    assert.ok(files.includes('precedent-library.postgres.test.ts'))
  })

  it('names only real files with a reason in the committed expected skips', () => {
    const { skippedTests } = JSON.parse(readFileSync(join(here, 'ue-native-expected-skips.json'), 'utf8'))
    assert.ok(skippedTests.length >= 1)
    for (const skip of skippedTests) {
      assert.ok(files.includes(skip.file), `${skip.file} is not a native test file`)
      assert.ok(String(skip.reason).length > 40, `${skip.file} needs a real reason`)
    }
  })

  it('runs end to end from files and exits non-zero on a violation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ue-native-contract-'))
    try {
      const resultsFile = join(dir, 'results.json')
      const receiptFile = join(dir, 'receipt.json')
      const skipsFile = join(dir, 'skips.json')
      const suites = files.map((file) => suite(file))
      const write = (path, value) => writeFileSync(path, JSON.stringify(value))
      write(resultsFile, resultsFor(suites))
      write(skipsFile, { skippedTests: [] })
      const argv = ['--results', resultsFile, '--expected-skips', skipsFile, '--receipt', receiptFile]
      const quiet = console.log
      console.log = () => {}
      try {
        assert.equal(run(argv, { SOURCE_SHA: 's', PG_VERSION: '15' }, root), 0)
      } finally {
        console.log = quiet
      }
      assert.equal(JSON.parse(readFileSync(receiptFile, 'utf8')).files, files.length)
      write(resultsFile, resultsFor(suites.slice(1)))
      const noise = console.error
      console.error = () => {}
      try {
        assert.equal(run(argv, {}, root), 1)
      } finally {
        console.error = noise
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
