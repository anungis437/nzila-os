import type { ClaimId, DecisionId, DocumentId, IssueId, UserId } from './ids.ts';
import type { Principal } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import type { Submission } from './submission.ts';
import { localDateInZone, addCalendarDays, parseIsoDate, toIsoDate, zonedWallTimeToInstant } from './time.ts';

/**
 * WorkAid deadline obligations. The system NEVER calculates a statutory due
 * date and NEVER declares one met. It records a professional's confirmed date
 * with its source, reasoning and rule version, and reports status relative to
 * that confirmation. Separate from the grievance deadline engine on purpose.
 */

export interface RuleSource {
  readonly sourceId: string;
  readonly label: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly retrievedOn: string;
  /** Named human who reviewed this rule source. A source without one cannot ground a confirmation. */
  readonly reviewedBy: UserId | null;
}

export type ObligationKind = 'WSIB_OBJECTION' | 'WSIAT_NOTICE_OF_APPEAL' | 'OTHER';

export interface Confirmation {
  readonly date: string;
  readonly confirmedBy: UserId;
  readonly sourceDocumentId: DocumentId;
  readonly ruleSourceId: string;
  readonly reasoning: string;
  readonly manualRuleAffirmation: boolean;
  readonly at: string;
}

export interface DeadlineObligation {
  readonly id: string;
  readonly kind: ObligationKind;
  readonly claimId: ClaimId;
  readonly decisionId: DecisionId;
  readonly issueIds: readonly IssueId[];
  /** Both dates are kept; neither is defaulted from upload time. */
  readonly letterDate: string;
  readonly receivedDate: string | null;
  readonly issueKinds: readonly string[];
  /** Authoritative zone for "end of day" on the confirmed date; independent of any viewer's zone. */
  readonly matterTimeZone: string;
  readonly confirmations: readonly Confirmation[];
  readonly disposition: { readonly by: UserId; readonly at: string; readonly submissionId: string; readonly note: string } | null;
}

export type ObligationError =
  | 'NOT_PROFESSIONAL'
  | 'SOURCE_DOCUMENT_REQUIRED'
  | 'REASONING_REQUIRED'
  | 'RULE_SOURCE_UNKNOWN'
  | 'RULE_SOURCE_UNREVIEWED'
  | 'RULE_NOT_EFFECTIVE_FOR_DECISION_DATE'
  | 'MANUAL_AFFIRMATION_REQUIRED'
  | 'BAD_DATE'
  | 'DATE_BEFORE_DECISION'
  | 'SUBMISSION_NOT_RECEIPT_CONFIRMED'
  | 'NOTHING_CONFIRMED';

/** Issue mixes and exception-window kinds are never auto-routed to a single timer. */
export function requiresManualRuleAffirmation(o: Pick<DeadlineObligation, 'issueKinds'>): boolean {
  return new Set(o.issueKinds).size > 1 || o.issueKinds.includes('TIME_LIMIT_EXCEPTION_WINDOW');
}

export function ruleAppliesToDate(rule: RuleSource, isoDate: string): boolean {
  return rule.effectiveFrom <= isoDate && (rule.effectiveTo === null || isoDate <= rule.effectiveTo);
}

export function confirmDeadline(input: {
  principal: Principal;
  obligation: DeadlineObligation;
  registry: readonly RuleSource[];
  date: string;
  sourceDocumentId: DocumentId | null;
  ruleSourceId: string;
  reasoning: string;
  manualRuleAffirmation?: boolean;
  now: string;
}): Result<DeadlineObligation, ObligationError> {
  const { principal, obligation: o } = input;
  if (!hasAnyRole(principal, WORKAID_ROLES)) return err('NOT_PROFESSIONAL', 'only a WorkAid professional may confirm a deadline');
  if (!input.sourceDocumentId) return err('SOURCE_DOCUMENT_REQUIRED', 'link the decision letter or source document');
  if (input.reasoning.trim().length < 20) return err('REASONING_REQUIRED', 'record the reasoning for the confirmed date');
  try {
    parseIsoDate(input.date);
  } catch {
    return err('BAD_DATE', 'invalid date');
  }
  const rule = input.registry.find((r) => r.sourceId === input.ruleSourceId);
  if (!rule) return err('RULE_SOURCE_UNKNOWN', 'rule source is not in the registry');
  if (!rule.reviewedBy) return err('RULE_SOURCE_UNREVIEWED', 'rule source has no named reviewer');
  if (!ruleAppliesToDate(rule, o.letterDate)) return err('RULE_NOT_EFFECTIVE_FOR_DECISION_DATE', 'rule source is not effective for the decision date');
  if (requiresManualRuleAffirmation(o) && !input.manualRuleAffirmation) {
    return err('MANUAL_AFFIRMATION_REQUIRED', 'mixed issue kinds or an exception window require explicit manual rule affirmation');
  }
  if (input.date < o.letterDate) return err('DATE_BEFORE_DECISION', 'confirmed date precedes the decision date');
  const c: Confirmation = {
    date: input.date,
    confirmedBy: principal.userId,
    sourceDocumentId: input.sourceDocumentId,
    ruleSourceId: rule.sourceId,
    reasoning: input.reasoning,
    manualRuleAffirmation: !!input.manualRuleAffirmation,
    at: input.now,
  };
  // Append-only: a re-confirmation supersedes but never erases the earlier one.
  return ok({ ...o, confirmations: [...o.confirmations, c] });
}

export const currentConfirmation = (o: DeadlineObligation) => o.confirmations.at(-1) ?? null;

/** The instant the confirmed date ends: start of the next day in the matter zone. */
export function confirmedExpiryMs(o: DeadlineObligation): number | null {
  const c = currentConfirmation(o);
  if (!c) return null;
  const next = addCalendarDays(parseIsoDate(c.date), 1);
  return zonedWallTimeToInstant(next, 0, 0, o.matterTimeZone).getTime();
}

export type ObligationStatus =
  | 'UNCONFIRMED_PROFESSIONAL_REVIEW_REQUIRED'
  | 'CONFIRMED_OPEN'
  | 'CONFIRMED_DATE_PASSED_DISPOSITION_REQUIRED'
  | 'PROFESSIONAL_DISPOSITION_RECORDED';

/** There is intentionally no MET / FILED_IN_TIME status. */
export function obligationStatus(o: DeadlineObligation, now: Date): { status: ObligationStatus; localDateInMatterZone: string } {
  const today = toIsoDate(localDateInZone(now, o.matterTimeZone));
  if (o.disposition) return { status: 'PROFESSIONAL_DISPOSITION_RECORDED', localDateInMatterZone: today };
  const expiry = confirmedExpiryMs(o);
  if (expiry === null) return { status: 'UNCONFIRMED_PROFESSIONAL_REVIEW_REQUIRED', localDateInMatterZone: today };
  return { status: now.getTime() >= expiry ? 'CONFIRMED_DATE_PASSED_DISPOSITION_REQUIRED' : 'CONFIRMED_OPEN', localDateInMatterZone: today };
}

/** Records that a professional addressed the obligation. Requires a receipt-confirmed submission; still does not assert timeliness. */
export function recordDisposition(
  principal: Principal,
  o: DeadlineObligation,
  submission: Submission,
  note: string,
  now: string,
): Result<DeadlineObligation, ObligationError> {
  if (!hasAnyRole(principal, WORKAID_ROLES)) return err('NOT_PROFESSIONAL', 'professionals only');
  if (!currentConfirmation(o)) return err('NOTHING_CONFIRMED', 'confirm the deadline before recording a disposition');
  if (submission.state !== 'RECEIPT_CONFIRMED' || !submission.receipt) return err('SUBMISSION_NOT_RECEIPT_CONFIRMED', 'sent or drafted documents are not a disposition');
  if (note.trim().length < 5) return err('REASONING_REQUIRED', 'note required');
  return ok({ ...o, disposition: { by: principal.userId, at: now, submissionId: submission.id, note } });
}
