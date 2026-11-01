/**
 * Counterpart acceptance of a pilot contract: what evidence it rests on, and what the platform will do on it.
 *
 * A pilot contract is accepted by the OTHER party. The platform has no counterpart identity and no signature provider, so what it holds
 * when an administrator records an acceptance is the administrator's statement and a reference, not proof the counterpart accepted. Calling
 * that "signed" is the defect this module closes: the evidence level is a first-class, stored fact, and every effect that follows (the
 * contract becoming active, an invoice, a subscription) carries it.
 *
 *   operator_recorded_unverified   an administrator says the counterpart accepted and gives a reference. Nothing checked it.
 *   provider_verified              a registered verifier confirmed the reference with the signature provider it names.
 *
 * The channel the administrator types (including "e_signature_provider") is a CLAIM and is stored as one (`channelClaimed`).
 *
 * PROVISIONAL: whether an operator's recorded acceptance may activate billing, or only a provider-verified one, is an institutional and
 * commercial decision that nobody has made (`approvedBy: null`). Until someone approves it, the safe reading applies: an administrator's
 * statement is evidence that a claim was made, never proof that the counterpart accepted, so it cannot activate a contract, issue an invoice,
 * start the pilot or open a subscription. The claim is kept on the contract as a claim, every refusal is recorded, and a verifier exists only
 * if code registers one for a channel (none does). Permitting operator-recorded acceptance needs BOTH the setting and an approver: the
 * setting alone is not honoured.
 *
 * Contracts activated under the earlier permissive default are not rewritten. They are classified (`classifyAcceptanceStanding`) so that
 * what is verifiable and what is not can be told apart, and they cannot advance further until their acceptance is verified.
 */
export type AcceptanceChannel = 'countersigned_document' | 'e_signature_provider' | 'written_confirmation';

export interface CounterpartAcceptanceClaim {
  acceptedByName: string;
  acceptedByRole: string;
  channel: AcceptanceChannel;
  evidenceReference: string;
}

export type AcceptanceVerification =
  | { status: 'provider_verified'; provider: string; verifiedAt: string; providerReference: string }
  | { status: 'operator_recorded_unverified'; reason: 'no_verifier_registered_for_channel' | 'verifier_could_not_confirm' | 'verifier_unavailable' };

/** A provider adapter. Registered per channel by code that has been approved; the platform ships none. */
export interface AcceptanceVerifier {
  readonly provider: string;
  verify(claim: CounterpartAcceptanceClaim): Promise<{ verified: boolean; providerReference?: string }>;
}

export const COUNTERPART_ACCEPTANCE_POLICY = {
  version: 'ue-pilot-acceptance/provisional-2',
  approvedBy: null as string | null,
  /** 'provider_verified' (the unapproved default) refuses to act on an unverified acceptance. 'operator_recorded' is honoured only with an approver. */
  activationRequires: 'provider_verified' as 'operator_recorded' | 'provider_verified',
};

export type AcceptancePolicy = typeof COUNTERPART_ACCEPTANCE_POLICY;

/** Commercial states that rest on the counterpart's acceptance: the contract is signed, billed, running, finished or subscribed. */
export const ACCEPTANCE_DEPENDENT_STATES = ['contract_signed', 'invoice_issued', 'pilot_active', 'pilot_complete', 'subscription_offered', 'subscription_active'] as const;
export type AcceptanceDependentState = (typeof ACCEPTANCE_DEPENDENT_STATES)[number];
export const isAcceptanceDependentState = (state: string): state is AcceptanceDependentState => (ACCEPTANCE_DEPENDENT_STATES as readonly string[]).includes(state);

/** The evidence an effect rests on: a verification level, or none at all (no accepted contract exists). */
export type AcceptanceEvidenceLevel = AcceptanceVerification['status'] | 'none';

const verifiers = new Map<AcceptanceChannel, AcceptanceVerifier>();

export function registerAcceptanceVerifier(channel: AcceptanceChannel, verifier: AcceptanceVerifier): void {
  verifiers.set(channel, verifier);
}

export function clearAcceptanceVerifiers(): void {
  verifiers.clear();
}

/** Never throws: a verifier that fails leaves the acceptance unverified, which is the honest state. */
export async function verifyCounterpartAcceptance(
  claim: CounterpartAcceptanceClaim,
  now: () => Date = () => new Date(),
): Promise<AcceptanceVerification> {
  const verifier = verifiers.get(claim.channel);
  if (!verifier) return { status: 'operator_recorded_unverified', reason: 'no_verifier_registered_for_channel' };
  try {
    const result = await verifier.verify(claim);
    if (!result.verified || !result.providerReference) return { status: 'operator_recorded_unverified', reason: 'verifier_could_not_confirm' };
    return { status: 'provider_verified', provider: verifier.provider, verifiedAt: now().toISOString(), providerReference: result.providerReference };
  } catch {
    return { status: 'operator_recorded_unverified', reason: 'verifier_unavailable' };
  }
}

export interface AcceptanceDecision {
  allowed: boolean;
  /** The specific operation that was blocked and what would unblock it, when it was. */
  blocked?: { operation: string; requires: 'provider_verified_acceptance'; policyVersion: string; policyApprovedBy: string | null; evidence: AcceptanceEvidenceLevel };
}

/**
 * Whether an acceptance of this evidence level may be acted on (activated, invoiced, started, subscribed) under the policy. No acceptance at
 * all never supports anything. An operator-recorded acceptance supports an effect only when the policy both says so and names who approved it.
 */
export function acceptanceMaySupport(
  operation: string,
  evidence: AcceptanceEvidenceLevel | null | undefined,
  policy: AcceptancePolicy = COUNTERPART_ACCEPTANCE_POLICY,
): AcceptanceDecision {
  const level: AcceptanceEvidenceLevel = evidence ?? 'operator_recorded_unverified';
  const operatorRecordedPermitted = policy.activationRequires === 'operator_recorded' && policy.approvedBy !== null && policy.approvedBy.trim() !== '';
  if (level === 'provider_verified' || (level === 'operator_recorded_unverified' && operatorRecordedPermitted)) return { allowed: true };
  return {
    allowed: false,
    blocked: { operation, requires: 'provider_verified_acceptance', policyVersion: policy.version, policyApprovedBy: policy.approvedBy, evidence: level },
  };
}

/** The evidence level stored with an accepted contract (older records carry only the operator-recorded marker). */
export function acceptanceEvidenceOf(contractMetadata: unknown): AcceptanceVerification['status'] {
  const accepted = (contractMetadata as { counterpartAcceptance?: { verificationDetail?: { status?: string } } } | null | undefined)?.counterpartAcceptance;
  return accepted?.verificationDetail?.status === 'provider_verified' ? 'provider_verified' : 'operator_recorded_unverified';
}

export interface RecordedAcceptanceClaim {
  claimedByRole: string;
  channelClaimed: AcceptanceChannel;
  evidenceReference: string;
  recordedBy: string;
  recordedAt: string;
  /** A claim is what an administrator said. It is never promoted to acceptance by being recorded. */
  standing: 'unverified_claim';
  reason: string;
  policyVersion: string;
}

export const MAX_RECORDED_ACCEPTANCE_CLAIMS = 25;

/**
 * Adds an acceptance claim to a contract's metadata as evidence that it was made, leaving everything else (including any earlier claims, up
 * to a bound) as it was. The contract's status is not touched and the claim does not appear under `counterpartAcceptance`, which is
 * reserved for an acceptance the platform acted on.
 */
export function withRecordedAcceptanceClaim(metadata: unknown, claim: RecordedAcceptanceClaim): Record<string, unknown> {
  const base = { ...((metadata ?? {}) as Record<string, unknown>) };
  const earlier = Array.isArray(base.acceptanceClaims) ? (base.acceptanceClaims as unknown[]) : [];
  return { ...base, acceptanceClaims: [...earlier, claim].slice(-MAX_RECORDED_ACCEPTANCE_CLAIMS) };
}

export type AcceptanceStanding =
  | { standing: 'verified'; explanation: string }
  | { standing: 'activated_on_unverified_acceptance'; explanation: string }
  | { standing: 'awaiting_verified_acceptance'; explanation: string; claimsRecorded: number }
  | { standing: 'no_acceptance'; explanation: string };

/**
 * What a contract's acceptance amounts to, derived from what is stored and never written back. A contract that became active on an
 * administrator's statement (under the earlier permissive default) is named as such: it is not verifiable, it stays as it is, and it cannot
 * move the pilot forward until its acceptance is verified.
 */
export function classifyAcceptanceStanding(contract: { status?: string | null; metadata?: unknown } | null | undefined): AcceptanceStanding {
  if (!contract) return { standing: 'no_acceptance', explanation: 'No contract exists for this pilot.' };
  const metadata = (contract.metadata ?? {}) as { counterpartAcceptance?: unknown; acceptanceClaims?: unknown };
  const accepted = metadata.counterpartAcceptance !== undefined && metadata.counterpartAcceptance !== null;
  if (contract.status === 'active' && accepted) {
    return acceptanceEvidenceOf(metadata) === 'provider_verified'
      ? { standing: 'verified', explanation: 'The counterpart\'s acceptance was confirmed with a signature provider.' }
      : { standing: 'activated_on_unverified_acceptance', explanation: 'The contract was activated on an administrator\'s statement that the counterpart accepted. Nothing confirmed it. It is kept as recorded and cannot advance the pilot until the acceptance is verified.' };
  }
  const claims = Array.isArray(metadata.acceptanceClaims) ? metadata.acceptanceClaims.length : 0;
  return claims > 0
    ? { standing: 'awaiting_verified_acceptance', claimsRecorded: claims, explanation: 'An acceptance was claimed but nothing verified it, so the contract is not accepted.' }
    : { standing: 'no_acceptance', explanation: 'The counterpart has not accepted the contract.' };
}
