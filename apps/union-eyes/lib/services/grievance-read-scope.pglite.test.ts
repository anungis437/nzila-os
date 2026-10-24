import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { and, eq } from 'drizzle-orm';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceRelationshipScope, unassignedIntakeTriageScope } from './grievance-read-scope';

const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const ownerUuid = '33333333-3333-4333-8333-333333333333';
const seniorNoRelationship = 'chief-steward-no-relationship';
const collaborator = 'ue-v2-http-collab-7c1f';

const matter = {
  owned: '00000000-0000-4000-8000-000000000001',
  authored: '00000000-0000-4000-8000-000000000002',
  unrelated: '00000000-0000-4000-8000-000000000003',
  grantedActive: '00000000-0000-4000-8000-000000000004',
  grantedExpired: '00000000-0000-4000-8000-000000000005',
  grantedRevoked: '00000000-0000-4000-8000-000000000006',
  foreignOrg: '00000000-0000-4000-8000-000000000007',
  openIntake: '00000000-0000-4000-8000-000000000008',
  confidentialIntake: '00000000-0000-4000-8000-000000000009',
  assignedIntake: '00000000-0000-4000-8000-00000000000a',
};

let pg: PGlite;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE grievances (
      id uuid PRIMARY KEY, organization_id uuid NOT NULL, grievance_number text,
      status text NOT NULL DEFAULT 'draft', created_by text, union_rep_id uuid, is_confidential boolean DEFAULT false
    );
    CREATE TABLE grievance_case_access_assignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, grievance_id uuid NOT NULL,
      user_id text NOT NULL, status text NOT NULL DEFAULT 'active', expires_at timestamptz
    );
  `);
  db = drizzle(pg);

  const rows: Array<[string, string, string, string | null, string | null, boolean, string]> = [
    [matter.owned, orgA, 'filed', 'someone', ownerUuid, false, 'G-owned'],
    [matter.authored, orgA, 'filed', seniorNoRelationship, null, false, 'G-authored'],
    [matter.unrelated, orgA, 'filed', 'someone', null, false, 'G-unrelated'],
    [matter.grantedActive, orgA, 'filed', 'someone', null, false, 'G-active'],
    [matter.grantedExpired, orgA, 'filed', 'someone', null, false, 'G-expired'],
    [matter.grantedRevoked, orgA, 'filed', 'someone', null, false, 'G-revoked'],
    [matter.foreignOrg, orgB, 'filed', 'someone', null, false, 'G-foreign'],
    [matter.openIntake, orgA, 'draft', 'member-1', null, false, 'G-intake'],
    [matter.confidentialIntake, orgA, 'draft', 'member-2', null, true, 'G-conf-intake'],
    [matter.assignedIntake, orgA, 'draft', 'member-3', ownerUuid, false, 'G-assigned-intake'],
  ];
  for (const [id, org, status, createdBy, rep, conf, number] of rows) {
    await pg.query(
      'INSERT INTO grievances(id, organization_id, status, created_by, union_rep_id, is_confidential, grievance_number) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, org, status, createdBy, rep, conf, number],
    );
  }
  const grant = (grievance: string, org: string, user: string, status: string, expires: string | null) =>
    pg.query(
      'INSERT INTO grievance_case_access_assignments(organization_id, grievance_id, user_id, status, expires_at) VALUES($1,$2,$3,$4,$5)',
      [org, grievance, user, status, expires],
    );
  await grant(matter.grantedActive, orgA, collaborator, 'active', null);
  await grant(matter.grantedExpired, orgA, collaborator, 'active', '2000-01-01T00:00:00Z');
  await grant(matter.grantedRevoked, orgA, collaborator, 'revoked', null);
  // A grant row pointing at a foreign-organization matter must not widen scope inside orgA queries.
  await grant(matter.foreignOrg, orgB, collaborator, 'active', null);
});

afterAll(async () => {
  await pg?.close();
});

async function readable(userId: string, org = orgA) {
  const result = await db
    .select({ number: grievances.grievanceNumber })
    .from(grievances)
    .where(and(eq(grievances.organizationId, org), grievanceRelationshipScope(userId)));
  return result.map((r) => r.number).sort();
}

describe('grievance relationship scope against PostgreSQL (cross-case read confidentiality)', () => {
  it('gives a senior user with no relationship only what they authored, never the organization', async () => {
    expect(await readable(seniorNoRelationship)).toEqual(['G-authored']);
  });

  it('gives a user with no relationship at all an empty result', async () => {
    expect(await readable('chief-steward-with-nothing')).toEqual([]);
  });

  it('gives the primary owner their matters, including assigned intakes', async () => {
    expect(await readable(ownerUuid)).toEqual(['G-assigned-intake', 'G-owned']);
  });

  it('honours only active, unexpired grants and ignores expired and revoked ones', async () => {
    expect(await readable(collaborator)).toEqual(['G-active']);
  });

  it('does not let a foreign-organization grant widen an organization-scoped query', async () => {
    expect(await readable(collaborator, orgA)).not.toContain('G-foreign');
    expect(await readable(collaborator, orgB)).toEqual(['G-foreign']);
  });

  it('accepts non-UUID application user ids without a cast failure', async () => {
    await expect(readable("ue-v2-http-admin-7c1f'; DROP TABLE grievances;--")).resolves.toEqual([]);
    expect((await pg.query('SELECT count(*)::int AS n FROM grievances')).rows[0]).toEqual({ n: 10 });
  });

  it('limits triage projection to unassigned, non-confidential intakes', async () => {
    const rows = await db
      .select({ number: grievances.grievanceNumber })
      .from(grievances)
      .where(and(eq(grievances.organizationId, orgA), unassignedIntakeTriageScope()));
    expect(rows.map((r) => r.number)).toEqual(['G-intake']);
  });

  it('revocation takes effect immediately for the same user', async () => {
    await pg.query(
      `UPDATE grievance_case_access_assignments SET status = 'revoked' WHERE grievance_id = $1 AND user_id = $2`,
      [matter.grantedActive, collaborator],
    );
    expect(await readable(collaborator)).toEqual([]);
  });
});
