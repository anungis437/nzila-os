import {beforeEach,describe,expect,it,vi} from 'vitest'
import {PgDialect} from 'drizzle-orm/pg-core'
import type {SQL} from 'drizzle-orm'
const caseId='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222'
const member='33333333-3333-4333-8333-333333333333',staff='44444444-4444-4444-8444-444444444444'
const m=vi.hoisted(()=>({actor:vi.fn(),find:vi.fn(),withRLS:vi.fn(),updateStatus:vi.fn(),proof:vi.fn(),scope:vi.fn(),mirror:vi.fn(),
 select:vi.fn(),insert:vi.fn(),update:vi.fn(),where:vi.fn(),insertValues:vi.fn(),audit:vi.fn(),executor:{query:vi.fn()},deps:{}}))
vi.mock('@/lib/api/framework',()=>({withApi:(_cfg:unknown,handler:(ctx:unknown)=>Promise<unknown>)=>(request:Request,ctx:{params?:object}={})=>handler({request,userId:'44444444-4444-4444-8444-444444444444',organizationId:'22222222-2222-4222-8222-222222222222',params:ctx.params??{caseId:'11111111-1111-4111-8111-111111111111'}})}))
vi.mock('@/lib/cases/case-authorization',()=>({getCaseActor:m.actor,findReadableCase:m.find}))
vi.mock('@/lib/db/with-rls-context',()=>({withRLSContext:m.withRLS}))
vi.mock('@/lib/authority/store/route-adapter',()=>({drizzleExecutor:()=>m.executor,kernelDeps:m.deps}))
vi.mock('@/lib/authority/store/case-scope',()=>({ensureCaseAuthorityScope:m.scope,bindCaseGrievanceMirror:m.mirror}))
vi.mock('@/lib/workflow-engine',()=>({updateClaimStatusById:m.updateStatus}))
vi.mock('@/lib/audit/atomic-audit',()=>({persistAtomicAudit:m.audit}))
vi.mock('@nzila/decision-core',()=>({enforceDecision:m.proof}))
vi.mock('@nzila/nar',()=>({createNarProofAdapter:vi.fn(),getNarSigningSecret:vi.fn()}))
vi.mock('@nzila/db/platform',()=>({platformDb:{}}))
const {POST}=await import('../cases/[caseId]/escalate/route')
const request=()=>new Request(`http://localhost/api/cases/${caseId}/escalate`,{method:'POST',body:JSON.stringify({notes:'private legal reason',priority:'high'})})
const baseClaim={claimId:caseId,id:'internal',organizationId:org,status:'investigation',claimType:'grievance_pay',
 description:'Verified member submission',priority:'medium',memberId:member,claimNumber:'CLM-1',metadata:{}}
function selection(rows:unknown[]){
 const chain={limit:(_n:number)=>chain,for:vi.fn(async()=>rows),then:(yes:(v:unknown)=>unknown,no?:(e:unknown)=>unknown)=>Promise.resolve(rows).then(yes,no)}
 return {from:()=>({where:(condition:unknown)=>{m.where(condition);return chain}})}
}
const tx={select:m.select,insert:m.insert,update:m.update}
beforeEach(()=>{
 vi.clearAllMocks();m.actor.mockResolvedValue({userId:staff,organizationId:org,role:'steward'})
 m.find.mockResolvedValue({claimId:caseId,organizationId:org,visibility:'internal'});m.scope.mockResolvedValue({});m.mirror.mockResolvedValue(undefined)
 m.proof.mockResolvedValue({allowed:true,decision:{id:'proof'}});m.updateStatus.mockResolvedValue({success:true});m.audit.mockResolvedValue(undefined)
 const rows:unknown[][]=[[baseClaim],[baseClaim],[]]
 m.select.mockImplementation(()=>selection(rows.shift()??[]))
 m.withRLS.mockImplementation(async fn=>fn(tx))
 m.insert.mockImplementation(()=>({values:(value:unknown)=>{m.insertValues(value);return {returning:async()=>[{id:caseId,grievanceNumber:'GRV-1'}],then:(yes:(v:unknown)=>unknown)=>Promise.resolve(undefined).then(yes)}}}))
 m.update.mockReturnValue({set:()=>({where:async()=>[]})})
})
describe('escalation preserves one logical kernel case',()=>{
 it('refuses a missing case reference',async()=>{expect((await POST(request(),{params:{}}) as Response).status).toBe(400)})
 it('refuses an unreadable case before a proof or write',async()=>{
  m.find.mockResolvedValueOnce(null);expect((await POST(request()) as Response).status).toBe(404)
  expect(m.proof).not.toHaveBeenCalled();expect(m.insert).not.toHaveBeenCalled()
 })
 it('binds canonical parent before creating a same-ID mirror, preserving actual member identity and restricted reasons',async()=>{
  const response=await POST(request())
  expect(response).toMatchObject({claim:{claimId:caseId},grievance:{id:caseId}})
  expect(m.find).toHaveBeenCalledWith(tx,expect.objectContaining({userId:staff,organizationId:org}),caseId,true,'case:transition')
  expect(m.scope).toHaveBeenCalledWith(m.executor,m.deps,{organizationId:org,caseId,actorUserId:staff})
  expect(m.insertValues.mock.calls[0][0]).toMatchObject({id:caseId,representedMemberUserId:member,createdBy:staff,organizationId:org})
  expect(m.insertValues.mock.calls[0][0]).not.toHaveProperty('grievantName')
  expect(m.insertValues.mock.calls[0][0]).not.toHaveProperty('grievantId')
  expect(m.mirror).toHaveBeenCalledWith(m.executor,m.deps,{organizationId:org,caseId,actorUserId:staff})
  expect(m.insertValues.mock.calls[1][0].notes).not.toContain('private legal reason')
  expect(m.audit).toHaveBeenCalledWith(tx,expect.objectContaining({details:expect.objectContaining({kernelIdentity:caseId,reason:'private legal reason'})}))
  expect(new PgDialect().sqlToQuery(m.where.mock.calls[0][0] as SQL).params).toEqual([caseId,org])
  expect(m.scope.mock.invocationCallOrder[0]).toBeLessThan(m.insert.mock.invocationCallOrder[0])
 })
 it('refuses an unrelated existing same-ID grievance without attaching, overwriting or granting scope',async()=>{
  m.select.mockReset();const rows=[[baseClaim],[baseClaim],[{id:caseId}]];m.select.mockImplementation(()=>selection(rows.shift()??[]))
  expect((await POST(request()) as Response).status).toBe(422)
  expect(m.scope).not.toHaveBeenCalled();expect(m.insert).not.toHaveBeenCalled();expect(m.updateStatus).not.toHaveBeenCalled()
 })
 it('rechecks the live relationship inside the locked mutation transaction',async()=>{
  m.find.mockResolvedValueOnce({claimId:caseId}).mockResolvedValueOnce(null)
  expect((await POST(request()) as Response).status).toBe(422);expect(m.insert).not.toHaveBeenCalled()
 })
 it('propagates failure to bind canonical provenance before any business insertion',async()=>{
  m.scope.mockRejectedValue(new Error('scope unavailable'))
  await expect(POST(request())).rejects.toThrow('scope unavailable');expect(m.insert).not.toHaveBeenCalled()
 })
 it('permits one result under serialized competing retries and never creates a second mirror',async()=>{
  const current={...baseClaim};let exists=false,tail=Promise.resolve()
  m.select.mockImplementation((projection?:unknown)=>selection(projection?(exists?[{id:caseId}]:[]):[{...current}]))
  m.withRLS.mockImplementation(async fn=>{const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve});await previous;try{return await fn(tx)}finally{release()}})
  m.insertValues.mockImplementation(()=>{exists=true})
  m.updateStatus.mockImplementation(async()=>{current.status='resolved';return {success:true}})
  const results=await Promise.all([POST(request()),POST(request())])
  expect(results.filter(v=>(v as Response).status===422 || (v as Response).status===400)).toHaveLength(1)
  expect(m.insertValues.mock.calls.filter(([v])=>v.id===caseId)).toHaveLength(1)
  expect(m.audit).toHaveBeenCalledTimes(1)
 })
 it('preserves a nonUUID canonical member principal without UUID/profile substitution',async()=>{
  const legacy={...baseClaim,memberId:'canonical-member-principal-opaque'}
  const rows=[[legacy],[legacy],[]];m.select.mockImplementation(()=>selection(rows.shift()??[]))
  await POST(request())
  expect(m.insertValues.mock.calls[0][0]).toMatchObject({representedMemberUserId:'canonical-member-principal-opaque'})
  expect(m.insertValues.mock.calls[0][0]).not.toHaveProperty('grievantId')
 })

})
