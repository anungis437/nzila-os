import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pilotApplications } from '../marketing';

/** Immutable, platform-issued commercial terms. Amendments are new versions. */
export const pilotCommercialOffers = pgTable('pilot_commercial_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => pilotApplications.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id').notNull(),
  version: integer('version').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  pricingBasis: varchar('pricing_basis', { length: 100 }).notNull(),
  memberCountBasis: integer('member_count_basis').notNull(),
  memberCountEvidenceRef: varchar('member_count_evidence_ref', { length: 500 }).notNull(),
  terms: jsonb('terms').$type<Record<string, unknown>>().notNull(),
  termsDigest: varchar('terms_digest', { length: 64 }).notNull(),
  status: varchar('status', { length: 20 }).$type<'offered' | 'accepted' | 'superseded' | 'withdrawn' | 'expired'>().notNull(),
  issuedBy: varchar('issued_by', { length: 255 }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  supersededById: uuid('superseded_by_id'),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
}, (table) => ({
  applicationVersionUq: uniqueIndex('pilot_commercial_offers_application_version_uniq').on(table.applicationId, table.version),
  activeIdx: index('pilot_commercial_offers_active_idx').on(table.applicationId, table.status, table.expiresAt),
  organizationIdx: index('pilot_commercial_offers_organization_idx').on(table.organizationId, table.applicationId),
}));

/** Acceptance by a directly-authorized representative of the verified applicant organization. */
export const pilotCommercialAcceptances = pgTable('pilot_commercial_acceptances', {
  id: uuid('id').primaryKey().defaultRandom(),
  offerId: uuid('offer_id').notNull().references(() => pilotCommercialOffers.id, { onDelete: 'restrict' }),
  applicationId: uuid('application_id').notNull().references(() => pilotApplications.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id').notNull(),
  acceptedBy: varchar('accepted_by', { length: 255 }).notNull(),
  representativeRole: varchar('representative_role', { length: 100 }).notNull(),
  authorityEvidenceRef: varchar('authority_evidence_ref', { length: 500 }).notNull(),
  acceptedTermsDigest: varchar('accepted_terms_digest', { length: 64 }).notNull(),
  noticeVersion: varchar('notice_version', { length: 100 }).notNull(),
  requestId: varchar('request_id', { length: 255 }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  offerUq: uniqueIndex('pilot_commercial_acceptances_offer_uniq').on(table.offerId),
  requestUq: uniqueIndex('pilot_commercial_acceptances_request_uniq').on(table.organizationId, table.requestId),
  applicationIdx: index('pilot_commercial_acceptances_application_idx').on(table.applicationId, table.acceptedAt),
}));

/** Reviewed evidence observations; applicant self-assessments never enter this table. */
export const pilotEvidenceAssessments = pgTable('pilot_evidence_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => pilotApplications.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id').notNull(),
  dimension: varchar('dimension', { length: 40 }).$type<'adoption' | 'activity' | 'champion' | 'risk' | 'readiness' | 'fit' | 'revenue' | 'strategic_value'>().notNull(),
  score: integer('score').notNull(),
  evidenceType: varchar('evidence_type', { length: 80 }).notNull(),
  evidenceRef: varchar('evidence_ref', { length: 500 }).notNull(),
  evidenceDigest: varchar('evidence_digest', { length: 64 }).notNull(),
  methodologyVersion: varchar('methodology_version', { length: 100 }).notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  observedBy: varchar('observed_by', { length: 255 }).notNull(),
  reviewedBy: varchar('reviewed_by', { length: 255 }).notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
}, (table) => ({
  applicationDimensionIdx: index('pilot_evidence_assessments_application_dimension_idx').on(table.applicationId, table.dimension, table.reviewedAt),
  organizationIdx: index('pilot_evidence_assessments_organization_idx').on(table.organizationId, table.applicationId),
}));

export type PilotCommercialOffer = typeof pilotCommercialOffers.$inferSelect;
export type PilotCommercialAcceptance = typeof pilotCommercialAcceptances.$inferSelect;
export type PilotEvidenceAssessment = typeof pilotEvidenceAssessments.$inferSelect;
