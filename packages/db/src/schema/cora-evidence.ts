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
import { platformMethodologyVersions } from './methodology'
import { orgs } from './orgs'

interface CoraConfidenceAssessment {
  readonly level: 'high' | 'medium' | 'low' | 'unknown'
  readonly basis: string
}

interface CoraEvidenceQuality {
  readonly completeness: 'complete' | 'partial' | 'estimated' | 'unknown'
  readonly freshness: 'current' | 'stale' | 'unknown'
  readonly traceability: 'direct' | 'derived' | 'unknown'
  readonly limitations: readonly string[]
}

export const coraEvidenceRecords = pgTable(
  'cora_evidence_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'restrict' }),
    evidenceType: varchar('evidence_type', { length: 120 }).notNull(),
    purpose: text('purpose').notNull(),
    consentRef: text('consent_ref').notNull(),
    source: jsonb('source').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    methodologyVersionId: uuid('methodology_version_id').notNull(),
    methodologyAuthorityId: varchar('methodology_authority_id', { length: 160 }).notNull(),
    methodologyId: varchar('methodology_id', { length: 160 }).notNull(),
    methodologyVersion: varchar('methodology_version', { length: 80 }).notNull(),
    methodologyDefinitionSha256: varchar('methodology_definition_sha256', { length: 64 }).notNull(),
    provenanceRef: text('provenance_ref').notNull(),
    payloadSha256: varchar('payload_sha256', { length: 64 }).notNull(),
    evidencePackArtifact: jsonb('evidence_pack_artifact'),
    confidence: jsonb('confidence').$type<CoraConfidenceAssessment>().notNull(),
    dataQuality: jsonb('data_quality').$type<CoraEvidenceQuality>().notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cora_evidence_org_id_uidx').on(table.orgId, table.id),
    uniqueIndex('cora_evidence_org_id_hash_uidx').on(table.orgId, table.id, table.payloadSha256),
    index('cora_evidence_org_observed_idx').on(table.orgId, table.observedAt),
    index('cora_evidence_org_methodology_idx').on(
      table.orgId,
      table.methodologyAuthorityId,
      table.methodologyId,
      table.methodologyVersion,
    ),
    foreignKey({
      name: 'cora_evidence_methodology_version_fk',
      columns: [
        table.methodologyVersionId,
        table.methodologyAuthorityId,
        table.methodologyId,
        table.methodologyVersion,
        table.methodologyDefinitionSha256,
      ],
      foreignColumns: [
        platformMethodologyVersions.id,
        platformMethodologyVersions.authorityId,
        platformMethodologyVersions.methodologyId,
        platformMethodologyVersions.version,
        platformMethodologyVersions.definitionSha256,
      ],
    }).onDelete('restrict'),
    check('cora_evidence_payload_sha256_ck', sql`${table.payloadSha256} ~ '^[a-f0-9]{64}$'`),
    check(
      'cora_evidence_valid_period_ck',
      sql`${table.validTo} IS NULL OR ${table.validFrom} IS NULL OR ${table.validTo} >= ${table.validFrom}`,
    ),
    check(
      'cora_evidence_confidence_level_ck',
      sql`COALESCE(
        ${table.confidence}->>'level' IN ('high', 'medium', 'low', 'unknown')
        AND length(btrim(${table.confidence}->>'basis')) > 0,
        FALSE
      )`,
    ),
    check(
      'cora_evidence_quality_dimensions_ck',
      sql`COALESCE(
        ${table.dataQuality}->>'completeness' IN ('complete', 'partial', 'estimated', 'unknown')
        AND ${table.dataQuality}->>'freshness' IN ('current', 'stale', 'unknown')
        AND ${table.dataQuality}->>'traceability' IN ('direct', 'derived', 'unknown')
        AND jsonb_typeof(${table.dataQuality}->'limitations') = 'array',
        FALSE
      )`,
    ),
    check(
      'cora_evidence_source_ref_ck',
      sql`COALESCE(
        jsonb_typeof(${table.source}) = 'object'
        AND length(btrim(${table.source}->>'system')) > 0
        AND length(btrim(${table.source}->>'recordId')) > 0,
        FALSE
      )`,
    ),
    check(
      'cora_evidence_pack_artifact_ref_ck',
      sql`${table.evidencePackArtifact} IS NULL OR COALESCE(
        length(btrim(${table.evidencePackArtifact}->>'packId')) > 0
        AND length(btrim(${table.evidencePackArtifact}->>'artifactId')) > 0
        AND ${table.evidencePackArtifact}->>'sha256' ~ '^[a-f0-9]{64}$',
        FALSE
      )`,
    ),
  ],
)

export const coraEvidenceConclusions = pgTable(
  'cora_evidence_conclusions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'restrict' }),
    conclusionType: varchar('conclusion_type', { length: 120 }).notNull(),
    purpose: text('purpose').notNull(),
    consentRef: text('consent_ref').notNull(),
    statement: text('statement').notNull(),
    outcome: jsonb('outcome').notNull(),
    methodologyId: varchar('methodology_id', { length: 160 }).notNull(),
    methodologyVersion: varchar('methodology_version', { length: 80 }).notNull(),
    methodologyVersionId: uuid('methodology_version_id').notNull(),
    methodologyAuthorityId: varchar('methodology_authority_id', { length: 160 }).notNull(),
    methodologyDefinitionSha256: varchar('methodology_definition_sha256', { length: 64 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    confidence: jsonb('confidence').$type<CoraConfidenceAssessment>().notNull(),
    dataQuality: jsonb('data_quality').$type<CoraEvidenceQuality>().notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cora_conclusion_org_id_uidx').on(table.orgId, table.id),
    index('cora_conclusion_org_generated_idx').on(table.orgId, table.generatedAt),
    foreignKey({
      name: 'cora_conclusion_methodology_version_fk',
      columns: [
        table.methodologyVersionId,
        table.methodologyAuthorityId,
        table.methodologyId,
        table.methodologyVersion,
        table.methodologyDefinitionSha256,
      ],
      foreignColumns: [
        platformMethodologyVersions.id,
        platformMethodologyVersions.authorityId,
        platformMethodologyVersions.methodologyId,
        platformMethodologyVersions.version,
        platformMethodologyVersions.definitionSha256,
      ],
    }).onDelete('restrict'),
    check(
      'cora_conclusion_valid_period_ck',
      sql`${table.validTo} IS NULL OR ${table.validFrom} IS NULL OR ${table.validTo} >= ${table.validFrom}`,
    ),
    check(
      'cora_conclusion_confidence_level_ck',
      sql`COALESCE(
        ${table.confidence}->>'level' IN ('high', 'medium', 'low', 'unknown')
        AND length(btrim(${table.confidence}->>'basis')) > 0,
        FALSE
      )`,
    ),
    check(
      'cora_conclusion_quality_dimensions_ck',
      sql`COALESCE(
        ${table.dataQuality}->>'completeness' IN ('complete', 'partial', 'estimated', 'unknown')
        AND ${table.dataQuality}->>'freshness' IN ('current', 'stale', 'unknown')
        AND ${table.dataQuality}->>'traceability' IN ('direct', 'derived', 'unknown')
        AND jsonb_typeof(${table.dataQuality}->'limitations') = 'array',
        FALSE
      )`,
    ),
    check('cora_conclusion_outcome_object_ck', sql`jsonb_typeof(${table.outcome}) = 'object'`),
  ],
)

export const coraConclusionEvidenceRefs = pgTable(
  'cora_conclusion_evidence_refs',
  {
    orgId: uuid('org_id').notNull(),
    conclusionId: uuid('conclusion_id').notNull(),
    evidenceId: uuid('evidence_id').notNull(),
    payloadSha256: varchar('payload_sha256', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cora_conclusion_evidence_org_pair_uidx').on(
      table.orgId,
      table.conclusionId,
      table.evidenceId,
    ),
    foreignKey({
      name: 'cora_conclusion_evidence_conclusion_fk',
      columns: [table.orgId, table.conclusionId],
      foreignColumns: [coraEvidenceConclusions.orgId, coraEvidenceConclusions.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'cora_conclusion_evidence_record_fk',
      columns: [table.orgId, table.evidenceId, table.payloadSha256],
      foreignColumns: [
        coraEvidenceRecords.orgId,
        coraEvidenceRecords.id,
        coraEvidenceRecords.payloadSha256,
      ],
    }).onDelete('restrict'),
    check('cora_conclusion_evidence_sha256_ck', sql`${table.payloadSha256} ~ '^[a-f0-9]{64}$'`),
  ],
)
