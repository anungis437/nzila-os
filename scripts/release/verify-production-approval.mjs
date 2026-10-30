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
const matches = entry => Array.isArray(entry?.environments) &&
  entry.environments.some(e => String(e?.name ?? '').toLowerCase() === 'production')

export function verifyProductionApproval({environment,run,approvals,expectedRunId,expectedSha,now=new Date()}) {
  if (!/^[1-9][0-9]*$/.test(String(expectedRunId ?? '')) || !/^[0-9a-f]{40}$/i.test(expectedSha ?? '')) deny('invalid request coordinates')
  if (String(run?.id) !== String(expectedRunId) || run?.head_sha !== expectedSha ||
      run?.name !== 'Deploy Production' || !['push','workflow_dispatch'].includes(run?.event)) {
    deny('untrusted workflow run or source SHA')
  }
  if (environment?.name !== 'production' || !Array.isArray(environment.protection_rules)) {
    deny('no live production environment protection evidence')
  }
  // Undefined is NOT proof that privileged bypass is disabled.
  if (environment.can_admins_bypass !== false) deny('admin bypass is not demonstrably disabled')
  const rule=environment.protection_rules.find(p=>p?.type==='required_reviewers')
  const entitled=new Set((rule?.reviewers ?? []).filter(r=>r.type==='User')
    .map(r=>userName(r.reviewer)).filter(human))
  if (!entitled.size) deny('no individually verifiable required human reviewers')
  if (!Array.isArray(approvals)) deny('run approvals API unavailable')
  const initiators=new Set([userName(run.actor),userName(run.triggering_actor)].filter(Boolean))
  if (!userName(run.actor) || !userName(run.triggering_actor)) deny('run initiator not authenticated')
  const started=Date.parse(run.created_at ?? ''), end=now.getTime()
  if (!Number.isFinite(started) || started > end+300000) deny('invalid run time')
  const reviews=approvals.filter(matches).filter(a=>['approved','rejected'].includes(String(a?.state??'').toLowerCase()))
    .sort((a,b)=>Date.parse(a.created_at??'')-Date.parse(b.created_at??''))
  // Missing or malformed review IDs/timestamps cannot become durable approval receipts.
  if (reviews.some(a => !Number.isSafeInteger(a.id) || a.id <= 0 ||
      !Number.isFinite(Date.parse(a.created_at ?? '')))) deny('malformed environment review history')
  const last=reviews.at(-1)
  if (!last || String(last.state).toLowerCase()!=='approved') deny('no current approved environment review')
  const reviewer=userName(last.user), at=Date.parse(last.created_at ?? '')
  if (!human(reviewer) || !entitled.has(reviewer) || initiators.has(reviewer)) deny('approval is not by independent entitled human')
  if (!Number.isFinite(at) || at<started || at>end+300000 || end-at>7*86400000) deny('approval timestamp invalid or stale')
  return Object.freeze({
    verdict:'APPROVED',source:'github_environment_run_review_api',
    runId:String(expectedRunId),sourceSha:expectedSha,environment:'production',
    reviewer,approvalRef:String(last.id),reviewedAt:new Date(at).toISOString(),
  })
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [dir,runId,sha,receiptPath]=process.argv.slice(2)
    if (!dir || !runId || !sha) deny('missing input evidence')
    const load=n=>JSON.parse(readFileSync(join(dir,n),'utf8'))
    const proof=verifyProductionApproval({
      environment:load('environment.json'),run:load('run.json'),
      approvals:load('approvals.json'),expectedRunId:runId,expectedSha:sha,
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
