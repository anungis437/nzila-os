/**
 * Publishes canonical merge-authority check runs.
 *
 * classify-and-publish  reads newline-separated paths on stdin
 * publish-ci-results    reads MA_RESULT_* job results from the environment
 */
import { readFileSync } from 'node:fs'
import {
  CANONICAL_CONTEXTS,
  planFastPath,
  evaluateCiResults,
  verdictToCheckRun,
} from './surface.mjs'

const RESULT_ENV = {
  'lint-and-typecheck': 'MA_RESULT_LINT',
  test: 'MA_RESULT_UNIT',
  'schema-drift': 'MA_RESULT_SCHEMA',
  'sage-postgres-concurrency': 'MA_RESULT_RLS',
  'sage-live-postgres': 'MA_RESULT_MIGRATION',
  build: 'MA_RESULT_BUILD',
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

async function publishVerdicts(verdicts, headSha) {
  if (verdicts.length !== CANONICAL_CONTEXTS.length) {
    throw new Error(`expected ${CANONICAL_CONTEXTS.length} authority contexts, got ${verdicts.length}`)
  }
  const names = new Set(verdicts.map((verdict) => verdict.name))
  for (const context of CANONICAL_CONTEXTS) {
    if (!names.has(context.name)) throw new Error(`missing authority context ${context.name}`)
  }
  for (const verdict of verdicts) {
    await createCheckRun(verdictToCheckRun(verdict, headSha))
    process.stdout.write(`${verdict.name}: ${verdict.evidence}\n`)
  }
}

async function classifyAndPublish() {
  const headSha = process.env.HEAD_SHA
  const plan = planFastPath(pathsFromStdin(readStdin()))
  process.stdout.write(`${JSON.stringify({ action: plan.action, classification: plan.classification })}\n`)
  if (plan.action === 'DEFER_TO_CI') return
  await publishVerdicts(plan.verdicts, headSha)
}

async function publishCiResults() {
  const headSha = process.env.HEAD_SHA
  const results = {}
  for (const [job, envName] of Object.entries(RESULT_ENV)) {
    const value = process.env[envName]
    if (value == null || value === '') {
      throw new Error(`${envName} is required`)
    }
    results[job] = value
  }
  await publishVerdicts(evaluateCiResults(results), headSha)
}

const command = process.argv[2]
if (command === 'classify-and-publish') {
  await classifyAndPublish()
} else if (command === 'publish-ci-results') {
  await publishCiResults()
} else {
  process.stderr.write('usage: publish.mjs classify-and-publish | publish-ci-results\n')
  process.exit(1)
}
