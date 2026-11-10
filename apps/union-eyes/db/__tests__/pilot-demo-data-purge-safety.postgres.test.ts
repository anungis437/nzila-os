/**
 * Native PostgreSQL proof that the demo-data purge route (app/api/pilot/demo-data/route.ts) never deletes a row
 * outside what the seed itself created, even when a REAL row's grievance number or employer email happens to match
 * the historical demo naming convention (GRV-DEMO-%, lr-demo@%).
 *
 * DEF-0B10-PIL-DEMO-DATA-INSERTS-FICTIONAL-GRIEVANCES-AND-NAMED-FEDERAL-EMPLOYERS-INTO-THE-LIVE-TABLES-WITH-NO-ROW-MARKER-AND-DELETES-BY-NUMBER-AND-EMAIL-PATTERN.
 *
 * Runs the real, unmodified POST/DELETE route handlers - and the real generateDemoEmployers/generateDemoGrievances
 * fixtures they seed from - against the combined Django + Drizzle schema, through the real drizzle-orm query
 * builder and the real pilotDemoSeeds/employers/grievances schema objects (db and withRLSContext are mocked only
 * to route every query through that real connection; auth/runtime-mode/audit are stubbed). Operates on the REAL,
 * already-migrated tables (no synthetic CREATE TABLE of its own - this is the shared combined database every other
 * *.postgres.test.ts file in the same run also uses), so every raw fixture insert below supplies every real NOT
 * NULL column with a real, constraint-satisfying value and every mutation is scoped to this test's own
 * organization_id - never an unscoped DELETE/DROP against the shared tables.
 *
 * Opt-in: skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully
 * bootstrapped database (same convention as every other file in this directory). Run locally via
 * tooling/scripts/ue-runtime-up.mjs (db --fresh --postgres-version 15, then env) to get a real connection string,
 * e.g.:
 *   UE_AUTHORITY_COMBINED_URL=postgres://... UE_AUTHORITY_DJANGO=1 \
 *     npx vitest run --config vitest.native.config.ts db/__tests__/pilot-demo-data-purge-safety.postgres.test.ts
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pilotDemoSeeds } from '@/db/schema/domains/pilot/pilot-demo-seeds';
import { employers } from '@/db/schema/union-structure-schema';
import { grievances } from '@/db/schema/domains/claims/grievances';

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL;
type Tx = ReturnType<typeof drizzle>;
const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/db', () => ({
  db: new Proxy(
    {},
    {
      get(_t, prop) {
        const store = state.db as Tx;
        const value = (store as unknown as Record<PropertyKey, unknown>)[prop as string];
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(store) : value;
      },
    },
  ),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, work: (tx: Tx) => Promise<unknown>) => {
    const { db } = await import('@/db/db');
    return work(db as unknown as Tx);
  },
}));
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (r: Request, c: { organizationId: string; userId: string }) => Promise<Response>) => handler,
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: async () => true }));
vi.mock('@/lib/audit/cape-audit-events', () => ({ CAPE_AUDIT_EVENTS: { PILOT_DEMO_DATA_SEEDED: 'seeded', PILOT_DEMO_DATA_PURGED: 'purged' } }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: async () => undefined }));
vi.mock('@/lib/config/pilot-demo-runtime', () => ({ assertPilotDemoMutationRuntime: () => 'pilot' }));

describe.skipIf(!URL_)('pilot demo-data purge never deletes a real row matching the demo naming pattern', () => {
  let admin: pg.Client;
  const ORG_ID = randomUUID();

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ });
    await admin.connect();
    // A real organization row: employers.organization_id carries a real FK to organizations.id, so both the
    // seed route's own inserts and this test's "colliding real employer" fixture need one to exist first.
    await admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1, $2, $3, 'local', ARRAY[$1]::uuid[], 0, '{}', false, 0, 0, '{}', '{}', 'active', now(), now(), 1)`,
      [ORG_ID, `Demo Purge Safety Org ${ORG_ID.slice(0, 8)}`, `demo-purge-safety-${ORG_ID.slice(0, 8)}`],
    );
    state.db = drizzle(admin, { schema: { pilotDemoSeeds, employers, grievances } });
  });

  afterAll(async () => {
    // Scoped cleanup only - this runs against the SAME shared, fully-bootstrapped combined database every other
    // *.postgres.test.ts file in this run also uses, so nothing here may touch another test's rows.
    await admin.query('DELETE FROM grievances WHERE organization_id = $1', [ORG_ID]);
    await admin.query('DELETE FROM employers WHERE organization_id = $1', [ORG_ID]);
    await admin.query('DELETE FROM pilot_demo_seeds WHERE organization_id = $1', [ORG_ID]);
    await admin.query('DELETE FROM organizations WHERE id = $1', [ORG_ID]);
    await admin.end();
  });

  beforeEach(async () => {
    // Reset this test's own org-scoped rows between the 2 it() blocks below - still scoped, never a bare DELETE.
    await admin.query('DELETE FROM pilot_demo_seeds WHERE organization_id = $1', [ORG_ID]);
    await admin.query('DELETE FROM employers WHERE organization_id = $1', [ORG_ID]);
    await admin.query('DELETE FROM grievances WHERE organization_id = $1', [ORG_ID]);
  });

  async function post() {
    const { POST } = await import('@/app/api/pilot/demo-data/route');
    return POST(new Request('http://localhost/api/pilot/demo-data', { method: 'POST' }), { organizationId: ORG_ID, userId: 'u1' });
  }
  async function del() {
    const { DELETE } = await import('@/app/api/pilot/demo-data/route');
    return DELETE(new Request('http://localhost/api/pilot/demo-data', { method: 'DELETE' }), { organizationId: ORG_ID, userId: 'u1' });
  }

  it('deletes only the seed-owned rows; a real row with a colliding grievance number/employer email survives', async () => {
    const postResponse = await post();
    expect(postResponse.status).toBe(200);

    // A REAL grievance and employer that happen to match the historical demo naming convention, created outside
    // this seed (no id in its tracked arrays).
    await admin.query(
      `INSERT INTO grievances (id, organization_id, grievance_number, type, status, title, description, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'GRV-DEMO-999', 'individual', 'new', 'A real grievance that collides with the pattern', 'real description', now(), now())`,
      [ORG_ID],
    );
    await admin.query(
      `INSERT INTO employers (id, organization_id, name, employer_type, status, email, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'A Real Employer', 'federal', 'active', 'lr-demo@a-real-employer.ca', now(), now())`,
      [ORG_ID],
    );

    const deleteResponse = await del();
    expect(deleteResponse.status).toBe(200);

    const remainingGrievances = await admin.query('SELECT grievance_number FROM grievances WHERE organization_id = $1', [ORG_ID]);
    const remainingEmployers = await admin.query('SELECT email FROM employers WHERE organization_id = $1', [ORG_ID]);

    expect(remainingGrievances.rows.map((r) => r.grievance_number)).toEqual(['GRV-DEMO-999']);
    expect(remainingEmployers.rows.map((r) => r.email)).toEqual(['lr-demo@a-real-employer.ca']);
  });

  it('refuses to purge a legacy marker (null id arrays), leaving every row - seeded and colliding real rows alike - untouched', async () => {
    // Simulates a marker seeded before employer_ids/grievance_ids existed: inserted directly, bypassing POST.
    await admin.query(
      'INSERT INTO pilot_demo_seeds (organization_id, employer_count, grievance_count) VALUES ($1, 1, 1)',
      [ORG_ID],
    );
    await admin.query(
      `INSERT INTO grievances (id, organization_id, grievance_number, type, status, title, description, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'GRV-DEMO-LEGACY-1', 'individual', 'new', 'Legacy-seeded grievance (untracked)', 'd', now(), now())`,
      [ORG_ID],
    );
    await admin.query(
      `INSERT INTO grievances (id, organization_id, grievance_number, type, status, title, description, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'GRV-DEMO-999', 'individual', 'new', 'A real grievance that collides with the pattern', 'd', now(), now())`,
      [ORG_ID],
    );
    await admin.query(
      `INSERT INTO employers (id, organization_id, name, employer_type, status, email, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'A Real Employer', 'federal', 'active', 'lr-demo@a-real-employer.ca', now(), now())`,
      [ORG_ID],
    );

    const deleteResponse = await del();
    expect(deleteResponse.status).toBe(409);

    const remainingGrievances = await admin.query(
      'SELECT grievance_number FROM grievances WHERE organization_id = $1 ORDER BY grievance_number',
      [ORG_ID],
    );
    const remainingEmployers = await admin.query('SELECT email FROM employers WHERE organization_id = $1', [ORG_ID]);

    // Nothing was deleted at all - the legacy-seeded row AND the colliding real row both survive, because the
    // whole purge is refused rather than falling back to a pattern that cannot tell them apart.
    expect(remainingGrievances.rows.map((r) => r.grievance_number)).toEqual(['GRV-DEMO-999', 'GRV-DEMO-LEGACY-1'].sort());
    expect(remainingEmployers.rows.map((r) => r.email)).toEqual(['lr-demo@a-real-employer.ca']);
  });
});
