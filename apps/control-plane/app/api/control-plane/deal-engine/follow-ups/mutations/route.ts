import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { getFollowUpAdapter } from "@/server/adapters";
import { emitDealEvent, DEAL_ENGINE_EVENTS } from "@/server/adapters";
import { recordDealAudit } from "@/server/adapters";
import { followUpPrioritySchema } from "@nzila/deal-engine/types";

export const dynamic = "force-dynamic";

const completeMutationSchema = z.object({
  action: z.literal("complete"),
  followUpId: z.string().min(1),
  actor: z.string().min(1),
});

const snoozeMutationSchema = z.object({
  action: z.literal("snooze"),
  followUpId: z.string().min(1),
  actor: z.string().min(1),
  newDueDate: z.string().datetime({ offset: true }),
});

const reassignMutationSchema = z.object({
  action: z.literal("reassign"),
  followUpId: z.string().min(1),
  actor: z.string().min(1),
  newOwner: z.string().min(1),
});

const followUpMutationSchema = z.discriminatedUnion("action", [
  completeMutationSchema,
  snoozeMutationSchema,
  reassignMutationSchema,
]);

export async function POST(request: Request) {
  try {
    await requireApiAuth(request);
    const body = await request.json();
    const parsed = followUpMutationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const adapter = getFollowUpAdapter();
    const data = parsed.data;

    if (data.action === "complete") {
      if (!adapter.complete) {
        return NextResponse.json({ ok: false, error: "Complete not supported" }, { status: 501 });
      }
      const followUp = await adapter.complete(data.followUpId, data.actor);
      if (!followUp) {
        return NextResponse.json({ ok: false, error: "Follow-up not found" }, { status: 404 });
      }

      try {
        await emitDealEvent(DEAL_ENGINE_EVENTS.FOLLOWUP_COMPLETED, {
          followUpId: data.followUpId, actor: data.actor,
        }, { actorId: data.actor, tenantId: "system" });
        recordDealAudit({
          action: "followup_completed", actor: data.actor, orgId: "system",
          details: { followUpId: data.followUpId, title: followUp.title },
        });
      } catch { /* best-effort */ }

      return NextResponse.json({ ok: true, data: { followUp } });
    }

    if (data.action === "snooze") {
      if (!adapter.snooze) {
        return NextResponse.json({ ok: false, error: "Snooze not supported" }, { status: 501 });
      }
      const followUp = await adapter.snooze(data.followUpId, data.newDueDate, data.actor);
      if (!followUp) {
        return NextResponse.json({ ok: false, error: "Follow-up not found" }, { status: 404 });
      }

      try {
        recordDealAudit({
          action: "followup_snoozed", actor: data.actor, orgId: "system",
          details: { followUpId: data.followUpId, newDueDate: data.newDueDate },
        });
      } catch { /* best-effort */ }

      return NextResponse.json({ ok: true, data: { followUp } });
    }

    if (data.action === "reassign") {
      if (!adapter.reassign) {
        return NextResponse.json({ ok: false, error: "Reassign not supported" }, { status: 501 });
      }
      const followUp = await adapter.reassign(data.followUpId, data.newOwner, data.actor);
      if (!followUp) {
        return NextResponse.json({ ok: false, error: "Follow-up not found" }, { status: 404 });
      }

      try {
        recordDealAudit({
          action: "followup_reassigned", actor: data.actor, orgId: "system",
          details: { followUpId: data.followUpId, newOwner: data.newOwner },
        });
      } catch { /* best-effort */ }

      return NextResponse.json({ ok: true, data: { followUp } });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown action" },
      { status: 400 },
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
