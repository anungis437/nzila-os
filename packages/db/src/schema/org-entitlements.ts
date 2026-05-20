/**
 * org_entitlements — per-org feature entitlement ledger.
 *
 * This is the durable source of truth that the Control Plane
 * entitlement authority reads from when
 * `CONTROL_PLANE_ENTITLEMENT_SOURCE=db`. Until this table is
 * populated for an org, the resolver falls back to the conservative
 * stub allow-list (`CONTROL_PLANE_DEFAULT_ENTITLEMENTS`) so the
 * production deny-by-default safety net stays intact.
 *
 * One row per (orgId, feature). Rewriting an entitlement (e.g. tier
 * upgrade, limit change, expiry extension) is an UPSERT keyed on
 * that pair.
 */
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { orgs } from './orgs'

export const entitlementTierEnum = pgEnum('entitlement_tier', [
  'free',
  'standard',
  'professional',
  'enterprise',
])

export const orgEntitlements = pgTable(
  'org_entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    /** Feature identifier (e.g. `decisions.replay`, `ai.copilot`). */
    feature: text('feature').notNull(),
    /** Subscription tier this entitlement was granted at. */
    tier: entitlementTierEnum('tier').notNull().default('standard'),
    /**
     * Optional quantitative cap (seats, monthly calls, etc.). NULL
     * means unlimited within the tier.
     */
    limit: integer('limit'),
    /**
     * Optional expiry (e.g. trial, time-boxed pilot). NULL means the
     * entitlement does not auto-expire and is governed by the
     * subscription lifecycle instead.
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /**
     * Where the row originated (e.g. `stripe`, `manual`, `seed`,
     * `pilot-grant`). Free-form for now; tightened to an enum once
     * billing integration solidifies.
     */
    source: text('source').notNull().default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgFeatureUnique: uniqueIndex('org_entitlements_org_feature_uidx').on(
      table.orgId,
      table.feature,
    ),
    orgIdx: index('org_entitlements_org_idx').on(table.orgId),
    expiresIdx: index('org_entitlements_expires_idx').on(table.expiresAt),
  }),
)

export type OrgEntitlement = typeof orgEntitlements.$inferSelect
export type NewOrgEntitlement = typeof orgEntitlements.$inferInsert
