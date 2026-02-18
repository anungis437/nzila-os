/**
 * Nzila Business OS - Equity Domain Models
 * 
 * Core data structures for share management, cap tables, and equity operations.
 * These models enforce the constitutional governance rules defined in the policy engine.
 */

import { z } from 'zod'

// ============================================================================
// ENUMS & TYPES
// ============================================================================

/**
 * Share classes as defined in the Nzila constitution.
 * Each class has specific rights, conversion terms, and voting powers.
 */
export enum ShareClass {
  COMMON_A = 'COMMON_A',           // Standard voting shares
  PREFERRED_A = 'PREFERRED_A',      // Series A preferred (1x non-participating)
  PREFERRED_B = 'PREFERRED_B',      // Series B convertible preferred
  PREFERRED_C = 'PREFERRED_C',      // Series C convertible preferred
  FOUNDERS_F = 'FOUNDERS_F',        // Founder shares (Class F - restricted voting)
  STOCK_OPTIONS = 'STOCK_OPTIONS',  // Employee option pool
}

/**
 * Shareholder types for categorization and reporting
 */
export enum ShareholderType {
  INDIVIDUAL = 'INDIVIDUAL',
  CORPORATION = 'CORPORATION',
  TRUST = 'TRUST',
  PARTNERSHIP = 'PARTNERSHIP',
  EMPLOYEE = 'EMPLOYEE',            // ESOP participant
  FOUNDER = 'FOUNDER',
}

/**
 * Transaction types for the share ledger
 */
export enum EquityTransactionType {
  ISSUANCE = 'ISSUANCE',            // New shares issued
  TRANSFER = 'TRANSFER',            // Share transfer between holders
  CONVERSION = 'CONVERSION',       // Preferred to common conversion
  REPURCHASE = 'REPURCHASE',       // Company buyback
  CANCELLATION = 'CANCELLATION',   // Shares cancelled
  DIVIDEND = 'DIVIDEND',           // Stock dividend
  SPLIT = 'SPLIT',                  // Share split
  BONUS = 'BONUS',                  // Bonus shares
}

/**
 * Resolution types for governance actions
 */
export enum ResolutionType {
  ORDINARY = 'ORDINARY',           // Simple majority (50%+1)
  SPECIAL = 'SPECIAL',              // Special resolution (75%+)
  UNANIMOUS = 'UNANIMOUS',          // Unanimous consent
  BOARD = 'BOARD',                  // Board resolution only
  WRITTEN = 'WRITTEN',              // Written resolution
}

/**
 * Approval status for workflows
 */
export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

/**
 * Workflow types for governance actions
 */
export enum WorkflowType {
  SHARE_ISSUANCE = 'SHARE_ISSUANCE',
  SHARE_TRANSFER = 'SHARE_TRANSFER',
  SHARE_CONVERSION = 'SHARE_CONVERSION',
  BORROWING = 'BORROWING',
  AMENDMENT = 'AMENDMENT',
  MERGER_ACQUISITION = 'MERGER_ACQUISITION',
  GENERAL = 'GENERAL',
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/**
 * Shareholder entity schema
 */
export const ShareholderSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(ShareholderType),
  name: z.string().min(1),
  email: z.string().email().optional(),
  legalName: z.string().optional(),        // Legal entity name
  registrationNumber: z.string().optional(), // Corporation number
  jurisdiction: z.string().default('CANADA'), // Jurisdiction
  address: z.object({
    street: z.string(),
    city: z.string(),
    province: z.string(),
    postalCode: z.string(),
    country: z.string().default('Canada'),
  }).optional(),
  contactPerson: z.string().optional(),
  taxId: z.string().optional(),            // SIN/TIN
  bankDetails: z.object({
    institution: z.string(),
    account: z.string(),
    transit: z.string().optional(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type Shareholder = z.infer<typeof ShareholderSchema>

/**
 * Share class definition schema
 */
export const ShareClassDefinitionSchema = z.object({
  class: z.nativeEnum(ShareClass),
  name: z.string(),
  description: z.string(),
  
  // Voting rights
  votingRights: z.number().int().nonnegative(),  // Votes per share
  votesPerShare: z.number().int().nonnegative(),
  
  // Conversion rights
  convertible: z.boolean(),
  conversionRatio: z.number().positive().optional(),
  conversionTrigger: z.enum(['AUTOMATIC', 'OPTIONAL', 'QUALIFIED_OFFERING']).optional(),
  conversionPrice: z.number().positive().optional(),
  
  // Liquidation preferences
  liquidationPreference: z.number().nonnegative(),
  participationCap: z.number().positive().optional(),
  
  // Dividend rights
  cumulativeDividend: z.boolean(),
  dividendRate: z.number().nonnegative().optional(),  // As decimal (0.08 = 8%)
  dividendPreference: z.number().nonnegative(),
  
  // Anti-dilution
  antiDilution: z.enum(['NONE', 'WEIGHTED_AVERAGE', 'FULL_RATCHET']).default('NONE'),
  
  // Other rights
  proRataRights: z.boolean(),
  informationRights: z.boolean(),
  dragAlongRights: z.boolean(),
  tagAlongRights: z.boolean(),
  rofrRights: z.boolean(),  // Right of first refusal
  
  // Board representation
  boardSeats: z.number().int().nonnegative().default(0),
  
  isActive: z.boolean().default(true),
})

export type ShareClassDefinition = z.infer<typeof ShareClassDefinitionSchema>

/**
 * Individual share holding
 */
export const ShareHoldingSchema = z.object({
  id: z.string().uuid(),
  shareholderId: z.string().uuid(),
  shareClass: z.nativeEnum(ShareClass),
  
  // Share counts
  sharesIssued: z.number().int().nonnegative(),
  sharesOutstanding: z.number().int().nonnegative(),
  sharesReserved: z.number().int().nonnegative(),  // Unissued but allocated
  
  // Acquisition details
  originalIssueDate: z.string().datetime(),
  originalIssuePrice: z.number().positive().optional(),
  consideration: z.number().nonnegative().default(0),  // Amount paid
  
  // Current state
  isVested: z.boolean().default(true),
  vestingSchedule: z.object({
    startDate: z.string().datetime(),
    cliffMonths: z.number().int().nonnegative().default(0),
    totalMonths: z.number().int().positive(),
    vestedPercentage: z.number().min(0).max(100).default(100),
  }).optional(),
  
  // Restrictions
  transferRestrictions: z.array(z.string()).optional(),
  pledgeInfo: z.object({
    pledged: z.boolean(),
    pledgee: z.string().optional(),
    pledgeDate: z.string().datetime().optional(),
    releaseDate: z.string().datetime().optional(),
  }).optional(),
  
  // Metadata
  certificateNumber: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ShareHolding = z.infer<typeof ShareHoldingSchema>

/**
 * Share ledger entry (append-only record)
 */
export const ShareLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  transactionType: z.nativeEnum(EquityTransactionType),
  
  // Before state (for audit)
  fromHolderId: z.string().uuid().optional(),
  fromClass: z.nativeEnum(ShareClass).optional(),
  fromShares: z.number().int().nonnegative().optional(),
  
  // After state
  toHolderId: z.string().uuid(),
  toClass: z.nativeEnum(ShareClass),
  toShares: z.number().int().nonnegative(),
  
  // Transaction details
  transactionDate: z.string().datetime(),
  effectiveDate: z.string().datetime(),
  
  // Financial terms
  pricePerShare: z.number().positive().optional(),
  totalConsideration: z.number().nonnegative().optional(),
  
  // Reference to approval/authorization
  approvalId: z.string().uuid().optional(),
  resolutionId: z.string().uuid().optional(),
  
  // Notes
  description: z.string(),
  
  // Audit
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
})

export type ShareLedgerEntry = z.infer<typeof ShareLedgerEntrySchema>

/**
 * Cap table snapshot for reporting
 */
export const CapTableSnapshotSchema = z.object({
  id: z.string().uuid(),
  snapshotDate: z.string().datetime(),
  
  // Summary totals
  totalSharesAuthorized: z.number().int().nonnegative(),
  totalSharesIssued: z.number().int().nonnegative(),
  totalSharesOutstanding: z.number().int().nonnegative(),
  totalShareholders: z.number().int().nonnegative(),
  
  // By share class
  breakdown: z.array(z.object({
    shareClass: z.nativeEnum(ShareClass),
    sharesAuthorized: z.number().int().nonnegative(),
    sharesIssued: z.number().int().nonnegative(),
    sharesOutstanding: z.number().int().nonnegative(),
    shareholderCount: z.number().int().nonnegative(),
    percentageOfTotal: z.number().min(0).max(100),
    totalValue: z.number().nonnegative(),  // At current FMV
  })),
  
  // Ownership summary
  ownership: z.array(z.object({
    shareholderId: z.string().uuid(),
    shareholderName: z.string(),
    totalShares: z.number().int().nonnegative(),
    percentage: z.number().min(0).max(100),
    votingPower: z.number().min(0).max(100),
    classBreakdown: z.record(z.string(), z.number().int().nonnegative()),
  })),
  
  // Metadata
  generatedAt: z.string().datetime(),
  generatedBy: z.string().uuid(),
  notes: z.string().optional(),
})

export type CapTableSnapshot = z.infer<typeof CapTableSnapshotSchema>

// ============================================================================
// CONSTITUTIONAL THRESHOLDS
// ============================================================================

/**
 * Constitutional thresholds as defined in the Nzila governing documents.
 * These values drive the policy engine's decision-making.
 */
export const CONSTITUTIONAL_THRESHOLDS = {
  // Transfer thresholds
  TRANSFER_SPECIAL_RESOLUTION: 0.10,      // 10% of total shares triggers special resolution
  TRANSFER_BOARD_APPROVAL: true,           // All transfers require board approval
  
  // Issuance thresholds
  ISSUANCE_SPECIAL_RESOLUTION: 0.20,       // 20% new issuance triggers special resolution
  ISSUANCE_BOARD_APPROVAL: true,           // All issuances require board approval
  
  // Borrowing thresholds
  BORROWING_SPECIAL_RESOLUTION: 250000,    // $250k CAD triggers special resolution
  BORROWING_BOARD_APPROVAL: true,          // All borrowing requires board approval
  
  // Conversion thresholds
  CONVERSION_BOARD_APPROVAL: true,
  
  // ROFR (Right of First Refusal)
  ROFR_WINDOW_DAYS: 30,                    // Days for ROFR exercise
  ROFR_NOTICE_REQUIRED: true,
  
  // Approval quorums
  ORDINARY_RESOLUTION_QUORUM: 0.50,        // 50% + 1 vote
  SPECIAL_RESOLUTION_QUORUM: 0.75,         // 75% + 1 vote
  UNANIMOUS_RESOLUTION: 1.00,              // 100% required
  
  // Board
  BOARD_QUORUM: 0.50,                       // 50% of directors present
  DIRECTOR_TERM_YEARS: 1,                  // Annual election
} as const

export type ConstitutionalThresholds = typeof CONSTITUTIONAL_THRESHOLDS

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate percentage of total shares
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 10000) / 100  // Round to 2 decimal places
}

/**
 * Calculate dilution from new issuance
 */
export function calculateDilution(
  newShares: number, 
  existingShares: number
): number {
  if (existingShares === 0) return 100
  return Math.round((newShares / (existingShares + newShares)) * 10000) / 100
}

/**
 * Determine if an action requires special resolution
 */
export function requiresSpecialResolution(
  actionType: EquityTransactionType,
  percentageOfTotal: number,
  amount?: number
): boolean {
  switch (actionType) {
    case EquityTransactionType.TRANSFER:
      return percentageOfTotal >= CONSTITUTIONAL_THRESHOLDS.TRANSFER_SPECIAL_RESOLUTION
    case EquityTransactionType.ISSUANCE:
      return percentageOfTotal >= CONSTITUTIONAL_THRESHOLDS.ISSUANCE_SPECIAL_RESOLUTION
    case EquityTransactionType.CONVERSION:
      return false  // Conversions handled separately
    default:
      return false
  }
}

/**
 * Check if borrowing exceeds threshold
 */
export function borrowingExceedsThreshold(amount: number): boolean {
  return amount >= CONSTITUTIONAL_THRESHOLDS.BORROWING_SPECIAL_RESOLUTION
}
