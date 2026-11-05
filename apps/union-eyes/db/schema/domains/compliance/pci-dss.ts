import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

export const pciAssessmentStatusEnum = pgEnum('pci_assessment_status', [
  'in_progress',
  'completed',
  'requires_remediation',
]);

export const pciRequirementStatusEnum = pgEnum('pci_requirement_status', [
  'compliant',
  'not_applicable',
  'requires_remediation',
]);

export const pciScanStatusEnum = pgEnum('pci_scan_status', [
  'pass',
  'fail',
  'pending',
]);

export const pciDssSaqAssessments = pgTable('pci_dss_saq_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  assessmentDate: timestamp('assessment_date', { withTimezone: true }).defaultNow().notNull(),
  sqaLevel: varchar('sqa_level', { length: 20 }).notNull().default('SAQ-A'),
  overallStatus: pciAssessmentStatusEnum('overall_status').notNull().default('in_progress'),
  attestationOfCompliance: text('attestation_of_compliance'),
  attestationDate: timestamp('attestation_date', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pciDssRequirements = pgTable('pci_dss_requirements', {
  id: uuid('id').defaultRandom().primaryKey(),
  assessmentId: uuid('assessment_id').notNull(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  requirementNumber: varchar('requirement_number', { length: 50 }).notNull(),
  requirementDescription: text('requirement_description').notNull(),
  complianceStatus: pciRequirementStatusEnum('compliance_status').notNull().default('requires_remediation'),
  evidence: text('evidence'),
  remediationNotes: text('remediation_notes'),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pciDssQuarterlyScans = pgTable('pci_dss_quarterly_scans', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  scanDate: timestamp('scan_date', { withTimezone: true }).defaultNow().notNull(),
  vendorName: varchar('vendor_name', { length: 255 }).notNull(),
  scanStatus: pciScanStatusEnum('scan_status').notNull().default('pending'),
  vulnerabilitiesFound: integer('vulnerabilities_found').default(0).notNull(),
  criticalIssues: integer('critical_issues').default(0).notNull(),
  reportUrl: text('report_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pciDssEncryptionKeys = pgTable('pci_dss_encryption_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  keyType: varchar('key_type', { length: 50 }).notNull(),
  keyIdentifier: varchar('key_identifier', { length: 255 }).notNull(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  rotationReason: varchar('rotation_reason', { length: 100 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PCIDssAssessment = typeof pciDssSaqAssessments.$inferSelect;
export type PCIDssRequirement = typeof pciDssRequirements.$inferSelect;
export type PCIDssQuarterlyScan = typeof pciDssQuarterlyScans.$inferSelect;
export type PCIDssEncryptionKey = typeof pciDssEncryptionKeys.$inferSelect;
