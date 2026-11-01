/**
 * Notice to the people a workbook names: the contract, as pure logic. A recorded notice is a person's statement until a registered delivery
 * verifier confirms it, and the unapproved policy lets a name or private note stand only on a confirmed delivery.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertNoticeContract,
  clearNoticeDeliveryVerifiers,
  HolderNoticeBlocked,
  HOLDER_NOTICE_POLICY,
  holderNoticeSchema,
  noticeColumns,
  noticeEvidenceOf,
  noticeSatisfies,
  projectHolder,
  registerNoticeDeliveryVerifier,
  requiredNoticeEvidence,
  summarizeNotice,
  verifyNoticeDelivery,
  type HolderNoticePolicy,
} from '../holder-notice'

const notice = { channel: 'email' as const, reference: 'msg-1' }
const policy = (over: Partial<HolderNoticePolicy>): HolderNoticePolicy => ({ ...HOLDER_NOTICE_POLICY, ...over })
const verified = { status: 'delivery_verified' as const, provider: 'mail-provider', verifiedAt: '2026-11-01T00:00:00.000Z', providerReference: 'ev-9' }
const unverified = { status: 'self_reported' as const, reason: 'no_verifier_registered_for_channel' as const }
const blockedCode = (fn: () => void) => {
  try { fn() } catch (error) { return error instanceof HolderNoticeBlocked ? error : null }
  return undefined
}

afterEach(() => clearNoticeDeliveryVerifiers())

describe('the provisional default is conservative and names no approver', () => {
  it('requires a delivery-verified notice for identifying detail and records no approval', () => {
    expect(HOLDER_NOTICE_POLICY).toMatchObject({ approvedBy: null, identifyingDetailRequires: 'delivery_verified' })
    expect(requiredNoticeEvidence()).toBe('delivery_verified')
  })

  it('does not honour a looser requirement without an approver: the setting alone changes nothing', () => {
    expect(requiredNoticeEvidence(policy({ identifyingDetailRequires: 'none', approvedBy: null }))).toBe('delivery_verified')
    expect(requiredNoticeEvidence(policy({ identifyingDetailRequires: 'self_reported', approvedBy: '  ' }))).toBe('delivery_verified')
    expect(requiredNoticeEvidence(policy({ identifyingDetailRequires: 'self_reported', approvedBy: 'privacy-officer-3' }))).toBe('self_reported')
  })

  it('counts a person\'s statement as insufficient, and only a confirmed delivery as enough', () => {
    expect(noticeSatisfies('none')).toBe(false)
    expect(noticeSatisfies('self_reported')).toBe(false)
    expect(noticeSatisfies('delivery_verified')).toBe(true)
  })
})

describe('what a stored notice rests on', () => {
  it('reads a notice recorded before evidence was kept as a statement, never as a delivery', () => {
    expect(noticeEvidenceOf({ noticeState: 'notified' })).toBe('self_reported')
    expect(noticeEvidenceOf({ noticeState: 'notified', noticeEvidence: 'self_reported' })).toBe('self_reported')
    expect(noticeEvidenceOf({ noticeState: 'not_recorded', noticeEvidence: 'none' })).toBe('none')
    expect(noticeEvidenceOf({})).toBe('none')
    expect(noticeEvidenceOf({ noticeState: 'notified', noticeEvidence: 'delivery_verified' })).toBe('delivery_verified')
  })
})

describe('verifying a notice', () => {
  it('leaves a notice a person\'s statement when no verifier is registered for its channel', async () => {
    expect(await verifyNoticeDelivery(notice)).toEqual({ status: 'self_reported', reason: 'no_verifier_registered_for_channel' })
  })

  it('does not call a verifier without a reference to check', async () => {
    const verify = vi.fn()
    registerNoticeDeliveryVerifier('email', { provider: 'p', verify })
    expect(await verifyNoticeDelivery({ channel: 'email' })).toEqual({ status: 'self_reported', reason: 'no_reference_to_verify' })
    expect(verify).not.toHaveBeenCalled()
  })

  it('reports a confirmed delivery with its provider, reference and time', async () => {
    registerNoticeDeliveryVerifier('email', { provider: 'mail-provider', verify: async () => ({ verified: true, providerReference: 'ev-9' }) })
    expect(await verifyNoticeDelivery(notice, () => new Date('2026-11-01T00:00:00Z'))).toEqual(verified)
  })

  it.each([
    ['declines', async () => ({ verified: false }), 'verifier_could_not_confirm'],
    ['confirms without evidence', async () => ({ verified: true }), 'verifier_could_not_confirm'],
    ['throws', async () => { throw new Error('down') }, 'verifier_unavailable'],
  ])('leaves the notice a statement when the verifier %s', async (_name, verify, reason) => {
    registerNoticeDeliveryVerifier('email', { provider: 'p', verify })
    expect(await verifyNoticeDelivery(notice)).toEqual({ status: 'self_reported', reason })
  })
})

describe('recording a notice', () => {
  const now = new Date('2026-11-01T00:00:00Z')

  it('is attributed to the person who records it, with the time and channel, and never marks a delivery without evidence', () => {
    expect(noticeColumns(notice, 'user_7', now, unverified)).toEqual({
      noticeState: 'notified', notifiedAt: now, notifiedBy: 'user_7', noticeChannel: 'email', noticeReference: 'msg-1',
      noticeEvidence: 'self_reported', noticeVerifiedAt: null, noticeVerifiedBy: null, noticeProviderReference: null,
    })
    expect(noticeColumns(notice, 'user_7', now)).toMatchObject({ noticeEvidence: 'self_reported', noticeVerifiedAt: null })
    expect(noticeColumns({ channel: 'in_person' }, 'user_7', now).noticeReference).toBeNull()
  })

  it('keeps the provider evidence only when a verifier confirmed it', () => {
    expect(noticeColumns(notice, 'user_7', now, verified)).toMatchObject({
      noticeEvidence: 'delivery_verified', noticeVerifiedBy: 'mail-provider', noticeProviderReference: 'ev-9', noticeVerifiedAt: new Date(verified.verifiedAt),
    })
  })

  it('accepts only the known channels and a bounded reference', () => {
    expect(holderNoticeSchema.safeParse({ channel: 'carrier_pigeon' }).success).toBe(false)
    expect(holderNoticeSchema.safeParse({ channel: 'email', reference: 'x'.repeat(256) }).success).toBe(false)
    expect(holderNoticeSchema.safeParse({ channel: 'email', reference: '  r  ' }).data?.reference).toBe('r')
  })
})

describe('writing identifying detail', () => {
  it('refuses a name or note with no notice, or with only a statement, under the unapproved policy', () => {
    const none = blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: true, notice: undefined, authorityKind: 'claimant' }))
    expect(none?.code).toBe('NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL')
    expect(none?.blockedOperation).toMatchObject({ operation: 'workbook.memory_holder.write_identifying_detail', policyApprovedBy: null, evidence: 'none' })

    const statement = blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: true, notice, authorityKind: 'claimant', verification: unverified }))
    expect(statement?.code).toBe('NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL')
    expect(statement?.blockedOperation.evidence).toBe('self_reported')
  })

  it('allows it on a confirmed delivery, in the request or already stored on the holder', () => {
    expect(blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: true, notice, authorityKind: 'claimant', verification: verified }))).toBeUndefined()
    expect(blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: true, notice: undefined, authorityKind: 'same_org', storedEvidence: 'delivery_verified' }))).toBeUndefined()
  })

  it('does not let a stored statement or a stored delivery on one holder stand in for the request\'s own weaker evidence', () => {
    expect(blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: true, notice: undefined, authorityKind: 'claimant', storedEvidence: 'self_reported' }))?.code).toBe('NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL')
  })

  it('allows every write that names no one, including clearing a name', () => {
    expect(blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: false, notice: undefined, authorityKind: 'preclaim' }))).toBeUndefined()
  })

  it('cannot record a notice for an unclaimed workbook, which has nobody to attribute it to', () => {
    const refused = blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: false, notice, authorityKind: 'preclaim', verification: verified }))
    expect(refused?.code).toBe('NOTICE_REQUIRES_CLAIM')
    expect(refused?.blockedOperation).toMatchObject({ operation: 'workbook.memory_holder.record_notice' })
  })

  it('honours a looser requirement only with an approver', () => {
    const looser = policy({ identifyingDetailRequires: 'self_reported', approvedBy: 'privacy-officer-3' })
    expect(blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: true, notice, authorityKind: 'claimant', verification: unverified }, looser))).toBeUndefined()
    const unapproved = policy({ identifyingDetailRequires: 'self_reported', approvedBy: null })
    expect(blockedCode(() => assertNoticeContract({ writesIdentifyingDetail: true, notice, authorityKind: 'claimant', verification: unverified }, unapproved))?.code).toBe('NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL')
  })
})

describe('what a viewer sees of a named person', () => {
  const row = { id: 'h', role: 'Treasurer', displayName: 'Pat', notes: 'private', noticeState: 'not_recorded', noticeEvidence: 'none' }

  it('withholds a name and note from everyone but the claimant until the notice is a confirmed delivery', () => {
    for (const viewer of ['preclaim', 'same_org'] as const) {
      expect(projectHolder(row, viewer)).toMatchObject({ displayName: null, notes: null, identifyingDetailWithheld: true, identifyingDetailWritable: false })
    }
    expect(projectHolder(row, 'claimant')).toMatchObject({ displayName: 'Pat', notes: 'private', identifyingDetailWithheld: false, identifyingDetailWritable: false })
    expect(projectHolder({ ...row, noticeState: 'notified', noticeEvidence: 'self_reported' }, 'same_org')).toMatchObject({ displayName: null, identifyingDetailWithheld: true })
  })

  it('shows them to anyone once the delivery is confirmed, and says they may be changed', () => {
    const confirmed = { ...row, noticeState: 'notified', noticeEvidence: 'delivery_verified' }
    expect(projectHolder(confirmed, 'same_org')).toMatchObject({ displayName: 'Pat', notes: 'private', identifyingDetailWithheld: false, identifyingDetailWritable: true, noticeEvidence: 'delivery_verified' })
  })

  it('leaves a holder with no name or note as it is, so the workbook works for people who are not named', () => {
    const anonymous = { ...row, displayName: null, notes: null }
    expect(projectHolder(anonymous, 'same_org')).toMatchObject({ role: 'Treasurer', identifyingDetailWithheld: false })
  })

  it('does not change the row it is given', () => {
    const before = JSON.stringify(row)
    projectHolder(row, 'preclaim')
    expect(JSON.stringify(row)).toBe(before)
  })
})

describe('the summary the reader sees', () => {
  it('counts each level separately, and a statement is not a delivery', () => {
    expect(summarizeNotice([
      { noticeState: 'notified', noticeEvidence: 'delivery_verified' },
      { noticeState: 'notified', noticeEvidence: 'self_reported' },
      { noticeState: 'notified' },
      { noticeState: 'not_recorded' },
    ])).toEqual({ holders: 4, deliveryVerified: 1, selfReported: 2, noNotice: 1 })
    expect(summarizeNotice([])).toEqual({ holders: 0, deliveryVerified: 0, selfReported: 0, noNotice: 0 })
  })
})
