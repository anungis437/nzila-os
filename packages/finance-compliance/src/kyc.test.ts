import { describe, it, expect, beforeEach } from 'vitest'
import { KycService } from './kyc.js'

describe('KycService', () => {
  let service: KycService

  beforeEach(() => {
    service = new KycService()
  })

  it('opens a KYC review in pending state', () => {
    const review = service.openKycReview('org-1', 'acc-1')
    expect(review.orgId).toBe('org-1')
    expect(review.subjectId).toBe('acc-1')
    expect(review.status).toBe('pending')
    expect(review.reviewType).toBe('kyc')
  })

  it('transitions KYC: pending -> under_review -> approved', () => {
    const review = service.openKycReview('org-1', 'acc-1')
    const underReview = service.updateKycStatus('org-1', review.id, 'under_review', 'reviewer-1')
    expect(underReview.status).toBe('under_review')
    const approved = service.updateKycStatus('org-1', review.id, 'approved', 'reviewer-1')
    expect(approved.status).toBe('approved')
    expect(approved.resolvedAt).toBeTruthy()
  })

  it('returns not_started for accounts with no review', () => {
    const status = service.getKycStatus('org-1', 'new-acc')
    expect(status).toBe('not_started')
  })

  it('returns current KYC status for known account', () => {
    const review = service.openKycReview('org-1', 'acc-2')
    service.updateKycStatus('org-1', review.id, 'approved', 'reviewer-1')
    const status = service.getKycStatus('org-1', 'acc-2')
    expect(status).toBe('approved')
  })
})
