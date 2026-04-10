import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { getPilotAdapter } from "@/server/adapters";
import { emitDealEvent, DEAL_ENGINE_EVENTS } from "@/server/adapters";
import { recordDealAudit } from "@/server/adapters";
import { pilotStatusSchema } from "@nzila/deal-engine/types";

export const dynamic = "force-dynamic";

const CHECKLIST_KEYS = [
  "dataReceived",
  "ingestionComplete",
  "demoDatasetReady",
  "userOnboardingComplete",
  "reviewMeetingScheduled",
  "conversionTriggered",
] as const;

const checklistMutationSchema = z.object({
  action: z.literal("update_checklist"),
  pilotId: z.string().min(1),
  actor: z.string().min(1),
  checklistKey: z.enum(CHECKLIST_KEYS),
  checklistValue: z.boolean(),
});

const statusMutationSchema = z.object({
  action: z.literal("update_status"),
  pilotId: z.string().min(1),
  actor: z.string().min(1),
  status: pilotStatusSchema,
});

const pilotMutationSchema = z.discriminatedUnion("action", [
  checklistMutationSchema,
  statusMutationSchema,
]);

export async function POST(request: Request) {
  try {
    await requireApiAuth(request);
    const body = await request.json();
    const parsed = pilotMutationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const adapter = getPilotAdapter();
    const data = parsed.data;

    if (data.action === "update_checklist") {
      if (!adapter.updateChecklist) {
        return NextResponse.json({ ok: false, error: "Checklist updates not supported" }, { status: 501 });
      }
      const pilot = await adapter.updateChecklist(data.pilotId, data.checklistKey, data.checklistValue, data.actor);
      if (!pilot) {
        return NextResponse.json({ ok: false, error: "Pilot not found or invalid checklist key" }, { status: 404 });
      }

      try {
        await emitDealEvent(DEAL_ENGINE_EVENTS.PILOT_CHECKLIST_UPDATED, {
          pilotId: data.pilotId, checklistKey: data.checklistKey, checklistValue: data.checklistValue, actor: data.actor,
        }, { actorId: data.actor, tenantId: "system" });
        recordDealAudit({
          action: "pilot_checklist_update", actor: data.actor, orgId: "system",
          details: { pilotId: data.pilotId, checklistKey: data.checklistKey, checklistValue: data.checklistValue },
        });
      } catch { /* best-effort */ }

      return NextResponse.json({ ok: true, data: { pilot } });
    }

    if (data.action === "update_status") {
      if (!adapter.updateStatus) {
        return NextResponse.json({ ok: false, error: "Status updates not supported" }, { status: 501 });
      }
      const pilot = await adapter.updateStatus(data.pilotId, data.status, data.actor);
      if (!pilot) {
        return NextResponse.json({ ok: false, error: "Pilot not found or transition not allowed" }, { status: 404 });
      }

      try {
        await emitDealEvent(DEAL_ENGINE_EVENTS.PILOT_STARTED, {
          pilotId: data.pilotId, status: data.status, actor: data.actor,
        }, { actorId: data.actor, tenantId: "system" });
        recordDealAudit({
          action: "pilot_status_change", actor: data.actor, orgId: "system",
          details: { pilotId: data.pilotId, newStatus: data.status },
        });
      } catch { /* best-effort */ }

      return NextResponse.json({ ok: true, data: { pilot } });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action` },
      { status: 400 },
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
