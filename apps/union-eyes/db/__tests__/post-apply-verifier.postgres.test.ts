/**
 * The post-apply verifier against REAL PostgreSQL catalogs.
 *
 * 1. The combined Django + Drizzle database must satisfy its own storage-authority manifest: row-level security,
 *    policy coverage and the exact privileges of union_eyes_runtime and union_eyes_system, in both directions.
 * 2. The verifier must be able to fail. A scratch database proves it detects, and then clears, each kind of gap with
 *    the real catalog queries (a unit test with a fake database could not prove those).
 * 3. Every in-scope manifest entry has a physical table, so a declared relation that nothing creates fails here.
 *
 * Needs UE_AUTHORITY_COMBINED_URL: a superuser connection to the combined database. Creates and drops its own
 * scratch database on the same server. Not a staging pass.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { storageAuthorityManifest } from '../rls-storage-authority/index'
import {
  RUNTIME_ROLE,
  SYSTEM_ROLE,
  verifyEntries,
  type ManifestEntryLike,
} from '../../scripts/rls-enforcement/post-apply-verifier-core'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

describe.skipIf(!URL)('post-apply verifier on real PostgreSQL catalogs', () => {
  let admin: pg.Client

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
  })
  afterAll(async () => {
    await admin?.end().catch(() => undefined)
  })

  it('finds the combined database consistent with every in-scope manifest entry', async () => {
    const report = await verifyEntries(admin, storageAuthorityManifest)
    expect(report.diffs.map((d) => `${d.kind}: ${d.text}`)).toEqual([])
    expect(report.missing).toBe(0)
    expect(report.extra).toBe(0)
    // A verifier that checked nothing would also report no gaps.
    expect(report.checked.length).toBeGreaterThan(300)
    expect(report.checked).toEqual(expect.arrayContaining(['grievances', 'documents', 'ue_authority_mandates']))
  })

  it('finds a physical table for every in-scope manifest entry', async () => {
    // Platform 0061 created the twelve row-security relations that neither Django nor an earlier migration had; an entry with no table must be
    // created or retired, not listed here.
    const report = await verifyEntries(admin, storageAuthorityManifest)
    expect(report.skipped).toEqual([])
  })

  describe('detection and clearance, against a scratch database', () => {
    const scratch = `ue_verifier_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
    let db: pg.Client

    const tenant: ManifestEntryLike = {
      table: 'probe_tenant',
      classification: 'TENANT_RLS_REQUIRED',
      requiredRuntimePrivileges: ['SELECT', 'INSERT'],
      requiredSystemPrivileges: ['SELECT'],
    }
    const gaps = async (entry: ManifestEntryLike) => (await verifyEntries(db, [entry])).diffs.map((d) => `${d.kind}: ${d.text}`)

    beforeAll(async () => {
      await admin.query(`CREATE DATABASE ${scratch}`)
      const url = new globalThis.URL(URL!)
      url.pathname = `/${scratch}`
      db = new pg.Client({ connectionString: url.toString() })
      await db.connect()
      await db.query('CREATE TABLE public.probe_tenant (id uuid PRIMARY KEY, organization_id uuid)')
    })
    afterAll(async () => {
      await db?.end().catch(() => undefined)
      await admin.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    })

    it('reports a table that has no RLS, no grants and no policies', async () => {
      const diffs = await gaps(tenant)
      expect(diffs).toEqual(
        expect.arrayContaining([
          'MISSING: probe_tenant RLS not enabled',
          'MISSING: probe_tenant FORCE RLS not enabled',
          `MISSING: ${RUNTIME_ROLE} SELECT on probe_tenant`,
          `MISSING: ${RUNTIME_ROLE} INSERT on probe_tenant`,
          `MISSING: ${SYSTEM_ROLE} SELECT on probe_tenant`,
        ]),
      )
    })

    it('still reports missing policies once RLS and the grants are in place', async () => {
      await db.query('ALTER TABLE public.probe_tenant ENABLE ROW LEVEL SECURITY; ALTER TABLE public.probe_tenant FORCE ROW LEVEL SECURITY')
      await db.query(`GRANT SELECT, INSERT ON public.probe_tenant TO ${RUNTIME_ROLE}; GRANT SELECT ON public.probe_tenant TO ${SYSTEM_ROLE}`)
      expect(await gaps(tenant)).toEqual([
        `MISSING: probe_tenant ${RUNTIME_ROLE} is privileged to SELECT but no permissive SELECT policy applies to it`,
        `MISSING: probe_tenant ${RUNTIME_ROLE} is privileged to INSERT but no permissive INSERT policy applies to it`,
        `MISSING: probe_tenant ${SYSTEM_ROLE} is privileged to SELECT but no permissive SELECT policy applies to it`,
      ])
    })

    it('does not accept a restrictive policy as coverage', async () => {
      await db.query(`CREATE POLICY probe_restrictive ON public.probe_tenant AS RESTRICTIVE FOR ALL TO ${RUNTIME_ROLE}, ${SYSTEM_ROLE} USING (true)`)
      expect(await gaps(tenant)).toHaveLength(3)
    })

    it('is clean once permissive policies cover exactly the commands each role may run', async () => {
      await db.query(`CREATE POLICY probe_runtime_select ON public.probe_tenant FOR SELECT TO ${RUNTIME_ROLE} USING (true)`)
      await db.query(`CREATE POLICY probe_runtime_insert ON public.probe_tenant FOR INSERT TO ${RUNTIME_ROLE} WITH CHECK (true)`)
      await db.query(`CREATE POLICY probe_system_select ON public.probe_tenant FOR SELECT TO ${SYSTEM_ROLE} USING (true)`)
      expect(await gaps(tenant)).toEqual([])
    })

    it('reports a privilege the manifest does not allow', async () => {
      await db.query(`GRANT DELETE ON public.probe_tenant TO ${SYSTEM_ROLE}`)
      expect(await gaps(tenant)).toEqual([`EXTRA: ${SYSTEM_ROLE} DELETE on probe_tenant`])
      await db.query(`REVOKE DELETE ON public.probe_tenant FROM ${SYSTEM_ROLE}`)
      expect(await gaps(tenant)).toEqual([])
    })

    it('counts a permissive policy granted to PUBLIC for both roles', async () => {
      await db.query('CREATE TABLE public.probe_public (id uuid PRIMARY KEY)')
      await db.query('ALTER TABLE public.probe_public ENABLE ROW LEVEL SECURITY; ALTER TABLE public.probe_public FORCE ROW LEVEL SECURITY')
      await db.query(`GRANT SELECT ON public.probe_public TO ${RUNTIME_ROLE}, ${SYSTEM_ROLE}`)
      await db.query('CREATE POLICY probe_public_select ON public.probe_public FOR SELECT USING (true)')
      const entry: ManifestEntryLike = { table: 'probe_public', classification: 'MULTI_PARTY_RLS_REQUIRED', requiredRuntimePrivileges: ['SELECT'], requiredSystemPrivileges: ['SELECT'] }
      expect(await gaps(entry)).toEqual([])
    })

    it('expects no RLS shape from a dedicated execution context, only its privileges', async () => {
      await db.query('CREATE TABLE public.probe_framework (id integer PRIMARY KEY)')
      const entry: ManifestEntryLike = { table: 'probe_framework', classification: 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT', requiredRuntimePrivileges: [], requiredSystemPrivileges: [] }
      expect(await gaps(entry)).toEqual([])
      await db.query(`GRANT SELECT ON public.probe_framework TO ${RUNTIME_ROLE}`)
      expect(await gaps(entry)).toEqual([`EXTRA: ${RUNTIME_ROLE} SELECT on probe_framework`])
    })

    it('skips a table that does not exist', async () => {
      const report = await verifyEntries(db, [{ ...tenant, table: 'probe_absent' }])
      expect(report.skipped).toEqual(['probe_absent'])
      expect(report.diffs).toEqual([])
    })
  })
})
