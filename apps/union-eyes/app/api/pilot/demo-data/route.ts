/**
 * Pilot Demo-Data API
 *
 * POST   /api/pilot/demo-data — Seed demo data for the org
 * DELETE /api/pilot/demo-data — Purge demo data for the org
 */

import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import {
  emitCapeAuditEvent,
  CAPE_AUDIT_EVENTS,
} from "@/lib/audit/cape-audit-events";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import {
  generateDemoEmployers,
  generateDemoGrievances,
  getDemoDatasetSummary,
} from "@/lib/pilot/cape-demo-data";
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { pilotDemoSeeds } from "@/db/schema/domains/pilot/pilot-demo-seeds";
import { employers } from "@/db/schema/domains/compliance/employer-compliance";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { eq, and, like } from "drizzle-orm";

// ── POST — Seed demo data ───────────────────────────────────────────────────

export const POST = withOrganizationAuth(async (_request, context) => {
  const { organizationId, userId } = context;

  try {
    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    // Check if already seeded (and not purged)
    const existing = await db
      .select()
      .from(pilotDemoSeeds)
      .where(eq(pilotDemoSeeds.organizationId, organizationId));

    if (existing.length > 0 && !existing[0].purgedAt) {
      return standardErrorResponse(
        ErrorCode.CONFLICT,
        "Demo data already seeded for this organization"
      );
    }

    // Generate demo rows
    const demoEmployers = generateDemoEmployers(organizationId);
    const demoGrievances = generateDemoGrievances(organizationId);

    await withRLSContext(async () => {
      // Insert employers
      if (demoEmployers.length > 0) {
        await db.insert(employers).values(demoEmployers);
      }

      // Insert grievances
      if (demoGrievances.length > 0) {
        await db.insert(grievances).values(demoGrievances);
      }
    });

    const summary = getDemoDatasetSummary(organizationId);

    // Record the seed event
    await withRLSContext(async () => {
      if (existing.length > 0) {
        // Re-seed after a purge
        await db
          .update(pilotDemoSeeds)
          .set({
            seededBy: userId,
            seededAt: new Date(),
            purgedAt: null,
            employerCount: summary.employers,
            grievanceCount: summary.grievances,
            updatedAt: new Date(),
          })
          .where(eq(pilotDemoSeeds.organizationId, organizationId));
      } else {
        await db.insert(pilotDemoSeeds).values({
          organizationId,
          seededBy: userId,
          employerCount: summary.employers,
          grievanceCount: summary.grievances,
        });
      }
    });

    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.PILOT_DEMO_DATA_SEEDED,
      userId,
      organizationId,
      resource: "pilot_demo_data",
      details: summary,
    });

    return standardSuccessResponse({
      seeded: true,
      ...summary,
    });
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to seed demo data"
    );
  }
});

// ── DELETE — Purge demo data ────────────────────────────────────────────────

export const DELETE = withOrganizationAuth(async (_request, context) => {
  const { organizationId, userId } = context;

  try {
    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    const existing = await db
      .select()
      .from(pilotDemoSeeds)
      .where(eq(pilotDemoSeeds.organizationId, organizationId));

    if (existing.length === 0 || existing[0].purgedAt) {
      return standardErrorResponse(
        ErrorCode.NOT_FOUND,
        "No demo data to purge"
      );
    }

    // Purge demo data within RLS context
    await withRLSContext(async () => {
      // Delete demo grievances (identified by GRV-DEMO-* number)
      await db
        .delete(grievances)
        .where(
          and(
            eq(grievances.organizationId, organizationId),
            like(grievances.grievanceNumber, "GRV-DEMO-%"),
          ),
        );

      // Delete demo employers (identified by demo contact emails)
      await db
        .delete(employers)
        .where(
          and(
            eq(employers.orgId, organizationId),
            like(employers.contactEmail, "lr-demo@%"),
          ),
        );

      // Mark as purged
      await db
        .update(pilotDemoSeeds)
        .set({ purgedAt: new Date(), updatedAt: new Date() })
        .where(eq(pilotDemoSeeds.organizationId, organizationId));
    });

    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.PILOT_DEMO_DATA_PURGED,
      userId,
      organizationId,
      resource: "pilot_demo_data",
    });

    return standardSuccessResponse({ purged: true });
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to purge demo data"
    );
  }
});
