/**
 * Supersession of expensive CI work.
 *
 * Workflow-level cancel-in-progress cancels the run, and a reporter that has
 * not started does not get to post. Cancellation is therefore per expensive
 * job. The reporter for a head stays in its own group and is not cancelled
 * when a newer commit supersedes that head's scans and tests.
 *
 * Check runs are addressed only to the run's captured head. An older run
 * cannot retarget them at the pull request's new head.
 */
import { CANONICAL_CONTEXTS, SECRET_AUTHORITY_CONTEXTS, evaluateCiResults, verdictToCheckRun } from './surface.mjs'

export const CI_EXPENSIVE_CONCURRENCY = {
  group: 'ci-${{ github.workflow }}-${{ github.ref }}-${{ github.job }}',
  cancelInProgress: "${{ github.event_name == 'pull_request' }}",
}

export const CI_REPORTER_JOB_ID = 'report-merge-authority'

export const CI_REPORTER_CONCURRENCY = {
  group: 'ci-report-${{ github.event.pull_request.head.sha || github.sha }}',
  cancelInProgress: false,
}

export const CI_REPORTER_IF = 'always()'

export const SECRET_EXPENSIVE_CONCURRENCY = {
  group: 'secret-scan-${{ github.workflow }}-${{ github.ref }}-${{ github.job }}',
  cancelInProgress: "${{ github.event_name == 'pull_request' }}",
}

export const SECRET_REPORTER_JOB_ID = 'report-secret-contexts'

export const SECRET_REPORTER_CONCURRENCY = {
  group: 'secret-scan-report-${{ github.event.pull_request.head.sha || github.sha }}',
  cancelInProgress: false,
}

export const SECRET_REPORTER_IF = 'always()'

export const MERGE_AUTHORITY_CONCURRENCY = {
  group: 'merge-authority-${{ github.event.pull_request.head.sha }}',
  cancelInProgress: false,
}

const EXECUTED_JOB_RESULTS = new Set(['success', 'failure'])

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
 * Terminal required checks for one captured head.
 * Applicable work that was cancelled or never ran is completed failure.
 * Proven NOT_APPLICABLE stays completed success. Pending is not a result.
 */
export function terminalChecksForHead({ results, diffPaths, secretResults, runHeadSha, requestedHeadSha }) {
  const head = publicationTarget(runHeadSha, requestedHeadSha)
  const mergeAuthority = evaluateCiResults(results, diffPaths).map((verdict) => verdictToCheckRun(verdict, head))
  const secrets = secretTerminalPublications(secretResults).map((publication) => ({
    name: publication.name,
    head_sha: head,
    status: publication.status,
    conclusion: publication.conclusion,
    output: publication.output,
  }))
  const executedSecretNames = new Set(
    SECRET_AUTHORITY_CONTEXTS.filter((name) => EXECUTED_JOB_RESULTS.has(secretResults?.[name])),
  )
  const executedSecrets = SECRET_AUTHORITY_CONTEXTS.filter((name) => executedSecretNames.has(name)).map((name) => ({
    name,
    head_sha: head,
    status: 'completed',
    conclusion: secretResults[name],
    output: {
      title: secretResults[name] === 'success' ? 'PASS' : 'FAILURE',
      summary: `job result: ${secretResults[name]}`,
    },
  }))
  const checks = [...mergeAuthority, ...secrets, ...executedSecrets]
  if (checks.length !== CANONICAL_CONTEXTS.length + SECRET_AUTHORITY_CONTEXTS.length) {
    throw new Error(`expected 16 required checks, got ${checks.length}`)
  }
  return checks
}
