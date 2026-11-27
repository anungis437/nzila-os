/** Disposable PostgreSQL proof of capability binding and actual writer/admission lock ordering; no provider or live environment. */
import { AUTH_BUSINESS_FUNCTION_CATALOG_QUERY, authBusinessFunctionViolations } from '@nzila/db/auth-storage-authority'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { installQueuedMailFixture } from '../auth/queued-case-mail-testkit'
import { QUEUED_CASE_MAIL_FUNCTION_CATALOG_QUERY, queuedCaseMailFunctionViolations } from '../auth/queued-case-mail'
import { issueQueuedCaseMailCapability, queuedCaseMailContext } from '../../lib/authority/store/queued-case-mail'
import { loadRelationships } from '../../lib/authority/store/facts'

const native=process.env.UE_QUEUED_MAIL_NATIVE==='1'?describe:describe.skip
native('queued case mail on disposable native PostgreSQL',()=>{
  const owner=randomUUID(),name=`ue-mail-authority-${owner}`,password=randomBytes(24).toString('hex')
  const org=randomUUID(),caseId=randomUUID(),actor='primary-handler',member='case-member',bearer='synthetic-native-session'
  let container:string|undefined,admin:pg.Client,worker:pg.Client,writer:pg.Client,runtime:pg.Client
  const opened:pg.Client[]=[]
  const adapt=(client:pg.Client)=>({exec:async(sql:string)=>client.query(sql),query:async<T=Record<string,unknown>>(sql:string,params:unknown[]=[])=>client.query(sql,params) as Promise<{rows:T[]}>})
  beforeAll(async()=>{
    container=execFileSync('docker',['run','-d','--pull','never','--name',name,'--label',`nzila.qualification-owner=${owner}`,
      '--tmpfs','/var/lib/postgresql/data:rw,size=512m','--memory','768m','--cpus','2','-p','127.0.0.1::5432','-e',`POSTGRES_PASSWORD=${password}`,
      'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'],{encoding:'utf8'}).trim()
    const port=Number(execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).trim().split(':').at(-1))
    for(let attempt=0;;attempt++){
      try{execFileSync('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'pipe'});break}
      catch(error){if(attempt>=60)throw error;await new Promise(resolve=>setTimeout(resolve,250))}
    }
    const connect=async()=>{const client=new pg.Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres'});await client.connect();opened.push(client);return client}
    admin=await connect();worker=await connect();writer=await connect();runtime=await connect()
    await installQueuedMailFixture(adapt(admin),{org,caseId,actor,member,sessionHash:createHash('sha256').update(bearer).digest('hex')})
  },60000)
  afterAll(async()=>{
    await Promise.allSettled(opened.map(client=>client.end()))
    if(container){
      const [inspection]=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))
      expect(inspection.Id).toBe(container);expect(inspection.Name).toBe('/'+name)
      expect(inspection.Config.Labels['nzila.qualification-owner']).toBe(owner)
      execFileSync('docker',['rm','-f',container],{stdio:'pipe'});container=undefined
    }
  },30000)
  const tenant=async<T>(fn:()=>Promise<T>)=>{
    await runtime.query('BEGIN;SET LOCAL ROLE union_eyes_runtime')
    try{
      await runtime.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)",[actor,org,bearer])
      const result=await fn();await runtime.query('COMMIT');return result
    }catch(error){await runtime.query('ROLLBACK');throw error}
  }
  const issue=async(caseTarget=caseId)=>{
    const queueId=randomUUID(),createdAt=new Date(),payload={purpose:'case_status_notification_v1',version:1,queueId,organizationId:org,
      caseId:caseTarget,queuedBy:actor,recipientId:member,previousStatus:'submitted',newStatus:'under_review',createdAt:createdAt.toISOString(),mail:null,authorityCapability:null}
    const capability=await tenant(async()=>{
      await runtime.query("INSERT INTO public.notification_queue VALUES($1,$2,$3,$4,'pending')",[queueId,org,payload,createdAt])
      const token=await issueQueuedCaseMailCapability(adapt(runtime),{queueId})
      await runtime.query('UPDATE public.notification_queue SET payload=$2 WHERE id=$1',[queueId,{...payload,authorityCapability:token,seal:'synthetic-app-seal'}])
      return token
    })
    return{queueId,capability}
  }
  const workerBegin=()=>worker.query('BEGIN;SET LOCAL ROLE union_eyes_system')
  const verify=(intent:{queueId:string;capability:string})=>queuedCaseMailContext(adapt(worker),intent)
  it('does not admit a runtime temporary-table counterfeit of canonical relationship facts',async()=>{
    const forged=randomUUID()
    await tenant(async()=>{
      await runtime.query('CREATE TEMP TABLE ue_authority_resource_relationships (LIKE public.ue_authority_resource_relationships INCLUDING DEFAULTS) ON COMMIT DROP')
      await runtime.query(`INSERT INTO pg_temp.ue_authority_resource_relationships(id,organization_id,principal_user_id,resource_type,resource_id,relation,origin,granted_by,effective_at)
        VALUES($1,$2,$3,'case',$4,'assignee','explicit','counterfeit-issuer',clock_timestamp()-interval '1 hour')`,[forged,org,actor,caseId])
      const rows=await loadRelationships(adapt(runtime),org,actor,'case',caseId)
      expect(rows.some(row=>row.id===forged)).toBe(false)
      expect(rows.some(row=>row.grantedBy==='assigner')).toBe(true)
    })
  })
  it('pins exact helper ownership and leaves both business roles without raw canonical membership access',async()=>{
    expect(authBusinessFunctionViolations((await admin.query(AUTH_BUSINESS_FUNCTION_CATALOG_QUERY)).rows)).toEqual([])
    expect(queuedCaseMailFunctionViolations((await admin.query(QUEUED_CASE_MAIL_FUNCTION_CATALOG_QUERY)).rows)).toEqual([])
    for(const role of ['union_eyes_runtime','union_eyes_system'])
      expect((await admin.query("SELECT has_table_privilege($1,'user_management.organization_users','SELECT') AS allowed",[role])).rows[0].allowed).toBe(false)
  })
  it('allows a current action and refuses capability/tenant/queue substitution or completed replay',async()=>{
    const first=await issue(),second=await issue()
    await workerBegin()
    try{
      expect(await verify(first)).toEqual({allowed:true,recipientEmail:'member@example.invalid',recipientLocale:'en-CA'})
      expect(await verify({...first,capability:second.capability})).toEqual({allowed:false,recipientEmail:null})
      expect(await verify({...first,queueId:randomUUID()})).toEqual({allowed:false,recipientEmail:null})
    }finally{await worker.query('ROLLBACK')}
    await admin.query("UPDATE public.notification_queue SET payload=jsonb_set(payload,'{organizationId}',to_jsonb($2::text)) WHERE id=$1",[first.queueId,randomUUID()])
    await workerBegin();try{expect(await verify(first)).toEqual({allowed:false,recipientEmail:null})}finally{await worker.query('ROLLBACK')}
    await admin.query("UPDATE public.notification_queue SET status='completed' WHERE id=$1",[second.queueId])
    await workerBegin();try{expect(await verify(second)).toEqual({allowed:false,recipientEmail:null})}finally{await worker.query('ROLLBACK')}
  })
  it('linearizes an admitted claim before a concurrent actual membership revocation writer',async()=>{
    const intent=await issue()
    const writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    await workerBegin()
    expect(await verify(intent)).toEqual({allowed:true,recipientEmail:'member@example.invalid',recipientLocale:'en-CA'})
    const revocation=writer.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1',[actor])
    for(let attempt=0;;attempt++){
      const row=(await admin.query('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1',[writerPid])).rows[0]
      if(row?.wait_event_type==='Lock'&&row.wait_event==='advisory')break
      if(attempt>=100)throw new Error('real membership writer failed to acquire shared authority lock')
      await new Promise(resolve=>setTimeout(resolve,10))
    }
    await worker.query('COMMIT');await revocation
    await workerBegin();try{expect(await verify(intent)).toEqual({allowed:false,recipientEmail:null})}finally{await worker.query('ROLLBACK')}
    await admin.query('UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1',[actor])
  })
  it('denies admission when the concurrent revocation commits first',async()=>{
    const intent=await issue(),workerPid=(await worker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    await writer.query('BEGIN');await writer.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1',[actor])
    await workerBegin();const admission=verify(intent)
    for(let attempt=0;;attempt++){
      const row=(await admin.query('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1',[workerPid])).rows[0]
      if(row?.wait_event_type==='Lock'&&row.wait_event==='advisory')break
      if(attempt>=100)throw new Error('verifier failed to share actual revocation-writer lock')
      await new Promise(resolve=>setTimeout(resolve,10))
    }
    await writer.query('COMMIT');expect(await admission).toEqual({allowed:false,recipientEmail:null});await worker.query('ROLLBACK')
    await admin.query('UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1',[actor])
  })
  it('captures current validity after waiting behind a real case writer past relationship expiry',async()=>{
    const target=randomUUID()
    const rule=(await admin.query("SELECT id FROM public.ue_authority_issuance_rules WHERE domain='case_assignment' AND status='active' LIMIT 1")).rows[0].id
    await admin.query('BEGIN')
    await admin.query("SELECT set_config('app.current_user_id','assigner',true),set_config('app.current_org_id',$1,true)",[org])
    await admin.query("INSERT INTO public.claims VALUES($1,$2,$3,'under_review')",[target,org,member])
    const expires=(await admin.query(`INSERT INTO public.ue_authority_resource_relationships(organization_id,principal_user_id,resource_type,resource_id,
      relation,origin,granted_by,issuance_rule_id,effective_at,expires_at)
      VALUES($1,$2,'case',$3,'assignee','explicit','assigner',$4,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '2 seconds') RETURNING expires_at`,[org,actor,target,rule])).rows[0].expires_at
    await admin.query(`INSERT INTO audit_logs(id,audit_id,created_at,updated_at,organization_id,action,details)
      SELECT gen_random_uuid(),gen_random_uuid(),clock_timestamp(),clock_timestamp(),$1,'authority.fixture',jsonb_build_object('authorityEventIds',jsonb_agg(id::text))
      FROM public.ue_authority_events WHERE organization_id=$1 AND txid=txid_current()`,[org])
    await admin.query('COMMIT')
    const intent=await issue(target),workerPid=(await worker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    await writer.query('BEGIN');await writer.query('UPDATE public.claims SET status=status WHERE claim_id=$1',[target])
    await workerBegin();const admission=verify(intent)
    for(let attempt=0;;attempt++){
      const row=(await admin.query('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1',[workerPid])).rows[0]
      if(row?.wait_event_type==='Lock'&&row.wait_event==='advisory')break
      if(attempt>=100)throw new Error('case writer and admission do not share the source lock')
      await new Promise(resolve=>setTimeout(resolve,10))
    }
    await admin.query("SELECT pg_sleep(GREATEST(0,extract(epoch FROM $1::timestamptz-clock_timestamp()))+0.05)",[expires])
    await writer.query('COMMIT')
    expect(await admission).toEqual({allowed:false,recipientEmail:null})
    await worker.query('ROLLBACK')
  })

  it.each(['raw','parent'] as const)('refuses mint after %s session authority expires during the same waiting statement',async(kind)=>{
    const queueId=randomUUID(),createdAt=new Date(),parentId=randomUUID()
    let expires:Date
    if(kind==='parent'){
      expires=(await admin.query(`INSERT INTO user_management.user_sessions(session_id,user_id,organization_id,session_token_hash,is_active,expires_at)
        VALUES($1,$2,$3,$4,true,clock_timestamp()+interval '2 seconds') RETURNING expires_at`,[parentId,actor,org,'f'.repeat(64)])).rows[0].expires_at
      await admin.query(`UPDATE user_management.user_sessions SET device_info=jsonb_build_object('purpose','business-org-binding','parentSessionId',$2::text),expires_at=clock_timestamp()+interval '1 hour' WHERE session_token_hash=$1`,[createHash('sha256').update(bearer).digest('hex'),parentId])
    }else{
      expires=(await admin.query("UPDATE user_management.user_sessions SET expires_at=clock_timestamp()+interval '2 seconds' WHERE session_token_hash=$1 RETURNING expires_at",[createHash('sha256').update(bearer).digest('hex')])).rows[0].expires_at
    }
    await runtime.query('BEGIN;SET LOCAL ROLE union_eyes_runtime')
    try{
      await runtime.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)",[actor,org,bearer])
      const payload={purpose:'case_status_notification_v1',version:1,queueId,organizationId:org,caseId,queuedBy:actor,recipientId:member,
        previousStatus:'submitted',newStatus:'under_review',createdAt:createdAt.toISOString(),mail:null,authorityCapability:null}
      await runtime.query("INSERT INTO public.notification_queue VALUES($1,$2,$3,$4,'pending')",[queueId,org,payload,createdAt])
      await writer.query('BEGIN')
      await writer.query('UPDATE user_management.user_sessions SET is_active=is_active WHERE user_id=$1',[actor])
      const runtimePid=(await runtime.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
      const mint=issueQueuedCaseMailCapability(adapt(runtime),{queueId}).then(value=>({value}),error=>({error}))
      for(let attempt=0;;attempt++){
        const row=(await admin.query('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1',[runtimePid])).rows[0]
        if(row?.wait_event_type==='Lock'&&row.wait_event==='advisory')break
        if(attempt>=100)throw new Error('mint did not wait on actual session lifecycle writer lock')
        await new Promise(resolve=>setTimeout(resolve,10))
      }
      await admin.query("SELECT pg_sleep(GREATEST(0,extract(epoch FROM $1::timestamptz-clock_timestamp()))+0.05)",[expires])
      await writer.query('COMMIT')
      const result=await mint
      expect(result).toHaveProperty('error');expect(String((result as {error:unknown}).error)).toContain('QUEUED_MAIL_MINT_DENIED')
    }finally{
      await writer.query('ROLLBACK');await runtime.query('ROLLBACK')
      await admin.query("UPDATE user_management.user_sessions SET device_info='{}',expires_at=clock_timestamp()+interval '1 hour' WHERE session_token_hash=$1",[createHash('sha256').update(bearer).digest('hex')])
      if(kind==='parent')await admin.query('DELETE FROM user_management.user_sessions WHERE session_id=$1',[parentId])
    }
    expect((await admin.query('SELECT id FROM public.ue_authority_requests WHERE idempotency_key=$1',[queueId])).rows).toHaveLength(0)
  })

})
