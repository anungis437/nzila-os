/**
 * Runtime acceptance 01: the real Union Eyes application over HTTP, backed by native PostgreSQL.
 *
 * Nothing here is mocked: the Next.js server, the proxy, the API handlers, the authority kernel, the audit chain and the
 * databases are the real ones. Identities are the deterministic QA fixtures (apps/union-eyes/tests/fixtures), whose session
 * cookie is honoured only in a local QA environment (see packages/platform-auth/src/entra/server.ts).
 *
 * Each test records what the application actually does. Where a required capability is not yet reachable, the test asserts
 * the CURRENT behaviour and is named "KNOWN GAP" so the gap cannot pass as a feature.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ageQaCase, countGrievances, inspectCase, inspectFiling, resetQaCase } from '../../scripts/runtime/db-inspect'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { gotoDashboardAsRole } from '../helpers/auth'
import { REQUIRED_VISIBLE_LABELS, STAKEHOLDER_ORDER } from '../helpers/role-fixtures'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const PRIMARY = UE_TEST_ORGS.primary.id
// Playwright empties its output directory on every run, so the hand-off to the restart check lives in the git-ignored runtime state directory.
const STATE_DIR = process.env.UE_RUNTIME_STATE_DIR ?? join(process.cwd(), '..', '..', '.ue-runtime')
const SECONDARY = UE_TEST_ORGS.secondary.id

async function as(userId: string, orgId: string): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${userId}; selected_org_id=${orgId}` },
  })
}

const ids = (body: unknown): string[] => {
  const rows = ((body as { data?: unknown }).data ?? (body as { cases?: unknown }).cases ?? body) as unknown
  const list = Array.isArray(rows) ? rows : ((rows as { data?: unknown[] })?.data ?? [])
  return (list as Array<{ claimId?: string; id?: string }>).map((r) => r.claimId ?? r.id ?? '')
}

const apiOnly = (testInfo: { project: { name: string } }) => testInfo.project.name !== 'desktop'

test.describe.configure({ mode: 'serial' })

test.describe('foundation: health, authentication, entitlement', () => {
  test('the stack is healthy: database, auth and catalog authority admission', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const anon = await pwRequest.newContext({ baseURL: BASE })
    const response = await anon.get('/api/health')
    const body = await response.json()
    expect(body.ok, JSON.stringify(body.checks)).toBe(true)
    expect(body.checks.database.status).toBe('ok')
    expect(body.checks.auth.status).toBe('ok')
    expect(body.checks.catalogAuthority.status).toBe('ok')
  })

  test('an anonymous caller is refused by the API and sent to sign in by the app', async ({ page }, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const anon = await pwRequest.newContext({ baseURL: BASE })
    for (const path of ['/api/claims', '/api/cases']) expect((await anon.get(path)).status(), path).toBe(401)
    await page.goto('/en-CA/dashboard')
    await expect(page).toHaveURL(/sign-in|login|auth/i)
  })

  test('a suspended member is refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const ctx = await as(UE_TEST_USERS.suspendedMember.userId, PRIMARY)
    const status = (await ctx.get('/api/cases')).status()
    expect([401, 403], `suspended member got ${status}`).toContain(status)
  })

  test('an organization without the module is refused with 403, not a server fault', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const tester = UE_TEST_USERS.restrictedUxTester
    const ctx = await as(tester.userId, tester.orgId)
    const response = await ctx.post('/api/cases/intake', {
      data: { memberId: tester.userId, caseType: 'other', priority: 'low', title: 'No module here', description: 'Entitlement refusal check.', incidentDate: '2026-10-01', location: 'Anywhere' },
    })
    expect(response.status()).toBe(403)
    expect((await response.json()).error).toBe('ENTITLEMENT_REQUIRED')
  })
})

test.describe('journey A: member files, authority decides who can see it', () => {
  const title = `Runtime acceptance ${Date.now()}`
  let caseId = ''
  let claimNumber = ''

  test('the member files an intake through the real route and it persists with a sealed audit proof', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const member = await as(UE_TEST_USERS.memberPrimary.userId, PRIMARY)
    const response = await member.post('/api/cases/intake', {
      data: { memberId: UE_TEST_USERS.memberPrimary.userId, caseType: 'discipline', priority: 'medium', title, description: 'Filed by the runtime acceptance journey.', incidentDate: '2026-10-01', location: 'Plant 2' },
    })
    expect(response.status(), await response.text()).toBe(201)
    const body = await response.json()
    caseId = body.claimId
    claimNumber = body.claimNumber
    if (process.env.UE_RUNTIME_ARTIFACTS) {
      await mkdir(STATE_DIR, { recursive: true })
      await writeFile(join(STATE_DIR, 'journey-a-state.json'), JSON.stringify({ caseId, claimNumber, title }))
    }
    expect(body.status).toBe('submitted')
    expect(body.decision.proof, 'the intake decision carries a sealed proof').toBeTruthy()
  })

  test('the filing is in the database and in the platform audit chain (the sandbox store is honest about not being immutable)', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    test.skip(!process.env.DATABASE_URL || !process.env.PLATFORM_DATABASE_URL, 'needs DATABASE_URL and PLATFORM_DATABASE_URL to inspect persistence')
    const { claim, audit } = await inspectFiling(caseId, PRIMARY)
    expect(claim).toMatchObject({ status: 'submitted', member_id: UE_TEST_USERS.memberPrimary.userId, organization_id: PRIMARY })
    expect(audit.length).toBeGreaterThan(0)
    for (const record of audit) expect(record).toMatchObject({ storage_type: 'local_sandbox', immutable: false })
  })

  test('the member sees the case in the queue and can open it; a member of another organization cannot', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const member = await as(UE_TEST_USERS.memberPrimary.userId, PRIMARY)
    expect(ids(await (await member.get('/api/cases')).json())).toContain(caseId)
    expect((await member.get(`/api/cases/${caseId}`)).status()).toBe(200)

    const outsider = await as(UE_TEST_USERS.memberSecondary.userId, SECONDARY)
    expect(ids(await (await outsider.get('/api/cases')).json())).not.toContain(caseId)
    expect((await outsider.get(`/api/cases/${caseId}`)).status()).toBe(404)
  })

  test('a spoofed organization cookie does not widen what a member can read', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const spoof = await as(UE_TEST_USERS.memberPrimary.userId, SECONDARY)
    const response = await spoof.get('/api/cases')
    if (response.ok()) {
      const seen = ids(await response.json())
      expect(seen).not.toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1')
    } else {
      expect([401, 403, 404]).toContain(response.status())
    }
  })

  test('the steward holds only the cases the authority kernel assigned, not the new filing', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const steward = await as(UE_TEST_USERS.stewardPrimary.userId, PRIMARY)
    const seen = ids(await (await steward.get('/api/cases')).json())
    expect(seen).toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
    expect(seen).not.toContain(caseId)
    expect((await steward.get(`/api/cases/${caseId}`)).status()).toBe(404)
  })

  test('an organization administrator cannot assign the case: the title confers no case authority (default deny)', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const admin = await as(UE_TEST_USERS.adminPrimary.userId, PRIMARY)
    const response = await admin.post(`/api/cases/${caseId}/assign`, { data: { assigneeId: UE_TEST_USERS.stewardPrimary.userId, reason: 'runtime acceptance' } })
    expect([403, 404], await response.text()).toContain(response.status())
  })

  test('the case coordinator holding a unit-scoped supervisory mandate hands a case to the steward; the steward works it; the member never sees internal notes', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const seeded = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    if (process.env.DATABASE_URL) await resetQaCase(seeded)
    const coordinator = await as(UE_TEST_USERS.chiefStewardPrimary.userId, PRIMARY)
    const assigned = await coordinator.post(`/api/cases/${seeded}/assign`, { data: { assigneeId: UE_TEST_USERS.stewardPrimary.userId, reason: 'runtime acceptance' } })
    expect(assigned.status(), await assigned.text()).toBe(200)
    expect((await assigned.json()).assignedTo).toBe(UE_TEST_USERS.stewardPrimary.userId)

    const steward = await as(UE_TEST_USERS.stewardPrimary.userId, PRIMARY)
    expect(ids(await (await steward.get('/api/cases')).json())).toContain(seeded)
    const secret = `internal steward note ${Date.now()}`
    const note = await steward.post(`/api/cases/${seeded}/notes`, { data: { text: secret, isInternal: true } })
    expect(note.status(), await note.text()).toBeLessThan(300)

    const member = await as(UE_TEST_USERS.memberPrimary.userId, PRIMARY)
    const memberView = await member.get(`/api/cases/${seeded}/notes`)
    expect(memberView.status()).toBeLessThan(500)
    expect(await memberView.text()).not.toContain(secret)
    const stewardView = await steward.get(`/api/cases/${seeded}/notes`)
    expect(await stewardView.text()).toContain(secret)
  })

  test('reassignment revokes the first steward at once, the new steward gains access, and the state survives a fresh sign-in', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const seeded = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    const first = UE_TEST_USERS.stewardPrimary.userId
    const second = UE_TEST_USERS.stewardPrimaryTwo.userId
    const coordinator = await as(UE_TEST_USERS.chiefStewardPrimary.userId, PRIMARY)
    // Start from the seeded holder so the test is repeatable.
    expect((await coordinator.post(`/api/cases/${seeded}/assign`, { data: { assigneeId: first, reason: 'runtime acceptance baseline' } })).status()).toBe(200)
    // Self-assignment by the coordinator is refused by the kernel: a person cannot route a matter to themselves.
    const self = await coordinator.post(`/api/cases/${seeded}/assign`, { data: { assigneeId: UE_TEST_USERS.chiefStewardPrimary.userId, reason: 'runtime acceptance' } })
    expect([403, 404]).toContain(self.status())

    const moved = await coordinator.post(`/api/cases/${seeded}/assign`, { data: { assigneeId: second, reason: 'runtime acceptance reassignment' } })
    expect(moved.status(), await moved.text()).toBe(200)
    expect((await moved.json()).previousAssignee).toBe(first)

    try {
      expect((await (await as(first, PRIMARY)).get(`/api/cases/${seeded}`)).status(), 'revoked steward').toBe(404)
      expect((await (await as(first, PRIMARY)).get(`/api/cases/${seeded}/notes`)).status(), 'revoked steward notes').toBe(404)
      expect(ids(await (await (await as(first, PRIMARY)).get('/api/cases')).json())).not.toContain(seeded)
      // A brand-new request context is a fresh sign-in: nothing is held in the client, so this is the persisted state.
      const fresh = await as(second, PRIMARY)
      expect((await fresh.get(`/api/cases/${seeded}`)).status()).toBe(200)
      expect(ids(await (await fresh.get('/api/cases')).json())).toContain(seeded)
    } finally {
      const restored = await coordinator.post(`/api/cases/${seeded}/assign`, { data: { assigneeId: first, reason: 'runtime acceptance restore' } })
      expect(restored.status(), await restored.text()).toBe(200)
    }
    expect((await (await as(first, PRIMARY)).get(`/api/cases/${seeded}`)).status()).toBe(200)
    expect((await (await as(second, PRIMARY)).get(`/api/cases/${seeded}`)).status()).toBe(404)
  })

  test('the steward moves the case through its lifecycle, a refused escalation writes nothing, and a permitted escalation commits atomically', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    test.skip(!process.env.DATABASE_URL, 'needs DATABASE_URL to inspect persistence')
    test.setTimeout(240_000)
    const seeded = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    await resetQaCase(seeded)
    const before = await countGrievances(PRIMARY)

    const coordinator = await as(UE_TEST_USERS.chiefStewardPrimary.userId, PRIMARY)
    const steward = await as(UE_TEST_USERS.stewardPrimary.userId, PRIMARY)
    const member = await as(UE_TEST_USERS.memberPrimary.userId, PRIMARY)
    const move = (status: string) => steward.patch(`/api/cases/${seeded}/transition`, { data: { targetStatus: status, reason: 'runtime acceptance' } })

    expect((await coordinator.post(`/api/cases/${seeded}/assign`, { data: { assigneeId: UE_TEST_USERS.stewardPrimary.userId, reason: 'runtime acceptance' } })).status()).toBe(200)
    expect((await inspectCase(seeded)).assignedTo).toBe(UE_TEST_USERS.stewardPrimary.userId)

    // The workbench sends claim-status names; the route must accept them and still refuse an unknown status.
    expect((await move('not_a_status')).status()).toBe(403)
    const nextActions = await (await steward.get(`/api/cases/${seeded}/next-actions`)).json()
    expect(nextActions.allowedTransitions.length, JSON.stringify(nextActions)).toBeGreaterThan(0)

    // A business rule (minimum time in a status) refuses the escalation and the refusal leaves no grievance behind.
    const early = await steward.post(`/api/cases/${seeded}/escalate`, { data: { priority: 'high', notes: 'too early' } })
    expect(early.status(), await early.text()).toBe(422)
    expect(await countGrievances(PRIMARY)).toBe(before)

    // Walk the lifecycle with time-in-status simulated by backdating the status instant (a disclosed test technique).
    for (const status of ['under_review', 'investigation']) {
      await ageQaCase(seeded, 72)
      const moved = await move(status)
      expect(moved.status(), `${status}: ${await moved.text()}`).toBe(200)
      expect((await inspectCase(seeded)).status).toBe(status)
    }

    await ageQaCase(seeded, 72)
    const escalated = await steward.post(`/api/cases/${seeded}/escalate`, { data: { priority: 'high', notes: 'runtime acceptance escalation' } })
    expect(escalated.status(), await escalated.text()).toBeLessThan(300)
    const persisted = await inspectCase(seeded)
    expect(persisted).toMatchObject({ status: 'resolved', resolutionOutcome: 'escalated_to_grievance', grievances: 1, grievanceEvents: 1 })

    const timeline = await (await steward.get(`/api/cases/${seeded}/timeline`)).text()
    expect(timeline).toContain('under_review')
    expect((await member.get(`/api/cases/${seeded}/timeline`)).status()).toBeLessThan(500)
  })
})

test.describe('landing and navigation by stakeholder, at desktop, tablet and mobile', () => {
  for (const role of STAKEHOLDER_ORDER) {
    test(`${role}: reaches the correct landing, sees its navigation, and the page does not overflow`, async ({ page }, testInfo) => {
      const landing = await gotoDashboardAsRole(page, role)
      expect(page.url()).toContain(landing)
      // Below the desktop breakpoint the navigation lives behind a trigger; opening it is part of the journey.
      const visibleNavSelector = 'nav:visible, [role="navigation"]:visible'
      const nav = page.locator(visibleNavSelector).first()
      const trigger = page.getByRole('button', { name: /open navigation/i }).first()
      // Wait for the page to settle on one of the two layouts, then act: wide layouts show the navigation, narrow ones a trigger.
      // A breadcrumb is also a <nav>, so the primary navigation is judged by the drawer when a trigger exists.
      await expect(nav.or(trigger).first()).toBeVisible()
      if (await trigger.isVisible()) {
        await trigger.click()
        await expect(page.locator('#ue-mobile-drawer')).toBeVisible()
      } else {
        await expect(nav).toBeVisible()
      }
      // The organization selector and the page body must finish loading: a permanent "Loading…" is a defect, not a state.
      await expect(page.getByText(/^Loading(\.\.\.|…)$/).first(), `${role}: a loading placeholder never resolved`).toHaveCount(0, { timeout: 30_000 })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${role} on ${testInfo.project.name}: horizontal overflow`).toBeLessThanOrEqual(1)
      await page.screenshot({ path: testInfo.outputPath(`${role}-${testInfo.project.name}.png`), fullPage: false })
      // Navigation labels the information-architecture contract requires are present somewhere on the page.
      if (testInfo.project.name === 'desktop') {
        for (const label of REQUIRED_VISIBLE_LABELS[role].slice(0, 3)) {
          await expect(page.getByText(label, { exact: false }).first(), `${role}: "${label}"`).toBeVisible()
        }
      }
    })
  }
})
