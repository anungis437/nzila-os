/**
 * Deal Engine domain events.
 *
 * These high-value events drive follow-up automations, alerts,
 * proof refreshes, and executive summaries.
 */

export const DEAL_ENGINE_EVENTS = {
  // Pipeline events
  DEAL_CREATED: 'deal_engine.deal.created',
  DEAL_STAGE_CHANGED: 'deal_engine.deal.stage_changed',
  DEAL_STALLED: 'deal_engine.deal.stalled',
  DEAL_OWNER_CHANGED: 'deal_engine.deal.owner_changed',

  // Demo events
  DEMO_SCHEDULED: 'deal_engine.demo.scheduled',
  DEMO_COMPLETED: 'deal_engine.demo.completed',

  // Pilot events
  PILOT_STARTED: 'deal_engine.pilot.started',
  PILOT_CHECKLIST_UPDATED: 'deal_engine.pilot.checklist_updated',
  PILOT_REVIEW_DUE: 'deal_engine.pilot.review_due',
  PILOT_STALLED: 'deal_engine.pilot.stalled',

  // Ingestion events
  DATA_RECEIVED: 'deal_engine.ingestion.data_received',
  INGESTION_STARTED: 'deal_engine.ingestion.started',
  INGESTION_COMPLETED: 'deal_engine.ingestion.completed',
  INGESTION_FAILED: 'deal_engine.ingestion.failed',

  // Conversion events
  CONVERSION_READY: 'deal_engine.conversion.ready',
  CONVERTED: 'deal_engine.conversion.completed',

  // Partner events
  REFERRAL_REGISTERED: 'deal_engine.partner.referral_registered',
  COMMISSION_EARNED: 'deal_engine.partner.commission_earned',
  COMMISSION_PAID: 'deal_engine.partner.commission_paid',

  // Follow-up events
  FOLLOWUP_CREATED: 'deal_engine.followup.created',
  FOLLOWUP_OVERDUE: 'deal_engine.followup.overdue',
  FOLLOWUP_COMPLETED: 'deal_engine.followup.completed',

  // Proof events
  PROOF_REFRESHED: 'deal_engine.proof.refreshed',
  EVIDENCE_PACK_GENERATED: 'deal_engine.proof.evidence_pack_generated',
} as const;

export type DealEngineEventType = (typeof DEAL_ENGINE_EVENTS)[keyof typeof DEAL_ENGINE_EVENTS];

export interface DealEngineEvent<T = unknown> {
  type: DealEngineEventType;
  payload: T;
  metadata: {
    dealId?: string;
    pilotId?: string;
    accountId?: string;
    userId: string;
    timestamp: string;
    correlationId?: string;
  };
}

// ── Event payload types ─────────────────────────────────

export interface DealStageChangedPayload {
  dealId: string;
  fromStage: string;
  toStage: string;
  reason?: string;
}

export interface PilotStalledPayload {
  pilotId: string;
  dealId: string;
  daysStalled: number;
  lastActivity?: string;
}

export interface IngestionCompletedPayload {
  ingestionId: string;
  pilotId: string;
  processedCount: number;
  failedCount: number;
  warningCount: number;
}

export interface FollowUpTriggerPayload {
  followUpId: string;
  dealId?: string;
  pilotId?: string;
  trigger: string;
  dueDate: string;
  owner: string;
}
