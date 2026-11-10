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
import { eq, and, isNull, isNotNull, inArray } from "drizzle-orm";
import { randomUUID } from 'node:crypto';

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

      // The exact ids this seed is about to insert (generateDemoEmployers/generateDemoGrievances assign id
      // client-side), so the purge can later delete precisely these rows instead of matching on name/email pattern.
      const employerIds = demoEmployers.map((e) => e.id);
      const grievanceIds = demoGrievances.map((g) => g.id);
      const seedId = existing[0]?.id ?? randomUUID();

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
          id: seedId,
          organizationId,
          seededBy: userId,
          employerCount: summary.employers,
          grievanceCount: summary.grievances,
          employerIds,
          grievanceIds,
        });
      }

      if (demoEmployers.length > 0) {
        await tx.insert(employers).values(demoEmployers.map((row) => ({ ...row, demoSeedId: seedId })));
      }
      if (demoGrievances.length > 0) {
        await tx.insert(grievances).values(demoGrievances.map((row) => ({ ...row, demoSeedId: seedId })));
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
    let legacyRefusal = false;
    try {
      await withRLSContext({ organizationId }, async (tx) => {
        // Row ownership is verified before any mutation. employerIds/grievanceIds are set once, at seed time, and
        // never updated afterward (see POST above), so reading them here ahead of the close/delete is race-free: no
        // concurrent request can change what this seed owns between this read and the delete below.
        const [existing] = await tx
          .select({ id: pilotDemoSeeds.id, employerIds: pilotDemoSeeds.employerIds, grievanceIds: pilotDemoSeeds.grievanceIds })
          .from(pilotDemoSeeds)
          .where(and(eq(pilotDemoSeeds.organizationId, organizationId), isNull(pilotDemoSeeds.purgedAt)));
        if (!existing) throw new DemoSeedConflict();

        // A marker seeded before employer_ids/grievance_ids existed has no proven ownership record: there is no
        // name/email pattern fallback here. Deleting by a GRV-DEMO-/lr-demo@ pattern could destroy a real grievance
        // or employer that happens to match it. The purge is refused outright; the marker stays open (not purged)
        // for controlled, manual reconciliation instead.
        if (existing.employerIds === null || existing.grievanceIds === null) {
          legacyRefusal = true;
          return;
        }

        const closed = await tx
          .update(pilotDemoSeeds)
          .set({ purgedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(pilotDemoSeeds.organizationId, organizationId), isNull(pilotDemoSeeds.purgedAt)))
          .returning({ id: pilotDemoSeeds.id });
        if (closed.length === 0) throw new DemoSeedConflict();

        // A verified id list with zero entries means this seed created none of that category: nothing is deleted
        // for it, not a pattern match. A nonempty list deletes exactly those rows, never anything else.
        const { employerIds, grievanceIds } = existing;

        if (grievanceIds.length > 0) {
          await tx
            .delete(grievances)
            .where(and(eq(grievances.organizationId, organizationId), eq(grievances.demoSeedId, existing.id), inArray(grievances.id, grievanceIds)));
        }
        if (employerIds.length > 0) {
          await tx
            .delete(employers)
            .where(and(eq(employers.organizationId, organizationId), eq(employers.demoSeedId, existing.id), inArray(employers.id, employerIds)));
        }

        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: CAPE_AUDIT_EVENTS.PILOT_DEMO_DATA_PURGED,
          resourceType: 'pilot_demo_seeds',
          resourceId: closed[0].id,
          // The audit records exactly which ids were deleted, not just that a purge happened.
          details: { runtimeMode, telemetryTag: 'demo_mode_mutation', deletedEmployerIds: employerIds, deletedGrievanceIds: grievanceIds },
        });
      });
      purged = !legacyRefusal;
    } catch (error) {
      if (!(error instanceof DemoSeedConflict)) throw error;
    }

    if (legacyRefusal) {
      return standardErrorResponse(
        ErrorCode.CONFLICT,
        "This demo seed predates per-row ownership tracking and cannot be purged automatically without risking unrelated real records; it requires controlled manual reconciliation.",
      );
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
