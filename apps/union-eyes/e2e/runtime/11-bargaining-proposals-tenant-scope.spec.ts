/**
 * R-51: actual HTTP + PostgreSQL acceptance for a child table with no
 * organization_id.  The proposal must inherit tenant jurisdiction from its
 * negotiation for list, item read, create, patch, delete and re-parenting.
 *
 * Synthetic local runtime ONLY.  The generated records are removed with
 * primary-key AND owning-org predicates; no real database is modified.
 * This is distinct from mocked SQL-compiler/unit tests.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const PRIMARY = UE_TEST_ORGS.primary.id
const SECONDARY = UE_TEST_ORGS.secondary.id
const U = UE_TEST_USERS

const as = (actor: { userId: string; orgId: string }): Promise<APIRequestContext> =>
  pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${actor.userId}; selected_org_id=${actor.orgId}` },
  })

type RecordShape = { id: string; negotiationId?: string; title?: string }
const unwrap = (body: unknown): unknown => {
  const value = body as { data?: unknown } | null
  const first = value?.data ?? body
  return (first as { data?: unknown } | null)?.data ?? first
}
const requireId = async (response: Awaited<ReturnType<APIRequestContext['post']>>, label: string): Promise<string> => {
  const text = await response.text()
  expect([200, 201], `${label}: HTTP ${response.status()} ${text.slice(0, 500)}`).toContain(response.status())
  const row = unwrap(JSON.parse(text)) as RecordShape
  expect(row?.id, `${label} must return the persisted id`).toMatch(/^[a-f0-9-]{36}$/i)
  return row.id
}
const negotiation = (marker: string) => ({
  title: `QA scope ${marker}`, unionName: 'Synthetic union', employerName: 'Synthetic employer',
})
const proposal = (negotiationId: string, marker: string) => ({
  negotiationId, proposalNumber: `QA-${marker}`, title: `Synthetic proposal ${marker}`,
  description: 'Synthetic acceptance record', proposalType: 'union_demand',
  proposedLanguage: 'Synthetic bargaining language for tenant-isolation verification.',
})
const readIds = async (api: APIRequestContext): Promise<string[]> => {
  const response = await api.get('/api/bargaining/proposals?limit=100')
  expect(response.status()).toBe(200)
  const rows = unwrap(await response.json()) as RecordShape[]
  expect(Array.isArray(rows)).toBe(true)
  return rows.map((row) => row.id)
}

/** Only discard records created by this one test, on the explicitly disposable local database. */
async function cleanup(records: Array<{ table: 'negotiations' | 'bargaining_proposals'; id: string; org: string }>): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/ue_runtime' ||
      process.env.QA_TEST_ENV !== 'true' || process.env.UE_ENVIRONMENT !== 'local') {
    throw new Error('Refusing cleanup outside isolated local Union Eyes QA database')
  }
  const db = new pg.Client({ connectionString: url.toString() })
  await db.connect()
  try {
    for (const row of records.filter((r) => r.table === 'bargaining_proposals')) {
      await db.query(
        'DELETE FROM bargaining_proposals WHERE id = $1 AND negotiation_id IN (SELECT id FROM negotiations WHERE organization_id = $2)',
        [row.id, row.org],
      )
    }
    for (const row of records.filter((r) => r.table === 'negotiations')) {
      await db.query('DELETE FROM negotiations WHERE id = $1 AND organization_id = $2', [row.id, row.org])
    }
  } finally {
    await db.end()
  }
}

test('R-51: bargaining proposal CRUD enforces its parent negotiation organization over real HTTP', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'API journey runs once at desktop')
  test.skip(!process.env.DATABASE_URL || process.env.QA_TEST_ENV !== 'true' ||
    process.env.UE_ENVIRONMENT !== 'local', 'requires disposable native QA runtime')
  test.setTimeout(240_000)
  const records: Array<{ table: 'negotiations' | 'bargaining_proposals'; id: string; org: string }> = []
  const primary = await as(U.stewardPrimary)
  const secondary = await as(U.wrongOrgSteward)
  const admin = await as(U.adminPrimary)
  const marker = randomUUID().slice(0, 10)
  try {
    const nPrimary = await requireId(await primary.post('/api/bargaining/negotiations', {
      data: negotiation(`primary-${marker}`),
    }), 'primary negotiation')
    records.push({ table: 'negotiations', id: nPrimary, org: PRIMARY })
    const nSecondary = await requireId(await secondary.post('/api/bargaining/negotiations', {
      data: negotiation(`secondary-${marker}`),
    }), 'secondary negotiation')
    records.push({ table: 'negotiations', id: nSecondary, org: SECONDARY })

    const pPrimary = await requireId(await primary.post('/api/bargaining/proposals', {
      data: proposal(nPrimary, `primary-${marker}`),
    }), 'primary proposal')
    records.push({ table: 'bargaining_proposals', id: pPrimary, org: PRIMARY })
    const pSecondary = await requireId(await secondary.post('/api/bargaining/proposals', {
      data: proposal(nSecondary, `secondary-${marker}`),
    }), 'secondary proposal')
    records.push({ table: 'bargaining_proposals', id: pSecondary, org: SECONDARY })

    expect(await readIds(primary)).toContain(pPrimary)
    expect(await readIds(primary)).not.toContain(pSecondary)
    expect(await readIds(secondary)).toContain(pSecondary)
    expect(await readIds(secondary)).not.toContain(pPrimary)

    expect((await primary.get(`/api/bargaining/proposals/${pPrimary}`)).status()).toBe(200)
    for (const ctx of [primary, admin]) {
      const foreign = await ctx.get(`/api/bargaining/proposals/${pSecondary}`)
      expect([403, 404], 'foreign item read must be denied').toContain(foreign.status())
      const changed = await ctx.patch(`/api/bargaining/proposals/${pSecondary}`, { data: { title: 'Hijacked' } })
      expect([403, 404], 'foreign PATCH must be denied').toContain(changed.status())
    }
    const foreignDelete = await admin.delete(`/api/bargaining/proposals/${pSecondary}`)
    expect([403, 404], 'administrator must not DELETE foreign tenant records').toContain(foreignDelete.status())

    const forgedCreate = await primary.post('/api/bargaining/proposals', {
      data: proposal(nSecondary, `foreign-parent-${marker}`),
    })
    expect([403, 404], 'a foreign negotiation may not be used to create a child').toContain(forgedCreate.status())

    const attemptedMove = await primary.patch(`/api/bargaining/proposals/${pPrimary}`, {
      data: { negotiationId: nSecondary, title: 'Legitimate text amendment' },
    })
    expect(attemptedMove.status(), await attemptedMove.text()).toBe(200)
    const fresh = unwrap(await (await primary.get(`/api/bargaining/proposals/${pPrimary}`)).json()) as RecordShape
    expect(fresh.negotiationId).toBe(nPrimary)
    expect(fresh.title).toBe('Legitimate text amendment')
    expect((await secondary.get(`/api/bargaining/proposals/${pPrimary}`)).status()).not.toBe(200)
  } finally {
    await cleanup(records)
    await Promise.all([primary.dispose(), secondary.dispose(), admin.dispose()])
  }
})
