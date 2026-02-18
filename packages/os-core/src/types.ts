/**
 * @nzila/os-core — Shared governance types
 */
import { z } from 'zod'

// ── Governance action types ─────────────────────────────────────────────────

export const GovernanceActionType = z.enum([
  'issue_shares',
  'transfer_shares',
  'convert_shares',
  'borrow_funds',
  'amend_rights',
  'create_class',
  'repurchase_shares',
  'dividend',
  'merger_acquisition',
  'elect_directors',
  'amend_constitution',
])
export type GovernanceActionType = z.infer<typeof GovernanceActionType>

// ── Policy evaluation result ────────────────────────────────────────────────

export interface PolicyRequirement {
  kind: 'board_approval' | 'shareholder_approval' | 'special_resolution' | 'notice' | 'filing'
  description: string
  threshold?: number // e.g. 0.75 for special resolution
  deadlineDays?: number
}

export interface PolicyEvaluation {
  action: GovernanceActionType
  allowed: boolean
  requirements: PolicyRequirement[]
  blockers: string[]
  warnings: string[]
  notices: string[]
}

// ── Entity policy config (overrides defaults) ───────────────────────────────

export const PolicyConfigSchema = z.object({
  /** % of total shares above which transfer needs board approval (0-1) */
  transferApprovalThreshold: z.number().min(0).max(1).default(0.10),
  /** % issuance dilution that triggers shareholder approval */
  issuanceDilutionThreshold: z.number().min(0).max(1).default(0.20),
  /** Dollar amount above which borrowing requires board resolution */
  borrowingThreshold: z.number().default(250_000),
  /** Days for ROFR notice */
  rofrDays: z.number().int().default(30),
  /** Board quorum (0-1) */
  boardQuorum: z.number().min(0).max(1).default(0.50),
  /** Ordinary resolution threshold */
  ordinaryResolutionThreshold: z.number().min(0).max(1).default(0.50),
  /** Special resolution threshold */
  specialResolutionThreshold: z.number().min(0).max(1).default(0.75),
  /** Unanimity threshold */
  unanimityThreshold: z.number().min(0).max(1).default(1.00),
})
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>

export const DEFAULT_POLICY_CONFIG: PolicyConfig = PolicyConfigSchema.parse({})

// ── Audit hash helpers ──────────────────────────────────────────────────────

export interface Hashable {
  hash: string
  previousHash: string | null
}
