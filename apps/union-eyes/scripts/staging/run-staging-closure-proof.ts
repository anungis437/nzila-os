import { createHash, createHmac, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import {
  runNextHttpSmoke,
  seedNextHttpSmoke,
  type HttpObservation,
} from '../bootstrap-v2/next-http-smoke'

/**
 * NOTE: member dues payment is a dormant capability. Set UE_MEMBER_DUES_PAYMENTS=1 on the staging app before running this script.
 *
 * Bounded staging defect-closure proof (synthetic data only). Seeds synthetic actors through the
 * operator connection and drives the deployed staging application over HTTP. No Stripe API key is
 * configured, so settlement is proven with locally signed webhooks using the staging webhook secret.
 */
const secrets = path.join(process.env.TEMP!, 'ue-v2-staging-secrets')
const read = (name: string) => readFileSync(path.join(secrets, name), 'utf8').trim()
const base = process.argv[2]
const out = process.argv[3]
const results: { journey: string; expected: string; actual: string; pass: boolean }[] = []
const observations: HttpObservation[] = []
const check = (journey: string, expected: string, actual: string | number, pass: boolean) => {
  results.push({ journey, expected, actual: String(actual), pass })
  process.stdout.write(
    `${pass ? 'PASS' : 'FAIL'} ${journey}: expected ${expected}, got ${actual}\n`,
  )
}

async function call(
  name: string,
  route: string,
  init: { method?: string; cookie?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const isForm = init.body instanceof FormData
  const response = await fetch(`${base}${route}`, {
    method: init.method ?? 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
    headers: {
      origin: base,
      ...(init.body === undefined || isForm || typeof init.body === 'string'
        ? {}
        : { 'content-type': 'application/json' }),
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.headers ?? {}),
    },
    ...(init.body === undefined
      ? {}
      : {
          body:
            isForm || typeof init.body === 'string'
              ? (init.body as BodyInit)
              : JSON.stringify(init.body),
        }),
  })
  const text = await response.text()
  observations.push({
    name,
    path: route,
    method: init.method ?? 'GET',
    status: response.status,
  })
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { response, text, json, status: response.status }
}
const cookiesOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ')

async function login(userId: string, password: string, mfaSecret: string, organizationId: string) {
  const first = await call('login', '/api/auth/login', {
    method: 'POST',
    body: { email: `${userId}@example.invalid`, password },
  })
  const second = await call('mfa', '/api/auth/mfa/challenge', {
    method: 'POST',
    body: { challengeToken: first.json.mfaChallengeToken, code: computeTotp(mfaSecret) },
  })
  return selectOrganization(cookiesOf(second.response), organizationId)
}
async function selectOrganization(cookie: string, organizationId: string) {
  const switched = await call('org-switch', '/api/organizations/switch', {
    method: 'POST',
    cookie,
    body: { organizationId },
  })
  return cookiesOf(switched.response) || cookie
}

function signedWebhook(payload: object, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(payload)
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return { body, header: `t=${timestamp},v1=${signature}` }
}

async function main() {
  const webhookSecret = read('stripe-webhook-synthetic.txt')
  process.env.UE_V2_SMOKE_CRON_SECRET = read('cron.txt')
  const seed = new pg.Client({
    host: 'nzila-ue-v2-staging-db.postgres.database.azure.com',
    user: 'uev2admin',
    password: read('pgadmin.txt'),
    database: 'ue_v2_staging',
    ssl: { rejectUnauthorized: false },
  })
  await seed.connect()
  try {
    const health = await call('health', '/api/health')
    check('health', '200', health.status, health.status === 200)

    const fixture = await seedNextHttpSmoke(seed, read('mfakey.txt'))
    const [org0, org1] = fixture.organizations
    const { actor, administrator } = fixture
    writeFileSync(
      path.join(secrets, 'closure-fixture.json'),
      JSON.stringify({ ...fixture, at: new Date().toISOString() }),
    )
    for (const org of [org0, org1])
      await seed.query(
        `INSERT INTO public.org_entitlements (organization_id, feature_key) VALUES ($1,'grievance_case_suite') ON CONFLICT DO NOTHING`,
        [org],
      )

    // Journey set 1: existing representative smoke (auth, MFA, org selection, cross-org denial,
    // claim create, role revocation, cron credential, logout/revocation).
    const smoke = await runNextHttpSmoke(base, seed, fixture, observations, {
      duesInitiationStatuses: [409, 502, 503],
      documentRepositoryStatuses: [400, 403],
    })
    check('representative-smoke', 'all steps pass', smoke.status ?? 'ok', true)

    // Claims in two organizations on the same day must both start at the first sequence number.
    await seed.query(
      `UPDATE user_management.organization_users SET role='steward' WHERE user_id=$1`,
      [actor],
    )
    let cookie = await login(actor, fixture.password, fixture.mfaSecret, org0)
    const claim0 = await call('claim-org0', '/api/claims', {
      method: 'POST',
      cookie,
      body: { claimType: 'other', description: 'Synthetic org0 claim', priority: 'low' },
    })
    cookie = await selectOrganization(cookie, org1)
    const claim1 = await call('claim-org1', '/api/claims', {
      method: 'POST',
      cookie,
      body: { claimType: 'other', description: 'Synthetic org1 claim', priority: 'low' },
    })
    const numberOf = (text: string) => text.match(/CLM-\d{8}-\d{4}/)?.[0]
    const n0 = numberOf(claim0.text)
    const n1 = numberOf(claim1.text)
    const sameDayBoth = await seed.query(
      `SELECT organization_id::text o, claim_number FROM public.claims WHERE organization_id = ANY($1::uuid[]) ORDER BY claim_number`,
      [[org0, org1]],
    )
    const firstSeq = sameDayBoth.rows.filter((r) => r.claim_number.endsWith('-0001')).length
    check(
      'claim-number-per-organization',
      'both orgs create claims; each org has its own -0001',
      `${claim0.status}/${claim1.status} ${n0}/${n1} firstSeqRows=${firstSeq}`,
      [200, 201].includes(claim0.status) && [200, 201].includes(claim1.status) && firstSeq === 2,
    )

    // Case audit timeline (reads canonical public.audit_logs).
    cookie = await selectOrganization(cookie, org0)
    const timeline = await call('case-audit-timeline', `/api/cases/${n0}/audit`, { cookie })
    check(
      'case-audit-timeline',
      '200 with a claim.create entry',
      `${timeline.status} ${timeline.text.includes('claim.create')}`,
      timeline.status === 200 && timeline.text.includes('claim.create'),
    )

    // Grievance access (text user ids end to end).
    const grievance = await seed.query(
      `INSERT INTO public.grievances (organization_id, created_by, title, grievance_number)
       VALUES ($1,$2,'Synthetic grievance',$3) RETURNING id::text`,
      [org0, actor, `G-${Date.now()}`],
    )
    const grievanceId = grievance.rows[0].id
    const accessGet = await call('grievance-access-read', `/api/grievances/${grievanceId}/access`, {
      cookie,
    })
    check('grievance-access-read', '200', accessGet.status, accessGet.status === 200)
    const accessGrant = await call(
      'grievance-access-grant',
      `/api/grievances/${grievanceId}/access`,
      {
        method: 'POST',
        cookie,
        body: { userId: administrator, accessRole: 'reviewer' },
      },
    )
    check(
      'grievance-access-grant',
      '200 for a text user id',
      accessGrant.status,
      accessGrant.status === 200,
    )

    // Documents.
    const upload = async (organizationId: string, name: string, bytes: Buffer) => {
      const form = new FormData()
      form.set('file', new File([new Uint8Array(bytes)], name, { type: 'text/plain' }))
      form.set('organizationId', organizationId)
      form.set('name', name)
      return call(`upload-${name}`, '/api/documents/upload', { method: 'POST', cookie, body: form })
    }
    const eicar = Buffer.from(
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
    )
    const clean = await upload(org0, 'closure-clean.txt', Buffer.from(`closure ${randomUUID()}`))
    check('document-upload-clean', '201', clean.status, clean.status === 201)
    const foreign = await upload(org1, 'closure-foreign.txt', Buffer.from('x'))
    check('document-upload-foreign-org', '403', foreign.status, foreign.status === 403)
    const infected = await upload(org0, 'closure-eicar.txt', eicar)
    check(
      'document-upload-eicar',
      '4xx blocked',
      infected.status,
      [400, 422].includes(infected.status),
    )
    const documentId = clean.json?.id
    const download = await call('document-download', `/api/documents/${documentId}/download`, {
      cookie,
    })
    check('document-download', '200', download.status, download.status === 200)
    const anonymousDownload = await call(
      'document-download-anon',
      `/api/documents/${documentId}/download`,
    )
    check(
      'document-download-anonymous',
      '401',
      anonymousDownload.status,
      anonymousDownload.status === 401,
    )

    // Membership (admin of org0 adds a synthetic member).
    const adminCookie = await login(administrator, fixture.password, fixture.mfaSecret, org0)
    const newMember = `ue-v2-closure-member-${randomUUID()}`
    const membership = await call('membership-create', `/api/organizations/${org0}/members`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        user_id: newMember,
        role: 'member',
        name: 'Synthetic Closure Member',
        email: `${newMember}@example.invalid`,
      },
    })
    check('membership-create', '201', membership.status, membership.status === 201)

    // Dues: member self-credit is rejected, then a server-owned pending payment is settled only by
    // a verified provider event (idempotent; tampering fails closed).
    cookie = await selectOrganization(cookie, org1)
    await seed.query(
      `UPDATE user_management.organization_users SET role='member' WHERE user_id=$1`,
      [actor],
    )
    const before = await seed.query(
      `SELECT count(*)::int c FROM public.member_dues_ledger WHERE user_id=$1`,
      [actor],
    )
    const selfCredit = await call('dues-self-credit-attempt', '/api/portal/dues/pay', {
      method: 'POST',
      cookie,
      body: { organizationId: org1, amount: 25, paymentMethod: 'cash' },
    })
    const afterSelf = await seed.query(
      `SELECT count(*)::int c FROM public.member_dues_ledger WHERE user_id=$1`,
      [actor],
    )
    check(
      'member-self-credit-bypass',
      'no ledger credit; not 2xx',
      `${selfCredit.status} ledger ${before.rows[0].c}->${afterSelf.rows[0].c}`,
      selfCredit.status >= 400 &&
        selfCredit.status < 500 + 100 &&
        afterSelf.rows[0].c === before.rows[0].c,
    )
    const paymentId = randomUUID()
    const paymentIntent = `pi_synthetic_${randomUUID().replace(/-/g, '')}`
    await seed.query(
      `INSERT INTO public.member_dues_ledger
         (user_id, organization_id, transaction_type, transaction_date, effective_date, amount,
          balance_before, balance_after, description, status, created_by)
       VALUES ($1,$2,'charge',now(),now(),40,0,40,'Synthetic dues charge','posted','synthetic-seed')`,
      [actor, org1],
    )
    await seed.query(
      `INSERT INTO public.dues_transactions
         (id, organization_id, member_id, amount, period_start, period_end, due_date, dues_amount,
          total_amount, status, processor_payment_id)
       VALUES ($1,$2,$3,40,current_date,current_date,current_date,40,40,'pending',$4)`,
      [paymentId, org1, actor, paymentIntent],
    )
    const event = (type: string, metadata: Record<string, string>, id = `evt_${randomUUID()}`) => ({
      id,
      object: 'event',
      type,
      data: {
        object: {
          id: paymentIntent,
          object: 'payment_intent',
          amount: 4000,
          amount_received: 4000,
          currency: 'cad',
          metadata,
        },
      },
    })
    const goodMetadata = {
      ue_payment_kind: 'member_dues',
      ue_dues_payment_id: paymentId,
      organization_id: org1,
      member_user_id: actor,
    }
    const post = (signed: { body: string; header: string }) =>
      call('stripe-webhook', '/api/payments/webhooks/stripe', {
        method: 'POST',
        body: signed.body,
        headers: { 'content-type': 'application/json', 'stripe-signature': signed.header },
      })
    const unsigned = await call('stripe-webhook-unsigned', '/api/payments/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    })
    check('stripe-webhook-unsigned', '400', unsigned.status, unsigned.status === 400)
    const badSignature = await post(
      signedWebhook(event('payment_intent.succeeded', goodMetadata), 'whsec_wrong_secret'),
    )
    check('stripe-webhook-bad-signature', '401', badSignature.status, badSignature.status === 401)
    const tampered = await post(
      signedWebhook(
        event('payment_intent.succeeded', { ...goodMetadata, member_user_id: 'someone-else' }),
        webhookSecret,
      ),
    )
    const afterTamper = await seed.query(
      `SELECT status FROM public.dues_transactions WHERE id=$1`,
      [paymentId],
    )
    const ledgerAfterTamper = await seed.query(
      `SELECT count(*)::int c FROM public.member_dues_ledger WHERE user_id=$1 AND transaction_type='payment'`,
      [actor],
    )
    check(
      'stripe-tampered-metadata',
      '422, still pending, no credit',
      `${tampered.status} ${afterTamper.rows[0].status} payments=${ledgerAfterTamper.rows[0].c}`,
      tampered.status === 422 &&
        afterTamper.rows[0].status === 'pending' &&
        ledgerAfterTamper.rows[0].c === 0,
    )
    const eventId = `evt_${randomUUID()}`
    const settled = await post(
      signedWebhook(event('payment_intent.succeeded', goodMetadata, eventId), webhookSecret),
    )
    const duplicate = await post(
      signedWebhook(event('payment_intent.succeeded', goodMetadata, eventId), webhookSecret),
    )
    const redelivery = await post(
      signedWebhook(event('payment_intent.succeeded', goodMetadata), webhookSecret),
    )
    const finalState = await seed.query(
      `SELECT (SELECT status FROM public.dues_transactions WHERE id=$1) AS status,
              (SELECT count(*)::int FROM public.member_dues_ledger WHERE user_id=$2 AND transaction_type='payment' AND payment_reference=$3) AS payments`,
      [paymentId, actor, paymentIntent],
    )
    check(
      'stripe-settlement-idempotent',
      '200/200/200, paid, exactly one ledger payment',
      `${settled.status}/${duplicate.status}/${redelivery.status} ${finalState.rows[0].status} payments=${finalState.rows[0].payments}`,
      settled.status === 200 &&
        duplicate.status === 200 &&
        redelivery.status === 200 &&
        finalState.rows[0].status === 'paid' &&
        finalState.rows[0].payments === 1,
    )
    const history = await call('dues-ledger-reload', '/api/dues/payment-history', { cookie })
    check('dues-ledger-reload', '200', history.status, history.status === 200)
    const balance = await call('dues-balance', '/api/dues/balance', { cookie })
    check('dues-balance', '200', balance.status, balance.status === 200)

    // SYSTEM deadline processing (+ Resend delivery to the provider's synthetic test recipient).
    const deadline = await seed.query(
      `INSERT INTO public.grievance_deadlines (grievance_id, due_date) VALUES ($1, now() + interval '3 days') RETURNING id::text`,
      [grievanceId],
    )
    const recipient = 'delivered@resend.dev'
    const reminder = await seed.query(
      `INSERT INTO public.deadline_reminders
         (source_table, source_deadline_id, organization_id, offset_days, scheduled_for, recipient_role,
          recipient_email, recipient_email_hash)
       VALUES ('grievance_deadlines',$1,$2,3,now() - interval '1 minute','steward',$3,$4) RETURNING id::text`,
      [deadline.rows[0].id, org0, recipient, createHash('sha256').update(recipient).digest('hex')],
    )
    const cron = await call('cron-deadline-reminders', '/api/cron/deadline-reminders', {
      headers: { 'x-cron-secret': read('cron.txt') },
    })
    const execution = await seed.query(
      `SELECT outcome, error_code FROM public.deadline_reminder_executions WHERE reminder_id=$1`,
      [reminder.rows[0].id],
    )
    check(
      'cron-deadline-reminders',
      '200 and an execution record',
      `${cron.status} ${JSON.stringify(execution.rows)} ${cron.text.slice(0, 160)}`,
      cron.status === 200 && execution.rowCount === 1,
    )
    writeFileSync(
      path.join(out, 'closure-resend-outcome.json'),
      JSON.stringify({ execution: execution.rows, cron: cron.json }, null, 2),
    )

    // Required audit records and chain heads.
    const actions = await seed.query(
      `SELECT action, count(*)::int n FROM public.audit_logs
       WHERE organization_id = ANY($1::uuid[]) GROUP BY action ORDER BY action`,
      [[org0, org1]],
    )
    const have = new Set(actions.rows.map((r) => r.action as string))
    const required = [
      'claim.create',
      'document.upload',
      'document.download',
      'membership.create',
      'dues.settle',
    ]
    const missing = required.filter((a) => !have.has(a))
    const systemAudit = await seed.query(
      `SELECT count(*)::int c FROM public.audit_logs WHERE organization_id = ANY($1::uuid[]) AND user_id LIKE 'system:%' AND action NOT LIKE 'dues.%'`,
      [[org0, org1]],
    )
    check(
      'critical-audit-events',
      'all required actions present',
      `missing=${JSON.stringify(missing)} systemDeadlineAudit=${systemAudit.rows[0].c} actions=${JSON.stringify(actions.rows)}`,
      missing.length === 0 && systemAudit.rows[0].c > 0,
    )
    const heads = await seed.query(
      `SELECT organization_id::text o, count(*)::int n, count(*) FILTER (WHERE previous_hash IS NULL)::int heads
       FROM public.audit_logs WHERE organization_id = ANY($1::uuid[]) GROUP BY 1`,
      [[org0, org1]],
    )
    check(
      'audit-chain-single-head',
      'one head per organization',
      JSON.stringify(heads.rows),
      heads.rows.length > 0 && heads.rows.every((r) => r.heads === 1),
    )

    // 501 NOT_IMPLEMENTED (legacy endpoint) and the provider-not-configured 502 on dues initiation
    // are deliberate fail-closed responses, not internal errors.
    const unexpected = observations.filter(
      (o) =>
        o.status >= 500 &&
        o.status !== 501 &&
        o.name !== 'dues-initiation-fails-closed-without-rate-limit-store' &&
        o.name !== 'dues-self-credit-attempt',
    )
    check('unexpected-5xx', '0', JSON.stringify(unexpected), unexpected.length === 0)
  } finally {
    await seed.end()
    writeFileSync(
      path.join(out, 'staging-closure-proof.json'),
      JSON.stringify({ results, observations }, null, 2),
    )
    process.stdout.write(
      `TOTAL ${results.filter((r) => r.pass).length}/${results.length} pass; observations=${observations.length}\n`,
    )
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 1800))
  process.exitCode = 1
})
