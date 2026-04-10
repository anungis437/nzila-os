/**
 * Client-safe stage metadata — mirrors STAGE_METADATA from @nzila/deal-engine/lifecycle
 * without importing the full package in client bundles.
 *
 * CANONICAL SOURCE: packages/deal-engine/src/lifecycle.ts STAGE_METADATA
 * Keep colors and labels in sync with that file.
 */
export const STAGE_METADATA_LIST: Record<string, { label: string; color: string; category: string }> = {
  lead: { label: "Lead", color: "slate", category: "early" },
  qualified: { label: "Qualified", color: "blue", category: "early" },
  demo_scheduled: { label: "Demo Scheduled", color: "blue", category: "early" },
  demo_completed: { label: "Demo Completed", color: "indigo", category: "early" },
  pilot_proposed: { label: "Pilot Proposed", color: "violet", category: "pilot" },
  pilot_active: { label: "Pilot Active", color: "purple", category: "pilot" },
  data_received: { label: "Data Received", color: "amber", category: "ingestion" },
  ingestion_running: { label: "Ingestion Running", color: "orange", category: "ingestion" },
  pilot_review: { label: "Pilot Review", color: "cyan", category: "closing" },
  converted: { label: "Converted", color: "emerald", category: "closing" },
  expanding: { label: "Expanding", color: "green", category: "closing" },
  dormant: { label: "Dormant", color: "gray", category: "terminal" },
  lost: { label: "Lost", color: "red", category: "terminal" },
};
