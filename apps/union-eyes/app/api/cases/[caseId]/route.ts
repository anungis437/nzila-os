/**
 * Case detail route — GET returns case with member contact info.
 * "Cases" are claims viewed from the steward workbench perspective.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { claims } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Cases'],
      summary: 'Get case by ID',
      description: 'Returns a single case (claim) with member contact info.',
    },
  },
  async ({ params, organizationId, userId }) => {
    const id = params.caseId;

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
    if (!row) throw ApiError.notFound('Case not found');
    return row;
  },
);

// Allowed fields for PATCH — steward can update status, priority, description, etc.
const ALLOWED_PATCH_FIELDS: Record<string, keyof typeof claims.$inferInsert> = {
  status: 'status',
  priority: 'priority',
  description: 'description',
  desiredOutcome: 'desiredOutcome',
  assignedTo: 'assignedTo',
  location: 'location',
};

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Cases'],
      summary: 'Update case',
      description: 'Partially update a case (claim). Steward-only.',
    },
  },
  async ({ request, params, organizationId, userId }) => {
    const id = params.caseId;
    const body = await request.json();

    // Resolve organizationId fallback
    let orgId = organizationId;
    if (!orgId && userId) {
      const memberRows = await withRLSContext(async () => db.execute(
        sql`SELECT organization_id FROM organization_members WHERE user_id = ${userId} LIMIT 1`,
      ));
      orgId = (memberRows[0] as { organization_id?: string } | undefined)?.organization_id ?? null;
    }

    // Find the claim first
    const orgFilter = orgId
      ? sql`AND organization_id = ${orgId}::uuid`
      : sql`AND FALSE`;

    const existing = await withRLSContext(async () => db.execute(sql`
      SELECT claim_id FROM claims
      WHERE (claim_number = ${id} OR claim_id::text = ${id})
        ${orgFilter}
      LIMIT 1
    `));
    if (!existing[0]) throw ApiError.notFound('Case not found');
    const claimId = (existing[0] as { claim_id: string }).claim_id;

    // Build update object from allowed fields only
    const updates: Record<string, unknown> = {};
    for (const [key, col] of Object.entries(ALLOWED_PATCH_FIELDS)) {
      if (key in body && body[key] !== undefined) {
        updates[col] = body[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }
    // Always bump updatedAt
    updates.updatedAt = new Date();

    // If assigning, also set assignedAt
    if ('assignedTo' in updates) {
      updates.assignedAt = new Date();
    }

    await db.update(claims)
      .set(updates)
      .where(and(eq(claims.claimId, claimId)));

    return { updated: true, claimId };
  },
);
