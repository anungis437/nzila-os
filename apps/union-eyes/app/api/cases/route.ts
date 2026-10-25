/**
 * Cases collection route — list and create cases (claims).
 * "Cases" are claims viewed from the steward workbench perspective.
 *
 * GET  /api/cases   — List cases (member+ to see own, steward+ to see org)
 * POST /api/cases   — Create a case (steward+ only — members must submit intakes)
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { NextResponse } from 'next/server';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { recordUnionEyesCaseCreated } from '@/lib/pilot-metrics';
import { z } from 'zod';
import { getCaseActor, caseReadScope, caseTriageQueueScope, requireCaseFilingCapacity } from '@/lib/cases/case-authorization';

const caseCreateSchema = z.object({
  claimType: z.enum([
    "grievance_discipline", "grievance_schedule", "grievance_pay",
    "workplace_safety", "discrimination_age", "discrimination_gender",
    "discrimination_race", "discrimination_disability", "discrimination_other",
    "harassment_sexual", "harassment_workplace", "wage_dispute",
    "contract_dispute", "retaliation", "wrongful_termination", "other",
    "harassment_verbal", "harassment_physical",
  ]),
  description: z.string().min(10, 'Description must be at least 10 characters').max(10000),
  incidentDate: z.string().datetime({ offset: true }).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  desiredOutcome: z.string().max(5000).optional().nullable(),
  witnessesPresent: z.boolean().optional().default(false),
  witnessDetails: z.string().max(5000).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
  isAnonymous: z.boolean().optional().default(false),
  claimAmount: z.union([z.string(), z.number()]).optional().nullable(),
  sourceIntakeId: z.string().uuid().optional().nullable(),
});

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
  async ({ request }) => {
    const actor = await getCaseActor();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const priority = url.searchParams.get('priority');

    const orgFilter = sql`AND ${caseReadScope(actor, 'c')}`;

    const statusFilter = status ? sql`AND c.status = ${status}` : sql``;
    const typeFilter   = type   ? sql`AND c.claim_type = ${type}` : sql``;
    const priorityFilter = priority ? sql`AND c.priority = ${priority}` : sql``;

    const rows = await withRLSContext(async (tx) =>
      tx.execute(sql`
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
         AND m.organization_id::text = c.organization_id::text
        WHERE TRUE
          ${orgFilter}
          ${statusFilter}
          ${typeFilter}
          ${priorityFilter}
        ORDER BY c.created_at DESC
        LIMIT 200
      `),
    );

    // A live `cases` triage designation adds the unassigned queue as metadata only (never the description, analysis,
    // evidence or amounts), and only for cases the caller cannot already read in full.
    const queue = await withRLSContext(async (tx) =>
      tx.execute(sql`
        SELECT c.claim_id AS "claimId", c.claim_number AS "claimNumber", c.claim_type AS "claimType", c.status, c.priority,
               c.created_at AS "createdAt", c.filed_date AS "filedDate", true AS "triageOnly"
        FROM claims c
        WHERE ${caseTriageQueueScope(actor, 'c')}
          ${statusFilter} ${typeFilter} ${priorityFilter}
        ORDER BY c.created_at DESC
        LIMIT 200
      `),
    );
    const full = Array.from(rows) as Array<{ claimId: string }>;
    const seen = new Set(full.map((r) => r.claimId));
    return { data: [...full, ...(Array.from(queue) as Array<{ claimId: string }>).filter((r) => !seen.has(r.claimId))] };
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
    const parsed = caseCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.errors.map(e => e.message).join('; '));
    }
    const {
      claimType,
      description,
      incidentDate,
      location,
      desiredOutcome,
      witnessesPresent,
      witnessDetails,
      priority,
      isAnonymous,
      claimAmount,
      sourceIntakeId,
    } = parsed.data;

    const rows = await withRLSContext(async (tx) => {
      // Opening a case is a capacity (staff), checked on the canonical membership, not a role rank.
      await requireCaseFilingCapacity(tx, { userId: userId!, organizationId }, 'handler');
      const result = await tx.execute(sql`
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
      `);
      const created = result[0] as Record<string, unknown> | undefined;
      // The audit record shares this transaction in every deployment mode: an audit failure rolls the case back.
      await persistAtomicAudit(tx, {
        organizationId,
        action: 'claim.create',
        resourceType: 'claims',
        resourceId: created?.claimId as string | undefined,
        userId,
        details: {
          route: '/api/cases',
          claimType,
          priority,
          claimNumber: created?.claimNumber ?? null,
          sourceIntakeId: sourceIntakeId ?? null,
        },
      });
      return result;
    });

    const inserted = rows[0];

    // Evidence: tamper-proof audit trail for case creation
    buildUnionEvidencePack({
      actionType: 'CASE_CREATED',
      orgId: organizationId,
      actorId: userId ?? 'unknown',
      artifacts: [{ type: 'case', data: { claimId: (inserted as Record<string, unknown>)?.claimId, claimType, priority } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'CASE_CREATED' }))

    const createdClaimId = (inserted as Record<string, unknown>)?.claimId as string | undefined;
    const traceId = request.headers.get('x-trace-id') ?? crypto.randomUUID();
    if (createdClaimId) {
      recordUnionEyesCaseCreated(organizationId, createdClaimId, userId ?? 'system:ue-case-create', traceId).catch((err) =>
        logger.warn('Pilot metric emit failed', { error: String(err), metric: 'cases_created' }),
      );
    }

    return NextResponse.json({ data: inserted }, { status: 201 });
  },
);
