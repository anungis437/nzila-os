import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
const h=vi.hoisted(()=>({actor:vi.fn(),entitlement:vi.fn(),create:vi.fn(),change:vi.fn(),list:vi.fn(),tx:{owned:'transaction'}}))
vi.mock('@/lib/cases/case-authorization',()=>({getCaseActor:h.actor,caseAuthorizationResponse:(error:{code?:string})=>{
  const status=({AUTH_REQUIRED:401,FORBIDDEN:403,NOT_FOUND:404,VALIDATION_ERROR:400}as Record<string,number>)[error?.code??'']
  return status?new Response(JSON.stringify({error:error.code}),{status}):null
}}))
vi.mock('@/lib/db/with-rls-context',()=>({withRLSContext:async(fn:(tx:unknown)=>unknown)=>fn(h.tx)}))
vi.mock('@/services/platform-economics/entitlement-guard',()=>({requireEntitlement:h.entitlement}))
vi.mock('@/lib/api/authorization-denial',()=>({authorizationDenialResponse:()=>null}))
vi.mock('@/lib/logger',()=>({logger:{error:vi.fn()}}))
vi.mock('@/lib/cases/case-deadlines',()=>({createCaseDeadline:h.create,changeCaseDeadline:h.change,listCaseDeadlines:h.list}))
import { GET,POST,PATCH } from './route'
const context={params:Promise.resolve({caseId:'33333333-3333-4333-8333-333333333333'})}
const id='55555555-5555-4555-8555-555555555555'
const request=(body:unknown,method='POST')=>new Request('https://example.invalid/api/cases/owned/deadlines',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{vi.clearAllMocks();h.actor.mockResolvedValue({userId:'actor',organizationId:'org',role:'steward'});h.entitlement.mockResolvedValue(undefined);h.create.mockResolvedValue({created:true,deadline:{id}});h.change.mockResolvedValue({deadline:{id}});h.list.mockResolvedValue({deadlines:[],canManage:false})})
describe('governed case deadline HTTP boundary',()=>{
  it('returns only the scoped service answer inside the request transaction',async()=>{
    const r=await GET(new Request('https://example.invalid/api/cases/owned/deadlines'),context)
    expect(r.status).toBe(200);expect(await r.json()).toEqual({deadlines:[],canManage:false});expect(h.list).toHaveBeenCalledWith(h.tx,expect.objectContaining({userId:'actor'}),await context.params.then(x=>x.caseId))
  })
  it('requires authentication before calling a deadline service',async()=>{
    h.actor.mockRejectedValue(ApiError.unauthorized());expect((await POST(request({id,title:'Reply',dueDay:'2027-01-01'}),context)).status).toBe(401);expect(h.create).not.toHaveBeenCalled()
  })
  it.each([{id,title:'Reply',dueDay:'2027-02-30'},{id,title:'Reply',dueDay:'2027-01-01',organizationId:'forged-org'},{id,title:' ',dueDay:'2027-01-01'}])('rejects invalid and mass-assigned create bodies',async body=>{
    expect((await POST(request(body),context)).status).toBe(400);expect(h.create).not.toHaveBeenCalled()
  })
  it('distinguishes a new deadline from an idempotent existing one',async()=>{
    const body={id,title:'Reply',dueDay:'2027-01-01'}
    expect((await POST(request(body),context)).status).toBe(201);h.create.mockResolvedValue({created:false,deadline:{id}})
    expect((await POST(request(body),context)).status).toBe(200)
  })
  it('returns a real conflict status for stale versions and reused unique identifiers',async()=>{
    h.change.mockRejectedValue(ApiError.conflict('changed'));expect((await PATCH(request({id,version:'old',action:'complete'},'PATCH'),context)).status).toBe(409)
    h.create.mockRejectedValue({code:'23505'});expect((await POST(request({id,title:'Reply',dueDay:'2027-01-01'}),context)).status).toBe(409)
  })
  it('rejects a change without the observed server version',async()=>{
    expect((await PATCH(request({id,action:'cancel'},'PATCH'),context)).status).toBe(400);expect(h.change).not.toHaveBeenCalled()
  })
  it('does not return backend exception details as an HTTP failure body',async()=>{
    h.create.mockRejectedValue(new Error('private database diagnostic'))
    const r=await POST(request({id,title:'Reply',dueDay:'2027-01-01'}),context);expect(r.status).toBe(500);expect(await r.json()).toEqual({error:'INTERNAL_ERROR'})
  })
})
