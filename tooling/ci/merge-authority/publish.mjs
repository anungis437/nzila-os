/**
 * Publishes canonical merge-authority check runs.
 *
 * classify-and-publish  reads newline-separated paths on stdin.
 *   DEFER_TO_CI posts proven NOT_APPLICABLE checks, then returns.
 *   REQUIRES_EXECUTION contexts are left to publish-ci-results.
 * publish-ci-results    reads MA_RESULT_* job results from the environment.
 *   MA_CHANGED_PATHS, when set, is the current diff. The reporter recomputes
 *   applicability from it and does not rewrite proven NOT_APPLICABLE contexts.
 * publish-pull-request  reconciles the frozen pull-request head until all 16
 *   required contexts are terminal or the bounded budget fails closed.
 *   NOT_APPLICABLE is posted immediately. REQUIRES_EXECUTION waits for that
 *   context's authoritative job and does not re-execute it. A result for a
 *   different head cannot satisfy this head. A later invocation can finish
 *   the same head if this process is cancelled.
 * publish-workflow-run  reads one completed CI or Secret Scan run's jobs.
 *   It posts only to the frozen head and does not re-run those jobs.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  CANONICAL_CONTEXTS,
  SECRET_AUTHORITY_CONTEXTS,
  classifyChangedPaths,
  planFastPath,
  evaluateCiResults,
  applyExecution,
  deferPublications,
  verdictToCheckRun,
} from './surface.mjs'
import {
  CI_AUTHORITY_JOBS,
  capturedPublicationHead,
  ciResultsFromJobs,
  publicationTarget,
  runIsTerminal,
  secretCheckPublications,
  secretResultsFromJobs,
  secretTerminalPublications,
  selectRunForHead,
} from './supersession.mjs'

const RESULT_ENV = {
  'lint-and-typecheck': 'MA_RESULT_LINT',
  test: 'MA_RESULT_UNIT',
  'schema-drift': 'MA_RESULT_SCHEMA',
  'sage-postgres-concurrency': 'MA_RESULT_RLS',
  'sage-live-postgres': 'MA_RESULT_MIGRATION',
  build: 'MA_RESULT_BUILD',
  'contract-tests': 'MA_RESULT_CONTRACTS',
  'repository-inventory': 'MA_RESULT_INVENTORY',
  'governance-integrity': 'MA_RESULT_GOVERNANCE',
  'hash-chain-drift': 'MA_RESULT_HASH',
  'operating-layer-gate': 'MA_RESULT_OPERATING',
  'iac-scan': 'MA_RESULT_IAC',
  'ops-pack-validation': 'MA_RESULT_OPS',
}

const SECRET_RESULT_ENV = {
  Gitleaks: 'MA_SECRET_GITLEAKS',
  'TruffleHog OSS': 'MA_SECRET_TRUFFLEHOG',
  'Docker Secret Policy': 'MA_SECRET_DOCKER',
}

function readStdin() {
  return readFileSync(0, 'utf8')
}

function pathsFromStdin(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

const RETRYABLE_CHECK_STATUSES = new Set([408, 429, 502, 503, 504])

function checkAttemptLimit() {
  const value = Number(process.env.MA_CHECK_ATTEMPTS ?? 4)
  if (!Number.isFinite(value) || value < 1) return 4
  return Math.min(Math.floor(value), 8)
}

function checkRetryDelayMs(attempt, response) {
  const header = response?.headers?.get?.('retry-after')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 8000)
  }
  const base = Number(process.env.MA_CHECK_RETRY_BASE_MS ?? 1000)
  const safe = Number.isFinite(base) && base >= 0 ? base : 1000
  return Math.min(safe * 2 ** Math.max(0, attempt - 1), 8000)
}

async function createCheckRun(body) {
  const { repository, token } = githubAuth()
  const limit = checkAttemptLimit()
  let lastError
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const response = await fetch(`https://api.github.com/repos/${repository}/check-runs`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    })
    if (response.ok) return
    const detail = await response.text()
    lastError = new Error(`check run ${body.name} failed (${response.status}): ${detail.slice(0, 500)}`)
    if (!RETRYABLE_CHECK_STATUSES.has(response.status) || attempt === limit) throw lastError
    const delay = checkRetryDelayMs(attempt, response)
    process.stderr.write(
      `retrying check ${body.name} after HTTP ${response.status} attempt ${attempt}/${limit}\n`,
    )
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  }
  throw lastError
}

function publicationFailure(body, error) {
  const message = error instanceof Error ? error.message : String(error)
  return {
    name: body.name,
    head_sha: body.head_sha,
    status: 'completed',
    conclusion: 'failure',
    output: {
      title: 'UNRESOLVED',
      summary: [
        'evidence: UNRESOLVED',
        `publication error: ${message}`,
        'This required check could not be published with its real conclusion. It is a terminal failure so the name is not left absent.',
      ].join('\n\n'),
    },
  }
}

async function publishBody(body) {
  try {
    await createCheckRun(body)
    process.stdout.write(`${body.name}: ${body.output?.title ?? body.conclusion}\n`)
    return true
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
    if (body.output?.summary?.includes('could not be published with its real conclusion')) return false
    try {
      await createCheckRun(publicationFailure(body, error))
      process.stdout.write(`${body.name}: UNRESOLVED\n`)
      return true
    } catch (fallbackError) {
      process.stderr.write(`${fallbackError instanceof Error ? fallbackError.message : fallbackError}\n`)
      return false
    }
  }
}

async function publishNamedChecks(bodies) {
  const missing = []
  for (const body of bodies) {
    if (!(await publishBody(body))) missing.push(body.name)
  }
  return missing
}

function resolveHeadSha() {
  const runHead = process.env.MA_RUN_HEAD_SHA || process.env.HEAD_SHA
  return publicationTarget(runHead, process.env.HEAD_SHA || runHead)
}

async function publishCheckRuns(verdicts, headSha) {
  return publishNamedChecks(verdicts.map((verdict) => verdictToCheckRun(verdict, headSha)))
}

async function publishVerdicts(verdicts, headSha) {
  if (verdicts.length !== CANONICAL_CONTEXTS.length) {
    throw new Error(`expected ${CANONICAL_CONTEXTS.length} authority contexts, got ${verdicts.length}`)
  }
  const names = new Set(verdicts.map((verdict) => verdict.name))
  for (const context of CANONICAL_CONTEXTS) {
    if (!names.has(context.name)) throw new Error(`missing authority context ${context.name}`)
  }
  const missing = await publishCheckRuns(verdicts, headSha)
  if (missing.length > 0) throw new Error(`required checks still absent: ${missing.join(', ')}`)
}

async function classifyAndPublish() {
  const headSha = resolveHeadSha()
  const plan = planFastPath(pathsFromStdin(readStdin()))
  process.stdout.write(`${JSON.stringify({ action: plan.action, classification: plan.classification })}\n`)
  if (plan.action === 'DEFER_TO_CI') {
    const missing = await publishCheckRuns(deferPublications(plan), headSha)
    if (missing.length > 0) throw new Error(`required checks still absent: ${missing.join(', ')}`)
    return
  }
  const verdicts = applyExecution(plan.verdicts, {
    'governance-integrity': process.env.MA_EXEC_GOVERNANCE,
    'repository-inventory': process.env.MA_EXEC_INVENTORY,
    'iac-scan': process.env.MA_EXEC_IAC,
    'ops-pack-validation': process.env.MA_EXEC_OPS,
  })
  await publishVerdicts(verdicts, headSha)
}

function diffPathsFromEnv() {
  const value = process.env.MA_CHANGED_PATHS
  if (value === undefined) return undefined
  return pathsFromStdin(value)
}

async function publishSecretTerminals() {
  const headSha = resolveHeadSha()
  const results = {}
  for (const [name, envName] of Object.entries(SECRET_RESULT_ENV)) {
    const value = process.env[envName]
    if (value == null || value === '') throw new Error(`${envName} is required`)
    results[name] = value
  }
  const missing = []
  for (const publication of secretTerminalPublications(results)) {
    if (publication.conclusion === 'success') {
      throw new Error(`unexecuted secret context cannot be success: ${publication.name}`)
    }
    const posted = await publishBody({
      name: publication.name,
      head_sha: headSha,
      status: publication.status,
      conclusion: publication.conclusion,
      output: publication.output,
    })
    if (!posted) missing.push(publication.name)
  }
  if (missing.length > 0) throw new Error(`required checks still absent: ${missing.join(', ')}`)
}

function githubAuth() {
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!repository || !token) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required to publish checks')
  }
  return { repository, token }
}

async function githubFetch(url) {
  const { token } = githubAuth()
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  return response
}

async function listRunJobs(runId) {
  const { repository } = githubAuth()
  if (!runId) throw new Error('workflow run id is required')
  const jobs = []
  for (let page = 1; page <= 20; page += 1) {
    const response = await githubFetch(
      `https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100&page=${page}`,
    )
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`listing jobs for run ${runId} failed (${response.status}): ${detail.slice(0, 500)}`)
    }
    const body = await response.json()
    const batch = Array.isArray(body.jobs) ? body.jobs : []
    jobs.push(...batch)
    if (batch.length < 100) break
  }
  return jobs
}

async function listWorkflowRuns(workflowFile, headSha) {
  const { repository } = githubAuth()
  const runs = []
  for (let page = 1; page <= 5; page += 1) {
    const response = await githubFetch(
      `https://api.github.com/repos/${repository}/actions/workflows/${workflowFile}/runs?head_sha=${encodeURIComponent(headSha)}&event=pull_request&per_page=50&page=${page}`,
    )
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`listing ${workflowFile} runs failed (${response.status}): ${detail.slice(0, 500)}`)
    }
    const body = await response.json()
    const batch = Array.isArray(body.workflow_runs) ? body.workflow_runs : []
    runs.push(...batch)
    if (batch.length < 50) break
  }
  return runs
}

/** Default wait between reconciliations while any required context is not terminal. */
export const RETRY_INTERVAL_MS_DEFAULT = 20_000

/** Default wall-clock budget for one pull-request reconciliation. */
export const MAX_DURATION_MS_DEFAULT = 110 * 60 * 1000

/**
 * Named convergence contract. These are behavior flags, not evidence that a
 * live pull request has already converged.
 */
export const CONVERGENCE_FLAGS = Object.freeze({
  RETRY_UNTIL_ALL_16_POSTED: 'YES',
  ALL_16_CONTEXTS_TERMINAL: 'YES',
  CURRENT_HEAD_ONLY: 'YES',
  OLD_HEAD_CAN_OVERRIDE_NEW_HEAD: 'NO',
  BOUNDED_TIMEOUT: 'YES',
})

/**
 * Fast-path jobs Merge Authority runs when CI paths-ignore skips ci.yml.
 * The publisher only reads them. It does not re-execute them.
 */
const FAST_PATH_JOB_NAMES = {
  'governance-integrity': 'Governance integrity when CI is skipped',
  'repository-inventory': 'Repository inventory when CI is skipped',
  'iac-scan': 'IaC security when CI is skipped',
  'ops-pack-validation': 'Ops documentation when CI is skipped',
}

const ATTEMPT_CAP = 10_000

export function requiredContextNames() {
  return [...CANONICAL_CONTEXTS.map((context) => context.name), ...SECRET_AUTHORITY_CONTEXTS]
}

export function retryIntervalMs(value = process.env.MA_POLL_INTERVAL_MS) {
  if (value == null || value === '') return RETRY_INTERVAL_MS_DEFAULT
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return RETRY_INTERVAL_MS_DEFAULT
  return parsed
}

export function maxDurationMs(value = process.env.MA_POLL_TIMEOUT_MS) {
  if (value == null || value === '') return MAX_DURATION_MS_DEFAULT
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return MAX_DURATION_MS_DEFAULT
  return parsed
}

/**
 * Finite reconciliation attempts. An explicit MA_POLL_MAX_ATTEMPTS wins.
 * Otherwise the budget is one attempt plus one per full retry interval that
 * fits in the maximum duration. A zero interval cannot create an unnamed loop:
 * it is still capped by the duration expressed in milliseconds, then by
 * ATTEMPT_CAP.
 */
export function maxReconciliationAttempts(
  interval = retryIntervalMs(),
  duration = maxDurationMs(),
  explicit = process.env.MA_POLL_MAX_ATTEMPTS,
) {
  const parsed = Number(explicit)
  if (explicit != null && explicit !== '' && Number.isFinite(parsed) && parsed >= 1) {
    return Math.min(Math.floor(parsed), ATTEMPT_CAP)
  }
  const step = interval > 0 ? interval : 1
  const span = Number.isFinite(duration) && duration >= 0 ? duration : MAX_DURATION_MS_DEFAULT
  return Math.min(ATTEMPT_CAP, Math.floor(span / step) + 1)
}

export class RequiredContextsTimeoutError extends Error {
  constructor(missing, attempt) {
    const names = [...missing]
    super(`timed out waiting for required contexts: ${names.join(', ')}`)
    this.name = 'RequiredContextsTimeoutError'
    this.missing = names
    this.attempt = attempt
  }
}

export class RequiredContextsCancelledError extends Error {
  constructor(missing, attempt) {
    const names = [...missing]
    super(`required check publication cancelled; still absent: ${names.join(', ')}`)
    this.name = 'RequiredContextsCancelledError'
    this.missing = names
    this.attempt = attempt
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function runOwnedByHead(runs, headSha) {
  const selected = selectRunForHead(runs, headSha)
  if (!selected || selected.head_sha !== headSha) return null
  return selected
}

function latestJob(jobs, name) {
  const matches = (Array.isArray(jobs) ? jobs : []).filter((job) => job && job.name === name)
  return matches.length === 0 ? null : matches[matches.length - 1]
}

/**
 * Authoritative means the job itself completed with success or failure, or
 * the owning workflow run for this head is already terminal. A conclusion
 * copied from a different head, or from a job that has not completed, is not
 * authoritative. null means keep waiting.
 */
function authoritativeConclusion(job, run) {
  if (job && job.status === 'completed' && (job.conclusion === 'success' || job.conclusion === 'failure')) {
    return job.conclusion
  }
  if (runIsTerminal(run)) {
    if (!job || job.conclusion == null || job.conclusion === '') return ''
    return String(job.conclusion)
  }
  return null
}

function verdictForContext(context, diffPaths, conclusion) {
  const results = { [context.ciJob]: conclusion }
  const verdict = evaluateCiResults(results, diffPaths).find((item) => item.name === context.name)
  if (!verdict) throw new Error(`missing authority context ${context.name}`)
  if (verdict.applicability === 'REQUIRES_EXECUTION' && verdict.conclusion === 'success' && verdict.evidence !== 'PASS') {
    throw new Error(`unexecuted context cannot be success: ${context.name}`)
  }
  return verdict
}

function checkBody(verdict, headSha) {
  const body = verdictToCheckRun(verdict, headSha)
  if (body.head_sha !== headSha) {
    throw new Error(`refusing to publish ${body.name} for ${body.head_sha}; this run owns ${headSha}`)
  }
  return body
}

async function postNamedCheck(body, github) {
  if (github && typeof github.createCheckRun === 'function') {
    await github.createCheckRun(body)
    return true
  }
  return publishBody(body)
}

/**
 * Reconcile the frozen head until all 16 required contexts are terminal, or
 * fail closed. NOT_APPLICABLE is posted on the first attempt. REQUIRES_EXECUTION
 * waits for that context's authoritative job and does not dispatch a new run.
 * Each call is independent: a cancelled process does not have to stay alive
 * for a later call, with the same head and the same job evidence, to finish.
 */
export async function convergeRequiredChecks({
  headSha,
  diffPaths,
  github,
  now = () => Date.now(),
  sleep = defaultSleep,
  signal,
  intervalMs = retryIntervalMs(),
  maxDurationMs: durationMs = maxDurationMs(),
  maxAttempts = maxReconciliationAttempts(intervalMs, durationMs),
}) {
  const head = publicationTarget(headSha, headSha)
  if (!Array.isArray(diffPaths)) throw new Error('diff paths must be an array when provided')
  if (!github || typeof github.listWorkflowRuns !== 'function' || typeof github.listRunJobs !== 'function') {
    throw new Error('a github client is required to reconcile required checks')
  }
  const names = requiredContextNames()
  if (names.length !== 16 || new Set(names).size !== 16) {
    throw new Error(`expected 16 required contexts, got ${names.length}`)
  }
  const started = now()
  const posted = new Map()
  let sleeps = 0

  function missingNames() {
    return names.filter((name) => !posted.has(name))
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) throw new RequiredContextsCancelledError(missingNames(), attempt)
    const classification = classifyChangedPaths(diffPaths)
    const ciSkipped = classification.ciSkippedByPathsIgnore
    const needsFastPath =
      ciSkipped &&
      CANONICAL_CONTEXTS.some(
        (context) =>
          classification.contexts[context.name] === 'REQUIRES_EXECUTION' && FAST_PATH_JOB_NAMES[context.ciJob],
      )

    const secretRun = runOwnedByHead(await github.listWorkflowRuns('secret-scan.yml', head), head)
    const secretJobs = secretRun ? await github.listRunJobs(secretRun.id) : []
    let ciRun = null
    let ciJobs = []
    if (!ciSkipped) {
      ciRun = runOwnedByHead(await github.listWorkflowRuns('ci.yml', head), head)
      if (ciRun) ciJobs = await github.listRunJobs(ciRun.id)
    }
    let fastRun = null
    let fastJobs = []
    if (needsFastPath) {
      fastRun = runOwnedByHead(await github.listWorkflowRuns('merge-authority.yml', head), head)
      if (fastRun) fastJobs = await github.listRunJobs(fastRun.id)
    }

    let terminalVerdicts = null
    if (!ciSkipped && runIsTerminal(ciRun)) {
      const jobs = ciJobs
      const results = ciResultsFromJobs(jobs)
      terminalVerdicts = evaluateCiResults(results, diffPaths)
    }

    const ready = []
    for (const context of CANONICAL_CONTEXTS) {
      if (posted.has(context.name)) continue
      if (classification.contexts[context.name] === 'NOT_APPLICABLE') {
        ready.push(checkBody(verdictForContext(context, diffPaths, ''), head))
        continue
      }
      if (terminalVerdicts) {
        const verdict = terminalVerdicts.find((item) => item.name === context.name)
        if (!verdict) throw new Error(`missing authority context ${context.name}`)
        ready.push(checkBody(verdict, head))
        continue
      }
      if (ciSkipped) {
        const fastName = FAST_PATH_JOB_NAMES[context.ciJob]
        if (!fastName) {
          ready.push(checkBody(verdictForContext(context, diffPaths, ''), head))
          continue
        }
        const conclusion = authoritativeConclusion(latestJob(fastJobs, fastName), fastRun)
        if (conclusion === null) continue
        ready.push(checkBody(verdictForContext(context, diffPaths, conclusion), head))
        continue
      }
      const jobName = CI_AUTHORITY_JOBS.find((job) => job.id === context.ciJob)?.name
      if (!jobName) throw new Error(`missing authority job for ${context.name}`)
      const conclusion = authoritativeConclusion(latestJob(ciJobs, jobName), ciRun)
      if (conclusion === null) continue
      ready.push(checkBody(verdictForContext(context, diffPaths, conclusion), head))
    }

    for (const name of SECRET_AUTHORITY_CONTEXTS) {
      if (posted.has(name)) continue
      const conclusion = authoritativeConclusion(latestJob(secretJobs, name), secretRun)
      if (conclusion === null) continue
      const publication = secretCheckPublications({ [name]: conclusion === '' ? 'missing' : conclusion }).find(
        (item) => item.name === name,
      )
      if (!publication) throw new Error(`missing secret publication ${name}`)
      if (publication.conclusion === 'success' && publication.evidence !== 'PASS') {
        throw new Error(`unexecuted secret context cannot be success: ${name}`)
      }
      ready.push({
        name: publication.name,
        head_sha: head,
        status: publication.status,
        conclusion: publication.conclusion,
        output: publication.output,
      })
    }

    for (const body of ready) {
      if (posted.has(body.name)) continue
      if (body.head_sha !== head) {
        throw new Error(`refusing to publish ${body.name} for ${body.head_sha}; this run owns ${head}`)
      }
      try {
        if (await postNamedCheck(body, github)) posted.set(body.name, body)
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
      }
    }

    process.stdout.write(
      `reconcile head=${head} attempt=${attempt}/${maxAttempts} posted=${posted.size}/16 missing=${missingNames().join(', ') || 'none'}\n`,
    )

    if (posted.size === names.length) {
      const checks = names.map((name) => posted.get(name))
      if (
        checks.some(
          (check) =>
            check.head_sha !== head ||
            check.status !== 'completed' ||
            (check.conclusion !== 'success' && check.conclusion !== 'failure'),
        )
      ) {
        throw new Error('required contexts were posted without a terminal conclusion')
      }
      return { attempts: attempt, sleeps, checks, headSha: head }
    }

    const missing = missingNames()
    const elapsed = now() - started
    if (signal?.aborted) throw new RequiredContextsCancelledError(missing, attempt)
    if (attempt >= maxAttempts || elapsed >= durationMs) {
      throw new RequiredContextsTimeoutError(missing, attempt)
    }
    await sleep(intervalMs)
    sleeps += 1
    if (signal?.aborted) throw new RequiredContextsCancelledError(missingNames(), attempt)
  }

  throw new RequiredContextsTimeoutError(missingNames(), maxAttempts)
}

async function publishPullRequest() {
  const headSha = capturedPublicationHead({
    sourceEvent: 'pull_request',
    workflowRunHeadSha: process.env.PR_HEAD_SHA,
    pullRequestHeadSha: process.env.PR_HEAD_SHA,
  })
  if (process.env.MA_CHANGED_PATHS === undefined) {
    throw new Error('MA_CHANGED_PATHS is required to publish pull request results')
  }
  const diffPaths = diffPathsFromEnv()
  await convergeRequiredChecks({
    headSha,
    diffPaths,
    github: {
      listWorkflowRuns,
      listRunJobs,
    },
    intervalMs: retryIntervalMs(),
    maxDurationMs: maxDurationMs(),
    maxAttempts: maxReconciliationAttempts(),
  })
}

async function publishSecretChecks(results, headSha) {
  const publications = secretCheckPublications(results)
  if (publications.length !== 3) {
    throw new Error(`expected 3 secret checks, got ${publications.length}`)
  }
  const missing = []
  for (const publication of publications) {
    if (publication.conclusion === 'success' && publication.evidence !== 'PASS') {
      throw new Error(`unexecuted secret context cannot be success: ${publication.name}`)
    }
    const posted = await publishBody({
      name: publication.name,
      head_sha: headSha,
      status: publication.status,
      conclusion: publication.conclusion,
      output: publication.output,
    })
    if (!posted) missing.push(publication.name)
  }
  if (missing.length > 0) throw new Error(`required checks still absent: ${missing.join(', ')}`)
}

async function publishWorkflowRun() {
  const headSha = capturedPublicationHead({
    sourceEvent: process.env.SOURCE_EVENT,
    workflowRunHeadSha: process.env.SOURCE_HEAD_SHA,
    pullRequestHeadSha: process.env.PR_HEAD_SHA,
  })
  if (process.env.SOURCE_EVENT === 'pull_request' && process.env.MA_CHANGED_PATHS === undefined) {
    throw new Error('MA_CHANGED_PATHS is required to publish workflow results for a pull request')
  }
  const jobs = await listRunJobs(process.env.SOURCE_RUN_ID)
  const workflowName = process.env.SOURCE_WORKFLOW_NAME
  if (workflowName === 'CI') {
    const diffPaths = process.env.SOURCE_EVENT === 'pull_request' ? diffPathsFromEnv() : undefined
    await publishVerdicts(evaluateCiResults(ciResultsFromJobs(jobs), diffPaths), headSha)
    return
  }
  if (workflowName === 'Secret Scan') {
    await publishSecretChecks(secretResultsFromJobs(jobs), headSha)
    return
  }
  throw new Error(`unexpected workflow ${workflowName || 'missing'}`)
}

async function publishCiResults() {
  const headSha = resolveHeadSha()
  if (process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.MA_CHANGED_PATHS === undefined) {
    throw new Error('MA_CHANGED_PATHS is required to publish CI results for a pull request')
  }
  const results = {}
  for (const [job, envName] of Object.entries(RESULT_ENV)) {
    const value = process.env[envName]
    if (value == null || value === '') {
      throw new Error(`${envName} is required`)
    }
    results[job] = value
  }
  const diffPaths = diffPathsFromEnv()
  await publishVerdicts(evaluateCiResults(results, diffPaths), headSha)
}

function classifyOutputs() {
  const plan = planFastPath(pathsFromStdin(readStdin()))
  const governance = plan.classification.contexts['Merge Authority / Governance Integrity']
  const inventory = plan.classification.contexts['Merge Authority / Repository Inventory']
  const iac = plan.classification.contexts['Merge Authority / IaC Security']
  const ops = plan.classification.contexts['Merge Authority / Ops Documentation']
  process.stdout.write(
    [
      `ci_skip=${plan.classification.ciSkippedByPathsIgnore ? 'true' : 'false'}`,
      `governance=${governance}`,
      `inventory=${inventory}`,
      `iac=${iac}`,
      `ops=${ops}`,
      `action=${plan.action}`,
    ].join('\n') + '\n',
  )
}

function invokedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(entry).href
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  const command = process.argv[2]
  if (command === 'classify-and-publish') {
    await classifyAndPublish()
  } else if (command === 'classify-outputs') {
    classifyOutputs()
  } else if (command === 'publish-ci-results') {
    await publishCiResults()
  } else if (command === 'publish-secret-terminals') {
    await publishSecretTerminals()
  } else if (command === 'publish-workflow-run') {
    await publishWorkflowRun()
  } else if (command === 'publish-pull-request') {
    await publishPullRequest()
  } else {
    process.stderr.write(
      'usage: publish.mjs classify-and-publish | publish-ci-results | publish-secret-terminals | publish-workflow-run | publish-pull-request\n',
    )
    process.exit(1)
  }
}
