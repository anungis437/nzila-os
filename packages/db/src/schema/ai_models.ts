/**
 * Nzila OS — AI Model Registry tables
 *
 * DB-backed model registry replacing env-only deployment routing.
 * Three tables:
 *   1. aiModels — registered base models (provider + family)
 *   2. aiDeployments — deployment configurations per environment
 *   3. aiDeploymentRoutes — per entity/app/profile/feature routing
 *
 * Deployment selection is resolved via aiDeploymentRoutes in the
 * AI gateway. No direct env var reads for model routing.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  varchar,
  integer,
  boolean,
  numeric,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { entities } from './entities'
import { aiEnvironmentEnum } from './ai'

// ── Enums ───────────────────────────────────────────────────────────────────

export const aiModelModalityEnum = pgEnum('ai_model_modality', [
  'text',
  'embeddings',
])

export const aiDeploymentFeatureEnum = pgEnum('ai_deployment_feature', [
  'chat',
  'generate',
  'embed',
  'rag',
  'extract',
])

// ── 1) ai_models — registered base models ──────────────────────────────────

export const aiModels = pgTable(
  'ai_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 60 }).notNull(), // e.g. "azure_openai"
    family: varchar('family', { length: 120 }).notNull(), // e.g. "gpt-4o", "text-embedding-3-large"
    modality: aiModelModalityEnum('modality').notNull(), // "text" | "embeddings"
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_model_provider_family').on(table.provider, table.family),
  ],
)

// ── 2) ai_deployments — deployment configurations per environment ───────────

export const aiDeployments = pgTable(
  'ai_deployments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => aiModels.id),
    deploymentName: varchar('deployment_name', { length: 200 }).notNull(), // Azure deployment name
    environment: aiEnvironmentEnum('environment').notNull().default('dev'),
    allowedDataClasses: jsonb('allowed_data_classes')
      .notNull()
      .default(['public', 'internal']), // DataClass[]
    maxTokens: integer('max_tokens').notNull().default(4096),
    defaultTemperature: numeric('default_temperature', { precision: 3, scale: 2 })
      .notNull()
      .default('0.70'),
    costProfile: jsonb('cost_profile').default({}), // { costPerKIn, costPerKOut }
    enabled: boolean('enabled').notNull().default(true),
    fallbackDeploymentId: uuid('fallback_deployment_id').references(
      (): AnyPgColumn => aiDeployments.id,
    ),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_deployment_name_env').on(
      table.deploymentName,
      table.environment,
    ),
    index('idx_ai_deployments_model').on(table.modelId),
  ],
)

// ── 3) ai_deployment_routes — per entity/app/profile/feature routing ────────

export const aiDeploymentRoutes = pgTable(
  'ai_deployment_routes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    profileKey: varchar('profile_key', { length: 120 }).notNull(),
    feature: aiDeploymentFeatureEnum('feature').notNull(), // "chat"|"generate"|"embed"|"rag"|"extract"
    deploymentId: uuid('deployment_id')
      .notNull()
      .references(() => aiDeployments.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_route').on(
      table.entityId,
      table.appKey,
      table.profileKey,
      table.feature,
    ),
    index('idx_ai_routes_entity_app').on(table.entityId, table.appKey),
    index('idx_ai_routes_deployment').on(table.deploymentId),
  ],
)
