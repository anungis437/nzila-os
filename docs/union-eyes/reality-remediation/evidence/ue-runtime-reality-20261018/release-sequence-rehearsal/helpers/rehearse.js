// Loopback-only rehearsal helpers. Credentials come from the environment (generated per run); nothing is embedded.
const { Client } = require('pg');
const fs = require('fs'), path = require('path'), url = require('url');
const env = (k) => { const v = process.env[k]; if (!v) throw new Error('missing env ' + k); return v; };
const mk = (db, user, pw) => new Client({ host: '127.0.0.1', port: Number(env('REHEARSAL_PG_PORT')), user, password: pw, database: db });
const admin = (db) => mk(db, 'ue_admin', env('REHEARSAL_PW_ADMIN'));
async function fingerprint(db) {
  const c = admin(db); await c.connect();
  const q = await c.query(`
    select c.relname t, c.relrowsecurity rls, c.relforcerowsecurity frc,
      coalesce((select md5(string_agg(policyname||'|'||cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by policyname)) from pg_policies p where p.schemaname='public' and p.tablename=c.relname),'-') pol,
      coalesce((select md5(string_agg(grantee||':'||privilege_type, ',' order by grantee, privilege_type)) from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=c.relname and g.grantee in ('union_eyes_runtime','union_eyes_system')),'-') gr
    from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' order by 1`);
  const fn = await c.query(`select p.proname n, md5(pg_get_functiondef(p.oid)) d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'ue\\_%' order by 1`);
  await c.end();
  return { tables: Object.fromEntries(q.rows.map((r) => [r.t, [r.rls, r.frc, r.pol, r.gr].join('/')])), fns: Object.fromEntries(fn.rows.map((r) => [r.n, r.d])) };
}
function diff(a, b) {
  const out = { tables: [], fns: [] };
  for (const k of new Set([...Object.keys(a.tables), ...Object.keys(b.tables)])) if (a.tables[k] !== b.tables[k]) out.tables.push(k);
  for (const k of new Set([...Object.keys(a.fns), ...Object.keys(b.fns)])) if (a.fns[k] !== b.fns[k]) out.fns.push(k);
  return out;
}
(async () => {
  const mode = process.argv[2];
  if (mode === 'fingerprint') { fs.writeFileSync(process.argv[4], JSON.stringify(await fingerprint(process.argv[3]))); }
  else if (mode === 'diff') { console.log(JSON.stringify(diff(JSON.parse(fs.readFileSync(process.argv[3])), JSON.parse(fs.readFileSync(process.argv[4]))))); }
  else if (mode === 'baseline') {
    // Stamp ledger hashes with the candidate source's shared executor over the files of the checkout being stamped.
    const [, , , db, filesRoot, through] = process.argv;
    const lib = await import(url.pathToFileURL(path.join(env('REHEARSAL_EXECUTOR_ROOT'), 'tooling/scripts/lib/union-eyes-scoped-migrations.mjs')).href);
    const jp = path.join(filesRoot, 'apps/union-eyes/db/migrations-cache/meta/_journal.json'), md = path.join(filesRoot, 'apps/union-eyes/db/migrations-cache');
    const tags = lib.readJournalEntries(jp).slice(0, Number(through)).map((e) => e.tag);
    const c = admin(db); await c.connect(); await lib.ensureLedgerTable(c);
    const r = await lib.baselineScopedMigrations(c, { journalPath: jp, migrationsDir: md, throughTags: tags }); await c.end();
    console.log(JSON.stringify({ stamped: r.stamped, last: tags.at(-1) }));
  }
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });