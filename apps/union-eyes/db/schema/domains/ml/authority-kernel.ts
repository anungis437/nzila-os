/**
 * Institutional Authority Kernel — authoritative storage schema.
 *
 * Created by platform migration 0013 and protected by scoped migration 0020.
 * Application code must not issue DDL for these relations. They are written only
 * through lib/authority/store inside runAuthorityTransaction; database triggers
 * enforce append-only semantics, terminal revocation, one-person-one-vote,
 * issuance-rule ceilings, financial segregation of duties, in-transaction
 * recording in ue_authority_events, and a deferred link to the canonical audit
 * chain. Principals are the canonical INTERNAL user id (varchar(255), not a uuid).
 */

import { pgTable, uuid, text, varchar, integer, bigint, boolean, jsonb, timestamp, index, uniqueIndex, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const principal = (name: string) => varchar(name, { length: 255 });

export const ueAuthorityIssuanceRules = pgTable('ue_authority_issuance_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  domain: text('domain').notNull(),
  operation: text('operation').notNull(),
  issuerCapacities: text('issuer_capacities').array().notNull().default(sql`'{}'::text[]`),
  issuerMandateKind: text('issuer_mandate_kind'),
  issuerMandatePower: text('issuer_mandate_power'),
  allowedPowers: text('allowed_powers').array().notNull().default(sql`'{}'::text[]`),
  maxTermDays: integer('max_term_days'),
  requiresAcceptance: boolean('requires_acceptance').notNull().default(false),
  requiredIndependentApprovals: integer('required_independent_approvals').notNull().default(0),
  version: integer('version').notNull(),
  status: text('status').notNull().default('draft'),
  sourceInstrument: text('source_instrument').notNull(),
  draftedBy: principal('drafted_by').notNull(),
  approvedBy: principal('approved_by').array().notNull().default(sql`'{}'::text[]`),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  versionUq: unique('ue_authority_rule_version_uq').on(table.organizationId, table.domain, table.operation, table.version),
  activeUq: uniqueIndex('ue_authority_rule_active_uq').on(table.organizationId, table.domain, table.operation).where(sql`status = 'active'`),
}));

export const ueAuthorityMandates = pgTable('ue_authority_mandates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  principalUserId: principal('principal_user_id').notNull(),
  kind: text('kind').notNull(),
  powers: text('powers').array().notNull(),
  scope: jsonb('scope').notNull().default({}),
  monetaryLimitMinor: bigint('monetary_limit_minor', { mode: 'number' }),
  currency: text('currency'),
  sourceInstrument: text('source_instrument').notNull(),
  grantedBy: principal('granted_by').notNull(),
  approvedBy: principal('approved_by'),
  justification: text('justification'),
  status: text('status').notNull().default('active'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: principal('revoked_by'),
  issuanceRuleId: uuid('issuance_rule_id'),
  approvalRequestId: uuid('approval_request_id'),
  supersedesId: uuid('supersedes_id'),
  requiresAcceptance: boolean('requires_acceptance').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  principalIdx: index('ue_authority_mandates_principal_idx').on(table.organizationId, table.principalUserId, table.kind).where(sql`status = 'active'`),
  activeUq: uniqueIndex('ue_authority_mandates_active_uq').on(table.organizationId, table.principalUserId, table.kind, table.sourceInstrument).where(sql`status = 'active'`),
  requestUq: uniqueIndex('ue_authority_mandates_request_uq').on(table.approvalRequestId).where(sql`approval_request_id IS NOT NULL`),
}));

export const ueAuthorityResourceRelationships = pgTable('ue_authority_resource_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  principalUserId: principal('principal_user_id').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  relation: text('relation').notNull(),
  permissions: text('permissions').array().notNull().default(sql`'{}'::text[]`),
  privilegedAccess: boolean('privileged_access').notNull().default(false),
  origin: text('origin').notNull(),
  grantedBy: principal('granted_by'),
  status: text('status').notNull().default('active'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: principal('revoked_by'),
  issuanceRuleId: uuid('issuance_rule_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  resourceIdx: index('ue_authority_rel_resource_idx').on(table.organizationId, table.resourceType, table.resourceId).where(sql`status = 'active'`),
  activeUq: uniqueIndex('ue_authority_rel_active_uq').on(table.organizationId, table.principalUserId, table.resourceType, table.resourceId, table.relation).where(sql`status = 'active'`),
}));

export const ueAuthorityDelegations = pgTable('ue_authority_delegations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  delegatorUserId: principal('delegator_user_id').notNull(),
  delegateUserId: principal('delegate_user_id').notNull(),
  office: text('office').notNull(),
  actions: text('actions').array().notNull(),
  resourceTypes: text('resource_types').array().notNull(),
  status: text('status').notNull().default('active'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: principal('revoked_by'),
  issuanceRuleId: uuid('issuance_rule_id'),
  approvalRequestId: uuid('approval_request_id'),
  requiresAcceptance: boolean('requires_acceptance').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  delegateIdx: index('ue_authority_deleg_delegate_idx').on(table.organizationId, table.delegateUserId).where(sql`status = 'active'`),
  requestUq: uniqueIndex('ue_authority_deleg_request_uq').on(table.approvalRequestId).where(sql`approval_request_id IS NOT NULL`),
}));

export const ueAuthorityRecusals = pgTable('ue_authority_recusals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  principalUserId: principal('principal_user_id').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  reason: text('reason').notNull(),
  declaredAt: timestamp('declared_at', { withTimezone: true }).notNull().defaultNow(),
  liftedAt: timestamp('lifted_at', { withTimezone: true }),
  liftedBy: principal('lifted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  resourceIdx: index('ue_authority_recusal_resource_idx').on(table.organizationId, table.resourceType, table.resourceId).where(sql`lifted_at IS NULL`),
}));

export const ueAuthorityDisclosureConsents = pgTable('ue_authority_disclosure_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  memberUserId: principal('member_user_id').notNull(),
  matterId: uuid('matter_id').notNull(),
  direction: text('direction').notNull(),
  issuer: text('issuer').notNull(),
  issuedBy: principal('issued_by').notNull(),
  categories: text('categories').array().notNull(),
  recipientUserId: principal('recipient_user_id'),
  purpose: text('purpose').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: principal('revoked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  matterIdx: index('ue_authority_consent_matter_idx').on(table.organizationId, table.matterId).where(sql`revoked_at IS NULL`),
}));

export const ueAuthorityApprovalRequests = pgTable('ue_authority_approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  proposedBy: principal('proposed_by').notNull(),
  subjectAuthorId: principal('subject_author_id'),
  requiredApprovals: integer('required_approvals').notNull(),
  riskClass: text('risk_class').notNull(),
  namedApproverIds: principal('named_approver_ids').array().notNull().default(sql`'{}'::text[]`),
  eligibleCapacities: text('eligible_capacities').array().notNull().default(sql`'{}'::text[]`),
  adverseUserIds: principal('adverse_user_ids').array().notNull().default(sql`'{}'::text[]`),
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
  approverUserId: principal('approver_user_id').notNull(),
  authorityLineUserId: principal('authority_line_user_id').notNull(),
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

export const ueAuthorityAcceptances = pgTable('ue_authority_acceptances', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  instrumentType: text('instrument_type').notNull(),
  instrumentId: uuid('instrument_id').notNull(),
  acceptedBy: principal('accepted_by').notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  once: unique('ue_authority_accept_once_uq').on(table.organizationId, table.instrumentType, table.instrumentId),
}));

export const ueAuthorityRequests = pgTable('ue_authority_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  operation: text('operation').notNull(),
  requestHash: text('request_hash').notNull(),
  actor: principal('actor').notNull(),
  result: jsonb('result'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  keyUq: unique('ue_authority_req_key_uq').on(table.organizationId, table.idempotencyKey),
}));

export const ueAuthorityFinancialSteps = pgTable('ue_authority_financial_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  subjectType: text('subject_type').notNull().default('payment'),
  subjectId: uuid('subject_id').notNull(),
  step: text('step').notNull(),
  actor: principal('actor').notNull(),
  accountId: uuid('account_id'),
  requiredApprovals: integer('required_approvals'),
  amountMinor: bigint('amount_minor', { mode: 'number' }),
  currency: text('currency'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  stepUq: uniqueIndex('ue_authority_fin_step_uq').on(table.organizationId, table.subjectType, table.subjectId, table.step).where(sql`step <> 'approved'`),
  approverUq: uniqueIndex('ue_authority_fin_approver_uq').on(table.organizationId, table.subjectType, table.subjectId, table.actor).where(sql`step = 'approved'`),
}));

export const ueAuthorityReviews = pgTable('ue_authority_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  reviewType: text('review_type').notNull(),
  complainantUserId: principal('complainant_user_id'),
  adverseUserIds: principal('adverse_user_ids').array().notNull().default(sql`'{}'::text[]`),
  classification: text('classification').notNull().default('standard'),
  remediationOwnerUserId: principal('remediation_owner_user_id'),
  openedBy: principal('opened_by').notNull(),
  status: text('status').notNull().default('open'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ueAuthorityWorkaidMatters = pgTable('ue_authority_workaid_matters', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  memberUserId: principal('member_user_id').notNull(),
  caseId: uuid('case_id').notNull(),
  referredBy: principal('referred_by').notNull(),
  referredAt: timestamp('referred_at', { withTimezone: true }).notNull().defaultNow(),
  counselAcceptedAt: timestamp('counsel_accepted_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseUq: uniqueIndex('ue_authority_workaid_case_uq').on(table.organizationId, table.caseId).where(sql`withdrawn_at IS NULL`),
}));

export const ueAuthorityCounselEngagements = pgTable('ue_authority_counsel_engagements', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  matterId: uuid('matter_id').notNull().references(() => ueAuthorityWorkaidMatters.id),
  counselUserId: principal('counsel_user_id').notNull(),
  capacity: text('capacity').notNull(),
  informationBarrier: boolean('information_barrier').notNull().default(false),
  recordedBy: principal('recorded_by').notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: principal('revoked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  liveUq: uniqueIndex('ue_authority_engagement_live_uq').on(table.organizationId, table.matterId, table.counselUserId).where(sql`revoked_at IS NULL`),
}));

export const ueAuthorityCounselNonces = pgTable('ue_authority_counsel_nonces', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  matterId: uuid('matter_id').notNull(),
  nonceHash: text('nonce_hash').notNull(),
  consumedBy: principal('consumed_by').notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
  nonceUq: uniqueIndex('ue_authority_nonce_uq').on(table.organizationId, table.nonceHash),
}));

// ── Union-side WorkAid consent and disclosure (platform 0027, RLS cache 0026) ─────────────────────────────────────
// References and authorisations only. The counsel-side system, its issuer allow-list and key custody are external.

export const ueAuthorityWorkaidConsentTexts = pgTable('ue_authority_workaid_consent_texts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  version: text('version').notNull(),
  body: text('body').notNull(),
  bodySha256: text('body_sha256').notNull(),
  recordedBy: principal('recorded_by').notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  retiredBy: principal('retired_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  versionUq: unique('ue_authority_wa_text_version_uq').on(table.organizationId, table.version),
}));

export const ueAuthorityWorkaidConsentGrants = pgTable('ue_authority_workaid_consent_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  consentId: uuid('consent_id').notNull().references(() => ueAuthorityDisclosureConsents.id),
  matterId: uuid('matter_id').notNull(),
  caseId: uuid('case_id').notNull(),
  memberUserId: principal('member_user_id').notNull(),
  textId: uuid('text_id').notNull().references(() => ueAuthorityWorkaidConsentTexts.id),
  textVersion: text('text_version').notNull(),
  textSha256: text('text_sha256').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  consentUq: unique('ue_authority_wa_grant_consent_uq').on(table.consentId),
  matterUq: unique('ue_authority_wa_grant_matter_uq').on(table.organizationId, table.matterId),
  memberIdx: index('ue_authority_wa_grant_member_idx').on(table.organizationId, table.memberUserId),
}));

export const ueAuthorityWorkaidDocumentAuths = pgTable('ue_authority_workaid_document_auths', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  matterId: uuid('matter_id').notNull(),
  consentId: uuid('consent_id').notNull().references(() => ueAuthorityDisclosureConsents.id),
  documentId: uuid('document_id').notNull(),
  classification: text('classification').notNull(),
  authorisedBy: principal('authorised_by').notNull(),
  authorisedAt: timestamp('authorised_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: principal('revoked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  liveUq: uniqueIndex('ue_authority_wa_docauth_live_uq').on(table.organizationId, table.matterId, table.documentId).where(sql`revoked_at IS NULL`),
}));

export const ueAuthorityWorkaidShares = pgTable('ue_authority_workaid_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  matterId: uuid('matter_id').notNull().references(() => ueAuthorityWorkaidMatters.id),
  consentId: uuid('consent_id').notNull().references(() => ueAuthorityDisclosureConsents.id),
  kind: text('kind').notNull(),
  categories: text('categories').array().notNull(),
  documentAuthId: uuid('document_auth_id').references(() => ueAuthorityWorkaidDocumentAuths.id),
  createdBy: principal('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  invalidatedBy: principal('invalidated_by'),
  invalidationReason: text('invalidation_reason'),
}, (table) => ({
  matterIdx: index('ue_authority_wa_share_matter_idx').on(table.organizationId, table.matterId).where(sql`invalidated_at IS NULL`),
}));

export const ueAuthorityWorkaidCounselAccess = pgTable('ue_authority_workaid_counsel_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  matterId: uuid('matter_id').notNull().references(() => ueAuthorityWorkaidMatters.id),
  counselUserId: principal('counsel_user_id').notNull(),
  sharesServed: integer('shares_served').notNull(),
  accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
});
