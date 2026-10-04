/**
 * Phase 2 convergence: one frozen pull-request head reaches 16 terminal
 * required contexts, or the reporter fails closed. Deterministic clock and
 * injected GitHub client. No live GitHub, Docker, or workflow run.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CANONICAL_CONTEXTS, SECRET_AUTHORITY_CONTEXTS } from '../ci/merge-authority/surface.mjs'
import { CI_AUTHORITY_JOBS } from '../ci/merge-authority/supersession.mjs'
import {
  CONVERGENCE_FLAGS,
  MAX_DURATION_MS_DEFAULT,
  RETRY_INTERVAL_MS_DEFAULT,
  RequiredContextsCancelledError,
  RequiredContextsTimeoutError,
  convergeRequiredChecks,
  maxReconciliationAttempts,
  requiredContextNames,
} from '../ci/merge-authority/publish.mjs'

const ROOT = join(__dirname, '..', '..')
const CURRENT = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const OLD = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const CODE_DIFF = ['apps/union-eyes/app/api/example/route.ts']
const ALL_APPLICABLE_DIFF = [
  'apps/union-eyes/app/api/example/route.ts',
  'packages/db/src/hash-chain.ts',
  'infrastructure/bicep/main.bicep',
  'ops/runbooks/README.md',
]

type Run = {
  id: number
  head_sha: string
  event: string
  status: string
  conclusion: string | null
  pull_requests?: Array<{ head: { sha: string } }>
}

type Job = { name: string; status: string; conclusion: string | null }

function ciJob(id: string, status: string, conclusion: string | null): Job {
  const named = CI_AUTHORITY_JOBS.find((job) => job.id === id)
  if (!named) throw new Error(`unknown job ${id}`)
  return { name: named.name, status, conclusion }
}

function allCiJobs(status: string, conclusion: string | null, overrides: Record<string, Partial<Job>> = {}): Job[] {
  return CI_AUTHORITY_JOBS.map((job) => ({
    name: job.name,
    status,
    conclusion,
    ...overrides[job.id],
  }))
}

function secretJobs(status: string, conclusion: string | null): Job[] {
  return SECRET_AUTHORITY_CONTEXTS.map((name) => ({ name, status, conclusion }))
}

function run(id: number, head: string, status: string, conclusion: string | null): Run {
  return {
    id,
    head_sha: head,
    event: 'pull_request',
    status,
    conclusion,
    pull_requests: [{ head: { sha: CURRENT } }],
  }
}

function fakeClock() {
  let time = 0
  const sleeps: number[] = []
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      time += ms
    },
    sleeps,
  }
}

function createClient(handlers: {
  runs: Record<string, Run[]>
  jobs: (id: number) => Job[]
  onPost?: (body: { name: string }) => void
}) {
  const calls: Array<Record<string, unknown>> = []
  const posted: Array<{ name: string; head_sha: string; status: string; conclusion: string; output: { title: string } }> = []
  return {
    calls,
    posted,
    async listWorkflowRuns(file: string, sha: string) {
      calls.push({ op: 'listWorkflowRuns', file, sha })
      return handlers.runs[file] ?? []
    },
    async listRunJobs(id: number) {
      calls.push({ op: 'listRunJobs', id })
      return handlers.jobs(id)
    },
    async createCheckRun(body: { name: string; head_sha: string; status: string; conclusion: string; output: { title: string } }) {
      calls.push({ op: 'createCheckRun', name: body.name, head_sha: body.head_sha, conclusion: body.conclusion })
      posted.push(body)
      handlers.onPost?.(body)
    },
    async dispatch() {
      calls.push({ op: 'dispatch' })
      throw new Error('re-executed job')
    },
  }
}

function expectSixteenTerminal(checks: Array<{ name: string; head_sha: string; status: string; conclusion: string }>, head: string) {
  expect(checks).toHaveLength(16)
  expect(new Set(checks.map((check) => check.name))).toEqual(new Set(requiredContextNames()))
  expect(checks.every((check) => check.head_sha === head)).toBe(true)
  expect(checks.every((check) => check.status === 'completed')).toBe(true)
  expect(checks.every((check) => check.conclusion === 'success' || check.conclusion === 'failure')).toBe(true)
  expect(checks.some((check) => check.head_sha === OLD)).toBe(false)
}

describe('phase 2 required-context convergence', () => {
  it('defines a bounded retry interval and attempt budget', () => {
    expect(CONVERGENCE_FLAGS).toEqual({
      RETRY_UNTIL_ALL_16_POSTED: 'YES',
      ALL_16_CONTEXTS_TERMINAL: 'YES',
      CURRENT_HEAD_ONLY: 'YES',
      OLD_HEAD_CAN_OVERRIDE_NEW_HEAD: 'NO',
      BOUNDED_TIMEOUT: 'YES',
    })
    expect(requiredContextNames()).toHaveLength(16)
    expect(RETRY_INTERVAL_MS_DEFAULT).toBe(20_000)
    expect(MAX_DURATION_MS_DEFAULT).toBe(6_600_000)
    expect(maxReconciliationAttempts(20_000, 6_600_000, '')).toBe(331)
    expect(maxReconciliationAttempts(0, 2_000, '')).toBe(2_001)
  })

  it('convergence case 1: all results already available posts 16 terminal contexts', async () => {
    const clock = fakeClock()
    const github = createClient({
      runs: {
        'ci.yml': [run(10, CURRENT, 'completed', 'success'), run(9, OLD, 'completed', 'success')],
        'secret-scan.yml': [run(11, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => (id === 11 ? secretJobs('completed', 'success') : allCiJobs('completed', 'success')),
    })
    const result = await convergeRequiredChecks({
      headSha: CURRENT,
      diffPaths: ALL_APPLICABLE_DIFF,
      github,
      now: clock.now,
      sleep: clock.sleep,
      intervalMs: RETRY_INTERVAL_MS_DEFAULT,
      maxDurationMs: 0,
      maxAttempts: 1,
    })
    expect(result.attempts).toBe(1)
    expect(result.sleeps).toBe(0)
    expect(clock.sleeps).toEqual([])
    expectSixteenTerminal(result.checks, CURRENT)
    expect(result.checks.every((check) => check.conclusion === 'success')).toBe(true)
    expect(github.calls.some((call) => call.op === 'dispatch')).toBe(false)
    expect(github.calls.filter((call) => call.op === 'listWorkflowRuns').every((call) => call.sha === CURRENT)).toBe(true)
    expect(github.calls.some((call) => call.op === 'listRunJobs' && call.id === 9)).toBe(false)
  })

  it('convergence case 2: NOT_APPLICABLE publishes success immediately and reaches 16 terminal contexts', async () => {
    const clock = fakeClock()
    let opsPostedAtSleeps = -1
    const github = createClient({
      runs: {
        'ci.yml': [run(20, CURRENT, 'in_progress', null)],
        'secret-scan.yml': [run(21, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 21) return secretJobs('completed', 'success')
        return allCiJobs('completed', 'success', {
          'ops-pack-validation': { status: 'in_progress', conclusion: null },
          'iac-scan': { status: 'completed', conclusion: 'skipped' },
          'hash-chain-drift': { status: 'completed', conclusion: 'skipped' },
        })
      },
      onPost: (body) => {
        if (body.name === 'Merge Authority / Ops Documentation') opsPostedAtSleeps = clock.sleeps.length
      },
    })
    const result = await convergeRequiredChecks({
      headSha: CURRENT,
      diffPaths: CODE_DIFF,
      github,
      now: clock.now,
      sleep: clock.sleep,
      intervalMs: 20_000,
      maxDurationMs: 0,
      maxAttempts: 1,
    })
    expect(result.attempts).toBe(1)
    expect(result.sleeps).toBe(0)
    expect(opsPostedAtSleeps).toBe(0)
    expectSixteenTerminal(result.checks, CURRENT)
    expect(result.checks.find((check) => check.name === 'Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(result.checks.find((check) => check.name === 'Merge Authority / IaC Security')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(result.checks.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toMatchObject({
      conclusion: 'success',
      output: { title: 'PASS' },
    })
    expect(CANONICAL_CONTEXTS.find((context) => context.name === 'Merge Authority / Ops Documentation')?.ciJob).toBe(
      'ops-pack-validation',
    )
    expect(github.calls.some((call) => call.op === 'dispatch')).toBe(false)
  })

  it('convergence case 3: delayed authoritative job retries and converges', async () => {
    const clock = fakeClock()
    let ciReads = 0
    const ci = run(30, CURRENT, 'in_progress', null)
    const github = createClient({
      runs: {
        'ci.yml': [ci, run(29, OLD, 'completed', 'success')],
        'secret-scan.yml': [run(31, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 29) return allCiJobs('completed', 'success')
        if (id === 31) return secretJobs('completed', 'success')
        ciReads += 1
        const lintReady = ciReads >= 2
        return allCiJobs('completed', 'success', {
          'lint-and-typecheck': lintReady
            ? { status: 'completed', conclusion: 'success' }
            : { status: 'in_progress', conclusion: null },
        })
      },
    })
    const result = await convergeRequiredChecks({
      headSha: CURRENT,
      diffPaths: CODE_DIFF,
      github,
      now: clock.now,
      sleep: clock.sleep,
      intervalMs: 5_000,
      maxDurationMs: 20_000,
      maxAttempts: 4,
    })
    expect(ci.status).toBe('in_progress')
    expect(result.attempts).toBe(2)
    expect(result.sleeps).toBe(1)
    expect(clock.sleeps).toEqual([5_000])
    expectSixteenTerminal(result.checks, CURRENT)
    expect(result.checks.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toMatchObject({
      conclusion: 'success',
      output: { title: 'PASS' },
    })
    expect(github.calls.some((call) => call.op === 'dispatch')).toBe(false)
    expect(github.calls.some((call) => call.op === 'listRunJobs' && call.id === 29)).toBe(false)
    expect(github.calls.filter((call) => call.op === 'listWorkflowRuns').every((call) => call.sha === CURRENT)).toBe(true)
  })

  it('convergence case 4: unresolved job hits a bounded timeout and names missing contexts', async () => {
    const clock = fakeClock()
    const github = createClient({
      runs: {
        'ci.yml': [run(40, CURRENT, 'in_progress', null)],
        'secret-scan.yml': [run(41, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 41) return secretJobs('completed', 'success')
        return allCiJobs('completed', 'success', {
          'lint-and-typecheck': { status: 'in_progress', conclusion: null },
        })
      },
    })
    let caught: unknown
    try {
      await convergeRequiredChecks({
        headSha: CURRENT,
        diffPaths: CODE_DIFF,
        github,
        now: clock.now,
        sleep: clock.sleep,
        intervalMs: 1_000,
        maxDurationMs: 1_000,
        maxAttempts: 5,
      })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(RequiredContextsTimeoutError)
    const error = caught as RequiredContextsTimeoutError
    expect(error.attempt).toBe(2)
    expect(error.missing).toEqual(['Merge Authority / Lint & Typecheck'])
    expect(error.message).toBe('timed out waiting for required contexts: Merge Authority / Lint & Typecheck')
    expect(clock.sleeps).toEqual([1_000])
    expect(github.posted.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toBeUndefined()
    expect(github.posted.find((check) => check.name === 'Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'success',
      head_sha: CURRENT,
    })
    expect(github.posted.every((check) => check.conclusion !== 'success' || check.output.title === 'NOT_APPLICABLE' || check.output.title === 'PASS')).toBe(true)
    expect(github.calls.some((call) => call.op === 'dispatch')).toBe(false)
  })

  it('convergence case 5: superseded head cannot satisfy or overwrite the current head', async () => {
    const clock = fakeClock()
    const first = createClient({
      runs: {
        'ci.yml': [run(2, CURRENT, 'in_progress', null), run(999, OLD, 'completed', 'success')],
        'secret-scan.yml': [run(3, CURRENT, 'completed', 'success'), run(998, OLD, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 998 || id === 3) return secretJobs('completed', 'success')
        if (id === 999) return allCiJobs('completed', 'success')
        return allCiJobs('completed', 'failure', {
          'lint-and-typecheck': { status: 'in_progress', conclusion: null },
        })
      },
    })
    let firstError: unknown
    try {
      await convergeRequiredChecks({
        headSha: CURRENT,
        diffPaths: CODE_DIFF,
        github: first,
        now: clock.now,
        sleep: clock.sleep,
        intervalMs: 1_000,
        maxDurationMs: 0,
        maxAttempts: 1,
      })
    } catch (error) {
      firstError = error
    }
    expect(firstError).toBeInstanceOf(RequiredContextsTimeoutError)
    expect((firstError as RequiredContextsTimeoutError).missing).toContain('Merge Authority / Lint & Typecheck')
    expect(first.posted.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toBeUndefined()
    expect(first.posted.every((check) => check.head_sha === CURRENT)).toBe(true)
    expect(first.calls.some((call) => call.op === 'listRunJobs' && (call.id === 999 || call.id === 998))).toBe(false)
    expect(first.calls.filter((call) => call.op === 'listWorkflowRuns').every((call) => call.sha === CURRENT)).toBe(true)

    const second = createClient({
      runs: {
        'ci.yml': [run(2, CURRENT, 'completed', 'failure'), run(999, OLD, 'completed', 'success')],
        'secret-scan.yml': [run(3, CURRENT, 'completed', 'success'), run(998, OLD, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 998 || id === 3) return secretJobs('completed', 'success')
        if (id === 999) return allCiJobs('completed', 'success')
        return allCiJobs('completed', 'failure')
      },
    })
    const result = await convergeRequiredChecks({
      headSha: CURRENT,
      diffPaths: CODE_DIFF,
      github: second,
      now: () => 0,
      sleep: async () => {
        throw new Error('current head was already terminal and must not wait on the old head')
      },
      intervalMs: 20_000,
      maxDurationMs: 0,
      maxAttempts: 1,
    })
    expectSixteenTerminal(result.checks, CURRENT)
    expect(result.checks.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toMatchObject({
      head_sha: CURRENT,
      conclusion: 'failure',
      output: { title: 'FAILURE' },
    })
    expect(second.posted.every((check) => check.head_sha === CURRENT)).toBe(true)
    expect(second.posted.some((check) => check.head_sha === OLD)).toBe(false)
    expect(second.calls.some((call) => call.op === 'listRunJobs' && (call.id === 999 || call.id === 998))).toBe(false)
  })

  it('convergence case 6: reporter cancellation still leaves an independent path to 16 terminal contexts', async () => {
    const publisher = readFileSync(join(ROOT, '.github/workflows/publish-required-checks.yml'), 'utf8')
    expect(publisher).toContain('node tooling/ci/merge-authority/publish.mjs publish-pull-request')
    expect(publisher).toContain('cancel-in-progress: false')
    expect(publisher).toContain('publish-required-checks-${{ github.event.pull_request.head.sha }}')

    const signal = { aborted: false }
    const clock = fakeClock()
    const cancelledClient = createClient({
      runs: {
        'ci.yml': [run(60, CURRENT, 'in_progress', null), run(959, OLD, 'completed', 'success')],
        'secret-scan.yml': [run(61, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 61) return secretJobs('completed', 'success')
        if (id === 959) return allCiJobs('completed', 'success')
        return allCiJobs('completed', 'success', {
          'lint-and-typecheck': { status: 'in_progress', conclusion: null },
        })
      },
      onPost: () => {
        signal.aborted = true
      },
    })
    let cancelled: unknown
    try {
      await convergeRequiredChecks({
        headSha: CURRENT,
        diffPaths: CODE_DIFF,
        github: cancelledClient,
        now: clock.now,
        sleep: clock.sleep,
        signal,
        intervalMs: 20_000,
        maxDurationMs: 110 * 60 * 1000,
        maxAttempts: 6,
      })
    } catch (error) {
      cancelled = error
    }
    expect(cancelled).toBeInstanceOf(RequiredContextsCancelledError)
    const error = cancelled as RequiredContextsCancelledError
    expect(error.missing).toContain('Merge Authority / Lint & Typecheck')
    expect(error.message).toContain('Merge Authority / Lint & Typecheck')
    expect(clock.sleeps).toEqual([])
    expect(cancelledClient.posted.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toBeUndefined()
    expect(cancelledClient.posted.find((check) => check.name === 'Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'success',
      head_sha: CURRENT,
    })

    const replacement = createClient({
      runs: {
        'ci.yml': [run(60, CURRENT, 'completed', 'success')],
        'secret-scan.yml': [run(61, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => (id === 61 ? secretJobs('completed', 'success') : allCiJobs('completed', 'success')),
    })
    const result = await convergeRequiredChecks({
      headSha: CURRENT,
      diffPaths: CODE_DIFF,
      github: replacement,
      now: () => 0,
      sleep: async () => {
        throw new Error('replacement process waited even though evidence was already terminal')
      },
      intervalMs: RETRY_INTERVAL_MS_DEFAULT,
      maxDurationMs: MAX_DURATION_MS_DEFAULT,
      maxAttempts: maxReconciliationAttempts(RETRY_INTERVAL_MS_DEFAULT, MAX_DURATION_MS_DEFAULT, ''),
    })
    expect(replacement.posted).toHaveLength(16)
    expectSixteenTerminal(result.checks, CURRENT)
    expect(result.checks.find((check) => check.name === 'Merge Authority / Lint & Typecheck')?.conclusion).toBe('success')
    expect(result.attempts).toBe(1)
    expect(cancelledClient.posted.length).toBeLessThan(16)
  })
})
