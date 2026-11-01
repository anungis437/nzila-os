/**
 * Notice to the people a workbook names.
 *
 * The workbook records a role, and optionally a display name and notes, for individuals who may not know they are recorded. Whether they
 * have been told, how, and by whom is an institutional and legal decision this code does not make. What it does make is the difference
 * between what a record rests on, because "someone typed that the person was told" and "a delivery was confirmed" are not the same fact:
 *
 *   none               no notice is recorded.
 *   self_reported      a person with authority over the claimed workbook said the person was told, and gave a channel and a reference. Nothing
 *                      confirmed it, and nothing here sent it.
 *   delivery_verified  a registered delivery verifier confirmed the reference with the channel's provider. The provider, its reference and the
 *                      time are kept. No verifier is registered, so nothing can reach this level in this release.
 *
 * PROVISIONAL, and conservative while unapproved (`approvedBy: null`): a person's display name or private note may be written, and may be
 * shown to anyone but the claimant, only when the notice behind it is delivery-verified. Until a verifier exists that means no identifying
 * detail can be newly written, and detail that already exists is withheld from reads by everyone except the claimant. The role, the
 * responsibility and every other field stay available, so the workbook still works for people who are not named. A looser requirement
 * ('self_reported' or 'none') is honoured only when the policy also names who approved it, so the setting alone changes nothing.
 *
 * A notice is recorded by an identified person with authority over the claimed workbook. An unclaimed workbook has no such person, so a
 * notice cannot be recorded for it and that is reported, not faked.
 */
import { z } from 'zod';

export type NoticeEvidence = 'none' | 'self_reported' | 'delivery_verified';
export type NoticeRequirement = NoticeEvidence;

export const HOLDER_NOTICE_POLICY = {
  version: 'ue-workbook-holder-notice/provisional-2',
  approvedBy: null as string | null,
  /** The evidence an identifying detail needs. Anything looser than 'delivery_verified' counts only with an approver. */
  identifyingDetailRequires: 'delivery_verified' as NoticeRequirement,
};
export type HolderNoticePolicy = typeof HOLDER_NOTICE_POLICY;

/** The requirement in force: the stated one when someone approved it, otherwise the strictest. */
export function requiredNoticeEvidence(policy: HolderNoticePolicy = HOLDER_NOTICE_POLICY): NoticeRequirement {
  return policy.approvedBy !== null && policy.approvedBy.trim() !== '' ? policy.identifyingDetailRequires : 'delivery_verified';
}

const RANK: Record<NoticeEvidence, number> = { none: 0, self_reported: 1, delivery_verified: 2 };

export function noticeSatisfies(evidence: NoticeEvidence, policy: HolderNoticePolicy = HOLDER_NOTICE_POLICY): boolean {
  return RANK[evidence] >= RANK[requiredNoticeEvidence(policy)];
}

export const NOTICE_CHANNELS = ['in_person', 'email', 'letter', 'other'] as const;
export type NoticeChannel = (typeof NOTICE_CHANNELS)[number];

export const holderNoticeSchema = z.object({
  channel: z.enum(NOTICE_CHANNELS),
  reference: z.string().trim().max(255).optional(),
});
export type HolderNoticeInput = z.infer<typeof holderNoticeSchema>;

export const IDENTIFYING_FIELDS = ['displayName', 'notes'] as const;

export type NoticeDeliveryVerification =
  | { status: 'delivery_verified'; provider: string; verifiedAt: string; providerReference: string }
  | { status: 'self_reported'; reason: 'no_verifier_registered_for_channel' | 'no_reference_to_verify' | 'verifier_could_not_confirm' | 'verifier_unavailable' };

/** A delivery adapter for one channel. Registered by code that has been approved; the platform ships none. */
export interface NoticeDeliveryVerifier {
  readonly provider: string;
  verify(notice: { channel: NoticeChannel; reference: string }): Promise<{ verified: boolean; providerReference?: string }>;
}

const verifiers = new Map<NoticeChannel, NoticeDeliveryVerifier>();
export const registerNoticeDeliveryVerifier = (channel: NoticeChannel, verifier: NoticeDeliveryVerifier): void => void verifiers.set(channel, verifier);
export const clearNoticeDeliveryVerifiers = (): void => verifiers.clear();

/** Never throws, and never upgrades on its own: without a registered verifier that confirms, a notice stays what the person said it was. */
export async function verifyNoticeDelivery(notice: HolderNoticeInput, now: () => Date = () => new Date()): Promise<NoticeDeliveryVerification> {
  const verifier = verifiers.get(notice.channel);
  if (!verifier) return { status: 'self_reported', reason: 'no_verifier_registered_for_channel' };
  if (!notice.reference) return { status: 'self_reported', reason: 'no_reference_to_verify' };
  try {
    const result = await verifier.verify({ channel: notice.channel, reference: notice.reference });
    if (!result.verified || !result.providerReference) return { status: 'self_reported', reason: 'verifier_could_not_confirm' };
    return { status: 'delivery_verified', provider: verifier.provider, verifiedAt: now().toISOString(), providerReference: result.providerReference };
  } catch {
    return { status: 'self_reported', reason: 'verifier_unavailable' };
  }
}

export class HolderNoticeBlocked extends Error {
  constructor(
    readonly code: 'NOTICE_REQUIRES_CLAIM' | 'NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL',
    readonly blockedOperation: { operation: string; requires: string; policyVersion: string; policyApprovedBy: string | null; evidence?: NoticeEvidence },
  ) {
    super(code);
    this.name = 'HolderNoticeBlocked';
  }
}

/** The columns that record a notice, set by the person who recorded it. Delivery evidence is added only when a verifier confirmed it. */
export function noticeColumns(notice: HolderNoticeInput, actorUserId: string, now: Date, verification?: NoticeDeliveryVerification | null) {
  const verified = verification?.status === 'delivery_verified' ? verification : null;
  return {
    noticeState: 'notified' as const,
    notifiedAt: now,
    notifiedBy: actorUserId,
    noticeChannel: notice.channel,
    noticeReference: notice.reference ? notice.reference : null,
    noticeEvidence: (verified ? 'delivery_verified' : 'self_reported') as NoticeEvidence,
    noticeVerifiedAt: verified ? new Date(verified.verifiedAt) : null,
    noticeVerifiedBy: verified ? verified.provider : null,
    noticeProviderReference: verified ? verified.providerReference : null,
  };
}

export interface NoticeRow {
  displayName: string | null;
  notes: string | null;
  noticeState: string | null;
  noticeEvidence?: string | null;
}

/** What a stored row's notice rests on. A row recorded before evidence was kept (state 'notified') is a person's statement. */
export function noticeEvidenceOf(row: { noticeState?: string | null; noticeEvidence?: string | null }): NoticeEvidence {
  if (row.noticeEvidence === 'delivery_verified') return 'delivery_verified';
  if (row.noticeEvidence === 'self_reported' || row.noticeState === 'notified') return 'self_reported';
  return 'none';
}

/**
 * Refuses a write that records a notice for an unclaimed workbook (nobody to attribute it to), and a write of identifying detail that is not
 * backed by enough notice evidence. The evidence is what the request's own notice reached (after verification) or what the holder already has.
 * Clearing a field (writing null) is never refused: it removes identifying detail.
 */
export function assertNoticeContract(
  input: {
    writesIdentifyingDetail: boolean;
    notice: HolderNoticeInput | undefined;
    authorityKind: 'preclaim' | 'claimant' | 'same_org';
    /** Result of verifying the request's notice, when it carried one. */
    verification?: NoticeDeliveryVerification | null;
    /** What the holder already has stored (an update of an existing holder). */
    storedEvidence?: NoticeEvidence;
  },
  policy: HolderNoticePolicy = HOLDER_NOTICE_POLICY,
): void {
  const blocked = (code: 'NOTICE_REQUIRES_CLAIM' | 'NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL', operation: string, requires: string, evidence?: NoticeEvidence) =>
    new HolderNoticeBlocked(code, { operation, requires, policyVersion: policy.version, policyApprovedBy: policy.approvedBy, ...(evidence ? { evidence } : {}) });
  if (input.notice && input.authorityKind === 'preclaim') {
    throw blocked('NOTICE_REQUIRES_CLAIM', 'workbook.memory_holder.record_notice', 'a claimed workbook with an identified person to attribute the notice to');
  }
  if (input.writesIdentifyingDetail) {
    const fromRequest: NoticeEvidence = input.notice ? (input.verification?.status === 'delivery_verified' ? 'delivery_verified' : 'self_reported') : 'none';
    const reached = RANK[fromRequest] >= RANK[input.storedEvidence ?? 'none'] ? fromRequest : (input.storedEvidence ?? 'none');
    if (!noticeSatisfies(reached, policy)) {
      throw blocked('NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL', 'workbook.memory_holder.write_identifying_detail', `a ${requiredNoticeEvidence(policy)} notice to the named person`, reached);
    }
  }
}

export type NoticeViewer = 'preclaim' | 'claimant' | 'same_org';

/**
 * A holder as a viewer may see it. Identifying detail whose notice does not meet the requirement is shown only to the claimant, and everyone
 * else gets it withheld, with the fact that it was. `identifyingDetailWritable` says whether the holder's name and note may be changed.
 */
export function projectHolder<T extends NoticeRow>(row: T, viewer: NoticeViewer, policy: HolderNoticePolicy = HOLDER_NOTICE_POLICY) {
  const evidence = noticeEvidenceOf(row);
  const satisfied = noticeSatisfies(evidence, policy);
  const hasDetail = row.displayName !== null || row.notes !== null;
  const withhold = hasDetail && !satisfied && viewer !== 'claimant';
  return {
    ...row,
    displayName: withhold ? null : row.displayName,
    notes: withhold ? null : row.notes,
    identifyingDetailWithheld: withhold,
    identifyingDetailWritable: satisfied,
    noticeEvidence: evidence,
  };
}

export function summarizeNotice(rows: Array<{ noticeState?: string | null; noticeEvidence?: string | null }>): { holders: number; deliveryVerified: number; selfReported: number; noNotice: number } {
  const levels = rows.map(noticeEvidenceOf);
  return {
    holders: rows.length,
    deliveryVerified: levels.filter((level) => level === 'delivery_verified').length,
    selfReported: levels.filter((level) => level === 'self_reported').length,
    noNotice: levels.filter((level) => level === 'none').length,
  };
}
