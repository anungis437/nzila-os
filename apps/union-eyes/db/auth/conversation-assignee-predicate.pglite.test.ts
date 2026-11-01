import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { compileAuthOrgBindingSql } from '@nzila/db/auth-storage-authority'
import {
  compileConversationAssigneePredicateSql,
  CONVERSATION_ASSIGNEE_CATALOG_QUERY,
  conversationAssigneePredicateViolations,
} from './conversation-assignee-predicate'

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
    ${compileConversationAssigneePredicateSql()}
    INSERT INTO user_management.users VALUES
      ('actor',true,'active'),('steward',true,'active'),('administrator',true,'active'),
      ('safety',true,'active'),('rep',true,'active'),('member',true,'active');
    INSERT INTO user_management.organization_users VALUES
      ('actor','${org}','officer',true),('steward','${org}','steward',true),
      ('administrator','${org}','admin',true),('safety','${org}','health_safety_rep',true),
      ('rep','${org}','union_rep',true),('member','${org}','member',true);
    INSERT INTO user_management.user_sessions VALUES
      ('actor','${org}','${createHash('sha256').update(bearer).digest('hex')}',true,now()+interval '1 hour');
  `)
})
afterAll(async () => { await pg?.close() })

async function allowed(target: string) {
  await pg.exec('BEGIN; SET LOCAL ROLE union_eyes_runtime')
  try {
    await pg.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)",
      ['actor', org, bearer])
    const result = await pg.query<{ allowed: boolean }>('SELECT public.ue_conversation_assignee_authorized($1,$2::uuid) AS allowed', [target, org])
    return result.rows[0].allowed
  } finally { await pg.exec('ROLLBACK') }
}

describe('bounded canonical conversation assignee predicate', () => {
  it('admits a live steward and a health and safety representative, and denies an administrator', async () => {
    expect(await allowed('steward')).toBe(true)
    expect(await allowed('safety')).toBe(true)
    expect(await allowed('administrator')).toBe(false)
    expect(await allowed('rep')).toBe(false)
    expect(await allowed('member')).toBe(false)
  })

  it('does not follow a foreign organization or a dead session', async () => {
    await pg.exec('BEGIN')
    try {
      await pg.exec("UPDATE user_management.user_sessions SET expires_at=now()-interval '1 second'")
      await pg.exec('SET LOCAL ROLE union_eyes_runtime')
      await pg.query("SELECT set_config('app.current_user_id','actor',true),set_config('app.current_org_id',$1,true),set_config('app.current_session_token',$2,true)", [org, bearer])
      expect((await pg.query<{ allowed: boolean }>('SELECT public.ue_conversation_assignee_authorized($1,$2::uuid) AS allowed', ['steward', org])).rows[0].allowed).toBe(false)
    } finally { await pg.exec('ROLLBACK') }
    expect(await allowed('steward')).toBe(true)
    await pg.exec(`BEGIN; SET LOCAL ROLE union_eyes_runtime`)
    try {
      await pg.query("SELECT set_config('app.current_user_id','actor',true),set_config('app.current_org_id',$1,true),set_config('app.current_session_token',$2,true)", [foreign, bearer])
      expect((await pg.query<{ allowed: boolean }>('SELECT public.ue_conversation_assignee_authorized($1,$2::uuid) AS allowed', ['steward', foreign])).rows[0].allowed).toBe(false)
    } finally { await pg.exec('ROLLBACK') }
  })

  it('grants no raw private-table access or system execution', async () => {
    for (const statement of [
      'SET LOCAL ROLE union_eyes_runtime; SELECT * FROM user_management.organization_users',
      `SET LOCAL ROLE union_eyes_system; SELECT public.ue_conversation_assignee_authorized('steward','${org}')`,
    ]) {
      await pg.exec('BEGIN')
      try { await expect(pg.exec(statement)).rejects.toMatchObject({ code: '42501' }) }
      finally { await pg.exec('ROLLBACK') }
    }
  })

  it('pins the exact function body, overload count, owner, settings and execution ACL', async () => {
    const rows = (await pg.query<Record<string, unknown>>(CONVERSATION_ASSIGNEE_CATALOG_QUERY)).rows
    expect(conversationAssigneePredicateViolations(rows)).toEqual([])
  })

  it('refuses to overwrite an existing predicate', async () => {
    await pg.exec('BEGIN')
    try { await expect(pg.exec(compileConversationAssigneePredicateSql())).rejects.toThrow('explicit reconciliation') }
    finally { await pg.exec('ROLLBACK') }
  })
})
