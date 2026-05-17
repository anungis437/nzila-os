/**
 * Grievances API — Intakes & Cases
 *
 * POST /api/grievances     — Submit an intake (member+) or create an official case (steward+)
 * GET  /api/grievances     — List grievances for the org (steward+)
 */

import { NextResponse as _NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances, GrievanceStatus } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation, auditLog, AuditEventType } from "@/lib/audit-logger";
import { emitCapeAuditEvent, CAPE_AUDIT_EVENTS } from "@/lib/audit/cape-audit-events";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, desc, inArray, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import { recordUsage } from '@/services/platform-economics';
import { randomBytes } from 'crypto';

// ── Validation ──────────────────────────────────────────────────────────────

const createGrievanceSchema = z.object({
  type: z.enum([
    "individual", "group", "policy", "contract", "harassment",
    "discrimination", "safety", "seniority", "discipline", "termination", "other",
  ]),
  title: z.string().min(5).max(500),
  description: z.string().min(10),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  employerId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  category: z.string().optional(),

  // Member details (from intake form)
  grievantName: z.string().max(255).optional(),
  grievantEmail: z.string().email().max(255).optional(),
  memberPhone: z.string().max(50).optional(),
  memberNumber: z.string().max(100).optional(),
  localChapter: z.string().max(255).optional(),

  // Employer / workplace details
  employerName: z.string().max(255).optional(),
  workplaceName: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  branch: z.string().max(255).optional(),
  supervisorName: z.string().max(255).optional(),
  incidentLocation: z.string().max(500).optional(),

  // CBA reference
  cbaArticle: z.string().max(100).optional(),
  cbaSection: z.string().max(100).optional(),

  // Dates
  incidentDate: z.string().datetime({ offset: true }).optional()
    .or(z.string().date().optional()),

  // Desired outcome
  desiredOutcome: z.string().optional(),

  // Sensitivity flags
  workplaceSafetyFlag: z.boolean().optional(),
  harassmentFlag: z.boolean().optional(),
  discriminationFlag: z.boolean().optional(),
  accommodationFlag: z.boolean().optional(),

  /**
   * If true, the caller is a steward+ creating an official case directly.
   * If false/absent, this is a member intake submission — no official case
   * is created until a rep converts it.
   */
  createOfficialCase: z.boolean().optional(),
  sourceIntakeId: z.string().uuid().optional(),
});

// ── POST ────────────────────────────────────────────────────────────────────

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    const body = await request.json();
    const parsed = createGrievanceSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    const data = parsed.data;
    const isOfficialCase = data.createOfficialCase === true;

    // ── Authority gate ──────────────────────────────────────
    // Only steward+ can create official cases.
    // Members can only submit intakes (status = "draft").
    if (isOfficialCase) {
      const isSteward = await hasMinRole("steward");
      if (!isSteward) {
        await auditLog({
          eventType: AuditEventType.AUTHORITY_VIOLATION,
          userId,
          organizationId,
          resource: "grievances",
          action: "create_official_case",
          details: { reason: "Member attempted to create official case" },
        });
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          "Only a steward or LRO can create an official case. Submit an intake instead.",
        );
      }
    }

    const initialStatus = isOfficialCase ? "filed" : "draft";

    const grievance = await withRLSContext(async () => {
      // Collision-safe grievance number: timestamp + 6-char random hex
      const grievanceNumber = `GRV-${Date.now()}-${randomBytes(3).toString('hex')}`;

      // Derive boolean flags from the grievance type / sensitivity flags
      const isGroupGrievance = data.type === "group";
      const isConfidential = !!(data.harassmentFlag || data.discriminationFlag);

      const [g] = await db
        .insert(grievances)
        .values({
          grievanceNumber,
          type: data.type,
          title: data.title,
          description: data.description,
          priority: isOfficialCase ? (data.priority ?? "medium") : "low",
          status: initialStatus,
          employerId: data.employerId ?? null,
          cbaId: data.contractId ?? null,
          organizationId,
          createdBy: userId,
          filedDate: isOfficialCase ? new Date() : null,

          // Member details
          grievantName: data.grievantName ?? null,
          grievantEmail: data.grievantEmail ?? null,

          // Employer / workplace details
          employerName: data.employerName ?? null,
          workplaceName: data.workplaceName ?? null,

          // CBA reference
          cbaArticle: data.cbaArticle ?? null,
          cbaSection: data.cbaSection ?? null,

          // Dates
          incidentDate: data.incidentDate ? new Date(data.incidentDate) : null,

          // Outcome
          desiredOutcome: data.desiredOutcome ?? null,

          // Derived flags
          isGroupGrievance,
          isConfidential,
        })
        .returning();

      // Emit lifecycle event
      const eventType = isOfficialCase ? "created" : "intake_submitted";
      const notes = isOfficialCase
        ? `Official case created: ${data.title}`
        : `Intake submitted by member: ${data.title}`;

      await db.insert(grievanceEvents).values({
        grievanceId: g.id,
        eventType,
        actorUserId: userId,
        notes,
      });

      return g;
    });

    // Audit
    const auditEventType = isOfficialCase
      ? AuditEventType.CASE_CREATED
      : AuditEventType.INTAKE_SUBMITTED;
    await auditDataMutation({
      userId,
      organizationId,
      resource: "grievances",
      action: 'create',
      resourceId: grievance.id,
      newState: grievance,
    });
    await auditLog({
      eventType: auditEventType,
      userId,
      organizationId,
      resource: "grievances",
      action: isOfficialCase ? "create_official_case" : "submit_intake",
      resourceId: grievance.id,
      details: {
        grievanceNumber: grievance.grievanceNumber,
        type: data.type,
        sourceIntakeId: data.sourceIntakeId,
      },
    });

    // CAPE audit event
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.GRIEVANCE_SUBMITTED,
      userId,
      organizationId,
      resource: "grievances",
      resourceId: grievance.id,
      details: { grievanceNumber: grievance.grievanceNumber, type: data.type },
    });

    // Audit: initial priority assignment on official case
    if (isOfficialCase && grievance.priority) {
      await auditLog({
        eventType: AuditEventType.CASE_PRIORITY_SET,
        userId,
        organizationId,
        resource: "grievances",
        action: "set_initial_priority",
        resourceId: grievance.id,
        details: { priority: grievance.priority },
      });
    }

    // Evidence: tamper-proof filing trail
    buildUnionEvidencePack({
      actionType: isOfficialCase ? 'GRIEVANCE_FILED' : 'INTAKE_SUBMITTED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance', data: { grievanceId: grievance.id, grievanceNumber: grievance.grievanceNumber, type: data.type } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: isOfficialCase ? 'GRIEVANCE_FILED' : 'INTAKE_SUBMITTED' }))

    if (isOfficialCase) {
      await trackPilotEvent({
        userId,
        organizationId,
        sessionId: `server:${grievance.id}`,
        eventType: 'case_created',
        metadata: {
          grievanceId: grievance.id,
          grievanceNumber: grievance.grievanceNumber,
          source: 'grievances_api',
        },
      });

      await trackPilotEvent({
        userId,
        organizationId,
        sessionId: `server:${grievance.id}`,
        eventType: 'active_user',
        metadata: {
          action: 'case_created',
          source: 'grievances_api',
        },
      });

      await recordUsage({
        meterCode: 'case_created',
        organizationId,
        userId,
        quantity: 1,
        idempotencyKey: `usage:case_created:${grievance.id}`,
        metadata: { grievanceId: grievance.id, source: 'grievances_api' },
      }).catch((err) => logger.warn('Usage meter write skipped', { error: String(err), meterCode: 'case_created' }));
    }

    return standardSuccessResponse(grievance);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to create grievance");
  }
});

// ── GET ─────────────────────────────────────────────────────────────────────

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    const canAccess = await hasMinRole("steward");
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires steward role or above");
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const ACTIVE_STATUSES = ['filed', 'acknowledged', 'investigating', 'response_due', 'response_received', 'escalated', 'mediation', 'arbitration'] as const;
    const INTAKE_STATUSES = ['draft'] as const;

    // Push status filter to DB layer to avoid loading unbounded result sets into memory.
    // Safety limit of 500: steward workbenches don't need more; paginate at API level if needed.
    let scopedFilter;
    if (status === 'active') {
      scopedFilter = and(eq(grievances.organizationId, organizationId), inArray(grievances.status, ACTIVE_STATUSES));
    } else if (status === 'intakes') {
      scopedFilter = and(eq(grievances.organizationId, organizationId), inArray(grievances.status, INTAKE_STATUSES));
    } else if (status) {
      scopedFilter = and(eq(grievances.organizationId, organizationId), eq(grievances.status, status as GrievanceStatus));
    } else {
      scopedFilter = eq(grievances.organizationId, organizationId);
    }

    const filtered = await db
      .select()
      .from(grievances)
      .where(scopedFilter)
      .orderBy(desc(grievances.createdAt))
      .limit(500);

    return standardSuccessResponse(filtered);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to list grievances");
  }
});
