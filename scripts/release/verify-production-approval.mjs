#!/usr/bin/env node
/**
 * Authoritative production approval verification. GitHub Environment YAML
 * alone cannot prove that review protection is configured or actually used.
 * Always run with authenticated GH API responses, never agent-supplied JSON.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function deny(msg) { throw new Error('PRODUCTION_APPROVAL_DENIED: ' + msg) }
const userName = v => typeof v?.login === 'string' ? v.login.toLowerCase() : null
const human = login => Boolean(login && !login.endsWith('[bot]') && login !== 'github-actions')
// Login names are mutable. Approval authority and self-review separation must
// also bind the immutable GitHub account ID supplied by authenticated APIs.
const identity = user => {
  const login = userName(user)
  return login && Number.isSafeInteger(user?.id) && user.id > 0 &&
    ['User', 'Bot'].includes(user?.type) ? { id: user.id, login } : null
}
const matches = entry => Array.isArray(entry?.environments) &&
  entry.environments.some(e => String(e?.name ?? '').toLowerCase() === 'production')

export function verifyProductionApproval({environment,run,approvals,expectedRunId,expectedSha,expectedWorkflowId,now=new Date()}) {
  if (!/^[1-9][0-9]*$/.test(String(expectedRunId ?? '')) ||
      !/^[1-9][0-9]*$/.test(String(expectedWorkflowId ?? '')) ||
      !/^[0-9a-f]{40}$/i.test(expectedSha ?? '')) deny('invalid request coordinates')
  // Display names can be duplicated across workflow files. Require the
  // immutable workflow ID independently resolved from deploy-production.yml.
  if (String(run?.id) !== String(expectedRunId) ||
      String(run?.workflow_id) !== String(expectedWorkflowId) ||
      run?.head_sha !== expectedSha || run?.name !== 'Deploy Production' ||
      !['push','workflow_dispatch'].includes(run?.event)) {
    deny('untrusted workflow run or source SHA')
  }
  // A completed, cancelled or merely queued historical workflow must not
  // mint a fresh production approval receipt. This verifier executes inside
  // the production deployment job after its Environment approval: GitHub
  // must still report that exact workflow run as actively in progress.
  if (run.status !== 'in_progress' || run.conclusion !== null) {
    deny('production workflow is not actively executing under approved environment')
  }
  // GitHub's run approvals API does not bind each approval to a run attempt.
  // A rerun must not reuse an approval granted to an earlier attempt.
  if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt !== 1) {
    deny('run attempt lacks independently attributable approval evidence')
  }
  // Manual dispatch must originate from the protected default branch. Signed
  // release-tag pushes have a separate ancestry/signature gate in the workflow.
  if (run.event === 'workflow_dispatch' && run.head_branch !== 'main') {
    deny('manual production dispatch is not from protected main')
  }
  const attemptStarted = Date.parse(run.run_started_at ?? '')
  if (!Number.isFinite(attemptStarted) ||
      attemptStarted < Date.parse(run.created_at ?? '') ||
      attemptStarted > now.getTime() + 300000) {
    deny('untrusted current run-attempt start time')
  }
  if (environment?.name !== 'production' || !Array.isArray(environment.protection_rules)) {
    deny('no live production environment protection evidence')
  }
  // Undefined is NOT proof that privileged bypass is disabled.
  if (environment.can_admins_bypass !== false) deny('admin bypass is not demonstrably disabled')
  const rule=environment.protection_rules.find(p=>p?.type==='required_reviewers')
  const entitled=new Map((rule?.reviewers ?? [])
    .filter(r => r?.type === 'User' && r.reviewer?.type === 'User')
    .map(r => identity(r.reviewer))
    .filter(v => v && human(v.login))
    .map(v => [v.id, v.login]))
  if (!entitled.size) deny('no individually verifiable required human reviewers')
  if (!Array.isArray(approvals)) deny('run approvals API unavailable')
  const actors=[identity(run.actor), identity(run.triggering_actor)]
  if (actors.some(v => !v)) deny('run initiator not authenticated')
  const initiatorIds=new Set(actors.map(v => v.id))
  const initiatorLogins=new Set(actors.map(v => v.login))
  const started=Date.parse(run.created_at ?? ''), end=now.getTime()
  if (!Number.isFinite(started) || started > end+300000) deny('invalid run time')
  // An unknown, withdrawn or pending production review must not disappear
  // from the chronology and resurrect an earlier approval. Treat every
  // production review record as security-relevant, not just approved entries.
  const reviews=approvals.filter(matches)
  if (reviews.some(a => !['approved','rejected'].includes(String(a?.state??'').toLowerCase()))) {
    deny('unrecognized production environment review state')
  }
  // Missing or malformed review IDs/timestamps cannot become durable approval receipts.
  if (reviews.some(a => !Number.isSafeInteger(a.id) || a.id <= 0 ||
      !Number.isFinite(Date.parse(a.created_at ?? '')))) deny('malformed environment review history')
  // GitHub review IDs are unique. Duplicate IDs or identical timestamp
  // ordering with conflicting records are not independently ordered evidence.
  if (new Set(reviews.map(a=>a.id)).size !== reviews.length) {
    deny('duplicate production environment review ID')
  }
  reviews.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at))
  if (reviews.some((a,i)=>i>0 && Date.parse(a.created_at)===Date.parse(reviews[i-1].created_at))) {
    deny('ambiguous production environment review chronology')
  }
  const last=reviews.at(-1)
  if (!last || String(last.state).toLowerCase()!=='approved') deny('no current approved environment review')
  const reviewerIdentity=identity(last.user), at=Date.parse(last.created_at ?? '')
  if (last.user?.type !== 'User' || !reviewerIdentity ||
      !human(reviewerIdentity.login) ||
      entitled.get(reviewerIdentity.id) !== reviewerIdentity.login ||
      initiatorIds.has(reviewerIdentity.id) ||
      initiatorLogins.has(reviewerIdentity.login)) {
    deny('approval is not by independent entitled human')
  }
  const reviewer=reviewerIdentity.login
  if (!Number.isFinite(at) || at<attemptStarted || at>end+300000 || end-at>7*86400000) deny('approval timestamp invalid or stale')
  return Object.freeze({
    verdict:'APPROVED',source:'github_environment_run_review_api',
    runId:String(expectedRunId),sourceSha:expectedSha,environment:'production',
    reviewer,approvalRef:String(last.id),reviewedAt:new Date(at).toISOString(),
  })
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [dir,runId,sha,receiptPath,workflowId]=process.argv.slice(2)
    if (!dir || !runId || !sha) deny('missing input evidence')
    const load=n=>JSON.parse(readFileSync(join(dir,n),'utf8'))
    const proof=verifyProductionApproval({
      environment:load('environment.json'),run:load('run.json'),
      approvals:load('approvals.json'),expectedRunId:runId,expectedSha:sha,
      expectedWorkflowId:workflowId,
    })
    if (!receiptPath) deny('durable approval receipt destination required')
    // Only a verified, minimally scoped result is retained. The raw GitHub
    // environment/review API payloads are not copied into deployment artifacts.
    writeFileSync(receiptPath, JSON.stringify({schemaVersion:1,...proof},null,2)+'\n',
      {flag:'wx',mode:0o600})
    console.log('Verified independent production approval: '+JSON.stringify(proof))
  } catch(error) {
    console.error(error.message)
    process.exitCode=1
  }
}
