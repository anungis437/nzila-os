/**
 * Client-safe stage metadata — mirrors STAGE_METADATA from @nzila/deal-engine/lifecycle
 * without importing the full package in client bundles.
 */
export const STAGE_METADATA_LIST: Record<string, { label: string; color: string; category: string }> = {
  lead: { label: "Lead", color: "blue", category: "early" },
  qualified: { label: "Qualified", color: "blue", category: "early" },
  demo_scheduled: { label: "Demo Scheduled", color: "purple", category: "early" },
  demo_completed: { label: "Demo Completed", color: "purple", category: "early" },
  pilot_proposed: { label: "Pilot Proposed", color: "cyan", category: "pilot" },
  pilot_active: { label: "Pilot Active", color: "emerald", category: "pilot" },
  data_received: { label: "Data Received", color: "teal", category: "ingestion" },
  ingestion_running: { label: "Ingestion Running", color: "amber", category: "ingestion" },
  pilot_review: { label: "Pilot Review", color: "indigo", category: "closing" },
  converted: { label: "Converted", color: "green", category: "closing" },
  expanding: { label: "Expanding", color: "emerald", category: "closing" },
  dormant: { label: "Dormant", color: "gray", category: "terminal" },
  lost: { label: "Lost", color: "red", category: "terminal" },
};
