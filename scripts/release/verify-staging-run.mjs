#!/usr/bin/env node
/**
 * Fail closed on a build-only staging workflow. GitHub run/job metadata is
 * independently fetched by the production workflow, never caller supplied.
 * This verifies job identity and outcome, NOT runtime deployment attestation.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function deny(message) { throw new Error('STAGING_RUN_DENIED: ' + message) }

export function verifyStagingRun(run, expectedCommit, expectedRunId) {
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit ?? '') ||
      !/^[1-9][0-9]*$/.test(String(expectedRunId ?? ''))) {
    deny('missing trusted commit or run coordinate')
  }
  if (!run || typeof run !== 'object' || Array.isArray(run) ||
      String(run.databaseId) !== String(expectedRunId) ||
      run.headSha !== expectedCommit ||
      run.headBranch !== 'main' ||
      run.workflowName !== 'Deploy Staging' ||
      run.event !== 'workflow_dispatch' ||
      run.conclusion !== 'success' ||
      run.status !== 'completed') {
    deny('staging workflow identity, dispatch or source commit mismatch')
  }
  // GitHub job history is not sufficient to bind a successful deployment
  // to a particular rerun attempt. Deny reruns pending per-attempt proof.
  if (run.attempt !== 1) deny('staging rerun lacks independently attributable deployment evidence')
  if (!Array.isArray(run.jobs)) deny('GitHub staging job evidence unavailable')
  const jobs = run.jobs.filter(job => job && job.name === 'Deploy to Staging')
  if (jobs.length !== 1 || jobs[0].status !== 'completed' ||
      jobs[0].conclusion !== 'success') {
    deny('no independently successful real staging deployment job')
  }
  return { runId: String(expectedRunId), commitSha: expectedCommit }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const run = JSON.parse(readFileSync(process.argv[2], 'utf8'))
    const result = verifyStagingRun(run, process.argv[3], process.argv[4])
    console.log('GitHub staging deployment job verified for ' + result.commitSha)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
