/**
 * UE-OFFICER-EXECUTIVE-CANONICAL-2.1 §I/§IV/§XII — executive mandate evaluation.
 *
 * Doctrine encoded here (and only this; no bylaw rule, term length or approval
 * threshold is invented):
 *  - A title confers nothing. Baseline authority for every consequential action
 *    is NONE; authority exists only through a verified mandate (office + term)
 *    plus an explicit, unexpired delegation for that action in that organization.
 *  - Collective acts (adopting a decision, certifying an election) are never an
 *    individual's action, whatever the office.
 *  - Confidential matter content needs a separate matter-level grant.
 *  - Self-approval and recused participation are always denied.
 *  - Persons holding several offices act in one declared capacity; mandates are
 *    not merged.
 *
 * There is currently NO authoritative store of offices, terms or delegations, so
 * `loadVerifiedMandates` returns an empty set and every mandate-gated action
 * fails closed. That is a recorded stakeholder-validation / schema dependency,
 * not a bug. This module is the evaluator the store must feed; it is not itself
 * proof that any capability is operational.
 */

export type ExecutiveOffice =
  | 'president'
  | 'vice_president'
  | 'secretary_treasurer'
  | 'recording_secretary'
  | 'board_member'
  | 'executive_director'
  | 'bargaining_chair'
  | 'committee_chair'
  | 'trustee'
  | 'acting_officer';

export type ExecutiveCapacity = 'elected' | 'appointed' | 'operational' | 'acting';

export type ExecutiveAction =
  | 'decision.adopt'
  | 'expenditure.approve'
  | 'agreement.sign'
  | 'correspondence.sign'
  | 'election.certify'
  | 'delegation.grant'
  | 'matter.view';

export interface ExecutiveDelegation {
  action: ExecutiveAction;
  organizationId: string;
  effectiveFrom: Date;
  /** Required: an open-ended delegation is not a valid delegation. */
  expiresAt: Date;
  /** Monetary ceiling for expenditure.approve. */
  limit?: number;
}

export interface ExecutiveMandate {
  userId: string;
  organizationId: string;
  office: ExecutiveOffice;
  capacity: ExecutiveCapacity;
  termStart: Date;
  termEnd: Date;
  revokedAt?: Date | null;
  /** True only when verified against the governing instrument. */
  verified: boolean;
  delegations: readonly ExecutiveDelegation[];
}

export type MandateDenial =
  | 'NO_VERIFIED_MANDATE'
  | 'NOT_ACTING_IN_THAT_CAPACITY'
  | 'WRONG_ORGANIZATION'
  | 'MANDATE_UNVERIFIED'
  | 'OUTSIDE_TERM'
  | 'COLLECTIVE_BODY_REQUIRED'
  | 'INDEPENDENT_ELECTION_AUTHORITY_REQUIRED'
  | 'MATTER_GRANT_REQUIRED'
  | 'NO_DELEGATION'
  | 'AMOUNT_REQUIRED'
  | 'LIMIT_EXCEEDED'
  | 'REQUESTER_REQUIRED'
  | 'SELF_APPROVAL'
  | 'RECUSED';

export type MandateDecision = { allowed: true } | { allowed: false; reason: MandateDenial };

export interface MandateRequest {
  userId: string;
  organizationId: string;
  action: ExecutiveAction;
  now: Date;
  /** All mandates held by this person; the evaluator never merges them. */
  mandates: readonly ExecutiveMandate[];
  /** The office the person is acting as for this request. */
  activeOffice: ExecutiveOffice | null;
  amount?: number;
  /** Who requested or originated the thing being approved. */
  requesterUserId?: string;
  recusedUserIds?: readonly string[];
  /** An effective grant on the specific matter, resolved by the case-access layer. */
  matterGrantActive?: boolean;
}

const deny = (reason: MandateDenial): MandateDecision => ({ allowed: false, reason });

export function evaluateExecutiveAction(req: MandateRequest): MandateDecision {
  // Collective and independent acts are not individual powers under any office.
  if (req.action === 'decision.adopt') return deny('COLLECTIVE_BODY_REQUIRED');
  if (req.action === 'election.certify') return deny('INDEPENDENT_ELECTION_AUTHORITY_REQUIRED');

  const own = req.mandates.filter((m) => m.userId === req.userId);
  if (own.length === 0) return deny('NO_VERIFIED_MANDATE');

  const mandate = own.find((m) => m.office === req.activeOffice);
  if (!req.activeOffice || !mandate) return deny('NOT_ACTING_IN_THAT_CAPACITY');
  if (mandate.organizationId !== req.organizationId) return deny('WRONG_ORGANIZATION');
  if (!mandate.verified) return deny('MANDATE_UNVERIFIED');

  const t = req.now.getTime();
  const revoked = mandate.revokedAt ? mandate.revokedAt.getTime() <= t : false;
  if (revoked || t < mandate.termStart.getTime() || t >= mandate.termEnd.getTime()) {
    return deny('OUTSIDE_TERM');
  }

  if (req.recusedUserIds?.includes(req.userId)) return deny('RECUSED');

  if (req.action === 'matter.view') {
    return req.matterGrantActive === true ? { allowed: true } : deny('MATTER_GRANT_REQUIRED');
  }

  const delegation = mandate.delegations.find(
    (d) =>
      d.action === req.action &&
      d.organizationId === req.organizationId &&
      d.effectiveFrom.getTime() <= t &&
      t < d.expiresAt.getTime(),
  );
  if (!delegation) return deny('NO_DELEGATION');

  if (req.action === 'expenditure.approve') {
    if (typeof req.amount !== 'number' || !Number.isFinite(req.amount) || req.amount < 0) {
      return deny('AMOUNT_REQUIRED');
    }
    if (typeof delegation.limit !== 'number' || req.amount > delegation.limit) {
      return deny('LIMIT_EXCEEDED');
    }
    if (!req.requesterUserId) return deny('REQUESTER_REQUIRED');
    if (req.requesterUserId === req.userId) return deny('SELF_APPROVAL');
  }

  return { allowed: true };
}

/**
 * Authoritative mandate source. No office/term/delegation store exists yet, so
 * this deliberately returns nothing. Do not derive mandates from role labels.
 */
export async function loadVerifiedMandates(
  _userId: string,
  _organizationId: string,
): Promise<readonly ExecutiveMandate[]> {
  return [];
}
