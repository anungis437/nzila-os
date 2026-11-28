/**
 * Versioned procedural rules — the data model the engine reads.
 *
 * Institution-neutral: a regime (a collective agreement, a side letter, a statute) is data. Nothing in this module or the
 * engine names a real agreement or a real employer. Every value the engine needs to count a day comes from an adopted,
 * effective-dated rule set, a versioned holiday calendar and recorded matter facts; when any of them is missing or
 * ambiguous the engine raises a reviewable exception instead of a date.
 */

/** A calendar day, "YYYY-MM-DD". */
export type CalendarDay = string;

/** Adoption lifecycle. Only `adopted` executes. `superseded` and `retired` keep history; nothing is deleted. */
export const RULE_LIFECYCLE_STATUSES = ['draft', 'reviewed', 'adopted', 'superseded', 'retired'] as const;
export type RuleLifecycleStatus = (typeof RULE_LIFECYCLE_STATUSES)[number];

/** Where a draft came from. An AI-assisted extraction can only ever produce a draft. */
export const RULE_ORIGINS = ['human_authored', 'ai_assisted_extraction', 'imported'] as const;
export type RuleOrigin = (typeof RULE_ORIGINS)[number];

/** The instrument a rule set is read from. */
export const RULE_SOURCE_KINDS = ['collective_agreement', 'side_letter', 'letter_of_understanding', 'statute', 'regulation', 'policy', 'other'] as const;
export type RuleSourceKind = (typeof RULE_SOURCE_KINDS)[number];

export interface RuleSourceRef {
  id: string;
  kind: RuleSourceKind;
  title: string;
  edition: string;
  language: string;
  /** A citation the reviewer can find: article/clause, document id, URL. */
  reference: string;
  effectiveFrom: CalendarDay;
  /** Expiry of the instrument itself (a temporary side letter). Null: open-ended. */
  effectiveTo: CalendarDay | null;
  /** The source this one replaces, when it does. */
  supersedesSourceId: string | null;
}

/** How days are counted. There is no default: every reviewed clock names its policy. */
export const DAY_COUNT_MODES = ['calendar_days', 'business_days'] as const;
export type DayCountMode = (typeof DAY_COUNT_MODES)[number];

export interface CalendarPolicy {
  mode: DayCountMode;
  /** Days of the week that are not working days, 0 = Sunday … 6 = Saturday. */
  weekendDays: number[];
  /** Whether designated holidays from a holiday calendar version are non-working days for this clock. */
  holidays: 'excluded' | 'not_applicable';
  /** When the last counted day is not a working day: move to the next working day, or keep it. */
  rollForward: 'next_working_day' | 'none';
}

export interface HolidayCalendarVersion {
  id: string;
  calendarKey: string;
  version: number;
  status: RuleLifecycleStatus;
  sourceReference: string;
  /** The span this version lists holidays for. Counting outside it is refused (an unknown day is not a working day). */
  coverageFrom: CalendarDay;
  coverageTo: CalendarDay;
  days: CalendarDay[];
}

/** Which instant of a trigger fact starts a clock. */
export const RECEIPT_MODES = ['occurrence', 'postmark', 'delivery', 'receipt', 'deemed_receipt'] as const;
export type ReceiptMode = (typeof RECEIPT_MODES)[number];

/** Typed clock kinds keep employer-reply clocks distinct from member-escalation clocks. */
export const CLOCK_KINDS = ['filing_limit', 'employer_reply', 'member_escalation', 'non_response_escalation', 'referral_limit', 'other'] as const;
export type ClockKind = (typeof CLOCK_KINDS)[number];

export interface ClockRule {
  key: string;
  kind: ClockKind;
  /** The stage this clock belongs to (or null for a matter-level clock such as a filing limit). */
  stageKey: string | null;
  /** The recorded event that starts the clock: "awareness", "decision_conveyed", "presentation", … */
  triggerEvent: string;
  receiptMode: ReceiptMode;
  /** For `deemed_receipt`: calendar days after the postmark at which receipt is deemed. */
  deemedReceiptDays?: number;
  days: number;
  calendar: CalendarPolicy;
  /** The holiday calendar key this clock reads when holidays are excluded. */
  holidayCalendarKey: string | null;
  pausable: boolean;
  extension: {
    permitted: boolean;
    /** Both parties must be recorded on the extension. */
    mutualAgreementRequired: boolean;
    /** An affiliated parent body must also be recorded. */
    parentParticipationRequired: boolean;
    maxTotalCalendarDays: number | null;
  };
  /** The clause the clock is read from, for the evidence. */
  sourceClause: string;
}

export interface StageDefinition {
  key: string;
  level: number;
  label: string;
  /** May this level be eliminated by recorded agreement of both parties? */
  waivable: boolean;
  isFinal: boolean;
}

export interface TransitionDefinition {
  from: string;
  to: string;
  /** `escalate` follows the next level; `waive_intermediate` skips waivable levels by agreement; `direct_route` is a route the rule set names (e.g. a qualifying matter straight to the final level). */
  kind: 'escalate' | 'waive_intermediate' | 'direct_route';
  /** For `direct_route`: the matter category that qualifies. */
  qualifyingCategory?: string;
}

/** Explicit applicability. Wildcards are explicit (`'*'`), never implied by an empty list. */
export interface RuleSetApplicability {
  regime: string;
  procedureRoute: string;
  employerIds: string[] | '*';
  bargainingGroups: string[] | '*';
  classifications: string[] | '*';
}

export interface RuleSet {
  id: string;
  key: string;
  version: number;
  status: RuleLifecycleStatus;
  origin: RuleOrigin;
  source: RuleSourceRef;
  applicability: RuleSetApplicability;
  effectiveFrom: CalendarDay;
  effectiveTo: CalendarDay | null;
  stages: StageDefinition[];
  transitions: TransitionDefinition[];
  clocks: ClockRule[];
  /** Human determinations that must be recorded on the matter before any clock executes (e.g. statutory exclusion reviewed). */
  requiredDeterminations: string[];
  /** Refuse the same employer decision-maker at more than one level. */
  distinctDecisionMakerPerLevel: boolean;
}

/** One recorded fact that can start a clock. */
export interface TriggerFact {
  event: string;
  occurredAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  receivedAt?: string | null;
}

export interface PauseRecord {
  id: string;
  startDay: CalendarDay;
  /** Inclusive. Null: still paused. */
  endDay: CalendarDay | null;
  reason: string;
  authority: string;
}

export interface ExtensionRecord {
  id: string;
  agreedOnDay: CalendarDay;
  unionPartyRef: string | null;
  employerPartyRef: string | null;
  parentPartyRef: string | null;
  form: string;
  newDueDay?: CalendarDay | null;
  additionalDays?: number | null;
}

/** What the matter records about itself for rule selection. */
export interface MatterFacts {
  regime: string | null;
  procedureRoute: string | null;
  employerId: string | null;
  bargainingGroup: string | null;
  classification: string | null;
  /** Determinations recorded by a human (key → recorded). */
  determinations: Record<string, boolean>;
}

export type ProceduralExceptionCode =
  | 'no_applicable_rule_set'
  | 'ambiguous_rule_sets'
  | 'rule_set_not_adopted'
  | 'rule_source_expired'
  | 'missing_matter_fact'
  | 'determination_required'
  | 'clock_not_defined'
  | 'invalid_clock_definition'
  | 'missing_trigger'
  | 'ambiguous_trigger'
  | 'holiday_calendar_ambiguous'
  | 'missing_reference_day'
  | 'missing_trigger_instant'
  | 'holiday_calendar_missing'
  | 'holiday_calendar_not_adopted'
  | 'holiday_calendar_coverage_gap'
  | 'clock_paused'
  | 'pause_not_permitted'
  | 'invalid_pause'
  | 'extension_not_permitted'
  | 'extension_party_missing'
  | 'extension_after_expiry'
  | 'extension_invalid'
  | 'extension_exceeds_maximum'
  | 'invalid_time_zone';

export interface ProceduralException {
  code: ProceduralExceptionCode;
  message: string;
  detail?: Record<string, unknown>;
}
