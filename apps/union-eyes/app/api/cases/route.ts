/**
 * Cases collection route — list and create cases (claims).
 * "Cases" are claims viewed from the steward workbench perspective.
 *
 * GET  /api/cases   — List cases (member+ to see own, steward+ to see org)
 * POST /api/cases   — Create a case (steward+ only — members must submit intakes)
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { NextResponse } from 'next/server';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Cases'],
      summary: 'List cases',
      description: 'Returns cases (claims) for the authenticated org with optional filters.',
    },
  },
  async ({ request, organizationId, userId }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const priority = url.searchParams.get('priority');

    // Resolve organizationId: fall back to user's org membership
    let orgId = organizationId;
    if (!orgId && userId) {
      const memberRows = await withRLSContext(async () =>
        db.execute(
          sql`SELECT organization_id FROM organization_members WHERE user_id = ${userId} LIMIT 1`,
        ),
      );
      orgId = (memberRows[0] as { organization_id?: string } | undefined)?.organization_id ?? null;
    }

    const orgFilter = orgId
      ? sql`AND c.organization_id = ${orgId}::uuid`
      : userId
        ? sql`AND c.member_id = ${userId}`
        : sql`AND FALSE`;

    const statusFilter = status ? sql`AND c.status = ${status}` : sql``;
    const typeFilter   = type   ? sql`AND c.claim_type = ${type}` : sql``;
    const priorityFilter = priority ? sql`AND c.priority = ${priority}` : sql``;

    const rows = await withRLSContext(async () =>
      db.execute(sql`
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
               c.filed_date      AS "filedDate",
               c.created_at      AS "createdAt",
               c.updated_at      AS "updatedAt",
               c.assigned_to     AS "assignedTo",
               c.assigned_at     AS "assignedAt",
               c.ai_score        AS "aiScore",
               c.merit_confidence  AS "meritConfidence",
               c.complexity_score  AS "complexityScore",
               c.claim_amount      AS "claimAmount",
               c.resolution_outcome AS "resolutionOutcome",
               c.resolved_at       AS "resolvedAt",
               c.progress,
               m.name   AS "memberName",
               m.email  AS "memberEmail"
        FROM claims c
        LEFT JOIN organization_members m
          ON m.user_id = c.member_id
         AND m.organization_id = c.organization_id::text
        WHERE TRUE
          ${orgFilter}
          ${statusFilter}
          ${typeFilter}
          ${priorityFilter}
        ORDER BY c.created_at DESC
        LIMIT 200
      `),
    );

    return { data: Array.from(rows) };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Cases'],
      summary: 'Create a new case (steward+ only)',
      description:
        'Creates a new claim/case record. Requires steward role or above. ' +
        'Members must submit intakes via POST /api/grievances instead.',
    },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const body = await request.json();
    const {
      claimType,
      description,
      incidentDate,
      location,
      desiredOutcome,
      witnessesPresent,
      witnessDetails,
      priority = 'medium',
      isAnonymous = false,
      claimAmount,
      sourceIntakeId,
    } = body as Record<string, unknown>;

    if (!claimType || !description) {
      throw ApiError.badRequest('claimType and description are required');
    }

    const rows = await withRLSContext(async () =>
      db.execute(sql`
        INSERT INTO claims (
          organization_id, member_id, claim_type, description,
          incident_date, location, desired_outcome,
          witnesses_present, witness_details,
          priority, is_anonymous, claim_amount,
          status, filed_date
        ) VALUES (
          ${organizationId}::uuid,
          ${userId ?? ''},
          ${claimType as string},
          ${description as string},
          ${incidentDate ? new Date(incidentDate as string).toISOString() : null}::timestamptz,
          ${location as string | null},
          ${desiredOutcome as string | null},
          ${typeof witnessesPresent === 'boolean' ? witnessesPresent : false},
          ${witnessDetails as string | null},
          ${priority as string},
          ${isAnonymous as boolean},
          ${claimAmount != null ? String(claimAmount) : null},
          'submitted',
          NOW()
        )
        RETURNING claim_id AS "claimId", claim_number AS "claimNumber",
                  claim_type AS "claimType", status, priority,
                  description, filed_date AS "filedDate",
                  created_at AS "createdAt"
      `),
    );

    const inserted = rows[0];

    // Audit: log case creation with intake provenance
    await auditLog({
      eventType: AuditEventType.CASE_CREATED,
      severity: AuditSeverity.MEDIUM,
      userId: userId ?? 'unknown',
      organizationId,
      resource: 'cases',
      action: 'create_official_case',
      resourceId: (inserted as Record<string, unknown>)?.claimId as string,
      details: {
        claimType,
        priority,
        sourceIntakeId: sourceIntakeId ?? null,
      },
      outcome: 'success',
    });

    // Evidence: tamper-proof audit trail for case creation
    buildUnionEvidencePack({
      actionType: 'CASE_CREATED',
      orgId: organizationId,
      actorId: userId ?? 'unknown',
      artifacts: [{ type: 'case', data: { claimId: (inserted as Record<string, unknown>)?.claimId, claimType, priority } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'CASE_CREATED' }))

    // Audit: initial priority set on case creation
    if (priority) {
      await auditLog({
        eventType: AuditEventType.CASE_PRIORITY_SET,
        severity: AuditSeverity.LOW,
        userId: userId ?? 'unknown',
        organizationId,
        resource: 'cases',
        action: 'set_initial_priority',
        resourceId: (inserted as Record<string, unknown>)?.claimId as string,
        details: { priority },
        outcome: 'success',
      });
    }

    return NextResponse.json({ data: inserted }, { status: 201 });
  },
);
