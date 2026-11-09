import { boolean, index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const equityConsentNoticeVersions = pgTable('equity_consent_notice_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  version: integer('version').notNull(),
  notice: jsonb('notice').$type<Record<string, unknown>>().notNull(),
  status: varchar('status', { length: 20 }).$type<'draft' | 'reviewed' | 'withdrawn'>().notNull(),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),
  retentionDays: integer('retention_days').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  purposeVersionUq: uniqueIndex('equity_consent_notice_versions_purpose_version_uniq').on(table.purpose, table.version),
  currentIdx: index('equity_consent_notice_versions_current_idx').on(table.purpose, table.status, table.effectiveFrom),
}));

export const equityPurposeConsents = pgTable('equity_purpose_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  subjectUserId: varchar('subject_user_id', { length: 255 }).notNull(),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  noticeVersionId: uuid('notice_version_id').notNull().references(() => equityConsentNoticeVersions.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).$type<'active' | 'withdrawn' | 'expired'>().notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  withdrawalReason: varchar('withdrawal_reason', { length: 500 }),
}, (table) => ({
  activeLookupIdx: index('equity_purpose_consents_active_lookup_idx').on(table.organizationId, table.subjectUserId, table.purpose, table.status),
}));

export const equitySelfIdentificationRecords = pgTable('equity_self_identification_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  subjectUserId: varchar('subject_user_id', { length: 255 }).notNull(),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  consentId: uuid('consent_id').notNull().references(() => equityPurposeConsents.id, { onDelete: 'restrict' }),
  encryptedPayload: jsonb('encrypted_payload').$type<Record<string, unknown>>(),
  payloadDigest: varchar('payload_digest', { length: 64 }).notNull(),
  keyVersion: varchar('key_version', { length: 255 }),
  retentionUntil: timestamp('retention_until', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  subjectPurposeUq: uniqueIndex('equity_self_identification_subject_purpose_uniq').on(table.organizationId, table.subjectUserId, table.purpose),
  retentionIdx: index('equity_self_identification_retention_idx').on(table.retentionUntil, table.deletedAt),
}));

export const equityDisclosureGrants = pgTable('equity_disclosure_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  granteeUserId: varchar('grantee_user_id', { length: 255 }).notNull(),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  aggregateOnly: boolean('aggregate_only').notNull().default(true),
  minimumCellSize: integer('minimum_cell_size').notNull().default(10),
  grantedBy: varchar('granted_by', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  lookupIdx: index('equity_disclosure_grants_lookup_idx').on(table.organizationId, table.granteeUserId, table.purpose, table.expiresAt),
}));
