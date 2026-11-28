/**
 * Durable inbound integration relations (platform migration 0090, RLS scoped 0063).
 *
 * The migration is authoritative: it also installs the guard triggers that make revocation terminal, receipts and
 * mapping versions immutable once settled, and identity links retargetable never. Application code must not issue DDL.
 * Reached only through lib/integrations/inbound.
 */
import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

export const ueIntegrationSources = pgTable('ue_integration_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  sourceKey: varchar('source_key', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  authorizedBy: text('authorized_by').notNull(),
  authorizedAt: timestamp('authorized_at', { withTimezone: true }).notNull().defaultNow(),
  revokedBy: text('revoked_by'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revocationReason: varchar('revocation_reason', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ue_integration_sources_org_key_idx').on(table.organizationId, table.sourceKey),
  uniqueIndex('ue_integration_sources_org_id_idx').on(table.organizationId, table.id),
  check('ue_integration_sources_status_check', sql`${table.status} IN ('active', 'revoked')`),
  check('ue_integration_sources_key_check', sql`${table.sourceKey} ~ '^[a-z0-9][a-z0-9._-]{0,99}$'`),
  check('ue_integration_sources_revocation_check', sql`(${table.status} = 'active' AND ${table.revokedAt} IS NULL AND ${table.revokedBy} IS NULL)
    OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL AND ${table.revokedBy} IS NOT NULL AND ${table.revocationReason} IS NOT NULL)`),
])

export const ueIntegrationMappingVersions = pgTable('ue_integration_mapping_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  sourceId: uuid('source_id').notNull(),
  version: integer('version').notNull(),
  targetEntity: varchar('target_entity', { length: 50 }).notNull(),
  sourceSchemaVersion: varchar('source_schema_version', { length: 50 }).notNull(),
  rule: jsonb('rule').notNull(),
  ruleDigest: varchar('rule_digest', { length: 64 }).notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ue_integration_mapping_versions_source_version_idx').on(table.organizationId, table.sourceId, table.version),
  check('ue_integration_mapping_versions_version_check', sql`${table.version} > 0`),
  check('ue_integration_mapping_versions_digest_check', sql`${table.ruleDigest} ~ '^[0-9a-f]{64}$'`),
  foreignKey({ name: 'ue_integration_mapping_versions_source_fk', columns: [table.organizationId, table.sourceId], foreignColumns: [ueIntegrationSources.organizationId, ueIntegrationSources.id] }),
])

export const ueIntegrationInboundReceipts = pgTable('ue_integration_inbound_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  sourceId: uuid('source_id').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  payloadDigest: varchar('payload_digest', { length: 64 }).notNull(),
  mappingVersion: integer('mapping_version').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('claimed'),
  claimToken: uuid('claim_token').notNull(),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(1),
  retryable: boolean('retryable').notNull().default(false),
  reasonCode: varchar('reason_code', { length: 80 }),
  reasonDetail: jsonb('reason_detail'),
  effect: varchar('effect', { length: 20 }),
  caseId: uuid('case_id'),
  identityLinkId: uuid('identity_link_id'),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ue_integration_inbound_receipts_claim_key_idx').on(table.organizationId, table.sourceId, table.idempotencyKey),
  uniqueIndex('ue_integration_inbound_receipts_org_id_idx').on(table.organizationId, table.id),
  index('ue_integration_inbound_receipts_status_idx').on(table.organizationId, table.status, table.leaseExpiresAt),
  check('ue_integration_inbound_receipts_status_check', sql`${table.status} IN ('claimed', 'completed', 'rejected', 'quarantined', 'failed')`),
  check('ue_integration_inbound_receipts_digest_check', sql`${table.payloadDigest} ~ '^[0-9a-f]{64}$'`),
  check('ue_integration_inbound_receipts_key_check', sql`length(btrim(${table.idempotencyKey})) > 0`),
  check('ue_integration_inbound_receipts_attempts_check', sql`${table.attempts} > 0`),
  check('ue_integration_inbound_receipts_effect_check', sql`${table.effect} IS NULL OR ${table.effect} IN ('created', 'existing')`),
  check('ue_integration_inbound_receipts_completed_check', sql`${table.status} <> 'completed'
    OR (${table.caseId} IS NOT NULL AND ${table.identityLinkId} IS NOT NULL AND ${table.effect} IS NOT NULL AND ${table.finishedAt} IS NOT NULL AND ${table.reasonCode} IS NULL)`),
  check('ue_integration_inbound_receipts_unsuccessful_check', sql`${table.status} NOT IN ('rejected', 'quarantined', 'failed')
    OR (${table.reasonCode} IS NOT NULL AND ${table.finishedAt} IS NOT NULL AND ${table.caseId} IS NULL AND ${table.effect} IS NULL)`),
  check('ue_integration_inbound_receipts_claimed_check', sql`${table.status} <> 'claimed' OR (${table.finishedAt} IS NULL AND ${table.caseId} IS NULL AND ${table.effect} IS NULL)`),
  foreignKey({ name: 'ue_integration_inbound_receipts_source_fk', columns: [table.organizationId, table.sourceId], foreignColumns: [ueIntegrationSources.organizationId, ueIntegrationSources.id] }),
  foreignKey({ name: 'ue_integration_inbound_receipts_mapping_fk', columns: [table.organizationId, table.sourceId, table.mappingVersion], foreignColumns: [ueIntegrationMappingVersions.organizationId, ueIntegrationMappingVersions.sourceId, ueIntegrationMappingVersions.version] }),
])

export const ueIntegrationIdentityLinks = pgTable('ue_integration_identity_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  sourceId: uuid('source_id').notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  internalId: uuid('internal_id').notNull(),
  createdByReceiptId: uuid('created_by_receipt_id').notNull(),
  staleAt: timestamp('stale_at', { withTimezone: true }),
  staleReason: varchar('stale_reason', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ue_integration_identity_links_external_idx').on(table.organizationId, table.sourceId, table.entityType, table.externalId),
  index('ue_integration_identity_links_internal_idx').on(table.organizationId, table.entityType, table.internalId),
  check('ue_integration_identity_links_external_check', sql`length(btrim(${table.externalId})) > 0`),
  check('ue_integration_identity_links_stale_check', sql`(${table.staleAt} IS NULL) = (${table.staleReason} IS NULL)`),
  foreignKey({ name: 'ue_integration_identity_links_source_fk', columns: [table.organizationId, table.sourceId], foreignColumns: [ueIntegrationSources.organizationId, ueIntegrationSources.id] }),
  foreignKey({ name: 'ue_integration_identity_links_receipt_fk', columns: [table.organizationId, table.createdByReceiptId], foreignColumns: [ueIntegrationInboundReceipts.organizationId, ueIntegrationInboundReceipts.id] }),
])

export const ueIntegrationOutbox = pgTable('ue_integration_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  receiptId: uuid('receipt_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ue_integration_outbox_receipt_event_idx').on(table.receiptId, table.eventType),
  index('ue_integration_outbox_pending_idx').on(table.organizationId, table.publishedAt),
  foreignKey({ name: 'ue_integration_outbox_receipt_fk', columns: [table.organizationId, table.receiptId], foreignColumns: [ueIntegrationInboundReceipts.organizationId, ueIntegrationInboundReceipts.id] }),
])
