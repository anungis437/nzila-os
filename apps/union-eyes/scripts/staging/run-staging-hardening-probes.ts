import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import { seedNextHttpSmoke } from '../bootstrap-v2/next-http-smoke'

/**
 * Production-hardening operational probes against staging (synthetic data only):
 *   phase "resend"     - a deadline reminder is delivered through the app with the staging-specific Resend key
 *   phase "redis-up"   - control: with Redis running, the same route passes the limiter (409, nothing due)
 *   phase "redis-down" - with Redis stopped, a rate-limited financial route fails closed (never 2xx)
 */
const secrets = path.join(process.env.TEMP!, 'ue-v2-staging-secrets')
const read = (n: string) => readFileSync(path.join(secrets, n), 'utf8').trim()
const [base, out, phase] = process.argv.slice(2)
const log: { step: string; ok: boolean; detail: string }[] = []
const rec = (step: string, ok: boolean, detail: string) => {
  log.push({ step, ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${step}: ${detail}\n`)
}
const ck = (r: Response) =>
  r.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ')
const jh = { 'content-type': 'application/json', origin: base }

async function main() {
  const db = new pg.Client({
    host: 'nzila-ue-v2-staging-db.postgres.database.azure.com',
    user: 'uev2admin',
    password: read('pgadmin.txt'),
    database: 'ue_v2_staging',
    ssl: { rejectUnauthorized: false },
  })
  await db.connect()
  try {
    const fx = await seedNextHttpSmoke(db, read('mfakey.txt'))
    const [org] = fx.organizations
    const l = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: jh,
      body: JSON.stringify({ email: `${fx.actor}@example.invalid`, password: fx.password }),
    })
    const m = await fetch(`${base}/api/auth/mfa/challenge`, {
      method: 'POST',
      headers: jh,
      body: JSON.stringify({
        challengeToken: (await l.json()).mfaChallengeToken,
        code: computeTotp(fx.mfaSecret),
      }),
    })
    const s = await fetch(`${base}/api/organizations/switch`, {
      method: 'POST',
      headers: { ...jh, cookie: ck(m) },
      body: JSON.stringify({ organizationId: org }),
    })
    const cookie = ck(s) || ck(m)
    if (phase === 'redis-down' || phase === 'redis-up') {
      const r = await fetch(`${base}/api/portal/dues/pay`, {
        method: 'POST',
        headers: { ...jh, cookie },
        body: JSON.stringify({ amount: 1 }),
      })
      const text = await r.text()
      const down = phase === 'redis-down'
      rec(
        down
          ? 'rate-limited-route-fails-closed-without-redis'
          : 'rate-limited-route-passes-with-redis',
        down ? r.status === 429 || r.status === 503 : r.status === 409,
        `HTTP ${r.status} ${text.slice(0, 120)}`,
      )
      return
    }
    await db.query(
      `INSERT INTO public.org_entitlements (organization_id, feature_key) VALUES ($1,'grievance_case_suite') ON CONFLICT DO NOTHING`,
      [org],
    )
    const g = await db.query(
      `INSERT INTO public.grievances (organization_id, created_by, title, grievance_number) VALUES ($1,$2,'Synthetic grievance',$3) RETURNING id::text`,
      [org, fx.actor, `G-${Date.now()}`],
    )
    const d = await db.query(
      `INSERT INTO public.grievance_deadlines (grievance_id, due_date) VALUES ($1, now() + interval '3 days') RETURNING id::text`,
      [g.rows[0].id],
    )
    const recipient = 'delivered@resend.dev'
    const rem = await db.query(
      `INSERT INTO public.deadline_reminders (source_table, source_deadline_id, organization_id, offset_days, scheduled_for, recipient_role, recipient_email, recipient_email_hash)
       VALUES ('grievance_deadlines',$1,$2,3,now() - interval '1 minute','steward',$3,$4) RETURNING id::text`,
      [d.rows[0].id, org, recipient, createHash('sha256').update(recipient).digest('hex')],
    )
    const cron = await fetch(`${base}/api/cron/deadline-reminders`, {
      headers: { 'x-cron-secret': read('cron.txt') },
    })
    const ex = await db.query(
      `SELECT outcome, error_code FROM public.deadline_reminder_executions WHERE reminder_id=$1`,
      [rem.rows[0].id],
    )
    const sent = await db.query(
      `SELECT count(*)::int c FROM public.audit_logs WHERE organization_id=$1 AND action='deadline.reminder.sent'`,
      [org],
    )
    rec(
      'resend-delivery-through-app',
      cron.status === 200 && ex.rows[0]?.outcome === 'sent' && sent.rows[0].c === 1,
      `cron HTTP ${cron.status} outcome=${ex.rows[0]?.outcome} sentAudits=${sent.rows[0].c}`,
    )
  } finally {
    await db.end()
    writeFileSync(path.join(out, `staging-hardening-${phase}.json`), JSON.stringify(log, null, 2))
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 1000))
  process.exitCode = 1
})
