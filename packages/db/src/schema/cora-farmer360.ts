import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { coraEvidenceRecords } from './cora-evidence'
import { orgs } from './orgs'

export const coraFarmer360Profiles = pgTable(
  'cora_farmer360_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'restrict' }),
    subjectRef: jsonb('subject_ref').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cora_farmer360_profiles_org_id_uidx').on(table.orgId, table.id),
    uniqueIndex('cora_farmer360_profiles_subject_uidx').on(
      table.orgId,
      sql`(${table.subjectRef}->>'system')`,
      sql`(${table.subjectRef}->>'recordId')`,
    ),
    index('cora_farmer360_profiles_org_updated_idx').on(table.orgId, table.updatedAt),
    check(
      'cora_farmer360_profiles_subject_ref_ck',
      sql`COALESCE(
        jsonb_typeof(${table.subjectRef}) = 'object'
        AND length(btrim(${table.subjectRef}->>'system')) > 0
        AND length(btrim(${table.subjectRef}->>'recordId')) > 0,
        FALSE
      )`,
    ),
  ],
)

export const coraFarmer360ContextVersions = pgTable(
  'cora_farmer360_context_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    profileId: uuid('profile_id').notNull(),
    enterpriseContext: jsonb('enterprise_context').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cora_farmer360_context_versions_org_id_uidx').on(table.orgId, table.id),
    index('cora_farmer360_context_versions_profile_effective_idx').on(
      table.orgId,
      table.profileId,
      table.effectiveFrom,
    ),
    foreignKey({
      name: 'cora_farmer360_context_versions_profile_fk',
      columns: [table.orgId, table.profileId],
      foreignColumns: [coraFarmer360Profiles.orgId, coraFarmer360Profiles.id],
    }).onDelete('restrict'),
    check(
      'cora_farmer360_context_versions_effective_period_ck',
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
    check(
      'cora_farmer360_context_versions_context_ck',
      sql`jsonb_typeof(${table.enterpriseContext}) = 'object'`,
    ),
  ],
)

export const coraFarmer360Assertions = pgTable(
  'cora_farmer360_assertions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    profileId: uuid('profile_id').notNull(),
    subject: text('subject').notNull(),
    statement: text('statement').notNull(),
    purpose: text('purpose').notNull(),
    consentRef: text('consent_ref').notNull(),
    evidenceId: uuid('evidence_id').notNull(),
    evidencePayloadSha256: varchar('evidence_payload_sha256', { length: 64 }).notNull(),
    verificationState: varchar('verification_state', { length: 20 })
      .notNull()
      .default('unverified'),
    assertedBy: text('asserted_by').notNull(),
    assertedAt: timestamp('asserted_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cora_farmer360_assertions_org_id_uidx').on(table.orgId, table.id),
    index('cora_farmer360_assertions_profile_time_idx').on(
      table.orgId,
      table.profileId,
      table.assertedAt,
    ),
    foreignKey({
      name: 'cora_farmer360_assertions_profile_fk',
      columns: [table.orgId, table.profileId],
      foreignColumns: [coraFarmer360Profiles.orgId, coraFarmer360Profiles.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'cora_farmer360_assertions_evidence_fk',
      columns: [table.orgId, table.evidenceId, table.evidencePayloadSha256],
      foreignColumns: [
        coraEvidenceRecords.orgId,
        coraEvidenceRecords.id,
        coraEvidenceRecords.payloadSha256,
      ],
    }).onDelete('restrict'),
    check(
      'cora_farmer360_assertions_verification_state_ck',
      sql`${table.verificationState} = 'unverified'`,
    ),
    check(
      'cora_farmer360_assertions_evidence_sha256_ck',
      sql`${table.evidencePayloadSha256} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
)
