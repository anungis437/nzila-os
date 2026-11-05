/**
 * Process audit for a secret ballot (UE-CONV-K-009).
 *
 * The ballot choice is not audited. Eligibility, issuance, acceptance, proxy authorization and recount are.
 * A record that names a person and a choice together is refused: that pair would link a voter to a selection.
 * Acceptance names the receipt and not the member. Eligibility and proxy authorization name the members and not
 * an option. A recount names the session total and not a voter.
 */
import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'

const PERSON_KEYS = ['memberId', 'voterId', 'userId', 'voterHash', 'proxyMemberId', 'actorId', 'holderUserId']
const CHOICE_KEYS = ['optionId', 'choice', 'selection', 'preference', 'option', 'winners']

export function ballotProcessLinksChoice(details: Record<string, unknown>): boolean {
  const present = (keys: string[]) => keys.some((key) => details[key] !== undefined && details[key] !== null && details[key] !== '')
  return present(PERSON_KEYS) && present(CHOICE_KEYS)
}

export function assertBallotProcessSeparable(details: Record<string, unknown>): void {
  if (ballotProcessLinksChoice(details)) {
    throw new Error('A ballot process record cannot name both a person and a ballot choice.')
  }
}

async function write(tx: RLSTx, organizationId: string, action: string, sessionId: string, details: Record<string, unknown>): Promise<void> {
  assertBallotProcessSeparable(details)
  await persistAtomicAudit(tx, {
    organizationId,
    action,
    resourceType: 'voting_sessions',
    resourceId: sessionId,
    details,
  })
}

/** An eligible member was issued a ballot. No option is recorded. */
export async function recordBallotEligibility(
  tx: RLSTx,
  input: { organizationId: string; sessionId: string; memberId: string },
): Promise<void> {
  await write(tx, input.organizationId, 'voting.ballot.eligibility_issued', input.sessionId, {
    sessionId: input.sessionId,
    memberId: input.memberId,
    eligible: true,
  })
}

/** A ballot was accepted. The receipt is not joined to a member or an option in this record. */
export async function recordBallotAcceptance(
  tx: RLSTx,
  input: { organizationId: string; sessionId: string; receiptId: string },
): Promise<void> {
  await write(tx, input.organizationId, 'voting.ballot.accepted', input.sessionId, {
    sessionId: input.sessionId,
    receiptId: input.receiptId,
    choiceRecorded: false,
  })
}

/** A member authorized a different eligible member to carry their proxy. No option is recorded. */
export async function recordProxyAuthorization(
  tx: RLSTx,
  input: { organizationId: string; sessionId: string; memberId: string; proxyMemberId: string },
): Promise<void> {
  await write(tx, input.organizationId, 'voting.proxy.authorized', input.sessionId, {
    sessionId: input.sessionId,
    memberId: input.memberId,
    proxyMemberId: input.proxyMemberId,
  })
}

/** A closed session was counted. The total is recorded. No voter and no option is recorded. */
export async function recordRecount(
  tx: RLSTx,
  input: { organizationId: string; sessionId: string; totalBallots: number },
): Promise<void> {
  if (!Number.isInteger(input.totalBallots) || input.totalBallots < 0) {
    throw new Error('A recount total must be a non-negative integer.')
  }
  await write(tx, input.organizationId, 'voting.ballot.recount', input.sessionId, {
    sessionId: input.sessionId,
    totalBallots: input.totalBallots,
    voterChoiceLinked: false,
  })
}
