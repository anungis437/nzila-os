/**
 * Pilot Onboarding API
 *
 * GET   /api/pilot/onboarding              — Fetch checklist state
 * PATCH /api/pilot/onboarding/checklist     — Toggle checklist item
 */

import { z } from "zod";
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
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { pilotChecklistItems } from "@/db/schema/domains/pilot/pilot-onboarding";
import { pilotDemoSeeds } from "@/db/schema/domains/pilot/pilot-demo-seeds";
import { getDemoDatasetSummary } from "@/lib/pilot/cape-demo-data";
import { eq, and } from "drizzle-orm";

const CHECKLIST_ITEM_IDS = [
  "org-seeded",
  "users-invited",
  "roles-assigned",
  "contracts-uploaded",
  "employers-imported",
  "integrations-configured",
  "export-verified",
] as const;

// ── GET ─────────────────────────────────────────────────────────────────────

export const GET = withOrganizationAuth(async (_request, context) => {
  const { organizationId } = context;

  try {
    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    const rows = await db
      .select()
      .from(pilotChecklistItems)
      .where(eq(pilotChecklistItems.organizationId, organizationId));

    const demoSeedRows = await db
      .select()
      .from(pilotDemoSeeds)
      .where(eq(pilotDemoSeeds.organizationId, organizationId))
      .limit(1);

    // Build items map — fill in defaults for any missing items
    const items: Record<string, boolean> = {};
    const rowMap = new Map(rows.map((r) => [r.itemId, r.completed]));
    for (const itemId of CHECKLIST_ITEM_IDS) {
      items[itemId] = rowMap.get(itemId) ?? false;
    }

    const completedCount = Object.values(items).filter(Boolean).length;
    const totalCount = CHECKLIST_ITEM_IDS.length;
    const demoSeed = demoSeedRows[0];
    const demoDefaults = getDemoDatasetSummary(organizationId);
    const demoIsActive = Boolean(demoSeed && !demoSeed.purgedAt);

    return standardSuccessResponse({
      items,
      completedCount,
      totalCount,
      isComplete: completedCount === totalCount,
      demo: {
        isActive: demoIsActive,
        dataset: demoIsActive
          ? {
              members: demoSeed?.memberCount ?? demoDefaults.members,
              employers: demoSeed?.employerCount ?? demoDefaults.employers,
              grievances: demoSeed?.grievanceCount ?? demoDefaults.grievances,
              timelines: demoDefaults.timelines,
              resolutions: demoDefaults.resolutions,
            }
          : undefined,
        telemetryTag: demoIsActive ? 'demo_mode_active' : 'demo_mode_inactive',
      },
    });
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to load onboarding checklist"
    );
  }
});

// ── PATCH — Toggle a checklist item ─────────────────────────────────────────

const toggleSchema = z.object({
  itemId: z.string().min(1),
  completed: z.boolean(),
});

export const PATCH = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;

  try {
    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    const body = await request.json();
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Invalid input",
        parsed.error.flatten()
      );
    }

    const { itemId, completed } = parsed.data;

    if (!CHECKLIST_ITEM_IDS.includes(itemId as (typeof CHECKLIST_ITEM_IDS)[number])) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Checklist item not found");
    }

    // Upsert: insert the row if it doesn't exist, update if it does
    const existing = await db
      .select()
      .from(pilotChecklistItems)
      .where(
        and(
          eq(pilotChecklistItems.organizationId, organizationId),
          eq(pilotChecklistItems.itemId, itemId),
        ),
      );

    await withRLSContext(async () => {
      if (existing.length === 0) {
        await db.insert(pilotChecklistItems).values({
          organizationId,
          itemId,
          completed,
          completedAt: completed ? new Date() : null,
          completedBy: completed ? userId : null,
        });
      } else {
        await db
          .update(pilotChecklistItems)
          .set({
            completed,
            completedAt: completed ? new Date() : null,
            completedBy: completed ? userId : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(pilotChecklistItems.organizationId, organizationId),
              eq(pilotChecklistItems.itemId, itemId),
            ),
          );
      }
    });

    // Re-read full checklist for response
    const rows = await db
      .select()
      .from(pilotChecklistItems)
      .where(eq(pilotChecklistItems.organizationId, organizationId));

    const items: Record<string, boolean> = {};
    const rowMap = new Map(rows.map((r) => [r.itemId, r.completed]));
    for (const id of CHECKLIST_ITEM_IDS) {
      items[id] = rowMap.get(id) ?? false;
    }

    const completedCount = Object.values(items).filter(Boolean).length;
    const totalCount = CHECKLIST_ITEM_IDS.length;
    const isComplete = completedCount === totalCount;

    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.PILOT_CHECKLIST_ITEM_COMPLETED,
      userId,
      organizationId,
      resource: "pilot_checklist",
      details: { itemId, completed },
    });

    if (isComplete) {
      await emitCapeAuditEvent({
        eventType: CAPE_AUDIT_EVENTS.PILOT_CHECKLIST_COMPLETED,
        userId,
        organizationId,
        resource: "pilot_checklist",
      });
    }

    return standardSuccessResponse({
      items,
      completedCount,
      totalCount,
      isComplete,
    });
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to update checklist"
    );
  }
});
