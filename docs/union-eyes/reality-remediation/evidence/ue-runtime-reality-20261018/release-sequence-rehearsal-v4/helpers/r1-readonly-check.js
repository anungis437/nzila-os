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
// ---- Verdict port of backend/core/migration_ops.py (assess/type_decision). It applies the SAME rules to the SAME field
// definitions (backend/core/migration_wanted_fields.json is generated from the real AddFieldIfNotExists operations), so R1 can
// never be looser than the migration: anything unresolved is a STOP. The rehearsal cross-checks R1 against real `migrate` runs.
const BASE = { varchar: 'character varying', 'character varying': 'character varying', char: 'character', bpchar: 'character', character: 'character', text: 'text', boolean: 'boolean', bool: 'boolean', smallint: 'smallint', int2: 'smallint', integer: 'integer', int: 'integer', int4: 'integer', bigint: 'bigint', int8: 'bigint', numeric: 'numeric', decimal: 'numeric', 'double precision': 'double precision', float8: 'double precision', real: 'real', float4: 'real', uuid: 'uuid', jsonb: 'jsonb', json: 'json', date: 'date', inet: 'inet', bytea: 'bytea', 'timestamp with time zone': 'timestamp with time zone', timestamptz: 'timestamp with time zone', 'timestamp without time zone': 'timestamp without time zone', timestamp: 'timestamp without time zone', 'time without time zone': 'time without time zone', time: 'time without time zone', 'time with time zone': 'time with time zone', timetz: 'time with time zone' };
const INT_RANK = { smallint: 1, integer: 2, bigint: 3 }; const TEXT_BASES = new Set(['character varying', 'character', 'text']);
function parseType(text) {
  if (!text) return null;
  let t = text.trim().toLowerCase().split(/\s+/).join(' '); let array = false;
  while (t.endsWith('[]')) { array = true; t = t.slice(0, -2).trim(); }
  t = t.replace(/^(timestamp|time)\(\d+\)/, '$1');
  const m = t.match(/^([a-z][a-z0-9 ]*?)\s*(?:\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?$/); if (!m) return null;
  const base = BASE[m[1].trim()]; if (!base) return null;
  const first = m[2] ? Number(m[2]) : null, second = m[3] ? Number(m[3]) : null;
  if (base === 'character varying' || base === 'character') return { base, length: first, array };
  if (base === 'numeric') return { base, precision: first, scale: first !== null ? second : null, array };
  return { base, array };
}
function typeProblem(e, w) {
  if (e.array !== w.array) return `array-ness differs (existing array=${e.array}, wanted array=${w.array})`;
  const unbounded = (x) => x.base === 'text' || (x.base === 'character varying' && x.length == null);
  if (TEXT_BASES.has(e.base) && TEXT_BASES.has(w.base)) {
    if (unbounded(e)) return null;
    if (unbounded(w)) return `existing ${e.base}(${e.length}) is bounded but the wanted type is unbounded`;
    if (e.base === 'character' && w.base === 'character varying') return 'fixed-width character cannot stand in for character varying';
    if (e.base === 'character varying' && w.base === 'character') return 'character varying cannot stand in for fixed-width character';
    if (e.base === 'character') return e.length === w.length ? null : `character(${e.length}) vs character(${w.length})`;
    return (e.length || 0) >= (w.length || 0) ? null : `existing varchar(${e.length}) is shorter than the wanted varchar(${w.length})`;
  }
  if (INT_RANK[e.base] && INT_RANK[w.base]) return INT_RANK[e.base] >= INT_RANK[w.base] ? null : `existing ${e.base} is narrower than the wanted ${w.base}`;
  if (e.base !== w.base) return `existing type '${e.base}' is not the wanted '${w.base}'`;
  if (e.base === 'numeric') {
    if (e.precision == null) return null;
    if (w.precision == null) return 'existing numeric is bounded but the wanted numeric is not';
    if ((e.scale || 0) !== (w.scale || 0)) return `numeric scale differs (${e.scale} vs ${w.scale})`;
    if (e.precision < w.precision) return `numeric precision ${e.precision} < ${w.precision}`;
  }
  return null;
}
function typeDecision(e, w) {
  const r = typeProblem(e, w); if (r === null) return ['ok', null];
  if (!e.array && !w.array && e.base === 'character varying' && e.length != null && (w.base === 'text' || w.base === 'character varying') && (w.base === 'text' || w.length == null || w.length > e.length)) return ['widen', r];
  return ['reject', r];
}
const normDefault = (x) => { let e = x.trim().toLowerCase(), prev = null; while (prev !== e) { prev = e; e = e.replace(/::\s*[a-z][a-z ]*(\(\s*\d+(\s*,\s*\d+)?\s*\))?(\[\])?/g, '').trim(); while (e.startsWith('(') && e.endsWith(')')) e = e.slice(1, -1).trim(); } return e.replace(/^'+|'+$/g, ''); };
const lit = (d) => (d && d.kind === 'literal' ? d.value : undefined);
function assessColumn(w, c, indexes, nullRowsExist) {
  const problems = [], warnings = [], actions = []; const wt = parseType(w.db_type); const et = c.typtype === 'b' ? parseType(c.fmt) : null;
  if (w.has_remote) problems.push('foreign-key fields are not verified');
  if (w.db_check) problems.push(`database CHECK ${w.db_check} is not verified`);
  if (!wt) problems.push(`unresolved wanted type ${w.db_type}`);
  if (c.typtype === 'e') {
    const ep = []; const labels = c.enumLabels || [];
    if (!wt || wt.array || !['character varying', 'text'].includes(wt.base)) ep.push(`existing column is the enum ${c.fmt} but the field is not a varchar/text field`);
    else if (!labels.length) ep.push(`existing enum ${c.fmt} has no labels`);
    else {
      if (wt.length != null) { const tl = labels.filter((x) => x.length > wt.length); if (tl.length) ep.push(`enum labels longer than max_length ${wt.length}: ${tl}`); }
      const pd = w.python_default; if (pd.kind === 'literal') { if (!labels.includes(String(pd.value))) ep.push(`field default ${JSON.stringify(pd.value)} is not a label of ${c.fmt}`); } else if (pd.kind === 'callable') ep.push('field default is a callable; cannot be checked against the enum labels');
      const dd = lit(w.db_default); if (dd !== undefined && !labels.includes(String(dd))) ep.push(`db_default ${JSON.stringify(dd)} is not a label of ${c.fmt}`);
    }
    problems.push(...ep); if (!ep.length) warnings.push(`existing column is the enum ${c.fmt} (stricter than the field)`);
  } else if (!et) problems.push(`unresolved existing type ${c.fmt} (kind ${c.typtype})`);
  if (wt && et) { const [v, r] = typeDecision(et, wt); if (v === 'reject') problems.push(`incompatible type: ${r}`); else if (v === 'widen') { actions.push(`widen:${w.db_type}`); warnings.push(`existing ${c.fmt} will be widened to ${w.db_type} (lossless)`); } }
  if (c.generated) problems.push('existing column is a generated column');
  if (c.identity) problems.push('existing column is an identity column');
  if (w.null && c.nn) problems.push('field is nullable but the existing column is NOT NULL');
  else if (!w.null && !c.nn) { const n = nullRowsExist(); if (n === 'unknown') problems.push('cannot prove the nullable column holds no NULLs: the identity needs SELECT on the column AND must see every row (superuser, BYPASSRLS, or owner of a table without FORCE RLS)'); else if (n) problems.push('field is NOT NULL but the existing nullable column holds NULL values'); else warnings.push('field is NOT NULL but the existing column is nullable (no NULLs present; constraint not added)'); }
  if (w.db_default.kind !== 'none') {
    const d = lit(w.db_default);
    if (d === undefined) problems.push('db_default is a database expression; equivalence cannot be proven');
    else if (c.defexpr == null) problems.push(`db_default=${JSON.stringify(d)} but the existing column has no database default`);
    else { const wantedText = typeof d === 'boolean' ? String(d) : String(d).toLowerCase(); if (normDefault(c.defexpr) !== wantedText) problems.push(`existing database default ${c.defexpr} differs from db_default=${JSON.stringify(d)}`); }
  }
  if (w.unique) {
    const ok = indexes.filter((i) => i.key === 1 && i.valid && i.ready && !i.expr && (i.pred == null || i.pred.toLowerCase().replace(/[\s()"]/g, '') === `${w.column.toLowerCase()}isnotnull`));
    if (!ok.length) problems.push(`field is unique but no valid, ready, single-column, non-expression unique index (unconditional or only IS NOT NULL) exists: ${JSON.stringify(indexes)}`);
  }
  return { problems, warnings, actions };
}// pg_catalog only: information_schema hides columns the read-only identity has no privilege on, which would silently report "absent".
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

  // Django guarded columns (content.0004, grievances.0005, grievances.0007): every EXISTING column must be provably equivalent.
  const wanted = JSON.parse(fs.readFileSync(path.join(repo, 'apps/union-eyes/backend/core/migration_wanted_fields.json'), 'utf8')).fields;
  const verdicts = []; let sp = 0;
  for (const w of wanted) {
    const f = (await q("select format_type(a.atttypid,a.atttypmod) fmt, a.attnotnull nn, pg_get_expr(d.adbin,d.adrelid) defexpr, a.attgenerated<>'' generated, a.attidentity<>'' identity, t.typtype::text typtype, coalesce((select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid), array[]::text[]) \"enumLabels\" from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace join pg_type t on t.oid=a.atttypid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname='public' and c.relname=$1 and a.attname=$2 and a.attnum>0 and not a.attisdropped and c.relkind in ('r','p')", [w.table, w.column]))[0];
    if (!f) continue;
    const idx = w.unique ? (await q("select i.indnkeyatts::int key, i.indisvalid valid, i.indisready ready, i.indexprs is not null expr, pg_get_expr(i.indpred,i.indrelid) pred from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=i.indkey[0] where n.nspname='public' and c.relname=$1 and i.indisunique and a.attname=$2", [w.table, w.column])) : [];
    let nullRows = false;
    if (!w.null && !f.nn) {
      // Under RLS a principal that cannot see every row would report "no NULLs" for a table that has them; that is a false green,
      // so the probe only counts when this principal provably sees all rows (superuser, BYPASSRLS, or owner of a table without FORCE).
      const rl = (await q("select c.relrowsecurity rls, c.relforcerowsecurity frc, pg_has_role(current_user, c.relowner, 'USAGE') own from pg_class c where c.oid = $1::regclass", [`public.${w.table}`]))[0];
      const sees = !rl.rls || me.su || me.byp || (rl.own && !rl.frc);
      if (!sees) nullRows = 'unknown';
      else { const name = `r1_sp_${sp++}`; await client.query(`SAVEPOINT ${name}`); try { nullRows = (await q(`select exists (select 1 from "${w.table}" where "${w.column}" is null) e`))[0].e; } catch { nullRows = 'unknown'; await client.query(`ROLLBACK TO SAVEPOINT ${name}`); } }
    }
    const v = assessColumn(w, f, idx, () => nullRows);
    verdicts.push({ column: `${w.table}.${w.column}`, migration: w.migration, existingType: f.fmt, kind: f.typtype, ...v });
  }
  const blocked = verdicts.filter((v) => v.problems.length);
  rec('R1.10', 'every guarded Django column (content.0004, grievances.0005, grievances.0007) that already exists is provably equivalent to the migration state (otherwise the migration fails closed)', blocked.length === 0, JSON.stringify({ guarded: wanted.length, existing: verdicts.length, blocked: blocked.map((v) => ({ column: v.column, problems: v.problems })) }));
  rec('R1.11', 'existing guarded columns that migrate will modify or accept with a warning (informational: widening, enum acceptance, nullable-but-NOT-NULL)', true, JSON.stringify(verdicts.filter((v) => v.actions.length || v.warnings.length).map((v) => ({ column: v.column, actions: v.actions, warnings: v.warnings }))), false);
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