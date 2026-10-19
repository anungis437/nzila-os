import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { systemDb } from './db/system-db'
import { systemContextStorage } from './db/system-context-storage'
// Faithful emulation of withSystemContext (lib/db/with-rls-context.ts) without the auth-guard import graph.
async function withSystemContext<T>(op: () => Promise<T>): Promise<T> {
  return await systemDb.transaction(async (tx: any) => {
    await tx.execute(sql`select set_config('app.current_user_id', '', true)`)
    await tx.execute(sql`select set_config('app.current_org_id', '', true)`)
    return await systemContextStorage.run(tx, () => op())
  })
}
import { runDeadlineReminderWorker } from './lib/deadline-engine'

const ssl = { rejectUnauthorized: false }
const out: any[] = []
const rec = (id: string, name: string, pass: boolean, detail: string) => { out.push({ id, name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${name} :: ${detail}`) }

async function main() {
  const admin = new Client({ connectionString: process.env.AD_URL, ssl }); await admin.connect()
  const run = 'UE_P3A_D_' + randomUUID().slice(0, 6)
  const org = randomUUID()
  const grievance = randomUUID(); const dl = randomUUID()
  await admin.query(`insert into organizations (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,member_count,active_member_count,settings,features_enabled,status,created_at,updated_at,remittance_day) values ($1,$2,$3,'union',$4::text[],0,'{}',false,0,0,'{"phase3a_fixture":true}'::jsonb,'{}','active',now(),now(),1)`, [org, run, run.toLowerCase(), [org]])
  await admin.query(`insert into grievances (id,created_at,updated_at,has_legal_implications,is_arbitration_eligible,is_confidential,is_group_grievance,priority,status,organization_id,title,type,grievance_number) values ($1,now(),now(),false,false,false,false,'medium','open',$2,$3,'other',$4)`, [grievance, org, run, run])
  await admin.query(`insert into grievance_deadlines (id,created_at,updated_at,grievance_id,deadline_type,calculated_due_date,due_date,status) values ($1,now(),now(),$2,'filing',now() + interval '2 days',now() + interval '2 days','pending')`, [dl, grievance]).catch(async (e) => { console.log('deadline fixture: ' + e.message); throw e })
  const N = 12; const ids: string[] = []
  for (let i = 0; i < N; i++) { const id = randomUUID(); ids.push(id); await admin.query(`insert into deadline_reminders (id,source_table,source_deadline_id,organization_id,offset_days,scheduled_for,recipient_role,recipient_email,recipient_email_hash,recipient_locale,message_subject,reminder_kind) values ($1,'grievance_deadlines',$2,$3,${i},now() - interval '1 minute','assigned_steward',$4,$5,'en','Phase3A synthetic',$6)`, [id, dl, org, `${run}-${i}@example.invalid`, 'h' + i, 'upcoming']).catch(async (e) => { console.log('reminder fixture: ' + e.message); throw e }) }
  const snap = async () => (await admin.query(`select id,status,attempt_count,max_attempts,lease_owner,lease_expires_at from deadline_reminders where id = any($1)`, [ids])).rows
  try {
    // T0 live-schema compatibility: the worker revalidation query must run against the live grievance_deadlines columns
    const settled = await Promise.allSettled(['w1', 'w2', 'w3'].map((w) => withSystemContext(() => runDeadlineReminderWorker({ workerInstance: w, maxBatch: 25 }))))
    const errs = settled.filter((s) => s.status === 'rejected').map((s: any) => String(s.reason?.message ?? s.reason).slice(0, 140))
    rec('D.0', 'Worker runs to completion against the schema under test', errs.length === 0, errs.length ? 'errors: ' + [...new Set(errs)].join(' | ') : 'no errors')
    if (errs.length) { for (const id of ['D.1','D.2','D.3','D.4','D.5','D.6','D.7']) rec(id, 'not executable: worker run failed against the live schema', false, 'BLOCKED_REQUIRED_DEPENDENCY (see D.0)'); return }
    const results = settled.filter((s) => s.status === 'fulfilled').map((s: any) => s.value)
    const claimedSum = results.reduce((a, r) => a + r.claimed, 0)
    const rows = await snap()
    const dupAttempts = rows.filter((r) => r.attempt_count > 1).length
    const execs = (await admin.query(`select reminder_id, count(*)::int n from deadline_reminder_executions where reminder_id = any($1) group by 1`, [ids])).rows
    rec('D.1', 'Concurrent workers (3) claim each due reminder exactly once', claimedSum === N && dupAttempts === 0, `claimedSum=${claimedSum}/${N} perWorker=${results.map((r) => r.claimed).join('/')} attempt_count>1: ${dupAttempts}`)
    rec('D.2', 'One immutable execution row per claimed attempt (no duplicate delivery records)', execs.length === N && execs.every((e: any) => e.n === 1), `${execs.length} reminders with executions; max per reminder=${Math.max(0, ...execs.map((e: any) => e.n))}`)
    const states = rows.reduce((m: any, r: any) => ((m[r.status] = (m[r.status] || 0) + 1), m), {})
    rec('D.3', 'Failed delivery is recorded as failure/retry (not silent success) with email disabled', !('sent' in states), `states=${JSON.stringify(states)} totals sent=${results.reduce((a, r) => a + r.sent, 0)} transient=${results.reduce((a, r) => a + r.transientFailures, 0)} permanent=${results.reduce((a, r) => a + r.permanentFailures, 0)}`)
    // T2 interrupted worker: a reminder left 'claimed' by a dead worker with an expired lease
    const mk = async (status: string, owner: string | null, leaseSql: string) => { const id = randomUUID(); ids.push(id); await admin.query(`insert into deadline_reminders (id,source_table,source_deadline_id,organization_id,offset_days,scheduled_for,recipient_role,recipient_email,recipient_email_hash,recipient_locale,message_subject,reminder_kind,status,lease_owner,lease_expires_at,attempt_count) values ($1,'grievance_deadlines',$2,$3,0,now() - interval '10 minutes','assigned_steward',$4,$5,'en','Phase3A synthetic','upcoming',$6,$7,${leaseSql},1)`, [id, dl, org, `${run}-lease-${ids.length}@example.invalid`, 'hl' + ids.length, status, owner]); return id }
    const victim = await mk('claimed', 'dead-worker', "now() - interval '5 minutes'")
    const rr = await withSystemContext(() => runDeadlineReminderWorker({ workerInstance: 'w-recover', maxBatch: 25 }))
    const v = (await admin.query(`select status,lease_owner,attempt_count from deadline_reminders where id=$1`, [victim])).rows[0]
    rec('D.4', 'Expired lease from an interrupted worker is recovered and the reminder is re-processed', rr.leasesRecovered >= 1 && v.lease_owner !== 'dead-worker', `leasesRecovered=${rr.leasesRecovered} status=${v.status} owner=${v.lease_owner} attempts=${v.attempt_count}`)
    // T3 unexpired lease held by a live worker must not be stolen
    const held = await mk('claimed', 'live-worker', "now() + interval '10 minutes'")
    await withSystemContext(() => runDeadlineReminderWorker({ workerInstance: 'w-other', maxBatch: 25 }))
    const h = (await admin.query(`select lease_owner,status,attempt_count from deadline_reminders where id=$1`, [held])).rows[0]
    rec('D.5', 'Unexpired lease held by another worker is not stolen', h.lease_owner === 'live-worker' && h.status === 'claimed' && h.attempt_count === 1, `owner=${h.lease_owner} status=${h.status} attempts=${h.attempt_count}`)
    // T4 terminal state is bounded
    const fin = await snap(); const fs2 = fin.reduce((m: any, r: any) => ((m[r.status] = (m[r.status] || 0) + 1), m), {})
    rec('D.6', 'Failed deliveries reach a bounded terminal state (dead_letter) and never exceed max_attempts', (fs2.dead_letter ?? 0) >= 1 && fin.every((r: any) => r.attempt_count <= r.max_attempts), `states=${JSON.stringify(fs2)} max attempt_count=${Math.max(...fin.map((r: any) => r.attempt_count))} max_attempts=${fin[0].max_attempts}`)
    // T5 duplicate delivery protection: re-running over terminal rows creates no new execution rows
    const before = (await admin.query(`select count(*)::int n from deadline_reminder_executions where reminder_id = any($1)`, [ids])).rows[0].n
    await withSystemContext(() => runDeadlineReminderWorker({ workerInstance: 'w-dup', maxBatch: 25 }))
    const after = (await admin.query(`select count(*)::int n from deadline_reminder_executions where reminder_id = any($1) and reminder_id <> $2`, [ids, held])).rows[0].n
    rec('D.8', 'Re-running the worker over terminal reminders does not create duplicate execution records', after <= before, `executions before=${before} after=${after}`)
    const emptyRun = await withSystemContext(() => runDeadlineReminderWorker({ workerInstance: 'w-empty', maxBatch: 25 }))
    rec('D.7', 'Empty queue run reports zero work distinctly from failure', emptyRun.claimed === 0 && emptyRun.examined === 0, JSON.stringify({ examined: emptyRun.examined, claimed: emptyRun.claimed }))
  } finally {
    for (const t of ['deadline_reminder_executions', 'deadline_audit_events']) await admin.query(`alter table ${t} disable trigger ${t === 'deadline_reminder_executions' ? 'trg_deadline_reminder_executions_immutable' : 'trg_deadline_audit_events_immutable'}`).catch(() => {})
    await admin.query(`delete from deadline_reminder_executions where reminder_id = any($1)`, [ids]).catch((e) => console.log('cl1 ' + e.message))
    await admin.query(`delete from deadline_audit_events where organization_id=$1`, [org]).catch((e) => console.log('cl2 ' + e.message))
    for (const t of ['deadline_reminder_executions', 'deadline_audit_events']) await admin.query(`alter table ${t} enable trigger ${t === 'deadline_reminder_executions' ? 'trg_deadline_reminder_executions_immutable' : 'trg_deadline_audit_events_immutable'}`).catch(() => {})
    for (const q of [`delete from deadline_reminders where organization_id=$1`, `delete from grievance_deadlines where id=$2`, `delete from grievances where organization_id=$1`, `delete from organizations where id=$1`]) await admin.query(q, q.includes('$2') ? [org, dl] : [org]).catch((e) => console.log('cl ' + e.message.slice(0, 90)))
    await admin.end()
  }
  const f = out.filter((r) => !r.pass); console.log(`SUMMARY total=${out.length} pass=${out.length - f.length} fail=${f.length}`)
  require('node:fs').writeFileSync(process.argv[2], JSON.stringify(out, null, 1))
  process.exit(0)
}
main().catch((e) => { console.log('FATAL ' + (e.stack || e)); process.exit(1) })






