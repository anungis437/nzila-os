import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { getIngestionAdapter } from "@/server/adapters";
import { emitDealEvent, DEAL_ENGINE_EVENTS } from "@/server/adapters";
import { recordDealAudit } from "@/server/adapters";

export const dynamic = "force-dynamic";

const retryMutationSchema = z.object({
  runId: z.string().min(1),
  actor: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await requireApiAuth(request);
    const body = await request.json();
    const parsed = retryMutationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { runId, actor } = parsed.data;

    const adapter = getIngestionAdapter();
    if (!adapter.retry) {
      return NextResponse.json(
        { ok: false, error: "Retry not supported by current adapter" },
        { status: 501 },
      );
    }

    const run = await adapter.retry(runId, actor);
    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Ingestion run not found" },
        { status: 404 },
      );
    }

    try {
      await emitDealEvent(DEAL_ENGINE_EVENTS.INGESTION_STARTED, {
        runId: run.id, actor, retried: true,
      }, { actorId: actor, tenantId: "system" });
      recordDealAudit({
        action: "ingestion_retry", actor, orgId: "system",
        details: { runId: run.id, source: run.sourceSystem },
      });
    } catch { /* best-effort */ }

    return NextResponse.json({ ok: true, data: { run } });
  } catch (error) {
    return handleAuthError(error);
  }
}
