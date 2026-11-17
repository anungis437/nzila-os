import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticatedOrgBindingSql, type AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'
import { withCanonicalTenantScope } from '../../lib/db/canonical-transaction-scope'
import { getActiveTenantDb } from '../../db/tenant-context-storage'
import { systemContextStorage } from '../../db/system-context-storage'
import type { RLSTx } from '../../lib/db/with-rls-context'
import { UserRole } from '../../lib/auth/roles'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { folder, type V2Plan } from './source'
import { compileCorrespondenceAttributionUpgradeSql, correspondenceAttributionPolicyExpressions } from './correspondence-attribution-compat'
import { sealCorrespondenceEmail, type UnsignedEmailIntent } from '../../lib/correspondence/email-intent'

const h = vi.hoisted(()=>({system:null as null | ((fn:(tx:RLSTx)=>Promise<unknown>)=>Promise<unknown>),send:vi.fn()}))
vi.mock('@/db',async()=>{
  const {getActiveTenantDb}=await import('../../db/tenant-context-storage')
  return {db:new Proxy({}, {get(_target,field){const tx=getActiveTenantDb(); if (!tx) throw new Error('Native tenant transaction required');
    const value=Reflect.get(tx,field);return typeof value === 'function'?value.bind(tx):value}})}
})
vi.mock('@/lib/db/with-rls-context',async()=>{
  const {getActiveTenantDb}=await import('../../db/tenant-context-storage')
  return {withRLSContext:async (_context:unknown,fn:(tx:RLSTx)=>Promise<unknown>)=>{
    const tx=getActiveTenantDb();if(!tx)throw new Error('Native tenant transaction required');return fn(tx)},
    withSystemContext:async (fn:(tx:RLSTx)=>Promise<unknown>)=>h.system!(fn)}
})
vi.mock('@/lib/email-service',()=>({getFromEmail:()=> 'sender@example.invalid',sendResendEmail:h.send}))
import { ensureOwnDirectoryProfile } from '../../lib/members/own-directory-profile'
import { queueCorrespondenceEmail, processCorrespondenceEmails, settleCorrespondenceEmail } from '../../lib/correspondence/email-delivery'
import { cancelCorrespondence, signCorrespondence } from '../../lib/services/correspondence-service'

const native=process.env.UE_V2_NATIVE_MANIFEST === '1'?describe:describe.skip
native('member directory and letter outbox on actual canonical PostgreSQL roles',()=>{
  let fixture:Awaited<ReturnType<typeof openNativeRuntimeFixture>>
  let runtime:ReturnType<typeof postgres>,system:ReturnType<typeof postgres>
  const org=randomUUID(),foreignOrg=randomUUID(),member=randomUUID(),staff=randomUUID(),signer=randomUUID(),platform=randomUUID()
  const bindings=new Map<string,AuthenticatedOrgBinding>()
  const priorMode=process.env.UE_CANONICAL_BOOTSTRAP_V2,priorKey=process.env.EVIDENCE_SEAL_KEY
  const tenant=<T>(userId:string,fn:(tx:RLSTx)=>Promise<T>)=>drizzle(runtime).transaction(async tx=>{
    const binding=bindings.get(userId)!
    await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)
    await tx.execute(authenticatedOrgBindingSql(binding))
    return withCanonicalTenantScope(tx as never,binding,fn)
  })
  const contact=(userId=member,organizationId=org)=>({userId,organizationId,role:UserRole.MEMBER,
    email:`${userId}@example.invalid`,firstName:'Synthetic',lastName:'Member',isSystemAdmin:false})
  beforeAll(async()=>{
    process.env.UE_CANONICAL_BOOTSTRAP_V2='1';process.env.EVIDENCE_SEAL_KEY='synthetic-native-correspondence-key-123456789'
    const plan:V2Plan=JSON.parse(readFileSync(path.join(folder,'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'),'utf8'))
    fixture=await openNativeRuntimeFixture(plan)
    runtime=postgres(fixture.runtimeUrl,{max:5});system=postgres(fixture.systemUrl,{max:2})
    h.system=fn=>drizzle(system).transaction(async tx=>{
      await tx.execute(sql`SET LOCAL ROLE union_eyes_system`)
      await tx.execute(sql`SELECT set_config('app.current_user_id','',true),set_config('app.current_org_id','',true)`)
      return systemContextStorage.run(tx as never,()=>fn(tx as never))
    })
    for(const id of [org,foreignOrg]) await fixture.seed.query(`INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
      VALUES ($1::uuid,'Native letter','native-letter-'||$1::text,'local',ARRAY[]::text[],0,ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now())`,[id])
    for(const [userId,role] of [[member,'member'],[staff,'steward'],[signer,'officer'],[platform,'system_admin']]){
      const sessionToken='synthetic-session-'+randomUUID(),expiresAt=new Date(Date.now()+60*60_000)
      bindings.set(userId,{userId,organizationId:org,role,sessionToken,expiresAt,authority:'pg-session'})
      await fixture.seed.query(`INSERT INTO user_management.users(user_id,email) VALUES ($1,$2);
      `,[userId,`${userId}@example.invalid`])
      await fixture.seed.query('INSERT INTO user_management.organization_users(user_id,organization_id,role) VALUES ($1,$2,$3)',[userId,org,role])
      await fixture.seed.query(`INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,expires_at)
        VALUES ($1,$2,$3,$4,$5)`,[userId,org,sessionToken,createHash('sha256').update(sessionToken).digest('hex'),expiresAt])
    }
    for(const id of [staff,signer]) await tenant(id,tx=>ensureOwnDirectoryProfile(tx,contact(id)))
  },600_000)
  beforeEach(()=>{h.send.mockReset();h.send.mockResolvedValue({success:true,messageId:randomUUID()})})
  afterAll(async()=>{
    await Promise.allSettled([runtime?.end({timeout:5}),system?.end({timeout:5})]);await fixture?.dispose()
    if(priorMode===undefined)delete process.env.UE_CANONICAL_BOOTSTRAP_V2;else process.env.UE_CANONICAL_BOOTSTRAP_V2=priorMode
    if(priorKey===undefined)delete process.env.EVIDENCE_SEAL_KEY;else process.env.EVIDENCE_SEAL_KEY=priorKey
  })
  const state=async(userId:string)=> (await fixture.seed.query(`SELECT
    (SELECT count(*)::int FROM public.profiles WHERE user_id=$1) AS anchors,
    (SELECT count(*)::int FROM public.organization_members WHERE user_id=$1) AS members,
    (SELECT count(*)::int FROM public.audit_logs WHERE user_id=$1 AND action IN ('member.profile_anchored','member.directory_projected')) AS audits`,[userId])).rows[0]
  it('creates one own profile and two mandatory audit events under concurrent requests',async()=>{
    const results=await Promise.all(Array.from({length:3},()=>tenant(member,tx=>ensureOwnDirectoryProfile(tx,contact()))))
    expect(results.filter(v=>v.created)).toHaveLength(1)
    expect(new Set(results.map(v=>v.memberId)).size).toBe(1)
    expect(await state(member)).toEqual({anchors:1,members:1,audits:2})
    const row=(await fixture.seed.query('SELECT role,joined_at FROM public.organization_members WHERE user_id=$1',[member])).rows[0]
    expect(row).toEqual({role:'member',joined_at:null})
  })
  it('refuses a foreign contact, platform title, revoked session and inactive projection without inserting authority',async()=>{
    await expect(tenant(member,tx=>ensureOwnDirectoryProfile(tx,contact(staff)))).rejects.toThrow()
    await expect(tenant(member,tx=>ensureOwnDirectoryProfile(tx,contact(member,foreignOrg)))).rejects.toThrow()
    await expect(tenant(platform,tx=>ensureOwnDirectoryProfile(tx,contact(platform)))).rejects.toThrow()
    expect(await state(platform)).toEqual({anchors:0,members:0,audits:0})
    await fixture.seed.query("UPDATE public.organization_members SET status='inactive' WHERE user_id=$1",[member])
    await expect(tenant(member,tx=>ensureOwnDirectoryProfile(tx,contact()))).rejects.toThrow('review')
    await fixture.seed.query("UPDATE public.organization_members SET status='active' WHERE user_id=$1",[member])
    await fixture.seed.query('UPDATE user_management.user_sessions SET is_active=false WHERE user_id=$1',[member])
    await expect(tenant(member,tx=>ensureOwnDirectoryProfile(tx,contact()))).rejects.toThrow()
    await fixture.seed.query('UPDATE user_management.user_sessions SET is_active=true WHERE user_id=$1',[member])
  })
  it('rolls back profile and contact anchor when the mandatory audit fails, then permits retry',async()=>{
    await fixture.seed.query('DELETE FROM public.organization_members WHERE user_id=$1;',[member])
    await fixture.seed.query('DELETE FROM public.profiles WHERE user_id=$1',[member])
    await fixture.seed.query(`CREATE FUNCTION public.ue_native_refuse_member_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='member.directory_projected' THEN RAISE EXCEPTION 'controlled member audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER ue_native_refuse_member_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ue_native_refuse_member_audit()`)
    try {await expect(tenant(member,tx=>ensureOwnDirectoryProfile(tx,contact()))).rejects.toThrow();expect(await state(member)).toEqual({anchors:0,members:0,audits:2})}
    finally {await fixture.seed.query('DROP TRIGGER ue_native_refuse_member_audit ON public.audit_logs;DROP FUNCTION public.ue_native_refuse_member_audit()')}
    expect((await tenant(member,tx=>ensureOwnDirectoryProfile(tx,contact()))).created).toBe(true)
  })

  const signedLetter=async(referenceNumber?:null,body='Synthetic approved text é: 2 < 3 > 1')=>{
    const id=randomUUID(),signatureId=randomUUID()
    await fixture.seed.query(`INSERT INTO public.user_signatures(id,organization_id,user_id,display_name,source,image_url,image_hash,is_active)
      VALUES ($1,$2,$3,'Synthetic Signer','typed','data:image/png;base64,c3ludGhldGlj',$4,true)`,[signatureId,org,signer,'a'.repeat(64)])
    await fixture.seed.query(`INSERT INTO public.correspondence(id,organization_id,reference_number,subject,body,status,drafted_by,assigned_signer_id,
      approved_by,approved_at) VALUES ($1,$2,$3,'Approved test letter',$6,'approved',$4,$5,$5,now())`,[id,org,referenceNumber===null?null:'LTR-'+id,staff,signer,body])
    await fixture.seed.query(`INSERT INTO public.correspondence_recipients(correspondence_id,name,email) VALUES ($1,'Controlled recipient','controlled@example.invalid')`,[id])
    await tenant(signer,()=>signCorrespondence(id,{signatureId,actorUserId:signer}))
    return id
  }
  const tasks=async(id:string)=>(await fixture.seed.query("SELECT id,status,attempt_count,error_message,payload FROM public.notification_queue WHERE payload->>'correspondenceId'=$1",[id])).rows
  it('durably queues once, calls the provider outside tenant scope and finalizes only a verified receipt',async()=>{
    const id=await signedLetter()
    await Promise.all([tenant(staff,()=>queueCorrespondenceEmail(id,org,staff)),tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))])
    expect(await tasks(id)).toHaveLength(1)
    h.send.mockImplementationOnce(async()=>{expect(getActiveTenantDb()).toBeUndefined();return {success:true,messageId:randomUUID()}})
    const reports=await Promise.all([processCorrespondenceEmails(1),processCorrespondenceEmails(1)])
    expect(reports.reduce((n,v)=>n+v.attempted,0)).toBe(1)
    expect(reports.reduce((n,v)=>n+v.accepted,0)).toBe(1)
    expect(reports.reduce((n,v)=>n+v.unconfirmed,0)).toBe(0)
    expect(h.send).toHaveBeenCalledTimes(1)
    expect(h.send.mock.calls[0][1]).toMatchObject({idempotencyKey:`ue-letter/${(await tasks(id))[0].id}`,disableRetry:true,sensitiveContent:true})
    expect((await fixture.seed.query('SELECT status FROM public.correspondence WHERE id=$1',[id])).rows[0].status).toBe('signed')
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'accepted',accepted:1,total:1})
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'accepted'})
    expect((await fixture.seed.query("SELECT count(*)::int AS n FROM public.audit_logs WHERE resource_id=$1 AND action='CORRESPONDENCE_DISPATCHED'",[id])).rows[0].n).toBe(1)
  })
  it('does not report dispatch or permit cancellation after an uncertain provider outcome; retry keeps the same envelope and key',async()=>{
    const id=await signedLetter();await tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))
    h.send.mockResolvedValueOnce({success:false,code:'OUTCOME_UNKNOWN'})
    await processCorrespondenceEmails()
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'queued',accepted:0})
    await expect(tenant(staff,()=>cancelCorrespondence(id,'Controlled cancel',{actorUserId:staff}))).rejects.toThrow('Reconcile')
    await fixture.seed.query("UPDATE public.notification_queue SET next_retry_at=now()-interval '1 minute' WHERE payload->>'correspondenceId'=$1",[id])
    await processCorrespondenceEmails()
    expect(h.send).toHaveBeenCalledTimes(2)
    expect(h.send.mock.calls[0]).toEqual(h.send.mock.calls[1])
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'accepted'})
  })
  it('cancels an unattempted task atomically and never calls the provider for it',async()=>{
    const id=await signedLetter();await tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))
    await tenant(staff,()=>cancelCorrespondence(id,'Controlled cancellation',{actorUserId:staff}))
    expect((await tasks(id))[0]).toMatchObject({status:'completed',attempt_count:'0',error_message:'CORRESPONDENCE_CANCELLED'})
    await processCorrespondenceEmails();expect(h.send).not.toHaveBeenCalled()
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'cancelled'})
  })

  const refusingAudit=async(action:string,work:()=>Promise<void>)=>{
    await fixture.seed.query(`CREATE FUNCTION public.ue_native_refuse_letter_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='${action}' THEN RAISE EXCEPTION 'controlled letter audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER ue_native_refuse_letter_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ue_native_refuse_letter_audit()`)
    try {await work()} finally {await fixture.seed.query('DROP TRIGGER ue_native_refuse_letter_audit ON public.audit_logs;DROP FUNCTION public.ue_native_refuse_letter_audit()')}
  }
  it('rolls back a failed queue audit and a failed attempt audit before any provider call',async()=>{
    const id=await signedLetter()
    await refusingAudit('CORRESPONDENCE_EMAIL_QUEUED',async()=>{
      await expect(tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))).rejects.toThrow()
      expect(await tasks(id)).toHaveLength(0)
    })
    await tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))
    await refusingAudit('correspondence.email_attempted',async()=>{
      await expect(processCorrespondenceEmails()).rejects.toThrow()
      expect((await tasks(id))[0]).toMatchObject({status:'pending',attempt_count:'0'})
      expect(h.send).not.toHaveBeenCalled()
    })
    await processCorrespondenceEmails()
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'accepted'})
  })
  it('retains the stable envelope/key after a lost acceptance commit, then retries finalization without sending again',async()=>{
    const id=await signedLetter();await tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))
    await refusingAudit('correspondence.email_accepted',async()=>{
      await expect(processCorrespondenceEmails()).rejects.toThrow()
      expect((await tasks(id))[0]).toMatchObject({status:'processing',attempt_count:'1'})
      expect(h.send).toHaveBeenCalledTimes(1)
    })
    await fixture.seed.query("UPDATE public.notification_queue SET processed_at=now()-interval '2 minutes' WHERE payload->>'correspondenceId'=$1",[id])
    await processCorrespondenceEmails()
    expect(h.send).toHaveBeenCalledTimes(2);expect(h.send.mock.calls[0]).toEqual(h.send.mock.calls[1])
    await refusingAudit('CORRESPONDENCE_DISPATCHED',async()=>{
      await expect(tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).rejects.toThrow()
      expect((await fixture.seed.query('SELECT status FROM public.correspondence WHERE id=$1',[id])).rows[0].status).toBe('signed')
      expect((await tasks(id))[0].status).toBe('completed')
    })
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'accepted'})
    await processCorrespondenceEmails();expect(h.send).toHaveBeenCalledTimes(2)
  })
  it('refuses a member caller and a changed sealed body without contacting the provider',async()=>{
    const id=await signedLetter()
    await expect(tenant(member,()=>queueCorrespondenceEmail(id,org,member))).rejects.toThrow()
    await tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))
    await fixture.seed.query("UPDATE public.notification_queue SET payload=jsonb_set(payload,'{mail,text}','\"tampered synthetic text\"'::jsonb) WHERE payload->>'correspondenceId'=$1",[id])
    await processCorrespondenceEmails();expect(h.send).not.toHaveBeenCalled()
    expect((await tasks(id))[0]).toMatchObject({status:'failed',attempt_count:'0',error_message:'CORRESPONDENCE_INVALID_SEAL'})
  })
  it('does not restart a correctly sealed task after its provider replay window expires',async()=>{
    const id=await signedLetter();await tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))
    const task=(await tasks(id))[0],createdAt=new Date(Date.now()-24*60*60_000)
    const {seal:_seal,...unsigned}=task.payload
    const payload=sealCorrespondenceEmail({...unsigned,createdAt:createdAt.toISOString()} as UnsignedEmailIntent,process.env.EVIDENCE_SEAL_KEY!)
    await fixture.seed.query('UPDATE public.notification_queue SET created_at=$2,payload=$3 WHERE id=$1',[task.id,createdAt,JSON.stringify(payload)])
    await processCorrespondenceEmails();expect(h.send).not.toHaveBeenCalled()
    expect((await tasks(id))[0]).toMatchObject({status:'failed',attempt_count:'0',error_message:'CORRESPONDENCE_RECONCILIATION_REQUIRED'})
  })
  it('sends exact approved plain text for a letter without a legacy reference number',async()=>{
    const id=await signedLetter(null);await tenant(staff,()=>queueCorrespondenceEmail(id,org,staff));await processCorrespondenceEmails()
    expect(h.send.mock.calls[0][0]).toMatchObject({subject:'Approved test letter',text:'Synthetic approved text é: 2 < 3 > 1\n\nSynthetic Signer'})
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'accepted'})
  })
  it('refuses an oversized approved letter before queuing any recipient copy',async()=>{
    const id=await signedLetter(null,'x'.repeat(150001))
    await expect(tenant(staff,()=>queueCorrespondenceEmail(id,org,staff))).rejects.toThrow('email text limit')
    expect(await tasks(id)).toHaveLength(0);expect(h.send).not.toHaveBeenCalled()
  })
  it('upgrades only the two known attribution checks and preserves private profile visibility and all role grants',async()=>{
    const plan:V2Plan=JSON.parse(readFileSync(path.join(folder,'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'),'utf8'))
    const expressions=correspondenceAttributionPolicyExpressions(plan)
    const grants=async()=>(await fixture.seed.query("SELECT relacl::text,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('public.correspondence'::regclass,'public.profiles'::regclass,'public.user_signatures'::regclass) ORDER BY oid")).rows
    const before=await grants()
    await fixture.seed.query(`BEGIN;SET LOCAL ROLE ue_v2_owner;ALTER POLICY ue_v2_insert ON public.correspondence WITH CHECK (${expressions.before});ALTER POLICY ue_v2_update ON public.correspondence WITH CHECK (${expressions.before});COMMIT`)
    const upgrade=compileCorrespondenceAttributionUpgradeSql(plan)
    await fixture.seed.query(`BEGIN;SET LOCAL ROLE ue_v2_owner;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='10s';${upgrade};COMMIT`)
    await fixture.seed.query(`BEGIN;SET LOCAL ROLE ue_v2_owner;${upgrade};COMMIT`)
    expect(await grants()).toEqual(before)
    await tenant(staff,async tx=>{
      expect(await tx.execute(sql`SELECT user_id FROM public.profiles WHERE user_id=${signer}`)).toHaveLength(0)
      expect(await tx.execute(sql`SELECT id FROM public.user_signatures WHERE user_id=${signer}`)).toHaveLength(0)
    })
    const foreign=randomUUID()
    await fixture.seed.query('INSERT INTO public.profiles(user_id,email) VALUES ($1,$2)',[foreign,`${foreign}@example.invalid`])
    const forbidden=await signedLetter()
    await expect(tenant(staff,tx=>tx.execute(sql`UPDATE public.correspondence SET assigned_signer_id=${foreign} WHERE id=${forbidden}`))).rejects.toThrow()
    const id=await signedLetter();await tenant(staff,()=>queueCorrespondenceEmail(id,org,staff));await processCorrespondenceEmails()
    expect(await tenant(staff,()=>settleCorrespondenceEmail(id,org,staff))).toMatchObject({state:'accepted'})
  })
})
