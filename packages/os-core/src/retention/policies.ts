/**
 * @nzila/os-core — Retention Policies
 *
 * Defines data retention classes and rules for each data category.
 * Enforcement job: packages/os-core/src/retention/enforce.ts
 */
import { z } from 'zod'

// ── Retention classes (aligned with os-core evidence types) ──────────────

export const RetentionClass = z.enum(['PERMANENT', '7_YEARS', '3_YEARS', '1_YEAR', '90_DAYS', '30_DAYS'])
export type RetentionClass = z.infer<typeof RetentionClass>

export const RetentionAction = z.enum(['keep', 'archive', 'delete', 'redact'])
export type RetentionAction = z.infer<typeof RetentionAction>

// ── Retention policy per data category ───────────────────────────────────

export interface RetentionPolicy {
  /** Human-readable category name */
  category: string
  /** Retention class (maps to duration) */
  retentionClass: RetentionClass
  /** What to do when retention expires */
  expiryAction: RetentionAction
  /** Legal / regulatory basis */
  legalBasis?: string
  /** Whether this policy is immutable (can't be shortened) */
  immutable: boolean
}

// Duration in days for each retention class
export const RETENTION_DURATION_DAYS: Record<RetentionClass, number | null> = {
  PERMANENT: null, // never expires
  '7_YEARS': 7 * 365,
  '3_YEARS': 3 * 365,
  '1_YEAR': 365,
  '90_DAYS': 90,
  '30_DAYS': 30,
}

/** Returns the expiry date for a document with the given class and creation date. */
export function computeExpiryDate(
  retentionClass: RetentionClass,
  createdAt: Date,
): Date | null {
  const days = RETENTION_DURATION_DAYS[retentionClass]
  if (days === null) return null // permanent
  const expiry = new Date(createdAt)
  expiry.setDate(expiry.getDate() + days)
  return expiry
}

/** Returns true if the document has passed its retention period. */
export function isExpired(
  retentionClass: RetentionClass,
  createdAt: Date,
  asOf: Date = new Date(),
): boolean {
  const expiry = computeExpiryDate(retentionClass, createdAt)
  if (expiry === null) return false // permanent
  return asOf >= expiry
}

// ── Default policies by document category ────────────────────────────────

export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    category: 'evidence_pack',
    retentionClass: '7_YEARS',
    expiryAction: 'archive',
    legalBasis: 'SOC 2 / internal audit requirements',
    immutable: true,
  },
  {
    category: 'financial_record',
    retentionClass: '7_YEARS',
    expiryAction: 'archive',
    legalBasis: 'CRA (Canada) 7-year requirement',
    immutable: true,
  },
  {
    category: 'governance_resolution',
    retentionClass: 'PERMANENT',
    expiryAction: 'keep',
    legalBasis: 'Corporate law — permanent record',
    immutable: true,
  },
  {
    category: 'ai_request_log',
    retentionClass: '1_YEAR',
    expiryAction: 'delete',
    legalBasis: 'PIPEDA / data minimization',
    immutable: false,
  },
  {
    category: 'ml_inference_result',
    retentionClass: '3_YEARS',
    expiryAction: 'archive',
    legalBasis: 'Model audit trail',
    immutable: false,
  },
  {
    category: 'audit_event',
    retentionClass: '7_YEARS',
    expiryAction: 'archive',
    legalBasis: 'SOC 2 — immutable audit trail',
    immutable: true,
  },
  {
    category: 'stripe_webhook',
    retentionClass: '7_YEARS',
    expiryAction: 'archive',
    legalBasis: 'Financial record / PCI requirements',
    immutable: true,
  },
  {
    category: 'session_log',
    retentionClass: '90_DAYS',
    expiryAction: 'delete',
    legalBasis: 'PIPEDA / data minimization',
    immutable: false,
  },
]
