/**
 * Pilot Demo-Data API
 *
 * POST   /api/pilot/demo-data — Seed demo data for the org
 * DELETE /api/pilot/demo-data — Purge demo data for the org
 */

import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { CAPE_AUDIT_EVENTS } from "@/lib/audit/cape-audit-events";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
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
import { assertPilotDemoMutationRuntime } from "@/lib/config/pilot-demo-runtime";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { pilotDemoSeeds } from "@/db/schema/domains/pilot/pilot-demo-seeds";
import { employers } from "@/db/schema/union-structure-schema";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { eq, and, like, isNull, isNotNull, inArray } from "drizzle-orm";

// Thrown inside the seed transaction so a lost race rolls back the rows it had already inserted.
class DemoSeedConflict extends Error {}

function requireDemoRuntimeMode() {
  try {
    const runtimeMode = assertPilotDemoMutationRuntime();
    return { runtimeMode, failure: null };
  } catch (error) {
    return {
      runtimeMode: null,
      failure: standardErrorResponse(
        ErrorCode.FORBIDDEN,
        error instanceof Error
          ? error.message
          : "Demo data operations are disabled unless NZILA_MODE is set to pilot or demo",
        {
          runtimeMode: process.env.NZILA_MODE ?? null,
          requiredModes: ["pilot", "demo"],
        },
      ),
    };
  }
}

// ── POST — Seed demo data ───────────────────────────────────────────────────

export const POST = withOrganizationAuth(async (_request, context) => {
  const { organizationId, userId } = context;

  try {
    const { runtimeMode, failure } = requireDemoRuntimeMode();
    if (failure) {
      return failure;
    }

    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    // Generate demo rows
    const demoEmployers = generateDemoEmployers(organizationId);
    const demoGrievances = generateDemoGrievances(organizationId);
    const summary = getDemoDatasetSummary(organizationId);

    // The seeded rows, the seed marker and the audit record commit together; the already-seeded check is made
    // inside the same transaction so two concurrent seeds cannot both pass it.
    let seeded: boolean;
    try {
      seeded = await withRLSContext({ organizationId }, async (tx) => {
      const existing = await tx
        .select()
        .from(pilotDemoSeeds)
        .where(eq(pilotDemoSeeds.organizationId, organizationId));

      if (existing.length > 0 && !existing[0].purgedAt) return false;

      if (demoEmployers.length > 0) {
        await tx.insert(employers).values(demoEmployers);
      }
      if (demoGrievances.length > 0) {
        await tx.insert(grievances).values(demoGrievances);
      }

      // The exact ids this seed is about to insert (generateDemoEmployers/generateDemoGrievances assign id
      // client-side), so the purge can later delete precisely these rows instead of matching on name/email pattern.
      const employerIds = demoEmployers.map((e) => e.id);
      const grievanceIds = demoGrievances.map((g) => g.id);

      if (existing.length > 0) {
        // Re-seed after a purge: only a purged marker may be reopened.
        const reopened = await tx
          .update(pilotDemoSeeds)
          .set({
            seededBy: userId,
            seededAt: new Date(),
            purgedAt: null,
            employerCount: summary.employers,
            grievanceCount: summary.grievances,
            employerIds,
            grievanceIds,
            updatedAt: new Date(),
          })
          .where(and(eq(pilotDemoSeeds.organizationId, organizationId), isNotNull(pilotDemoSeeds.purgedAt)))
          .returning({ id: pilotDemoSeeds.id });
        if (reopened.length === 0) throw new DemoSeedConflict();
      } else {
        await tx.insert(pilotDemoSeeds).values({
          organizationId,
          seededBy: userId,
          employerCount: summary.employers,
          grievanceCount: summary.grievances,
          employerIds,
          grievanceIds,
        });
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: CAPE_AUDIT_EVENTS.PILOT_DEMO_DATA_SEEDED,
        resourceType: 'pilot_demo_seeds',
        details: { ...summary, runtimeMode, telemetryTag: 'demo_mode_mutation' },
      });
      return true;
      });
    } catch (error) {
      if (!(error instanceof DemoSeedConflict)) throw error;
      seeded = false;
    }

    if (!seeded) {
      return standardErrorResponse(
        ErrorCode.CONFLICT,
        "Demo data already seeded for this organization"
      );
    }

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
    const { runtimeMode, failure } = requireDemoRuntimeMode();
    if (failure) {
      return failure;
    }

    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    // The purge, the marker and the audit record commit together. The marker is closed first and only if it was open,
    // so a concurrent purge or a missing seed deletes nothing.
    let purged = false;
    try {
      await withRLSContext({ organizationId }, async (tx) => {
        const closed = await tx
          .update(pilotDemoSeeds)
          .set({ purgedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(pilotDemoSeeds.organizationId, organizationId), isNull(pilotDemoSeeds.purgedAt)))
          .returning({ id: pilotDemoSeeds.id, employerIds: pilotDemoSeeds.employerIds, grievanceIds: pilotDemoSeeds.grievanceIds });
        if (closed.length === 0) throw new DemoSeedConflict();

        // Delete exactly the rows this seed created. Rows seeded before employer_ids/grievance_ids existed have
        // those columns null; only for those legacy markers does the purge fall back to the prior name/email
        // pattern match, so already-seeded pilot orgs are not stranded with undeletable demo data.
        const { employerIds, grievanceIds } = closed[0];

        await tx
          .delete(grievances)
          .where(
            grievanceIds && grievanceIds.length > 0
              ? and(eq(grievances.organizationId, organizationId), inArray(grievances.id, grievanceIds))
              : and(eq(grievances.organizationId, organizationId), like(grievances.grievanceNumber, "GRV-DEMO-%")),
          );

        await tx
          .delete(employers)
          .where(
            employerIds && employerIds.length > 0
              ? and(eq(employers.organizationId, organizationId), inArray(employers.id, employerIds))
              : and(eq(employers.organizationId, organizationId), like(employers.email, "lr-demo@%")),
          );

        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: CAPE_AUDIT_EVENTS.PILOT_DEMO_DATA_PURGED,
          resourceType: 'pilot_demo_seeds',
          resourceId: closed[0].id,
          details: { runtimeMode, telemetryTag: 'demo_mode_mutation' },
        });
      });
      purged = true;
    } catch (error) {
      if (!(error instanceof DemoSeedConflict)) throw error;
    }

    if (!purged) {
      return standardErrorResponse(
        ErrorCode.NOT_FOUND,
        "No demo data to purge"
      );
    }

    return standardSuccessResponse({ purged: true });
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to purge demo data"
    );
  }
});
