/**
 * Notice to the people a workbook names.
 *
 * The workbook records a role, and optionally a display name and notes, for individuals who may not know they are recorded. Whether they
 * have been told, how, and by whom is an institutional and legal decision this code does not make. It makes the fact durable and visible:
 * each holder carries whether a notice has been RECORDED, and by whom, when and through which channel (platform 0055). Recording that a
 * notice was given is not the notice, and nothing here sends one.
 *
 * A notice is recorded by an identified person with authority over the claimed workbook. An unclaimed workbook has no such person, so a
 * notice cannot be recorded for it and that is reported, not faked.
 *
 * PROVISIONAL: whether naming someone should be conditional on a recorded notice is part of that decision. The default does not condition
 * it (`identifyingDetailsRequireNotice: false`) and carries `approvedBy: null`; when the policy is turned on, a display name or note may be
 * written only together with the notice record in the same request, is withheld from reads until a notice is recorded, and a refusal is a
 * specific blocked operation naming the policy. The server never turns it on by its own authority.
 */
import { z } from 'zod';

export const HOLDER_NOTICE_POLICY = {
  version: 'ue-workbook-holder-notice/provisional-1',
  approvedBy: null as string | null,
  identifyingDetailsRequireNotice: false,
};
export type HolderNoticePolicy = typeof HOLDER_NOTICE_POLICY;

export const NOTICE_CHANNELS = ['in_person', 'email', 'letter', 'other'] as const;

export const holderNoticeSchema = z.object({
  channel: z.enum(NOTICE_CHANNELS),
  reference: z.string().trim().max(255).optional(),
});
export type HolderNoticeInput = z.infer<typeof holderNoticeSchema>;

export const IDENTIFYING_FIELDS = ['displayName', 'notes'] as const;

export class HolderNoticeBlocked extends Error {
  constructor(
    readonly code: 'NOTICE_REQUIRES_CLAIM' | 'NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL',
    readonly blockedOperation: { operation: string; requires: string; policyVersion: string; policyApprovedBy: string | null },
  ) {
    super(code);
    this.name = 'HolderNoticeBlocked';
  }
}

/** The columns that record a notice, set by the person who recorded it. */
export function noticeColumns(notice: HolderNoticeInput, actorUserId: string, now: Date) {
  return {
    noticeState: 'notified' as const,
    notifiedAt: now,
    notifiedBy: actorUserId,
    noticeChannel: notice.channel,
    noticeReference: notice.reference ? notice.reference : null,
  };
}

/**
 * Refuses a write that records a notice for an unclaimed workbook (nobody to attribute it to), and, when the policy requires it, a write
 * of identifying detail that does not carry a notice in the same request.
 */
export function assertNoticeContract(
  input: { writesIdentifyingDetail: boolean; notice: HolderNoticeInput | undefined; authorityKind: 'preclaim' | 'claimant' | 'same_org' },
  policy: HolderNoticePolicy = HOLDER_NOTICE_POLICY,
): void {
  const blocked = (code: 'NOTICE_REQUIRES_CLAIM' | 'NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL', operation: string, requires: string) =>
    new HolderNoticeBlocked(code, { operation, requires, policyVersion: policy.version, policyApprovedBy: policy.approvedBy });
  if (input.notice && input.authorityKind === 'preclaim') {
    throw blocked('NOTICE_REQUIRES_CLAIM', 'workbook.memory_holder.record_notice', 'a claimed workbook with an identified person to attribute the notice to');
  }
  if (policy.identifyingDetailsRequireNotice && input.writesIdentifyingDetail && !input.notice) {
    throw blocked('NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL', 'workbook.memory_holder.write_identifying_detail', 'a recorded notice in the same request');
  }
}

export interface NoticeRow {
  displayName: string | null;
  notes: string | null;
  noticeState: string | null;
}

/** Under the policy, identifying detail is withheld from reads until a notice is recorded. */
export function withholdUnnoticedDetail<T extends NoticeRow>(row: T, policy: HolderNoticePolicy = HOLDER_NOTICE_POLICY): T & { identifyingDetailWithheld: boolean } {
  const withhold = policy.identifyingDetailsRequireNotice && row.noticeState !== 'notified' && (row.displayName !== null || row.notes !== null);
  return withhold
    ? { ...row, displayName: null, notes: null, identifyingDetailWithheld: true }
    : { ...row, identifyingDetailWithheld: false };
}

export function summarizeNotice(rows: Array<{ noticeState: string | null }>): { holders: number; noticeRecorded: number; noticeNotRecorded: number } {
  const recorded = rows.filter((row) => row.noticeState === 'notified').length;
  return { holders: rows.length, noticeRecorded: recorded, noticeNotRecorded: rows.length - recorded };
}
