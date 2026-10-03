/**
 * Publishes canonical merge-authority check runs.
 *
 * classify-and-publish  reads newline-separated paths on stdin.
 *   DEFER_TO_CI posts proven NOT_APPLICABLE checks, then returns.
 *   REQUIRES_EXECUTION contexts are left to publish-ci-results.
 * publish-ci-results    reads MA_RESULT_* job results from the environment.
 *   MA_CHANGED_PATHS, when set, is the current diff. The reporter recomputes
 *   applicability from it and does not rewrite proven NOT_APPLICABLE contexts.
 * publish-pull-request  waits for the CI and Secret Scan runs of the frozen
 *   pull-request head, then posts that head's required checks.
 * publish-workflow-run  reads one completed CI or Secret Scan run's jobs.
 *   It posts only to the frozen head and does not re-run those jobs.
 */
import { readFileSync } from 'node:fs'
import {
  CANONICAL_CONTEXTS,
  classifyChangedPaths,
  planFastPath,
  evaluateCiResults,
  applyExecution,
  deferPublications,
  verdictToCheckRun,
} from './surface.mjs'
import {
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

async function createCheckRun(body) {
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!repository || !token) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required to publish checks')
  }
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
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`check run ${body.name} failed (${response.status}): ${detail.slice(0, 500)}`)
  }
}

function resolveHeadSha() {
  const runHead = process.env.MA_RUN_HEAD_SHA || process.env.HEAD_SHA
  return publicationTarget(runHead, process.env.HEAD_SHA || runHead)
}

async function publishCheckRuns(verdicts, headSha) {
  for (const verdict of verdicts) {
    await createCheckRun(verdictToCheckRun(verdict, headSha))
    process.stdout.write(`${verdict.name}: ${verdict.evidence}\n`)
  }
}

async function publishVerdicts(verdicts, headSha) {
  if (verdicts.length !== CANONICAL_CONTEXTS.length) {
    throw new Error(`expected ${CANONICAL_CONTEXTS.length} authority contexts, got ${verdicts.length}`)
  }
  const names = new Set(verdicts.map((verdict) => verdict.name))
  for (const context of CANONICAL_CONTEXTS) {
    if (!names.has(context.name)) throw new Error(`missing authority context ${context.name}`)
  }
  await publishCheckRuns(verdicts, headSha)
}

async function classifyAndPublish() {
  const headSha = resolveHeadSha()
  const plan = planFastPath(pathsFromStdin(readStdin()))
  process.stdout.write(`${JSON.stringify({ action: plan.action, classification: plan.classification })}\n`)
  if (plan.action === 'DEFER_TO_CI') {
    await publishCheckRuns(deferPublications(plan), headSha)
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
  for (const publication of secretTerminalPublications(results)) {
    if (publication.conclusion === 'success') {
      throw new Error(`unexecuted secret context cannot be success: ${publication.name}`)
    }
    await createCheckRun({
      name: publication.name,
      head_sha: headSha,
      status: publication.status,
      conclusion: publication.conclusion,
      output: publication.output,
    })
    process.stdout.write(`${publication.name}: ${publication.evidence}\n`)
  }
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

function pollIntervalMs() {
  const value = Number(process.env.MA_POLL_INTERVAL_MS ?? 20000)
  if (!Number.isFinite(value) || value < 0) return 20000
  return value
}

function pollTimeoutMs() {
  const value = Number(process.env.MA_POLL_TIMEOUT_MS ?? 110 * 60 * 1000)
  if (!Number.isFinite(value) || value <= 0) return 110 * 60 * 1000
  return value
}

async function waitForHeadRuns(headSha, diffPaths) {
  const ciSkipped = classifyChangedPaths(diffPaths).ciSkippedByPathsIgnore
  const deadline = Date.now() + pollTimeoutMs()
  const interval = pollIntervalMs()
  while (true) {
    const secretRun = selectRunForHead(await listWorkflowRuns('secret-scan.yml', headSha), headSha)
    const ciRun = ciSkipped ? null : selectRunForHead(await listWorkflowRuns('ci.yml', headSha), headSha)
    const secretReady = runIsTerminal(secretRun)
    const ciReady = ciSkipped || runIsTerminal(ciRun)
    process.stdout.write(
      `waiting head=${headSha} ci=${ciSkipped ? 'skipped-by-paths' : ciRun ? `${ciRun.status}/${ciRun.conclusion ?? 'pending'}` : 'missing'} secret=${secretRun ? `${secretRun.status}/${secretRun.conclusion ?? 'pending'}` : 'missing'}\n`,
    )
    if (ciReady && secretReady) return { ciSkipped, ciRun, secretRun }
    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for CI and Secret Scan runs for ${headSha}`)
    }
    if (interval > 0) await new Promise((resolve) => setTimeout(resolve, interval))
  }
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
  const { ciSkipped, ciRun, secretRun } = await waitForHeadRuns(headSha, diffPaths)
  if (!ciSkipped) {
    const jobs = await listRunJobs(ciRun.id)
    await publishVerdicts(evaluateCiResults(ciResultsFromJobs(jobs), diffPaths), headSha)
  }
  const secretJobs = await listRunJobs(secretRun.id)
  await publishSecretChecks(secretResultsFromJobs(secretJobs), headSha)
}

async function publishSecretChecks(results, headSha) {
  const publications = secretCheckPublications(results)
  if (publications.length !== 3) {
    throw new Error(`expected 3 secret checks, got ${publications.length}`)
  }
  for (const publication of publications) {
    if (publication.conclusion === 'success' && publication.evidence !== 'PASS') {
      throw new Error(`unexecuted secret context cannot be success: ${publication.name}`)
    }
    await createCheckRun({
      name: publication.name,
      head_sha: headSha,
      status: publication.status,
      conclusion: publication.conclusion,
      output: publication.output,
    })
    process.stdout.write(`${publication.name}: ${publication.evidence}\n`)
  }
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
