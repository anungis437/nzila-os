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
      protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{login:'security-reviewer'}}]}],
    },
    run:{id:12345,head_sha:SHA,name:'Deploy Production',event:'workflow_dispatch',
      actor:{login:'developer'},triggering_actor:{login:'developer'},created_at:'2026-10-30T14:00:00Z'},
    approvals:[{id:890,state:'approved',user:{login:'security-reviewer'},
      created_at:'2026-10-30T14:15:00Z',environments:[{name:'production'}]}],
    expectedRunId:'12345',expectedSha:SHA,now:NOW,
  }
}
test('only a distinct individually entitled human on same run is accepted',()=>{
  assert.equal(verifyProductionApproval(fixture()).verdict,'APPROVED')
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
test('both run actor and rerun triggering actor must be authenticated',()=>{
  for (const key of ['actor','triggering_actor']) {
    const f=fixture();f.run[key]=null
    assert.throws(()=>verifyProductionApproval(f),/run initiator not authenticated/)
  }
})

test('CLI writes a minimal, non-overwritable receipt only after authenticated review',()=>{
  const dir=mkdtempSync(join(tmpdir(),'nzila-approval-'))
  try {
    const f=fixture(), now=Date.now()
    f.run.created_at=new Date(now-600000).toISOString()
    f.approvals[0].created_at=new Date(now-300000).toISOString()
    for (const name of ['environment','run','approvals']) {
      writeFileSync(join(dir,name+'.json'),JSON.stringify(f[name]))
    }
    const cli=fileURLToPath(new URL('./verify-production-approval.mjs',import.meta.url))
    const receipt=join(dir,'verified-approval.json')
    const args=[cli,dir,'12345',SHA,receipt]
    const ok=spawnSync(process.execPath,args,{encoding:'utf8'})
    assert.equal(ok.status,0,ok.stderr)
    const saved=JSON.parse(readFileSync(receipt,'utf8'))
    assert.equal(saved.schemaVersion,1)
    assert.equal(saved.approvalRef,'890')
    assert.equal(saved.reviewer,'security-reviewer')
    assert.equal(saved.sourceSha,SHA)
    assert.equal('approvals' in saved,false)
    const replay=spawnSync(process.execPath,args,{encoding:'utf8'})
    assert.notEqual(replay.status,0,'receipt overwrite must be refused')
    f.approvals[0].user.login='developer'
    writeFileSync(join(dir,'approvals.json'),JSON.stringify(f.approvals))
    const denied=join(dir,'denied-approval.json')
    const failed=spawnSync(process.execPath,[cli,dir,'12345',SHA,denied],{encoding:'utf8'})
    assert.notEqual(failed.status,0,'self-approval must be rejected')
    assert.equal(existsSync(denied),false,'denied approval must leave no receipt')
  } finally { rmSync(dir,{recursive:true,force:true}) }
})
