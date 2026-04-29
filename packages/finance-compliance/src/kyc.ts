import { createHash } from 'node:crypto'
import type { ComplianceReview, KycStatus } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

// PLACEHOLDER - not a real KYC provider
export class KycService {
  private reviews = new Map<string, ComplianceReview>()

  openKycReview(orgId: string, accountId: string): ComplianceReview {
    const now = new Date().toISOString()
    const review: ComplianceReview = {
      id: generateId(`kyc:${orgId}:${accountId}:${now}`),
      orgId,
      subjectId: accountId,
      subjectType: 'account',
      reviewType: 'kyc',
      status: 'pending',
      openedAt: now,
    }
    this.reviews.set(`${orgId}:${review.id}`, review)
    return review
  }

  updateKycStatus(orgId: string, reviewId: string, status: KycStatus, reviewedBy: string): ComplianceReview {
    const review = this.reviews.get(`${orgId}:${reviewId}`)
    if (!review) throw new Error(`KYC review not found: ${reviewId}`)
    const updated: ComplianceReview = {
      ...review,
      status,
      reviewedBy,
      resolvedAt: ['approved', 'rejected'].includes(status) ? new Date().toISOString() : undefined,
    }
    this.reviews.set(`${orgId}:${reviewId}`, updated)
    return updated
  }

  getKycStatus(orgId: string, accountId: string): KycStatus {
    const reviews = Array.from(this.reviews.values()).filter(
      (r) => r.orgId === orgId && r.subjectId === accountId && r.reviewType === 'kyc',
    )
    if (reviews.length === 0) return 'not_started'
    const latest = reviews.sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0]
    return latest?.status ?? 'not_started'
  }
}
