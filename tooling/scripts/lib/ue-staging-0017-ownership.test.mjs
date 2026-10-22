import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, executeOwnershipHandoff, ORIGINAL_STATEMENT_HASH, ownershipPlan, ROLE, SCHEMA, SOURCE_HASH, TAG } from './ue-staging-0017-ownership.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const source = fs.readFileSync(path.join(root, 'apps/union-eyes/db/migrations-cache', TAG + '.sql'), 'utf8')
const statement = source.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)[5]
const input = { tag: TAG, sourceHash: digest(source), statement, index: 5 }

test('immutable 0017 artifact stays unchanged and transformed bytes are explicitly distinct', () => {
  assert.equal(digest(source), SOURCE_HASH)
  assert.equal(digest(statement), ORIGINAL_STATEMENT_HASH)
  const plan = ownershipPlan(input)
  assert.notEqual(plan.executedStatementHash, plan.originalStatementHash)
  assert.equal(plan.originalStatementHash, ORIGINAL_STATEMENT_HASH)
  assert.equal(plan.statement.split("GRANT CREATE ON SCHEMA user_management TO ue_framework_authority_reader").length, 2)
  assert.ok(plan.statement.indexOf(plan.exactPatch.grant) < plan.statement.indexOf(plan.exactPatch.original))
  assert.ok(plan.statement.indexOf(plan.exactPatch.revoke) > plan.statement.indexOf(plan.exactPatch.original))
  assert.equal(digest(source), SOURCE_HASH)
})

test('wrong source, statement, schema, role or index refused', () => {
  for (const change of [{ sourceHash: '0'.repeat(64) }, { statement: statement + '\nSELECT 1;' },
    { schema: 'public' }, { role: 'union_eyes_runtime' }, { index: 4 }, { tag: '0018_other' }]) {
    assert.throws(() => ownershipPlan({ ...input, ...change }), /binding refused/)
  }
})

test('unverified or wrong-target context rejected before any SQL', async () => {
  let queries = 0
  await assert.rejects(executeOwnershipHandoff({ query() { queries++ } }, { ...input, context: {} }), /Unverified staging/)
  assert.equal(queries, 0)
})

test('actual PG15 nonsuperuser can hand off and revoke; intervening failure rolls back', {
  skip: !process.env.UE_0017_TEST_URL,
}, async () => {
  const url = new URL(process.env.UE_0017_TEST_URL)
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname))
  assert.equal(url.pathname, '/ue_0017_disposable')
  assert.equal(url.search, '')
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: url.toString() })
  await client.connect()
  try {
    const identity = (await client.query('SELECT rolsuper, rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0]
    assert.equal(identity.rolsuper, false)
    assert.equal(identity.rolcreaterole, true)
    await client.query(`CREATE SCHEMA IF NOT EXISTS user_management;
      DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='union_eyes_runtime') THEN CREATE ROLE union_eyes_runtime NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='union_eyes_system') THEN CREATE ROLE union_eyes_system NOLOGIN; END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS user_management.users
      (user_id text, is_active bool, lifecycle_state text, is_system_admin bool);
      CREATE TABLE IF NOT EXISTS user_management.user_sessions
      (user_id text, organization_id uuid, session_token_hash text, is_active bool, expires_at timestamptz)`)
    const plan = ownershipPlan(input)
    const memberships = async () => (await client.query("SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) THEN pg_has_role(current_user,$1,'MEMBER') ELSE false END AS member", [ROLE])).rows[0].member
    const create = async () => (await client.query("SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) THEN has_schema_privilege($1,$2,'CREATE') ELSE false END AS privilege", [ROLE, SCHEMA])).rows[0].privilege
    // The canonical statement must fail under the real nonsuperuser identity.
    await client.query('BEGIN')
    await assert.rejects(client.query(statement), /permission denied|must be member/)
    await client.query('ROLLBACK')
    const beforeMembership = await memberships()
    const beforeCreate = await create()
    const beforeOwner = (await client.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='user_management'")).rows[0].owner
    // Force failure between owner transfer and cleanup; transaction discards all
    // grants, role membership, function creation/ownership and policy mutation.
    const failing = plan.statement.replace(plan.exactPatch.original, plan.exactPatch.original + "\n    RAISE EXCEPTION 'injected rollback probe';")
    await client.query('BEGIN')
    await assert.rejects(client.query(failing), /injected rollback probe/)
    await client.query('ROLLBACK')
    assert.equal(await memberships(), beforeMembership)
    assert.equal(await create(), beforeCreate)
    assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='user_management' AND proname LIKE 'ue_framework_%'")).rows[0].n, 0)
    await client.query('BEGIN')
    await client.query(plan.statement)
    await client.query('COMMIT')
    assert.equal(await memberships(), beforeMembership)
    assert.equal(await create(), false)
    assert.equal((await client.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='user_management'")).rows[0].owner, beforeOwner)
    const owners = (await client.query("SELECT r.rolname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='user_management' AND proname LIKE 'ue_framework_%'")).rows
    assert.equal(owners.length, 2)
    assert.ok(owners.every((owner) => owner.rolname === ROLE))
    assert.equal((await client.query("SELECT rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole AS unsafe FROM pg_roles WHERE rolname=$1", [ROLE])).rows[0].unsafe, false)
  } finally { await client.end() }
})
