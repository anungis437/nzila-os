/**
 * Case detail route — GET returns case with member contact info.
 * "Cases" are claims viewed from the steward workbench perspective.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { sql } from 'drizzle-orm';
import { claims } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor, findReadableCase, redactCaseRow } from '@/lib/cases/case-authorization';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

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
  async ({ params }) => {
    const id = params.caseId;

    const actor = await getCaseActor();

    const found = await withRLSContext(async (tx) => {
      const readable = await findReadableCase(tx, actor, id, false, 'case:read');
      if (!readable) return null;
      const rows = await tx.execute(sql`
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
       AND m.organization_id::text = c.organization_id::text
      WHERE c.claim_id = ${readable.claimId}::uuid AND c.organization_id = ${actor.organizationId}::uuid
      LIMIT 1
    `);
      return { row: rows[0], visibility: readable.visibility };
    });
    if (!found?.row) throw ApiError.notFound('Case not found');
    // The member sees the case they filed, not the handlers' internal assessment of it.
    return redactCaseRow(found.row, found.visibility);
  },
);

// Allowed fields for PATCH — status transitions are enforced separately via FSM.
const ALLOWED_PATCH_FIELDS: Record<string, keyof typeof claims.$inferInsert> = {
  priority: 'priority',
  description: 'description',
  desiredOutcome: 'desiredOutcome',
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
  async ({ body: parsedBody, params }) => {
    const id = params.caseId;
    const body = (parsedBody ?? {}) as Record<string, unknown>;

    const actor = await getCaseActor();
    // Assignment and status updates must use the audited, validated endpoints.
    // The workbench already uses those endpoints; generic PATCH cannot bypass them.
    if ('assignedTo' in body || 'status' in body) {
      throw ApiError.badRequest('Use the case assignment or transition endpoint for this change');
    }

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

    const claimId = await withRLSContext(async (tx) => {
      const claim = await findReadableCase(tx, actor, id, true, 'case:transition');
      if (!claim) throw ApiError.notFound('Case');
      await tx.update(claims).set(updates).where(and(eq(claims.claimId, claim.claimId), eq(claims.organizationId, actor.organizationId)));
      await persistAtomicAudit(tx, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: 'case.update',
        resourceType: 'claims',
        resourceId: claim.claimId,
        details: { fields: Object.keys(updates).filter((f) => f !== 'updatedAt') },
      });
      return claim.claimId;
    });

    return { updated: true, claimId, statusTransitioned: false };
  },
);
