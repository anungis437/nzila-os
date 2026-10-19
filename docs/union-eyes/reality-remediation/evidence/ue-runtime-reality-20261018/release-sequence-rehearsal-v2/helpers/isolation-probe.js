// Loopback-only isolation probe for the three deadline-engine tables (disposable DB, per-run credentials).
// Counts only rows it created, so repeated runs on one database do not interfere.
const { Client } = require('pg'); const crypto = require('crypto');
const env = (k) => { const v = process.env[k]; if (!v) throw new Error('missing env ' + k); return v; };
const db = process.argv[2];
const cl = (u, p) => new Client({ host: '127.0.0.1', port: Number(env('REHEARSAL_PG_PORT')), user: u, password: p, database: db });
const A = crypto.randomUUID(), B = crypto.randomUUID(); const results = [];
const rec = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${detail}`); };
async function tx(c, org, fn) { try { await c.query('BEGIN'); if (org !== undefined) await c.query("select set_config('app.current_org_id',$1,true)", [org]); const r = await fn(); await c.query('ROLLBACK'); return r; } catch (e) { await c.query('ROLLBACK').catch(() => {}); return { err: e.message }; } }
(async () => {
  const ad = cl('ue_admin', env('REHEARSAL_PW_ADMIN')), rt = cl('union_eyes_runtime', env('REHEARSAL_PW_RUNTIME')), sy = cl('union_eyes_system', env('REHEARSAL_PW_SYSTEM'));
  await ad.connect(); await rt.connect(); await sy.connect();
  const rid = {};
  for (const [o, n] of [[A, 'A'], [B, 'B']]) {
    rid[n] = crypto.randomUUID();
    await ad.query(`insert into deadline_reminders (id,source_table,source_deadline_id,organization_id,offset_days,scheduled_for,recipient_role,recipient_email,recipient_email_hash) values ($1,'grievance_deadlines',gen_random_uuid(),$2,1,now(),'assigned_steward',$3,$4)`, [rid[n], o, `p-${n}@example.invalid`, 'h' + n]);
    await ad.query(`insert into deadline_audit_events (organization_id,source_table,source_deadline_id,event_type,actor_type,correlation_id) values ($1,'grievance_deadlines',gen_random_uuid(),'deadline.created','system','p')`, [o]);
    await ad.query(`insert into deadline_reminder_executions (reminder_id,attempt_number,outcome,worker_instance,correlation_id) values ($1,1,'sent','p','p')`, [rid[n]]);
  }
  const own = { deadline_reminders: ['organization_id', [A, B]], deadline_audit_events: ['organization_id', [A, B]], deadline_reminder_executions: ['reminder_id', [rid.A, rid.B]] };
  const T = Object.keys(own);
  const n = async (c, org, t, filtered) => { const r = await tx(c, org, async () => (await c.query(filtered ? `select 1 from ${t} where ${own[t][0]} = any($1)` : `select 1 from ${t}`, filtered ? [own[t][1]] : [])).rows.length); return r.err ? 'err' : r; };
  for (const t of T) for (const [lbl, org] of [['unset', undefined], ['empty', '']]) { const v = await n(rt, org, t, false); rec('P.1', v === 0 || v === 'err', `runtime, ${lbl} org context, ${t}: ${v} row(s) visible (expected 0)`); }
  for (const t of T) { const v = await n(rt, A, t, true); rec('P.2', v === 1, `runtime, org A, ${t}: ${v} of the 2 fixture rows visible (expected 1: own only)`); }
  const ins = (o) => async () => (await rt.query(`insert into deadline_reminders (source_table,source_deadline_id,organization_id,offset_days,scheduled_for,recipient_role,recipient_email,recipient_email_hash) values ('grievance_deadlines',gen_random_uuid(),$1,1,now(),'org_admin','x@example.invalid','hx') returning id`, [o])).rowCount;
  let v = await tx(rt, '', ins(B)); rec('P.3', !!v.err, `runtime, empty context, forged insert for org B: ${v.err ? 'rejected' : 'ACCEPTED'}`);
  v = await tx(rt, A, ins(B)); rec('P.3', !!v.err, `runtime, org A context, insert for org B: ${v.err ? 'rejected' : 'ACCEPTED'}`);
  for (const t of T) { const c = await n(sy, '', t, true); rec('P.4', c === 2, `system role, ${t}: ${c} of the 2 fixture rows visible (expected 2: cross-org by role)`); }
  v = await tx(rt, A, async () => (await rt.query('set role union_eyes_system')).command); rec('P.5', !!v.err, `runtime cannot SET ROLE union_eyes_system: ${v.err ? 'denied' : 'ALLOWED'}`);
  await ad.end(); await rt.end(); await sy.end();
  const f = results.filter((r) => !r.pass); console.log(`SUMMARY db=${db} total=${results.length} pass=${results.length - f.length} fail=${f.length}`);
  require('fs').writeFileSync(process.argv[3], JSON.stringify({ db, results }, null, 1));
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
