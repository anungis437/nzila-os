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
// API run/workflow IDs are JSON integers, never coercible strings. CLI
// coordinates may be decimal text, but must remain exactly representable.
const safeCoordinate = value => typeof value === 'string' &&
  /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)) &&
  Number(value) > 0

export function verifyStagingRun(run, expectedCommit, expectedRunId, expectedWorkflowId) {
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit ?? '') ||
      !safeCoordinate(expectedRunId) ||
      !safeCoordinate(expectedWorkflowId)) {
    deny('missing trusted commit or run coordinate')
  }
  if (!run || typeof run !== 'object' || Array.isArray(run) ||
      !Number.isSafeInteger(run.databaseId) ||
      !Number.isSafeInteger(run.workflowDatabaseId) ||
      String(run.databaseId) !== String(expectedRunId) ||
      // A workflow display name is not a unique identity. Require the
      // workflow ID independently resolved from the canonical workflow file.
      String(run.workflowDatabaseId) !== String(expectedWorkflowId) ||
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
  // A green deployment job cannot replace independently completed source
  // governance, tests, build and attestation in the exact staging run.
  for (const name of ['Staging Pre-Deploy Gates', 'Build & Attest']) {
    const matches = run.jobs.filter(job => job?.name === name)
    if (matches.length !== 1 || matches[0].status !== 'completed' ||
        matches[0].conclusion !== 'success') {
      deny('staging prerequisite gate or artifact build did not independently complete')
    }
  }
  // A green prerequisite job can conceal skipped or continue-on-error
  // security steps. Require the actual GitHub step outcomes for the exact
  // staging run, including the gates that produce the signed artifact.
  const prerequisiteSteps = [
    ['Staging Pre-Deploy Gates', [
      'Emergency acknowledgement gate (manual dispatch only)',
      'Lint', 'Typecheck', 'Fast tests', 'Governance check',
      'Sync change records from main', 'Change window validation',
      'Contract tests', 'Migration safety gate', 'SLO gate',
    ]],
    ['Build & Attest', [
      'Build', 'Generate SBOM', 'Compute artifact digest',
      'Save artifact manifest', 'Generate build attestation',
      'Upload artifacts',
    ]],
  ]
  for (const [jobName, stepNames] of prerequisiteSteps) {
    const job = run.jobs.find(candidate => candidate?.name === jobName)
    if (!Array.isArray(job?.steps)) {
      deny('staging prerequisite step evidence unavailable for ' + jobName)
    }
    let previous = -1
    for (const stepName of stepNames) {
      const matches = job.steps.filter(step => step?.name === stepName)
      const index = job.steps.findIndex(step => step?.name === stepName)
      if (matches.length !== 1 || matches[0].status !== 'completed' ||
          matches[0].conclusion !== 'success' || index <= previous) {
        deny('staging prerequisite step missing, failed, duplicated or out of order: ' + stepName)
      }
      previous = index
    }
  }
  // A green job label is not proof that the deployment, boundary gate,
  // smoke checks and live runtime evidence steps actually executed. GitHub
  // job steps are fetched for this exact run by the promotion workflow.
  // This is still only workflow evidence, NOT independent runtime certification.
  const requiredSteps = [
    'Assert staging deployment identity is configured (fail-closed)',
    'Azure login (OIDC, staging-scoped)',
    'Staging boundary gate (fail-closed)',
    'Require real staging deployment implementation',
    'Run smoke tests',
    'Ingest Azure runtime evidence (live)',
  ]
  // GitHub returns steps in execution order; smoke before deploy or
  // runtime evidence before smoke cannot certify the deployed revision.
  let previousStep = -1
  if (!Array.isArray(jobs[0].steps) || requiredSteps.some(name => {
    const matches = jobs[0].steps.filter(step => step?.name === name)
    const index = jobs[0].steps.findIndex(step => step?.name === name)
    if (matches.length !== 1 || matches[0].status !== 'completed' ||
        matches[0].conclusion !== 'success' || index <= previousStep) return true
    previousStep = index
    return false
  })) {
    deny('staging deployment and live runtime verification steps did not independently complete in order')
  }
  return { runId: String(expectedRunId), commitSha: expectedCommit }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const run = JSON.parse(readFileSync(process.argv[2], 'utf8'))
    const result = verifyStagingRun(run, process.argv[3], process.argv[4], process.argv[5])
    console.log('GitHub staging deployment job verified for ' + result.commitSha)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
