/** Disposable component fixture: real canonical auth SQL and forced RLS, synthetic pre-existing institutional instruments. */
import { createHash,randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pgDriver from 'pg'
import { PGlite } from '@electric-sql/pglite'
import { installQueuedMailFixture,type MailFixtureDb } from '../auth/queued-case-mail-testkit'
import { applyPhysicalGuards,inspectPhysicalGuards,planPhysicalGuards } from '../auth/physical-guard-catalog'
import { CASE_PRIMARY_DOMAIN_GUARDS,compileCaseDomainSupportSql } from '../auth/case-primary-domain-guards'

export interface CaseDomainDb extends MailFixtureDb {close():Promise<void>;connect?:()=>Promise<CaseDomainDb>;client?:pgDriver.Client}
export async function openCaseDomainDb(native=false):Promise<CaseDomainDb>{
 if(!native)return new PGlite()
 const owner=randomUUID(),name=`ue-case-domain-${owner}`,password=randomUUID(),image='pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
 const id=execFileSync('docker',['run','-d','--pull','never','--name',name,'--label',`nzila.qualification-owner=${owner}`,'--tmpfs','/var/lib/postgresql/data:rw,size=512m','--memory','768m','--cpus','2','-p','127.0.0.1::5432','-e',`POSTGRES_PASSWORD=${password}`,image],{encoding:'utf8'}).trim()
 const opened:pgDriver.Client[]=[]
 try{
  for(let attempt=0;;attempt++){try{execFileSync('docker',['exec',id,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'pipe'});break}catch(error){if(attempt>=80)throw error;await new Promise(resolve=>setTimeout(resolve,100))}}
  const port=Number(execFileSync('docker',['port',id,'5432/tcp'],{encoding:'utf8'}).trim().split(':').at(-1))
  const connect=async():Promise<CaseDomainDb>=>{const client=new pgDriver.Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres'});await client.connect();opened.push(client)
   return {exec:async text=>client.query(text),query:async<T>(text:string,params?:unknown[])=>({rows:(await client.query(text,params)).rows as T[]}),close:async()=>{await client.end()},connect,client}}
  const database=await connect()
  return {...database,close:async()=>{
   await Promise.allSettled(opened.map(client=>client.end()))
   const [record]=JSON.parse(execFileSync('docker',['inspect',id],{encoding:'utf8'}))
   if(record.Id!==id||record.Name!==`/${name}`||record.Config.Labels['nzila.qualification-owner']!==owner)throw new Error('Owned case domain cleanup identity mismatch')
   execFileSync('docker',['rm','-f',id],{stdio:'pipe'})
  }}
 }catch(error){await Promise.allSettled(opened.map(client=>client.end()));const[record]=JSON.parse(execFileSync('docker',['inspect',id],{encoding:'utf8'}));if(record.Id===id&&record.Config.Labels['nzila.qualification-owner']===owner)execFileSync('docker',['rm','-f',id],{stdio:'pipe'});throw error}
}
export async function caseDomainFixture(native=false){
 const db=await openCaseDomainDb(native),org=randomUUID(),caseId=randomUUID(),internalId=randomUUID(),actor='primary-handler',member='case-member',bearer='synthetic-domain-session'
 try{
 await installQueuedMailFixture(db,{org,caseId,actor,member,sessionHash:createHash('sha256').update(bearer).digest('hex')})
 await db.exec(`ALTER TABLE public.claims ADD COLUMN id uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,ADD COLUMN closed_at timestamptz,ADD COLUMN status_changed_at timestamptz,ADD COLUMN created_at timestamptz DEFAULT now();
  ALTER TABLE public.grievances ADD COLUMN status text DEFAULT 'filed',ADD COLUMN closed_at timestamptz,ADD COLUMN created_by text,ADD COLUMN grievant_id uuid,ADD COLUMN created_at timestamptz DEFAULT now();
  CREATE TABLE public.claim_status_transitions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,claim_id uuid NOT NULL REFERENCES public.claims(id),from_status varchar(50),to_status varchar(50) NOT NULL,changed_at timestamptz NOT NULL DEFAULT now(),changed_by varchar(255),transaction_id bigint);
  CREATE TABLE public.claim_updates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),update_id uuid UNIQUE DEFAULT gen_random_uuid(),claim_id uuid NOT NULL REFERENCES public.claims(id),transition_id uuid UNIQUE REFERENCES public.claim_status_transitions(id),update_type text,message text,created_by text,is_internal boolean DEFAULT false,visibility_scope text DEFAULT 'member',metadata jsonb DEFAULT '{}',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
  CREATE TABLE public.grievance_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),grievance_id uuid REFERENCES public.grievances(id),event_type text,actor_user_id text,notes text,created_at timestamptz DEFAULT now());
  CREATE POLICY hidden_runtime_recusals ON public.ue_authority_recusals AS RESTRICTIVE FOR SELECT TO union_eyes_runtime USING(false);`)
 await db.query('UPDATE public.claims SET id=$2 WHERE claim_id=$1',[caseId,internalId])
 for(const table of CASE_PRIMARY_DOMAIN_GUARDS.tables){
  await db.exec(`ALTER TABLE public.${table} OWNER TO ue_v2_owner;ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`)
 }
 await db.exec(`GRANT SELECT,INSERT,UPDATE ON public.claims,public.grievances,public.claim_updates,public.grievance_events TO union_eyes_runtime;
  GRANT SELECT ON public.claim_status_transitions TO union_eyes_runtime,union_eyes_system;
  CREATE POLICY domain_fixture_claims ON public.claims TO union_eyes_runtime USING(organization_id::text=current_setting('app.current_org_id',true)) WITH CHECK(organization_id::text=current_setting('app.current_org_id',true));
  CREATE POLICY domain_fixture_grievances ON public.grievances TO union_eyes_runtime USING(organization_id::text=current_setting('app.current_org_id',true)) WITH CHECK(organization_id::text=current_setting('app.current_org_id',true));
  CREATE POLICY domain_fixture_journal ON public.claim_status_transitions TO union_eyes_runtime USING(organization_id::text=current_setting('app.current_org_id',true));
  CREATE POLICY domain_fixture_history ON public.claim_updates TO union_eyes_runtime USING(EXISTS(SELECT FROM public.claims c WHERE c.id=claim_updates.claim_id AND c.organization_id::text=current_setting('app.current_org_id',true))) WITH CHECK(EXISTS(SELECT FROM public.claims c WHERE c.id=claim_updates.claim_id AND c.organization_id::text=current_setting('app.current_org_id',true)));
  CREATE POLICY domain_fixture_grievance_events ON public.grievance_events TO union_eyes_runtime USING(EXISTS(SELECT FROM public.grievances g WHERE g.id=grievance_events.grievance_id AND g.organization_id::text=current_setting('app.current_org_id',true))) WITH CHECK(EXISTS(SELECT FROM public.grievances g WHERE g.id=grievance_events.grievance_id AND g.organization_id::text=current_setting('app.current_org_id',true)));`)
 for(const [user,role] of [['collaborator','steward'],['supervisor','officer'],['unrelated','steward'],['delegator','president'],['delegate','officer']]){
  await db.query("INSERT INTO user_management.users(user_id,email,email_verified,is_active,lifecycle_state) VALUES($1,$2,true,true,'active')",[user,`${user}@example.invalid`])
  await db.query('INSERT INTO user_management.organization_users VALUES($1,$2,$3,true)',[user,org,role])
  await db.query("INSERT INTO user_management.user_sessions(user_id,organization_id,session_token_hash,is_active,expires_at) VALUES($1,$2,$3,true,now()+interval '1 hour')",[user,org,createHash('sha256').update(bearer).digest('hex')])
 }
 await db.query("INSERT INTO user_management.user_sessions(user_id,organization_id,session_token_hash,is_active,expires_at) VALUES($1,$2,$3,true,now()+interval '1 hour')",[member,org,createHash('sha256').update(bearer).digest('hex')])
 await db.exec(compileCaseDomainSupportSql())
 const execute=async(text:string)=>(await db.query(text)).rows as Record<string,unknown>[]
 await db.exec('SET ROLE ue_v2_owner;BEGIN')
 const plan=planPhysicalGuards(CASE_PRIMARY_DOMAIN_GUARDS,await inspectPhysicalGuards(CASE_PRIMARY_DOMAIN_GUARDS,execute))
 await applyPhysicalGuards(CASE_PRIMARY_DOMAIN_GUARDS,execute,plan.fingerprint)
 await db.exec('COMMIT;RESET ROLE')
 const tenant=async<T>(user:string,fn:(tx:CaseDomainDb)=>Promise<T>,tx:CaseDomainDb=db):Promise<T>=>{
  await tx.exec('BEGIN;SET LOCAL ROLE union_eyes_runtime')
  try{await tx.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)",[user,org,bearer]);const result=await fn(tx);await tx.exec('COMMIT');return result}catch(error){await tx.exec('ROLLBACK');throw error}
 }
 const seed=async(fn:()=>Promise<unknown>)=>{await db.exec('BEGIN;SET LOCAL session_replication_role=replica');try{await fn();await db.exec('COMMIT')}catch(error){await db.exec('ROLLBACK');throw error}}
 const allow=(user:string,action:string)=>tenant(user,async tx=>(await tx.query<{allowed:boolean}>('SELECT public.ue_case_domain_authorized($1,$2,$3) AS allowed',[org,caseId,action])).rows[0].allowed)
 const audit=async(tx:CaseDomainDb,user:string,action='case.transition',resourceType='claims',resourceId=caseId,details:Record<string,unknown>={from:'under_review',to:'investigation'})=>tx.query(`INSERT INTO public.audit_logs(id,audit_id,created_at,updated_at,organization_id,user_id,action,resource_type,resource_id,details) VALUES(gen_random_uuid(),gen_random_uuid(),clock_timestamp(),clock_timestamp(),$1,$2,$3,$4,$5,$6)`,[org,user,action,resourceType,resourceId,details])
 const history=(tx:CaseDomainDb,user:string,previous='under_review',next='investigation',over:Record<string,unknown>={})=>tx.query<{id:string;transition_id:string}>(`INSERT INTO public.claim_updates(claim_id,created_by,update_type,message,metadata,is_internal,visibility_scope,transition_id)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,transition_id`,[internalId,over.createdBy??user,over.type??'status_change',over.message??`Status changed from '${previous}' to '${next}'`,over.metadata??{previousStatus:previous,newStatus:next},over.internal??false,over.visibility??'member',over.transitionId??null])
 return{db,org,caseId,internalId,actor,member,bearer,tenant,seed,allow,audit,history}
 }catch(error){await db.close();throw error}
}
