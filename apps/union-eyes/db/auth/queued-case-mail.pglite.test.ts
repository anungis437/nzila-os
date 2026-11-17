import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { QUEUED_CASE_MAIL_OPERATION, QUEUED_CASE_MAIL_FUNCTION_CATALOG_QUERY, queuedCaseMailFunctionViolations } from './queued-case-mail'
import { installQueuedMailFixture } from './queued-case-mail-testkit'
import { issueQueuedCaseMailCapability, queuedCaseMailContext } from '../../lib/authority/store/queued-case-mail'

let pg: PGlite
const org = randomUUID(), caseId = randomUUID(), actor = 'primary-handler', member = 'case-member'
const bearer = 'synthetic-server-held-session'
const sessionHash = createHash('sha256').update(bearer).digest('hex')
const tokens = new Map<string,string>()
const connection = { query: async <T>(query:string, params:unknown[] = []) => pg.query<T>(query,params) }

beforeAll(async () => {
  pg = new PGlite()
  await installQueuedMailFixture(pg,{org,caseId,actor,member,sessionHash})
},30000)
afterAll(async()=>{await pg?.close()})

async function tenant<T>(fn:()=>Promise<T>):Promise<T>{
  await pg.exec('BEGIN;SET LOCAL ROLE union_eyes_runtime')
  try{
    await pg.query(`SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)`,[actor,org,bearer])
    const result=await fn();await pg.exec('COMMIT');return result
  }catch(error){await pg.exec('ROLLBACK');throw error}
}
async function context(queueId:string,capability:string){
  await pg.exec('BEGIN;SET LOCAL ROLE union_eyes_system')
  try{return await queuedCaseMailContext(connection,{queueId,capability})}finally{await pg.exec('ROLLBACK')}
}
async function issue(over:Record<string,unknown>={}){
  const queueId=randomUUID(),createdAt=new Date()
  const payload={purpose:'case_status_notification_v1',version:1,queueId,organizationId:org,caseId,queuedBy:actor,
    recipientId:member,previousStatus:'submitted',newStatus:'under_review',createdAt:createdAt.toISOString(),mail:null,authorityCapability:null,...over}
  const capability=await tenant(async()=>{
    await pg.query(`INSERT INTO public.notification_queue VALUES($1,$2,$3,$4,'pending')`,[queueId,org,payload,createdAt])
    const token=await issueQueuedCaseMailCapability(connection,{queueId})
    await pg.query(`UPDATE public.notification_queue SET payload=$2 WHERE id=$1`,[queueId,{...payload,authorityCapability:token,seal:'app-seal-tested-separately'}])
    return token
  })
  tokens.set(queueId,capability)
  return{queueId,capability}
}

describe('database-issued queued mail capability',()=>{
  it('admits only exact source-bound helper functions and execution ACLs',async()=>{
    const rows=(await pg.query<Record<string,unknown>>(QUEUED_CASE_MAIL_FUNCTION_CATALOG_QUERY)).rows
    expect(queuedCaseMailFunctionViolations(rows)).toEqual([])
    for(const change of [{body:'SELECT true'},{owner:'postgres'},{system_execute:true},{public_execute:true},{exact_acl:false}])
      expect(queuedCaseMailFunctionViolations(rows.map((row,index)=>index===0?{...row,...change}:row))).not.toEqual([])
  })
  it('mints under a real live session and revalidates the exact current action without direct identity grants',async()=>{
    const intent=await issue()
    expect(await context(intent.queueId,intent.capability)).toEqual({allowed:true,recipientEmail:'member@example.invalid'})
    const stored=(await pg.query<{request_hash:string;result:unknown}>('SELECT request_hash,result FROM public.ue_authority_requests WHERE idempotency_key=$1',[intent.queueId])).rows[0]
    expect(stored.request_hash).not.toBe(intent.capability)
    expect(JSON.stringify(stored)).not.toContain(intent.capability)
    for(const role of ['union_eyes_runtime','union_eyes_system'])expect((await pg.query<{readable:boolean}>("SELECT has_table_privilege($1,'user_management.users','SELECT') AS readable",[role])).rows[0].readable).toBe(false)
  })
  it('denies raw capability fabrication, derived assignment resurrection and system minting',async()=>{
    await expect(tenant(()=>pg.query(`INSERT INTO public.ue_authority_resource_relationships(organization_id,principal_user_id,resource_type,resource_id,relation,origin,effective_at) VALUES($1,$2,'case',$3,'owner','derived',now())`,[org,actor,randomUUID()]))).rejects.toThrow('ue_authority_rel_primary_origin_chk')
    await expect(tenant(()=>pg.query(`INSERT INTO public.ue_authority_requests(organization_id,idempotency_key,operation,request_hash,actor,result) VALUES($1,$2,$3,$4,$5,'{}')`,[org,randomUUID(),QUEUED_CASE_MAIL_OPERATION,'a'.repeat(64),actor]))).rejects.toThrow('only the session-bound mint')
    await pg.exec('BEGIN;SET LOCAL ROLE union_eyes_system')
    try{await expect(pg.query('SELECT public.ue_issue_queued_case_mail($1)',[randomUUID()])).rejects.toMatchObject({code:'42501'})}finally{await pg.exec('ROLLBACK')}
  })
  it('rejects queue/secret substitution, modified bindings and completed replay',async()=>{
    const first=await issue(),second=await issue()
    expect(await context(first.queueId,second.capability)).toEqual({allowed:false,recipientEmail:null})
    expect(await context(randomUUID(),first.capability)).toEqual({allowed:false,recipientEmail:null})
    await pg.query(`UPDATE public.notification_queue SET payload=jsonb_set(payload,'{recipientId}','"foreign-member"') WHERE id=$1`,[first.queueId])
    expect(await context(first.queueId,first.capability)).toEqual({allowed:false,recipientEmail:null})
    await pg.query("UPDATE public.notification_queue SET status='completed' WHERE id=$1",[second.queueId])
    expect(await context(second.queueId,second.capability)).toEqual({allowed:false,recipientEmail:null})
  })
  it('denies a committed membership revocation and rolls back an unaudited mint',async()=>{
    const intent=await issue()
    await pg.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1',[actor])
    expect(await context(intent.queueId,intent.capability)).toEqual({allowed:false,recipientEmail:null})
    await pg.query('UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1',[actor])
    const queueId=randomUUID(),createdAt=new Date(),payload={purpose:'case_status_notification_v1',queueId,organizationId:org,caseId,queuedBy:actor,recipientId:member,newStatus:'under_review',createdAt:createdAt.toISOString()}
    await expect(tenant(async()=>{
      await pg.query(`INSERT INTO public.notification_queue VALUES($1,$2,$3,$4,'pending')`,[queueId,org,payload,createdAt])
      await pg.query('SELECT public.ue_issue_queued_case_mail($1)',[queueId])
    })).rejects.toThrow('AUDIT_LINK_MISSING')
    expect((await pg.query('SELECT id FROM public.ue_authority_requests WHERE idempotency_key=$1',[queueId])).rows).toHaveLength(0)
  })
})
