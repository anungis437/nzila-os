/**
 * Phase 2 convergence: one frozen pull-request head reaches 16 terminal
 * required contexts, or the reporter fails closed. Deterministic clock and
 * injected GitHub client. No live GitHub, Docker, or workflow run.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { CANONICAL_CONTEXTS, SECRET_AUTHORITY_CONTEXTS } from '../ci/merge-authority/surface.mjs'
import { CI_AUTHORITY_JOBS } from '../ci/merge-authority/supersession.mjs'
import {
  CONVERGENCE_FLAGS,
  MAX_DURATION_MS_DEFAULT,
  RETRY_INTERVAL_MS_DEFAULT,
  RequiredContextsCancelledError,
  RequiredContextsTimeoutError,
  AUTHORITATIVE_JOB_LIMIT_MS,
  convergeRequiredChecks,
  maxReconciliationAttempts,
  republishFrozenHead,
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
    expect(AUTHORITATIVE_JOB_LIMIT_MS).toBe(360 * 60 * 1000)
    expect(MAX_DURATION_MS_DEFAULT).toBe(AUTHORITATIVE_JOB_LIMIT_MS)
    expect(MAX_DURATION_MS_DEFAULT).toBeGreaterThan(110 * 60 * 1000)
    expect(maxReconciliationAttempts(20_000, MAX_DURATION_MS_DEFAULT, '')).toBe(1_081)
    expect(maxReconciliationAttempts(0, 2_000, '')).toBe(2_001)
    const publisher = readFileSync(join(ROOT, '.github/workflows/publish-required-checks.yml'), 'utf8')
    expect(publisher).toContain('timeout-minutes: 360')
    expect(publisher).toContain('MA_POLL_TIMEOUT_MS: "21600000"')
    expect(publisher).not.toContain('6600000')
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

  it('redteam attack-3: late terminal job is published after the first reporter exits', async () => {
    const first = createClient({
      runs: {
        'ci.yml': [run(70, CURRENT, 'in_progress', null), run(999, OLD, 'completed', 'success')],
        'secret-scan.yml': [run(71, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 71) return secretJobs('completed', 'success')
        if (id === 999) return allCiJobs('completed', 'success')
        return allCiJobs('completed', 'success', {
          'lint-and-typecheck': { status: 'in_progress', conclusion: null },
        })
      },
    })
    let exited: unknown
    try {
      await convergeRequiredChecks({
        headSha: CURRENT,
        diffPaths: CODE_DIFF,
        github: first,
        now: () => 0,
        sleep: async () => {
          throw new Error('first reporter must exit without waiting past its budget')
        },
        intervalMs: 20_000,
        maxDurationMs: 0,
        maxAttempts: 1,
      })
    } catch (error) {
      exited = error
    }
    expect(exited).toBeInstanceOf(RequiredContextsTimeoutError)
    expect((exited as RequiredContextsTimeoutError).missing).toContain('Merge Authority / Lint & Typecheck')
    expect(first.posted.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toBeUndefined()
    expect(first.calls.some((call) => call.op === 'dispatch')).toBe(false)

    const reentry = createClient({
      runs: {
        'ci.yml': [run(70, CURRENT, 'completed', 'success'), run(999, OLD, 'completed', 'failure')],
        'secret-scan.yml': [run(71, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 71) return secretJobs('completed', 'success')
        if (id === 999) return allCiJobs('completed', 'failure')
        return allCiJobs('completed', 'success')
      },
    })
    const published = await republishFrozenHead({
      frozenHeadSha: CURRENT,
      requestedHeadSha: CURRENT,
      diffPaths: CODE_DIFF,
      github: reentry,
      now: () => 0,
      sleep: async () => {
        throw new Error('late result was already terminal and must not re-execute the job')
      },
      intervalMs: 20_000,
      maxDurationMs: 0,
      maxAttempts: 1,
    })
    expectSixteenTerminal(published.checks, CURRENT)
    expect(published.checks.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toMatchObject({
      head_sha: CURRENT,
      conclusion: 'success',
      output: { title: 'PASS' },
    })
    expect(reentry.calls.some((call) => call.op === 'listRunJobs' && call.id === 999)).toBe(false)
    expect(reentry.calls.some((call) => call.op === 'dispatch')).toBe(false)
    expect(reentry.posted.every((check) => check.head_sha === CURRENT)).toBe(true)
  })

  it('redteam attack-3: HTTP 502 and 504 on list retry inside the remaining budget', async () => {
    const clock = fakeClock()
    const failures = [502, 504]
    const github = createClient({
      runs: {
        'ci.yml': [run(80, CURRENT, 'completed', 'success')],
        'secret-scan.yml': [run(81, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => (id === 81 ? secretJobs('completed', 'success') : allCiJobs('completed', 'success')),
    })
    const succeed = github.listWorkflowRuns.bind(github)
    github.listWorkflowRuns = async (file: string, sha: string) => {
      const status = failures.shift()
      if (status) {
        throw Object.assign(new Error(`listing ${file} runs failed (${status}): gateway`), { status })
      }
      return succeed(file, sha)
    }
    const result = await republishFrozenHead({
      frozenHeadSha: CURRENT,
      diffPaths: ALL_APPLICABLE_DIFF,
      github,
      now: clock.now,
      sleep: clock.sleep,
      intervalMs: 1_000,
      maxDurationMs: 10_000,
      maxAttempts: 5,
    })
    expect(clock.sleeps).toEqual([1_000, 1_000])
    expect(result.attempts).toBe(3)
    expectSixteenTerminal(result.checks, CURRENT)
    expect(result.checks.every((check) => check.conclusion === 'success')).toBe(true)
    expect(github.calls.some((call) => call.op === 'dispatch')).toBe(false)

    const unauthorized = createClient({
      runs: { 'ci.yml': [], 'secret-scan.yml': [] },
      jobs: () => [],
    })
    unauthorized.listWorkflowRuns = async () => {
      throw Object.assign(new Error('listing ci.yml runs failed (401): unauthorized'), { status: 401 })
    }
    await expect(
      republishFrozenHead({
        frozenHeadSha: CURRENT,
        diffPaths: CODE_DIFF,
        github: unauthorized,
        now: () => 0,
        sleep: async () => {
          throw new Error('401 must not be retried as a read timeout')
        },
        intervalMs: 1_000,
        maxDurationMs: 60_000,
        maxAttempts: 3,
      }),
    ).rejects.toThrow(/\(401\)/)
  })

  it('redteam attack-5: cancelling the pull_request publisher leaves a production re-entry for that SHA', async () => {
    const publisherText = readFileSync(join(ROOT, '.github/workflows/publish-required-checks.yml'), 'utf8')
    const reentryText = readFileSync(join(ROOT, '.github/workflows/republish-required-checks.yml'), 'utf8')
    const publisher = parse(publisherText)
    const reentry = parse(reentryText)
    expect(publisher.on.pull_request.branches).toContain('main')
    expect(publisher.on.workflow_run).toBeUndefined()
    expect(reentry.on.pull_request).toBeUndefined()
    expect(reentry.on.workflow_run).toBeUndefined()
    expect(reentry.on.workflow_dispatch).toBeUndefined()
    expect(reentry.on.schedule).toBeUndefined()
    expect(reentry.on.pull_request_review.types).toContain('submitted')
    expect(reentryText).toContain('github.event.pull_request.head.sha')
    expect(reentryText).toContain('node tooling/ci/merge-authority/publish.mjs republish-frozen-head')
    expect(reentryText).not.toContain('publish-pull-request')
    expect(reentryText).not.toContain('workflow_run')
    expect(reentry.concurrency['cancel-in-progress']).toBe(false)
    expect(String(reentry.concurrency.group)).toContain('pull_request.head.sha')
    expect(reentry.jobs['republish-frozen-head']['timeout-minutes']).toBe(360)
    expect(reentryText).toContain('MA_POLL_TIMEOUT_MS: "21600000"')
    expect(publisher.jobs['publish-required-checks']['timeout-minutes']).toBe(360)

    await expect(
      republishFrozenHead({
        frozenHeadSha: CURRENT,
        requestedHeadSha: OLD,
        diffPaths: CODE_DIFF,
        github: createClient({ runs: {}, jobs: () => [] }),
        now: () => 0,
        sleep: async () => {
          throw new Error('an older head must be refused before any read')
        },
        maxDurationMs: 0,
        maxAttempts: 1,
      }),
    ).rejects.toThrow(/refusing to publish checks for/)

    const unknown = createClient({
      runs: {
        'ci.yml': [run(90, CURRENT, 'in_progress', null), run(991, OLD, 'completed', 'success')],
        'secret-scan.yml': [run(91, CURRENT, 'completed', 'success')],
      },
      jobs: (id) => {
        if (id === 991) return allCiJobs('completed', 'success')
        if (id === 91) return secretJobs('completed', 'success')
        return allCiJobs('completed', 'success', {
          'lint-and-typecheck': { status: 'in_progress', conclusion: null },
        })
      },
    })
    await expect(
      republishFrozenHead({
        frozenHeadSha: CURRENT,
        requestedHeadSha: CURRENT,
        diffPaths: CODE_DIFF,
        github: unknown,
        now: () => 0,
        sleep: async () => undefined,
        intervalMs: 0,
        maxDurationMs: 0,
        maxAttempts: 1,
      }),
    ).rejects.toBeInstanceOf(RequiredContextsTimeoutError)
    expect(unknown.posted.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toBeUndefined()
    expect(unknown.posted.some((check) => check.head_sha === OLD)).toBe(false)
    expect(unknown.calls.some((call) => call.op === 'listRunJobs' && call.id === 991)).toBe(false)
    expect(unknown.calls.some((call) => call.op === 'dispatch')).toBe(false)
  })

  function completionJob(file: string, id: string) {
    const text = readFileSync(join(ROOT, '.github/workflows', file), 'utf8')
    const doc = parse(text)
    const job = doc.jobs[id]
    expect(job, `${file}#${id}`).toBeTruthy()
    const steps = (job.steps ?? [])
      .map((step: { run?: string; uses?: string }) => `${step.run ?? ''}\n${step.uses ?? ''}`)
      .join('\n')
    return { text, doc, job, steps }
  }

  function runReconcileCommand(
    command: string,
    env: Record<string, string>,
    handler: string,
  ) {
    const dir = mkdtempSync(join(tmpdir(), 'reconcile-run-'))
    const postedPath = join(dir, 'posted.json')
    const preload = join(dir, 'preload.mjs')
    writeFileSync(
      preload,
      `import { writeFileSync } from 'node:fs'
const posted = []
globalThis.fetch = async (url, init) => {
  const target = String(url)
  ${handler}
  if (target.includes('/check-runs')) {
    const body = JSON.parse(init.body)
    posted.push(body)
    writeFileSync(${JSON.stringify(postedPath)}, JSON.stringify(posted))
    return new Response('{}', { status: 201 })
  }
  throw new Error('unexpected url ' + target)
}
`,
    )
    const result = spawnSync(process.execPath, ['--import', preload, join(ROOT, 'tooling/ci/merge-authority/publish.mjs'), command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_REPOSITORY: 'anungis437/nzila-os',
        GITHUB_TOKEN: 'test-token',
        MA_CHECK_RETRY_BASE_MS: '0',
        ...env,
      },
    })
    let posted: Array<{ name: string; head_sha: string; conclusion: string; output: { title: string } }> = []
    try {
      posted = JSON.parse(readFileSync(postedPath, 'utf8'))
    } catch {
      posted = []
    }
    return { result, posted }
  }

  it('redteam re-entry: cancelling the pull_request publisher still leaves CI and Secret Scan completion jobs', () => {
    const publisher = readFileSync(join(ROOT, '.github/workflows/publish-required-checks.yml'), 'utf8')
    expect(publisher).not.toContain('reconcile-this-run')
    expect(publisher).not.toContain('reconcile-frozen-head')
    const ci = completionJob('ci.yml', 'reconcile-frozen-head')
    const secret = completionJob('secret-scan.yml', 'reconcile-frozen-head')
    for (const found of [ci, secret]) {
      expect(found.job.if).toBe('always()')
      expect(found.job.concurrency).toBeUndefined()
      expect(found.steps).toContain('node tooling/ci/merge-authority/publish.mjs reconcile-this-run')
      expect(found.steps).not.toContain('publish-pull-request')
      expect(found.steps).not.toContain('republish-frozen-head')
      expect(found.steps).not.toContain('pnpm test')
      expect(found.steps).not.toContain('inventory:generate')
      expect(found.steps).not.toContain('contract-tests')
      expect(found.steps).not.toContain('gitleaks')
      expect(found.steps).not.toContain('trufflehog')
      expect(found.steps).not.toContain('audit-secrets')
      expect(found.steps).not.toContain('setup-monorepo')
      expect(found.text).not.toContain('workflow_run')
      expect(found.job.permissions).toMatchObject({ contents: 'read', checks: 'write', actions: 'read' })
      const publishStep = found.job.steps.find((step: { run?: string }) => (step.run ?? '').includes('reconcile-this-run'))
      expect(publishStep.if).toBe("github.event_name == 'pull_request'")
      expect(publishStep.env.PR_HEAD_SHA).toBe('${{ github.event.pull_request.head.sha }}')
      expect(publishStep.env.SOURCE_HEAD_SHA).toBe('${{ github.event.pull_request.head.sha }}')
      expect(publishStep.env.SOURCE_RUN_ID).toBe('${{ github.run_id }}')
      expect(publishStep.env.SOURCE_EVENT).toBe('${{ github.event_name }}')
    }
    expect(new Set(ci.job.needs)).toEqual(new Set(Object.keys(ci.doc.jobs).filter((id: string) => id !== 'reconcile-frozen-head')))
    expect(new Set(secret.job.needs)).toEqual(
      new Set(Object.keys(secret.doc.jobs).filter((id: string) => id !== 'reconcile-frozen-head')),
    )
    expect(ci.job.steps.find((step: { env?: { SOURCE_WORKFLOW_NAME?: string } }) => step.env?.SOURCE_WORKFLOW_NAME).env.SOURCE_WORKFLOW_NAME).toBe('CI')
    expect(secret.job.steps.find((step: { env?: { SOURCE_WORKFLOW_NAME?: string } }) => step.env?.SOURCE_WORKFLOW_NAME).env.SOURCE_WORKFLOW_NAME).toBe('Secret Scan')
    expect(ci.job.name).toBe('Reconcile CI frozen head')
    expect(secret.job.name).toBe('Reconcile Secret Scan frozen head')
  })

  it('redteam re-entry: completion job publishes a late terminal result for the frozen run SHA', () => {
    const ci = completionJob('ci.yml', 'reconcile-frozen-head')
    const secret = completionJob('secret-scan.yml', 'reconcile-frozen-head')
    const ciCommand = ci.job.steps
      .map((step: { run?: string }) => step.run ?? '')
      .join('\n')
      .split('\n')
      .map((line: string) => line.trim())
      .find((line: string) => line.includes('reconcile-this-run'))
    const secretCommand = secret.job.steps
      .map((step: { run?: string }) => step.run ?? '')
      .join('\n')
      .split('\n')
      .map((line: string) => line.trim())
      .find((line: string) => line.includes('reconcile-this-run'))
    expect(ciCommand).toBe('node tooling/ci/merge-authority/publish.mjs reconcile-this-run')
    expect(secretCommand).toBe('node tooling/ci/merge-authority/publish.mjs reconcile-this-run')
    const command = ciCommand.split(/\s+/).pop()
    expect(command).toBe('reconcile-this-run')

    const ciJobs = CI_AUTHORITY_JOBS.map((job) => ({ name: job.name, status: 'completed', conclusion: 'success' }))
    const late = runReconcileCommand(
      command,
      {
        GITHUB_EVENT_NAME: 'pull_request',
        SOURCE_EVENT: 'pull_request',
        PR_HEAD_SHA: CURRENT,
        SOURCE_HEAD_SHA: CURRENT,
        SOURCE_RUN_ID: '4242',
        SOURCE_WORKFLOW_NAME: 'CI',
        MA_CHANGED_PATHS: CODE_DIFF.join('\n'),
      },
      `if (target.includes('/jobs')) {
    return new Response(JSON.stringify({ jobs: ${JSON.stringify(ciJobs)} }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (target.includes('/actions/runs/4242')) {
    return new Response(JSON.stringify({ id: 4242, head_sha: ${JSON.stringify(CURRENT)}, event: 'pull_request' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }`,
    )
    expect(late.result.status, late.result.stderr).toBe(0)
    expect(late.posted).toHaveLength(13)
    expect(late.posted.every((check) => check.head_sha === CURRENT)).toBe(true)
    expect(late.posted.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toMatchObject({
      conclusion: 'success',
      output: { title: 'PASS' },
    })
    expect(late.result.stdout ?? '').not.toMatch(/pnpm test|inventory:generate|gitleaks|trufflehog/)

    const unknownJobs = CI_AUTHORITY_JOBS.map((job) => ({
      name: job.name,
      status: 'completed',
      conclusion: job.id === 'lint-and-typecheck' ? 'cancelled' : 'success',
    }))
    const unknown = runReconcileCommand(
      command,
      {
        GITHUB_EVENT_NAME: 'pull_request',
        SOURCE_EVENT: 'pull_request',
        PR_HEAD_SHA: CURRENT,
        SOURCE_HEAD_SHA: CURRENT,
        SOURCE_RUN_ID: '4242',
        SOURCE_WORKFLOW_NAME: 'CI',
        MA_CHANGED_PATHS: CODE_DIFF.join('\n'),
      },
      `if (target.includes('/jobs')) {
    return new Response(JSON.stringify({ jobs: ${JSON.stringify(unknownJobs)} }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (target.includes('/actions/runs/4242')) {
    return new Response(JSON.stringify({ id: 4242, head_sha: ${JSON.stringify(CURRENT)}, event: 'pull_request' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }`,
    )
    expect(unknown.result.status, unknown.result.stderr).toBe(0)
    expect(unknown.posted.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toMatchObject({
      head_sha: CURRENT,
      conclusion: 'failure',
    })
    expect(unknown.posted.find((check) => check.name === 'Merge Authority / Lint & Typecheck')?.output.title).not.toBe('PASS')

    const refused = runReconcileCommand(
      command,
      {
        GITHUB_EVENT_NAME: 'pull_request',
        SOURCE_EVENT: 'pull_request',
        PR_HEAD_SHA: CURRENT,
        SOURCE_HEAD_SHA: CURRENT,
        MA_REQUESTED_HEAD_SHA: OLD,
        SOURCE_RUN_ID: '4242',
        SOURCE_WORKFLOW_NAME: 'CI',
        MA_CHANGED_PATHS: CODE_DIFF.join('\n'),
      },
      `if (target.includes('/jobs') || target.includes('/actions/runs/')) {
    throw new Error('refused head must not be read')
  }`,
    )
    expect(refused.result.status).not.toBe(0)
    expect(refused.result.stderr).toMatch(/refusing to publish checks for/)
    expect(refused.posted).toEqual([])

    const ownedByOldRun = runReconcileCommand(
      secretCommand.split(/\s+/).pop() ?? '',
      {
        GITHUB_EVENT_NAME: 'pull_request',
        SOURCE_EVENT: 'pull_request',
        PR_HEAD_SHA: CURRENT,
        SOURCE_HEAD_SHA: CURRENT,
        SOURCE_RUN_ID: '5252',
        SOURCE_WORKFLOW_NAME: 'Secret Scan',
      },
      `if (target.includes('/jobs')) {
    return new Response(JSON.stringify({ jobs: [
      { name: 'Gitleaks', status: 'completed', conclusion: 'success' },
      { name: 'TruffleHog OSS', status: 'completed', conclusion: 'cancelled' },
      { name: 'Docker Secret Policy', status: 'completed', conclusion: 'success' },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (target.includes('/actions/runs/5252')) {
    return new Response(JSON.stringify({ id: 5252, head_sha: ${JSON.stringify(OLD)}, event: 'pull_request' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }`,
    )
    expect(ownedByOldRun.result.status).not.toBe(0)
    expect(ownedByOldRun.result.stderr).toMatch(/this run owns/)
    expect(ownedByOldRun.posted).toEqual([])

    const secrets = runReconcileCommand(
      secretCommand.split(/\s+/).pop() ?? '',
      {
        GITHUB_EVENT_NAME: 'pull_request',
        SOURCE_EVENT: 'pull_request',
        PR_HEAD_SHA: CURRENT,
        SOURCE_HEAD_SHA: CURRENT,
        SOURCE_RUN_ID: '5252',
        SOURCE_WORKFLOW_NAME: 'Secret Scan',
      },
      `if (target.includes('/jobs')) {
    return new Response(JSON.stringify({ jobs: [
      { name: 'Gitleaks', status: 'completed', conclusion: 'success' },
      { name: 'TruffleHog OSS', status: 'completed', conclusion: 'cancelled' },
      { name: 'Docker Secret Policy', status: 'completed', conclusion: 'failure' },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (target.includes('/actions/runs/5252')) {
    return new Response(JSON.stringify({ id: 5252, head_sha: ${JSON.stringify(CURRENT)}, event: 'pull_request' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }`,
    )
    expect(secrets.result.status, secrets.result.stderr).toBe(0)
    expect(secrets.posted.map((check) => check.name).sort()).toEqual([...SECRET_AUTHORITY_CONTEXTS].sort())
    expect(secrets.posted.every((check) => check.head_sha === CURRENT)).toBe(true)
    expect(secrets.posted.find((check) => check.name === 'TruffleHog OSS')).toMatchObject({ conclusion: 'failure' })
    expect(secrets.posted.find((check) => check.name === 'Gitleaks')?.conclusion).toBe('success')
    expect(secrets.posted.find((check) => check.name === 'TruffleHog OSS')?.conclusion).not.toBe('success')
  })

})
