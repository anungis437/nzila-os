/**
 * Runtime acceptance 03: a FRESHLY FILED case goes from intake to assignment to representation to oversight (finding R-13).
 *
 * Nothing is preassigned. The jurisdiction of the case is the organization that owns it, written by the server from the
 * authenticated membership at intake. The coordinator's authority is two explicit, independent, revocable grants:
 *   - a `cases` triage designation (granted by the organization administrator): lets them SEE the unassigned queue, as metadata;
 *   - a supervisory mandate with the `assign` power, scoped to the unit: lets them ROUTE a case. It carries no read power.
 * A title (administrator, chief steward, president) confers neither.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { ageQaCase, assignmentAudit, inspectCase } from '../../scripts/runtime/db-inspect'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const PRIMARY = UE_TEST_ORGS.primary.id
const SECONDARY = UE_TEST_ORGS.secondary.id
const STATE_DIR = process.env.UE_RUNTIME_STATE_DIR ?? join(process.cwd(), '..', '..', '.ue-runtime')
const U = UE_TEST_USERS

async function as(userId: string, orgId: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${userId}; selected_org_id=${orgId}` } })
}

const ids = (body: unknown): string[] => {
  const rows = ((body as { data?: unknown }).data ?? body) as unknown
  const list = Array.isArray(rows) ? rows : ((rows as { data?: unknown[] })?.data ?? [])
  return (list as Array<{ claimId?: string; id?: string }>).map((r) => r.claimId ?? r.id ?? '')
}
const queue = async (user: string): Promise<Array<Record<string, unknown>>> => {
  const body = await (await (await as(user, PRIMARY)).get('/api/cases')).json()
  const rows = ((body as { data?: unknown }).data ?? body) as unknown
  return (Array.isArray(rows) ? rows : ((rows as { data?: unknown[] })?.data ?? [])) as Array<Record<string, unknown>>
}
const adminScript = (...args: string[]) =>
  execFileSync('npx', ['tsx', 'scripts/runtime/authority-admin.ts', ...args], { cwd: process.cwd(), env: { ...process.env, QA_TEST_ENV: 'true' }, shell: process.platform === 'win32', stdio: 'pipe' })

const apiOnly = (testInfo: { project: { name: string } }) => testInfo.project.name !== 'desktop'
const file = async (title: string) => {
  const member = await as(U.memberPrimary.userId, PRIMARY)
  const response = await member.post('/api/cases/intake', {
    data: { memberId: U.memberPrimary.userId, caseType: 'discipline', priority: 'medium', title, description: `Private description for ${title}`, incidentDate: '2026-10-01', location: 'Plant 2' },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).claimId as string
}
const assign = async (user: string, caseId: string, assigneeId: string) =>
  (await as(user, PRIMARY)).post(`/api/cases/${caseId}/assign`, { data: { assigneeId, reason: 'runtime acceptance' } })

test.describe.configure({ mode: 'serial' })

test.describe('R-13: intake to assignment to representation to oversight, on a newly filed case', () => {
  const title = `Triage journey ${Date.now()}`
  let caseId = ''
  let designationId = ''

  test.beforeAll(async () => {
    // Repeatable: no designation or mandate left over from a previous run.
    const admin = await as(U.adminPrimary.userId, PRIMARY)
    const listed = await (await admin.get('/api/triage-designations')).json()
    const rows = (listed as { data?: { designations?: Array<{ id: string; userId: string; scope: string; revokedAt: string | null }> } }).data?.designations ?? []
    for (const row of rows) {
      if (row.userId === U.chiefStewardPrimary.userId && row.scope === 'cases' && !row.revokedAt) await admin.delete('/api/triage-designations', { data: { designationId: row.id } })
    }
    adminScript('restore-fixtures')
  })

  test('the member files a new case; nobody but the member sees it yet', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    caseId = await file(title)
    expect(ids(await (await (await as(U.memberPrimary.userId, PRIMARY)).get('/api/cases')).json())).toContain(caseId)
    for (const user of [U.stewardPrimary.userId, U.chiefStewardPrimary.userId, U.adminPrimary.userId, U.executivePrimary.userId]) {
      expect(ids({ data: await queue(user) }), `${user} before any grant`).not.toContain(caseId)
    }
    expect((await inspectCase(caseId)).assignedTo).toBeNull()
  })

  test('the administrator designates the coordinator to the cases queue: metadata only, never a read', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const admin = await as(U.adminPrimary.userId, PRIMARY)
    const granted = await admin.post('/api/triage-designations', {
      data: { scope: 'cases', userId: U.chiefStewardPrimary.userId, expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() },
    })
    expect(granted.status(), await granted.text()).toBeLessThan(300)
    const body = await granted.json()
    designationId = (body.data.designation ?? body.data).id
    expect(designationId).toBeTruthy()

    const row = (await queue(U.chiefStewardPrimary.userId)).find((r) => r.claimId === caseId)
    expect(row, 'the coordinator sees the triage record').toBeTruthy()
    expect(row).toMatchObject({ triageOnly: true })
    expect(JSON.stringify(row)).not.toContain('Private description')
    expect(Object.keys(row as object).sort()).toEqual(['claimId', 'claimNumber', 'claimType', 'createdAt', 'filedDate', 'priority', 'status', 'triageOnly'].sort())
    expect((await (await as(U.chiefStewardPrimary.userId, PRIMARY)).get(`/api/cases/${caseId}`)).status(), 'a designation is not a read').toBe(404)
    // The steward holds no designation and still cannot see it.
    expect(ids({ data: await queue(U.stewardPrimary.userId) })).not.toContain(caseId)
  })

  test('unauthorized routing is refused: administrator, unmandated steward, read-only supervisor, another tenant', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const target = U.stewardPrimary.userId
    for (const [who, org] of [
      [U.adminPrimary.userId, PRIMARY],
      [U.stewardPrimaryTwo.userId, PRIMARY],
      [U.supervisorPrimary.userId, PRIMARY],
      [U.executivePrimary.userId, PRIMARY],
      [U.wrongOrgSteward.userId, SECONDARY],
    ] as const) {
      const response = await (await as(who, org)).post(`/api/cases/${caseId}/assign`, { data: { assigneeId: target, reason: 'must be refused' } })
      expect([403, 404], `${who}: ${response.status()} ${await response.text()}`).toContain(response.status())
    }
    expect((await inspectCase(caseId)).assignedTo, 'nothing was assigned').toBeNull()
  })

  test('the mandated coordinator assigns the case; the steward gets it; the audit names the mandate', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const response = await assign(U.chiefStewardPrimary.userId, caseId, U.stewardPrimary.userId)
    expect(response.status(), await response.text()).toBe(200)
    expect((await inspectCase(caseId)).assignedTo).toBe(U.stewardPrimary.userId)

    expect(ids({ data: await queue(U.stewardPrimary.userId) })).toContain(caseId)
    expect((await (await as(U.stewardPrimary.userId, PRIMARY)).get(`/api/cases/${caseId}`)).status()).toBe(200)
    // Once owned, the case leaves the triage queue, and the coordinator still cannot read it.
    expect(ids({ data: await queue(U.chiefStewardPrimary.userId) })).not.toContain(caseId)
    expect((await (await as(U.chiefStewardPrimary.userId, PRIMARY)).get(`/api/cases/${caseId}`)).status()).toBe(404)

    const [latest] = await assignmentAudit(caseId)
    expect(latest.user_id).toBe(U.chiefStewardPrimary.userId)
    const authority = (latest.metadata as { authority?: Array<{ kind: string; id: string; instrument: string }> }).authority ?? []
    expect(authority.map((a) => a.kind), JSON.stringify(latest.metadata)).toContain('mandate')
    expect(authority.find((a) => a.kind === 'mandate')?.instrument).toContain('SYNTHETIC QA FIXTURE')
  })

  test('the steward works the case and escalates it', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    test.setTimeout(240_000)
    const steward = await as(U.stewardPrimary.userId, PRIMARY)
    const note = await steward.post(`/api/cases/${caseId}/notes`, { data: { text: `internal steward note ${title}`, isInternal: true } })
    expect(note.status(), await note.text()).toBeLessThan(300)
    for (const status of ['under_review', 'investigation']) {
      await ageQaCase(caseId, 72)
      const moved = await steward.patch(`/api/cases/${caseId}/transition`, { data: { targetStatus: status, reason: 'runtime acceptance' } })
      expect(moved.status(), `${status}: ${await moved.text()}`).toBe(200)
    }
    await ageQaCase(caseId, 72)
    const escalated = await steward.post(`/api/cases/${caseId}/escalate`, { data: { priority: 'high', notes: 'runtime acceptance escalation' } })
    expect(escalated.status(), await escalated.text()).toBeLessThan(300)
    expect(await inspectCase(caseId)).toMatchObject({ resolutionOutcome: 'escalated_to_grievance', grievances: 1, grievanceEvents: 1 })
  })

  test('the coordinator hands the case to a representative; the first steward loses it', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const response = await assign(U.chiefStewardPrimary.userId, caseId, U.stewardPrimaryTwo.userId)
    expect(response.status(), await response.text()).toBe(200)
    expect((await response.json()).previousAssignee).toBe(U.stewardPrimary.userId)
    expect((await (await as(U.stewardPrimary.userId, PRIMARY)).get(`/api/cases/${caseId}`)).status(), 'first steward revoked').toBe(404)
    const representative = await as(U.stewardPrimaryTwo.userId, PRIMARY)
    expect((await representative.get(`/api/cases/${caseId}`)).status()).toBe(200)
    const notes = await (await representative.get(`/api/cases/${caseId}/notes`)).text()
    expect(notes, 'the representative inherits the case file, including internal notes').toContain('internal steward note')
  })

  test('the supervisor oversees without routing or reading internal notes; the officer gets aggregate reporting only', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const supervisor = await as(U.supervisorPrimary.userId, PRIMARY)
    expect((await supervisor.get(`/api/cases/${caseId}`)).status(), 'read power within the unit').toBe(200)
    const notes = await supervisor.get(`/api/cases/${caseId}/notes`)
    expect(await notes.text(), 'the supervisor mandate has no read_internal power').not.toContain('internal steward note')
    const refused = await assign(U.supervisorPrimary.userId, caseId, U.stewardPrimary.userId)
    expect([403, 404]).toContain(refused.status())

    const officer = await as(U.executivePrimary.userId, PRIMARY)
    expect((await officer.get(`/api/cases/${caseId}`)).status(), 'an office title is not a case read').toBe(404)
    const report = await officer.get('/api/dashboard/leadership')
    expect(report.status()).toBe(200)
    expect(await report.text()).not.toContain('Private description')
    for (const lower of [U.memberPrimary.userId, U.stewardPrimary.userId]) {
      expect((await (await as(lower, PRIMARY)).get('/api/dashboard/leadership')).status(), `${lower} must not receive leadership reporting`).toBe(403)
    }
    expect((await (await as(U.memberSecondary.userId, SECONDARY)).get(`/api/cases/${caseId}`)).status(), 'another tenant').toBe(404)
  })

  test('revoking the coordinator mandate, then the designation, removes routing and sight; restoring the mandate restores routing', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const second = await file(`${title} second`)
    expect(ids({ data: await queue(U.chiefStewardPrimary.userId) })).toContain(second)

    adminScript('revoke-mandate', U.chiefStewardPrimary.userId)
    const refused = await assign(U.chiefStewardPrimary.userId, second, U.stewardPrimary.userId)
    expect([403, 404], 'revoked mandate').toContain(refused.status())
    expect((await inspectCase(second)).assignedTo).toBeNull()
    // The designation is independent: sight remains until it, too, is revoked.
    expect(ids({ data: await queue(U.chiefStewardPrimary.userId) })).toContain(second)

    const admin = await as(U.adminPrimary.userId, PRIMARY)
    expect((await admin.delete('/api/triage-designations', { data: { designationId } })).status()).toBeLessThan(300)
    expect(ids({ data: await queue(U.chiefStewardPrimary.userId) })).not.toContain(second)

    adminScript('restore-fixtures')
    const regranted = await admin.post('/api/triage-designations', {
      data: { scope: 'cases', userId: U.chiefStewardPrimary.userId, expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() },
    })
    expect(regranted.status()).toBeLessThan(300)
    const restored = await assign(U.chiefStewardPrimary.userId, second, U.stewardPrimary.userId)
    expect(restored.status(), await restored.text()).toBe(200)

    await mkdir(STATE_DIR, { recursive: true })
    await writeFile(join(STATE_DIR, 'triage-journey-state.json'), JSON.stringify({ caseId, representative: U.stewardPrimaryTwo.userId, second }))
  })
})
