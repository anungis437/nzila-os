/**
 * Institutional Authority Kernel — authoritative storage schema.
 *
 * Created by platform migration 0013 and protected by scoped migration 0020.
 * Application code must not issue DDL for these relations. They are written only
 * through lib/authority/store inside runAuthorityTransaction; database triggers
 * enforce append-only semantics, terminal revocation, one-person-one-vote and
 * in-transaction recording in ue_authority_events.
 */

import { pgTable, uuid, text, integer, bigint, boolean, jsonb, timestamp, index, uniqueIndex, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const ueAuthorityMandates = pgTable('ue_authority_mandates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  principalUserId: uuid('principal_user_id').notNull(),
  kind: text('kind').notNull(),
  powers: text('powers').array().notNull(),
  scope: jsonb('scope').notNull().default({}),
  monetaryLimitMinor: bigint('monetary_limit_minor', { mode: 'number' }),
  currency: text('currency'),
  sourceInstrument: text('source_instrument').notNull(),
  grantedBy: uuid('granted_by').notNull(),
  approvedBy: uuid('approved_by'),
  justification: text('justification'),
  status: text('status').notNull().default('active'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  principalIdx: index('ue_authority_mandates_principal_idx').on(table.organizationId, table.principalUserId, table.kind).where(sql`status = 'active'`),
  activeUq: uniqueIndex('ue_authority_mandates_active_uq').on(table.organizationId, table.principalUserId, table.kind, table.sourceInstrument).where(sql`status = 'active'`),
}));

export const ueAuthorityResourceRelationships = pgTable('ue_authority_resource_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  principalUserId: uuid('principal_user_id').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  relation: text('relation').notNull(),
  permissions: text('permissions').array().notNull().default(sql`'{}'::text[]`),
  privilegedAccess: boolean('privileged_access').notNull().default(false),
  origin: text('origin').notNull(),
  grantedBy: uuid('granted_by'),
  status: text('status').notNull().default('active'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  resourceIdx: index('ue_authority_rel_resource_idx').on(table.organizationId, table.resourceType, table.resourceId).where(sql`status = 'active'`),
  activeUq: uniqueIndex('ue_authority_rel_active_uq').on(table.organizationId, table.principalUserId, table.resourceType, table.resourceId, table.relation).where(sql`status = 'active'`),
}));

export const ueAuthorityDelegations = pgTable('ue_authority_delegations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  delegatorUserId: uuid('delegator_user_id').notNull(),
  delegateUserId: uuid('delegate_user_id').notNull(),
  office: text('office').notNull(),
  actions: text('actions').array().notNull(),
  resourceTypes: text('resource_types').array().notNull(),
  status: text('status').notNull().default('active'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  delegateIdx: index('ue_authority_deleg_delegate_idx').on(table.organizationId, table.delegateUserId).where(sql`status = 'active'`),
}));

export const ueAuthorityRecusals = pgTable('ue_authority_recusals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  principalUserId: uuid('principal_user_id').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  reason: text('reason').notNull(),
  declaredAt: timestamp('declared_at', { withTimezone: true }).notNull().defaultNow(),
  liftedAt: timestamp('lifted_at', { withTimezone: true }),
  liftedBy: uuid('lifted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  resourceIdx: index('ue_authority_recusal_resource_idx').on(table.organizationId, table.resourceType, table.resourceId).where(sql`lifted_at IS NULL`),
}));

export const ueAuthorityDisclosureConsents = pgTable('ue_authority_disclosure_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  memberUserId: uuid('member_user_id').notNull(),
  matterId: uuid('matter_id').notNull(),
  direction: text('direction').notNull(),
  issuer: text('issuer').notNull(),
  issuedBy: uuid('issued_by').notNull(),
  categories: text('categories').array().notNull(),
  recipientUserId: uuid('recipient_user_id'),
  purpose: text('purpose').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  matterIdx: index('ue_authority_consent_matter_idx').on(table.organizationId, table.matterId).where(sql`revoked_at IS NULL`),
}));

export const ueAuthorityApprovalRequests = pgTable('ue_authority_approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  proposedBy: uuid('proposed_by').notNull(),
  subjectAuthorId: uuid('subject_author_id'),
  requiredApprovals: integer('required_approvals').notNull(),
  riskClass: text('risk_class').notNull(),
  namedApproverIds: uuid('named_approver_ids').array().notNull().default(sql`'{}'::uuid[]`),
  eligibleCapacities: text('eligible_capacities').array().notNull().default(sql`'{}'::text[]`),
  adverseUserIds: uuid('adverse_user_ids').array().notNull().default(sql`'{}'::uuid[]`),
  status: text('status').notNull().default('open'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  subjectIdx: index('ue_authority_req_subject_idx').on(table.organizationId, table.subjectType, table.subjectId),
}));

export const ueAuthorityApprovalDecisions = pgTable('ue_authority_approval_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  approvalRequestId: uuid('approval_request_id').notNull().references(() => ueAuthorityApprovalRequests.id),
  approverUserId: uuid('approver_user_id').notNull(),
  authorityLineUserId: uuid('authority_line_user_id').notNull(),
  delegationId: uuid('delegation_id').references(() => ueAuthorityDelegations.id),
  decision: text('decision').notNull(),
  rationale: text('rationale'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  oneVote: unique('ue_authority_dec_one_vote_uq').on(table.organizationId, table.approvalRequestId, table.authorityLineUserId),
  oneApprover: unique('ue_authority_dec_one_approver_uq').on(table.organizationId, table.approvalRequestId, table.approverUserId),
}));

export const ueAuthorityEvents = pgTable('ue_authority_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventSeq: bigint('event_seq', { mode: 'number' }).generatedAlwaysAsIdentity(),
  organizationId: uuid('organization_id').notNull(),
  sourceTable: text('source_table').notNull(),
  sourceId: uuid('source_id').notNull(),
  operation: text('operation').notNull(),
  actorUserId: text('actor_user_id'),
  rowBefore: jsonb('row_before'),
  rowAfter: jsonb('row_after').notNull(),
  txid: bigint('txid', { mode: 'number' }).notNull().default(sql`txid_current()`),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
}, (table) => ({
  sourceIdx: index('ue_authority_events_source_idx').on(table.organizationId, table.sourceTable, table.sourceId),
}));
