/**
 * Native PostgreSQL proof that the demo-data purge route (app/api/pilot/demo-data/route.ts) never deletes a row
 * outside what the seed itself created, even when a REAL row's grievance number or employer email happens to match
 * the historical demo naming convention (GRV-DEMO-%, lr-demo@%).
 *
 * DEF-0B10-PIL-DEMO-DATA-INSERTS-FICTIONAL-GRIEVANCES-AND-NAMED-FEDERAL-EMPLOYERS-INTO-THE-LIVE-TABLES-WITH-NO-ROW-MARKER-AND-DELETES-BY-NUMBER-AND-EMAIL-PATTERN.
 *
 * Runs the real, unmodified POST/DELETE route handlers - and the real generateDemoEmployers/generateDemoGrievances
 * fixtures they seed from - against a real Postgres connection, through the real drizzle-orm query builder and the
 * real pilotDemoSeeds/employers/grievances schema objects (db and withRLSContext are mocked only to route every
 * query through that real connection; auth/runtime-mode/audit are stubbed). Tables here declare every column the
 * real schema objects do (so Drizzle's generated INSERT, which references every declared column and sends `default`
 * for the rest, succeeds), but as plain nullable types with no FK/enum/uniqueness constraints - this proves the
 * purge's row-ownership logic against real SQL semantics (inArray, IS NULL, empty-array no-op), not the full
 * production constraint/privilege surface, which is out of scope for this specific safety property.
 *
 * Opt-in: skipped unless UE_TEST_PG_URL is set to a reachable, disposable Postgres connection string. Run locally
 * against a throwaway container, e.g.:
 *   docker run --rm -d --name ue-test-pg -e POSTGRES_PASSWORD=postgres -p 15435:5432 \
 *     pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337
 *   UE_TEST_PG_URL=postgres://postgres:postgres@127.0.0.1:15435/postgres \
 *     npx vitest run --config vitest.native.config.ts db/__tests__/pilot-demo-data-purge-safety.postgres.test.ts
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pilotDemoSeeds } from '@/db/schema/domains/pilot/pilot-demo-seeds';
import { employers } from '@/db/schema/union-structure-schema';
import { grievances } from '@/db/schema/domains/claims/grievances';

const URL_ = process.env.UE_TEST_PG_URL;
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
    await admin.query(`
      CREATE TABLE IF NOT EXISTS pilot_demo_seeds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        seeded_by varchar(255),
        seeded_at timestamptz NOT NULL DEFAULT now(),
        purged_at timestamptz,
        member_count integer NOT NULL DEFAULT 0,
        employer_count integer NOT NULL DEFAULT 0,
        grievance_count integer NOT NULL DEFAULT 0,
        employer_ids text[],
        grievance_ids text[],
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS employers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid,
        name varchar(255),
        legal_name varchar(255),
        dba_name varchar(255),
        employer_type varchar(50),
        status varchar(50),
        business_number varchar(50),
        federal_corporation_number varchar(50),
        provincial_corporation_number varchar(50),
        industry_code varchar(20),
        email varchar(255),
        phone varchar(50),
        website varchar(500),
        main_address jsonb,
        total_employees integer,
        unionized_employees integer,
        established_date date,
        primary_contact_name varchar(255),
        primary_contact_title varchar(255),
        primary_contact_email varchar(255),
        primary_contact_phone varchar(50),
        labour_relations_contact_name varchar(255),
        labour_relations_contact_email varchar(255),
        labour_relations_contact_phone varchar(50),
        parent_company_id uuid,
        notes text,
        custom_fields jsonb,
        created_at timestamptz,
        updated_at timestamptz,
        created_by text,
        updated_by text,
        archived_at timestamptz
      );
      CREATE TABLE IF NOT EXISTS grievances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        grievance_number varchar(50),
        type varchar(50),
        status varchar(50),
        priority varchar(50),
        step varchar(50),
        grievant_id uuid,
        grievant_name varchar(255),
        grievant_email varchar(255),
        union_rep_id uuid,
        employer_rep_id varchar(255),
        employer_id uuid,
        employer_name varchar(255),
        workplace_id uuid,
        workplace_name varchar(255),
        cba_id uuid,
        cba_article varchar(100),
        cba_section varchar(100),
        title varchar(500),
        description text,
        background text,
        desired_outcome text,
        incident_date timestamptz,
        filed_date timestamptz,
        response_deadline timestamptz,
        meeting_date timestamptz,
        escalated_at timestamptz,
        resolved_at timestamptz,
        closed_at timestamptz,
        timeline jsonb,
        group_grievance_id uuid,
        related_grievance_ids jsonb,
        attachments jsonb,
        is_group_grievance boolean,
        is_arbitration_eligible boolean,
        has_legal_implications boolean,
        is_confidential boolean,
        organization_id uuid,
        created_at timestamptz,
        updated_at timestamptz,
        created_by text,
        last_updated_by text,
        external_case_id varchar(255),
        import_fingerprint varchar(64),
        source_system varchar(100),
        imported_at timestamptz,
        import_batch_id uuid
      );
    `);
    state.db = drizzle(admin, { schema: { pilotDemoSeeds, employers, grievances } });
  });

  afterAll(async () => {
    await admin.query('DROP TABLE IF EXISTS pilot_demo_seeds, employers, grievances');
    await admin.end();
  });

  beforeEach(async () => {
    await admin.query('DELETE FROM pilot_demo_seeds');
    await admin.query('DELETE FROM employers');
    await admin.query('DELETE FROM grievances');
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
      "INSERT INTO grievances (organization_id, grievance_number, title, description) VALUES ($1, 'GRV-DEMO-999', 'A real grievance that collides with the pattern', 'real description')",
      [ORG_ID],
    );
    await admin.query(
      "INSERT INTO employers (organization_id, name, email) VALUES ($1, 'A Real Employer', 'lr-demo@a-real-employer.ca')",
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
      "INSERT INTO grievances (organization_id, grievance_number, title, description) VALUES ($1, 'GRV-DEMO-LEGACY-1', 'Legacy-seeded grievance (untracked)', 'd')",
      [ORG_ID],
    );
    await admin.query(
      "INSERT INTO grievances (organization_id, grievance_number, title, description) VALUES ($1, 'GRV-DEMO-999', 'A real grievance that collides with the pattern', 'd')",
      [ORG_ID],
    );
    await admin.query(
      "INSERT INTO employers (organization_id, name, email) VALUES ($1, 'A Real Employer', 'lr-demo@a-real-employer.ca')",
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
