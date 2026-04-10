/**
 * DealEngineAuditService — bridges deal-engine operations to platform-governance.
 *
 * Records governance-grade audit timeline entries for deal stage transitions,
 * pilot status changes, and other trackable operations.
 */
import "server-only";

import {
  recordAuditEvent,
  getAuditTimeline,
  type AuditTimelineEntry,
} from "@nzila/platform-governance";

export type DealAuditAction =
  | "deal_stage_transition"
  | "pilot_status_change"
  | "pilot_checklist_update"
  | "followup_completed"
  | "followup_snoozed"
  | "followup_reassigned"
  | "ingestion_retry"
  | "proof_enriched";

/**
 * Record an audit entry for a deal-engine operation.
 */
export function recordDealAudit(params: {
  action: DealAuditAction;
  actor: string;
  orgId: string;
  details?: Record<string, unknown>;
}): AuditTimelineEntry {
  return recordAuditEvent({
    eventType: "workflow_step_executed",
    actor: params.actor,
    orgId: params.orgId,
    app: "control-plane:deal-engine",
    policyResult: "pass",
    commitHash: process.env.COMMIT_SHA ?? "dev",
    details: {
      dealEngineAction: params.action,
      ...params.details,
    },
  });
}

/**
 * Retrieve deal-engine audit timeline entries, optionally filtered.
 */
export function getDealAuditTimeline(filters?: {
  orgId?: string;
  since?: string;
}): AuditTimelineEntry[] {
  return getAuditTimeline({
    orgId: filters?.orgId,
    app: "control-plane:deal-engine",
    since: filters?.since,
  });
}
