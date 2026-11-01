/**
 * F06 R5 — notice to the people a workbook names: the contract, as pure logic.
 */
import { describe, expect, it } from 'vitest'
import {
  assertNoticeContract,
  HolderNoticeBlocked,
  HOLDER_NOTICE_POLICY,
  holderNoticeSchema,
  noticeColumns,
  summarizeNotice,
  withholdUnnoticedDetail,
  type HolderNoticePolicy,
} from '../holder-notice'

const on: HolderNoticePolicy = { ...HOLDER_NOTICE_POLICY, identifyingDetailsRequireNotice: true }
const notice = { channel: 'email' as const, reference: 'msg-1' }

describe('the provisional default', () => {
  it('conditions nothing and names no approving body, so no institutional decision is invented', () => {
    expect(HOLDER_NOTICE_POLICY).toMatchObject({ approvedBy: null, identifyingDetailsRequireNotice: false })
  })

  it('lets a claimed workbook name a person without a notice, and an unclaimed one too', () => {
    expect(() => assertNoticeContract({ writesIdentifyingDetail: true, notice: undefined, authorityKind: 'claimant' })).not.toThrow()
    expect(() => assertNoticeContract({ writesIdentifyingDetail: true, notice: undefined, authorityKind: 'preclaim' })).not.toThrow()
  })
})

describe('recording a notice', () => {
  it('is attributed to the person who records it, with the time and the channel, and never to the request body', () => {
    const at = new Date('2026-11-01T00:00:00Z')
    expect(noticeColumns(notice, 'user_steward', at)).toEqual({
      noticeState: 'notified',
      notifiedAt: at,
      notifiedBy: 'user_steward',
      noticeChannel: 'email',
      noticeReference: 'msg-1',
    })
    expect(noticeColumns({ channel: 'in_person' }, 'u', at).noticeReference).toBeNull()
  })

  it('cannot be recorded for an unclaimed workbook, which has nobody to attribute it to, and says what would unblock it', () => {
    let blocked: unknown
    try { assertNoticeContract({ writesIdentifyingDetail: false, notice, authorityKind: 'preclaim' }) } catch (error) { blocked = error }
    expect(blocked).toBeInstanceOf(HolderNoticeBlocked)
    expect((blocked as HolderNoticeBlocked).code).toBe('NOTICE_REQUIRES_CLAIM')
    expect((blocked as HolderNoticeBlocked).blockedOperation).toMatchObject({ operation: 'workbook.memory_holder.record_notice', policyApprovedBy: null })
  })

  it('accepts only the known channels and a bounded reference', () => {
    expect(holderNoticeSchema.safeParse({ channel: 'carrier_pigeon' }).success).toBe(false)
    expect(holderNoticeSchema.safeParse({ channel: 'letter', reference: 'x'.repeat(256) }).success).toBe(false)
    expect(holderNoticeSchema.safeParse({ channel: 'letter', reference: ' ref ' }).data).toEqual({ channel: 'letter', reference: 'ref' })
  })
})

describe('when the policy conditions naming a person on a recorded notice', () => {
  it('refuses a display name or note without a notice in the same request, as a specific blocked operation', () => {
    let blocked: unknown
    try { assertNoticeContract({ writesIdentifyingDetail: true, notice: undefined, authorityKind: 'claimant' }, on) } catch (error) { blocked = error }
    expect((blocked as HolderNoticeBlocked).code).toBe('NOTICE_REQUIRED_FOR_IDENTIFYING_DETAIL')
    expect((blocked as HolderNoticeBlocked).blockedOperation).toMatchObject({
      operation: 'workbook.memory_holder.write_identifying_detail',
      policyVersion: HOLDER_NOTICE_POLICY.version,
      policyApprovedBy: null,
    })
  })

  it('allows it together with a notice, and allows writes that name no one', () => {
    expect(() => assertNoticeContract({ writesIdentifyingDetail: true, notice, authorityKind: 'same_org' }, on)).not.toThrow()
    expect(() => assertNoticeContract({ writesIdentifyingDetail: false, notice: undefined, authorityKind: 'claimant' }, on)).not.toThrow()
  })

  it('refuses naming anyone in an unclaimed workbook, where no notice can ever be recorded', () => {
    expect(() => assertNoticeContract({ writesIdentifyingDetail: true, notice: undefined, authorityKind: 'preclaim' }, on)).toThrow(HolderNoticeBlocked)
  })

  it('withholds a name and note from reads until a notice is recorded, and only then', () => {
    const row = { id: 'h1', role: 'Treasurer', displayName: 'A Person', notes: 'private', noticeState: 'not_recorded' }
    expect(withholdUnnoticedDetail(row, on)).toMatchObject({ displayName: null, notes: null, identifyingDetailWithheld: true, role: 'Treasurer' })
    expect(withholdUnnoticedDetail({ ...row, noticeState: 'notified' }, on)).toMatchObject({ displayName: 'A Person', identifyingDetailWithheld: false })
    expect(withholdUnnoticedDetail({ ...row, displayName: null, notes: null }, on).identifyingDetailWithheld).toBe(false)
    expect(withholdUnnoticedDetail(row)).toMatchObject({ displayName: 'A Person', identifyingDetailWithheld: false })
  })
})

describe('the summary the reader sees', () => {
  it('counts the holders whose notice is recorded and the ones whose is not', () => {
    expect(summarizeNotice([{ noticeState: 'notified' }, { noticeState: 'not_recorded' }, { noticeState: null }])).toEqual({ holders: 3, noticeRecorded: 1, noticeNotRecorded: 2 })
    expect(summarizeNotice([])).toEqual({ holders: 0, noticeRecorded: 0, noticeNotRecorded: 0 })
  })
})
