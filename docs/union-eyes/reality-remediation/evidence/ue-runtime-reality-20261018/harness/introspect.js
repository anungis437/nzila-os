const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.RT_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (t, s) => { try { const r = await c.query(s); console.log('## ' + t); console.log(JSON.stringify(r.rows)); } catch (e) { console.log('## ' + t + ' ERROR ' + e.message); } };
  await q('identity', "select current_user, session_user, current_database(), version()");
  await q('role', "select rolname,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin from pg_roles where rolname=current_user");
  await q('memberships', "select r.rolname as member, g.rolname as granted from pg_auth_members m join pg_roles r on r.oid=m.member join pg_roles g on g.oid=m.roleid where r.rolname=current_user");
  await q('ue_roles', "select rolname,rolsuper,rolbypassrls,rolcanlogin from pg_roles where rolname like 'union_eyes%' or rolname in ('nzilaadmin','azure_pg_admin')");
  await q('rls_counts', "select count(*) filter (where c.relrowsecurity) rls_on, count(*) filter (where c.relforcerowsecurity) forced, count(*) total from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
  await q('policy_count', "select count(*) from pg_policies where schemaname='public'");
  await q('migrations', "select * from information_schema.tables where table_name in ('__drizzle_migrations','schema_migrations') ");
  await c.end();
})().catch(e => { console.log('FATAL ' + e.message); process.exit(1); });
