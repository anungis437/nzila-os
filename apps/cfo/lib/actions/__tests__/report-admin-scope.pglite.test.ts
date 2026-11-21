/** Actual selected source SQL + real action/RBAC/context and mandatory audit.
 * Only verified identity, database and model network I/O are supplied ports. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createCfoSourceDatabase } from './fixtures/cfo-source-database'
const port = vi.hoisted(() => ({
  db: null as unknown,
  actor: 'creator',
  role: 'viewer',
  firmRole: 'firm_owner',
  model: vi.fn(async (_prompt: string, _scope: unknown) => ({
    content: 'Scoped narrative',
    execution: { modelUsed: 'synthetic-model', engineVersion: 'component:model' },
  })),
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
        if (!port.db) throw new Error('Owned SQL fixture required')
        const value = Reflect.get(port.db as object, k)
        return typeof value === 'function' ? value.bind(port.db) : value
      },
    },
  ),
}))
vi.mock('@/lib/ai-client', () => ({ runAICompletionDetailed: port.model }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import {
  generateReport,
  listReports,
  getReportNarrative,
  getReportExportUrl,
} from '../report-actions'
import {
  getPlatformMetrics,
  listFirms,
  suspendFirm,
  reactivateFirm,
  updateFirmSubscription,
} from '../platform-admin-actions'
import {
  listSecurityEvents,
  listIncidents,
  resolveSecurityEvent,
  updateIncidentStatus,
  runSecurityScan,
  getSecurityPosture,
} from '../security-actions'
import { listAuditEntries, getAuditStats } from '../audit-actions'
import { getLedgerEntries, runReconciliation } from '../ledger-actions'
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222'
let fixture: Awaited<ReturnType<typeof createCfoSourceDatabase>>
const query = <T>(sql: string, params: unknown[] = []) => fixture.db.query<T>(sql, params)
const owner = (sql: string, params: unknown[] = []) => fixture.operator(sql, params)
const input = { type: 'pnl' as const, period: '2026-01', orgId: a, includeNarrative: true }
async function report() {
  const result = await generateReport(input)
  expect(result).toMatchObject({ success: true, org_id: a, reportId: expect.any(String) })
  return result.reportId!
}
async function record(action: string, actor: string, metadata: Record<string, unknown>) {
  return (
    await owner(
      "INSERT INTO audit_log(action,actor_id,entity_type,org_id,metadata) VALUES($1,$2,CASE WHEN $1 LIKE 'report.%' THEN 'report' ELSE 'synthetic source' END,$3,$4::jsonb) RETURNING id",
      [action, actor, b, JSON.stringify(metadata)],
    )
  ).rows[0] as { id: string }
}
beforeAll(async () => {
  fixture = await createCfoSourceDatabase()
  port.db = fixture.database
})
afterAll(async () => {
  await fixture?.close()
})
beforeEach(async () => {
  port.actor = 'creator'
  port.role = 'viewer'
  port.firmRole = 'firm_owner'
  port.model.mockClear()
  await owner('DROP TRIGGER IF EXISTS cfo_source_failure ON public.audit_events')
  await owner('DROP TRIGGER IF EXISTS cfo_source_failure ON public.audit_log')
  await owner('DROP FUNCTION IF EXISTS public.cfo_source_failure()')
  await owner(
    'TRUNCATE public.audit_events,public.audit_log,public.org_members,public.orgs CASCADE',
  )
  await owner(
    "INSERT INTO orgs(id,legal_name,jurisdiction,policy_config) VALUES($1,'Own','CA-ON','{}'),($2,'Foreign','CA-QC','{}')",
    [a, b],
  )
  await owner(
    "INSERT INTO org_members(org_id,user_id,role,status) VALUES($1,'creator','org_admin','active'),($1,'colleague','org_viewer','active'),($2,'foreign','org_admin','active')",
    [a, b],
  )
  fixture.statements.length = 0
})
describe('CFO reports, legacy audit and actual global administration boundaries', () => {
  it('binds provider org, actual stored root, primary audit and safe report read/export to verified organization', async () => {
    const id = await report()
    expect(port.model).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ orgId: a }),
    )
    expect(await getReportNarrative(id)).toBe('Scoped narrative')
    expect((await listReports()).reports).toMatchObject([
      { id, generatedBy: 'creator', narrativeSummary: 'Scoped narrative' },
    ])
    const root = (
      await query<{ org_id: string; metadata: unknown }>(
        'SELECT org_id,metadata FROM audit_log WHERE id=$1',
        [id],
      )
    ).rows[0]
    expect(root).toMatchObject({ org_id: a, metadata: { _cfoOrigin: 'cfo.record-origin.v1' } })
    expect(await getReportExportUrl({ reportId: id, format: 'csv' })).toBe(
      `/api/reports/export?format=csv&reportId=${id}`,
    )
    port.actor = 'colleague'
    expect(await getReportNarrative(id)).toBe('Scoped narrative')
    const { GET } = await import('@/app/api/reports/export/route')
    const response = await GET(
      new NextRequest(`http://localhost/api/reports/export?reportId=${id}&format=csv`),
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Scoped narrative')
  })
  it('denies foreign actor/org/report substitution before model calls, write or disclosure', async () => {
    const id = await report()
    port.actor = 'foreign'
    port.model.mockClear()
    fixture.statements.length = 0
    await expect(generateReport(input)).rejects.toMatchObject({ status: 403 })
    await expect(getReportNarrative(id)).rejects.toMatchObject({ status: 403 })
    expect((await listReports()).reports).toEqual([])
    await expect(getReportExportUrl({ reportId: id, format: 'pdf' })).rejects.toMatchObject({
      status: 403,
    })
    const { GET } = await import('@/app/api/reports/export/route')
    const response = await GET(
      new NextRequest(`http://localhost/api/reports/export?reportId=${id}`),
    )
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('Scoped narrative')
    expect(port.model).not.toHaveBeenCalled()
    expect(fixture.statements.some((s) => s.startsWith('insert '))).toBe(false)
  })
  it('keeps old reports personal instead of adopting a random org_id and refuses forged source markers', async () => {
    const first = await record('report.generated', 'creator', {
      title: 'Historical own',
      type: 'pnl',
      period: '2025',
      status: 'draft',
      narrative: 'Own historical narrative',
    })
    expect(await getReportNarrative(first.id)).toBe('Own historical narrative')
    port.actor = 'foreign'
    expect((await listReports()).reports).toEqual([])
    await expect(getReportNarrative(first.id)).rejects.toMatchObject({ status: 403 })
    port.actor = 'creator'
    const forged = await record('report.generated', 'creator', {
      title: 'Forged',
      type: 'pnl',
      period: '2025',
      status: 'draft',
      _cfoOrigin: 'cfo.record-origin.v1',
    })
    await expect(getReportNarrative(forged.id)).rejects.toMatchObject({ status: 403 })
  })
  it('does not persist a report or success-shaped audit reference when mandatory primary audit fails', async () => {
    await owner(
      "CREATE FUNCTION public.cfo_source_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic audit outage'; END$$",
    )
    await owner(
      'CREATE TRIGGER cfo_source_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION cfo_source_failure()',
    )
    await expect(generateReport({ ...input, includeNarrative: false })).rejects.toThrow()
    expect((await query('SELECT id FROM audit_log')).rows).toHaveLength(0)
    expect((await query('SELECT id FROM audit_events')).rows).toHaveLength(0)
  })
  it('denies all global firm operations for strong firm metadata before SQL', async () => {
    for (const action of [
      getPlatformMetrics,
      listFirms,
      () => suspendFirm(a),
      () => reactivateFirm(a),
      () => updateFirmSubscription(a, 'enterprise'),
    ])
      await expect(action()).rejects.toMatchObject({ status: 403 })
    expect(fixture.statements).toEqual([])
  })
  it('preserves actual global administrator metrics and atomic firm state/real-resource receipt without fake tenant', async () => {
    const parent = await record('firm.registered', 'foreign', {
      name: 'Firm',
      status: 'active',
      subscriptionTier: 'professional',
      userCount: 2,
      clientCount: 1,
    })
    port.role = 'platform_admin'
    expect(await getPlatformMetrics()).toMatchObject({ totalFirms: 1, activeFirms: 1, mrr: 499 })
    expect(await suspendFirm(parent.id)).toEqual({ success: true })
    expect(
      (await query("SELECT org_id,metadata FROM audit_log WHERE action='firm.suspended'")).rows,
    ).toMatchObject([
      {
        org_id: null,
        metadata: { firmId: parent.id, status: 'suspended', permission: 'platform_admin:manage' },
      },
    ])
    expect((await listFirms())[0]).toMatchObject({ id: parent.id, status: 'suspended' })
    expect(await reactivateFirm(parent.id)).toEqual({ success: true })
    expect(await updateFirmSubscription(parent.id, 'enterprise')).toEqual({ success: true })
    expect(await getPlatformMetrics()).toMatchObject({ mrr: 999, activeFirms: 1 })
  })
  it('rejects arbitrary firm fields/IDs and rolls state back on a real receipt outage', async () => {
    const parent = await record('firm.registered', 'foreign', {
      name: 'Firm',
      status: 'active',
      subscriptionTier: 'starter',
    })
    port.role = 'platform_admin'
    await expect(updateFirmSubscription(parent.id, 'forged-tier' as 'starter')).rejects.toThrow()
    expect(await suspendFirm(a)).toEqual({ success: false })
    await owner(
      "CREATE FUNCTION public.cfo_source_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='firm.suspended' THEN RAISE EXCEPTION 'synthetic receipt outage'; END IF; RETURN NEW; END$$",
    )
    await owner(
      'CREATE TRIGGER cfo_source_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION cfo_source_failure()',
    )
    await expect(suspendFirm(parent.id)).rejects.toThrow()
    expect((await listFirms())[0]).toMatchObject({ status: 'active' })
    expect((await query("SELECT id FROM audit_log WHERE action='firm.suspended'")).rows).toEqual([])
  })
  it('keeps legacy audit/action dropdowns, counts, ledger and security metadata within actual actor ownership', async () => {
    const own = await record('security.event', 'creator', {
      type: 'data_access',
      severity: 'low',
      description: 'Own event',
      resolved: false,
    })
    await record('security.event', 'foreign', {
      type: 'data_access',
      severity: 'critical',
      description: 'FOREIGN_PRIVATE',
      resolved: false,
    })
    await record('ledger.posted', 'creator', { type: 'credit', amount: 5 })
    await record('ledger.posted', 'foreign', { type: 'credit', amount: 900 })
    expect(await listSecurityEvents()).toMatchObject({
      events: [{ id: own.id, description: 'Own event' }],
      total: 1,
    })
    expect(await getSecurityPosture()).toMatchObject({ eventsSummary: { total: 1, critical: 0 } })
    expect(await getAuditStats()).toMatchObject({ totalEntries: 2, uniqueActors: 1 })
    expect((await listAuditEntries()).entries).toHaveLength(2)
    expect(await getLedgerEntries()).toMatchObject({ entryCount: 1, totalCredits: 5 })
    port.role = 'ops'
    expect(await getAuditStats()).toMatchObject({ totalEntries: 4, uniqueActors: 2 })
    expect((await listSecurityEvents()).total).toBe(2)
  })
  it('denies cross-actor legacy mutation independently of UUID org labels and couples authorized state to audit', async () => {
    const own = await record('security.event', 'creator', {
      type: 'data_access',
      severity: 'low',
      description: 'Own event',
      resolved: false,
    })
    const foreign = await record('security.event', 'foreign', { severity: 'high', resolved: false })
    await expect(resolveSecurityEvent(foreign.id)).rejects.toMatchObject({ status: 403 })
    expect(await resolveSecurityEvent(own.id)).toEqual({ success: true })
    expect(
      (
        await query(
          "SELECT org_id,actor_id,metadata FROM audit_log WHERE action='security.event.resolved'",
        )
      ).rows,
    ).toMatchObject([
      {
        org_id: null,
        actor_id: 'creator',
        metadata: { securityRecordId: own.id, authority: 'personal' },
      },
    ])
    const incident = await record('security.incident', 'creator', {
      title: 'Own incident',
      severity: 'low',
      status: 'open',
    })
    await expect(updateIncidentStatus(incident.id, 'fake' as 'open')).rejects.toThrow()
    expect(await updateIncidentStatus(incident.id, 'contained')).toEqual({ success: true })
    expect(await listIncidents()).toMatchObject([{ id: incident.id, status: 'contained' }])
  })
  it('rolls actual security state back if its required receipt cannot be inserted', async () => {
    const own = await record('security.event', 'creator', { severity: 'low', resolved: false })
    await owner(
      "CREATE FUNCTION public.cfo_source_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='security.event.resolved' THEN RAISE EXCEPTION 'synthetic receipt outage'; END IF; RETURN NEW; END$$",
    )
    await owner(
      'CREATE TRIGGER cfo_source_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION cfo_source_failure()',
    )
    await expect(resolveSecurityEvent(own.id)).rejects.toThrow()
    expect(
      (await query('SELECT metadata FROM audit_log WHERE id=$1', [own.id])).rows,
    ).toMatchObject([{ metadata: { resolved: false } }])
  })
  it('returns truthful unavailable for unconfigured scanner and empty-source reconciliation before any effect', async () => {
    await expect(runSecurityScan()).rejects.toMatchObject({
      status: 501,
      code: 'SECURITY_SCANNER_UNAVAILABLE',
    })
    await expect(runReconciliation()).rejects.toMatchObject({
      status: 501,
      code: 'RECONCILIATION_SOURCE_UNAVAILABLE',
    })
    expect((await query('SELECT id FROM audit_log')).rows).toEqual([])
    expect((await query('SELECT id FROM audit_events')).rows).toEqual([])
    port.actor = ''
    fixture.statements.length = 0
    await expect(runSecurityScan()).rejects.toThrow('Unauthorized')
    expect(fixture.statements).toEqual([])
  })
})
