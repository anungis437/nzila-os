/** SQL component qualification with explicit synthetic identity/approval seams; not native auth or institutional adoption. */
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pgDriver from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { describe, expect, it } from 'vitest';
import * as scopes from '../schema/domains/claims/case-authority-scope';
import * as authority from '../schema/domains/ml/authority-kernel';
import { CASE_SCOPE_PHYSICAL_GUARDS as contract } from './case-scope-physical-guards';
import { inspectPhysicalGuards, planPhysicalGuards, applyPhysicalGuards } from './physical-guard-catalog';
import { applyCaseScope, ensureCaseAuthorityScope, proposeCaseScope, bindCaseGrievanceMirror } from '@/lib/authority/store/case-scope';
import { runAuthorityTransaction, type SqlExecutor } from '@/lib/authority/store/executor';
import type { EnforcementDeps } from '@/lib/authority/store/enforce';

interface ComponentDb extends SqlExecutor { exec(sql: string): Promise<unknown>; close(): Promise<void> }
async function ownedNativeComponent(): Promise<ComponentDb> {
  const owner=randomUUID(), name=`ue-step1-case-scope-${owner}`, password=randomUUID();
  const image='pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337';
  const container=execFileSync('docker',['run','-d','--platform','linux/amd64','--pull','never','--name',name,'--label','nzila.mission=UE_STEP1_CASE_SCOPE_COMPONENT',
    '--label',`nzila.qualification-owner=${owner}`,'--memory','1g','--cpus','2','--tmpfs','/var/lib/postgresql/data:rw,size=384m',
    '-p','127.0.0.1::5432','-e',`POSTGRES_PASSWORD=${password}`,image],{encoding:'utf8'}).trim();
  let client: pgDriver.Client | undefined;
  const close=async()=>{
    await client?.end();
    const [record]=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}));
    if(record.Id!==container||record.Name!==`/${name}`||record.Config.Labels['nzila.qualification-owner']!==owner||record.Config.Labels['nzila.mission']!=='UE_STEP1_CASE_SCOPE_COMPONENT') throw new Error('Owned component cleanup identity mismatch');
    execFileSync('docker',['rm','-f',container],{stdio:'pipe'});
  };
  try {
    for(let i=0;;i++){
      try{execFileSync('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'pipe'});break;}
      catch(error){if(i>=80)throw error;await new Promise(resolve=>setTimeout(resolve,100));}
    }
    const port=Number(execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).trim().split(':').at(-1));
    if(!Number.isInteger(port)||port<1)throw new Error('Owned localhost PostgreSQL port missing');
    client=new pgDriver.Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres'});await client.connect();
    const connected=client;
    return {exec:async text=>connected.query(text),query:async<T>(text:string,params?:unknown[])=>({rows:(await connected.query(text,params)).rows as T[]}),close};
  }catch(error){await close();throw error;}
}

async function fixture() {
  const pg:ComponentDb = process.env.UE_CASE_SCOPE_NATIVE==='1' ? await ownedNativeComponent() : new PGlite();
  try {
  const org = randomUUID(), foreignOrg = randomUUID(), caseId = randomUUID(), unit = randomUUID(), territory = randomUUID(), rule = randomUUID();
  await pg.exec(`CREATE ROLE ue_v2_owner; CREATE ROLE union_eyes_runtime; CREATE ROLE union_eyes_system;
    GRANT CREATE ON SCHEMA public TO ue_v2_owner; CREATE SCHEMA user_management; GRANT USAGE ON SCHEMA user_management TO ue_v2_owner,union_eyes_runtime;
    SET ROLE ue_v2_owner;
    CREATE TABLE claims(id uuid PRIMARY KEY,claim_id uuid UNIQUE,organization_id uuid,member_id text,created_at timestamptz DEFAULT now());
    CREATE TABLE grievances(id uuid PRIMARY KEY,organization_id uuid,created_by text,grievant_id uuid,represented_member_user_id varchar(255),created_at timestamptz DEFAULT now(),is_confidential boolean DEFAULT false,has_legal_implications boolean DEFAULT false);
    CREATE TABLE bargaining_units(id uuid PRIMARY KEY,organization_id uuid,status text);
    RESET ROLE; CREATE TABLE user_management.users(user_id varchar(255) PRIMARY KEY,is_active boolean DEFAULT true,lifecycle_state text DEFAULT 'active');
    CREATE TABLE user_management.organization_users(user_id varchar(255),organization_id uuid,role text,is_active boolean DEFAULT true);
    GRANT SELECT ON ALL TABLES IN SCHEMA user_management TO ue_v2_owner,union_eyes_runtime; GRANT REFERENCES(user_id) ON user_management.users TO ue_v2_owner;
    CREATE FUNCTION user_management.auth_business_org_authorized(row_org uuid,roles text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT row_org=nullif(current_setting('app.current_org_id',true),'')::uuid AND EXISTS(SELECT FROM user_management.users u JOIN user_management.organization_users m USING(user_id)
      WHERE u.user_id=current_setting('app.current_user_id',true) AND u.is_active AND u.lifecycle_state='active' AND m.is_active AND m.organization_id=row_org AND (roles IS NULL OR m.role=ANY(roles))) $$;
    CREATE FUNCTION user_management.ue_authority_membership_rows(row_org uuid,ids text[]) RETURNS TABLE(user_id text,organization_id uuid,role text,member_active boolean,user_active boolean,lifecycle_state text)
      LANGUAGE sql STABLE AS $$ SELECT u.user_id::text,m.organization_id,m.role,m.is_active,u.is_active,u.lifecycle_state FROM user_management.users u JOIN user_management.organization_users m USING(user_id)
        WHERE m.organization_id=row_org AND u.user_id=ANY(ids) AND user_management.auth_business_org_authorized(row_org,NULL::text[]) $$;
    CREATE TABLE audit_logs(id uuid PRIMARY KEY,audit_id uuid UNIQUE NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,organization_id uuid,action varchar(100),resource_type varchar(255),resource_id varchar(255),user_id varchar(255),ip_address inet,user_agent text,correlation_id uuid,details jsonb DEFAULT '{}'::jsonb,changes jsonb DEFAULT '{}'::jsonb,content_hash varchar(64),previous_hash varchar(64));
    GRANT SELECT,INSERT ON audit_logs TO ue_v2_owner,union_eyes_runtime; SET ROLE ue_v2_owner;`);
  const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson({ ...authority, ...scopes }));
  for (const sql of [...ddl.filter(s => !s.startsWith('ALTER TABLE')), ...ddl.filter(s => s.startsWith('ALTER TABLE'))]) await pg.exec(sql);
  for (const table of contract.tables) await pg.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
    CREATE POLICY fixture_owner ON ${table} TO ue_v2_owner USING(true) WITH CHECK(true);
    CREATE POLICY fixture_tenant ON ${table} TO union_eyes_runtime USING(organization_id=nullif(current_setting('app.current_org_id',true),'')::uuid) WITH CHECK(organization_id=nullif(current_setting('app.current_org_id',true),'')::uuid);
    GRANT SELECT,INSERT,UPDATE ON ${table} TO union_eyes_runtime;`);
  // Other authority relations are needed by the real fact loader, but their issuance/vote state is synthetic fixture input.
  for (const table of Object.values(authority).filter(x => typeof x === 'object')) { void table; }
  await pg.exec('RESET ROLE; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO union_eyes_runtime; SET ROLE ue_v2_owner;');
  const execute = async (sql: string) => (await pg.query(sql)).rows as Record<string, unknown>[];
  const plan = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute));
  await pg.exec('BEGIN'); await applyPhysicalGuards(contract, execute, plan.fingerprint); await pg.exec('COMMIT;RESET ROLE');
  for (const user of ['issuer','approver','approver-two','member','respondent','outsider','former']) {
    await pg.query('INSERT INTO user_management.users(user_id) VALUES($1)', [user]);
    await pg.query('INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,$3,$4)', [user, org, user === 'member' ? 'member' : user.startsWith('approver') ? 'president' : 'officer', user !== 'former']);
  }
  await pg.query('INSERT INTO claims(id,claim_id,organization_id,member_id) VALUES($1,$1,$2,$3)', [caseId, org, 'member']);
  await pg.query("INSERT INTO bargaining_units VALUES($1,$2,'active')", [unit, org]);
  await pg.query('INSERT INTO case_territories(id,organization_id,name,source_instrument,recorded_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,now(),now())', [territory, org, 'Synthetic territory', 'Synthetic instrument; no live adoption', 'issuer']);
  await pg.query(`INSERT INTO ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,version,status,source_instrument,drafted_by,required_independent_approvals)
    VALUES($1,$2,'case_assignment','amend',ARRAY['officer'],ARRAY['scope'],1,'active','SYNTHETIC_TEST_ONLY','approver',1)`, [rule, org]);
  await pg.query(`INSERT INTO ue_authority_mandates(id,organization_id,principal_user_id,kind,powers,scope,source_instrument,granted_by,status,effective_at,expires_at)
    VALUES($1,$2,'issuer','supervisory',ARRAY['read','assign'],$3,'SYNTHETIC_TEST_ONLY','approver','active',now()-interval '1 hour',now()+interval '1 day')`, [randomUUID(), org, { resourceIds: [caseId] }]);
  const memberships: EnforcementDeps['memberships'] = async (exec, requestedOrg, users) => {
    const result = await exec.query<{ user_id: string; role: string; member_active: boolean }>('SELECT user_id,role,member_active FROM user_management.ue_authority_membership_rows($1,$2::text[])', [requestedOrg, [...users]]);
    return result.rows.map(r => ({ userId: r.user_id, organizationId: requestedOrg, status: r.member_active ? 'active' as const : 'inactive' as const, capacities: r.role === 'member' ? ['member'] : r.role === 'president' ? ['member','officer','executive'] : ['member','officer'] }));
  };
  const deps: EnforcementDeps = { memberships, resources: async (exec, req) => {
    if (req.resource.id !== caseId || req.organizationId !== org) return null;
    const rs = (await exec.query<{ respondent_user_id: string }>('SELECT p.respondent_user_id FROM case_respondents p JOIN case_authority_scopes s ON s.id=p.scope_id AND s.organization_id=p.organization_id WHERE s.case_id=$1 AND s.organization_id=$2 AND p.revoked_at IS NULL', [caseId, org])).rows;
    return { resource: { kind:'case',id:caseId,organizationId:org,unitId:null,territoryId:null,classification:'standard',confidential:false,counselControlled:false,adverseUserIds:rs.map(r=>r.respondent_user_id) } };
  } };
  const run = async <T>(fn: (exec: SqlExecutor) => Promise<T>, actor='issuer', tenant=org) => {
    await pg.exec('SET ROLE union_eyes_runtime');
    try { return await runAuthorityTransaction(pg, { organizationId:tenant,userId:actor }, fn); }
    finally { await pg.exec('RESET ROLE'); }
  };
  const approve = async (request: string) => {
    await pg.query("UPDATE ue_authority_approval_requests SET status='satisfied',decided_at=now() WHERE id=$1", [request]);
    for(const approver of ['approver','approver-two']) await pg.query("INSERT INTO ue_authority_approval_decisions(id,organization_id,approval_request_id,approver_user_id,authority_line_user_id,decision) VALUES($1,$2,$3,$4,$4,'approved')", [randomUUID(), org, request, approver]);
  };
  const input = { organizationId:org,caseId,actorUserId:'issuer',unitId:unit,territoryId:territory,respondentUserIds:['respondent'],expectedRevision:0,namedApproverIds:['approver','approver-two'] };
  return { pg,org,foreignOrg,caseId,unit,territory,rule,deps,run,approve,input };
  }catch(error){await pg.close();throw error;}
}

describe('governed logical case scope and respondent persistence', () => {
  it('persists an independently approved scope and exact canonical party, refusing replay and retaining revoked history', async () => {
    const f=await fixture(); try {
      const p=await f.run(tx=>proposeCaseScope(tx,f.deps,f.input));
      await expect(f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:p.proposalId}))).rejects.toThrow('APPROVAL');
      await f.approve(p.approvalRequestId);
      await f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:p.proposalId}));
      expect((await f.pg.query('SELECT unit_id,territory_id,revision FROM case_authority_scopes')).rows).toEqual([{unit_id:f.unit,territory_id:f.territory,revision:1}]);
      await expect(f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:p.proposalId}))).rejects.toThrow('STALE');
      const next=await f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,expectedRevision:1,respondentUserIds:[]}));
      await f.approve(next.approvalRequestId);await f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:next.proposalId}));
      const rows=(await f.pg.query('SELECT respondent_user_id,revoked_at,revoked_by FROM case_respondents')).rows;
      expect(rows).toHaveLength(1);expect(rows[0].respondent_user_id).toBe('respondent');expect(rows[0].revoked_at).not.toBeNull();expect(rows[0].revoked_by).toBe('issuer');
    } finally {await f.pg.close();}
  });
  it('refuses role-only/foreign/removed actors, foreign references, blank authority, self-adversity and unknown principal without mutation', async()=>{
    const f=await fixture();try{
      await expect(f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,actorUserId:'outsider'}),'outsider')).rejects.toThrow();
      await expect(f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,actorUserId:'former'}),'former')).rejects.toThrow();
      await expect(f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,organizationId:f.foreignOrg}),'issuer',f.foreignOrg)).rejects.toThrow();
      await expect(f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,unitId:randomUUID()}))).rejects.toThrow('UNIT');
      await expect(f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,respondentUserIds:['issuer']}))).rejects.toThrow('ADVERSE');
      await f.pg.query("UPDATE ue_authority_issuance_rules SET allowed_powers=ARRAY[]::text[] WHERE id=$1",[f.rule]);
      await expect(f.run(tx=>proposeCaseScope(tx,f.deps,f.input))).rejects.toThrow('RULE');
      expect((await f.pg.query('SELECT * FROM case_scope_proposals')).rows).toHaveLength(0);
    }finally{await f.pg.close();}
  });
  it('blocks direct parent/substitution/partial writes and rolls back all scope changes if mandatory audit fails',async()=>{
    const f=await fixture();try{
      const p=await f.run(tx=>proposeCaseScope(tx,f.deps,f.input));await f.approve(p.approvalRequestId);
      await expect(f.run(async tx=>{await tx.query('UPDATE case_scope_proposals SET unit_id=NULL WHERE id=$1',[p.proposalId]);})).rejects.toThrow('IMMUTABLE');
      await expect(f.run(async tx=>{await tx.query('UPDATE case_authority_scopes SET case_id=$1',[randomUUID()]);})).rejects.toThrow('PARENT_IMMUTABLE');
      await f.pg.exec("CREATE FUNCTION fail_scope_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='case.scope.amended' THEN RAISE EXCEPTION 'synthetic audit outage';END IF;RETURN NEW;END $$;CREATE TRIGGER fail_scope_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_scope_audit();");
      await expect(f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:p.proposalId}))).rejects.toThrow('synthetic audit outage');
      expect((await f.pg.query('SELECT revision,unit_id,territory_id FROM case_authority_scopes')).rows).toEqual([{revision:0,unit_id:null,territory_id:null}]);
      expect((await f.pg.query('SELECT * FROM case_respondents')).rows).toHaveLength(0);
    }finally{await f.pg.close();}
  });
  it('binds an authorized same-id grievance mirror to a non-UUID canonical member and protects the subject from later substitution',async()=>{
    const f=await fixture();try{
      await f.run(tx=>ensureCaseAuthorityScope(tx,f.deps,f.input));
      await f.pg.query(`INSERT INTO ue_authority_resource_relationships(id,organization_id,principal_user_id,resource_type,resource_id,relation,origin,granted_by,status,effective_at)
        VALUES($1,$2,'issuer','case',$3,'assignee','explicit','approver','active',now()-interval '1 hour')`,[randomUUID(),f.org,f.caseId]);
      await f.run(async tx=>{
        await tx.query('INSERT INTO grievances(id,organization_id,created_by,represented_member_user_id) VALUES($1,$2,$3,$4)',[f.caseId,f.org,'issuer','member']);
        await bindCaseGrievanceMirror(tx,f.deps,f.input);
      });
      const row=(await f.pg.query('SELECT claim_id,grievance_id,grievance_mirror_id,mirror_recorded_by,unit_id FROM case_authority_scopes')).rows[0];
      expect(row).toEqual({claim_id:f.caseId,grievance_id:null,grievance_mirror_id:f.caseId,mirror_recorded_by:'issuer',unit_id:null});
      await expect(f.run(async tx=>{await tx.query("UPDATE grievances SET represented_member_user_id='outsider' WHERE id=$1",[f.caseId]);})).rejects.toThrow('SUBJECT_IMMUTABLE');
      await expect(f.run(async tx=>{await tx.query("UPDATE case_authority_scopes SET mirror_recorded_by='approver' WHERE case_id=$1",[f.caseId]);})).rejects.toThrow('MIRROR_REQUIRED');
    }finally{await f.pg.close();}
  });
  it('refuses unbound raw-SQL mirrors, foreign canonical parents and partial approved settlements without an audit',async()=>{
    const f=await fixture();try{
      await expect(f.run(async tx=>{await tx.query("INSERT INTO grievances(id,organization_id,created_by,represented_member_user_id) VALUES($1,$2,'issuer','member')",[f.caseId,f.org]);})).rejects.toThrow('PROVENANCE_REQUIRED');
      await expect(f.run(async tx=>{await tx.query('INSERT INTO case_authority_scopes(id,organization_id,case_id,claim_id,revision,created_at,updated_at) VALUES($1,$2,$3,$4,0,now(),now())',[randomUUID(),f.org,randomUUID(),f.caseId]);})).rejects.toThrow();
      const p=await f.run(tx=>proposeCaseScope(tx,f.deps,f.input));await f.approve(p.approvalRequestId);
      await expect(f.run(async tx=>{await tx.query('UPDATE case_authority_scopes SET unit_id=$1,territory_id=$2,revision=1,last_proposal_id=$3 WHERE organization_id=$4',[f.unit,f.territory,p.proposalId,f.org]);})).rejects.toThrow('ATOMIC_AUDIT');
      expect((await f.pg.query('SELECT revision FROM case_authority_scopes')).rows[0].revision).toBe(0);
    }finally{await f.pg.close();}
  });
  it('retains zero authority changes for an unknown canonical party and rejects stale competing proposals',async()=>{
    const f=await fixture();try{
      const bad=await f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,respondentUserIds:['not-a-canonical-principal']}));await f.approve(bad.approvalRequestId);
      await expect(f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:bad.proposalId}))).rejects.toThrow('foreign key');
      expect((await f.pg.query('SELECT revision FROM case_authority_scopes')).rows[0].revision).toBe(0);
      const first=await f.run(tx=>proposeCaseScope(tx,f.deps,f.input));const second=await f.run(tx=>proposeCaseScope(tx,f.deps,f.input));
      await f.approve(first.approvalRequestId);await f.approve(second.approvalRequestId);
      await f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:first.proposalId}));
      await expect(f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:second.proposalId}))).rejects.toThrow('STALE');
      expect((await f.pg.query('SELECT revision FROM case_authority_scopes')).rows[0].revision).toBe(1);
    }finally{await f.pg.close();}
  });
  it('rechecks independent approver activity/capacity, issuer revocation and malformed respondent facts before settlement',async()=>{
    const f=await fixture();try{
      await expect(f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,respondentUserIds:['respondent','respondent']}))).rejects.toThrow('INVALID_SCOPE');
      await expect(f.run(tx=>proposeCaseScope(tx,f.deps,{...f.input,respondentUserIds:[' invalid ']}))).rejects.toThrow('INVALID_SCOPE');
      const p=await f.run(tx=>proposeCaseScope(tx,f.deps,f.input));await f.approve(p.approvalRequestId);
      await f.pg.query("UPDATE user_management.organization_users SET role='member' WHERE user_id='approver-two'");
      await expect(f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:p.proposalId}))).rejects.toThrow('INDEPENDENT');
      await f.pg.query("UPDATE user_management.organization_users SET role='president' WHERE user_id='approver-two'");
      await f.pg.query("UPDATE ue_authority_mandates SET revoked_at=now(),status='revoked' WHERE principal_user_id='issuer'");
      await expect(f.run(tx=>applyCaseScope(tx,f.deps,{...f.input,proposalId:p.proposalId}))).rejects.toThrow();
      expect((await f.pg.query('SELECT revision FROM case_authority_scopes')).rows[0].revision).toBe(0);
    }finally{await f.pg.close();}
  });
  it('refuses deferred commit when an independently approved line becomes ineligible after the writes',async()=>{
    const f=await fixture();try{
      const p=await f.run(tx=>proposeCaseScope(tx,f.deps,f.input));await f.approve(p.approvalRequestId);
      await expect(f.run(async tx=>{
        await applyCaseScope(tx,f.deps,{...f.input,proposalId:p.proposalId});
        // Privileged synthetic state fault, not an application authority path. The deferred invariant must still refuse it.
        await f.pg.exec("RESET ROLE;UPDATE user_management.organization_users SET role='member' WHERE user_id='approver-two';SET ROLE union_eyes_runtime;");
      })).rejects.toThrow('ATOMIC_AUDIT_AND_SETTLEMENT');
      expect((await f.pg.query('SELECT revision FROM case_authority_scopes')).rows[0].revision).toBe(0);
      expect((await f.pg.query('SELECT * FROM case_respondents')).rows).toHaveLength(0);
    }finally{await f.pg.close();}
  });
});
