import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { randomUUID } from 'node:crypto'
import { compileAuthOrgBindingSql } from '@nzila/db/auth-storage-authority'
import * as authoritySchema from '../schema/domains/ml/authority-kernel'
import { AUTHORITY_PHYSICAL_GUARDS } from './authority-physical-guards'
import { applyPhysicalGuards, inspectPhysicalGuards, planPhysicalGuards } from './physical-guard-catalog'
import { compileQueuedCaseMailSql } from './queued-case-mail'
import { CASE_SCOPE_FACTS_FIXTURE_SQL } from '../__tests__/case-scope-facts-fixture'

export interface MailFixtureDb { exec(sql:string):Promise<unknown>; query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}> }
export async function installQueuedMailFixture(pg:MailFixtureDb,input:{org:string;caseId:string;actor:string;member:string;sessionHash:string}) {
  const {org,caseId,actor,member,sessionHash}=input
  await pg.exec(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    CREATE ROLE ue_v2_owner NOLOGIN NOINHERIT; CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT;
    CREATE ROLE union_eyes_system NOLOGIN NOINHERIT; CREATE ROLE nzila_auth_org_authority_reader NOLOGIN NOINHERIT;
    GRANT CREATE ON SCHEMA public TO ue_v2_owner; SET ROLE ue_v2_owner;`)
  const ddl=await generateMigration(generateDrizzleJson({}),generateDrizzleJson(authoritySchema))
  for(const sql of [...ddl.filter(sql=>!sql.startsWith('ALTER TABLE')),...ddl.filter(sql=>sql.startsWith('ALTER TABLE'))])await pg.exec(sql)
  await pg.exec(`RESET ROLE;
    CREATE SCHEMA user_management;
    CREATE TABLE user_management.users(user_id text PRIMARY KEY,email text,email_verified boolean,is_active boolean,lifecycle_state text);
    CREATE TABLE user_management.organization_users(user_id text,organization_id uuid,role text,is_active boolean);
    CREATE TABLE user_management.user_sessions(user_id text,organization_id uuid,session_token_hash text,is_active boolean,expires_at timestamptz,session_id uuid DEFAULT gen_random_uuid(),device_info jsonb DEFAULT '{}');
    CREATE TABLE public.notification_queue(id uuid PRIMARY KEY,organization_id uuid,payload jsonb,created_at timestamptz,status text);
    CREATE TABLE public.claims(claim_id uuid PRIMARY KEY,organization_id uuid,member_id text,status text);
    CREATE TABLE public.grievances(id uuid PRIMARY KEY,organization_id uuid,has_legal_implications boolean,is_confidential boolean,represented_member_user_id text);
    CREATE TABLE public.correspondence(id uuid PRIMARY KEY,organization_id uuid,grievance_id uuid,status text,drafted_by text,approved_by text,approved_at timestamptz,assigned_signer_id text,signed_by text,signed_at timestamptz,signature_id uuid,subject text,body text,reference_number text);
    CREATE TABLE public.correspondence_recipients(id uuid PRIMARY KEY,correspondence_id uuid,name text,email text,recipient_type text,mailing_address text,organization text,title text);
    CREATE TABLE audit_logs(id uuid PRIMARY KEY,audit_id uuid UNIQUE NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,organization_id uuid,action varchar(100),resource_type varchar(255),resource_id varchar(255),user_id varchar(255),ip_address inet,user_agent text,correlation_id uuid,details jsonb DEFAULT '{}',changes jsonb DEFAULT '{}',content_hash varchar(64),previous_hash varchar(64));`)
  await pg.exec(CASE_SCOPE_FACTS_FIXTURE_SQL)
  for(const table of ['users','organization_users','user_sessions'])await pg.exec(`ALTER TABLE user_management.${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE user_management.${table} FORCE ROW LEVEL SECURITY`)
  for(const table of [...AUTHORITY_PHYSICAL_GUARDS.tables,'ue_authority_requests','notification_queue','claims','grievances','correspondence','correspondence_recipients','bargaining_units','case_territories','case_authority_scopes','case_respondents']){
    await pg.exec(`ALTER TABLE public.${table} OWNER TO ue_v2_owner; ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`)
  }
  await pg.exec(compileAuthOrgBindingSql())
  await pg.exec('SET ROLE ue_v2_owner')
  const execute=async(sql:string)=>(await pg.query(sql)).rows as Record<string,unknown>[]
  const plan=planPhysicalGuards(AUTHORITY_PHYSICAL_GUARDS,await inspectPhysicalGuards(AUTHORITY_PHYSICAL_GUARDS,execute))
  await pg.exec('BEGIN');await applyPhysicalGuards(AUTHORITY_PHYSICAL_GUARDS,execute,plan.fingerprint);await pg.exec('COMMIT;RESET ROLE')
  await pg.exec(compileQueuedCaseMailSql())
  for(const table of ['notification_queue','ue_authority_requests','ue_authority_resource_relationships','ue_authority_recusals','ue_authority_events','audit_logs']){
    await pg.exec(`GRANT SELECT,INSERT,UPDATE ON public.${table} TO union_eyes_runtime; CREATE POLICY fixture_tenant ON public.${table} TO union_eyes_runtime USING (organization_id::text=nullif(current_setting('app.current_org_id',true),'')) WITH CHECK (organization_id::text=nullif(current_setting('app.current_org_id',true),''))`)
  }
  await pg.exec('GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO union_eyes_runtime')
  await pg.query(`INSERT INTO user_management.users VALUES($1,'primary@example.invalid',true,true,'active'),($2,'member@example.invalid',true,true,'active')`,[actor,member])
  await pg.query(`INSERT INTO user_management.organization_users VALUES($1,$3,'steward',true),($2,$3,'member',true)`,[actor,member,org])
  await pg.query(`INSERT INTO user_management.user_sessions(user_id,organization_id,session_token_hash,is_active,expires_at) VALUES($1,$2,$3,true,now()+interval '1 hour')`,[actor,org,sessionHash])
  await pg.query(`INSERT INTO public.claims VALUES($1,$2,$3,'under_review')`,[caseId,org,member])
  await pg.exec('BEGIN')
  await pg.query(`SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true)`,[actor,org])
  const caseRule=randomUUID(),adoption=randomUUID()
  await pg.query("SELECT set_config('app.current_user_id','drafter',true)")
  await pg.query(`INSERT INTO public.ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,version,source_instrument,drafted_by)
    VALUES($1,$2,'case_assignment','issue',ARRAY['officer'],ARRAY['read'],1,'Synthetic test institutional rule','drafter')`,[caseRule,org])
  await pg.query(`INSERT INTO public.ue_authority_approval_requests(id,organization_id,subject_type,subject_id,proposed_by,required_approvals,risk_class,named_approver_ids)
    VALUES($1,$2,'rule_adoption',$3,'drafter',2,'high',ARRAY['adopter-one','adopter-two'])`,[adoption,org,caseRule])
  for(const voter of ['adopter-one','adopter-two']){
    await pg.query("SELECT set_config('app.current_user_id',$1,true)",[voter])
    await pg.query(`INSERT INTO public.ue_authority_approval_decisions(organization_id,approval_request_id,approver_user_id,authority_line_user_id,decision) VALUES($1,$2,$3,$3,'approved')`,[org,adoption,voter])
  }
  await pg.query("SELECT set_config('app.current_user_id','drafter',true)")
  await pg.query("UPDATE public.ue_authority_issuance_rules SET status='active',approved_by=ARRAY['adopter-one','adopter-two'],activated_at=now() WHERE id=$1",[caseRule])
  await pg.query("SELECT set_config('app.current_user_id','assigner',true)")
  await pg.query(`INSERT INTO public.ue_authority_resource_relationships(organization_id,principal_user_id,resource_type,resource_id,relation,origin,granted_by,issuance_rule_id,effective_at) VALUES($1,$2,'case',$3,'assignee','explicit','assigner',$4,now()-interval '1 hour')`,[org,actor,caseId,caseRule])
  await pg.query(`INSERT INTO audit_logs(id,audit_id,created_at,updated_at,organization_id,action,details) SELECT gen_random_uuid(),gen_random_uuid(),clock_timestamp(),clock_timestamp(),$1,'authority.fixture',jsonb_build_object('authorityEventIds',jsonb_agg(id::text)) FROM public.ue_authority_events WHERE organization_id=$1`,[org])
  await pg.exec('COMMIT')
}
