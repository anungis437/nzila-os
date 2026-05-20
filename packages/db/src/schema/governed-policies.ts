/**
 * Governed Policies — Platform-level immutable policy artifact registry.
 *
 * Governed policies are NOT mutable configuration rows. They are immutable
 * governed artifacts. Every policy version is a permanent record with a
 * cryptographic content hash. No in-place mutation is permitted.
 *
 * New versions create new rows; the superseded_by FK chains lineage.
 * All lifecycle state transitions are validated by the policy-lifecycle FSM
 * and recorded in policy_governance_events (not here).
 *
 * This table is the source of truth for:
 *  - What policies exist and in what state
 *  - Which workflows each policy governs
 *  - Who approved each version
 *  - What integrity hash was computed at publish time
 *  - What supersession chain leads to the current version
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// ── Enums ────────────────────────────────────────────────────────────────────

export const policyLifecycleStatusEnum = pgEnum('policy_lifecycle_status', [
  'draft',
  'review_pending',
  'approval_required',
  'approved',
  'published',
  'active',
  'superseded',
  'deprecated',
  'revoked',
  'archived',
])

export const policyRiskClassificationEnum = pgEnum('policy_risk_classification', [
  'low',
  'medium',
  'high',
  'critical',
])

export const policyApprovalChainTypeEnum = pgEnum('policy_approval_chain_type', [
  'single',
  'multi',
  'sequential',
  'domain',
  'emergency',
])

export const policyApprovalActionEnum = pgEnum('policy_approval_action', [
  'approved',
  'rejected',
  'delegated',
  'withdrawn',
])

// ── governed_policies ─────────────────────────────────────────────────────────

export const governedPolicies = pgTable(
  'governed_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity
    /** Stable logical identifier — same across all versions of a policy family. */
    policyFamilyId: text('policy_family_id').notNull(),
    /** Semantic version string (e.g. "1.0.0", "2.3.1"). */
    semver: text('semver').notNull(),
    /** Human-readable name. */
    name: text('name').notNull(),

    // Scope
    /** Platform governance domain (must be a SUPPORTED_DOMAINS value). */
    domain: text('domain').notNull(),
    /**
     * Org scope. NULL = platform-wide policy applicable to all orgs.
     * Non-null = org-specific override/extension.
     */
    orgId: uuid('org_id'),

    // Workflow bindings — which workflowIds this policy governs
    workflowBindings: jsonb('workflow_bindings')
      .notNull()
      .default([]),
    /** Operational scope metadata (e.g. resource types, actor types). */
    operationalScope: jsonb('operational_scope').notNull().default({}),

    // Authorship
    authorId: text('author_id').notNull(),
    authorRole: text('author_role').notNull(),

    // Governance metadata
    governanceRationale: text('governance_rationale').notNull(),
    riskClassification: policyRiskClassificationEnum('risk_classification')
      .notNull()
      .default('medium'),
    /** Days between mandatory review cycles. */
    reviewCadenceDays: integer('review_cadence_days').notNull().default(365),
    /**
     * Replay compatibility version — policies with different values may
     * produce incomparable replay results.
     */
    replayCompatibilityVersion: text('replay_compatibility_version').notNull().default('1'),

    // Lifecycle state
    lifecycleStatus: policyLifecycleStatusEnum('lifecycle_status').notNull().default('draft'),

    // Integrity
    /**
     * SHA-256 hash of the canonical JSON serialization. Computed at
     * publish time and frozen. NULL until the policy reaches `published`.
     */
    contentHash: text('content_hash'),
    /**
     * HMAC-SHA-256 signature (placeholder; reserved for asymmetric upgrade).
     * NULL until explicitly signed.
     */
    contentSignature: text('content_signature'),
    /** True once content_hash has been verified after signing. */
    integrityVerified: boolean('integrity_verified').notNull().default(false),

    // Effective window
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),

    // Lifecycle timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    // Lineage — self-FK; set when a newer version supersedes this one
    /** ID of the policy row that supersedes this version. NULL = current head. */
    supersededBy: uuid('superseded_by'),

    // Review
    /** Last governance review timestamp. */
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    lastReviewedBy: text('last_reviewed_by'),
    nextReviewDue: timestamp('next_review_due', { withTimezone: true }),
  },
  (table) => [
    index('governed_policies_family_idx').on(table.policyFamilyId),
    index('governed_policies_domain_idx').on(table.domain, table.lifecycleStatus),
    index('governed_policies_org_idx').on(table.orgId, table.lifecycleStatus),
    index('governed_policies_status_idx').on(table.lifecycleStatus),
    index('governed_policies_hash_idx').on(table.contentHash),
    index('governed_policies_superseded_idx').on(table.supersededBy),
  ],
)

export type GovernedPolicyRow = typeof governedPolicies.$inferSelect
export type NewGovernedPolicyRow = typeof governedPolicies.$inferInsert

// ── policy_approval_chains ────────────────────────────────────────────────────

export const policyApprovalChains = pgTable(
  'policy_approval_chains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    governedPolicyId: uuid('governed_policy_id')
      .notNull()
      .references(() => governedPolicies.id),

    chainType: policyApprovalChainTypeEnum('chain_type').notNull().default('single'),
    /** Minimum number of approvals required to satisfy the chain. */
    requiredApprovals: integer('required_approvals').notNull().default(1),
    /**
     * When true: named approver IDs must match in addition to role.
     * Required for risk_classification = high | critical policies.
     */
    requiresNamedApprovers: boolean('requires_named_approvers').notNull().default(false),
    /** Role names permitted to approve (role-gate, always applied first). */
    approverRoles: text('approver_roles').array().notNull().default([]),
    /** Specific user IDs required when requires_named_approvers = true. */
    namedApproverIds: text('named_approver_ids').array().notNull().default([]),
    /** Whether individual approvers may delegate to another named user. */
    delegatable: boolean('delegatable').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').notNull(),
  },
  (table) => [
    index('policy_approval_chains_policy_idx').on(table.governedPolicyId),
  ],
)

export type PolicyApprovalChainRow = typeof policyApprovalChains.$inferSelect
export type NewPolicyApprovalChainRow = typeof policyApprovalChains.$inferInsert

// ── policy_approval_actions ───────────────────────────────────────────────────
//
// Append-only. Every individual approval action is a permanent record.
// No UPDATE/DELETE permitted (enforced by DB trigger in migration).

export const policyApprovalActions = pgTable(
  'policy_approval_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chainId: uuid('chain_id')
      .notNull()
      .references(() => policyApprovalChains.id),
    governedPolicyId: uuid('governed_policy_id')
      .notNull()
      .references(() => governedPolicies.id),

    approverUserId: text('approver_user_id').notNull(),
    approverRole: text('approver_role').notNull(),
    action: policyApprovalActionEnum('action').notNull(),
    comments: text('comments'),
    rationale: text('rationale'),
    /** When action = 'delegated': the user this approval was handed to. */
    delegatedToUserId: text('delegated_to_user_id'),

    // Immutable — set at INSERT, never changed
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('policy_approval_actions_chain_idx').on(table.chainId),
    index('policy_approval_actions_policy_idx').on(table.governedPolicyId),
    index('policy_approval_actions_approver_idx').on(table.approverUserId),
  ],
)

export type PolicyApprovalActionRow = typeof policyApprovalActions.$inferSelect
export type NewPolicyApprovalActionRow = typeof policyApprovalActions.$inferInsert
