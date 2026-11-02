import { describe, expect, it } from 'vitest'
import { CreateReferralCodeSchema, RedeemReferralSchema } from './referral'
import { ShareIntentSchema } from './sharing'
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
describe('Zod 4 growth ingress compatibility', () => {
  it('retains referral defaults and bounded conversions', () => {
    expect(CreateReferralCodeSchema.parse({ referrerId: 'user-1', orgId: 'org-1' }).expiryDays).toBe(90)
    expect(RedeemReferralSchema.safeParse({ code: 'ABCDEF', referredUserId: 'user-2', orgId: 'org-1', conversionType: 'signup' }).success).toBe(true)
    expect(RedeemReferralSchema.safeParse({ code: 'ABCDEF', referredUserId: 'user-2', orgId: 'org-1', conversionType: 'forged' }).success).toBe(false)
    expect(CreateReferralCodeSchema.safeParse({ referrerId: 'user-1', orgId: 'org-1', maxUses: -1 }).success).toBe(false)
  })
  it('rejects invalid share types and malformed identifiers', () => {
    const share = { orgId: id, sharerId: id, shareType: 'track', contentId: id }
    expect(ShareIntentSchema.safeParse(share).success).toBe(true)
    expect(ShareIntentSchema.safeParse({ ...share, shareType: 'forged' }).success).toBe(false)
    expect(ShareIntentSchema.safeParse({ ...share, orgId: 'another-tenant' }).success).toBe(false)
  })
})
