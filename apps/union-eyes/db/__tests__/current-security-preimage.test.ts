import path from 'node:path'
import {readFileSync} from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  planLegacyAuthPolicyReplacement, planLegacyJournalReplacement, readLegacySecurityReferences,
  planLegacyFrameworkFunctionReplacement, planExistingFrameworkPolicies,
  planLegacyFrameworkLedgerPolicy, frameworkPolicyPreimageQuery,
  planLegacyPhysicalFunctionAdoption,
  type LegacyAuthPolicy, type LegacyJournalFunction, type LegacyJournalTrigger,
} from '../../../../tooling/scripts/lib/union-eyes-current-security-preimage'
import { projectCurrentCompilerSecurity } from '../../../../tooling/scripts/lib/union-eyes-current-security-contract'
import { AUTHORITY_PHYSICAL_GUARDS } from '../auth/authority-physical-guards'
import {parseSql} from '../../scripts/lib/sql-census/parse'

const root = path.resolve(import.meta.dirname, '../../../..')
const reference = readLegacySecurityReferences(root)['apps/union-eyes/db/migrations-platform/0049_claim_status_transitions.sql']
const owner = 'uev2admin'
async function journal() {
  const source = await projectCurrentCompilerSecurity([reference], owner, { immutableReferenceOnly: true })
  const functions: LegacyJournalFunction[] = source.functions.map(fn => ({
    name: fn.name, owner: fn.owner,
    body: reference.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn.name}\\(\\) RETURNS trigger[\\s\\S]*?AS \\$fn\\$([\\s\\S]*?)\\$fn\\$;`))![1],
    language: fn.language, returns: fn.returns, args: '', definer: fn.definer,
    volatility: fn.volatility, config: fn.config, strict: fn.strict, leakproof: fn.leakproof,
    returns_set: fn.returnsSet, execute_acl: fn.executeAcl,
  }))
  const triggers: LegacyJournalTrigger[] = functions.map(fn => ({
    table_schema: 'public', table_name: 'claims', name: fn.name, function_name: fn.name, function_schema: 'public',
    tgtype: fn.definer ? 21 : 23, tgenabled: 'O', tgdeferrable: false, tginitdeferred: false,
    columns: fn.definer ? ['status'] : [], has_condition: false, args_hex: '',
  }))
  return { functions, triggers }
}
const self = "((user_id)::text = current_setting('app.current_user_id'::text, true))"
const auth: LegacyAuthPolicy[] = [
  ['users','ue_auth_users_self_select','r','union_eyes_runtime',self,null],
  ['organization_users','ue_auth_organization_users_self_select','r','union_eyes_runtime',self,null],
  ['users','ue_auth_bootstrap_users_select_system','r','union_eyes_system','true',null],
  ['users','ue_auth_bootstrap_users_update_system','w','union_eyes_system','true','true'],
  ['organization_users','ue_auth_bootstrap_organization_users_system','r','union_eyes_system','true',null],
  ['auth_audit_log','ue_auth_bootstrap_audit_system','*','union_eyes_system','true','true'],
  ['mfa_totp','ue_auth_bootstrap_mfa_system','r','union_eyes_system','true',null],
  ['org_auth_policies','ue_auth_bootstrap_org_policies_system','r','union_eyes_system','true',null],
  ['user_sessions','ue_auth_bootstrap_sessions_system','*','union_eyes_system','true','true'],
  ['users','ue_framework_authority_reader_select','r','ue_framework_authority_reader','true',null],
  ['user_sessions','ue_framework_authority_reader_select','r','ue_framework_authority_reader','true',null],
].map(([table_name,name,cmd,role,qual,with_check]) => ({ table_name: table_name!, name: name!, cmd: cmd!, roles: [role!], qual, with_check, permissive: true }))

describe('exact released legacy security preimages', () => {
  it('reads immutable reference bytes and retires exactly the two original journal writers', async () => {
    const { functions, triggers } = await journal()
    expect(planLegacyJournalReplacement(reference, owner, functions, triggers)).toEqual([
      'DROP TRIGGER "ue_claims_stamp_status_changed" ON public.claims',
      'DROP TRIGGER "ue_claims_record_status_transition" ON public.claims',
      'DROP FUNCTION public."ue_claims_stamp_status_changed"()',
      'DROP FUNCTION public."ue_claims_record_status_transition"()',
    ])
  })

  it.each([
    { owner: 'someone_else' }, { body: 'BEGIN RETURN NULL; END;' }, { args: 'uuid' },
    { config: ['search_path=public'] }, { definer: true }, { volatility: 's' },
    { strict: true }, { leakproof: true }, { returns_set: true },
    { execute_acl: [{ role: owner, grantable: false }, { role: 'union_eyes_system', grantable: false }] },
  ])('refuses function preimage drift without replacement', async change => {
    const { functions, triggers } = await journal()
    const index = functions.findIndex(fn => fn.name === 'ue_claims_stamp_status_changed')
    functions[index] = { ...functions[index], ...change }
    expect(() => planLegacyJournalReplacement(reference, owner, functions, triggers)).toThrow(/preimage differs/)
  })

  it.each([
    { tgtype: 17 }, { tgenabled: 'D' }, { tgdeferrable: true }, { columns: ['organization_id'] },
    { function_schema: 'pg_temp' }, { table_schema: 'pg_temp' }, { has_condition: true }, { args_hex: '00' },
  ])('refuses trigger drift without dropping it', async change => {
    const { functions, triggers } = await journal()
    triggers[0] = { ...triggers[0], ...change }
    expect(() => planLegacyJournalReplacement(reference, owner, functions, triggers)).toThrow(/preimage differs/)
  })

  it('refuses missing or extra journal functions and triggers', async () => {
    const { functions, triggers } = await journal()
    for (const [f,t] of [[functions.slice(1),triggers],[functions,triggers.slice(1)],[functions.concat(functions[0]),triggers]] as const)
      expect(() => planLegacyJournalReplacement(reference, owner, f, t)).toThrow(/preimage/)
  })

  it('retires exactly the known auth policies and rejects unknown, partial or changed policies', () => {
    expect(planLegacyAuthPolicyReplacement(auth)).toHaveLength(11)
    for (const rows of [auth.slice(1), auth.concat(auth[0]), auth.map((row,i) => i ? row : { ...row, qual: 'true' }), auth.map((row,i) => i ? row : { ...row, roles: ['PUBLIC'] })])
      expect(() => planLegacyAuthPolicyReplacement(rows)).toThrow(/preimage/)
  })

  it('upgrades only exact released framework functions using parsed current statements', async () => {
    const released = readLegacySecurityReferences(root)['apps/union-eyes/db/migrations-cache/0017_snapshot_authority_reconciliation.sql']
    const declarations = [...released.matchAll(/EXECUTE \$fn\$([\s\S]*?)\$fn\$;/g)].map(match => match[1])
    const metadata = [...released.matchAll(/EXECUTE '((?:[^']|'')*)';/g)].map(match => match[1].replaceAll("''", "'"))
      .filter(statement => /^(ALTER FUNCTION|REVOKE ALL ON FUNCTION|GRANT EXECUTE ON FUNCTION) user_management\.ue_framework_(actor|admin)_authorized\(\)/.test(statement))
    const expected = await projectCurrentCompilerSecurity([...declarations,...metadata], owner, { immutableReferenceOnly: true })
    const actual = expected.functions.map(fn => ({ ...fn, body: declarations.find(sql => sql.includes(fn.name))!.match(/AS \$body\$([\s\S]*?)\$body\$/)![1] }))
    const current = ['actor','admin'].map(kind => `CREATE FUNCTION user_management.ue_framework_${kind}_authorized() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $new$ SELECT true $new$;`).join('\n')
    const replacement = await planLegacyFrameworkFunctionReplacement(root, current, actual)
    expect(replacement).toHaveLength(2)
    expect(replacement.every(row => row.replacementSql.startsWith('CREATE OR REPLACE FUNCTION'))).toBe(true)
    for (const change of [{ body: 'SELECT true' }, { owner: 'other' }, { signature: 'user_management.ue_framework_actor_authorized(text)' }, { config: ['search_path=public'] }, { volatility: 'v' }, { executeAcl: [{role:'PUBLIC',grantable:false}] }])
      await expect(planLegacyFrameworkFunctionReplacement(root,current,[{...actual[0],...change},actual[1]])).rejects.toThrow(/preimage/)
    await expect(planLegacyFrameworkFunctionReplacement(root,current,actual.concat(actual[0]))).rejects.toThrow(/preimage/)
  })

  it('adopts only structurally identical current framework policies and exact source identities', async () => {
    const current = `CREATE POLICY ue_framework_identity_select ON public.auth_user FOR SELECT TO ue_framework_identity
      USING(user_management.ue_framework_actor_authorized() AND (username='member' AND is_active));`
    const row = { schema:'public',table:'auth_user',name:'ue_framework_identity_select',command:'r',permissive:true,roles:['ue_framework_identity'],using:"user_management.ue_framework_actor_authorized() AND ((username)::text = 'member'::text) AND is_active",check:null }
    expect(await planExistingFrameworkPolicies(current,[row])).toHaveLength(1)
    for (const change of [{using:'true'}, {using:row.using+' OR true'}, {using:row.using.replace('member','other')}, {roles:['union_eyes_runtime']}, {command:'*'}, {permissive:false}, {check:'true'}])
      await expect(planExistingFrameworkPolicies(current,[{...row,...change}])).rejects.toThrow(/preimage/)
    await expect(planExistingFrameworkPolicies(current,[row,{...row,name:'unknown'}])).rejects.toThrow(/Unexpected/)
    await expect(planExistingFrameworkPolicies(current,[row,row])).rejects.toThrow(/preimage/)
    await expect(planExistingFrameworkPolicies(current,[{...row,table:'outside_expected_table'}])).rejects.toThrow(/Unexpected/)
    const query = await frameworkPolicyPreimageQuery(current)
    expect(query).toContain("c.relname IN('auth_user','django_migrations')")
    expect(query).toContain("r.rolname LIKE 'ue_framework_%'")
  })

  it('retires only the exact inherited migration recorder policy while preserving its table', () => {
    const row = {schema:'public',table:'django_migrations',name:'ue_framework_admin',command:'*',permissive:true,roles:['ue_framework_admin'],using:'user_management.ue_framework_admin_authorized()',check:'user_management.ue_framework_admin_authorized()'}
    expect(planLegacyFrameworkLedgerPolicy(root,[row])).toEqual(['DROP POLICY "ue_framework_admin" ON public."django_migrations"'])
    for (const changed of [{...row,using:'true'},{...row,roles:['union_eyes_system']},{...row,name:'unreviewed'}])
      expect(()=>planLegacyFrameworkLedgerPolicy(root,[changed])).toThrow(/preimage/)
    expect(()=>planLegacyFrameworkLedgerPolicy(root,[row,row])).toThrow(/preimage/)
  })

  it('adopts released authority functions by metadata only and rejects altered preimages', async()=>{
    const sources=AUTHORITY_PHYSICAL_GUARDS.references.map(ref=>readFileSync(path.join(root,ref.path),'utf8'))
    const projected=await projectCurrentCompilerSecurity(sources,owner,{immutableReferenceOnly:true})
    const bodies=new Map<string,string>()
    for(const sql of sources){
      const parsed=await parseSql(sql)
      if(!parsed.ok)throw new Error('Released reference must parse')
      for(const node of parsed.statements){
        const fn=node.CreateFunctionStmt
        if(fn)bodies.set(fn.funcname.at(-1).String.sval,fn.options.find((o:Record<string,Record<string,unknown>>)=>o.DefElem.defname==='as').DefElem.arg.List.items[0].String.sval)
      }
    }
    const actual=projected.functions.map(fn=>({...fn,body:bodies.get(fn.name)!}))
    const plan=await planLegacyPhysicalFunctionAdoption(root,AUTHORITY_PHYSICAL_GUARDS,actual,owner)
    expect(plan.adoptedNames.length).toBeGreaterThan(8)
    expect(plan.statements.every(sql=>/^(ALTER FUNCTION|REVOKE ALL ON FUNCTION|GRANT EXECUTE ON FUNCTION)/.test(sql))).toBe(true)
    const target=actual.find(row=>plan.adoptedNames.includes(`public.${row.name}`))!
    for(const change of [{body:'BEGIN RETURN NULL; END;'}, {owner:'other'}, {config:['search_path=public']}, {volatility:'s'}, {executeAcl:[{role:'PUBLIC',grantable:true}]}]){
      const changed=actual.map(row=>row===target?{...row,...change}:row)
      await expect(planLegacyPhysicalFunctionAdoption(root,AUTHORITY_PHYSICAL_GUARDS,changed,owner)).rejects.toThrow(/preimage/)
    }
    await expect(planLegacyPhysicalFunctionAdoption(root,AUTHORITY_PHYSICAL_GUARDS,actual.concat({...target,signature:'public.'+target.name+'(uuid)'}),owner)).rejects.toThrow(/preimage/)
  })
})
