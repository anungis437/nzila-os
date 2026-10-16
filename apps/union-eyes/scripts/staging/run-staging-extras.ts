import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import { seedNextHttpSmoke } from '../bootstrap-v2/next-http-smoke'

/** Staging extras: document + malware-scan journey and audit persistence checks (synthetic data only). */
const secrets = path.join(process.env.TEMP!, 'ue-v2-staging-secrets')
const read = (name: string) => readFileSync(path.join(secrets, name), 'utf8').trim()
const base = process.argv[2]
const phase = process.argv[3] ?? 'normal'
const out = process.argv[4]
const fixturePath = path.join(secrets, 'extras-fixture.json')
const log: { step: string; status: number | string; note?: string }[] = []
const record = (step: string, status: number | string, note?: string) =>
  log.push({ step, status, note })

async function request(route: string, init: RequestInit & { cookie?: string } = {}) {
  const headers: Record<string, string> = {
    origin: base,
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (init.cookie) headers.cookie = init.cookie
  const response = await fetch(`${base}${route}`, {
    ...init,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
  })
  const bytes = Buffer.from(await response.arrayBuffer())
  return { response, bytes, text: bytes.toString('utf8') }
}
const cookiesOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ')

async function login(fixture: {
  actor: string
  password: string
  mfaSecret: string
  organizations: string[]
}) {
  const first = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${fixture.actor}@example.invalid`, password: fixture.password }),
  })
  const challengeToken = JSON.parse(first.text).mfaChallengeToken
  const second = await request('/api/auth/mfa/challenge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeToken, code: computeTotp(fixture.mfaSecret) }),
  })
  let cookie = cookiesOf(second.response)
  const switched = await request('/api/organizations/switch', {
    method: 'POST',
    cookie,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId: fixture.organizations[0] }),
  })
  cookie = cookiesOf(switched.response)
  return cookie
}

async function upload(
  cookie: string,
  organizationId: string,
  name: string,
  content: Buffer,
  type = 'text/plain',
) {
  const form = new FormData()
  form.set('file', new File([new Uint8Array(content)], name, { type }))
  form.set('organizationId', organizationId)
  form.set('name', name)
  return request('/api/documents/upload', { method: 'POST', cookie, body: form })
}

async function main() {
  const seed = new pg.Client({
    host: 'nzila-ue-v2-staging-db.postgres.database.azure.com',
    user: 'uev2admin',
    password: read('pgadmin.txt'),
    database: 'ue_v2_staging',
    ssl: { rejectUnauthorized: false },
  })
  await seed.connect()
  try {
    let fixture: { actor: string; password: string; mfaSecret: string; organizations: string[] }
    if (existsSync(fixturePath)) fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    else {
      const seeded = await seedNextHttpSmoke(seed, read('mfakey.txt'))
      fixture = {
        actor: seeded.actor,
        password: seeded.password,
        mfaSecret: seeded.mfaSecret,
        organizations: seeded.organizations,
      }
      writeFileSync(fixturePath, JSON.stringify(fixture))
    }
    const cookie = await login(fixture)
    record('login-and-org-select', cookie ? 'OK' : 'NO_COOKIE')
    const synthetic = Buffer.from(`synthetic staging document ${randomUUID()}`)
    const eicar = Buffer.from(
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
    )
    if (phase === 'normal') {
      const clean = await upload(cookie, fixture.organizations[0], 'synthetic-clean.txt', synthetic)
      record('upload-clean-own-org', clean.response.status, clean.text.slice(0, 300))
      const foreign = await upload(
        cookie,
        fixture.organizations[2],
        'synthetic-foreign.txt',
        synthetic,
      )
      record('upload-foreign-org-form-field', foreign.response.status, foreign.text.slice(0, 200))
      const infected = await upload(cookie, fixture.organizations[0], 'synthetic-eicar.txt', eicar)
      record('upload-eicar-rejected', infected.response.status, infected.text.slice(0, 200))
      const rows = await seed.query(
        'SELECT id::text,organization_id::text,uploaded_by,name,file_url FROM public.documents WHERE name = ANY($1)',
        [['synthetic-clean.txt', 'synthetic-foreign.txt', 'synthetic-eicar.txt']],
      )
      record(
        'documents-persisted',
        rows.rowCount ?? 0,
        JSON.stringify(
          rows.rows.map((r) => ({ name: r.name, org: r.organization_id, by: r.uploaded_by })),
        ),
      )
      const clean_row = rows.rows.find((r) => r.name === 'synthetic-clean.txt')
      if (clean_row) {
        const dl = await request(`/api/documents/${clean_row.id}/download`, { cookie })
        record('download-own-document', dl.response.status, `bytes=${dl.bytes.length}`)
        const anon = await request(`/api/documents/${clean_row.id}/download`)
        record('download-anonymous-denied', anon.response.status)
      }
    } else if (phase === 'scannerdown') {
      const down = await upload(
        cookie,
        fixture.organizations[0],
        'synthetic-scanner-down.txt',
        synthetic,
      )
      record('upload-while-scanner-unavailable', down.response.status, down.text.slice(0, 200))
      const rows = await seed.query('SELECT count(*)::int c FROM public.documents WHERE name=$1', [
        'synthetic-scanner-down.txt',
      ])
      record('scanner-down-no-document-persisted', rows.rows[0].c)
    } else if (phase === 'audit') {
      const audit = await seed.query(
        `SELECT count(*)::int total, count(DISTINCT organization_id)::int orgs, count(*) FILTER (WHERE organization_id IS NULL)::int null_org FROM public.audit_logs`,
      )
      record('audit-logs-summary', JSON.stringify(audit.rows[0]))
      const chain = await seed.query(
        `SELECT organization_id::text, count(*)::int n, count(*) FILTER (WHERE previous_hash IS NULL)::int heads FROM public.audit_logs GROUP BY 1 ORDER BY n DESC LIMIT 6`,
      )
      record('audit-chain-heads-per-org', JSON.stringify(chain.rows))
    }
  } finally {
    await seed.end()
    writeFileSync(path.join(out, `staging-extras-${phase}.json`), JSON.stringify(log, null, 2))
    for (const entry of log)
      process.stdout.write(`${entry.step}: ${entry.status} ${entry.note ?? ''}\n`)
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 1200))
  process.exitCode = 1
})
