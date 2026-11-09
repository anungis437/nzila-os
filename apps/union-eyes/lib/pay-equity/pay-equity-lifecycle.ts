/**
 * Pay equity exercise lifecycle (DEF-0B5-PAY-EQUITY-NO-STATE-MACHINE-OR-DEADLINES).
 *
 * The status of a pay_equity_exercises row changes only through POST /api/cnesst/pay-equity/{id}/transition, one step of the graph below at a
 * time, and only with the facts that step records (the committee formation date, the adjustment total, the posting date and the contest deadline,
 * the payment date, the maintenance dates). The generic routes no longer write the status or any of those facts, so an exercise cannot be put at
 * adjustments_paid without having been calculated and posted. Every step commits with its audit record.
 *
 * Deadlines. The schema comments state two periods: results may be contested for sixty days after posting, and a maintenance evaluation is due
 * every five years. No versioned statutory source for either is held in this repository (no citation, no in-force date, no confirmation by a
 * person accountable for it), so neither is applied as law. Each is a rule entry below marked UNCONFIRMED: the officer states the contest deadline
 * and the next maintenance date as facts of the step, the response shows what the unconfirmed rule would have proposed beside them, and the
 * audit record keeps both. A rule becomes applicable only by a reviewed change that cites the provision and its version and marks it CONFIRMED.
 * What the route does enforce is the deadline the exercise records: a contest received after the recorded contest deadline is refused.
 */
import { payEquityStatusEnum } from '@/db/schema';

export type PayEquityStatus = (typeof payEquityStatusEnum.enumValues)[number];

/** The steps the lifecycle allows, from each status. Anything not listed (including a status to itself) is refused. */
export const PAY_EQUITY_TRANSITIONS: Readonly<Record<PayEquityStatus, readonly PayEquityStatus[]>> = {
  not_started: ['committee_formed'],
  committee_formed: ['evaluation_in_progress'],
  evaluation_in_progress: ['adjustments_calculated'],
  adjustments_calculated: ['results_posted'],
  results_posted: ['contested', 'adjustments_paid'],
  contested: ['evaluation_in_progress', 'adjustments_calculated'],
  adjustments_paid: ['maintenance_due'],
  maintenance_due: ['maintenance_completed'],
  maintenance_completed: ['maintenance_due'],
};

export function allowedTransitions(from: PayEquityStatus): readonly PayEquityStatus[] {
  return PAY_EQUITY_TRANSITIONS[from] ?? [];
}
export function isAllowedTransition(from: PayEquityStatus, to: PayEquityStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export type DeadlineRuleConfirmation = 'UNCONFIRMED' | 'CONFIRMED';

export interface PayEquityDeadlineRule {
  id: string;
  /** Bumped on any change to the period or its source. */
  version: string;
  jurisdiction: 'QC';
  describes: string;
  period: { days: number } | { years: number };
  /** Where the period is stated today. Not a statutory citation. */
  statedIn: string;
  confirmation: DeadlineRuleConfirmation;
  /** What is needed before the rule may be applied as law. */
  confirmationNeeded: string;
}

export const PAY_EQUITY_DEADLINE_RULES = {
  contestPeriod: {
    id: 'QC-PAY-EQUITY-CONTEST-PERIOD',
    version: '0-unconfirmed',
    jurisdiction: 'QC',
    describes: 'The period after the results are posted during which they may be contested.',
    period: { days: 60 },
    statedIn: 'db/schema/domains/health-safety/cnesst-schema.ts (comment on contest_deadline: "60 days from posting")',
    confirmation: 'UNCONFIRMED',
    confirmationNeeded: 'The provision of the Pay Equity Act (CQLR c E-12.001) that sets the period, its in-force version, whether it runs in calendar days, and how it applies to a maintenance posting, confirmed by the person accountable for the programme\'s legal content.',
  },
  maintenanceInterval: {
    id: 'QC-PAY-EQUITY-MAINTENANCE-INTERVAL',
    version: '0-unconfirmed',
    jurisdiction: 'QC',
    describes: 'The interval after which a pay equity maintenance evaluation is next due.',
    period: { years: 5 },
    statedIn: 'db/schema/domains/health-safety/cnesst-schema.ts (comments on next_maintenance_due and the maintenance_due status: "every 5 years")',
    confirmation: 'UNCONFIRMED',
    confirmationNeeded: 'The provision of the Pay Equity Act that sets the maintenance interval, its in-force version and the date it runs from (posting of the previous evaluation or another event), confirmed by the person accountable for the programme\'s legal content.',
  },
} as const satisfies Record<string, PayEquityDeadlineRule>;

/** A calendar day (YYYY-MM-DD) shifted by the rule's period. Pure date arithmetic in UTC; no time of day is involved. */
export function addPeriod(day: string, period: PayEquityDeadlineRule['period']): string {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, date));
  if ('days' in period) value.setUTCDate(value.getUTCDate() + period.days);
  else value.setUTCFullYear(value.getUTCFullYear() + period.years);
  return value.toISOString().slice(0, 10);
}

export interface DeadlineProposal {
  ruleId: string;
  ruleVersion: string;
  confirmation: DeadlineRuleConfirmation;
  /** What the rule would give. Never written by itself while the rule is unconfirmed. */
  proposedDate: string;
  /** The date the officer stated and the exercise records. */
  recordedDate: string;
}

export function proposal(rule: PayEquityDeadlineRule, from: string, recordedDate: string): DeadlineProposal {
  return { ruleId: rule.id, ruleVersion: rule.version, confirmation: rule.confirmation, proposedDate: addPeriod(from, rule.period), recordedDate };
}

/** The facts a step may carry; each step names the ones it requires. */
export interface TransitionFacts {
  committeeFormationDate?: string;
  totalAdjustmentAmount?: string;
  resultsPostedDate?: string;
  contestDeadline?: string;
  contestedOn?: string;
  adjustmentsPaidDate?: string;
  nextMaintenanceDue?: string;
  maintenanceEvaluationDate?: string;
  reason?: string;
}

export interface CurrentExercise {
  status: PayEquityStatus;
  resultsPostedDate: string | null;
  contestDeadline: string | null;
  adjustmentsPaidDate: string | null;
  maintenanceEvaluationDate: string | null;
}

export type TransitionPlan =
  | { ok: true; set: Record<string, unknown>; deadlines: DeadlineProposal[] }
  | { ok: false; status: 400 | 409; message: string };

const refuse = (status: 400 | 409, message: string): TransitionPlan => ({ ok: false, status, message });

/**
 * Decides one step: whether it is allowed from the current status and which columns it writes. Pure, so every rule is testable without a
 * database. Dates are calendar days (YYYY-MM-DD), compared as strings.
 */
export function planTransition(current: CurrentExercise, to: PayEquityStatus, facts: TransitionFacts): TransitionPlan {
  if (!isAllowedTransition(current.status, to)) {
    return refuse(409, `A pay equity exercise cannot move from ${current.status} to ${to}; allowed: ${allowedTransitions(current.status).join(', ') || 'none'}`);
  }
  const need = (field: keyof TransitionFacts) => (facts[field] === undefined || facts[field] === '' ? field : null);
  const missing = (fields: Array<keyof TransitionFacts>) => fields.map(need).filter(Boolean) as string[];
  const requireFacts = (fields: Array<keyof TransitionFacts>): TransitionPlan | null => {
    const absent = missing(fields);
    return absent.length > 0 ? refuse(400, `The step to ${to} records ${absent.join(', ')}`) : null;
  };

  switch (to) {
    case 'committee_formed': {
      const fault = requireFacts(['committeeFormationDate']);
      if (fault) return fault;
      return { ok: true, set: { committeeFormed: true, committeeFormationDate: facts.committeeFormationDate }, deadlines: [] };
    }
    case 'evaluation_in_progress':
      return { ok: true, set: {}, deadlines: [] };
    case 'adjustments_calculated': {
      const fault = requireFacts(['totalAdjustmentAmount']);
      if (fault) return fault;
      return { ok: true, set: { totalAdjustmentAmount: facts.totalAdjustmentAmount }, deadlines: [] };
    }
    case 'results_posted': {
      const fault = requireFacts(['resultsPostedDate', 'contestDeadline']);
      if (fault) return fault;
      if (facts.contestDeadline! <= facts.resultsPostedDate!) return refuse(400, 'The contest deadline must fall after the posting date');
      return {
        ok: true,
        set: { resultsPostedDate: facts.resultsPostedDate, contestDeadline: facts.contestDeadline },
        deadlines: [proposal(PAY_EQUITY_DEADLINE_RULES.contestPeriod, facts.resultsPostedDate!, facts.contestDeadline!)],
      };
    }
    case 'contested': {
      const fault = requireFacts(['contestedOn']);
      if (fault) return fault;
      if (!current.resultsPostedDate || !current.contestDeadline) return refuse(409, 'The exercise records no posting date or contest deadline');
      if (facts.contestedOn! < current.resultsPostedDate) return refuse(400, 'A contest cannot precede the posting of the results');
      if (facts.contestedOn! > current.contestDeadline) return refuse(409, `The contest period recorded for this exercise ended on ${current.contestDeadline}`);
      return { ok: true, set: {}, deadlines: [] };
    }
    case 'adjustments_paid': {
      const fault = requireFacts(['adjustmentsPaidDate']);
      if (fault) return fault;
      if (current.resultsPostedDate && facts.adjustmentsPaidDate! < current.resultsPostedDate) {
        return refuse(400, 'Adjustments cannot be paid before the results were posted');
      }
      return { ok: true, set: { adjustmentsPaidDate: facts.adjustmentsPaidDate }, deadlines: [] };
    }
    case 'maintenance_due': {
      const fault = requireFacts(['nextMaintenanceDue']);
      if (fault) return fault;
      const from = current.maintenanceEvaluationDate ?? current.resultsPostedDate;
      return {
        ok: true,
        set: { nextMaintenanceDue: facts.nextMaintenanceDue },
        deadlines: from ? [proposal(PAY_EQUITY_DEADLINE_RULES.maintenanceInterval, from, facts.nextMaintenanceDue!)] : [],
      };
    }
    case 'maintenance_completed': {
      const fault = requireFacts(['maintenanceEvaluationDate']);
      if (fault) return fault;
      return { ok: true, set: { maintenanceEvaluationDate: facts.maintenanceEvaluationDate }, deadlines: [] };
    }
    default:
      return refuse(409, `No step leads to ${to}`);
  }
}
