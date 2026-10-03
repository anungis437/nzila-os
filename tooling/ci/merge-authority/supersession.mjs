/**
 * Supersession of expensive CI work.
 *
 * CI and Secret Scan cancel the previous in-progress workflow run when a
 * newer pull-request commit arrives. Required-check publication is a
 * different workflow. Cancelling the expensive run does not cancel it, and
 * it does not re-run inventory, tests, contracts, or secret scans.
 *
 * Check runs are addressed only to the frozen head captured for that run.
 * An older run cannot retarget them at the pull request's new head.
 */
import { CANONICAL_CONTEXTS, SECRET_AUTHORITY_CONTEXTS, evaluateCiResults, verdictToCheckRun } from './surface.mjs'

export const EXPENSIVE_WORKFLOW_CONCURRENCY = {
  group: '${{ github.workflow }}-${{ github.ref }}',
  cancelInProgress: "${{ github.event_name == 'pull_request' }}",
}

export const EXPENSIVE_WORKFLOW_FILES = ['ci.yml', 'secret-scan.yml']

export const PUBLISHER_WORKFLOW_FILE = 'publish-required-checks.yml'

export const PUBLISHER_JOB_ID = 'publish-required-checks'

export const PUBLISHER_CONCURRENCY = {
  group: 'publish-required-checks-${{ github.event.pull_request.head.sha }}',
  cancelInProgress: false,
}

/**
 * Display names of the CI jobs that feed the 13 merge-authority contexts.
 * The publisher reads these names from the workflow-run jobs API. SARIF,
 * governance-gates, ML, and AI eval are not in this list.
 */
export const CI_AUTHORITY_JOBS = [
  { id: 'lint-and-typecheck', name: 'Lint & Typecheck' },
  { id: 'test', name: 'Unit Tests' },
  { id: 'schema-drift', name: 'Schema Drift Detection' },
  { id: 'sage-postgres-concurrency', name: 'SAGE PostgreSQL Concurrency and RLS' },
  { id: 'sage-live-postgres', name: 'SAGE Live PostgreSQL (records lifecycle)' },
  { id: 'build', name: 'Build All' },
  { id: 'contract-tests', name: 'Contract Tests (Architectural Invariants)' },
  { id: 'repository-inventory', name: 'Repository Inventory' },
  { id: 'governance-integrity', name: 'Governance Integrity' },
  { id: 'hash-chain-drift', name: 'Hash Chain Drift' },
  { id: 'operating-layer-gate', name: 'Operating Layer Gate' },
  { id: 'iac-scan', name: 'IaC Security Validation' },
  { id: 'ops-pack-validation', name: 'Ops Documentation Pack' },
]

export const MERGE_AUTHORITY_CONCURRENCY = {
  group: 'merge-authority-${{ github.event.pull_request.head.sha }}',
  cancelInProgress: false,
}

const EXECUTED_JOB_RESULTS = new Set(['success', 'failure'])

const TERMINAL_RUN_CONCLUSIONS = new Set([
  'success',
  'failure',
  'cancelled',
  'skipped',
  'timed_out',
  'neutral',
  'stale',
  'action_required',
  'startup_failure',
])

/**
 * The run that belongs to a frozen head is the one whose head_sha is that
 * commit. pull_requests[].head.sha on older runs is the pull request's live
 * head, so it must not be used to choose a run or a publication target.
 * When several runs share the head, the newest id is the one still in progress
 * or the rerun that replaced a cancelled attempt.
 */
export function selectRunForHead(runs, headSha) {
  if (typeof headSha !== 'string' || headSha.trim() === '') return null
  const matches = (Array.isArray(runs) ? runs : []).filter(
    (run) => run && run.head_sha === headSha && (run.event == null || run.event === 'pull_request'),
  )
  if (matches.length === 0) return null
  matches.sort((left, right) => (Number(right.id) || 0) - (Number(left.id) || 0))
  return matches[0]
}

export function runIsTerminal(run) {
  return Boolean(run) && run.status === 'completed' && TERMINAL_RUN_CONCLUSIONS.has(run.conclusion)
}

/**
 * The only head a run may publish to is the head captured for that run.
 * A different requested head is the new commit; refuse it.
 */
export function publicationTarget(runHeadSha, requestedHeadSha) {
  if (typeof runHeadSha !== 'string' || runHeadSha.trim() === '' || runHeadSha !== runHeadSha.trim()) {
    throw new Error('run head SHA is required')
  }
  if (requestedHeadSha != null && requestedHeadSha !== '' && requestedHeadSha !== runHeadSha) {
    throw new Error(`refusing to publish checks for ${requestedHeadSha}; this run owns ${runHeadSha}`)
  }
  return runHeadSha
}

/**
 * Pull-request publication uses the head SHA frozen on the triggering event.
 * A missing frozen head fails closed. This does not look up the pull request's
 * current head. The workflow-run list's pull_requests[].head.sha follows the
 * live head, so run selection must use each run's own head_sha.
 */
export function capturedPublicationHead({ sourceEvent, workflowRunHeadSha, pullRequestHeadSha }) {
  if (sourceEvent === 'pull_request') {
    if (
      typeof pullRequestHeadSha !== 'string' ||
      pullRequestHeadSha.trim() === '' ||
      pullRequestHeadSha !== pullRequestHeadSha.trim()
    ) {
      throw new Error('pull request head SHA is required; refusing to look up the live head')
    }
    return publicationTarget(pullRequestHeadSha, pullRequestHeadSha)
  }
  return publicationTarget(workflowRunHeadSha, workflowRunHeadSha)
}

function conclusionByJobName(jobs) {
  const byName = new Map()
  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!job || typeof job.name !== 'string') continue
    byName.set(job.name, job.conclusion == null ? '' : String(job.conclusion))
  }
  return byName
}

/** Map a CI workflow-run job list onto canonical job ids. Missing jobs stay empty. */
export function ciResultsFromJobs(jobs) {
  const byName = conclusionByJobName(jobs)
  const results = {}
  for (const job of CI_AUTHORITY_JOBS) {
    results[job.id] = byName.has(job.name) ? byName.get(job.name) : ''
  }
  return results
}

/** Map a Secret Scan job list onto the three required secret check names. */
export function secretResultsFromJobs(jobs) {
  const byName = conclusionByJobName(jobs)
  const results = {}
  for (const name of SECRET_AUTHORITY_CONTEXTS) {
    results[name] = byName.has(name) ? byName.get(name) || 'missing' : 'missing'
  }
  return results
}

/**
 * Secret-scan job names are the required checks. Success and failure are
 * already terminal on the job. Cancelled, skipped, and missing runs have not
 * executed; publish an explicit completed failure so the name is not left pending
 * and is not marked success.
 */
export function secretTerminalPublications(results) {
  const source = results && typeof results === 'object' ? results : {}
  const publications = []
  for (const name of SECRET_AUTHORITY_CONTEXTS) {
    const result = source[name]
    if (EXECUTED_JOB_RESULTS.has(result)) continue
    const evidence = result === 'cancelled' ? 'SUPERSEDED' : 'UNRESOLVED'
    publications.push({
      name,
      evidence,
      status: 'completed',
      conclusion: 'failure',
      output: {
        title: evidence,
        summary: [
          `evidence: ${evidence}`,
          `job result: ${result || 'missing'}`,
          'This secret scan did not execute. The check is terminal and is not success.',
        ].join('\n\n'),
      },
    })
  }
  return publications
}

/**
 * Always post the three secret checks onto the captured head. A cancelled
 * Secret Scan run may never create the job checks. Success stays success.
 * Failure stays failure. Cancelled, skipped, and missing are failure.
 */
export function secretCheckPublications(results) {
  const source = results && typeof results === 'object' ? results : {}
  return SECRET_AUTHORITY_CONTEXTS.map((name) => {
    const result = source[name]
    if (result === 'success' || result === 'failure') {
      const evidence = result === 'success' ? 'PASS' : 'FAILURE'
      return {
        name,
        evidence,
        status: 'completed',
        conclusion: result,
        output: {
          title: evidence,
          summary: `job result: ${result}`,
        },
      }
    }
    const evidence = result === 'cancelled' ? 'SUPERSEDED' : 'UNRESOLVED'
    return {
      name,
      evidence,
      status: 'completed',
      conclusion: 'failure',
      output: {
        title: evidence,
        summary: [
          `evidence: ${evidence}`,
          `job result: ${result || 'missing'}`,
          'This secret scan did not execute. The check is terminal and is not success.',
        ].join('\n\n'),
      },
    }
  })
}

/**
 * Terminal required checks for one captured head.
 * Applicable work that was cancelled or never ran is completed failure.
 * Proven NOT_APPLICABLE stays completed success. Pending is not a result.
 */
export function terminalChecksForHead({ results, diffPaths, secretResults, runHeadSha, requestedHeadSha }) {
  const head = publicationTarget(runHeadSha, requestedHeadSha)
  const mergeAuthority = evaluateCiResults(results, diffPaths).map((verdict) => verdictToCheckRun(verdict, head))
  const secrets = secretCheckPublications(secretResults).map((publication) => ({
    name: publication.name,
    head_sha: head,
    status: publication.status,
    conclusion: publication.conclusion,
    output: publication.output,
  }))
  const checks = [...mergeAuthority, ...secrets]
  if (checks.length !== CANONICAL_CONTEXTS.length + SECRET_AUTHORITY_CONTEXTS.length) {
    throw new Error(`expected 16 required checks, got ${checks.length}`)
  }
  if (secrets.some((check) => check.conclusion === 'success' && secretResults?.[check.name] !== 'success')) {
    throw new Error('unexecuted secret context cannot be success')
  }
  return checks
}
