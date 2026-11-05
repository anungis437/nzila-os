/**
 * Pilot Onboarding API
 *
 * GET   /api/pilot/onboarding              — Fetch checklist state
 * PATCH /api/pilot/onboarding/checklist     — Toggle checklist item
 */

import { z } from "zod";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { CAPE_AUDIT_EVENTS } from "@/lib/audit/cape-audit-events";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
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
import { CHECKLIST_ITEM_IDS, verifyChecklistStep, type ChecklistItemId } from "@/lib/pilot/onboarding-checklist-evidence";
import { eq } from "drizzle-orm";

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

    if (!CHECKLIST_ITEM_IDS.includes(itemId as ChecklistItemId)) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Checklist item not found");
    }

    // The toggle, the completeness it implies and the audit records commit together; a failed audit rolls the toggle back.
    // A step is marked done only when the organization's own data shows it happened (see onboarding-checklist-evidence).
    const state = await withRLSContext({ organizationId }, async (tx) => {
      let evidence: Record<string, number | boolean> | undefined;
      if (completed) {
        const check = await verifyChecklistStep(tx, organizationId, userId, itemId as ChecklistItemId);
        if (!check.ok) return { missing: check.missing };
        evidence = check.evidence;
      }
      const changedAt = new Date();
      const [saved] = await tx
        .insert(pilotChecklistItems)
        .values({
          organizationId,
          itemId,
          completed,
          completedAt: completed ? changedAt : null,
          completedBy: completed ? userId : null,
        })
        .onConflictDoUpdate({
          target: [pilotChecklistItems.organizationId, pilotChecklistItems.itemId],
          set: {
            completed,
            completedAt: completed ? changedAt : null,
            completedBy: completed ? userId : null,
            updatedAt: changedAt,
          },
        })
        .returning({ id: pilotChecklistItems.id });

      const rows = await tx
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

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: completed ? CAPE_AUDIT_EVENTS.PILOT_CHECKLIST_ITEM_COMPLETED : 'pilot.checklist_item_reopened',
        resourceType: 'pilot_checklist_items',
        resourceId: saved?.id,
        details: { itemId, completed, checklistComplete: isComplete, ...(evidence ? { evidence } : {}) },
      });

      if (isComplete && completed) {
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: CAPE_AUDIT_EVENTS.PILOT_CHECKLIST_COMPLETED,
          resourceType: 'pilot_checklist_items',
          resourceId: saved?.id,
          details: { completedCount, totalCount },
        });
      }

      return { items, completedCount, totalCount, isComplete };
    });

    if ("missing" in state) {
      return standardErrorResponse(
        ErrorCode.CONFLICT,
        `This step cannot be marked complete: the system found no ${state.missing}.`,
      );
    }

    return standardSuccessResponse(state);
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to update checklist"
    );
  }
});
