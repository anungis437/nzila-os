import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { compileAuthOrgBindingSql } from '@nzila/db/auth-storage-authority'
import { compileCaseAssigneePredicateSql, CASE_ASSIGNEE_CATALOG_QUERY, caseAssigneePredicateViolations } from './case-assignee-predicate'

const org = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const bearer = 'synthetic-private-server-held-session'
let pg: PGlite

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    CREATE ROLE nzila_auth_org_authority_reader NOLOGIN NOINHERIT;
    CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT;
    CREATE ROLE union_eyes_system NOLOGIN NOINHERIT;
    CREATE SCHEMA user_management;
    CREATE TABLE user_management.users(user_id text PRIMARY KEY,is_active boolean,lifecycle_state text);
    CREATE TABLE user_management.organization_users(user_id text,organization_id uuid,role text,is_active boolean);
    CREATE TABLE user_management.user_sessions(user_id text,organization_id uuid,session_token_hash text,is_active boolean,expires_at timestamptz,session_id uuid DEFAULT gen_random_uuid(),device_info jsonb DEFAULT '{}'::jsonb);
    ALTER TABLE user_management.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_management.users FORCE ROW LEVEL SECURITY;
    ALTER TABLE user_management.organization_users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_management.organization_users FORCE ROW LEVEL SECURITY;
    ALTER TABLE user_management.user_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_management.user_sessions FORCE ROW LEVEL SECURITY;
    ${compileAuthOrgBindingSql()}
    ${compileCaseAssigneePredicateSql()}
    INSERT INTO user_management.users VALUES
      ('actor',true,'active'),('steward',true,'active'),('member',true,'active'),
      ('foreign',true,'active'),('inactive',false,'inactive');
    INSERT INTO user_management.organization_users VALUES
      ('actor','${org}','officer',true),('steward','${org}','steward',true),
      ('member','${org}','member',true),('foreign','${foreign}','officer',true),
      ('inactive','${org}','officer',true);
    INSERT INTO user_management.user_sessions VALUES
      ('actor','${org}','${createHash('sha256').update(bearer).digest('hex')}',true,now()+interval '1 hour');
  `)
})
afterAll(async () => { await pg?.close() })

async function allowed(target: string, options: { actor?: string; org?: string; bearer?: string } = {}) {
  await pg.exec('BEGIN; SET LOCAL ROLE union_eyes_runtime')
  try {
    await pg.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)",
      [options.actor ?? 'actor', options.org ?? org, options.bearer ?? bearer])
    const result = await pg.query<{ allowed: boolean }>('SELECT public.ue_case_assignee_authorized($1,$2::uuid) AS allowed', [target, options.org ?? org])
    return result.rows[0].allowed
  } finally { await pg.exec('ROLLBACK') }
}

describe('bounded canonical case assignee predicate', () => {
  it('admits a live same-organization steward through the actual core raw-session predicate', async () => {
    expect(await allowed('steward')).toBe(true)
    expect(await allowed('actor')).toBe(true)
  })
  it.each(['member', 'foreign', 'inactive', 'unknown', '', 'x'.repeat(256)])('denies ineligible target %s', async target => {
    expect(await allowed(target)).toBe(false)
  })
  it.each([
    { actor: 'steward' }, { org: foreign }, { bearer: '' }, { bearer: 'forged' },
    { bearer: createHash('sha256').update(bearer).digest('hex') },
  ])('does not accept caller identifiers or stored hashes as bearer authority: %o', async options => {
    expect(await allowed('steward', options)).toBe(false)
  })
  it('rechecks expiry and membership status on each call', async () => {
    await pg.exec('BEGIN')
    try {
      await pg.exec("UPDATE user_management.user_sessions SET expires_at=now()-interval '1 second'")
      await pg.exec('SET LOCAL ROLE union_eyes_runtime')
      await pg.query("SELECT set_config('app.current_user_id','actor',true),set_config('app.current_org_id',$1,true),set_config('app.current_session_token',$2,true)",[org,bearer])
      expect((await pg.query<{ allowed: boolean }>('SELECT public.ue_case_assignee_authorized($1,$2::uuid) AS allowed',['steward',org])).rows[0].allowed).toBe(false)
    } finally { await pg.exec('ROLLBACK') }
    await pg.exec("BEGIN; UPDATE user_management.organization_users SET is_active=false WHERE user_id='steward'")
    try {
      await pg.exec('SET LOCAL ROLE union_eyes_runtime')
      await pg.query("SELECT set_config('app.current_user_id','actor',true),set_config('app.current_org_id',$1,true),set_config('app.current_session_token',$2,true)",[org,bearer])
      expect((await pg.query<{ allowed: boolean }>('SELECT public.ue_case_assignee_authorized($1,$2::uuid) AS allowed',['steward',org])).rows[0].allowed).toBe(false)
    } finally { await pg.exec('ROLLBACK') }
  })
  it('grants no raw private-table access or system execution', async () => {
    for (const statement of [
      'SET LOCAL ROLE union_eyes_runtime; SELECT * FROM user_management.organization_users',
      `SET LOCAL ROLE union_eyes_system; SELECT public.ue_case_assignee_authorized('steward','${org}')`,
    ]) {
      await pg.exec('BEGIN')
      try { await expect(pg.exec(statement)).rejects.toMatchObject({ code: '42501' }) }
      finally { await pg.exec('ROLLBACK') }
    }
  })
  it('pins the exact function body, overload count, owner, settings and execution ACL', async () => {
    const rows = (await pg.query<Record<string, unknown>>(CASE_ASSIGNEE_CATALOG_QUERY)).rows
    expect(caseAssigneePredicateViolations(rows)).toEqual([])
    for (const change of [{ prosrc: 'SELECT true' }, { owner: 'postgres' }, { proconfig: ['search_path=public'] },
      { exact_execute_acl: false }, { public_execute: true }, { argument_types: '25' }, { allowed: false }]) {
      expect(caseAssigneePredicateViolations(rows.map((row, index) => index === 0 ? { ...row, ...change } : row))).not.toEqual([])
    }
    expect(caseAssigneePredicateViolations([...rows,...rows])).not.toEqual([])
    expect(caseAssigneePredicateViolations([])).not.toEqual([])
  })
  it('refuses to overwrite an existing predicate', async () => {
    await pg.exec('BEGIN')
    try { await expect(pg.exec(compileCaseAssigneePredicateSql())).rejects.toThrow('explicit reconciliation') }
    finally { await pg.exec('ROLLBACK') }
  })
})
