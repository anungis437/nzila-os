import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { getDealAdapter } from "@/server/adapters";
import { emitDealEvent, DEAL_ENGINE_EVENTS } from "@/server/adapters";
import { recordDealAudit } from "@/server/adapters";
import { logger } from "@/lib/telemetry";
import { dealStageSchema } from "@nzila/deal-engine/lifecycle";

export const dynamic = "force-dynamic";

const pipelineMutationSchema = z.object({
  dealId: z.string().min(1),
  toStage: dealStageSchema,
  actor: z.string().min(1),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireApiAuth(request);
    const body = await request.json();
    const parsed = pipelineMutationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { dealId, toStage, actor, reason } = parsed.data;

    const adapter = getDealAdapter();
    if (!adapter.transitionStage) {
      return NextResponse.json(
        { ok: false, error: "Stage transitions not supported by current adapter" },
        { status: 501 },
      );
    }

    const deal = await adapter.transitionStage(dealId, toStage, actor, reason);
    if (!deal) {
      return NextResponse.json(
        { ok: false, error: "Deal not found or transition not allowed" },
        { status: 404 },
      );
    }

    // Emit event + audit
    try {
      await emitDealEvent(DEAL_ENGINE_EVENTS.DEAL_STAGE_CHANGED, {
        dealId: deal.id,
        fromStage: body.fromStage,
        toStage: deal.stage,
        actor,
        reason,
      }, { actorId: actor, tenantId: "system" });

      recordDealAudit({
        action: "deal_stage_transition",
        actor,
        orgId: "system",
        details: {
          dealId: deal.id,
          before: { stage: body.fromStage },
          after: { stage: deal.stage },
          reason,
        },
      });
    } catch (err) {
      logger.error("[ROUTE:pipeline] event/audit emission failed", { error: err });
    }

    return NextResponse.json({ ok: true, data: { deal } });
  } catch (error) {
    return handleAuthError(error);
  }
}
