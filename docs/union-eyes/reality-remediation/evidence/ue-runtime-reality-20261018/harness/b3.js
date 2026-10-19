// Phase 3A B3 isolation harness. Fixtures via bootstrap admin (never the subject); assertions via runtime/system roles.
const { Client, Pool } = require('pg'); const crypto = require('crypto');
const ssl = { rejectUnauthorized: false };
const run = 'UE_P3A_' + crypto.randomUUID().slice(0, 6);
const A = crypto.randomUUID(), B = crypto.randomUUID();
const results = [];
const rec = (id, name, pass, detail) => { results.push({ id, name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${name} :: ${detail}`); };
async function tx(pool, ctx, fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); if (ctx && ctx.org !== undefined) await c.query("select set_config('app.current_org_id',$1,true)", [ctx.org]); if (ctx && ctx.user) await c.query("select set_config('app.current_user_id',$1,true)", [ctx.user]); const r = await fn(c); await c.query('ROLLBACK'); return r; }
  catch (e) { try { await c.query('ROLLBACK'); } catch {} return { __error: e.message }; } finally { c.release(); }
}
(async () => {
  const admin = new Client({ connectionString: process.env.AD_URL, ssl }); await admin.connect();
  const rt = new Pool({ connectionString: process.env.RT_URL, ssl, max: 4 });
  const sys = new Pool({ connectionString: process.env.SYS_URL, ssl, max: 2 });
  const ids = { gA: crypto.randomUUID(), gB: crypto.randomUUID(), rA: crypto.randomUUID(), rB: crypto.randomUUID(), mA: crypto.randomUUID(), mB: crypto.randomUUID() };
  try {
    for (const [o, n] of [[A, 'A'], [B, 'B']]) {
      await admin.query(`insert into organizations (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,member_count,active_member_count,settings,features_enabled,status,created_at,updated_at,remittance_day) values ($1,$2,$3,'union',$4::text[],0,'{}',false,0,0,$5::jsonb,'{}','active',now(),now(),1)`, [o, `${run} Org ${n}`, `${run.toLowerCase()}-${n.toLowerCase()}`, [o], JSON.stringify({ phase3a_fixture: true, run })]);
    }
    for (const [g, o, n] of [[ids.gA, A, 'A'], [ids.gB, B, 'B']]) await admin.query(`insert into grievances (id,created_at,updated_at,has_legal_implications,is_arbitration_eligible,is_confidential,is_group_grievance,priority,status,organization_id,title,type,grievance_number) values ($1,now(),now(),false,false,false,false,'medium','open',$2,$3,'other',$4)`, [g, o, `${run} ${n}`, `${run}-${n}`]);
    for (const [m, o, u, n] of [[ids.mA, A, `${run}_userA`, 'A'], [ids.mB, B, `${run}_userB`, 'B']]) await admin.query(`insert into organization_members (id,created_at,updated_at,user_id,role,status,is_primary,exempt_from_per_capita,organization_id) values ($1,now(),now(),$2,'member','active',true,false,$3)`, [m, u, o]);
    for (const [r, o, n] of [[ids.rA, A, 'A'], [ids.rB, B, 'B']]) {
      await admin.query(`insert into deadline_reminders (source_table,source_deadline_id,organization_id,offset_days,scheduled_for,recipient_role,recipient_email,recipient_email_hash,id) values ('grievance_deadlines',$1,$2,1,now(),'assigned_steward',$3,$4,$5)`, [crypto.randomUUID(), o, `${run}-${n}@example.invalid`, 'h' + n, r]);
      await admin.query(`insert into deadline_audit_events (organization_id,source_table,source_deadline_id,event_type,actor_type,correlation_id) values ($1,'grievance_deadlines',$2,'deadline.created','system',$3)`, [o, crypto.randomUUID(), run]);
      await admin.query(`insert into deadline_reminder_executions (reminder_id,attempt_number,outcome,worker_instance,correlation_id) values ($1,1,'sent','p3a','p3a')`, [r]).catch(e => console.log('exec fixture: ' + e.message));
    }
    const ctxA = { org: A, user: `${run}_userA` }, ctxB = { org: B, user: `${run}_userB` };
    const cnt = async (ctx, sql, p) => tx(rt, ctx, async c => (await c.query(sql, p)).rows.length);
    // 1-4 read isolation (RLS-direct tables)
    rec('B3.1', 'Org A reads its own grievances', (await cnt(ctxA, 'select id from grievances where id=$1', [ids.gA])) === 1, 'own row visible');
    rec('B3.2', 'Org B reads its own grievances', (await cnt(ctxB, 'select id from grievances where id=$1', [ids.gB])) === 1, 'own row visible');
    for (const [t, sql, p] of [['grievances', 'select 1 from grievances where organization_id=$1', [B]], ['organization_members', 'select 1 from organization_members where organization_id=$1', [B]], ['deadline_reminders', 'select 1 from deadline_reminders where organization_id=$1', [B]], ['deadline_audit_events', 'select 1 from deadline_audit_events where organization_id=$1', [B]], ['deadline_reminder_executions', 'select 1 from deadline_reminder_executions where reminder_id=$1', [ids.rB]]]) {
      const n = await cnt(ctxA, sql, p); rec('B3.3', `Org A cannot read Org B rows in ${t}`, n === 0, `${n} row(s) (expected 0)`);
      const m = await cnt(ctxB, sql.replace('$1', '$1'), t === 'deadline_reminder_executions' ? [ids.rA] : [A]); rec('B3.4', `Org B cannot read Org A rows in ${t}`, m === 0, `${m} row(s) (expected 0)`);
    }
    for (const [t2, sql2, pA] of [['deadline_reminders','select 1 from deadline_reminders where organization_id=$1',[A]],['deadline_audit_events','select 1 from deadline_audit_events where organization_id=$1',[A]],['deadline_reminder_executions','select 1 from deadline_reminder_executions where reminder_id=$1',[ids.rA]]]) { const n2 = await cnt(ctxA, sql2, pA); rec('B3.1', `Org A reads its own rows in ${t2} (positive control)`, n2 >= 1, ` row(s)`); }    // 5 update/delete cross tenant
    for (const t of ['grievances', 'organization_members', 'deadline_reminders']) {
      const u = await tx(rt, ctxA, async c => (await c.query(`update ${t} set updated_at=now() where organization_id=$1 returning 1`, [B])).rowCount);
      const d = await tx(rt, ctxA, async c => (await c.query(`delete from ${t} where organization_id=$1 returning 1`, [B])).rowCount);
      rec('B3.5', `Org A cannot UPDATE/DELETE Org B rows in ${t}`, u === 0 && d === 0 || (u && u.__error) || (d && d.__error), `update=${u && u.__error ? 'error:' + u.__error : u} delete=${d && d.__error ? 'error:' + d.__error : d}`);
    }
    // 6 missing org context fails closed
    for (const t of ['grievances', 'organization_members', 'deadline_reminders', 'deadline_audit_events', 'deadline_reminder_executions']) {
      for (const label of ['unset', 'empty']) {
        const n = await tx(rt, label === 'empty' ? { org: '' } : null, async c => (await c.query(`select 1 from ${t}`)).rows.length);
        rec('B3.6', `No org context (${label}) returns zero rows from ${t}`, n === 0 || !!(n && n.__error), typeof n === 'object' ? 'error: ' + n.__error : `${n} row(s) visible without org context`);
      }
    }
    const wc = await tx(rt, { org: '' }, async c => (await c.query(`insert into deadline_reminders (source_table,source_deadline_id,organization_id,offset_days,scheduled_for,recipient_role,recipient_email,recipient_email_hash) values ('grievance_deadlines',$1,$2,1,now(),'org_admin','z@example.invalid','hz') returning id`, [crypto.randomUUID(), B])).rowCount);
    rec('B3.6', 'No-context INSERT into deadline_reminders (forging Org B) is rejected', !!(wc && wc.__error), wc && wc.__error ? 'rejected: ' + wc.__error.slice(0, 80) : `INSERT SUCCEEDED (${wc})`);
    // forged insert with context A for org B
    const fi = await tx(rt, ctxA, async c => (await c.query(`insert into grievances (id,created_at,updated_at,has_legal_implications,is_arbitration_eligible,is_confidential,is_group_grievance,priority,status,organization_id,title,type) values ($1,now(),now(),false,false,false,false,'medium','open',$2,'forged','other') returning id`, [crypto.randomUUID(), B])).rowCount);
    rec('B3.7a', 'Context A cannot INSERT a row owned by Org B (WITH CHECK)', !!(fi && fi.__error), fi && fi.__error ? 'rejected' : `INSERT SUCCEEDED`);
    // 8-9 role / SET ROLE
    const sr = await tx(rt, ctxA, async c => (await c.query('set role union_eyes_system')).command);
    rec('B3.8', 'Runtime role cannot SET ROLE union_eyes_system / bypass', !!(sr && sr.__error), sr && sr.__error ? sr.__error.slice(0, 80) : 'SET ROLE succeeded');
    const rr = await rt.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user'); rec('B3.8', 'Runtime role NOSUPERUSER/NOBYPASSRLS', !rr.rows[0].rolsuper && !rr.rows[0].rolbypassrls, JSON.stringify(rr.rows[0]));
    // 10 system-only path
    const sv = await tx(sys, null, async c => (await c.query('select organization_id from grievances where id = any($1)', [[ids.gA, ids.gB]])).rows.length);
    rec('B3.10', 'System role (privileged authority) sees cross-org rows by design', sv === 2, `${sv} rows`);
    const al = await tx(rt, ctxA, async c => (await c.query(`insert into cross_org_access_log (id,created_at,updated_at,user_id) values ($1,now(),now(),'x') returning id`, [crypto.randomUUID()])).rowCount);
    rec('B3.13', 'Runtime role cannot write cross_org_access_log (system-only audit authority)', !!(al && al.__error), al && al.__error ? 'rejected' : 'INSERT SUCCEEDED');
    const as = await tx(sys, null, async c => (await c.query(`insert into cross_org_access_log (id,created_at,updated_at,user_id) values ($1,now(),now(),'x') returning id`, [crypto.randomUUID()])).rowCount);
    rec('B3.13', 'System role can write cross_org_access_log', as === 1, `rowCount=${as && as.__error ? as.__error : as}`);
    // 11 pooled leakage: same physical connection reused
    const c1 = await rt.connect();
    await c1.query('BEGIN'); await c1.query("select set_config('app.current_org_id',$1,true)", [A]); await c1.query('COMMIT');
    const leak = await c1.query("select current_setting('app.current_org_id', true) v, (select count(*) from grievances) n");
    c1.release(); rec('B3.11', 'Transaction-local org context does not leak to next use of pooled connection', (leak.rows[0].v === '' || leak.rows[0].v === null) && Number(leak.rows[0].n) === 0, `setting='${leak.rows[0].v}', visible grievances=${leak.rows[0].n}`);
    // 12 concurrency
    const jobs = []; for (let i = 0; i < 80; i++) { const mine = i % 2 ? B : A, other = i % 2 ? A : B; jobs.push(tx(rt, { org: mine, user: 'u' + i }, async c => { await c.query('select pg_sleep(0.01)'); const r = await c.query('select distinct organization_id from grievances where organization_id in ($1,$2)', [A, B]); return r.rows.map(x => x.organization_id); }).then(rows => rows.length === 1 && rows[0] === mine)); }
    const ok = (await Promise.all(jobs)).filter(Boolean).length; rec('B3.12', '80 concurrent pooled transactions each see only their own org', ok === 80, `${ok}/80 isolated`);
    // 14 db errors surface
    const pe = await tx(rt, ctxA, async c => (await c.query('select 1 from information_schema.nonexistent_table_zz')).rowCount);
    rec('B3.14', 'Database error surfaces as error (not empty success)', !!(pe && pe.__error), pe && pe.__error ? 'error raised' : 'empty success');
  } finally {
    for (const q of [`delete from deadline_reminder_executions where reminder_id = any($1)`]) await admin.query(q, [[ids.rA, ids.rB]]).catch(e => console.log('cleanup1 ' + e.message));
    await admin.query('alter table deadline_reminder_executions disable trigger trg_deadline_reminder_executions_immutable').then(() => admin.query('delete from deadline_reminder_executions where reminder_id = any($1)', [[ids.rA, ids.rB]])).catch(e => console.log('cleanup trig ' + e.message));
    await admin.query('alter table deadline_reminder_executions enable trigger trg_deadline_reminder_executions_immutable').catch(() => {});
    await admin.query('alter table deadline_audit_events disable trigger trg_deadline_audit_events_immutable').catch(e => console.log('trig2 ' + e.message));
    for (const q of ['delete from deadline_audit_events where organization_id = any($1)', 'delete from deadline_reminders where organization_id = any($1)', 'delete from organization_members where organization_id = any($1)', 'delete from grievances where organization_id = any($1)', 'delete from organizations where id = any($1)']) await admin.query(q, [[A, B]]).catch(e => console.log('cleanup: ' + e.message.slice(0, 100)));
    await admin.query('alter table deadline_audit_events enable trigger trg_deadline_audit_events_immutable').catch(() => {});
    await admin.query("delete from cross_org_access_log where user_id='x' and created_at > now() - interval '10 minutes'").catch(() => {});
    await admin.end(); await rt.end(); await sys.end();
  }
  const f = results.filter(r => !r.pass); console.log(`\nSUMMARY run=${run} total=${results.length} pass=${results.length - f.length} fail=${f.length}`);
  require('fs').writeFileSync(process.argv[2], JSON.stringify({ run, results }, null, 1));
})().catch(e => { console.log('FATAL ' + e.stack); process.exit(1); });






