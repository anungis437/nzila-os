import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { verifyProductionApproval } from './verify-production-approval.mjs'
const SHA='a'.repeat(40), NOW=new Date('2026-10-30T16:00:00Z')
function fixture() {
  return {
    environment:{
      name:'production',can_admins_bypass:false,
      protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{id:202,login:'security-reviewer',type:'User'}}]}],
    },
    run:{id:12345,workflow_id:67890,head_sha:SHA,name:'Deploy Production',event:'workflow_dispatch',
      status:'in_progress',conclusion:null,
      actor:{id:101,login:'developer',type:'User'},triggering_actor:{id:101,login:'developer',type:'User'},head_branch:'main',
      run_attempt:1,created_at:'2026-10-30T14:00:00Z',
      run_started_at:'2026-10-30T14:01:00Z'},
    approvals:[{id:890,state:'approved',user:{id:202,login:'security-reviewer',type:'User'},
      created_at:'2026-10-30T14:15:00Z',environments:[{name:'production'}]}],
    expectedRunId:'12345',expectedWorkflowId:'67890',expectedStagingRunId:'54321',expectedSha:SHA,now:NOW,
  }
}
test('only a distinct individually entitled human on same run is accepted',()=>{
  const receipt=verifyProductionApproval(fixture())
  assert.equal(receipt.verdict,'APPROVED')
  assert.equal(receipt.runId,'12345')
  assert.equal(receipt.workflowId,'67890')
  assert.equal(receipt.stagingRunId,'54321')
  assert.equal(receipt.runAttempt,1)
  assert.equal(receipt.reviewerId,202)
  assert.deepEqual(receipt.initiatorActorIds,[101])
})
test('production approval receipts require exact verified staging run coordinates',()=>{
  for (const invalid of [undefined,null,'','0','-1','1.5','other-run',0]) {
    const f=fixture();f.expectedStagingRunId=invalid
    assert.throws(()=>verifyProductionApproval(f),/invalid request coordinates/)
  }
})
test('unsafe, coercible and noncanonical GitHub run coordinates fail closed',()=>{
  for (const invalid of ['9007199254740992', '01', '1e3', ' 12345', -1, 1.5]) {
    const f=fixture();f.expectedRunId=invalid
    assert.throws(()=>verifyProductionApproval(f),/invalid request coordinates/)
  }
  for (const key of ['expectedWorkflowId','expectedStagingRunId']) {
    for (const invalid of ['9007199254740992','01','1e3']) {
      const f=fixture();f[key]=invalid
      assert.throws(()=>verifyProductionApproval(f),/invalid request coordinates/)
    }
  }
  for (const key of ['id','workflow_id']) {
    for (const invalid of ['12345',null,Number.MAX_SAFE_INTEGER+1]) {
      const f=fixture();f.run[key]=invalid
      assert.throws(()=>verifyProductionApproval(f),/untrusted numeric workflow identity/)
    }
  }
})
test('completed, cancelled, queued or otherwise inactive runs cannot mint approval receipts',()=>{
  for (const status of ['completed','cancelled','queued','waiting',undefined]) {
    const f=fixture();f.run.status=status
    assert.throws(()=>verifyProductionApproval(f),/not actively executing/)
  }
  for (const conclusion of ['success','failure','cancelled','skipped',undefined]) {
    const f=fixture();f.run.conclusion=conclusion
    assert.throws(()=>verifyProductionApproval(f),/not actively executing/)
  }
})
test('environment lacking reviewers is denied',()=>{
  const f=fixture();f.environment.protection_rules=[]
  assert.throws(()=>verifyProductionApproval(f),/required human reviewers/)
})
test('environment admin bypass or unavailable configuration fails closed',()=>{
  for (const v of [true,undefined]) {
    const f=fixture();f.environment.can_admins_bypass=v
    assert.throws(()=>verifyProductionApproval(f),/admin bypass/)
  }
})
test('self approval and automation cannot substitute for human review',()=>{
  for (const name of ['developer','github-actions[bot]']) {
    const f=fixture();f.approvals[0].user.login=name
    assert.throws(()=>verifyProductionApproval(f),/independent entitled human/)
  }
})
test('GitHub actor type must independently identify a human User, not a bot with a human-looking login',()=> {
  for (const type of ['Bot', 'Organization', undefined, null]) {
    const f=fixture()
    f.approvals[0].user.type=type
    assert.throws(()=>verifyProductionApproval(f),/independent entitled human/)
  }
})

test('production approval is bound to immutable reviewer and initiator account IDs',()=> {
  for (const mutate of [
    f => { f.approvals[0].user.id = 999 },
    f => { delete f.approvals[0].user.id },
    f => { f.approvals[0].user.id = '202' },
    f => { f.approvals[0].user.id = f.run.actor.id },
    f => { f.run.triggering_actor = { id:202, login:'other-login', type:'User' } },
    f => { f.approvals[0].user.login = 'renamed-reviewer' },
    f => { delete f.environment.protection_rules[0].reviewers[0].reviewer.id },
    f => { f.environment.protection_rules[0].reviewers[0].reviewer.type = 'Bot' },
  ]) {
    const f=fixture(); mutate(f)
    assert.throws(() => verifyProductionApproval(f), /PRODUCTION_APPROVAL_DENIED/)
  }
})
test('production run actors must have authenticated GitHub account IDs',()=> {
  for (const key of ['actor','triggering_actor']) {
    for (const id of [undefined,null,'101',0,-1]) {
      const f=fixture(); f.run[key].id=id
      assert.throws(() => verifyProductionApproval(f), /run initiator not authenticated/)
    }
  }
})
test('same-name workflow substitution and missing independently resolved workflow ID are denied',()=> {
  for (const mutate of [
    f => { f.run.workflow_id=99999 },
    f => { delete f.run.workflow_id },
    f => { f.run.workflow_id=null },
    f => { f.expectedWorkflowId='99999' },
    f => { delete f.expectedWorkflowId },
  ]) {
    const f=fixture(); mutate(f)
    assert.throws(()=>verifyProductionApproval(f),/PRODUCTION_APPROVAL_DENIED/)
  }
})
test('run substitution, wrong SHA and workflow substitution rejected',()=>{
  for (const key of ['head_sha','name','event']) {
    const f=fixture();f.run[key]='substituted'
    assert.throws(()=>verifyProductionApproval(f),/untrusted workflow/)
  }
  const f=fixture();f.expectedRunId='67890'
  assert.throws(()=>verifyProductionApproval(f),/untrusted workflow/)
})
test('rejection, stale review and staging review do not authorize production',()=>{
  for (const fn of [
    f=>{f.approvals[0].state='rejected'},
    f=>{f.approvals[0].created_at='2026-10-01T14:00:00Z'},
    f=>{f.approvals[0].environments=[{name:'staging'}]},
  ]) {
    const f=fixture();fn(f);assert.throws(()=>verifyProductionApproval(f),/PRODUCTION_APPROVAL_DENIED/)
  }
})

test('approval receipts require a real immutable GitHub review ID and timestamp',()=>{
  for (const invalid of [undefined, null, 0, -1, '890', 1.5]) {
    const f=fixture();f.approvals[0].id=invalid
    assert.throws(()=>verifyProductionApproval(f),/malformed environment review history/)
  }
  const f=fixture();f.approvals[0].created_at='not-a-date'
  assert.throws(()=>verifyProductionApproval(f),/malformed environment review history/)
})
test('unknown or withdrawn production review state cannot revive an earlier approval',()=> {
  for (const state of ['dismissed','pending','unknown',null]) {
    const f=fixture()
    f.approvals.push({
      id:891,state,user:{login:'security-reviewer'},
      created_at:'2026-10-30T14:16:00Z',environments:[{name:'production'}],
    })
    assert.throws(()=>verifyProductionApproval(f),/unrecognized production environment review state/)
  }
})

test('duplicate review IDs and simultaneous conflicting reviews are not trustworthy ordering',()=> {
  const duplicate=fixture()
  duplicate.approvals.push({
    ...duplicate.approvals[0],state:'rejected',
    created_at:'2026-10-30T14:16:00Z',
  })
  assert.throws(()=>verifyProductionApproval(duplicate),/duplicate production environment review ID/)

  const ambiguous=fixture()
  ambiguous.approvals.push({
    ...ambiguous.approvals[0],id:891,state:'rejected',
  })
  assert.throws(()=>verifyProductionApproval(ambiguous),/ambiguous production environment review chronology/)
})

test('both run actor and rerun triggering actor must be authenticated',()=>{
  for (const key of ['actor','triggering_actor']) {
    const f=fixture();f.run[key]=null
    assert.throws(()=>verifyProductionApproval(f),/run initiator not authenticated/)
  }
})

test('a rerun cannot reuse a prior attempt production approval',()=> {
  const f=fixture();f.run.run_attempt=2
  assert.throws(()=>verifyProductionApproval(f),/run attempt lacks independently attributable approval/)
})
test('manual dispatch from an unprotected feature branch is denied',()=> {
  const f=fixture();f.run.head_branch='feature/unsafe-release'
  assert.throws(()=>verifyProductionApproval(f),/not from protected main/)
})
test('missing or inconsistent current run-attempt start time is denied',()=> {
  for (const start of [undefined,'2026-10-30T13:00:00Z','2026-11-01T14:00:00Z']) {
    const f=fixture();f.run.run_started_at=start
    assert.throws(()=>verifyProductionApproval(f),/untrusted current run-attempt start time/)
  }
})

test('approval before the actual workflow attempt start cannot authorize deployment',()=> {
  const f=fixture()
  // The run exists, but the approval predates this attempt's authenticated start.
  f.approvals[0].created_at='2026-10-30T14:00:30Z'
  assert.throws(()=>verifyProductionApproval(f),/approval timestamp invalid or stale/)
})

test('CLI writes a minimal, non-overwritable receipt only after authenticated review',()=>{
  const dir=mkdtempSync(join(tmpdir(),'nzila-approval-'))
  try {
    const f=fixture(), now=Date.now()
    f.run.created_at=new Date(now-600000).toISOString()
    f.run.run_started_at=new Date(now-590000).toISOString()
    f.approvals[0].created_at=new Date(now-300000).toISOString()
    for (const name of ['environment','run','approvals']) {
      writeFileSync(join(dir,name+'.json'),JSON.stringify(f[name]))
    }
    const cli=fileURLToPath(new URL('./verify-production-approval.mjs',import.meta.url))
    const receipt=join(dir,'verified-approval.json')
    const args=[cli,dir,'12345',SHA,receipt,'67890','54321']
    const ok=spawnSync(process.execPath,args,{encoding:'utf8'})
    assert.equal(ok.status,0,ok.stderr)
    const saved=JSON.parse(readFileSync(receipt,'utf8'))
    assert.equal(saved.schemaVersion,1)
    assert.equal(saved.approvalRef,'890')
    assert.equal(saved.workflowId,'67890')
    assert.equal(saved.stagingRunId,'54321')
    assert.equal(saved.runAttempt,1)
    assert.equal(saved.reviewer,'security-reviewer')
    assert.equal(saved.reviewerId,202)
    assert.deepEqual(saved.initiatorActorIds,[101])
    assert.equal(saved.sourceSha,SHA)
    assert.equal('approvals' in saved,false)
    const replay=spawnSync(process.execPath,args,{encoding:'utf8'})
    assert.notEqual(replay.status,0,'receipt overwrite must be refused')
    f.approvals[0].user.login='developer'
    writeFileSync(join(dir,'approvals.json'),JSON.stringify(f.approvals))
    const denied=join(dir,'denied-approval.json')
    const failed=spawnSync(process.execPath,[cli,dir,'12345',SHA,denied,'67890','54321'],{encoding:'utf8'})
    assert.notEqual(failed.status,0,'self-approval must be rejected')
    assert.equal(existsSync(denied),false,'denied approval must leave no receipt')
  } finally { rmSync(dir,{recursive:true,force:true}) }
})
