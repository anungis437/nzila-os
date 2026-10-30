import { test } from 'node:test'
import assert from 'node:assert/strict'
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
