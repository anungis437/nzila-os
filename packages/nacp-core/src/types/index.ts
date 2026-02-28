/**
 * @nzila/nacp-core — Domain Types
 *
 * All NACP exam management domain types. No DB, no framework — pure TypeScript.
 * Nzila convention: org scoping uses "orgId" (the Nzila org_id column).
 *
 * @module @nzila/nacp-core/types
 */
import type {
  ExamSessionStatus,
  CandidateStatus,
  SubmissionStatus,
  SubjectLevel,
  IntegrityStatus,
  CenterStatus,
  NacpRole,
} from '../enums'

// ── Branded Types ───────────────────────────────────────────────────────────

/** SHA-256 hash string used for integrity verification. */
export type IntegrityHash = string & { readonly __brand: 'IntegrityHash' }

/** Unique exam session reference (e.g., SES-ENT-000123). */
export type SessionRef = string & { readonly __brand: 'SessionRef' }

/** Unique candidate reference (e.g., CND-ENT-000456). */
export type CandidateRef = string & { readonly __brand: 'CandidateRef' }

// ── Context ─────────────────────────────────────────────────────────────────

/**
 * NACP org context carried through every request.
 *
 * `orgId` is the canonical field (aligns with @nzila/org).
 *
 * @see {@link @nzila/org OrgContext} for the canonical base type.
 */
export interface NacpOrgContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  /** Authenticated user performing the action. */
  readonly actorId: string
  /** User's role within this org. */
  readonly role: NacpRole
  /** Granular permission keys. */
  readonly permissions: readonly string[]
  /** Request-level correlation ID for tracing. */
  readonly requestId: string
}

// ── Exam ────────────────────────────────────────────────────────────────────

export interface Exam {
  readonly id: string
  /** @deprecated Use NacpOrgContext.orgId — entity-level orgId will be removed. */
  readonly orgId: string
  readonly title: string
  readonly code: string
  readonly subjectId: string
  readonly level: SubjectLevel
  readonly year: number
  readonly durationMinutes: number
  readonly totalMarks: number
  readonly passPercentage: number
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Exam Session ────────────────────────────────────────────────────────────

export interface ExamSession {
  readonly id: string
  readonly orgId: string
  readonly examId: string
  readonly centerId: string
  readonly ref: SessionRef
  readonly status: ExamSessionStatus
  readonly scheduledAt: string
  readonly openedAt: string | null
  readonly sealedAt: string | null
  readonly exportedAt: string | null
  readonly closedAt: string | null
  readonly integrityHash: IntegrityHash | null
  readonly supervisorId: string | null
  readonly candidateCount: number
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Subject ─────────────────────────────────────────────────────────────────

export interface Subject {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly code: string
  readonly level: SubjectLevel
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Center ──────────────────────────────────────────────────────────────────

export interface Center {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly code: string
  readonly province: string
  readonly district: string
  readonly capacity: number
  readonly status: CenterStatus
  readonly latitude: number | null
  readonly longitude: number | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Candidate ───────────────────────────────────────────────────────────────

export interface Candidate {
  readonly id: string
  readonly orgId: string
  readonly ref: CandidateRef
  readonly firstName: string
  readonly lastName: string
  readonly dateOfBirth: string
  readonly gender: 'male' | 'female'
  readonly centerId: string
  readonly status: CandidateStatus
  readonly photoUrl: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Submission ──────────────────────────────────────────────────────────────

export interface Submission {
  readonly id: string
  readonly orgId: string
  readonly sessionId: string
  readonly candidateId: string
  readonly examId: string
  readonly status: SubmissionStatus
  readonly rawScore: number | null
  readonly moderatedScore: number | null
  readonly finalScore: number | null
  readonly grade: string | null
  readonly submittedAt: string | null
  readonly markedAt: string | null
  readonly markedBy: string | null
  readonly moderatedAt: string | null
  readonly moderatedBy: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Integrity Artifact ──────────────────────────────────────────────────────

export interface IntegrityArtifact {
  readonly id: string
  readonly orgId: string
  readonly sessionId: string
  readonly hash: IntegrityHash
  readonly status: IntegrityStatus
  readonly candidateCount: number
  readonly submissionHashes: readonly string[]
  readonly generatedAt: string
  readonly verifiedAt: string | null
  readonly createdAt: string
}

// ── Offline Sync ────────────────────────────────────────────────────────────

export interface SyncQueueItem {
  readonly id: string
  readonly orgId: string
  readonly entityType: string
  readonly action: 'create' | 'update'
  readonly payload: Readonly<Record<string, unknown>>
  readonly idempotencyKey: string
  readonly createdAt: string
  readonly syncedAt: string | null
  readonly retryCount: number
  readonly lastError: string | null
}

// ── Outbox ──────────────────────────────────────────────────────────────────

export interface NacpOutboxRecord {
  readonly id: string
  readonly orgId: string
  readonly eventType: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly status: 'pending' | 'dispatched' | 'failed'
  readonly retryCount: number
  readonly maxRetries: number
  readonly lastError: string | null
  readonly createdAt: string
  readonly dispatchedAt: string | null
}
