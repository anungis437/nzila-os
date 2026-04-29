import { createHash } from 'node:crypto'
import type { ComplianceReview, SanctionsStatus } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

// PLACEHOLDER - not a real sanctions screening provider
export class SanctionsService {
  private reviews = new Map<string, ComplianceReview>()

  screenSubject(_orgId: string, _subjectId: string): SanctionsStatus {
    return 'not_screened'
  }

  flagForReview(orgId: string, subjectId: string, reason: string): ComplianceReview {
    const now = new Date().toISOString()
    const review: ComplianceReview = {
      id: generateId(`sanctions:${orgId}:${subjectId}:${now}`),
      orgId,
      subjectId,
      subjectType: 'account',
      reviewType: 'sanctions',
      status: 'under_review',
      openedAt: now,
      notes: reason,
    }
    this.reviews.set(`${orgId}:${review.id}`, review)
    return review
  }
}
