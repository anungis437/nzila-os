/**
 * Union Eyes — Policy Lifecycle Extension Schema
 *
 * UE-specific table that links organization-scoped workflow overrides to the
 * platform-level governed_policies registry (packages/db).
 *
 * Enables per-org customization while maintaining full platform policy lineage.
 * An org can bind a governed policy to a local workflow with a custom evaluator
 * without forking or mutating the platform policy record.
 */
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { organizations } from './organizations-schema'

/**
 * ue_policy_bindings — links platform governed_policies to org-scoped workflows.
 *
 * The governed_policy_id references the ID column of the platform-level
 * governed_policies table (packages/db). The FK is intentionally soft (not
 * enforced at the DB level across databases) because packages/db may run in a
 * separate schema or database in some deployments.
 */
export const uePolicyBindings = pgTable('ue_policy_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** FK to organizations.id (org-scoped). */
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  /**
   * ID of the governed_policy row in the platform governed_policies table.
   * Soft FK — not DB-enforced across schemas.
   */
  governedPolicyId: uuid('governed_policy_id').notNull(),

  /** Platform semver at the time of binding (denormalized for audit). */
  governedPolicyVersion: text('governed_policy_version').notNull(),

  /** Local workflow ID within Union Eyes. */
  localWorkflowId: text('local_workflow_id').notNull(),

  /**
   * Domain scope for this binding within UE.
   * e.g. 'union_eyes', 'investigations', 'governance'
   */
  localDomainScope: text('local_domain_scope').notNull(),

  /**
   * Optional custom evaluator function name (must be registered in the
   * local policy registry). NULL = use the platform policy evaluator as-is.
   */
  customEvaluatorFnName: text('custom_evaluator_fn_name'),

  effectiveFrom: timestamp('effective_from', { withTimezone: true }),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),

  active: boolean('active').notNull().default(true),

  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
})

export type UePolicyBindingRow = typeof uePolicyBindings.$inferSelect
export type NewUePolicyBindingRow = typeof uePolicyBindings.$inferInsert
