/**
 * Case lifecycle stages for the CUPE 4373 demo.
 *
 * The platform's real case workflow is modelled on the backend (see
 * `/api/cases/[caseId]/transition`, `/api/cases/[caseId]/escalate`).
 * Stewards never need to see raw state-machine terminology — these
 * stages map plain-English labels to the underlying transitions so the
 * demo can show a coherent lifecycle without leaking implementation
 * jargon (per the no-FSM-overexposure UX policy).
 */

import type { DemoCase } from "@/lib/demo/cupe4373-demo";

export type LifecycleStage =
  | "intake"
  | "documentation"
  | "discussion"
  | "grievance_filed"
  | "escalation"
  | "resolved";

export const STAGE_ORDER: LifecycleStage[] = [
  "intake",
  "documentation",
  "discussion",
  "grievance_filed",
  "escalation",
  "resolved",
];

export const STAGE_LABEL: Record<LifecycleStage, string> = {
  intake: "Intake",
  documentation: "Documentation",
  discussion: "Employer discussion",
  grievance_filed: "Grievance filed",
  escalation: "Escalation",
  resolved: "Resolved",
};

export const STAGE_DESCRIPTION: Record<LifecycleStage, string> = {
  intake: "Initial member contact, story captured, urgency triaged.",
  documentation: "Evidence packet built — schedules, statements, payroll, CBA refs.",
  discussion: "Employer engaged informally to seek resolution before formal steps.",
  grievance_filed: "Step 1 grievance submitted in writing with article references.",
  escalation: "Step 2 / arbitration / external — Chief Steward and LRO involvement.",
  resolved: "Outcome accepted, file closed, continuity captured for the next steward.",
};

export const STAGE_BADGE_CLASS: Record<LifecycleStage, string> = {
  intake: "border-slate-200 bg-slate-50 text-slate-700",
  documentation: "border-blue-200 bg-blue-50 text-blue-800",
  discussion: "border-indigo-200 bg-indigo-50 text-indigo-800",
  grievance_filed: "border-amber-200 bg-amber-50 text-amber-800",
  escalation: "border-orange-200 bg-orange-50 text-orange-800",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

/**
 * Best-effort derivation of a case's current stage from its free-form
 * status string and casework stream. Used when no explicit stage has
 * been recorded yet (which is the case for the static demo fixtures).
 */
export function deriveStage(c: Pick<DemoCase, "status" | "caseworkStream">): LifecycleStage {
  const s = (c.status ?? "").toLowerCase();
  if (s.includes("intake")) return "intake";
  if (s.includes("documentation") || s.includes("evidence")) return "documentation";
  if (s.includes("meeting") || s.includes("discussion") || s.includes("ready for")) return "discussion";
  if (s.includes("response pending") || s.includes("awaiting employer")) return "discussion";
  if (s.includes("escalation") || s.includes("arbitration")) return "escalation";
  if (s.includes("resolved") || s.includes("closed")) return "resolved";
  if (s.includes("follow-up") || s.includes("under review")) {
    return c.caseworkStream === "grievance" ? "discussion" : "documentation";
  }
  return "intake";
}

export function nextStage(stage: LifecycleStage): LifecycleStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function canFileGrievance(stage: LifecycleStage): boolean {
  return stage === "documentation" || stage === "discussion";
}

export function canEscalate(stage: LifecycleStage): boolean {
  return stage === "grievance_filed";
}

export function canResolve(stage: LifecycleStage): boolean {
  return stage !== "resolved";
}
