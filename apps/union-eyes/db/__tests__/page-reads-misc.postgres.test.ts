/**
 * Small page reads on real PostgreSQL, as the real roles: the trust page's figures and the two reads the tenant-context census flags that need no
 * organization at all.
 *
 *   - Trust (lib/trust/system-metrics.ts): the audit count is the organization's own, read in its context (audit_logs is a tenant table; with no
 *     organization set the runtime role counts nothing), the row-level-security share and the immutability protection are measured from the catalogs
 *     as the runtime role sees them, not asserted.
 *   - Census false positives, proved rather than argued: platform_services (the operations page) and feature_flags (the AI assistant page) are
 *     reference tables with no row-level security; the runtime role reads them with no organization set, so they need no context.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-savepoint-harness')).contextModule)
// The governance figures come from the Django service over HTTP: an external service.
vi.mock('@/services/governance-service', () => ({
  GovernanceService: class {
    checkGoldenShareStatus = async () => ({ exists: true, holder: 'Council' })
  },
}))

const { savepointHarness, RUNTIME_ROLE } = await import('./native-savepoint-harness')
const trust = URL ? await import('@/lib/trust/system-metrics') : null
const platformServices = URL ? await import('@/lib/operations/platform-services') : null
const featureFlags = URL ? await import('@/lib/services/feature-flags') : null

const HISTORY_TABLES = ['grievance_transitions', 'approval_records', 'claim_updates', 'audit_logs']

describe.skipIf(!URL)('small page reads on the combined schema, as the real roles', () => {
  const tag = `pm${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  let admin: pg.Client

  const audit = (organizationId: string, ago: string) =>
    admin.query(`INSERT INTO audit_logs (id, created_at, updated_at, organization_id, action) VALUES (gen_random_uuid(), now() - $2::interval, now(), $1, 'native.test')`, [organizationId, ago])

  beforeAll(async () => {
    admin = await savepointHarness.start(URL!)
    await insertOrganization(admin, tag, { id: ORG_A, name: `Alpha Union ${tag}` })
    await insertOrganization(admin, tag, { id: ORG_B, name: `Beta Union ${tag}` })
    await audit(ORG_A, '1 day')
    await audit(ORG_A, '10 days')
    await audit(ORG_A, '29 days')
    await audit(ORG_A, '40 days')
    await audit(ORG_B, '1 day')
    await audit(ORG_B, '2 days')
  }, 180_000)

  afterAll(async () => {
    await admin?.end()
    await savepointHarness.stop()
  })

  describe('trust metrics', () => {
    it("counts the organization's own audit events of the last 30 days and nothing of another organization's", async () => {
      expect(await trust!.getAuditLogMetrics(ORG_A)).toMatchObject({ status: 'active', verification: true, eventsLogged: 3 })
      expect((await trust!.getAuditLogMetrics(ORG_B)).eventsLogged).toBe(2)
      expect((await trust!.getAuditLogMetrics(randomUUID())).eventsLogged).toBe(0)
    })

    it('shows the runtime role an empty audit trail when no organization is set, which is why the count needs its context', async () => {
      const bare = await savepointHarness.context(RUNTIME_ROLE, null, null, async (tx) => {
        const rows = (await tx.execute(`SELECT COUNT(*)::int AS count FROM audit_logs` as never)) as unknown as Array<{ count: number }>
        return rows[0].count
      })

      expect(bare).toBe(0)
    })

    it('measures the share of the tables with an organization column that enforce row-level security, as the catalogs say', async () => {
      const truth = (
        await admin.query(`
          SELECT c.relname::text AS table_name, c.relrowsecurity AS enabled
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
            AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname IN ('organization_id', 'org_id') AND a.attnum > 0 AND NOT a.attisdropped)
          ORDER BY c.relname`)
      ).rows as Array<{ table_name: string; enabled: boolean }>
      const protectedTables = truth.filter((table) => table.enabled).map((table) => table.table_name)
      const policies = Number((await admin.query(`SELECT COUNT(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`)).rows[0].n)

      const metric = await trust!.getRLSMetrics(ORG_A)

      expect(truth.length).toBeGreaterThan(100)
      expect(metric.tablesProtected).toEqual(protectedTables)
      expect(metric.policiesActive).toBe(policies)
      expect(metric.orgIsolation).toBe(`${Math.floor((protectedTables.length / truth.length) * 100)}%`)
      expect(metric.status).toBe(protectedTables.length === truth.length ? 'active' : 'degraded')
      expect(metric.description).toContain(`${protectedTables.length} of ${truth.length} tables`)
    })

    it('reports protection only for the history tables an enabled trigger refuses to update and to delete, and no violation count', async () => {
      // approval_records is one of the four history tables the product names, and the converged schema has no such table: it is not counted.
      const existing = (
        await admin.query(`SELECT relname::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND relname = ANY($1) ORDER BY relname`, [HISTORY_TABLES])
      ).rows.map((row: { name: string }) => row.name)
      expect(existing).toEqual(['audit_logs', 'claim_updates', 'grievance_transitions'])

      const none = await trust!.getImmutabilityMetrics(ORG_A)
      expect(none).toMatchObject({ status: 'error', verification: false, triggersActive: false, tablesProtected: [], violationAttempts: null })
      expect(none.description).toBe('0 of 3 history tables have enabled triggers that refuse both updates and deletes')

      await admin.query(`CREATE FUNCTION refuse_history_change_${tag}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'history is immutable'; END $$`)
      const protect = async (table: string, event: 'UPDATE' | 'DELETE', name: string) =>
        admin.query(`CREATE TRIGGER ${name} BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION refuse_history_change_${tag}()`)

      await protect('claim_updates', 'UPDATE', `claim_updates_immutable_update_${tag}`)
      expect((await trust!.getImmutabilityMetrics(ORG_A)).tablesProtected).toEqual([])

      await protect('claim_updates', 'DELETE', `claim_updates_immutable_delete_${tag}`)
      expect(await trust!.getImmutabilityMetrics(ORG_A)).toMatchObject({ status: 'degraded', triggersActive: false, tablesProtected: ['claim_updates'] })

      for (const table of existing.filter((name) => name !== 'claim_updates')) {
        await protect(table, 'UPDATE', `${table}_immutable_update_${tag}`)
        await protect(table, 'DELETE', `${table}_immutable_delete_${tag}`)
      }
      expect(await trust!.getImmutabilityMetrics(ORG_A)).toMatchObject({
        status: 'active',
        verification: true,
        triggersActive: true,
        tablesProtected: existing,
        violationAttempts: null,
      })

      await admin.query(`ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutable_update_${tag}`)
      expect((await trust!.getImmutabilityMetrics(ORG_A)).tablesProtected).not.toContain('audit_logs')
    })

    it('assembles every figure for the organization of the page', async () => {
      const metrics = await trust!.getTrustMetrics(ORG_A)

      expect(metrics.auditLog.eventsLogged).toBe(3)
      expect(metrics.rlsEnforcement.tablesProtected.length).toBeGreaterThan(0)
      expect(metrics.governance).toMatchObject({ goldenShareActive: true, goldenShareHolder: 'Council' })
      expect(metrics.fsmValidation.status).toBe('unknown')
    })
  })

  describe('census findings that need no organization', () => {
    it('reads the platform services with no organization set: the table is reference data with no row-level security', async () => {
      await admin.query(`INSERT INTO platform_services (service_name, status) VALUES ($1, 'healthy'), ($2, 'down') ON CONFLICT (service_name) DO UPDATE SET status = EXCLUDED.status`, [`web-${tag}`, `queue-${tag}`])

      const overview = await platformServices!.loadPlatformServices()

      expect(overview.services.map((service) => service.serviceName)).toEqual(expect.arrayContaining([`web-${tag}`, `queue-${tag}`]))
      expect(overview.services.find((service) => service.serviceName === `queue-${tag}`)?.status).toBe('down')
      expect(overview.totalServices).toBe(overview.services.length)
      expect(overview.downServices).toBeGreaterThanOrEqual(1)
    })

    it('evaluates a feature flag with no organization set: the flags are reference data with no row-level security', async () => {
      await admin.query(`INSERT INTO feature_flags (name, type, enabled) VALUES ($1, 'boolean', true), ($2, 'boolean', false)`, [`on-${tag}`, `off-${tag}`])

      expect(await featureFlags!.evaluateFeature(`on-${tag}`, {})).toMatchObject({ enabled: true })
      expect(await featureFlags!.evaluateFeature(`off-${tag}`, {})).toMatchObject({ enabled: false, reason: 'Feature globally disabled' })
      expect(await featureFlags!.evaluateFeature(`missing-${tag}`, {})).toMatchObject({ enabled: false, reason: 'Feature flag not found in database' })
    })
  })
})
