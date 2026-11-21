/** Django grievances owns these logical-case facts. Installation never adopts an institutional scope. */
import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, varchar, integer, timestamp, unique, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { claims } from '../../claims-schema';
import { grievances } from './grievances';
import { bargainingUnits } from '../../union-structure-schema';

const identity = () => uuid('id').primaryKey().defaultRandom();
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const caseTerritories = pgTable('case_territories', {
  id: identity(), organizationId: uuid('organization_id').notNull(), name: varchar('name', { length: 255 }).notNull(),
  sourceInstrument: text('source_instrument').notNull(), recordedBy: varchar('recorded_by', { length: 255 }).notNull(),
  retiredAt: timestamp('retired_at', { withTimezone: true }), retiredBy: varchar('retired_by', { length: 255 }),
  createdAt: created(), updatedAt: updated(),
}, (t) => [unique('case_territories_org_id_uniq').on(t.organizationId, t.id)]);

export const caseAuthorityScopes = pgTable('case_authority_scopes', {
  id: identity(), organizationId: uuid('organization_id').notNull(), caseId: uuid('case_id').notNull(),
  claimId: uuid('claim_id').references(() => claims.claimId), grievanceId: uuid('grievance_id').references(() => grievances.id),
  grievanceMirrorId: uuid('grievance_mirror_id').references(() => grievances.id),
  mirrorRecordedAt: timestamp('mirror_recorded_at', { withTimezone: true }), mirrorRecordedBy: varchar('mirror_recorded_by', { length: 255 }),
  unitId: uuid('unit_id').references(() => bargainingUnits.id), territoryId: uuid('territory_id').references(() => caseTerritories.id),
  revision: integer('revision').notNull().default(0), lastProposalId: uuid('last_proposal_id'), createdAt: created(), updatedAt: updated(),
}, (t) => [
  unique('case_scope_org_case_uniq').on(t.organizationId, t.caseId), unique('case_scope_org_id_uniq').on(t.organizationId, t.id),
  check('case_scope_exact_parent_chk', sql`(${t.claimId} IS NOT NULL AND ${t.grievanceId} IS NULL) OR (${t.claimId} IS NULL AND ${t.grievanceId} IS NOT NULL)`),
  check('case_scope_parent_key_chk', sql`(${t.claimId} IS NOT NULL AND ${t.claimId} = ${t.caseId}) OR (${t.grievanceId} IS NOT NULL AND ${t.grievanceId} = ${t.caseId})`),
]);

export const caseScopeProposals = pgTable('case_scope_proposals', {
  id: identity(), organizationId: uuid('organization_id').notNull(), scopeId: uuid('scope_id').notNull().references(() => caseAuthorityScopes.id),
  expectedRevision: integer('expected_revision').notNull(), unitId: uuid('unit_id').references(() => bargainingUnits.id),
  territoryId: uuid('territory_id').references(() => caseTerritories.id), respondentUserIds: varchar('respondent_user_ids', { length: 255 }).array().notNull().default(sql`'{}'::varchar[]`),
  proposedBy: varchar('proposed_by', { length: 255 }).notNull(), issuanceRuleId: uuid('issuance_rule_id').notNull(),
  approvalRequestId: uuid('approval_request_id').notNull().unique(), appliedAt: timestamp('applied_at', { withTimezone: true }),
  appliedBy: varchar('applied_by', { length: 255 }), createdAt: created(), updatedAt: updated(),
}, (t) => [
  unique('case_scope_proposal_org_id_uniq').on(t.organizationId, t.id),
  check('case_scope_proposal_applied_pair_chk', sql`(${t.appliedAt} IS NULL AND ${t.appliedBy} IS NULL) OR (${t.appliedAt} IS NOT NULL AND ${t.appliedBy} IS NOT NULL)`),
]);

export const caseRespondents = pgTable('case_respondents', {
  id: identity(), organizationId: uuid('organization_id').notNull(), scopeId: uuid('scope_id').notNull().references(() => caseAuthorityScopes.id),
  respondentUserId: varchar('respondent_user_id', { length: 255 }).notNull(), proposalId: uuid('proposal_id').notNull().references(() => caseScopeProposals.id),
  recordedBy: varchar('recorded_by', { length: 255 }).notNull(), recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }), revokedBy: varchar('revoked_by', { length: 255 }),
  revokedProposalId: uuid('revoked_proposal_id').references(() => caseScopeProposals.id), createdAt: created(), updatedAt: updated(),
}, (t) => [uniqueIndex('case_respondent_active_uniq').on(t.organizationId, t.scopeId, t.respondentUserId).where(sql`revoked_at IS NULL`),
  check('case_respondent_revoked_pair_chk', sql`(${t.revokedAt} IS NULL AND ${t.revokedBy} IS NULL AND ${t.revokedProposalId} IS NULL) OR (${t.revokedAt} IS NOT NULL AND ${t.revokedBy} IS NOT NULL AND ${t.revokedProposalId} IS NOT NULL)`),
]);
