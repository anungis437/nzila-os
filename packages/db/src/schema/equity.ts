/**
 * Nzila OS — Equity / share management tables
 *
 * Share classes, shareholders, ledger entries (append-only),
 * certificates, cap table snapshots.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  bigint,
  jsonb,
  pgEnum,
  date,
  varchar,
} from 'drizzle-orm/pg-core'
import { entities, people } from './entities'

// ── Enums ───────────────────────────────────────────────────────────────────

export const holderTypeEnum = pgEnum('holder_type', ['individual', 'entity'])

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'issuance',
  'transfer',
  'conversion',
  'repurchase',
  'cancellation',
  'adjustment',
])

// ── 9) share_classes ────────────────────────────────────────────────────────

export const shareClasses = pgTable('share_classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  code: varchar('code', { length: 30 }).notNull(), // e.g. COMMON_A
  displayName: text('display_name').notNull(),
  votesPerShare: numeric('votes_per_share').notNull().default('1'),
  dividendRank: integer('dividend_rank').notNull().default(0),
  liquidationRank: integer('liquidation_rank').notNull().default(0),
  isConvertible: boolean('is_convertible').notNull().default(false),
  conversionToClassId: uuid('conversion_to_class_id'), // self-ref
  conversionRatio: numeric('conversion_ratio'),
  transferRestricted: boolean('transfer_restricted').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 10) shareholders ────────────────────────────────────────────────────────

export const shareholders = pgTable('shareholders', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  holderPersonId: uuid('holder_person_id')
    .notNull()
    .references(() => people.id),
  holderType: holderTypeEnum('holder_type').notNull(),
  contactEmail: text('contact_email'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 11) share_ledger_entries (APPEND-ONLY) ──────────────────────────────────

export const shareLedgerEntries = pgTable('share_ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  entryType: ledgerEntryTypeEnum('entry_type').notNull(),
  classId: uuid('class_id')
    .notNull()
    .references(() => shareClasses.id),
  fromShareholderId: uuid('from_shareholder_id').references(() => shareholders.id),
  toShareholderId: uuid('to_shareholder_id').references(() => shareholders.id),
  quantity: bigint('quantity', { mode: 'bigint' }).notNull(),
  pricePerShare: numeric('price_per_share'),
  currency: varchar('currency', { length: 3 }).default('CAD'),
  effectiveDate: date('effective_date').notNull(),
  referenceResolutionId: uuid('reference_resolution_id'),
  referenceDocumentId: uuid('reference_document_id'),
  notes: text('notes'),
  hash: text('hash').notNull(),
  previousHash: text('previous_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 12) share_certificates ──────────────────────────────────────────────────

export const shareCertificates = pgTable('share_certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  shareholderId: uuid('shareholder_id')
    .notNull()
    .references(() => shareholders.id),
  classId: uuid('class_id')
    .notNull()
    .references(() => shareClasses.id),
  certificateNumber: text('certificate_number').notNull(),
  issuedDate: date('issued_date').notNull(),
  quantity: bigint('quantity', { mode: 'bigint' }).notNull(),
  documentId: uuid('document_id'), // FK to documents (Blob PDF)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 13) cap_table_snapshots ─────────────────────────────────────────────────

export const capTableSnapshots = pgTable('cap_table_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  asOfDate: date('as_of_date').notNull(),
  snapshotJson: jsonb('snapshot_json').notNull(),
  generatedBy: text('generated_by').notNull(), // clerk_user_id
  documentId: uuid('document_id'), // PDF/CSV export in Blob
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
