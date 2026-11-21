import { PGlite } from '@electric-sql/pglite'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compileSyntheticAuthFixtureSql } from './auth-fixture'
import { compileAuthBootstrapSql } from './auth-sql'
import { compileMinimumRoleProvisioningSql } from './minimum-installer'
import { compileSecurity } from './security'
import { reconcileCurrentDeclarationAuthority } from './current-authority'
import {
  MODULE_ADMISSION_DECLARATION_OWNERS, MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS,
} from './module-admission-storage-contract'
import type { V2Plan } from './source'

const plan = JSON.parse(readFileSync(new URL('../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json', import.meta.url), 'utf8')) as V2Plan
const tables = Object.keys(MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS)
const scopedPlan = { ...plan, tables: plan.tables.filter(table => tables.includes(table.name)).map(table => ({
  ...table, authority: reconcileCurrentDeclarationAuthority(table, table.authority),
})) }
const db = new PGlite()
const actors = [
  { role: 'member', platform: false }, { role: 'admin', platform: false }, { role: 'admin', platform: true },
].map(facts => ({ ...facts, user: randomUUID(), org: randomUUID(), bearer: randomUUID() + randomUUID(), contract: randomUUID(), line: randomUUID() }))
let history: unknown
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
const projection = (table: string) => MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS[table].select.map(quote).join(',')

async function scoped<T>(index: number, operation: () => Promise<T>, missing?: 'user' | 'org' | 'bearer', foreign = false) {
  const actor = actors[index]
  await db.exec('SET SESSION AUTHORIZATION ue_module_fixture; BEGIN; SET LOCAL ROLE union_eyes_runtime')
  try {
    await db.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)", [
      missing === 'user' ? '' : actor.user, missing === 'org' ? '' : actors[foreign ? (index + 1) % actors.length : index].org,
      missing === 'bearer' ? '' : actor.bearer,
    ])
    expect((await db.query('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows).toEqual([
      { current_user: 'union_eyes_runtime', session_user: 'ue_module_fixture', rolsuper: false, rolbypassrls: false },
    ])
    return await operation()
  } finally {
    await db.exec('ROLLBACK; RESET ROLE; SET SESSION AUTHORIZATION postgres; RESET ROLE')
  }
}
const snapshot = async () => Promise.all(tables.map(async table => ({ table, rows: (await db.query(`SELECT to_jsonb(t)::text AS row FROM public.${quote(table)} t ORDER BY to_jsonb(t)::text`)).rows })))

beforeAll(async () => {
  await db.exec(compileMinimumRoleProvisioningSql({ postgresMajor: 16 }))
  await db.exec(compileSyntheticAuthFixtureSql())
  await db.exec(compileAuthBootstrapSql({ rolesPreprovisioned: true, postgresMajor: 16 }))
  await db.exec('CREATE ROLE ue_module_fixture LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; GRANT union_eyes_runtime TO ue_module_fixture WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;')
  const creates = tables.map(table => {
    const declarations = plan.statements.filter(statement => statement.sql.startsWith(`CREATE TABLE "${table}" (`))
    expect(declarations).toHaveLength(1)
    return declarations[0].sql
  })
  for (const statement of plan.statements.filter(statement => statement.sql.startsWith('CREATE TYPE') && creates.some(sql => {
    const name = statement.sql.match(/^CREATE TYPE "public"\."([^"]+)"/)?.[1]
    return name && sql.includes(`"${name}"`)
  }))) await db.exec(statement.sql)
  for (const sql of creates) await db.exec(sql)
  for (const actor of actors) {
    await db.query('INSERT INTO user_management.users(user_id,email,is_system_admin) VALUES($1,$2,$3)', [actor.user, `${actor.user}@example.invalid`, actor.platform])
    await db.query('INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,$3,true)', [actor.user, actor.org, actor.role])
    const digest = createHash('sha256').update(actor.bearer).digest('hex')
    await db.query("INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,expires_at,is_active) VALUES($1,$2,$3,$3,now()+interval '1 hour',true)", [actor.user, actor.org, digest])
    await db.query("INSERT INTO commercial_contracts(id,organization_id,billing_account_id,contract_number,name,status,effective_date,expiration_date,total_contract_value,metadata) VALUES($1,$2,$3,$4,'Retained contract','active',now()-interval '1 day',now()+interval '1 year',987654.32,'{\"historical\":true}')", [actor.contract, actor.org, randomUUID(), actor.contract])
    await db.query("INSERT INTO contract_line_items(id,contract_id,line_type,feature_key,description,effective_date,unit_price,total_price,metadata) VALUES($1,$2,'module_license','grievance_case_suite','Retained line',now(),987.65,9876.54,'{\"historical\":true}')", [actor.line, actor.contract])
    await db.query("INSERT INTO org_entitlements(organization_id,contract_line_item_id,feature_key,status,expires_at,usage_limit,current_usage,metadata) VALUES($1,$2,'grievance_case_suite','active',now()+interval '1 year',10,1,'{\"historical\":true}')", [actor.org, actor.line])
    await db.query("INSERT INTO contract_covered_orgs(contract_id,organization_id,role) VALUES($1,$2,'local')", [actor.contract, actor.org])
  }
  history = await snapshot()
  const compiled = compileSecurity(scopedPlan)
  expect(compiled.blockers).toEqual([])
  await db.exec(compiled.statements.join('\n'))
}, 30000)
afterAll(async () => { await db.close() })

describe('existing module admission with bounded operational metadata', () => {
  it('retains all81financial Django models outside these four declaration-owned tables', () => {
    expect(plan.currentModels.models.filter(model => model.app === 'billing')).toHaveLength(81)
    expect(plan.currentModels.models.filter(model => tables.includes(model.table))).toEqual([])
    for (const table of scopedPlan.tables) {
      expect(table.source).toBe(MODULE_ADMISSION_DECLARATION_OWNERS[table.name])
      expect(() => reconcileCurrentDeclarationAuthority({ ...table, source: 'unreviewed-owner' }, table.authority)).toThrow('MODULE_ADMISSION_SOURCE_REQUIRED')
    }
  })

  it.each(actors.map((actor, index) => ({ ...actor, index })))('permits existing active metadata and backing-contract checks for $role platform=$platform', async actor => {
    await scoped(actor.index, async () => {
      expect((await db.query('SELECT user_management.auth_business_org_authorized($1,NULL::text[]) AS authorized', [actor.org])).rows).toEqual([{ authorized: true }])
      for (const table of tables) expect((await db.query(`SELECT ${projection(table)} FROM ${quote(table)}`)).rows).toHaveLength(1)
      // Exact live service query: no prices or other commercial details.
      expect((await db.query('SELECT cc.status,cc.expiration_date FROM commercial_contracts cc JOIN contract_line_items cli ON cli.contract_id=cc.id WHERE cli.id=$1 LIMIT 1', [actor.line])).rows).toMatchObject([{ status: 'active' }])
      expect((await db.query('SELECT cc.status FROM commercial_contracts cc JOIN contract_line_items cli ON cli.contract_id=cc.id WHERE cli.id=$1', [actors[(actor.index + 1) % actors.length].line])).rows).toEqual([])
    })
  })

  it.each(['user', 'org', 'bearer', 'foreign-org'] as const)('returns no metadata for %s context', async missing => {
    for (let index = 0; index < actors.length; index++) await scoped(index, async () => {
      for (const table of tables) expect((await db.query(`SELECT ${projection(table)} FROM ${quote(table)}`)).rows).toEqual([])
    }, missing === 'foreign-org' ? undefined : missing, missing === 'foreign-org')
  })

  it('denies every extra physical column and every mutation, including tenant and platform administrators', async () => {
    for (let index = 0; index < actors.length; index++) for (const table of scopedPlan.tables) {
      const allowed = MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS[table.name].select
      for (const column of table.columns.filter(column => !allowed.includes(column.name)))
        await expect(scoped(index, () => db.query(`SELECT ${quote(column.name)} FROM ${quote(table.name)}`))).rejects.toMatchObject({ code: '42501' })
      for (const operation of [
        `INSERT INTO ${quote(table.name)} DEFAULT VALUES`,
        `UPDATE ${quote(table.name)} SET ${quote(allowed[0])}=${quote(allowed[0])}`,
        `DELETE FROM ${quote(table.name)}`,
      ]) await expect(scoped(index, () => db.query(operation))).rejects.toMatchObject({ code: '42501' })
    }
    expect(await snapshot()).toEqual(history)
  })

  it('admits exactly seventeen SELECT columns, no broad table powers, system powers or mutation columns', async () => {
    const facts = (await db.query<{ table_name: string; column_name: string; role: string; privilege: string; allowed: boolean }>(`SELECT c.relname AS table_name,a.attname AS column_name,r.role,v.privilege,
      has_column_privilege(r.role,c.oid,a.attname,v.privilege) AS allowed
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum<>0 AND NOT a.attisdropped
      CROSS JOIN(VALUES('union_eyes_runtime'),('union_eyes_system'))r(role)
      CROSS JOIN(VALUES('SELECT'),('INSERT'),('UPDATE'),('REFERENCES'))v(privilege)
      WHERE n.nspname='public' AND c.relname=ANY($1::text[])`, [tables])).rows
    for (const fact of facts) expect(fact.allowed, `${fact.role}:${fact.table_name}.${fact.column_name}:${fact.privilege}`).toBe(
      fact.role === 'union_eyes_runtime' && fact.privilege === 'SELECT' && MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS[fact.table_name].select.includes(fact.column_name),
    )
    expect(facts.filter(fact => fact.allowed)).toHaveLength(17)
    for (const table of tables) for (const role of ['union_eyes_runtime', 'union_eyes_system']) for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRUNCATE', 'TRIGGER'])
      expect((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, `public.${table}`, privilege])).rows).toEqual([{ allowed: false }])
  })
})
