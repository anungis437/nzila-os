/** Component proof with explicit synthetic identity/rule adoption inputs; full native bootstrap remains separate. */
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'node:crypto'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema/domains/ml/authority-kernel'
import { AUTHORITY_PHYSICAL_GUARDS } from './authority-physical-guards'
import { AUTHORITY_ISSUER_GUARDS } from './authority-issuer-guards'
import { applyPhysicalGuards, inspectPhysicalGuards, planPhysicalGuards } from './physical-guard-catalog'
import { CASE_SCOPE_FACTS_FIXTURE_SQL } from '../__tests__/case-scope-facts-fixture'
import { runAuthorityTransaction } from '../../lib/authority/store/executor'
import { auditAuthorityMutation } from '../../lib/authority/store/audit'

async function fixture() {
  const pg=new PGlite(),org=randomUUID(),caseId=randomUUID(),scope=randomUUID()
  await pg.exec(`CREATE ROLE ue_v2_owner;CREATE ROLE union_eyes_runtime;CREATE ROLE union_eyes_system;
    GRANT CREATE ON SCHEMA public TO ue_v2_owner;CREATE SCHEMA user_management;
    GRANT USAGE ON SCHEMA user_management TO union_eyes_runtime;SET ROLE ue_v2_owner`)
  const ddl=await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema))
  for(const sql of [...ddl.filter(s=>!s.startsWith('ALTER TABLE')),...ddl.filter(s=>s.startsWith('ALTER TABLE'))])await pg.exec(sql)
  await pg.exec(`RESET ROLE;
    CREATE TABLE user_management.users(user_id text PRIMARY KEY,is_active boolean DEFAULT true,lifecycle_state text DEFAULT 'active');
    CREATE TABLE user_management.organization_users(user_id text,organization_id uuid,role text,is_active boolean DEFAULT true);
    GRANT SELECT ON ALL TABLES IN SCHEMA user_management TO union_eyes_runtime;
    CREATE FUNCTION user_management.ue_authority_membership_rows(row_org uuid,ids text[])
    RETURNS TABLE(user_id text,organization_id uuid,role text,member_active boolean,user_active boolean,lifecycle_state text)
    LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT u.user_id,m.organization_id,m.role,m.is_active,u.is_active,u.lifecycle_state
      FROM user_management.users u JOIN user_management.organization_users m USING(user_id)
      WHERE m.organization_id=row_org AND u.user_id=ANY(ids) AND row_org::text=current_setting('app.current_org_id',true) $$;
    CREATE TABLE public.claims(claim_id uuid PRIMARY KEY,organization_id uuid,member_id text);
    CREATE TABLE public.grievances(id uuid PRIMARY KEY,organization_id uuid,is_confidential boolean);
    CREATE TABLE public.audit_logs(id uuid PRIMARY KEY,audit_id uuid UNIQUE NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,organization_id uuid,action varchar(100),resource_type varchar(255),resource_id varchar(255),user_id varchar(255),ip_address inet,user_agent text,correlation_id uuid,details jsonb DEFAULT '{}',changes jsonb DEFAULT '{}',content_hash varchar(64),previous_hash varchar(64));`)
  await pg.exec(CASE_SCOPE_FACTS_FIXTURE_SQL)
  for(const [user,role] of [['issuer','president'],['holder','president'],['steward','steward'],['member','member']]) {
    await pg.query('INSERT INTO user_management.users(user_id) VALUES($1)',[user])
    await pg.query('INSERT INTO user_management.organization_users(user_id,organization_id,role) VALUES($1,$2,$3)',[user,org,role])
  }
  await pg.query('INSERT INTO public.claims VALUES($1,$2,$3)',[caseId,org,'member'])
  await pg.query('INSERT INTO public.case_authority_scopes(id,organization_id,case_id,claim_id) VALUES($1,$2,$3,$3)',[scope,org,caseId])
  const rules=new Map<string,string>()
  for(const domain of ['case_assignment','supervisory','executive_office','governance_review'])for(const operation of ['issue','revoke','suspend']) {
    const id=randomUUID();rules.set(domain+':'+operation,id)
    await pg.query(`INSERT INTO public.ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,version,status,source_instrument,drafted_by,required_independent_approvals,approved_by,activated_at,max_term_days)
      VALUES($1,$2,$3,$4,ARRAY['officer'],ARRAY['read','assign','review','approve'],1,'active','SYNTHETIC_COMPONENT_INPUT','adopter',0,ARRAY['adopter-one','adopter-two'],clock_timestamp(),30)`,[id,org,domain,operation])
  }
  await pg.query(`INSERT INTO public.ue_authority_mandates(organization_id,principal_user_id,kind,powers,scope,source_instrument,granted_by,effective_at,expires_at)
    VALUES($1,'issuer','supervisory',ARRAY['read','assign'],$2,'SYNTHETIC_COMPONENT_INPUT','adopter',now()-interval '1 hour',now()+interval '1 day')`,[org,{resourceIds:[caseId]}])
  for(const name of AUTHORITY_PHYSICAL_GUARDS.tables)await pg.exec(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;ALTER TABLE public.${name} FORCE ROW LEVEL SECURITY;
    CREATE POLICY fixture_runtime ON public.${name} TO union_eyes_runtime USING(organization_id::text=current_setting('app.current_org_id',true)) WITH CHECK(organization_id::text=current_setting('app.current_org_id',true));`)
  await pg.exec('GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO union_eyes_runtime;GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO union_eyes_runtime;SET ROLE ue_v2_owner')
  const execute=async(sql:string)=>(await pg.query(sql)).rows as Record<string,unknown>[]
  for(const contract of [AUTHORITY_PHYSICAL_GUARDS,AUTHORITY_ISSUER_GUARDS]) {
    const plan=planPhysicalGuards(contract,await inspectPhysicalGuards(contract,execute))
    await pg.exec('BEGIN');await applyPhysicalGuards(contract,execute,plan.fingerprint);await pg.exec('COMMIT')
  }
  await pg.exec('RESET ROLE')
  const run=async(sql:string,params:unknown[]=[],actor='issuer')=>{
    await pg.exec('SET ROLE union_eyes_runtime')
    try{return await runAuthorityTransaction(pg,{organizationId:org,userId:actor},async tx=>{
      const result=await tx.query(sql,params)
      await auditAuthorityMutation(tx,{organizationId:org,action:'qa.issuer',resourceType:'authority-component'})
      return result.rows
    })}finally{await pg.exec('RESET ROLE')}
  }
  const assignment=(actor='issuer',holder='steward')=>run(`INSERT INTO public.ue_authority_resource_relationships(organization_id,principal_user_id,resource_type,resource_id,relation,origin,granted_by,issuance_rule_id,effective_at,expires_at)
    VALUES($1,$2,'case',$3,'assignee','explicit',$4,$5,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day') RETURNING id`,[org,holder,caseId,actor,rules.get('case_assignment:issue')],actor)
  const mandate=(kind:string,holder='holder')=>run(`INSERT INTO public.ue_authority_mandates(organization_id,principal_user_id,kind,powers,scope,source_instrument,granted_by,effective_at,expires_at,issuance_rule_id)
    VALUES($1,$2,$3,$4,$5,'SYNTHETIC_COMPONENT_INPUT','issuer',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day',$6) RETURNING id`,
    [org,holder,kind,kind==='supervisory'?['read']:kind==='governance_review'?['review']:['approve'],{resourceIds:[caseId]},rules.get(kind+':issue')])
  return{pg,org,caseId,scope,run,assignment,mandate,execute}
}

describe('physical issuing authority and lifecycle',()=>{
  it('accepts a scoped independent assignment, refuses copied rule authority and preserves governed revocation',async()=>{
    const f=await fixture();try{
      await expect(f.assignment('steward','holder')).rejects.toThrow('ISSUER_AUTHORITY_REQUIRED')
      const [row]=await f.assignment()
      await f.run(`UPDATE public.ue_authority_resource_relationships SET status='revoked',revoked_at=clock_timestamp(),revoked_by='issuer' WHERE id=$1`,[row.id])
      expect((await f.pg.query('SELECT status FROM public.ue_authority_resource_relationships WHERE id=$1',[row.id])).rows[0].status).toBe('revoked')
      expect((await inspectPhysicalGuards(AUTHORITY_ISSUER_GUARDS,f.execute)).functions).toHaveLength(1)
    }finally{await f.pg.close()}
  })
  it('allows governed outgoing revocation after the holder membership becomes inactive',async()=>{
    const f=await fixture();try{
      const [row]=await f.assignment()
      await f.pg.query("UPDATE user_management.organization_users SET is_active=false WHERE user_id='steward'")
      await f.run("UPDATE public.ue_authority_resource_relationships SET status='revoked',revoked_at=clock_timestamp(),revoked_by='issuer' WHERE id=$1",[row.id])
      expect((await f.pg.query('SELECT status FROM public.ue_authority_resource_relationships WHERE id=$1',[row.id])).rows[0].status).toBe('revoked')
    }finally{await f.pg.close()}
  })
  it('refuses stale holder membership and recused case issuers without side effects',async()=>{
    const f=await fixture();try{
      await f.pg.query("UPDATE user_management.organization_users SET is_active=false WHERE user_id='steward'")
      await expect(f.assignment()).rejects.toThrow('ISSUER_AUTHORITY_REQUIRED')
      await f.pg.query("UPDATE user_management.organization_users SET is_active=true WHERE user_id='steward'")
      await f.run(`INSERT INTO public.ue_authority_recusals(organization_id,principal_user_id,resource_type,resource_id,reason) VALUES($1,'issuer','case',$2,'SYNTHETIC_COMPONENT_INPUT')`,[f.org,f.caseId])
      await expect(f.assignment()).rejects.toThrow('ISSUER_AUTHORITY_REQUIRED')
      expect((await f.pg.query('SELECT count(*)::int n FROM public.ue_authority_resource_relationships')).rows[0].n).toBe(0)
    }finally{await f.pg.close()}
  })
  it('permits suspension/resumption under the current rule but rejects a newly incompatible oversight holder',async()=>{
    const f=await fixture();try{
      const [row]=await f.mandate('executive_office')
      await f.run("UPDATE public.ue_authority_mandates SET status='suspended' WHERE id=$1",[row.id])
      await f.run("UPDATE public.ue_authority_mandates SET status='active' WHERE id=$1",[row.id])
      await expect(f.mandate('governance_review')).rejects.toThrow('SEGREGATION_OF_DUTIES')
    }finally{await f.pg.close()}
  })
  it('rejects oversight-first operational issuance and expired resumption',async()=>{
    const f=await fixture();try{
      const [row]=await f.mandate('governance_review')
      await expect(f.mandate('executive_office')).rejects.toThrow('SEGREGATION_OF_DUTIES')
      await f.run("UPDATE public.ue_authority_mandates SET status='suspended' WHERE id=$1",[row.id])
      // Owner changes only this disposable fixture's clock facts, never live records.
      await f.pg.exec("ALTER TABLE public.ue_authority_mandates DISABLE TRIGGER ALL")
      await f.pg.query("UPDATE public.ue_authority_mandates SET effective_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' WHERE id=$1",[row.id])
      await f.pg.exec("ALTER TABLE public.ue_authority_mandates ENABLE TRIGGER ALL")
      await expect(f.run("UPDATE public.ue_authority_mandates SET status='active' WHERE id=$1",[row.id])).rejects.toThrow('INSTRUMENT_INVALID')
    }finally{await f.pg.close()}
  })
})
