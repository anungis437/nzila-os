import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import { seedNextHttpSmoke } from '../bootstrap-v2/next-http-smoke'

/**
 * NOTE: member dues payment is a dormant capability. Set UE_MEMBER_DUES_PAYMENTS=1 on the staging app before running this script.
 *
 * Real-provider staging proof for member dues (Stripe TEST mode only, synthetic data). The app
 * creates a real PaymentIntent; Stripe's test card confirms it; settlement goes through the
 * webhook route with the real PaymentIntent object signed locally using the staging webhook secret.
 */
const secrets = path.join(process.env.TEMP!, 'ue-v2-staging-secrets')
const read = (n: string) => readFileSync(path.join(secrets, n), 'utf8').trim()
const base = process.argv[2]
const out = process.argv[3]
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
async function stripe(method: string, route: string, form?: Record<string, string>) {
  const r = await fetch(`https://api.stripe.com/v1${route}`, {
    method,
    headers: {
      authorization: `Bearer ${read('stripe-sk.txt')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  })
  return { status: r.status, json: (await r.json()) as any }
}
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
    const bal = await stripe('GET', '/balance')
    rec(
      'stripe-key-test-mode',
      bal.status === 200 && bal.json.livemode === false,
      `HTTP ${bal.status} livemode=${bal.json.livemode}`,
    )
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
    const none = await fetch(`${base}/api/portal/dues/pay`, {
      method: 'POST',
      headers: { ...jh, cookie },
      body: JSON.stringify({ amount: 1 }),
    })
    rec('initiation-nothing-due', none.status === 409, `HTTP ${none.status}`)
    await db.query(
      `INSERT INTO public.member_dues_ledger (user_id, organization_id, transaction_type, transaction_date, effective_date, amount, balance_before, balance_after, description, status, created_by) VALUES ($1,$2,'charge',now(),now(),40,0,40,'Synthetic dues charge','posted','synthetic-seed')`,
      [fx.actor, org],
    )
    const init = await fetch(`${base}/api/portal/dues/pay`, {
      method: 'POST',
      headers: { ...jh, cookie },
      body: JSON.stringify({ amount: 1 }),
    })
    const initText = await init.text()
    const pending = await db.query(
      `SELECT id::text, amount::text, status, processor_payment_id FROM public.dues_transactions WHERE member_id=$1 AND organization_id=$2`,
      [fx.actor, org],
    )
    const row = pending.rows[0]
    rec(
      'initiation-creates-real-payment-intent',
      init.status === 200 &&
        row?.status === 'pending' &&
        /^pi_/.test(row?.processor_payment_id ?? ''),
      `HTTP ${init.status} pendingRows=${pending.rowCount} amount=${row?.amount} clientSecretReturned=${/client_secret|clientSecret/.test(initText)} body=${init.status === 200 ? 'ok' : initText.slice(0, 160)}`,
    )
    if (!row) throw new Error('no pending row')
    const credited = await db.query(
      `SELECT count(*)::int c FROM public.member_dues_ledger WHERE user_id=$1 AND transaction_type='payment'`,
      [fx.actor],
    )
    rec('no-credit-before-settlement', credited.rows[0].c === 0, `payments=${credited.rows[0].c}`)
    const pi = row.processor_payment_id as string
    const confirm = await stripe('POST', `/payment_intents/${pi}/confirm`, {
      payment_method: 'pm_card_visa',
      return_url: 'https://example.invalid/return',
    })
    rec(
      'stripe-test-card-confirm',
      confirm.status === 200 && confirm.json.status === 'succeeded',
      `HTTP ${confirm.status} status=${confirm.json.status} livemode=${confirm.json.livemode}`,
    )
    const live = await stripe('GET', `/payment_intents/${pi}`)
    const wh = read('stripe-webhook.txt')
    const sign = (event: object, secret = wh) => {
      const body = JSON.stringify(event)
      const t = Math.floor(Date.now() / 1000)
      return {
        body,
        header: `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`,
      }
    }
    const evt = (id: string, obj: unknown) => ({
      id,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: obj },
    })
    const post = (x: { body: string; header: string }) =>
      fetch(`${base}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': x.header },
        body: x.body,
      })
    const tampered = await post(
      sign(
        evt(`evt_${randomUUID()}`, {
          ...live.json,
          metadata: { ...live.json.metadata, member_user_id: 'someone-else' },
        }),
      ),
    )
    const afterT = await db.query(`SELECT status FROM public.dues_transactions WHERE id=$1`, [
      row.id,
    ])
    rec(
      'tampered-event-rejected',
      tampered.status === 422 && afterT.rows[0].status === 'pending',
      `HTTP ${tampered.status} status=${afterT.rows[0].status}`,
    )
    const eid = `evt_${randomUUID()}`
    const a = await post(sign(evt(eid, live.json)))
    const b = await post(sign(evt(eid, live.json)))
    const final = await db.query(
      `SELECT (SELECT status FROM public.dues_transactions WHERE id=$1) s,
              (SELECT count(*)::int FROM public.member_dues_ledger WHERE user_id=$2 AND transaction_type='payment') p,
              (SELECT count(*)::int FROM public.audit_logs WHERE organization_id=$3 AND action='dues.settle') au`,
      [row.id, fx.actor, org],
    )
    rec(
      'real-pi-settled-once-with-audit',
      a.status === 200 &&
        b.status === 200 &&
        final.rows[0].s === 'paid' &&
        final.rows[0].p === 1 &&
        final.rows[0].au === 1,
      `${a.status}/${b.status} status=${final.rows[0].s} ledgerPayments=${final.rows[0].p} auditRows=${final.rows[0].au}`,
    )
    const hist = await fetch(`${base}/api/dues/payment-history`, { headers: { ...jh, cookie } })
    rec('ledger-reload', hist.status === 200, `HTTP ${hist.status}`)
  } finally {
    await db.end()
    writeFileSync(path.join(out, 'staging-stripe-proof.json'), JSON.stringify(log, null, 2))
    process.stdout.write(`TOTAL ${log.filter((x) => x.ok).length}/${log.length}\n`)
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 1200))
  process.exitCode = 1
})
