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

import { onDealEvent, DEAL_ENGINE_EVENTS } from "./events";
import { recordDealAudit } from "./audit";

let _registered = false;

export function registerDealEngineAutomations(): void {
  if (_registered) return;
  _registered = true;

  // When a demo is completed → audit trail + surface for follow-up
  onDealEvent(DEAL_ENGINE_EVENTS.DEMO_COMPLETED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    recordDealAudit({
      action: "deal_stage_transition",
      actor: (payload.actor as string) ?? "system",
      orgId: "system",
      details: { automation: "demo_completed", ...payload },
    });
  });

  // When a pilot starts → log for ops visibility
  onDealEvent(DEAL_ENGINE_EVENTS.PILOT_STARTED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    recordDealAudit({
      action: "pilot_status_change",
      actor: (payload.actor as string) ?? "system",
      orgId: "system",
      details: { automation: "pilot_started", ...payload },
    });
  });

  // When ingestion completes → audit for review readiness
  onDealEvent(DEAL_ENGINE_EVENTS.INGESTION_COMPLETED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    recordDealAudit({
      action: "proof_enriched",
      actor: (payload.actor as string) ?? "system",
      orgId: "system",
      details: { automation: "ingestion_completed_review", ...payload },
    });
  });

  // When ingestion fails → audit trail for ops attention
  onDealEvent(DEAL_ENGINE_EVENTS.INGESTION_FAILED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    recordDealAudit({
      action: "ingestion_retry",
      actor: (payload.actor as string) ?? "system",
      orgId: "system",
      details: { automation: "ingestion_failed_alert", ...payload },
    });
  });

  // When a deal stage changes → check for stall conditions
  onDealEvent(DEAL_ENGINE_EVENTS.DEAL_STAGE_CHANGED, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    recordDealAudit({
      action: "deal_stage_transition",
      actor: (payload.actor as string) ?? "system",
      orgId: "system",
      details: { automation: "stage_change_tracked", ...payload },
    });
  });

  // When a follow-up becomes overdue → audit for attention
  onDealEvent(DEAL_ENGINE_EVENTS.FOLLOWUP_OVERDUE, async (event) => {
    const payload = (event as { payload?: Record<string, unknown> })?.payload ?? {};
    recordDealAudit({
      action: "followup_snoozed",
      actor: "system",
      orgId: "system",
      details: { automation: "followup_overdue_alert", ...payload },
    });
  });
}
