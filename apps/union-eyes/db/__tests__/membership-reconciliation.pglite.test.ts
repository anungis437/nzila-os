/**
 * The reconciliation loader against PGlite relations shaped like the projection (user_management.organization_users +
 * users) and the canonical table (platform_organization_memberships, packages/db/src/schema/platform-authorization.ts).
 * It proves the two fixed SELECTs read what the pure comparison expects, that the organization filter is a bound
 * parameter, and that nothing but SELECT is ever issued.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { loadMembershipSnapshots, reconcileMembershipsFromDatabase } from '../../lib/authority/store/membership-reconciliation'
import type { SqlExecutor } from '../../lib/authority/store/executor'

const ORG = '00000000-0000-4000-8000-00000000000a'
const ORG_B = '00000000-0000-4000-8000-00000000000b'
let pg: PGlite
const issued: string[] = []
const exec: SqlExecutor = {
  query: async <T,>(text: string, params?: unknown[]) => {
    issued.push(text)
    return pg.query<T & Record<string, unknown>>(text, params as unknown[]) as unknown as { rows: T[] }
  },
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    CREATE SCHEMA user_management;
    CREATE TABLE user_management.users (user_id varchar(255) PRIMARY KEY, is_active boolean DEFAULT true, lifecycle_state text NOT NULL DEFAULT 'active');
    CREATE TABLE user_management.organization_users (organization_id uuid NOT NULL, user_id varchar(255) NOT NULL, role varchar(50) NOT NULL, is_active boolean DEFAULT true);
    CREATE TABLE public.platform_organization_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), platform_user_id varchar(255) NOT NULL, organization_id uuid NOT NULL, role varchar(80) NOT NULL,
      state varchar(16) NOT NULL, effective_from timestamptz NOT NULL, effective_to timestamptz, revoked_at timestamptz);
    INSERT INTO user_management.users (user_id, is_active, lifecycle_state) VALUES
      ('agree', true, 'active'), ('stale', true, 'active'), ('denied', true, 'suspended'), ('only_proj', true, 'active'), ('only_canon', true, 'active');
    INSERT INTO user_management.organization_users VALUES
      ('${ORG}', 'agree', 'steward', true), ('${ORG}', 'stale', 'steward', true), ('${ORG}', 'denied', 'steward', true), ('${ORG}', 'only_proj', 'member', true),
      ('${ORG_B}', 'agree', 'member', true);
    INSERT INTO public.platform_organization_memberships (platform_user_id, organization_id, role, state, effective_from, revoked_at) VALUES
      ('agree', '${ORG}', 'steward', 'active', now() - interval '1 day', NULL),
      ('stale', '${ORG}', 'steward', 'revoked', now() - interval '2 days', now() - interval '1 day'),
      ('denied', '${ORG}', 'steward', 'active', now() - interval '1 day', NULL),
      ('only_canon', '${ORG}', 'member', 'active', now() - interval '1 day', NULL);
  `)
})
afterAll(async () => { await pg?.close() })

describe('membership snapshots and drift report from the database', () => {
  it('loads both relations and finds exactly the seeded drift', async () => {
    const report = await reconcileMembershipsFromDatabase(exec)
    const byUser = Object.fromEntries(report.drifts.map((d) => [`${d.userId}@${d.organizationId === ORG ? 'A' : 'B'}`, `${d.kind}/${d.risk}`]))
    expect(byUser).toEqual({
      'agree@B': 'MISSING_IN_CANONICAL/PROJECTION_GRANTS_CANONICAL_DENIES',
      'denied@A': 'STATUS_MISMATCH/CANONICAL_GRANTS_PROJECTION_DENIES',
      'only_canon@A': 'MISSING_IN_PROJECTION/CANONICAL_GRANTS_PROJECTION_DENIES',
      'only_proj@A': 'MISSING_IN_CANONICAL/PROJECTION_GRANTS_CANONICAL_DENIES',
      'stale@A': 'STATUS_MISMATCH/PROJECTION_GRANTS_CANONICAL_DENIES',
    })
    expect(report).toMatchObject({ consistent: false, staleGrants: 3, projectionRows: 5, canonicalRows: 4 })
  })

  it('the organization filter is a bound parameter and narrows both sides', async () => {
    const { projection, canonical } = await loadMembershipSnapshots(exec, ORG_B)
    expect(projection.map((r) => r.userId)).toEqual(['agree'])
    expect(canonical).toEqual([])
    const before = issued.length
    await loadMembershipSnapshots(exec, `${ORG}'; DROP TABLE user_management.users; --`).catch(() => undefined)
    expect(issued.slice(before).every((s) => !s.includes('DROP TABLE'))).toBe(true)
  })

  it('only ever issues SELECT statements', async () => {
    await reconcileMembershipsFromDatabase(exec, { organizationId: ORG })
    expect(issued.length).toBeGreaterThan(0)
    for (const statement of issued) expect(statement.trim().toUpperCase().startsWith('SELECT')).toBe(true)
  })

  it('a fully reconciled organization reports consistent', async () => {
    await pg.exec(`
      DELETE FROM user_management.organization_users WHERE user_id IN ('stale', 'denied', 'only_proj');
      DELETE FROM public.platform_organization_memberships WHERE platform_user_id IN ('stale', 'denied', 'only_canon');
    `)
    expect((await reconcileMembershipsFromDatabase(exec, { organizationId: ORG })).consistent).toBe(true)
  })
})
