/**
 * Runtime acceptance 02: persistence across an application restart.
 *
 * Run AFTER 01 (which records the filed case) and after the application process was stopped and started again
 * (`node tooling/scripts/ue-runtime-up.mjs restart-check` does exactly that). Nothing is remembered by the client: each
 * request is a fresh sign-in, so what answers is what the database kept.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { inspectFiling } from '../../scripts/runtime/db-inspect'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const PRIMARY = UE_TEST_ORGS.primary.id
const SECONDARY = UE_TEST_ORGS.secondary.id
const STATE_DIR = process.env.UE_RUNTIME_STATE_DIR ?? join(process.cwd(), '..', '..', '.ue-runtime')

async function as(userId: string, orgId: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${userId}; selected_org_id=${orgId}` } })
}

test.describe('persistence after a restart', () => {
  test('the filing, its audit proof and its authority boundaries survive a restart', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'API journey: runs once, at desktop')
    const dir = STATE_DIR
    test.skip(!process.env.DATABASE_URL || !process.env.PLATFORM_DATABASE_URL, 'needs database access')
    const { caseId, claimNumber } = JSON.parse(await readFile(join(dir, 'journey-a-state.json'), 'utf8')) as { caseId: string; claimNumber: string }

    const health = await (await pwRequest.newContext({ baseURL: BASE })).get('/api/health')
    expect((await health.json()).ok).toBe(true)

    const member = await as(UE_TEST_USERS.memberPrimary.userId, PRIMARY)
    const opened = await member.get(`/api/cases/${caseId}`)
    expect(opened.status()).toBe(200)
    expect(JSON.stringify(await opened.json())).toContain(claimNumber)

    const { claim, audit } = await inspectFiling(caseId, PRIMARY)
    expect(claim).toMatchObject({ status: 'submitted', organization_id: PRIMARY })
    expect(audit.length).toBeGreaterThan(0)

    const outsider = await as(UE_TEST_USERS.memberSecondary.userId, SECONDARY)
    expect((await outsider.get(`/api/cases/${caseId}`)).status()).toBe(404)
    expect((await (await as(UE_TEST_USERS.stewardPrimary.userId, PRIMARY)).get(`/api/cases/${caseId}`)).status()).toBe(404)
  })

  test('assignments made through triage, and a revoked then restored coordinator, survive a restart', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'API journey: runs once, at desktop')
    const state = JSON.parse(await readFile(join(STATE_DIR, 'triage-journey-state.json'), 'utf8')) as { caseId: string; representative: string; second: string }
    const representative = await as(state.representative, PRIMARY)
    expect((await representative.get(`/api/cases/${state.caseId}`)).status(), 'representative still holds the case').toBe(200)
    expect((await (await as(UE_TEST_USERS.stewardPrimary.userId, PRIMARY)).get(`/api/cases/${state.caseId}`)).status(), 'revoked steward stays revoked').toBe(404)
    expect((await (await as(UE_TEST_USERS.stewardPrimary.userId, PRIMARY)).get(`/api/cases/${state.second}`)).status(), 'second case, assigned after restoration').toBe(200)
    expect((await (await as(UE_TEST_USERS.chiefStewardPrimary.userId, PRIMARY)).get(`/api/cases/${state.caseId}`)).status(), 'the coordinator still has no read').toBe(404)
    expect((await (await as(UE_TEST_USERS.memberSecondary.userId, SECONDARY)).get(`/api/cases/${state.caseId}`)).status()).toBe(404)
  })
})
