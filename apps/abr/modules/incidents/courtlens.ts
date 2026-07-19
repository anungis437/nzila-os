/**
 * CourtLens Access-to-Justice — thin adapter layer over ABR incident primitives.
 *
 * This module adds CourtLens-specific vocabulary, lifecycle constants, and type
 * extensions to the existing ABR incident/case model. It does NOT replace or
 * duplicate ABR incident infrastructure.
 *
 * Architectural rule (from docs/courtlens/phase-1/abr-reuse-audit.md):
 *   A CourtLens matter IS an ABR incident/case specialization.
 *   All CourtLens fields are additive on top of IncidentRecord.
 *   The ABR FSM, org context, RBAC, evidence/NAR, and AI legal actions are
 *   reused as-is. New code is introduced only where the Phase 1A audit
 *   proved a hard gap.
 */

import type { IncidentRecord, IncidentStatus } from './types';

// ── Practice Areas ───────────────────────────────────────────────────────────

export const COURTLENS_PRACTICE_AREAS = ['housing', 'employment', 'debt'] as const;
export type CourtLensPracticeArea = (typeof COURTLENS_PRACTICE_AREAS)[number];

/**
 * Matter read-model practice area — includes 'unknown' for matters where the
 * practice area has not yet been set by a CourtLens event.
 * Use CourtLensPracticeArea for intake validation (rejects 'unknown').
 * Use CourtLensMatterPracticeArea for read model / projection types.
 */
export type CourtLensMatterPracticeArea = CourtLensPracticeArea | 'unknown';

export const COURTLENS_INTAKE_CHANNELS = [
  'public_web',
  'tenant_staff',
  'phone',
  'referral',
] as const;
export type CourtLensIntakeChannel = (typeof COURTLENS_INTAKE_CHANNELS)[number];

// ── Sub-Issues ───────────────────────────────────────────────────────────────

export const COURTLENS_HOUSING_SUB_ISSUES = [
  'eviction',
  'rent_arrears',
  'illegal_rent_increase',
  'repairs_maintenance',
  'harassment',
  'lockout',
  'discrimination',
  'safety',
  'utility_shutoff',
  'deposit',
  'notice_validity',
  'other_housing',
] as const;

export const COURTLENS_EMPLOYMENT_SUB_ISSUES = [
  'unpaid_wages',
  'termination',
  'workplace_harassment',
  'unsafe_work',
  'missing_records',
  'employment_status',
  'scheduling_dispute',
  'other_employment',
] as const;

export const COURTLENS_DEBT_SUB_ISSUES = [
  'collection_letter',
  'debt_buyer_claim',
  'wage_garnishment',
  'payday_loan',
  'credit_card_debt',
  'utility_telecom_debt',
  'court_debt_paperwork',
  'identity_theft_debt',
  'collector_harassment',
  'unclear_debt_records',
  'other_debt',
] as const;

export const COURTLENS_SUB_ISSUES = [
  ...COURTLENS_HOUSING_SUB_ISSUES,
  ...COURTLENS_EMPLOYMENT_SUB_ISSUES,
  ...COURTLENS_DEBT_SUB_ISSUES,
] as const;

export type CourtLensSubIssue = (typeof COURTLENS_SUB_ISSUES)[number];

// ── AI Summary Status Lifecycle ───────────────────────────────────────────────
//
// This is the human-in-the-loop approval gate for AI-generated review packets.
// A packet may not be presented externally until it reaches 'approved' or
// 'revised_by_human'. No bypass is permitted.

export const AI_SUMMARY_STATUSES = [
  'ai_draft',
  'needs_verification',
  'approved',
  'rejected',
  'revised_by_human',
] as const;
export type AiSummaryStatus = (typeof AI_SUMMARY_STATUSES)[number];

const AI_SUMMARY_TRANSITIONS: Record<AiSummaryStatus, AiSummaryStatus[]> = {
  ai_draft: ['needs_verification'],
  needs_verification: ['approved', 'rejected', 'revised_by_human'],
  approved: [],
  rejected: ['needs_verification'],
  revised_by_human: ['needs_verification', 'approved'],
};

export function isValidAiSummaryTransition(
  from: AiSummaryStatus,
  to: AiSummaryStatus,
): boolean {
  return AI_SUMMARY_TRANSITIONS[from].includes(to);
}

/**
 * Guard: true only when the packet has received human approval.
 * Must be checked before any AI-generated output is presented externally.
 */
export function isExternalizableSummaryStatus(status: AiSummaryStatus): boolean {
  return status === 'approved' || status === 'revised_by_human';
}

// ── Referral Status Lifecycle ─────────────────────────────────────────────────
//
// Referral must pass through 'approved' before it can be 'sent'.
// This prevents referrals being dispatched without reviewer sign-off.

export const REFERRAL_STATUSES = [
  'none',
  'suggested',
  'approved',
  'sent',
  'completed',
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

const REFERRAL_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  none: ['suggested'],
  suggested: ['approved', 'none'],
  approved: ['sent'],
  sent: ['completed'],
  completed: [],
};

export function isValidReferralTransition(
  from: ReferralStatus,
  to: ReferralStatus,
): boolean {
  return REFERRAL_TRANSITIONS[from].includes(to);
}

// ── Consent Status ───────────────────────────────────────────────────────────

export const CONSENT_STATUSES = ['granted', 'pending', 'denied'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

// ── Risk Flags ────────────────────────────────────────────────────────────────
//
// Structured boolean risk indicators for housing/employment/debt intake.
// Used for triage, urgency escalation, and reviewer prioritisation.

export interface CourtLensRiskFlags {
  risk_lockout: boolean;
  risk_eviction: boolean;
  risk_utility_shutoff: boolean;
  risk_safety: boolean;
  risk_homelessness: boolean;
  risk_income_loss: boolean;
  risk_unsafe_work: boolean;
  risk_retaliation: boolean;
  risk_garnishment: boolean;
  risk_bank_freeze: boolean;
  risk_identity_theft: boolean;
  risk_essential_services: boolean;
  risk_harassment: boolean;
}

export function defaultRiskFlags(): CourtLensRiskFlags {
  return {
    risk_lockout: false,
    risk_eviction: false,
    risk_utility_shutoff: false,
    risk_safety: false,
    risk_homelessness: false,
    risk_income_loss: false,
    risk_unsafe_work: false,
    risk_retaliation: false,
    risk_garnishment: false,
    risk_bank_freeze: false,
    risk_identity_theft: false,
    risk_essential_services: false,
    risk_harassment: false,
  };
}

export function hasAnyRiskFlag(flags: CourtLensRiskFlags): boolean {
  return Object.values(flags).some(Boolean);
}

// ── Minimal Client Profile ───────────────────────────────────────────────────
//
// Captures person-level intake context alongside the matter.
// Kept minimal: only fields confirmed necessary for pilot workflows.

export interface CourtLensClientProfile {
  clientName: string | null;
  clientContact: string | null;
  householdSize: number | null;
  hasChildren: boolean;
  hasDisability: boolean;
  consentStatus: ConsentStatus;
}

export function defaultClientProfile(): CourtLensClientProfile {
  return {
    clientName: null,
    clientContact: null,
    householdSize: null,
    hasChildren: false,
    hasDisability: false,
    consentStatus: 'pending',
  };
}

// ── CourtLens Additive Fields ─────────────────────────────────────────────────
//
// These fields extend IncidentRecord without modifying it.
// Phase 1A audit confirmed all are additive — none replace ABR incident fields.

export interface CourtLensFields {
  practiceArea: CourtLensMatterPracticeArea;
  subIssue: CourtLensSubIssue | null;
  aiSummaryStatus: AiSummaryStatus;
  referralStatus: ReferralStatus;
  riskFlags: CourtLensRiskFlags;
  clientGoal: string | null;
  hearingDate: string | null;   // ISO date
  deadlineDate: string | null;  // ISO date
  clientProfile: CourtLensClientProfile | null;
}

// ── CourtLens Matter ──────────────────────────────────────────────────────────
//
// A CourtLens matter is an ABR incident/case specialization.
// It does not replace the ABR incident model.

export type CourtLensMatter = IncidentRecord & CourtLensFields;

// ── FSM State Label Mapping ───────────────────────────────────────────────────
//
// Maps ABR IncidentStatus values to CourtLens A2J display names.
// Reuses getAllowedTransitions and isValidTransition from ./fsm unchanged.

export const MATTER_STATUS_LABELS: Record<IncidentStatus, string> = {
  new: 'New Intake',
  triage: 'Triage',
  assigned: 'Assigned to Reviewer',
  investigating: 'Under Review',
  action_planning: 'Review Packet Ready',
  monitoring: 'Accepted for Review',
  resolved: 'Referred / Completed',
  closed: 'Closed',
  archived: 'Archived',
};

export function getMatterStatusLabel(status: IncidentStatus): string {
  return MATTER_STATUS_LABELS[status];
}

// ── Review Packet Guard ───────────────────────────────────────────────────────
//
// The single entry-point for checking whether a matter's AI-generated
// review packet may be presented externally. Must not be bypassed.

export function isMatterPacketExternalizable(matter: CourtLensMatter): boolean {
  return isExternalizableSummaryStatus(matter.aiSummaryStatus);
}

// ── Default Matter Fields ─────────────────────────────────────────────────────
//
// Sensible defaults for creating a new CourtLens matter.
// Used alongside IncidentCreateInput to initialise CourtLens-specific fields.

export function defaultCourtLensFields(
  practiceArea: CourtLensMatterPracticeArea = 'unknown',
): CourtLensFields {
  return {
    practiceArea,
    subIssue: null,
    aiSummaryStatus: 'ai_draft',
    referralStatus: 'none',
    riskFlags: defaultRiskFlags(),
    clientGoal: null,
    hearingDate: null,
    deadlineDate: null,
    clientProfile: defaultClientProfile(),
  };
}
