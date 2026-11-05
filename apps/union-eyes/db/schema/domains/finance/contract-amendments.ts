/**
 * Contract Amendments, Rate Cards & Covered Orgs Schema
 *
 * Extends the contracts domain with:
 *  - contract_covered_orgs   — which locals/divisions a contract covers
 *
 * contract_rate_cards and contract_amendments are no longer declared: no code reads or writes them, and the
 * relations remain Django-owned (UE-CONV-H-007).
 *
 * @domain platform-economics
 * @layer 1.5 — Contracts & Entitlements (extension)
 */

import {
  pgTable, pgEnum, uuid, timestamp,
  jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { commercialContracts } from './contracts';

// ============================================================================
// ENUMS
// ============================================================================

export const amendmentStatusEnum = pgEnum('contract_amendment_status', [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'superseded',
]);

export const coveredOrgRoleEnum = pgEnum('covered_org_role', [
  'local',
  'division',
  'region',
  'employer',
]);

// ============================================================================
// CONTRACT RATE CARDS
// ============================================================================

// ============================================================================
// CONTRACT AMENDMENTS
// ============================================================================

// ============================================================================
// CONTRACT COVERED ORGS
// ============================================================================

export const contractCoveredOrgs = pgTable('contract_covered_orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => commercialContracts.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  role: coveredOrgRoleEnum('role').notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }).defaultNow().notNull(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  contractIdx: index('contract_covered_orgs_contract_idx').on(t.contractId),
  orgIdx: index('contract_covered_orgs_org_idx').on(t.organizationId),
  contractOrgIdx: uniqueIndex('contract_covered_orgs_contract_org_idx')
    .on(t.contractId, t.organizationId),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ContractCoveredOrg = typeof contractCoveredOrgs.$inferSelect;
export type NewContractCoveredOrg = typeof contractCoveredOrgs.$inferInsert;
