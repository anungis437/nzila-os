/** Selected current SQL declarations and real source authority; provider I/O
 * ports are synthetic and never supply membership or authorization verdicts. */
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { qboConnections, qboSyncRuns, stripeConnections, taxProfiles } from '@nzila/db/schema'
import { createCfoSourceDatabase } from './fixtures/cfo-source-database'
const port = vi.hoisted(() => ({
  db: null as unknown,
  actor: 'creator',
  role: 'viewer',
  firmRole: 'firm_owner',
  upload: vi.fn(),
  sas: vi.fn(),
  ai: vi.fn(),
  ml: vi.fn(),
  crm: vi.fn(async () => ({ ok: true })),
  calendar: vi.fn(async () => ({ ok: true })),
  balance: vi.fn(async () => ({ available: [] })),
  account: vi.fn(async (id: string) => ({ id })),
  tax: vi.fn(async (year: number, scope: unknown) => ({ year, scope })),
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: async () => ({
    userId: port.actor,
    orgId: null,
    sessionClaims: { publicMetadata: { nzilaRole: port.role, firmRole: port.firmRole } },
  }),
  currentUser: async () => ({
    id: port.actor,
    primaryEmailAddress: { emailAddress: 'component@example.invalid' },
  }),
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: new Proxy(
    {},
    {
      get(_t, k) {
        if (!port.db) throw new Error('Owned source database required')
        const value = Reflect.get(port.db as object, k)
        return typeof value === 'function' ? value.bind(port.db) : value
      },
    },
  ),
}))
vi.mock('@nzila/blob', () => ({ uploadBuffer: port.upload, generateSasUrl: port.sas }))
vi.mock('@/lib/ai-client', () => ({ runAICompletionDetailed: port.ai }))
vi.mock('@/lib/ml-client', () => ({ runPredictionDetailed: port.ml }))
vi.mock('@/lib/crm', () => ({ checkCRMHealth: port.crm }))
vi.mock('@/lib/calendar', () => ({ checkCalendarHealth: port.calendar }))
vi.mock('@/lib/tax', () => ({ getUpcomingDeadlines: port.tax }))
vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: () => ({
    balance: { retrieve: port.balance },
    accounts: { retrieve: port.account },
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import {
  createTask,
  listTasks,
  updateTaskStatus,
  sendMessage,
  listMessages,
  uploadDocument,
  listDocuments,
  updateSettings,
  getSettings,
  acknowledgeAlert,
} from '../misc-actions'
import { askAdvisor, getAIInsights, getCashFlowForecast } from '../advisory-actions'
import {
  getIntegrationStatuses,
  connectIntegration,
  triggerSync,
  getTaxDeadlines,
} from '../integration-actions'
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222'
let fixture: Awaited<ReturnType<typeof createCfoSourceDatabase>>
const query = <T>(sql: string, params: unknown[] = []) => fixture.db.query<T>(sql, params),
  owner = (sql: string, params: unknown[] = []) => fixture.operator(sql, params)
const idFor = async (action: string) =>
  (
    await query<{ id: string }>(
      'SELECT id FROM audit_log WHERE action=$1 ORDER BY created_at DESC LIMIT 1',
      [action],
    )
  ).rows[0].id
beforeAll(async () => {
  fixture = await createCfoSourceDatabase([
    qboConnections,
    qboSyncRuns,
    stripeConnections,
    taxProfiles,
  ])
  port.db = fixture.database
})
afterAll(async () => {
  await fixture?.close()
  vi.unstubAllEnvs()
})
beforeEach(async () => {
  port.actor = 'creator'
  port.role = 'viewer'
  port.firmRole = 'firm_owner'
  for (const fn of [
    port.upload,
    port.sas,
    port.ai,
    port.ml,
    port.crm,
    port.calendar,
    port.balance,
    port.account,
    port.tax,
  ])
    fn.mockClear()
  port.upload.mockImplementation(async (opts: { blobPath: string; buffer: Buffer }) => ({
    blobPath: opts.blobPath,
    sizeBytes: opts.buffer.length,
    sha256: createHash('sha256').update(opts.buffer).digest('hex'),
  }))
  port.sas.mockImplementation(
    (container: string, path: string) =>
      `https://component.invalid/${container}/${path}?synthetic-only=1`,
  )
  port.ai.mockResolvedValue({
    content: '[]',
    execution: { modelUsed: 'synthetic-model', engineVersion: 'component:ai' },
  })
  port.ml.mockResolvedValue({
    data: { forecast: [{ month: '2026-01', projected: 5, confidence: 0.8 }], anomalies: [] },
    execution: { modelUsed: 'synthetic-ml', engineVersion: 'component:ml' },
  })
  vi.stubEnv('STRIPE_ACCOUNT_ID', 'acct_SyntheticOwned')
  vi.stubEnv('OUTLOOK_ACCESS_TOKEN', 'synthetic-not-a-provider-secret')
  vi.stubEnv('GOOGLE_CALENDAR_ACCESS_TOKEN', 'synthetic-not-a-provider-secret')
  await owner('DROP TRIGGER IF EXISTS cfo_workspace_failure ON audit_events')
  await owner('DROP FUNCTION IF EXISTS cfo_workspace_failure()')
  await owner(
    'TRUNCATE audit_events,audit_log,qbo_sync_runs,qbo_connections,stripe_connections,tax_profiles,org_members,orgs CASCADE',
  )
  await owner(
    "INSERT INTO orgs(id,legal_name,jurisdiction,policy_config) VALUES($1,'Own','CA-ON','{}'),($2,'Foreign','CA-QC','{}')",
    [a, b],
  )
  await owner(
    "INSERT INTO org_members(org_id,user_id,role,status) VALUES($1,'creator','org_admin','active'),($1,'recipient','org_viewer','active'),($1,'colleague','org_viewer','active'),($2,'foreign','org_admin','active')",
    [a, b],
  )
  fixture.statements.length = 0
})
async function upload(org: string = a) {
  const { POST } = await import('@/app/api/upload/route')
  const form = new FormData()
  form.set('file', new File(['Private document'], 'input.txt', { type: 'text/plain' }))
  form.set('name', 'Verified document')
  form.set('type', 'other')
  form.set('orgId', org)
  return POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: form }))
}
describe('CFO complete workspace/provider source boundary families', () => {
  it('preserves verified tenant tasks, exact member assignment, same-org update and foreign no-effects denial', async () => {
    expect(
      await createTask({ title: 'Own task', priority: 'high', assignedTo: 'recipient', orgId: a }),
    ).toEqual({ success: true })
    const id = await idFor('task.created')
    port.actor = 'colleague'
    expect((await listTasks()).tasks).toMatchObject([
      { id, assignedTo: 'recipient', orgId: a, status: 'pending' },
    ])
    expect(await updateTaskStatus(id, 'completed')).toEqual({ success: true })
    port.actor = 'foreign'
    fixture.statements.length = 0
    expect((await listTasks()).tasks).toEqual([])
    await expect(updateTaskStatus(id, 'cancelled')).rejects.toMatchObject({ status: 403 })
    expect(fixture.statements.some((s) => s.startsWith('insert ') || s.startsWith('update '))).toBe(
      false,
    )
    port.actor = 'creator'
    await expect(
      createTask({ title: 'Bad recipient', priority: 'low', assignedTo: 'foreign', orgId: a }),
    ).rejects.toMatchObject({ status: 403 })
    expect((await query("SELECT id FROM audit_log WHERE action='task.created'")).rows).toHaveLength(
      1,
    )
  })
  it('rejects metadata ownership substitutions and invalid task state before a write', async () => {
    await expect(
      createTask({ title: 'Unsafe', priority: 'high', orgId: a, actorId: 'foreign' } as Parameters<
        typeof createTask
      >[0]),
    ).rejects.toThrow()
    await createTask({ title: 'Own', priority: 'low', orgId: a })
    const id = await idFor('task.created')
    await expect(updateTaskStatus(id, 'arbitrary' as 'pending')).rejects.toThrow()
    expect((await listTasks()).tasks).toMatchObject([{ status: 'pending' }])
  })
  it('keeps private messages between actual sender and same-org canonical recipient, including against platform role', async () => {
    expect(
      await sendMessage({
        to: 'recipient',
        subject: 'Private',
        body: 'Actual private body',
        orgId: a,
      }),
    ).toEqual({ success: true })
    expect(await listMessages()).toMatchObject([{ from: 'creator', subject: 'Private' }])
    port.actor = 'recipient'
    expect(await listMessages()).toMatchObject([
      { from: 'creator', subject: 'Private', read: false },
    ])
    for (const actor of ['colleague', 'foreign']) {
      port.actor = actor
      port.role = 'platform_admin'
      expect(await listMessages()).toEqual([])
    }
    port.actor = 'creator'
    port.role = 'viewer'
    await expect(
      sendMessage({ to: 'foreign', subject: 'Foreign', body: 'Denied', orgId: a }),
    ).rejects.toMatchObject({ status: 403 })
    expect((await query("SELECT id FROM audit_log WHERE action='message.sent'")).rows).toHaveLength(
      1,
    )
  })
  it('persists merged verified-org settings, drops no prior fields and rejects caller ownership or foreign selection', async () => {
    expect(await updateSettings({ currency: 'USD' }, a)).toEqual({ success: true })
    expect(await updateSettings({ fiscalYearStart: 4 }, a)).toEqual({ success: true })
    port.actor = 'colleague'
    expect(await getSettings(a)).toMatchObject({ currency: 'USD', fiscalYearStart: 4 })
    await expect(
      updateSettings(
        { currency: 'CAD', organizationId: b } as Parameters<typeof updateSettings>[0],
        a,
      ),
    ).rejects.toThrow()
    await expect(getSettings(b)).rejects.toMatchObject({ status: 403 })
    expect(
      (await query("SELECT org_id FROM audit_log WHERE action='settings.updated'")).rows,
    ).toEqual([{ org_id: a }, { org_id: a }])
  })
  it('requires live document upload privilege/org before blob effects and binds actual provider bytes to the stored root', async () => {
    const denied = await upload(b)
    expect(denied.status).toBe(403)
    expect(port.upload).not.toHaveBeenCalled()
    expect(port.sas).not.toHaveBeenCalled()
    const response = await upload()
    expect(response.status).toBe(200)
    const receipt = await response.json()
    expect(receipt.uploadId).toEqual(expect.any(String))
    expect(port.upload).toHaveBeenCalledWith(
      expect.objectContaining({ blobPath: expect.stringMatching(new RegExp(`^${a}/creator/`)) }),
    )
    const docs = await listDocuments()
    expect(docs.documents).toMatchObject([
      {
        id: receipt.uploadId,
        name: 'Verified document',
        orgId: a,
        size: 16,
        uploadedBy: 'creator',
      },
    ])
    expect((await query('SELECT target_id FROM audit_events')).rows).toEqual([
      { target_id: receipt.uploadId },
    ])
    expect(
      await uploadDocument({
        uploadId: receipt.uploadId,
        name: 'New label',
        type: 'contract',
        size: 16,
        url: receipt.url,
      }),
    ).toEqual({ success: true })
    expect((await listDocuments()).documents[0]).toMatchObject({
      name: 'New label',
      type: 'contract',
    })
  })
  it('cannot mint a document from an arbitrary URL, annotate another actor upload or replace its stored blob facts', async () => {
    await expect(
      uploadDocument({ name: 'Forged', type: 'other', url: 'https://foreign.invalid/private' }),
    ).rejects.toThrow()
    const response = await upload(),
      receipt = await response.json()
    await expect(
      uploadDocument({
        uploadId: receipt.uploadId,
        name: 'Swap',
        type: 'other',
        url: 'https://foreign.invalid',
      }),
    ).rejects.toMatchObject({ status: 403 })
    port.actor = 'colleague'
    await expect(
      uploadDocument({ uploadId: receipt.uploadId, name: 'Other actor', type: 'other' }),
    ).rejects.toMatchObject({ status: 403 })
    expect((await listDocuments()).documents[0]).toMatchObject({ name: 'Verified document' })
    port.actor = 'foreign'
    expect((await listDocuments()).documents).toEqual([])
  })
  it('does not return an uploaded-resource receipt/SAS when mandatory source audit fails', async () => {
    await owner(
      "CREATE FUNCTION cfo_workspace_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic audit outage'; END$$",
    )
    await owner(
      'CREATE TRIGGER cfo_workspace_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION cfo_workspace_failure()',
    )
    const response = await upload()
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('synthetic-only')
    expect((await query('SELECT id FROM audit_log')).rows).toEqual([])
    expect((await query('SELECT id FROM audit_events')).rows).toEqual([])
    // Blob I/O precedes the SQL transaction commit. This is local state/audit
    // rollback proof, not cross-provider atomicity or orphan cleanup proof.
    expect(port.upload).toHaveBeenCalledTimes(1)
  })
  it('does not treat a foreign alert UUID as a tenant grant and preserves original actor personal operation', async () => {
    const row = (
      await owner(
        'INSERT INTO audit_log(action,actor_id,entity_type,org_id,metadata) VALUES(\'alert.raised\',\'creator\',\'alert\',$1,\'{"title":"Own","severity":"warning"}\') RETURNING id',
        [b],
      )
    ).rows[0] as { id: string }
    port.actor = 'foreign'
    await expect(acknowledgeAlert(row.id)).rejects.toMatchObject({ status: 403 })
    port.actor = 'creator'
    expect(await acknowledgeAlert(row.id)).toEqual({ success: true })
    expect(
      (await query("SELECT org_id,metadata FROM audit_log WHERE action='alert.acknowledged'")).rows,
    ).toMatchObject([{ org_id: null, metadata: { recordId: row.id } }])
  })
  it('denies spoofed AI/ML org hints before any model effect and sends only the resolved org on positives', async () => {
    await expect(askAdvisor('Question', { orgId: b })).rejects.toMatchObject({ status: 403 })
    await expect(getAIInsights(b)).rejects.toMatchObject({ status: 403 })
    await expect(getCashFlowForecast(6, b)).rejects.toMatchObject({ status: 403 })
    expect(port.ai).not.toHaveBeenCalled()
    expect(port.ml).not.toHaveBeenCalled()
    expect(await askAdvisor('Question', { orgId: a })).toMatchObject({
      org_id: a,
      confidence_score: 0.7,
      evidence_refs: [expect.stringMatching(/^audit_events:/)],
    })
    await getAIInsights(a)
    await getCashFlowForecast(6, a)
    expect(port.ai.mock.calls.every(([, scope]) => scope.orgId === a)).toBe(true)
    expect(port.ml.mock.calls.every(([scope]) => scope.orgId === a)).toBe(true)
  })
  it('uses exact stored organization profiles/connections without selecting arbitrary first membership or another tenant', async () => {
    await owner(
      "INSERT INTO qbo_connections(org_id,realm_id,company_name,connected_by) VALUES($1,'own-realm','Own connection','creator'),($2,'foreign-realm','FOREIGN_PRIVATE','foreign')",
      [a, b],
    )
    await owner(
      "INSERT INTO tax_profiles(org_id,fiscal_year_end,province_of_registration) VALUES($1,'06-30','ON'),($2,'12-31','QC')",
      [a, b],
    )
    const statuses = await getIntegrationStatuses(a)
    expect(statuses.find((s) => s.provider === 'quickbooks')).toMatchObject({ connected: true })
    expect(JSON.stringify(statuses)).not.toContain('FOREIGN_PRIVATE')
    expect(port.crm).not.toHaveBeenCalled()
    expect(port.calendar).not.toHaveBeenCalled()
    await getTaxDeadlines(a)
    expect(port.tax).toHaveBeenLastCalledWith(expect.any(Number), {
      fiscalYearEnd: '06-30',
      province: 'ON',
    })
    await expect(getTaxDeadlines(b)).rejects.toMatchObject({ status: 403 })
    await owner(
      "INSERT INTO org_members(org_id,user_id,role,status) VALUES($1,'creator','org_viewer','active')",
      [b],
    )
    await expect(getIntegrationStatuses()).rejects.toThrow('Select a verified organization')
  })
  it('never lets ordinary membership invoke a configured global client or attach its Stripe account', async () => {
    for (const key of ['stripe', 'hubspot', 'outlook-calendar', 'google-calendar'] as const) {
      await expect(triggerSync(key)).rejects.toMatchObject({ status: 403 })
      await expect(connectIntegration(key, a)).rejects.toMatchObject({ status: 403 })
    }
    for (const fn of [port.balance, port.account, port.crm, port.calendar])
      expect(fn).not.toHaveBeenCalled()
    expect((await query('SELECT id FROM stripe_connections')).rows).toEqual([])
  })
  it('preserves actual platform connectivity and explicit verified-account binding/audit without claiming sync', async () => {
    port.role = 'platform_admin'
    expect(await triggerSync('stripe')).toMatchObject({
      success: true,
      message: expect.stringContaining('no synchronization'),
    })
    expect(port.balance).toHaveBeenCalledTimes(1)
    expect(await connectIntegration('stripe', a)).toEqual({
      success: true,
      message: 'Organization Stripe account verified',
    })
    expect(port.account).toHaveBeenCalledWith('acct_SyntheticOwned')
    expect(
      (await query('SELECT org_id,account_id,connected_by FROM stripe_connections')).rows,
    ).toEqual([{ org_id: a, account_id: 'acct_SyntheticOwned', connected_by: 'creator' }])
    expect(
      (
        await query(
          "SELECT org_id,actor_user_id FROM audit_events WHERE action='cfo.integration.connection_verified'",
        )
      ).rows,
    ).toEqual([{ org_id: a, actor_user_id: 'creator' }])
    expect(
      (
        await query(
          "SELECT org_id,metadata FROM audit_log WHERE action='integration.connectivity_checked'",
        )
      ).rows,
    ).toMatchObject([
      { org_id: null, metadata: { provider: 'stripe', operation: 'connectivity-check' } },
    ])
  })
  it('does not fabricate acct_configured or a successful QBO initiation, and maps HTTP501/403 truthfully', async () => {
    port.role = 'platform_admin'
    vi.stubEnv('STRIPE_ACCOUNT_ID', '')
    expect(await connectIntegration('stripe', a)).toMatchObject({ success: false })
    expect(port.account).not.toHaveBeenCalled()
    await expect(connectIntegration('quickbooks', a)).rejects.toMatchObject({
      status: 501,
      code: 'QBO_OAUTH_SOURCE_UNAVAILABLE',
    })
    const { POST } = await import('@/app/api/ledger/route')
    const unavailable = await POST(new Request('http://localhost/api/ledger', { method: 'POST' }))
    expect(unavailable.status).toBe(501)
    port.role = 'viewer'
    const integration = await import('@/app/api/integrations/route')
    const denied = await integration.POST(
      new Request('http://localhost/api/integrations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'stripe' }),
      }),
    )
    expect(denied.status).toBe(403)
  })
  it('rolls a verified Stripe connection back if its actual mandatory primary audit is unavailable', async () => {
    port.role = 'platform_admin'
    await owner(
      "CREATE FUNCTION cfo_workspace_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic primary outage'; END$$",
    )
    await owner(
      'CREATE TRIGGER cfo_workspace_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION cfo_workspace_failure()',
    )
    await expect(connectIntegration('stripe', a)).rejects.toThrow()
    expect((await query('SELECT id FROM stripe_connections')).rows).toEqual([])
    expect((await query('SELECT id FROM audit_events')).rows).toEqual([])
  })
})
