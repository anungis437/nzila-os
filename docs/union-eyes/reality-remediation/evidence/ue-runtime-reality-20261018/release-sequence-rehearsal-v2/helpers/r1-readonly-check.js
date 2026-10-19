#!/usr/bin/env node
/**
 * R1 read-only truth check for the staging release (UE Phase 3A, dossier section 14.2/14.3).
 *
 * Run by a TRUSTED, governed runner with a read-only identity. This script never acquires credentials: the connection
 * string is taken from R1_DATABASE_URL, which the runner injects from its own secret store. It never prints it.
 *
 *   R1_DATABASE_URL=...  node r1-readonly-check.js --repo <candidate checkout> --out r1-result.json
 *
 * Guarantees
 *  - Every statement runs inside BEGIN READ ONLY with default_transaction_read_only=on; the session is asserted read-only.
 *  - A non-loopback host is only reachable with VERIFIED TLS (rejectUnauthorized=true, servername set; the URL's sslmode is
 *    ignored; an extra CA bundle may be supplied with UE_PG_CA_BUNDLE). NODE_TLS_REJECT_UNAUTHORIZED=0 is refused.
 *  - Output contains catalog facts only: no row data, no secrets.
 *
 * Decision: PROCEED only when staging equals the rehearsed pre-state; otherwise STOP with the reasons. Exit code 0 / 2.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), tls = require('tls');
const { Client } = require('pg');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const repo = path.resolve(arg('--repo', '.')), outFile = arg('--out', 'r1-result.json');
const sha256lf = (s) => require('crypto').createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
if (process.argv.includes('--print-hash')) { // offline helper for the rehearsal kit: LF-normalized hash of the journal entry whose tag starts with the given prefix
  const pre = arg('--print-hash', ''); const jd = path.join(repo, 'apps/union-eyes/db/migrations-cache');
  const e = JSON.parse(fs.readFileSync(path.join(jd, 'meta/_journal.json'), 'utf8')).entries.find((x) => x.tag.startsWith(pre));
  console.log(sha256lf(fs.readFileSync(path.join(jd, e.tag + '.sql'), 'utf8'))); process.exit(0);
}
const url = process.env.R1_DATABASE_URL;
if (!url) { console.error('R1_DATABASE_URL is required (injected by the governed runner).'); process.exit(1); }
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') { console.error('refusing: NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS verification'); process.exit(1); }

const u = new URL(url); const host = u.hostname; const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
let ssl = false;
if (!loopback) {
  const extra = process.env.UE_PG_CA_BUNDLE ? fs.readFileSync(process.env.UE_PG_CA_BUNDLE, 'utf8') : null;
  ssl = { rejectUnauthorized: true, servername: host, ...(extra ? { ca: [...tls.rootCertificates, extra] } : {}) };
}
const client = new Client({ host, port: u.port ? Number(u.port) : 5432, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: decodeURIComponent(u.pathname.replace(/^\//, '')), ssl, statement_timeout: 20000, options: '-c default_transaction_read_only=on' });

const EXPECTED = {
  publicPolicies: ['deadline_audit_events.deadline_audit_events_tenant_isolation', 'deadline_reminder_executions.deadline_reminder_executions_read', 'deadline_reminders.deadline_reminders_tenant_isolation', 'pilot_checklist_items.pilot_checklist_items_org_isolation', 'pilot_demo_seeds.pilot_demo_seeds_org_isolation'],
  flags: { deadline_audit_events: 'true/true', deadline_reminder_executions: 'true/false', deadline_reminders: 'true/true' },
  ledgerApplied: 6, ledgerPending: 10, djangoMigrations: 79,
};
const FAMILY = { 'character varying': 'text', character: 'text', text: 'text', boolean: 'bool', smallint: 'int', integer: 'int', bigint: 'int', numeric: 'numeric', 'double precision': 'numeric', uuid: 'uuid', jsonb: 'json', json: 'json', date: 'date', 'timestamp with time zone': 'timestamp', 'timestamp without time zone': 'timestamp', ARRAY: 'array' };
const WANTED = { BooleanField: 'bool', NullBooleanField: 'bool', CharField: 'text', TextField: 'text', SlugField: 'text', EmailField: 'text', URLField: 'text', IntegerField: 'int', BigIntegerField: 'int', SmallIntegerField: 'int', PositiveIntegerField: 'int', JSONField: 'json', DateTimeField: 'timestamp', DateField: 'date', UUIDField: 'uuid', DecimalField: 'numeric', FloatField: 'numeric', ArrayField: 'array' };
const wantedFamily = (f) => WANTED[f.replace(/^models\./, '')] || null;

const TYPE_FAMILY = { varchar: 'text', bpchar: 'text', text: 'text', citext: 'text', bool: 'bool', int2: 'int', int4: 'int', int8: 'int', numeric: 'numeric', float4: 'numeric', float8: 'numeric', uuid: 'uuid', jsonb: 'json', json: 'json', date: 'date', timestamptz: 'timestamp', timestamp: 'timestamp', inet: 'inet', bytea: 'bytes' };
const typFamily = (t) => (t && t.startsWith('_') ? 'array' : TYPE_FAMILY[t] || null);
// pg_catalog only: information_schema hides columns the read-only identity has no privilege on, which would silently report "absent".
const COLS_SQL = "select c.relname tbl, a.attname col, t.typname typ, a.attnotnull as nn, a.atthasdef as hasdef from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace join pg_type t on t.oid=a.atttypid where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped and c.relname = any($1)";
const getCols = async (tables) => { const m = {}; for (const r of await q(COLS_SQL, [tables])) (m[r.tbl] ??= {})[r.col] = r; return m; };
const sha = (s) => crypto.createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const checks = []; const stops = [];
const rec = (id, title, ok, detail, stopIfFail = true) => { checks.push({ id, title, ok, detail }); if (!ok && stopIfFail) stops.push(`${id}: ${title}`); console.log(`${ok ? 'OK  ' : (stopIfFail ? 'STOP' : 'NOTE')} [${id}] ${title}`); };
const q = async (sql, p) => (await client.query(sql, p)).rows;

(async () => {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const ro = (await q('show transaction_read_only'))[0].transaction_read_only;
  const me = (await q('select current_user cu, version() v, (select rolsuper from pg_roles where rolname=current_user) su, (select rolbypassrls from pg_roles where rolname=current_user) byp'))[0];
  rec('R1.0', 'session is read-only', ro === 'on', `transaction_read_only=${ro}; role superuser=${me.su} bypassrls=${me.byp} (informational)`);
  const major = Number((me.v.match(/PostgreSQL (\d+)/) || [])[1]);

  // runtime/system roles
  const roles = await q("select rolname, rolsuper, rolbypassrls, rolcanlogin from pg_roles where rolname in ('union_eyes_runtime','union_eyes_system','nzilaadmin') order by 1");
  const bad = roles.filter((r) => ['union_eyes_runtime', 'union_eyes_system'].includes(r.rolname) && (r.rolsuper || r.rolbypassrls));
  rec('R1.1', 'union_eyes_runtime / union_eyes_system exist, NOSUPERUSER and NOBYPASSRLS', roles.filter((r) => r.rolname.startsWith('union_eyes_')).length === 2 && bad.length === 0, JSON.stringify(roles));

  // migration ledger vs the candidate journal
  const journal = JSON.parse(fs.readFileSync(path.join(repo, 'apps/union-eyes/db/migrations-cache/meta/_journal.json'), 'utf8')).entries;
  const dir = path.join(repo, 'apps/union-eyes/db/migrations-cache');
  const have = (await q("select to_regclass('drizzle.__drizzle_migrations') t"))[0].t;
  let applied = new Set(); if (have) applied = new Set((await q('select hash from drizzle.__drizzle_migrations')).map((r) => r.hash));
  const st = journal.map((e) => ({ idx: e.idx, tag: e.tag, applied: applied.has(sha(fs.readFileSync(path.join(dir, e.tag + '.sql'), 'utf8'))) }));
  const a05 = st.filter((s) => s.idx <= 5), rest = st.filter((s) => s.idx >= 6);
  rec('R1.2', 'ledger table exists', !!have, String(have));
  rec('R1.3', 'ledger records 0000-0005 under the CURRENT file hashes', a05.every((s) => s.applied), JSON.stringify(a05.map((s) => [s.idx, s.applied])));
  rec('R1.4', 'exactly 0006-0015 are pending (a different state means STOP and reconcile; never baseline blindly)', rest.every((s) => !s.applied) && rest.length === EXPECTED.ledgerPending, JSON.stringify(rest.map((s) => [s.idx, s.applied])));

  // catalog state of the three deadline tables
  const pub = (await q("select tablename||'.'||policyname n from pg_policies where schemaname='public' and roles::text like '%public%' order by 1")).map((r) => r.n);
  rec('R1.5', 'exactly the five expected PUBLIC-role policies exist', JSON.stringify(pub) === JSON.stringify(EXPECTED.publicPolicies), JSON.stringify(pub));
  const fl = Object.fromEntries((await q("select relname, relrowsecurity||'/'||relforcerowsecurity f from pg_class where relkind='r' and relnamespace='public'::regnamespace and relname = any($1)", [Object.keys(EXPECTED.flags)])).map((r) => [r.relname, r.f]));
  rec('R1.6', 'deadline tables RLS/FORCE equal the rehearsed pre-state', JSON.stringify(fl) === JSON.stringify(Object.fromEntries(Object.keys(EXPECTED.flags).sort().map((k) => [k, EXPECTED.flags[k]]))) || Object.keys(EXPECTED.flags).every((k) => fl[k] === EXPECTED.flags[k]), JSON.stringify(fl));
  const hel = (await q("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proname in ('ue_create_direct_org_rls_policy','ue_create_parent_owned_rls_policy_v2')"))[0].n;
  rec('R1.7', '0015 helper functions installed (0010/0012 were applied)', hel === 2, `found ${hel}/2`);

  // schema state: informational facts that decide the Django and deadline prerequisites
  const conv = (await q("select to_regclass('public.deadline_reassignment_convergence') t"))[0].t;
  rec('R1.8', 'deadline_reassignment_convergence table (absent = worker cannot run; separate security-scope migration required)', true, String(conv || 'ABSENT'), false);
  const gd = (await getCols(['grievance_deadlines'])).grievance_deadlines || {}; const gdc = ['due_date', 'status'].filter((c) => gd[c]);
  rec('R1.9', 'grievance_deadlines.due_date/status present? (Django grievances.0007 adds them when absent)', true, JSON.stringify(gdc), false);

  // Django collision set (content.0004 AddField columns + claims.idempotency_hash)
  const src = fs.readFileSync(path.join(repo, 'apps/union-eyes/backend/content/migrations/0004_documents_access_level_documents_blob_container_and_more.py'), 'utf8');
  const tail = src.slice(src.indexOf('for sql in PLATFORM_SQL_0006_OVERLAP'));
  const cols = [...tail.matchAll(/AddFieldIfNotExists\(\s*model_name="documents",\s*name="([a-z_]+)",\s*field=(models\.[A-Za-z]+)\(/g)].map((m) => [m[1], m[2]]);
  const dcols = (await getCols(['documents'])).documents || {};
  const existing = cols.filter(([n]) => dcols[n]); const incompat = existing.filter(([n, f]) => { const w = wantedFamily(f); const e = typFamily(dcols[n].typ); return w && e && w !== e && !(e === 'int' && w === 'numeric'); });
  rec('R1.10', 'documents columns that content.0004 would add and that already exist: all compatible (an incompatible one fails the migration closed)', incompat.length === 0, `existing=${existing.length}/${cols.length} [${existing.map(([n]) => n).join(',')}] incompatible=[${incompat.map(([n]) => n).join(',')}]`);
  const ihc = ((await getCols(['claims'])).claims || {}).idempotency_hash; const ihu = ihc ? (await q("select count(*)::int n from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0] where i.indrelid='public.claims'::regclass and i.indisunique and i.indnatts=1 and i.indexprs is null and a.attname='idempotency_hash'"))[0].n : 0; const ih = ihc ? [{ type: ihc.typ, uniqueSingleColumnIndexes: ihu }] : [];
  rec('R1.11', 'claims.idempotency_hash: absent, or present as text with a single-column unique index', ih.length === 0 || (typFamily(ih[0].type) === 'text' && ih[0].uniqueSingleColumnIndexes > 0), JSON.stringify(ih));

  // Django migration state
  const dj = await q("select count(*)::int n from django_migrations"); const last = await q("select app, max(name) last from django_migrations where app in ('auth_core','billing','content','grievances') group by app order by app");
  const cand = await q("select app||'.'||name n from django_migrations where (app,name) in (('auth_core','0005_organizationmembers_deleted_at_and_more'),('auth_core','0006_application_user_id_text'),('billing','0002_member_dues_ledger_user_id_text'),('billing','0003_application_user_id_text'),('content','0004_documents_access_level_documents_blob_container_and_more'),('grievances','0005_claims_idempotency_hash'),('grievances','0006_claim_number_org_scope_and_user_text'))");
  rec('R1.12', 'django_migrations equals the rehearsed pre-state (79 applied, none of the 7 candidate migrations recorded)', dj[0].n === EXPECTED.djangoMigrations && cand.length === 0, `count=${dj[0].n}; candidate migrations already recorded=${JSON.stringify(cand.map((r) => r.n))}; last=${JSON.stringify(last)}`);

  // profiles defaults and tranche-1 NOT NULL columns without a database default (evidence for per-table decisions)
  const pcols = (await getCols(['profiles'])).profiles || {}; const pd = ['id', 'membership', 'created_at'].map((c) => ({ column_name: c, has_default: !!(pcols[c] && pcols[c].hasdef) }));
  rec('R1.13', 'profiles id/membership/created_at have database defaults? (Django auth_core.0007 adds them when absent)', true, JSON.stringify(pd), false);
  const t1 = ['profiles', 'grievances', 'grievance_deadlines', 'claims', 'claim_updates', 'documents', 'in_app_notifications', 'steward_assignments'];
  const all1 = await getCols(t1); const nd = t1.filter((tb) => all1[tb]).map((tb) => ({ table_name: tb, cols: Object.values(all1[tb]).filter((c) => c.nn && !c.hasdef && c.col !== 'id').map((c) => c.col).join(',') })).filter((r) => r.cols); const iddef = t1.filter((tb) => all1[tb]).map((tb) => ({ table_name: tb, has_default: !!(all1[tb].id && all1[tb].id.hasdef) }));
  rec('R1.14', 'tranche-1 tables: NOT NULL columns without a default, and id defaults (decide defaults per table from this, never in bulk)', true, JSON.stringify({ notNullNoDefault: nd, idHasDefault: iddef }), false);
  const sz = await q("select relname, n_live_tup::bigint est from pg_stat_user_tables where relname in ('deadline_reminders','deadline_audit_events','deadline_reminder_executions','grievance_deadlines','grievances','profiles') order by 1");
  rec('R1.15', 'estimated row counts (informational; no row data is read)', true, JSON.stringify(sz), false);
  rec('R1.16', 'server major version (rehearsal used 16; staging is expected to be 15)', true, `PostgreSQL ${major}`, false);

  await client.query('ROLLBACK'); await client.end();
  const result = { decision: stops.length ? 'STOP' : 'PROCEED', stopReasons: stops, checkedAtUtc: new Date().toISOString(), repoHead: (() => { try { return fs.readFileSync(path.join(repo, '.git', 'HEAD'), 'utf8').trim(); } catch { return null; } })(), checks };
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
  console.log(`DECISION ${result.decision}${stops.length ? ' :: ' + stops.length + ' stop reason(s)' : ''}`);
  process.exit(stops.length ? 2 : 0);
})().catch((e) => { console.error('R1 FAILED: ' + e.message); process.exit(1); });