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
 * commercial decision. The default keeps what this release already did (operator-recorded acceptance suffices) but names it, stamps every
 * downstream record with the evidence level, and carries `approvedBy: null`. Requiring verification is one setting away and is then refused
 * as a specific blocked operation with the policy that blocked it. No provider is activated here: a verifier exists only if code registers
 * one for a channel, and none does.
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
  version: 'ue-pilot-acceptance/provisional-1',
  approvedBy: null as string | null,
  /** 'operator_recorded' keeps the earlier behaviour; 'provider_verified' refuses to activate billing on an unverified acceptance. */
  activationRequires: 'operator_recorded' as 'operator_recorded' | 'provider_verified',
};

export type AcceptancePolicy = typeof COUNTERPART_ACCEPTANCE_POLICY;

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
  blocked?: { operation: string; requires: 'provider_verified_acceptance'; policyVersion: string; policyApprovedBy: string | null; evidence: AcceptanceVerification['status'] };
}

/** Whether an acceptance of this evidence level may be acted on (activated, invoiced, subscribed) under the policy. */
export function acceptanceMaySupport(
  operation: string,
  evidence: AcceptanceVerification['status'] | null | undefined,
  policy: AcceptancePolicy = COUNTERPART_ACCEPTANCE_POLICY,
): AcceptanceDecision {
  const level: AcceptanceVerification['status'] = evidence ?? 'operator_recorded_unverified';
  if (policy.activationRequires === 'operator_recorded' || level === 'provider_verified') return { allowed: true };
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
