import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import { seedNextHttpSmoke } from '../bootstrap-v2/next-http-smoke'

/**
 * NOTE: member dues payment is a dormant capability. Set UE_MEMBER_DUES_PAYMENTS=1 on the staging app before running this script.
 *
 * Provider-originated Stripe delivery proof (TEST mode, synthetic data). This script never builds or
 * signs a webhook event: it only creates the PaymentIntent through the app and confirms it with
 * Stripe's test card, then waits for Stripe itself to deliver the event to the registered endpoint.
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
    const endpointId = read('stripe-endpoint-id.txt')
    const ep = await stripe('GET', `/webhook_endpoints/${endpointId}`)
    rec(
      'registered-endpoint',
      ep.status === 200 &&
        ep.json.status === 'enabled' &&
        ep.json.livemode === false &&
        ep.json.url === `${base}/api/payments/webhooks/stripe`,
      `${endpointId} status=${ep.json.status} livemode=${ep.json.livemode} events=${(ep.json.enabled_events ?? []).join(',')}`,
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
    await db.query(
      `INSERT INTO public.member_dues_ledger (user_id, organization_id, transaction_type, transaction_date, effective_date, amount, balance_before, balance_after, description, status, created_by) VALUES ($1,$2,'charge',now(),now(),40,0,40,'Synthetic dues charge','posted','synthetic-seed')`,
      [fx.actor, org],
    )
    const init = await fetch(`${base}/api/portal/dues/pay`, {
      method: 'POST',
      headers: { ...jh, cookie },
      body: JSON.stringify({ amount: 1 }),
    })
    await init.text()
    const pending = await db.query(
      `SELECT id::text, status, processor_payment_id FROM public.dues_transactions WHERE member_id=$1 AND organization_id=$2`,
      [fx.actor, org],
    )
    const row = pending.rows[0]
    rec(
      'app-created-payment-intent',
      init.status === 200 &&
        row?.status === 'pending' &&
        /^pi_/.test(row?.processor_payment_id ?? ''),
      `HTTP ${init.status} status=${row?.status}`,
    )
    if (!row) throw new Error('no pending row')
    const pi = row.processor_payment_id as string
    const confirm = await stripe('POST', `/payment_intents/${pi}/confirm`, {
      payment_method: 'pm_card_visa',
      return_url: 'https://example.invalid/return',
    })
    rec(
      'test-card-payment',
      confirm.json.status === 'succeeded',
      `status=${confirm.json.status} livemode=${confirm.json.livemode}`,
    )

    // Wait for Stripe's own delivery; nothing is posted to the webhook route by this script.
    let status = 'pending'
    const started = Date.now()
    while (Date.now() - started < 180000) {
      status = (await db.query(`SELECT status FROM public.dues_transactions WHERE id=$1`, [row.id]))
        .rows[0].status
      if (status !== 'pending') break
      await sleep(3000)
    }
    rec(
      'stripe-delivered-and-settled',
      status === 'paid',
      `status=${status} after ${Math.round((Date.now() - started) / 1000)}s`,
    )
    await sleep(15000)
    const final = await db.query(
      `SELECT (SELECT count(*)::int FROM public.member_dues_ledger WHERE user_id=$1 AND transaction_type='payment') p,
              (SELECT count(*)::int FROM public.audit_logs WHERE organization_id=$2 AND action='dues.settle') au`,
      [fx.actor, org],
    )
    rec(
      'exactly-once',
      final.rows[0].p === 1 && final.rows[0].au === 1,
      `ledgerPayments=${final.rows[0].p} duesSettleAudits=${final.rows[0].au}`,
    )
    const audit = await db.query(
      `SELECT details FROM public.audit_logs WHERE organization_id=$1 AND action='dues.settle'`,
      [org],
    )
    const details = audit.rows[0]?.details ?? {}
    const eventId = details.stripeEventId as string | undefined
    const ev = eventId ? await stripe('GET', `/events/${eventId}`) : { status: 0, json: {} as any }
    rec(
      'event-id-originated-at-stripe',
      ev.status === 200 &&
        ev.json.type === 'payment_intent.succeeded' &&
        ev.json.data?.object?.id === pi &&
        ev.json.livemode === false,
      `eventId=${eventId} stripeLookup=HTTP ${ev.status} type=${ev.json.type} pendingWebhooks=${ev.json.pending_webhooks}`,
    )
    const bal = await fetch(`${base}/api/dues/balance`, { headers: { ...jh, cookie } })
    const balText = await bal.text()
    rec('balance-reload', bal.status === 200, `HTTP ${bal.status} ${balText.slice(0, 220)}`)
    const ledger = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN transaction_type='charge' THEN amount ELSE -amount END),0)::text AS outstanding FROM public.member_dues_ledger WHERE user_id=$1 AND organization_id=$2 AND status='posted'`,
      [fx.actor, org],
    )
    rec(
      'outstanding-after-settlement',
      Number(ledger.rows[0].outstanding) === 0,
      `outstanding=${ledger.rows[0].outstanding}`,
    )
  } finally {
    await db.end()
    writeFileSync(
      path.join(out, 'staging-stripe-delivery-proof.json'),
      JSON.stringify(log, null, 2),
    )
    process.stdout.write(`TOTAL ${log.filter((x) => x.ok).length}/${log.length}\n`)
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 1200))
  process.exitCode = 1
})
