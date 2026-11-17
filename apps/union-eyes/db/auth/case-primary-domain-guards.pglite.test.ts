import {decide} from '@/lib/authority/kernel'
import {loadAuthorityFacts} from '@/lib/authority/store/facts'
import {canonicalMembershipSource} from '@/lib/authority/store/identity'
import {loadCase} from '@/lib/authority/store/resources'
import type {Action,AuthorityRequest} from '@/lib/authority/ontology'
import { randomUUID } from 'node:crypto'
import { afterAll,beforeAll,describe,expect,it } from 'vitest'
import { caseDomainFixture } from '../__tests__/case-primary-domain-testkit'
import { CASE_DOMAIN_SUPPORT_CATALOG_QUERY,caseDomainSupportViolations,CASE_PRIMARY_DOMAIN_GUARDS,compileCaseDomainSupportSql } from './case-primary-domain-guards'
import { inspectPhysicalGuards,planPhysicalGuards } from './physical-guard-catalog'

const native=process.env.UE_CASE_DOMAIN_NATIVE==='1'
let f:Awaited<ReturnType<typeof caseDomainFixture>>
beforeAll(async()=>{f=await caseDomainFixture(native)},60000)
afterAll(async()=>{await f?.db.close()})
const reset=async()=>f.seed(()=>f.db.query("UPDATE public.claims SET status='under_review',closed_at=NULL WHERE claim_id=$1",[f.caseId]))
const change=async(user:string,next='investigation',withHistory=true,withAudit=true)=>f.tenant(user,async tx=>{
 await tx.query('UPDATE public.claims SET status=$2 WHERE claim_id=$1',[f.caseId,next])
 if(withHistory)await f.history(tx,user,'under_review',next)
 if(withAudit)await f.audit(tx,user,'case.transition','claims',f.caseId,{from:'under_review',to:next})
})

describe('case persistence boundary on canonical auth and forced RLS',()=>{
 it('admits only exact support ownership/body/ACL and refuses conflicting or duplicate journal installation',async()=>{
  const rows=(await f.db.query(CASE_DOMAIN_SUPPORT_CATALOG_QUERY)).rows
  expect(caseDomainSupportViolations(rows)).toEqual([])
  for(const mutation of [{body:'SELECT true'},{owner:'postgres'},{runtime_execute:false},{system_execute:true},{public_execute:true}])
   expect(caseDomainSupportViolations(rows.map((row,index)=>index===0?{...row,...mutation}:row))).not.toEqual([])
  await expect(f.db.exec(compileCaseDomainSupportSql())).rejects.toThrow('requires exact reconciliation')
  const execute=async(text:string)=>(await f.db.query(text)).rows as Record<string,unknown>[]
  expect(planPhysicalGuards(CASE_PRIMARY_DOMAIN_GUARDS,await inspectPhysicalGuards(CASE_PRIMARY_DOMAIN_GUARDS,execute)).statements).toEqual([])
 })
 it('allows the governed primary and denies unrelated staff, member titles and raw system calls',async()=>{
  expect(await f.allow(f.actor,'case:transition')).toBe(true)
  expect(await f.allow(f.actor,'case:close')).toBe(true)
  expect(await f.allow(f.actor,'case:assign')).toBe(false)
  expect(await f.allow('unrelated','case:transition')).toBe(false)
  expect(await f.allow(f.member,'case:transition')).toBe(false)
  await f.db.exec('BEGIN;SET LOCAL ROLE union_eyes_system')
  try{await expect(f.db.query('SELECT public.ue_case_domain_authorized($1,$2,$3)',[f.org,f.caseId,'case:transition'])).rejects.toMatchObject({code:'42501'})}finally{await f.db.exec('ROLLBACK')}
 })
 it('binds exact state-only public history to the actual protected journal with distinct logical/internal ids',async()=>{
  await reset();await change(f.actor)
  const journal=(await f.db.query<{id:string;claim_id:string;transaction_id:string}>('SELECT id,claim_id,transaction_id FROM public.claim_status_transitions ORDER BY changed_at DESC LIMIT 1')).rows[0]
  const history=(await f.db.query('SELECT claim_id,transition_id,message,metadata FROM public.claim_updates WHERE transition_id=$1',[journal.id])).rows[0]
  expect(f.internalId).not.toBe(f.caseId);expect(journal.claim_id).toBe(f.internalId);expect(journal.transaction_id).not.toBeNull()
  expect(history).toEqual({claim_id:f.internalId,transition_id:journal.id,message:"Status changed from 'under_review' to 'investigation'",metadata:{previousStatus:'under_review',newStatus:'investigation'}})
 })
 it('rolls state/journal/history back when mandatory history or audit is absent',async()=>{
  for(const [history,audit] of [[false,true],[true,false]]){
   await reset();const before=(await f.db.query('SELECT id FROM public.claim_status_transitions')).rows.length
   await expect(change(f.actor,'investigation',history,audit)).rejects.toThrow(history?'CASE_TRANSITION_AUDIT_REQUIRED':'CASE_TRANSITION_HISTORY_REQUIRED')
   expect((await f.db.query('SELECT status FROM public.claims WHERE claim_id=$1',[f.caseId])).rows[0].status).toBe('under_review')
   expect((await f.db.query('SELECT id FROM public.claim_status_transitions')).rows).toHaveLength(before)
  }
 })
 it('rejects fabricated safe-state text, metadata smuggling, duplicate projections and old journal replay',async()=>{
  await reset()
  await expect(f.tenant(f.actor,tx=>f.history(tx,f.actor,'submitted','under_review'))).rejects.toThrow('ACTUAL_CASE_TRANSITION_REQUIRED')
  await expect(f.tenant(f.actor,async tx=>{await tx.query("UPDATE public.claims SET status='investigation' WHERE claim_id=$1",[f.caseId]);await f.history(tx,f.actor,'under_review','investigation',{metadata:{previousStatus:'under_review',newStatus:'investigation',private:'strategy'}})})).rejects.toThrow('EXACT_STATE_PROJECTION_REQUIRED')
  await expect(f.tenant(f.actor,async tx=>{await tx.query("UPDATE public.claims SET status='investigation' WHERE claim_id=$1",[f.caseId]);await f.history(tx,f.actor);await f.history(tx,f.actor)})).rejects.toMatchObject({code:'23505'})
  const old=(await f.db.query<{id:string}>('SELECT id FROM public.claim_status_transitions LIMIT 1')).rows[0]
  await f.seed(()=>f.db.query("UPDATE public.claims SET status='investigation' WHERE claim_id=$1",[f.caseId]))
  await expect(f.tenant(f.actor,tx=>f.history(tx,f.actor,'under_review','investigation',{transitionId:old.id}))).rejects.toThrow('ACTUAL_CASE_TRANSITION_REQUIRED')
 })
 it('refuses ordinary raw status changes and primary-only closure/reopening without current source authority',async()=>{
  await reset();await expect(change('unrelated')).rejects.toThrow('CASE_TRANSITION_AUTHORITY_REQUIRED')
  await f.seed(async()=>{
   const rule=(await f.db.query<{id:string}>("SELECT id FROM public.ue_authority_issuance_rules WHERE domain='case_assignment' LIMIT 1")).rows[0].id
   await f.db.query(`INSERT INTO public.ue_authority_resource_relationships(organization_id,principal_user_id,resource_type,resource_id,relation,origin,granted_by,issuance_rule_id,permissions,effective_at)
    VALUES($1,'collaborator','case',$2,'collaborator','explicit','assigner',$3,ARRAY['read','read_internal','transition','comment','write_notes'],now()-interval '1 minute')`,[f.org,f.caseId,rule])
  })
  expect(await f.allow('collaborator','case:transition')).toBe(true)
  await change('collaborator');await reset()
  for(const status of ['closed','rejected'])await expect(change('collaborator',status)).rejects.toThrow('PRIMARY_CASE_HANDLER_REQUIRED')
  await change(f.actor,'rejected')
  await expect(f.tenant('collaborator',tx=>tx.query("UPDATE public.claims SET status='under_review' WHERE claim_id=$1",[f.caseId]))).rejects.toThrow('PRIMARY_CASE_HANDLER_REQUIRED')
 })
 it('does not miss hidden recusal facts, future lifts, or current adverse respondents',async()=>{
  await reset()
  await f.seed(()=>f.db.query(`INSERT INTO public.ue_authority_recusals(organization_id,principal_user_id,resource_type,resource_id,reason,declared_at,lifted_at,lifted_by) VALUES($1,$2,'case',$3,'conflict',now()-interval '1 day',NULL,NULL)`,[f.org,f.actor,f.caseId]))
  await expect(f.seed(()=>f.db.query("UPDATE public.ue_authority_recusals SET lifted_at=now()+interval '1 day',lifted_by='independent' WHERE organization_id=$1",[f.org]))).rejects.toThrow('ue_authority_recusal_finite_time_chk')
  expect((await f.tenant(f.actor,tx=>tx.query('SELECT id FROM public.ue_authority_recusals'))).rows).toEqual([])
  expect(await f.allow(f.actor,'case:transition')).toBe(false)
  await f.seed(()=>f.db.query('DELETE FROM public.ue_authority_recusals WHERE organization_id=$1',[f.org]))
  const scope=randomUUID()
  await f.seed(async()=>{await f.db.query('INSERT INTO public.case_authority_scopes(id,organization_id,case_id,claim_id) VALUES($1,$2,$3,$3)',[scope,f.org,f.caseId]);await f.db.query('INSERT INTO public.case_respondents(organization_id,scope_id,respondent_user_id) VALUES($1,$2,$3)',[f.org,scope,f.actor])})
  expect(await f.allow(f.actor,'case:transition')).toBe(false)
  await f.seed(()=>f.db.query('DELETE FROM public.case_respondents WHERE organization_id=$1',[f.org]))
 })
 it('requires live write authority for private notes, primary disclosure for staff public notes, and preserves own-member input',async()=>{
  await reset()
  const note=async(user:string,internal:boolean)=>f.tenant(user,async tx=>{const result=await f.history(tx,user,'','',{type:'note',message:'Own contribution',metadata:{},internal,visibility:internal?'staff':'member'});await f.audit(tx,user,'case.note.add','claim_updates',result.rows[0].id,{caseId:f.caseId})})
  await expect(note('unrelated',true)).rejects.toThrow('CASE_HISTORY_AUTHORITY_REQUIRED')
  await note('collaborator',true)
  await expect(note('collaborator',false)).rejects.toThrow('CASE_HISTORY_AUTHORITY_REQUIRED')
  await note(f.actor,false);await note(f.member,false)
  await expect(note(f.member,true)).rejects.toThrow('CASE_HISTORY_AUTHORITY_REQUIRED')
  await expect(f.tenant(f.actor,tx=>f.history(tx,f.actor,'','',{type:'note',message:'Forged actor',metadata:{},createdBy:f.member}))).rejects.toThrow('CASE_HISTORY_ACTOR_REQUIRED')
 })
 it('makes journal, actor/resource identity and historical projection references immutable',async()=>{
  await reset()
  await expect(f.tenant(f.actor,tx=>tx.query('UPDATE public.claims SET member_id=$2 WHERE claim_id=$1',[f.caseId,'other']))).rejects.toThrow('CASE_IDENTITY_IMMUTABLE')
  await expect(f.tenant(f.actor,tx=>tx.query("INSERT INTO public.claim_status_transitions(organization_id,claim_id,to_status) VALUES($1,$2,'closed')",[f.org,f.internalId]))).rejects.toMatchObject({code:'42501'})
  await expect(f.tenant(f.actor,tx=>tx.query("UPDATE public.claim_updates SET message='relabelled' WHERE claim_id=$1",[f.internalId]))).rejects.toThrow('CASE_HISTORY_IMMUTABLE')
 })

 it('requires primary authority for formal-grievance closure aliases and atomic status history/audit for ordinary changes',async()=>{
  const id=randomUUID(),rule=(await f.db.query<{id:string}>("SELECT id FROM public.ue_authority_issuance_rules WHERE domain='case_assignment' LIMIT 1")).rows[0].id
  await f.seed(async()=>{
   await f.db.query("INSERT INTO public.grievances(id,organization_id,created_by,represented_member_user_id,status) VALUES($1,$2,$3,$3,'filed')",[id,f.org,f.member])
   await f.db.query(`INSERT INTO public.ue_authority_resource_relationships(organization_id,principal_user_id,resource_type,resource_id,relation,origin,granted_by,issuance_rule_id,permissions,effective_at)
    VALUES($1,$2,'case',$3,'assignee','explicit','assigner',$4,ARRAY[]::text[],now()-interval '1 minute'),
    ($1,'collaborator','case',$3,'collaborator','explicit','assigner',$4,ARRAY['transition'],now()-interval '1 minute')`,[f.org,f.actor,id,rule])
  })
  const set=async(user:string,previous:string,next:string,history=true,audit=true)=>f.tenant(user,async tx=>{
   await tx.query('UPDATE public.grievances SET status=$2 WHERE id=$1',[id,next])
   if(history)await tx.query("INSERT INTO public.grievance_events(grievance_id,event_type,actor_user_id,notes) VALUES($1,'status_changed',$2,$3)",[id,user,`Status changed: ${previous} → ${next}`])
   if(audit)await f.audit(tx,user,'grievance.status_change','grievances',id,{previousState:{status:previous},newState:{status:next}})
  })
  await set('collaborator','filed','acknowledged')
  for(const status of ['closed','withdrawn','denied','closed_no_case','rejected'])await expect(set('collaborator','acknowledged',status)).rejects.toThrow('PRIMARY_CASE_HANDLER_REQUIRED')
  await expect(set(f.actor,'acknowledged','filed',false,true)).rejects.toThrow('GRIEVANCE_TRANSITION_HISTORY_AUDIT_REQUIRED')
  await expect(set(f.actor,'acknowledged','filed',true,false)).rejects.toThrow('GRIEVANCE_TRANSITION_HISTORY_AUDIT_REQUIRED')
  await set(f.actor,'acknowledged','withdrawn')
  expect((await f.db.query('SELECT status,closed_at FROM public.grievances WHERE id=$1',[id])).rows[0].closed_at).not.toBeNull()
  await expect(set('collaborator','withdrawn','filed')).rejects.toThrow('PRIMARY_CASE_HANDLER_REQUIRED')
  await set(f.actor,'withdrawn','filed')
  expect((await f.db.query('SELECT status,closed_at FROM public.grievances WHERE id=$1',[id])).rows[0]).toEqual({status:'filed',closed_at:null})
  await expect(f.tenant(f.actor,tx=>tx.query("UPDATE public.grievances SET created_by='forged' WHERE id=$1",[id]))).rejects.toThrow('CASE_IDENTITY_IMMUTABLE')
 })
 it('records a truthful initial intake without inventing a previous state or requiring a transition projection',async()=>{
  const logical=randomUUID(),internal=randomUUID()
  await f.tenant(f.member,async tx=>{
   await tx.query("INSERT INTO public.claims(claim_id,id,organization_id,member_id,status) VALUES($1,$2,$3,$4,'submitted')",[logical,internal,f.org,f.member])
   await f.audit(tx,f.member,'claim.create','claims',logical,{})
  })
  const [event]=(await f.db.query('SELECT claim_id,from_status,to_status,transaction_id FROM public.claim_status_transitions WHERE claim_id=$1',[internal])).rows
  expect(event).toMatchObject({claim_id:internal,from_status:null,to_status:'submitted'});expect(event.transaction_id).not.toBeNull()
  expect((await f.db.query('SELECT id FROM public.claim_updates WHERE claim_id=$1',[internal])).rows).toEqual([])
  const refused=randomUUID()
  await expect(f.tenant(f.member,tx=>tx.query("INSERT INTO public.claims(claim_id,organization_id,member_id,status) VALUES($1,$2,$3,'submitted')",[refused,f.org,f.member]))).rejects.toThrow('CASE_TRANSITION_AUDIT_REQUIRED')
  expect((await f.db.query('SELECT id FROM public.claims WHERE claim_id=$1',[refused])).rows).toEqual([])
 })
 it('requires actual current MVCC history/audit even across savepoints and rejects replay of an earlier audit',async()=>{
  await reset()
  await f.tenant(f.actor,async tx=>{
   await tx.query("UPDATE public.claims SET status='investigation' WHERE claim_id=$1",[f.caseId])
   await tx.exec('SAVEPOINT history_and_audit')
   await f.history(tx,f.actor);await f.audit(tx,f.actor)
   await tx.exec('RELEASE SAVEPOINT history_and_audit')
  })
  await reset()
  await expect(change(f.actor,'investigation',true,false)).rejects.toThrow('CASE_TRANSITION_AUDIT_REQUIRED')
 })
 it('has the same action ceiling as canonical policy for primary, collaborator, subject, supervisor and explicit delegation',async()=>{
  await reset();const delegation=randomUUID()
  await f.seed(async()=>{
   await f.db.query(`INSERT INTO public.ue_authority_mandates(organization_id,principal_user_id,kind,powers,scope,source_instrument,granted_by,status,effective_at,expires_at)
    VALUES($1,'supervisor','supervisory',ARRAY['read','transition','write_notes','comment','assign'],$2,'Synthetic bounded mandate','independent','active',now()-interval '1 hour',now()+interval '1 day'),
    ($1,'delegator','executive_office',ARRAY['transition','write_notes','comment','assign'],'{}','Synthetic office','independent','active',now()-interval '1 hour',now()+interval '1 day')`,[f.org,{resourceIds:[f.caseId]}])
   await f.db.query(`INSERT INTO public.ue_authority_delegations(id,organization_id,delegator_user_id,delegate_user_id,office,actions,resource_types,effective_at,expires_at)
    VALUES($1,$2,'delegator','delegate','president',ARRAY['case:transition','case:write_notes','case:comment','case:assign'],ARRAY['case'],now()-interval '1 hour',now()+interval '1 day')`,[delegation,f.org])
  })
  const compare=async(user:string,action:Action,delegationId?:string)=>{
   const now=new Date(),request:AuthorityRequest={principalUserId:user,organizationId:f.org,resource:{type:'case',id:f.caseId,organizationId:f.org},action,...(delegationId?{delegationId}:{})}
   const facts=await loadAuthorityFacts(f.db,canonicalMembershipSource,{principalUserId:user,organizationId:f.org,resource:request.resource,authenticated:true,now})
   const loaded=await loadCase(f.db,request,now)
   if(!loaded)throw new Error('Actual canonical fixture case missing')
   const expected=decide(request,{...facts,relationships:[...facts.relationships,...(loaded.relationships??[])]},loaded.resource,now).effect==='allow'
   const actual=await f.tenant(user,async tx=>{
    if(delegationId)await tx.query("SELECT set_config('app.authority_delegation_id',$1,true)",[delegationId])
    return (await tx.query<{allowed:boolean}>('SELECT public.ue_case_domain_authorized($1,$2,$3) AS allowed',[f.org,f.caseId,action])).rows[0].allowed
   })
   expect(actual,`${user} ${action} ${delegationId?'delegated':''}`).toBe(expected)
  }
  for(const user of [f.actor,'collaborator',f.member,'supervisor','unrelated','delegate'])
   for(const action of ['case:transition','case:close','case:disclose_to_member','case:write_notes','case:comment','case:assign'] as const)await compare(user,action,user==='delegate'?delegation:undefined)
  await f.seed(()=>f.db.query("UPDATE user_management.organization_users SET is_active=false WHERE user_id='delegator'"))
  await compare('delegate','case:transition',delegation)
  await f.seed(()=>f.db.query("UPDATE user_management.organization_users SET is_active=true WHERE user_id='delegator'"))
  await change('supervisor');await reset()
  await f.tenant('delegate',async tx=>{await tx.query("SELECT set_config('app.authority_delegation_id',$1,true)",[delegation]);await tx.query("UPDATE public.claims SET status='investigation' WHERE claim_id=$1",[f.caseId]);await f.history(tx,'delegate');await f.audit(tx,'delegate')})
 })

 it.skipIf(!native)('linearizes against a real membership revocation writer and observes the committed revocation next',async()=>{
  const runtime=await f.db.connect!(),writer=await f.db.connect!()
  try{
   await runtime.exec('BEGIN;SET LOCAL ROLE union_eyes_runtime')
   await runtime.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)",[f.actor,f.org,f.bearer])
   expect((await runtime.query<{allowed:boolean}>('SELECT public.ue_case_domain_authorized($1,$2,$3) AS allowed',[f.org,f.caseId,'case:transition'])).rows[0].allowed).toBe(true)
   const pid=(await writer.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid
   const revocation=writer.query('UPDATE user_management.organization_users SET is_active=false WHERE organization_id=$1 AND user_id=$2',[f.org,f.actor])
   for(let n=0;;n++){
    const wait=(await f.db.query<{wait_event_type:string;wait_event:string}>('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]
    if(wait?.wait_event_type==='Lock'&&wait.wait_event==='advisory')break
    if(n>=100)throw new Error('Actual canonical membership writer did not acquire shared principal lock')
    await new Promise(resolve=>setTimeout(resolve,10))
   }
   await runtime.exec('COMMIT');await revocation
   expect(await f.allow(f.actor,'case:transition')).toBe(false)
   await writer.query('UPDATE user_management.organization_users SET is_active=true WHERE organization_id=$1 AND user_id=$2',[f.org,f.actor])
  }finally{await runtime.exec('ROLLBACK');await runtime.close();await writer.close()}
 })
 it.skipIf(!native)('captures permission expiry after waiting behind an actual case-source writer',async()=>{
  const runtime=await f.db.connect!(),writer=await f.db.connect!()
  const expires=(await f.db.query<{expires:Date}>("SELECT clock_timestamp()+interval '2 seconds' AS expires")).rows[0].expires
  await f.seed(()=>f.db.query("UPDATE public.ue_authority_resource_relationships SET expires_at=$3 WHERE organization_id=$1 AND principal_user_id=$2 AND resource_id=$4",[f.org,'collaborator',expires,f.caseId]))
  try{
   await writer.exec('BEGIN');await writer.query('UPDATE public.claims SET status=status WHERE claim_id=$1',[f.caseId])
   const pid=(await runtime.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid
   await runtime.exec('BEGIN;SET LOCAL ROLE union_eyes_runtime')
   await runtime.query("SELECT set_config('app.current_user_id','collaborator',true),set_config('app.current_org_id',$1,true),set_config('app.current_session_token',$2,true)",[f.org,f.bearer])
   const admission=runtime.query<{allowed:boolean}>('SELECT public.ue_case_domain_authorized($1,$2,$3) AS allowed',[f.org,f.caseId,'case:transition'])
   for(let n=0;;n++){
    const wait=(await f.db.query<{wait_event_type:string;wait_event:string}>('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]
    if(wait?.wait_event_type==='Lock'&&wait.wait_event==='advisory')break
    if(n>=100)throw new Error('Domain admission did not share the actual case-source lock')
    await new Promise(resolve=>setTimeout(resolve,10))
   }
   await f.db.query("SELECT pg_sleep(GREATEST(0,extract(epoch FROM $1::timestamptz-clock_timestamp()))+0.05)",[expires])
   await writer.exec('COMMIT');expect((await admission).rows[0].allowed).toBe(false)
  }finally{await runtime.exec('ROLLBACK');await writer.exec('ROLLBACK');await runtime.close();await writer.close()}
 })

})
