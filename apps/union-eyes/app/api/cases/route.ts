/**
 * Cases collection route — list and create cases (claims).
 * "Cases" are claims viewed from the steward workbench perspective.
 *
 * GET  /api/cases
 * POST /api/cases
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { claims } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { NextResponse } from 'next/server';

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
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Cases'],
      summary: 'Create a new case',
      description: 'Creates a new claim/case record.',
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
    } = body as Record<string, unknown>;

    if (!claimType || !description) {
      throw ApiError.badRequest('claimType and description are required');
    }

    const [inserted] = await db
      .insert(claims)
      .values({
        organizationId,
        memberId: userId ?? '',
        claimType: claimType as string,
        description: description as string,
        incidentDate: incidentDate ? new Date(incidentDate as string) : undefined,
        location: location as string | undefined,
        desiredOutcome: desiredOutcome as string | undefined,
        witnessesPresent: typeof witnessesPresent === 'boolean' ? witnessesPresent : false,
        witnessDetails: witnessDetails as string | undefined,
        priority: priority as string,
        isAnonymous: isAnonymous as boolean,
        claimAmount: claimAmount != null ? String(claimAmount) : undefined,
        status: 'draft',
        filedDate: new Date(),
      })
      .returning();

    return NextResponse.json({ data: inserted }, { status: 201 });
  },
);
