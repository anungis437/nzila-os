/** Real HTTP acceptance for privileged OpenAPI and two removed organization-row facades. */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const as = (actor: { userId: string; orgId: string }): Promise<APIRequestContext> =>
  pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${actor.userId}; selected_org_id=${actor.orgId}` },
  })

test('Gate 0: privileged OpenAPI and organization facade containment over actual HTTP', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'API authorization journey runs once at desktop')
  test.skip(!process.env.DATABASE_URL || process.env.QA_TEST_ENV !== 'true' ||
    process.env.UE_ENVIRONMENT !== 'local', 'requires disposable native QA runtime')

  const admin = await as(UE_TEST_USERS.adminPrimary)
  const steward = await as(UE_TEST_USERS.stewardPrimary)
  const anonymous = await pwRequest.newContext({ baseURL: BASE })
  const own = UE_TEST_ORGS.primary.id
  const foreign = UE_TEST_ORGS.secondary.id

  try {
    const deniedDocs = await anonymous.get('/api/docs/openapi.json', { maxRedirects: 0 })
    expect([401, 403, 302, 303, 307, 308]).toContain(deniedDocs.status())
    expect(await deniedDocs.text()).not.toContain('"openapi":"3.0.0"')

    const adminDocs = await admin.get('/api/docs/openapi.json')
    expect(adminDocs.status(), await adminDocs.text()).toBe(200)
    expect(adminDocs.headers()['cache-control']).toContain('no-store')
    const spec = await adminDocs.json()
    expect(spec.openapi).toBeDefined()

    for (const suffix of ['access-logs', 'sharing-settings']) {
      const path = `/api/organizations/${own}/${suffix}`
      const ownResponse = await admin.get(path)
      expect(ownResponse.status(), await ownResponse.text()).toBe(501)
      expect(ownResponse.headers()['cache-control']).toContain('no-store')
      const body = await ownResponse.json()
      expect(body.error).toMatch(/NOT_IMPLEMENTED$/)
      expect(body.data).toBeUndefined()

      const foreignResponse = await admin.get(`/api/organizations/${foreign}/${suffix}`)
      expect(foreignResponse.status()).toBe(403)
      const lowRole = await steward.get(path)
      expect(lowRole.status()).toBe(403)
      expect((await admin.patch(path, { data: { status: 'active' } })).status()).toBe(405)
      expect((await admin.delete(path)).status()).toBe(405)
    }
  } finally {
    await Promise.all([admin.dispose(), steward.dispose(), anonymous.dispose()])
  }
})
