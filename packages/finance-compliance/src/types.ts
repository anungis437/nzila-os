export type KycStatus =
  | 'not_started'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export type SanctionsStatus =
  | 'not_screened'
  | 'clear'
  | 'flagged'
  | 'under_review'
  | 'confirmed_match'

export type RiskTier = 'low' | 'medium' | 'high' | 'critical'

export type ComplianceSubjectType = 'account' | 'transaction'
export type ComplianceReviewType = 'kyc' | 'sanctions' | 'risk'

export interface ComplianceReview {
  id: string
  orgId: string
  subjectId: string
  subjectType: ComplianceSubjectType
  reviewType: ComplianceReviewType
  status: KycStatus
  openedAt: string
  resolvedAt?: string
  reviewedBy?: string
  notes?: string
  riskTier?: RiskTier
}

export interface ConsentRecord {
  id: string
  orgId: string
  subjectId: string
  purpose: string
  granted: boolean
  grantedAt: string
  expiresAt?: string
  revokedAt?: string
  metadata?: Record<string, unknown>
}

export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected'

export interface DocumentReview {
  id: string
  orgId: string
  subjectId: string
  documentType: string
  status: DocumentReviewStatus
  uploadedAt: string
  reviewedAt?: string
  reviewedBy?: string
  rejectionReason?: string
}
