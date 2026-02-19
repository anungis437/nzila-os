/**
 * Nzila OS — Governance actions, documents, filings, compliance, audit, evidence packs
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  bigint,
  integer,
  boolean,
  date,
  varchar,
} from 'drizzle-orm/pg-core'
import { entities } from './entities'

// ── Enums ───────────────────────────────────────────────────────────────────

export const governanceActionTypeEnum = pgEnum('governance_action_type', [
  'issue_shares',
  'transfer_shares',
  'convert_shares',
  'borrow_funds',
  'amend_rights',
  'create_class',
  'repurchase_shares',
  'dividend',
  'merger_acquisition',
  'elect_directors',
  'amend_constitution',
])

export const governanceActionStatusEnum = pgEnum('governance_action_status', [
  'draft',
  'pending_approval',
  'approved',
  'executed',
  'rejected',
])

export const documentCategoryEnum = pgEnum('document_category', [
  'minute_book',
  'filing',
  'resolution',
  'minutes',
  'certificate',
  'year_end',
  'export',
  'attestation',
  'ingestion_report',
  'other',
])

export const documentClassificationEnum = pgEnum('document_classification', [
  'public',
  'internal',
  'confidential',
])

export const filingKindEnum = pgEnum('filing_kind', [
  'annual_return',
  'director_change',
  'address_change',
  'articles_amendment',
  'other',
])

export const filingStatusEnum = pgEnum('filing_status', [
  'pending',
  'submitted',
  'accepted',
])

export const complianceTaskKindEnum = pgEnum('compliance_task_kind', [
  'year_end',
  'month_close',
  'governance',
])

export const complianceTaskStatusEnum = pgEnum('compliance_task_status', [
  'open',
  'done',
  'blocked',
])

// ── 14) governance_actions ──────────────────────────────────────────────────

export const governanceActions = pgTable('governance_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  actionType: governanceActionTypeEnum('action_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  status: governanceActionStatusEnum('status').notNull().default('draft'),
  requirements: jsonb('requirements').default({}), // policy engine output
  createdBy: text('created_by').notNull(), // clerk_user_id
  executedAt: timestamp('executed_at', { withTimezone: true }),
  referenceResolutionId: uuid('reference_resolution_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 15) documents ───────────────────────────────────────────────────────────

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  category: documentCategoryEnum('category').notNull(),
  title: text('title').notNull(),
  blobContainer: text('blob_container').notNull(),
  blobPath: text('blob_path').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'bigint' }),
  sha256: text('sha256').notNull(),
  uploadedBy: text('uploaded_by').notNull(), // clerk_user_id
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  classification: documentClassificationEnum('classification')
    .notNull()
    .default('internal'),
  linkedType: text('linked_type'), // resolution, meeting, certificate, etc.
  linkedId: uuid('linked_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 16) filings ─────────────────────────────────────────────────────────────

export const filings = pgTable('filings', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  kind: filingKindEnum('kind').notNull(),
  dueDate: date('due_date').notNull(),
  status: filingStatusEnum('status').notNull().default('pending'),
  documentId: uuid('document_id').references(() => documents.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 17) compliance_tasks ────────────────────────────────────────────────────

export const complianceTasks = pgTable('compliance_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  kind: complianceTaskKindEnum('kind').notNull(),
  title: text('title').notNull(),
  dueDate: date('due_date').notNull(),
  status: complianceTaskStatusEnum('status').notNull().default('open'),
  evidenceDocumentId: uuid('evidence_document_id').references(() => documents.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 18) audit_events (APPEND-ONLY) ─────────────────────────────────────────

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  actorClerkUserId: text('actor_clerk_user_id').notNull(),
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id'),
  beforeJson: jsonb('before_json'),
  afterJson: jsonb('after_json'),
  hash: text('hash').notNull(),
  previousHash: text('previous_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Evidence Pack Enums ─────────────────────────────────────────────────────

export const controlFamilyEnum = pgEnum('control_family', [
  'access',
  'change-mgmt',
  'incident-response',
  'dr-bcp',
  'integrity',
  'sdlc',
  'retention',
])

export const evidenceEventTypeEnum = pgEnum('evidence_event_type', [
  'incident',
  'dr-test',
  'access-review',
  'period-close',
  'release',
  'restore-test',
  'control-test',
  'audit-request',
])

export const retentionClassEnum = pgEnum('retention_class', [
  'PERMANENT',
  '7_YEARS',
  '3_YEARS',
  '1_YEAR',
])

export const chainIntegrityEnum = pgEnum('chain_integrity', [
  'VERIFIED',
  'UNVERIFIED',
  'BROKEN',
])

export const evidencePackStatusEnum = pgEnum('evidence_pack_status', [
  'draft',
  'sealed',
  'verified',
  'expired',
])

// ── 19) evidence_packs ──────────────────────────────────────────────────────

export const evidencePacks = pgTable('evidence_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  packId: varchar('pack_id', { length: 120 }).notNull().unique(), // e.g. IR-2026-001
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  controlFamily: controlFamilyEnum('control_family').notNull(),
  eventType: evidenceEventTypeEnum('event_type').notNull(),
  eventId: text('event_id').notNull(), // incident ID, release tag, etc.
  runId: uuid('run_id').notNull(), // UUID for traceability
  blobContainer: varchar('blob_container', { length: 30 }).notNull(), // evidence | minutebook | exports
  basePath: text('base_path').notNull(), // common blob prefix
  summary: text('summary'),
  controlsCovered: jsonb('controls_covered').notNull().default([]), // e.g. ["IR-01","IR-02"]
  artifactCount: integer('artifact_count').notNull().default(0),
  allHashesVerified: boolean('all_hashes_verified').notNull().default(false),
  chainIntegrity: chainIntegrityEnum('chain_integrity').notNull().default('UNVERIFIED'),
  hashChainStart: uuid('hash_chain_start'), // FK → audit_events.id logically
  hashChainEnd: uuid('hash_chain_end'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: text('verified_by'), // clerk_user_id or system
  status: evidencePackStatusEnum('status').notNull().default('draft'),
  indexDocumentId: uuid('index_document_id').references(() => documents.id), // evidence-pack-index.json blob
  createdBy: text('created_by').notNull(), // clerk_user_id
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 20) evidence_pack_artifacts (join table) ────────────────────────────────

export const evidencePackArtifacts = pgTable('evidence_pack_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  packId: uuid('pack_id')
    .notNull()
    .references(() => evidencePacks.id),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id),
  artifactId: text('artifact_id').notNull(), // e.g. IR-2026-001-postmortem
  artifactType: text('artifact_type').notNull(), // postmortem, audit-trail, etc.
  retentionClass: retentionClassEnum('retention_class').notNull(),
  auditEventId: uuid('audit_event_id').references(() => auditEvents.id), // FK → the upload audit_event
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
