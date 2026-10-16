import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'

/** Targeted staging sweep of the entitlement-gated launch-scope GET routes (synthetic data only). */
const secrets = path.join(process.env.TEMP!, 'ue-v2-staging-secrets')
const base = process.argv[2]
const out = process.argv[3]
const fixture = JSON.parse(readFileSync(path.join(secrets, 'extras-fixture.json'), 'utf8')) as {
  actor: string
  password: string
  mfaSecret: string
  organizations: string[]
}
const cookiesOf = (r: Response) =>
  r.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ')
async function call(route: string, o: { method?: string; cookie?: string; body?: unknown } = {}) {
  const r = await fetch(`${base}${route}`, {
    method: o.method ?? 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
    headers: {
      origin: base,
      ...(o.cookie ? { cookie: o.cookie } : {}),
      ...(o.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(o.body ? { body: JSON.stringify(o.body) } : {}),
  })
  return { status: r.status, text: (await r.text()).slice(0, 200), headers: r.headers }
}
async function main() {
  const first = await call('/api/auth/login', {
    method: 'POST',
    body: { email: `${fixture.actor}@example.invalid`, password: fixture.password },
  })
  void first
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email: `${fixture.actor}@example.invalid`, password: fixture.password }),
  })
  const token = (await login.json()).mfaChallengeToken
  const mfa = await fetch(`${base}/api/auth/mfa/challenge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ challengeToken: token, code: computeTotp(fixture.mfaSecret) }),
  })
  const sw = await fetch(`${base}/api/organizations/switch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, cookie: cookiesOf(mfa) },
    body: JSON.stringify({ organizationId: fixture.organizations[0] }),
  })
  const cookie = cookiesOf(sw)
  const id = randomUUID()
  const routes = [
    '/api/grievances',
    `/api/grievances/${id}`,
    `/api/grievances/${id}/access`,
    `/api/grievances/${id}/documents`,
    `/api/grievances/${id}/related-documents`,
    `/api/grievances/${id}/status`,
    `/api/grievances/${id}/intelligence`,
    '/api/documents/repository',
    `/api/documents/repository/${id}`,
    `/api/documents/repository/${id}/versions`,
    `/api/cases/${id}/audit`,
    `/api/cases/${id}/next-actions`,
    `/api/cases/${id}/notes`,
    '/api/dues/calculate',
    '/api/search/universal?q=test',
    '/api/claims',
    `/api/claims/${id}`,
    '/api/dues/balance',
    '/api/dues/payment-history',
    '/api/members',
    '/api/notifications',
  ]
  const results: { route: string; status: number; body: string }[] = []
  for (const route of routes) {
    const r = await call(route, { cookie })
    results.push({ route: route.replace(id, '{id}'), status: r.status, body: r.text.slice(0, 120) })
  }
  writeFileSync(path.join(out, 'staging-sweep.json'), JSON.stringify(results, null, 2))
  for (const r of results)
    process.stdout.write(`${r.status} ${r.route} ${r.status >= 500 ? r.body : ''}\n`)
}
main().catch((e) => {
  console.error(String(e).slice(0, 800))
  process.exitCode = 1
})
