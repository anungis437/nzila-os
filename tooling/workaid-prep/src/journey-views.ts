import type { DocumentId, MatterId, ReferralId, SubmissionId, UserId } from './ids.ts';
import type { Principal } from './principal.ts';
import { hasAnyRole, UNION_ROLES, WORKAID_ROLES } from './principal.ts';
import { authorizeReferralView, authorizeSpecialistMatterAccess } from './authorization.ts';
import { isReceiptUnconfirmed } from './submission.ts';
import { filingView } from './filing.ts';
import type { FilingStatus } from './filing.ts';
import { isTerminalTask, overdueState } from './followup.ts';
import type { OverdueState } from './followup.ts';
import { obligationStatus } from './deadlines.ts';
import { dependencyStatus } from './dependency.ts';
import { memberStatusView, unionMilestoneView } from './publication.ts';
import type { MemberStage, MemberStatusView } from './publication.ts';
import { readDocument } from './journey.ts';
import type { World } from './journey.ts';

/**
 * Per-persona projections of one world. Each is built by explicit field copy
 * and each starts with the persona's own authorization; none returns a raw
 * record. If the caller is not entitled to a view it gets `null`, which is
 * indistinguishable from "nothing there".
 */

const grant = (w: World, matterId: MatterId, userId: UserId) => w.matterGrants.find((g) => g.matterId === matterId && g.userId === userId) ?? null;
const live = (w: World, p: Principal, matterId: MatterId) => {
  const m = w.matters.find((x) => x.id === matterId);
  return !!m && authorizeSpecialistMatterAccess({ principal: p, matter: m, grant: grant(w, matterId, p.userId), permission: 'VIEW', now: new Date(w.now) }).allow;
};

/* ---------------- Member ---------------- */

export interface MemberJourneyView {
  readonly status: MemberStatusView;
  readonly openRequests: readonly { readonly id: string; readonly code: string }[];
  /** Documents the member may open. Titles of anything else never appear. */
  readonly documents: readonly { readonly id: DocumentId; readonly title: string }[];
  readonly recordsAccessRequestChannel: 'AVAILABLE';
}

export function memberView(w: World, p: Principal, locale: 'en' | 'fr' = 'en'): MemberJourneyView | null {
  if (!p.sessionActive || !hasAnyRole(p, ['MEMBER']) || !p.subjectMemberId) return null;
  const matter = w.matters.find((m) => m.memberId === p.subjectMemberId && m.ownerOrganizationId === p.organizationId);
  if (!matter) return null;
  const status = memberStatusView(p, matter, w.publications, locale);
  if (!status) return null;
  return {
    status,
    openRequests: w.infoRequests.filter((r) => r.matterId === matter.id && r.addressedTo === 'MEMBER' && r.status === 'OPEN').map((r) => ({ id: r.id, code: r.code })),
    documents: w.documents.filter((d) => d.matterId === matter.id && readDocument(w, p, d.id).allow).map((d) => ({ id: d.id, title: d.title })),
    recordsAccessRequestChannel: 'AVAILABLE',
  };
}

/* ---------------- Union representative ---------------- */

export interface UnionJourneyView {
  readonly referralState: string;
  /** Everything still missing from the packet, by code, with who must supply it. The union coordinates the referral even when the member supplies the item. */
  readonly outstanding: readonly { readonly code: string; readonly reason: string; readonly suppliedBy: 'UNION_REFERRAL_REP' | 'MEMBER' }[];
  readonly clarificationQuestion: string | null;
  readonly returnedBecause: string | null;
  readonly unionRequests: readonly { readonly id: string; readonly code: string }[];
  readonly urgentReviewPending: boolean;
  /** Approved, union-visible milestones only. */
  readonly milestones: readonly { readonly stage: MemberStage; readonly text: string; readonly version: number }[];
}

export function unionView(w: World, p: Principal, referralId: ReferralId): UnionJourneyView | null {
  const r = w.referrals.find((x) => x.id === referralId);
  if (!r || !hasAnyRole(p, UNION_ROLES) || p.organizationId !== r.organizationId || !authorizeReferralView(p, r).allow) return null;
  const last = (event: string) => [...r.history].reverse().find((h) => h.event === event)?.note ?? null;
  const matter = w.matters.find((m) => m.id === (`M-${r.id}` as unknown as MatterId));
  return {
    referralState: r.state,
    outstanding: (r.lastEvaluation?.missing ?? []).map((m) => ({ code: m.code, reason: m.reason, suppliedBy: m.nextActionOwner })),
    clarificationQuestion: r.state === 'CLARIFICATION_REQUESTED' ? last('REQUEST_CLARIFICATION') : null,
    returnedBecause: r.state === 'RETURNED_FOR_CORRECTION' ? last('RETURN_FOR_CORRECTION') : null,
    unionRequests: matter ? w.infoRequests.filter((q) => q.matterId === matter.id && q.addressedTo === 'UNION' && q.status === 'OPEN').map((q) => ({ id: q.id, code: q.code })) : [],
    urgentReviewPending: r.urgentReview === 'PENDING',
    milestones: matter ? unionMilestoneView(w.publications, matter.id).map((m) => ({ stage: m.stage, text: m.text, version: m.version })) : [],
  };
}

/* ---------------- Domenic / specialist ---------------- */

export interface SpecialistTaskView {
  readonly taskId: string;
  readonly state: string;
  readonly dueDate: string | null;
  readonly dueDateState: string;
  readonly overdue: OverdueState;
  readonly authoritative: boolean;
  /** Context that travels with the task so nothing is retyped. */
  readonly memberLabel: string;
  readonly claimNumber: string | null;
  readonly submissionKind: string;
  readonly submissionVersion: number;
  readonly matterId: MatterId;
}

export interface SpecialistJourneyView {
  readonly referrals: readonly { readonly referralId: ReferralId; readonly state: string; readonly missing: readonly string[]; readonly urgentReview: string }[];
  readonly tasks: readonly SpecialistTaskView[];
  readonly receiptUnconfirmed: readonly SubmissionId[];
  readonly filing: readonly { readonly submissionId: SubmissionId; readonly status: FilingStatus; readonly receiptDocumented: boolean }[];
  readonly infoRequests: readonly { readonly id: string; readonly code: string; readonly status: string }[];
  readonly waits: readonly { readonly id: string; readonly kind: string; readonly status: string; readonly legalDeadline: false }[];
  readonly reconciliationExceptions: number;
}

export function specialistView(w: World, p: Principal): SpecialistJourneyView | null {
  if (!p.sessionActive || !hasAnyRole(p, WORKAID_ROLES)) return null;
  const mine = w.matters.filter((m) => m.specialistOrganizationId === p.organizationId && live(w, p, m.id));
  const mineIds = new Set(mine.map((m) => m.id));
  const label = (memberId: string) => w.members.find((m) => m.id === memberId)?.displayName ?? 'UNKNOWN';
  return {
    referrals: w.referrals
      .filter((r) => authorizeReferralView(p, r).allow)
      .map((r) => ({ referralId: r.id, state: r.state, missing: (r.lastEvaluation?.missing ?? []).map((m) => m.code), urgentReview: r.urgentReview })),
    tasks: w.tasks
      .filter((t) => mineIds.has(t.matterId) && t.owner === p.userId && !isTerminalTask(t.state))
      .map((t) => ({
        taskId: t.id,
        state: t.state,
        dueDate: t.dueDate,
        dueDateState: t.dueDateState,
        overdue: overdueState(t, new Date(w.now), w.policy.matterTimeZone),
        authoritative: t.authoritative,
        memberLabel: label(mine.find((m) => m.id === t.matterId)!.memberId),
        claimNumber: w.graph.claims.find((c) => c.id === t.claimId)?.claimNumber ?? null,
        submissionKind: t.submissionKind,
        submissionVersion: t.submissionVersion,
        matterId: t.matterId,
      })),
    receiptUnconfirmed: w.submissions.filter((s) => mineIds.has(s.matterId) && isReceiptUnconfirmed(s)).map((s) => s.id),
    filing: w.submissions
      .filter((s) => mineIds.has(s.matterId) && (s.state === 'DISPATCHED' || s.state === 'DELIVERY_ACK' || s.state === 'RECEIPT_CONFIRMED'))
      .map((s) => {
        const v = filingView(s, w.filings.find((f) => f.submissionId === s.id)!);
        return { submissionId: s.id, status: v.status, receiptDocumented: v.receiptDocumented };
      }),
    infoRequests: w.infoRequests.filter((r) => mineIds.has(r.matterId)).map((r) => ({ id: r.id, code: r.code, status: r.status })),
    waits: w.dependencies.filter((d) => mineIds.has(d.matterId)).map((d) => ({ id: d.id, kind: d.kind, status: dependencyStatus(d, new Date(w.now), w.policy.matterTimeZone).status, legalDeadline: false as const })),
    reconciliationExceptions: w.reconciliation.length,
  };
}

/* ---------------- Angelo / supervisor ---------------- */

export interface SupervisorJourneyView {
  readonly pendingAcceptance: readonly ReferralId[];
  readonly escalatedOrOverdueTasks: readonly string[];
  readonly uncertainDeadlines: readonly { readonly obligationId: string; readonly status: string }[];
  readonly heldDocuments: readonly DocumentId[];
  readonly tribunalPrompts: readonly string[];
  readonly receiptUnconfirmed: readonly SubmissionId[];
  readonly reconciliationExceptions: number;
  readonly matterWithoutLiveSpecialist: readonly MatterId[];
}

export function supervisorView(w: World, p: Principal): SupervisorJourneyView | null {
  if (!p.sessionActive || !hasAnyRole(p, ['WORKAID_PRINCIPAL'])) return null;
  const mine = w.matters.filter((m) => m.specialistOrganizationId === p.organizationId);
  const ids = new Set(mine.map((m) => m.id));
  return {
    pendingAcceptance: w.referrals.filter((r) => r.specialistOrganizationId === p.organizationId && r.state === 'OFFERED').map((r) => r.id),
    escalatedOrOverdueTasks: w.tasks.filter((t) => ids.has(t.matterId) && !isTerminalTask(t.state) && (t.state === 'EXCEPTION_ESCALATED' || overdueState(t, new Date(w.now), w.policy.matterTimeZone) === 'OVERDUE')).map((t) => t.id),
    uncertainDeadlines: w.obligations
      .map((o) => ({ obligationId: o.id, status: obligationStatus(o, new Date(w.now)).status }))
      .filter((o) => o.status === 'UNCONFIRMED_PROFESSIONAL_REVIEW_REQUIRED' || o.status === 'CONFIRMED_DATE_PASSED_DISPOSITION_REQUIRED'),
    heldDocuments: w.documents.filter((d) => ids.has(d.matterId) && d.restrictionHold !== null).map((d) => d.id),
    tribunalPrompts: w.assessments.filter((a) => ids.has(a.matterId) && a.status === 'NEEDS_PROFESSIONAL_ASSESSMENT').map((a) => a.id),
    receiptUnconfirmed: w.submissions.filter((s) => ids.has(s.matterId) && isReceiptUnconfirmed(s)).map((s) => s.id),
    reconciliationExceptions: w.reconciliation.length,
    matterWithoutLiveSpecialist: mine.filter((m) => m.status === 'OPEN' && !w.matterGrants.some((g) => g.matterId === m.id && g.status === 'ACTIVE' && m.assignedSpecialists.includes(g.userId))).map((m) => m.id),
  };
}
