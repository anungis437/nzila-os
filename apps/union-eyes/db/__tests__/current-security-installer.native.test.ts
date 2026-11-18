/**
 * Existing native project, separately supplied genuine released-topology template.
 * No server/container is started and the template is never modified.
 *
 * UE_CURRENT_SECURITY_NATIVE_PROOF=1
 * UE_CURRENT_SECURITY_LEGACY_OWNER_URL=<loopback ue_* template, uev2admin>
 * UE_CURRENT_SECURITY_ADMIN_URL=<same loopback server, maintenance postgres DB>
 * UE_NATIVE_TEMPLATE_URL must be unset for this explicit template cohort.
 */
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import path from 'node:path'
import pg from 'pg'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { installUnionEyesCurrentSecurity } from '../../../../tooling/scripts/lib/union-eyes-current-security-installer'
import { runCurrentSecurityBootstrapStage } from '../../../../tooling/scripts/lib/union-eyes-bootstrap-stages.mjs'

const enabled = process.env.UE_CURRENT_SECURITY_NATIVE_PROOF === '1'
const root = path.resolve(__dirname, '../../../..')
const quote = (name: string) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error('Owned native database identifier required')
  return `"${name}"`
}
let legacy: URL, maintenance: URL, operator: pg.Client | undefined, admin: pg.Client | undefined, databaseName: string | undefined
let databaseCreated = false
// Prepared before released 0049 installs its journal trigger. Its old Django
// table has a Python UUID default, so inventing a server default or disabling
// that trigger here would invalidate the historical transition proof.
const preserved = {
  organization: '9a7e0000-0000-4000-8000-000000000001',
  case: '9a7e0000-0000-4000-8000-000000000002',
  claim: '9a7e0000-0000-4000-8000-000000000003',
  transition: '9a7e0000-0000-4000-8000-000000000004',
  user: 'ue_native_preserved_member',
} as const

function confinedUrl(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is required for the explicit native legacy proof`)
  let url: URL
  try { url = new URL(value) } catch { throw new Error(`${label} is not a valid fixture URL`) }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || !/^\d+$/.test(url.port) || Number(url.port) < 1024 || url.search || url.hash)
    throw new Error(`${label} must identify an explicit owned loopback PostgreSQL fixture`)
  return url
}

async function securityDigest(client: pg.Client) {
  const statements = [
    `SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','user_management','audit_security') ORDER BY 1,2`,
    `SELECT n.nspname,c.relname,a.attname,a.attacl::text,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expression
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname IN('public','user_management','audit_security') AND a.attnum<>0 AND NOT a.attisdropped ORDER BY 1,2,a.attnum`,
    `SELECT n.nspname,c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles::text,pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check
      FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','user_management','audit_security') ORDER BY 1,2,3`,
    `SELECT n.nspname,p.oid::regprocedure::text AS identity,pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) AS definition,p.proacl::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','user_management') AND p.prokind IN('f','p') ORDER BY 1,2`,
    `SELECT n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','user_management','audit_security') AND NOT t.tgisinternal ORDER BY 1,2,3`,
    `SELECT r.rolname,r.rolsuper,r.rolbypassrls,r.rolcanlogin,r.rolinherit,r.rolcreatedb,r.rolcreaterole FROM pg_roles r ORDER BY 1`,
    `SELECT row_to_json(m)::text AS membership FROM pg_auth_members m ORDER BY m.member,m.roleid`,
    `SELECT nspname,pg_get_userbyid(nspowner) AS owner,nspacl::text FROM pg_namespace WHERE nspname IN('public','user_management','audit_security') ORDER BY 1`,
    `SELECT e.evtname,e.evtevent,e.evtenabled,e.evttags,p.oid::regprocedure::text AS function,pg_get_userbyid(e.evtowner) AS owner
      FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid ORDER BY e.evtname`,
    `SELECT pg_get_userbyid(defaclrole) AS role,defaclnamespace::regnamespace::text AS schema,defaclobjtype,defaclacl::text FROM pg_default_acl ORDER BY defaclrole,defaclnamespace,defaclobjtype`,
  ]
  const snapshots = []
  for (const sql of statements) snapshots.push((await client.query(sql)).rows)
  return createHash('sha256').update(JSON.stringify(snapshots)).digest('hex')
}

type History = { tables: string[]; columns: Record<string, string[]>; records: Record<string, unknown> }
async function historyDigest(client: pg.Client, prior?: History): Promise<History> {
  const tables = prior?.tables ?? (await client.query(`SELECT n.nspname||'.'||c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN('public','user_management','audit_security','ue_native_proof') AND c.relkind IN('r','p') ORDER BY 1`)).rows.map(row => String(row.name))
  const attributes = prior ? [] : (await client.query(`SELECT n.nspname||'.'||c.relname AS relation,a.attname AS name FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname IN('public','user_management','audit_security','ue_native_proof') AND c.relkind IN('r','p')
      AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,a.attnum`)).rows
  const columns = prior?.columns ?? Object.fromEntries(tables.map(table => [table, attributes.filter(row => row.relation === table).map(row => String(row.name))]))
  const records: Record<string, unknown> = {}
  for (const relation of tables) {
    const [schema, table] = relation.split('.')
    // Capture every prior field explicitly. New nullable metadata is verified
    // separately; it cannot erase or exempt any pre-existing field/value.
    const projection = columns[relation].map(name => '"' + name.replaceAll('"', '""') + '"').join(',')
    records[relation] = (await client.query(`SELECT count(*)::text AS count,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS digest FROM (SELECT ${projection} FROM ${quote(schema)}.${quote(table)}) t`)).rows[0]
  }
  return { tables, columns, records }
}

async function seedAndAssertPreservedLegacyRows(client: pg.Client) {
  const cases = (await client.query(`SELECT id,claim_id,organization_id FROM public.claims WHERE id=$1`, [preserved.case])).rows
  expect(cases).toEqual([{ id: preserved.case, claim_id: preserved.claim, organization_id: preserved.organization }])
  const transitions = (await client.query(`SELECT id,claim_id,organization_id,to_status,transaction_id FROM public.claim_status_transitions WHERE id=$1`, [preserved.transition])).rows
  expect(transitions).toEqual([{ id: preserved.transition, claim_id: preserved.case, organization_id: preserved.organization, to_status: 'submitted', transaction_id: null }])
  // Exact released auth-table columns; these rows are local synthetic setup,
  // never institutional entitlements or proof of a login/user journey.
  await client.query(`INSERT INTO user_management.users(user_id,email,password_hash,is_active,lifecycle_state,is_system_admin)
    VALUES($1,'preserved-member@example.invalid','synthetic-not-a-password',true,'active',false)`, [preserved.user])
  await client.query(`INSERT INTO user_management.organization_users(organization_user_id,user_id,organization_id,role,is_active,is_primary)
    VALUES($1,$2,$3,'member',true,true)`, [randomUUID(), preserved.user, preserved.organization])
  const token = 'synthetic-preservation-' + randomBytes(24).toString('hex')
  const session = randomUUID()
  await client.query(`INSERT INTO user_management.user_sessions(session_id,user_id,organization_id,session_token,session_token_hash,is_active,created_at,expires_at)
    VALUES($1,$2,$3,$4,$5,true,now(),now()+interval '1 day')`, [session, preserved.user, preserved.organization, token, createHash('sha256').update(token).digest('hex')])
  await client.query(`INSERT INTO user_management.magic_links(id,email,user_id,organization_id,purpose,token_hash,expires_at,attempts,created_at)
    VALUES($1,'preserved-member@example.invalid',$2,$3,'login',$4,now()+interval '1 hour',0,now())`, [randomUUID(), preserved.user, preserved.organization, createHash('sha256').update('synthetic-magic-' + token).digest('hex')])
  expect((await client.query(`SELECT count(*)::int AS count FROM user_management.users WHERE user_id=$1`, [preserved.user])).rows).toEqual([{ count: 1 }])
  expect((await client.query(`SELECT count(*)::int AS count FROM user_management.organization_users WHERE user_id=$1 AND organization_id=$2`, [preserved.user, preserved.organization])).rows).toEqual([{ count: 1 }])
  expect((await client.query(`SELECT count(*)::int AS count FROM user_management.user_sessions WHERE session_id=$1 AND user_id=$2`, [session, preserved.user])).rows).toEqual([{ count: 1 }])
}

describe.runIf(enabled)('actual released-to-current security transaction on owned native PostgreSQL', () => {
  beforeAll(() => {
    if (process.env.UE_NATIVE_TEMPLATE_URL) throw new Error('Unset UE_NATIVE_TEMPLATE_URL for the explicitly cloned historical security cohort')
    legacy = confinedUrl(process.env.UE_CURRENT_SECURITY_LEGACY_OWNER_URL, 'UE_CURRENT_SECURITY_LEGACY_OWNER_URL')
    maintenance = confinedUrl(process.env.UE_CURRENT_SECURITY_ADMIN_URL, 'UE_CURRENT_SECURITY_ADMIN_URL')
    const templateName = decodeURIComponent(legacy.pathname.slice(1))
    if (!/^ue_[a-z0-9_]+$/.test(templateName) || legacy.username !== 'uev2admin' || legacy.host !== maintenance.host || maintenance.pathname !== '/postgres')
      throw new Error('Genuine owned ue_* legacy template and same-server maintenance administration are required')
  })

  beforeEach(async () => {
    const manager = new pg.Client({ connectionString: maintenance.toString() })
    await manager.connect()
    databaseName = `ue_native_security_${process.pid}_${randomBytes(6).toString('hex')}`
    try {
      const topology = await manager.query(`SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1`, [decodeURIComponent(legacy.pathname.slice(1))])
      if (topology.rows.length !== 1 || topology.rows[0].owner !== 'uev2admin') throw new Error('The supplied template was not installed by the real legacy owner')
      await manager.query(`CREATE DATABASE ${quote(databaseName)} WITH TEMPLATE ${quote(decodeURIComponent(legacy.pathname.slice(1)))} OWNER uev2admin`)
      databaseCreated = true
    } finally { await manager.end() }
    const ownerUrl = new URL(legacy), adminUrl = new URL(maintenance)
    ownerUrl.pathname = adminUrl.pathname = '/' + databaseName
    operator = new pg.Client({ connectionString: ownerUrl.toString() })
    admin = new pg.Client({ connectionString: adminUrl.toString() })
    await operator.connect(); await admin.connect()
    const reader = (await admin.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]
    if (!reader || (!reader.rolsuper && !reader.rolbypassrls)) throw new Error('Unfiltered disposable administrator required for preservation proof')
    await admin.query('SET row_security=off')
    const anchor = (await operator.query("SELECT to_regprocedure('user_management.auth_business_org_authorized(uuid,text[])') AS anchor")).rows[0].anchor
    if (anchor) throw new Error('The explicit legacy template is already current; transition proof refused')
    const protectedGuard = (await operator.query(`SELECT pg_get_userbyid(p.proowner) AS owner,e.evtenabled FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid WHERE e.evtname='ue_guard_deadline_reassignment_convergence_policy'`)).rows
    if (protectedGuard.length !== 1 || protectedGuard[0].owner !== 'uev2admin' || protectedGuard[0].evtenabled !== 'O') throw new Error('Original enabled uev2admin deadline guard required; ownership must not be forged by the proof')
    await operator.query('CREATE SCHEMA ue_native_proof AUTHORIZATION uev2admin')
    await operator.query('CREATE TABLE ue_native_proof.sentinel(id integer PRIMARY KEY,value text NOT NULL)')
    await operator.query("INSERT INTO ue_native_proof.sentinel VALUES(1,'synthetic preservation sentinel')")
    await seedAndAssertPreservedLegacyRows(admin)
  }, 180_000)

  afterEach(async () => {
    await operator?.end().catch(() => undefined); await admin?.end().catch(() => undefined)
    operator = admin = undefined
    if (databaseName && databaseCreated) {
      const manager = new pg.Client({ connectionString: maintenance.toString() })
      await manager.connect()
      try { await manager.query(`DROP DATABASE ${quote(databaseName)} WITH (FORCE)`) } finally { await manager.end() }
      databaseName = undefined
      databaseCreated = false
    }
  })

  it('refuses an altered legacy policy and preserves the entire security state and history', async () => {
    await operator!.query('ALTER POLICY ue_auth_users_self_select ON user_management.users USING(true)')
    const before = await securityDigest(admin!), history = await historyDigest(admin!)
    await expect(runCurrentSecurityBootstrapStage(operator!, installUnionEyesCurrentSecurity, { repoRoot: root })).rejects.toThrow('Legacy auth policy preimage differs')
    expect(await securityDigest(admin!)).toBe(before)
    expect(await historyDigest(admin!, history)).toEqual(history)
  })

  it('rolls back roles, owners, ACLs and functions after a real database failure during the transition', async () => {
    await admin!.query(`CREATE FUNCTION ue_native_proof.fail_current_install() RETURNS event_trigger LANGUAGE plpgsql AS $proof$
      BEGIN IF current_user='ue_v2_owner' THEN RAISE EXCEPTION 'UE_NATIVE_FORCED_CURRENT_SECURITY_FAILURE'; END IF; END $proof$`)
    await admin!.query("CREATE EVENT TRIGGER ue_native_forced_security_failure ON ddl_command_end WHEN TAG IN('CREATE FUNCTION') EXECUTE FUNCTION ue_native_proof.fail_current_install()")
    const before = await securityDigest(admin!), history = await historyDigest(admin!)
    await expect(runCurrentSecurityBootstrapStage(operator!, installUnionEyesCurrentSecurity, { repoRoot: root })).rejects.toThrow('UE_NATIVE_FORCED_CURRENT_SECURITY_FAILURE')
    expect(await securityDigest(admin!)).toBe(before)
    expect(await historyDigest(admin!, history)).toEqual(history)
  })

  it('qualifies the real current source catalog, preserves history and proves a second installation is a read-only NOOP', async () => {
    const history = await historyDigest(admin!)
    const first = await runCurrentSecurityBootstrapStage(operator!, installUnionEyesCurrentSecurity, { repoRoot: root })
    expect(first.applied).toBe(true)
    expect(first.securityPolicyVerified).toBe(true)
    expect(first.runtimePrivilegesVerified).toBe(true)
    expect(first.businessDmlIssued).toBe(false)
    expect(first.sourceTablesCreated).toEqual(['platform_identity_bindings'])
    expect((await admin!.query(`SELECT pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='platform_identity_bindings'`)).rows)
      .toEqual([{ owner: 'ue_v2_owner', relrowsecurity: true, relforcerowsecurity: true }])
    expect((await admin!.query('SELECT count(*)::int AS count FROM public.platform_identity_bindings')).rows).toEqual([{ count: 0 }])
    expect(first.authColumnsAdded).toEqual(['user_management.magic_links.consumed_ip', 'user_management.magic_links.requested_ip', 'user_management.magic_links.requested_user_agent'])
    expect(history.columns['user_management.magic_links']).not.toContain('requested_ip')
    const addedValues = (await admin!.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE consumed_ip IS NOT NULL OR requested_ip IS NOT NULL OR requested_user_agent IS NOT NULL)::int AS invented FROM user_management.magic_links`)).rows[0]
    expect(addedValues.total).toBeGreaterThan(0)
    expect(addedValues.invented).toBe(0)
    expect(await historyDigest(admin!, history)).toEqual(history)
    const currentHistory = await historyDigest(admin!)
    const beforeSecond = await securityDigest(admin!)
    const second = await runCurrentSecurityBootstrapStage(operator!, installUnionEyesCurrentSecurity, { repoRoot: root })
    expect(second.applied).toBe(false)
    expect(second.sourcePlanDigest).toBe(first.sourcePlanDigest)
    expect(second.currentContract.digest).toBe(first.currentContract.digest)
    expect(await securityDigest(admin!)).toBe(beforeSecond)
    expect(await historyDigest(admin!, currentHistory)).toEqual(currentHistory)
  }, 180_000)
})
