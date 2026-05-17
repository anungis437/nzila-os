/**
 * CRUD item route for claims
 * Custom GET to include member contact info via JOIN.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { claims } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

// Custom GET with member JOIN
const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Claims'],
      summary: 'Get claim by ID',
      description: 'Returns a single claim with member contact info.',
    },
  },
  async ({ params, organizationId, userId }) => {
    const id = params.id;

    // Resolve organizationId: if null, fall back to the user's membership org
    let orgId = organizationId;
    if (!orgId && userId) {
      const memberRows = await withRLSContext(async () => db.execute(
        sql`SELECT organization_id FROM organization_members WHERE user_id = ${userId} LIMIT 1`,
      ));
      orgId = (memberRows[0] as { organization_id?: string } | undefined)?.organization_id ?? null;
    }

    // Build WHERE clause: org-scoped when possible, owner-fallback when not
    const orgFilter = orgId
      ? sql`AND c.organization_id = ${orgId}::uuid`
      : userId
        ? sql`AND c.member_id = ${userId}`
        : sql`AND FALSE`;

    const rows = await withRLSContext(async () => db.execute(sql`
      SELECT c.claim_id        AS "claimId",
             c.claim_number    AS "claimNumber",
             c.organization_id AS "organizationId",
             c.member_id       AS "memberId",
             c.is_anonymous    AS "isAnonymous",
             c.claim_type      AS "claimType",
             c.status,
             c.priority,
             c.incident_date   AS "incidentDate",
             c.location,
             c.description,
             c.desired_outcome AS "desiredOutcome",
             c.attachments,
             c.witnesses_present AS "witnessesPresent",
             c.witness_details AS "witnessDetails",
             c.filed_date      AS "filedDate",
             c.created_at      AS "createdAt",
             c.updated_at      AS "updatedAt",
             c.assigned_to     AS "assignedTo",
             c.assigned_at     AS "assignedAt",
             c.ai_score        AS "aiScore",
             c.ai_analysis     AS "aiAnalysis",
             c.merit_confidence  AS "meritConfidence",
             c.precedent_match   AS "precedentMatch",
             c.complexity_score  AS "complexityScore",
             c.claim_amount      AS "claimAmount",
             c.settlement_amount AS "settlementAmount",
             c.legal_costs       AS "legalCosts",
             c.court_costs       AS "courtCosts",
             c.resolution_outcome AS "resolutionOutcome",
             c.resolved_at       AS "resolvedAt",
             c.progress,
             m.name   AS "memberName",
             m.email  AS "memberEmail",
             m.phone  AS "memberPhone"
      FROM claims c
      LEFT JOIN organization_members m
        ON m.user_id = c.member_id
       AND m.organization_id = c.organization_id::text
      WHERE (c.claim_number = ${id} OR c.claim_id::text = ${id})
        ${orgFilter}
      LIMIT 1
    `));
    const row = rows[0];
    if (!row) throw ApiError.notFound('Claim not found');
    return { data: row };
  },
);

// PATCH and DELETE from CRUD factory — status is FSM-governed, block direct mutation
const { PATCH, DELETE } = crudRoutes({
  table: claims,
  pk: 'claimNumber',
  tags: ["Claims"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  blockedPatchFields: ['status'],
}) as unknown as { PATCH: typeof GET; DELETE: typeof GET };

export { GET, PATCH, DELETE };
