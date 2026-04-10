/**
 * Deal Engine Automations — event-driven side effects.
 *
 * Registers handlers on the platform event bus so that domain events
 * trigger follow-up tasks, alerts, and cross-entity state changes.
 *
 * Calling `registerDealEngineAutomations()` is idempotent — handlers
 * are registered once on first call.
 */
import "server-only";

import { db } from "@nzila/db";
import { onDealEvent, DEAL_ENGINE_EVENTS } from "./events";
import { recordDealAudit } from "./audit";
import { dealEngineFollowUps } from "./schemas";

let _registered = false;

/**
 * Create a follow-up task from an automation trigger.
 * Logs on failure but never throws (fire-and-forget side effect).
 */
async function createAutomatedFollowUp(params: {
  dealId?: string;
  pilotId?: string;
  accountName: string;
  title: string;
  description: string;
  owner: string;
  priority: "critical" | "high" | "medium" | "low";
  daysUntilDue: number;
  trigger: string;
}): Promise<void> {
  try {
    const now = new Date();
    const due = new Date(now.getTime() + params.daysUntilDue * 86_400_000);
    await db.insert(dealEngineFollowUps).values({
      id: crypto.randomUUID(),
      dealId: params.dealId ?? null,
      pilotId: params.pilotId ?? null,
      accountName: params.accountName,
      title: params.title,
      description: params.description,
      owner: params.owner,
      priority: params.priority,
      dueDate: due,
      isOverdue: false,
      completedAt: null,
      trigger: params.trigger,
      createdAt: now,
    });
  } catch (err) {
    console.error("[AUTOMATION] createAutomatedFollowUp failed", params.trigger, err);
  }
}

export function registerDealEngineAutomations(): void {
  if (_registered) return;
  _registered = true;

  // When a demo is completed → create follow-up for post-demo engagement
  onDealEvent(DEAL_ENGINE_EVENTS.DEMO_COMPLETED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    const actor = (payload.actor as string) ?? "system";

    recordDealAudit({
      action: "deal_stage_transition",
      actor,
      orgId: "system",
      details: { automation: "demo_completed", ...payload },
    });

    await createAutomatedFollowUp({
      dealId: payload.dealId as string | undefined,
      accountName: (payload.accountName as string) ?? "Unknown",
      title: "Post-demo follow-up: send pilot proposal",
      description: "Demo completed — follow up with pilot proposal within 3 business days.",
      owner: actor,
      priority: "high",
      daysUntilDue: 3,
      trigger: "automation:demo_completed",
    });
  });

  // When a pilot starts → create follow-up for first check-in
  onDealEvent(DEAL_ENGINE_EVENTS.PILOT_STARTED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    const actor = (payload.actor as string) ?? "system";

    recordDealAudit({
      action: "pilot_status_change",
      actor,
      orgId: "system",
      details: { automation: "pilot_started", ...payload },
    });

    await createAutomatedFollowUp({
      pilotId: payload.pilotId as string | undefined,
      dealId: payload.dealId as string | undefined,
      accountName: (payload.accountName as string) ?? "Unknown",
      title: "Pilot kickoff: verify data ingestion setup",
      description: "Pilot started — confirm data ingestion pipeline is configured and first batch scheduled.",
      owner: actor,
      priority: "high",
      daysUntilDue: 2,
      trigger: "automation:pilot_started",
    });
  });

  // When ingestion completes → create follow-up for review readiness
  onDealEvent(DEAL_ENGINE_EVENTS.INGESTION_COMPLETED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    const actor = (payload.actor as string) ?? "system";

    recordDealAudit({
      action: "proof_enriched",
      actor,
      orgId: "system",
      details: { automation: "ingestion_completed_review", ...payload },
    });

    await createAutomatedFollowUp({
      pilotId: payload.pilotId as string | undefined,
      accountName: (payload.accountName as string) ?? "Unknown",
      title: "Ingestion complete: schedule pilot review meeting",
      description: "Data ingestion finished — schedule review meeting and prepare conversion analysis.",
      owner: actor,
      priority: "high",
      daysUntilDue: 5,
      trigger: "automation:ingestion_completed",
    });
  });

  // When ingestion fails → create urgent follow-up for ops
  onDealEvent(DEAL_ENGINE_EVENTS.INGESTION_FAILED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    const actor = (payload.actor as string) ?? "system";

    recordDealAudit({
      action: "ingestion_retry",
      actor,
      orgId: "system",
      details: { automation: "ingestion_failed_alert", ...payload },
    });

    await createAutomatedFollowUp({
      pilotId: payload.pilotId as string | undefined,
      accountName: (payload.accountName as string) ?? "Unknown",
      title: "URGENT: Ingestion failure — investigate and retry",
      description: "Ingestion failed — diagnose root cause, fix data issues, and trigger retry.",
      owner: actor,
      priority: "critical",
      daysUntilDue: 1,
      trigger: "automation:ingestion_failed",
    });
  });

  // When a deal stage changes → audit + check for stall
  onDealEvent(DEAL_ENGINE_EVENTS.DEAL_STAGE_CHANGED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    recordDealAudit({
      action: "deal_stage_transition",
      actor: (payload.actor as string) ?? "system",
      orgId: "system",
      details: { automation: "stage_change_tracked", ...payload },
    });
  });

  // When a follow-up becomes overdue → escalation
  onDealEvent(DEAL_ENGINE_EVENTS.FOLLOWUP_OVERDUE, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    recordDealAudit({
      action: "followup_overdue",
      actor: "system",
      orgId: "system",
      details: { automation: "followup_overdue_alert", ...payload },
    });
  });
}
