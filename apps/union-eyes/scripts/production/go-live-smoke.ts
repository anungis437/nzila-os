import assert from 'node:assert/strict'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'

/**
 * Union Eyes V2 go-live smoke. Intended for execution ONLY after a future deployment
 * authorization; it is small by design and never repeats the staging acceptance suite.
 *
 *   tsx scripts/production/go-live-smoke.ts <base-url>
 *
 * Optional environment (a dedicated, synthetic smoke operator in a dedicated smoke organization -
 * never a customer account):
 *   SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_TOTP_SECRET, SMOKE_ORG_ID  authenticated checks
 *   SMOKE_CRON_SECRET                                              cron credential check
 *   EXPECT_ARTIFACT_ID, EXPECT_ENVIRONMENT                         release identity checks
 *
 * It performs no payment, sends no email, and the only write is a rejected EICAR upload.
 */
const base = process.argv[2]
assert(base?.startsWith('https://') || base?.startsWith('http://localhost'), 'base URL required')
const env = process.env
const results: { check: string; ok: boolean; detail: string }[] = []
const record = (check: string, ok: boolean, detail: string) => {
  results.push({ check, ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${check}: ${detail}\n`)
}
const skip = (check: string, why: string) => {
  results.push({ check, ok: true, detail: `SKIPPED (${why})` })
  process.stdout.write(`SKIP  ${check}: ${why}\n`)
}
async function http(
  route: string,
  init: { method?: string; cookie?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const isForm = init.body instanceof FormData
  const response = await fetch(`${base}${route}`, {
    method: init.method ?? 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
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
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: response.status, text, json, response }
}
const cookiesOf = (r: Response) =>
  r.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ')

async function main() {
  // 1. health and release identity
  const health = await http('/api/health')
  record('health', health.status === 200, `HTTP ${health.status}`)
  const version = await http('/api/version')
  record(
    'version',
    version.status === 200,
    `HTTP ${version.status} artifact=${version.json?.artifactId ?? '?'}`,
  )
  if (env.EXPECT_ARTIFACT_ID)
    record(
      'release identity (artifact)',
      version.json?.artifactId === env.EXPECT_ARTIFACT_ID,
      `expected ${env.EXPECT_ARTIFACT_ID} got ${version.json?.artifactId}`,
    )
  if (env.EXPECT_ENVIRONMENT)
    record(
      'release identity (environment)',
      version.json?.environment === env.EXPECT_ENVIRONMENT,
      `expected ${env.EXPECT_ENVIRONMENT} got ${version.json?.environment}`,
    )

  // 2. edge/auth boundaries that need no credentials
  const anonymous = await http('/api/notifications/preferences')
  record('anonymous protected route denied', anonymous.status === 401, `HTTP ${anonymous.status}`)
  const hook = await http('/api/payments/webhooks/stripe', {
    method: 'POST',
    body: '{}',
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=00' },
  })
  // Stripe is optional at initial launch (client-commercial billing is post-launch). Unconfigured is
  // 503 (fails closed); configured must verify signatures (401). Anything else is wrong.
  record(
    'stripe webhook fails closed (401 configured, 503 not enabled)',
    hook.status === 401 || hook.status === 503,
    `HTTP ${hook.status}`,
  )
  const cron = await http('/api/cron/deadline-reminders', { method: 'POST' })
  record('cron route denies without credential', cron.status === 401, `HTTP ${cron.status}`)
  if (env.SMOKE_CRON_SECRET) {
    const withSecret = await http('/api/cron/deadline-reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': env.SMOKE_CRON_SECRET },
    })
    record('cron route accepts credential', withSecret.status === 200, `HTTP ${withSecret.status}`)
  } else skip('cron route accepts credential', 'SMOKE_CRON_SECRET not provided')

  // 3. authenticated checks with the dedicated synthetic smoke operator
  if (!(env.SMOKE_EMAIL && env.SMOKE_PASSWORD && env.SMOKE_TOTP_SECRET && env.SMOKE_ORG_ID)) {
    skip('login / MFA / organization / tenant / storage / Redis', 'smoke operator not provided')
  } else {
    const login = await http('/api/auth/login', {
      method: 'POST',
      body: { email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD },
    })
    record(
      'login (password)',
      login.status === 200 && !!login.json?.mfaChallengeToken,
      `HTTP ${login.status}`,
    )
    const mfa = await http('/api/auth/mfa/challenge', {
      method: 'POST',
      body: {
        challengeToken: login.json?.mfaChallengeToken,
        code: computeTotp(env.SMOKE_TOTP_SECRET),
      },
    })
    record('MFA challenge', mfa.status === 200, `HTTP ${mfa.status}`)
    let cookie = cookiesOf(mfa.response)
    const memberships = await http('/api/users/me/organizations', { cookie })
    record('canonical memberships listed', memberships.status === 200, `HTTP ${memberships.status}`)
    const selected = await http('/api/organizations/switch', {
      method: 'POST',
      cookie,
      body: { organizationId: env.SMOKE_ORG_ID },
    })
    record('organization selection', selected.status === 200, `HTTP ${selected.status}`)
    cookie = cookiesOf(selected.response) || cookie

    const foreign = await http('/api/organizations/switch', {
      method: 'POST',
      cookie,
      body: { organizationId: '00000000-0000-4000-8000-00000000f00d' },
    })
    record(
      'tenant isolation (foreign organization denied)',
      foreign.status === 403 || foreign.status === 404,
      `HTTP ${foreign.status}`,
    )
    const read = await http('/api/notifications/preferences', { cookie })
    record('member read in selected organization', read.status === 200, `HTTP ${read.status}`)

    // Redis: a fail-closed financial route is rate limited before its handler runs, so any handler
    // answer (409 nothing due, 501 member dues payment not enabled) proves the limiter passed and
    // nothing was created. 429/503 means the rate-limit store is unavailable.
    const redis = await http('/api/portal/dues/pay', {
      method: 'POST',
      cookie,
      body: { amount: 1 },
    })
    record(
      'Redis rate-limit store available',
      redis.status === 409 || redis.status === 501,
      `HTTP ${redis.status} (409/501 = limiter passed; 429/503 = limiter unavailable)`,
    )
    // Storage + ClamAV: an EICAR upload must be rejected by the scanner (proves the scanner is
    // reachable and enforcing). Nothing is stored.
    const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
    const form = new FormData()
    form.set('file', new File([eicar], 'smoke-eicar.txt', { type: 'text/plain' }))
    form.set('organizationId', env.SMOKE_ORG_ID)
    form.set('name', 'smoke-eicar.txt')
    const upload = await http('/api/documents/upload', { method: 'POST', cookie, body: form })
    record(
      'malware scanner enforcing (EICAR rejected)',
      upload.status === 400,
      `HTTP ${upload.status} (400 = blocked; 503 = scanner unavailable; 201 = SCANNER NOT ENFORCING)`,
    )
  }

  const failed = results.filter((r) => !r.ok)
  process.stdout.write(
    `\nSMOKE ${failed.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failed.length}/${results.length})\n`,
  )
  process.exitCode = failed.length === 0 ? 0 : 1
}
main().catch((error) => {
  console.error(String(error).slice(0, 800))
  process.exitCode = 1
})
