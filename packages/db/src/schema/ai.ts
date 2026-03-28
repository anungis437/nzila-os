/**
 * Nzila OS — AI Control Plane tables
 *
 * All AI gateway, prompts, requests, budgets, RAG, and actions
 * tables. Every object is entity-scoped. Apps never call model
 * providers directly; they go through the AI gateway.
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
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'
import { documents } from './operations'

// ── Enums ───────────────────────────────────────────────────────────────────

export const aiAppStatusEnum = pgEnum('ai_app_status', ['active', 'disabled'])

export const aiEnvironmentEnum = pgEnum('ai_environment', [
  'dev',
  'staging',
  'prod',
])

export const aiRedactionModeEnum = pgEnum('ai_redaction_mode', [
  'strict',
  'balanced',
  'off',
])

export const aiPromptStatusEnum = pgEnum('ai_prompt_status', [
  'draft',
  'staged',
  'active',
  'retired',
])

export const aiRequestFeatureEnum = pgEnum('ai_request_feature', [
  'chat',
  'generate',
  'embed',
  'rag_query',
  'extract',
  'actions_propose',
  'summarize',
  'classify',
])

export const aiRequestStatusEnum = pgEnum('ai_request_status', [
  'success',
  'refused',
  'failed',
])

export const aiBudgetStatusEnum = pgEnum('ai_budget_status', [
  'ok',
  'warning',
  'blocked',
])

export const aiKnowledgeSourceTypeEnum = pgEnum('ai_knowledge_source_type', [
  'blob_document',
  'url',
  'manual',
])

export const aiKnowledgeSourceStatusEnum = pgEnum('ai_knowledge_source_status', [
  'active',
  'disabled',
])

export const aiActionStatusEnum = pgEnum('ai_action_status', [
  'proposed',
  'policy_checked',
  'awaiting_approval',
  'approved',
  'executing',
  'executed',
  'failed',
  'rejected',
  'expired',
])

export const aiRiskTierEnum = pgEnum('ai_risk_tier', [
  'low',
  'medium',
  'high',
])

export const aiActionRunStatusEnum = pgEnum('ai_action_run_status', [
  'started',
  'success',
  'failed',
])

export const aiKnowledgeIngestionStatusEnum = pgEnum('ai_knowledge_ingestion_status', [
  'queued',
  'chunked',
  'embedded',
  'stored',
  'failed',
])

// ── 1) ai_apps — registered Nzila apps that use AI ─────────────────────────

export const aiApps = pgTable('ai_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  appKey: varchar('app_key', { length: 60 }).notNull().unique(),
  name: text('name').notNull(),
  status: aiAppStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 2) ai_capability_profiles — per app + per feature diversity ─────────────

export const aiCapabilityProfiles = pgTable(
  'ai_capability_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    environment: aiEnvironmentEnum('environment').notNull().default('dev'),
    profileKey: varchar('profile_key', { length: 120 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    allowedProviders: jsonb('allowed_providers').notNull().default(['azure_openai']),
    allowedModels: jsonb('allowed_models').notNull().default([]),
    modalities: jsonb('modalities').notNull().default(['text', 'embeddings']),
    features: jsonb('features').notNull().default(['chat', 'generate']),
    dataClassesAllowed: jsonb('data_classes_allowed').notNull().default(['public', 'internal']),
    streamingAllowed: boolean('streaming_allowed').notNull().default(true),
    determinismRequired: boolean('determinism_required').notNull().default(false),
    retentionDays: integer('retention_days').default(90),
    toolPermissions: jsonb('tool_permissions').default([]),
    budgets: jsonb('budgets').default({}),
    redactionMode: aiRedactionModeEnum('redaction_mode').notNull().default('strict'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_profile').on(
      table.orgId,
      table.appKey,
      table.environment,
      table.profileKey,
    ),
  ],
)

// ── 3) ai_prompts — prompt registry ────────────────────────────────────────

export const aiPrompts = pgTable(
  'ai_prompts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    promptKey: varchar('prompt_key', { length: 120 }).notNull(),
    description: text('description'),
    ownerRole: text('owner_role'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_prompt_key').on(table.appKey, table.promptKey),
  ],
)

// ── 4) ai_prompt_versions — versioned prompt templates ──────────────────────

export const aiPromptVersions = pgTable(
  'ai_prompt_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    promptId: uuid('prompt_id')
      .notNull()
      .references(() => aiPrompts.id),
    version: integer('version').notNull(),
    status: aiPromptStatusEnum('status').notNull().default('draft'),
    template: text('template').notNull(),
    systemTemplate: text('system_template'),
    outputSchema: jsonb('output_schema'),
    allowedFeatures: jsonb('allowed_features').default([]),
    defaultParams: jsonb('default_params').default({}),
    createdBy: text('created_by').notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_prompt_version').on(table.promptId, table.version),
  ],
)

// ── 5) ai_requests — full request log with hashes ──────────────────────────

export const aiRequests = pgTable(
  'ai_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    profileKey: varchar('profile_key', { length: 120 }).notNull(),
    feature: aiRequestFeatureEnum('feature').notNull(),
    promptVersionId: uuid('prompt_version_id').references(() => aiPromptVersions.id),
    provider: varchar('provider', { length: 60 }).notNull(),
    modelOrDeployment: varchar('model_or_deployment', { length: 120 }).notNull(),
    requestHash: text('request_hash').notNull(),
    responseHash: text('response_hash').notNull(),
    inputRedacted: boolean('input_redacted').notNull().default(false),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
    latencyMs: integer('latency_ms'),
    status: aiRequestStatusEnum('status').notNull(),
    errorCode: varchar('error_code', { length: 60 }),
    createdBy: text('created_by'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_requests_entity_app').on(table.orgId, table.appKey),
    index('idx_ai_requests_occurred').on(table.occurredAt),
  ],
)

// ── 6) ai_request_payloads — optional raw payloads (encrypted if sensitive) ─

export const aiRequestPayloads = pgTable('ai_request_payloads', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => aiRequests.id),
  requestJson: jsonb('request_json'),
  responseJson: jsonb('response_json'),
  encrypted: boolean('encrypted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 7) ai_usage_budgets — spend tracking per app/profile/month ──────────────

export const aiUsageBudgets = pgTable(
  'ai_usage_budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    profileKey: varchar('profile_key', { length: 120 }).notNull(),
    month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
    budgetUsd: numeric('budget_usd', { precision: 12, scale: 2 }).notNull(),
    spentUsd: numeric('spent_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    status: aiBudgetStatusEnum('status').notNull().default('ok'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_budget').on(
      table.orgId,
      table.appKey,
      table.profileKey,
      table.month,
    ),
  ],
)

// ── 8) ai_knowledge_sources — RAG document sources ─────────────────────────

export const aiKnowledgeSources = pgTable(
  'ai_knowledge_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    sourceType: aiKnowledgeSourceTypeEnum('source_type').notNull(),
    title: text('title').notNull(),
    documentId: uuid('document_id').references(() => documents.id),
    url: text('url'),
    status: aiKnowledgeSourceStatusEnum('status').notNull().default('active'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_knowledge_entity_app').on(table.orgId, table.appKey),
  ],
)

// ── 9) ai_embeddings — pgvector-enabled chunk storage ───────────────────────

/**
 * NOTE: pgvector extension must be enabled in the database:
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *
 * The `embedding` column uses a custom SQL type `vector(1536)` for
 * compatibility with Azure OpenAI text-embedding-ada-002 (1536 dims).
 * Adjust dimension if using a different embedding model.
 *
 * Drizzle doesn't natively support pgvector, so we use the `text` type
 * as a placeholder. Migrations will use raw SQL for the vector column
 * and indexes. See the companion migration file.
 */
export const aiEmbeddings = pgTable(
  'ai_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => aiKnowledgeSources.id),
    chunkId: varchar('chunk_id', { length: 255 }).notNull(),
    chunkText: text('chunk_text').notNull(),
    // embedding: vector(1536) — applied via raw SQL migration
    // Placeholder column; actual type is vector(1536)
    embedding: text('embedding'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_embeddings_entity_app').on(table.orgId, table.appKey),
    index('idx_ai_embeddings_source').on(table.sourceId),
  ],
)

// ── 10) ai_actions — Phase C execution-grade state machine ──────────────────

export const aiActions = pgTable(
  'ai_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    profileKey: varchar('profile_key', { length: 120 }).notNull(),
    actionType: varchar('action_type', { length: 120 }).notNull(),
    riskTier: aiRiskTierEnum('risk_tier').notNull().default('low'),
    status: aiActionStatusEnum('status').notNull().default('proposed'),
    proposalJson: jsonb('proposal_json').notNull(),
    policyDecisionJson: jsonb('policy_decision_json'),
    approvalsRequiredJson: jsonb('approvals_required_json'),
    requestedBy: text('requested_by').notNull(),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    relatedDomainType: varchar('related_domain_type', { length: 60 }),
    relatedDomainId: uuid('related_domain_id'),
    aiRequestId: uuid('ai_request_id').references(() => aiRequests.id),
    evidencePackEligible: boolean('evidence_pack_eligible').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_actions_entity_app').on(table.orgId, table.appKey),
    index('idx_ai_actions_status').on(table.status),
    index('idx_ai_actions_type').on(table.actionType),
  ],
)

// ── 11) ai_action_runs — execution run log per action ───────────────────────

export const aiActionRuns = pgTable(
  'ai_action_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actionId: uuid('action_id')
      .notNull()
      .references(() => aiActions.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    status: aiActionRunStatusEnum('status').notNull().default('started'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    toolCallsJson: jsonb('tool_calls_json').default([]),
    outputArtifactsJson: jsonb('output_artifacts_json').default({}),
    attestationDocumentId: uuid('attestation_document_id').references(() => documents.id),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_action_runs_action').on(table.actionId),
    index('idx_ai_action_runs_entity').on(table.orgId),
  ],
)

// ── 12) ai_knowledge_ingestion_runs — RAG ingestion tracking ────────────────

export const aiKnowledgeIngestionRuns = pgTable(
  'ai_knowledge_ingestion_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => aiKnowledgeSources.id),
    status: aiKnowledgeIngestionStatusEnum('status').notNull().default('queued'),
    metricsJson: jsonb('metrics_json').default({}),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_ingestion_runs_source').on(table.sourceId),
    index('idx_ai_ingestion_runs_entity').on(table.orgId),
  ],
)

// ── 13) ai_models — registered AI model registry ───────────────────────────

export const aiModels = pgTable('ai_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 60 }).notNull(), // openai | azure_openai | anthropic
  family: varchar('family', { length: 120 }).notNull(), // gpt-4o | claude-3-5-sonnet | ...
  modality: varchar('modality', { length: 60 }).notNull().default('text'), // text | vision | embedding
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 14) ai_deployments — deployment config per model + environment ──────────

export const aiDeployments = pgTable(
  'ai_deployments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => aiModels.id),
    deploymentName: varchar('deployment_name', { length: 120 }).notNull(),
    environment: aiEnvironmentEnum('environment').notNull().default('prod'),
    allowedDataClasses: jsonb('allowed_data_classes').default([]),
    maxTokens: integer('max_tokens'),
    defaultTemperature: numeric('default_temperature', { precision: 4, scale: 3 }),
    costProfile: jsonb('cost_profile').default({}),
    enabled: boolean('enabled').notNull().default(true),
    approvedBy: varchar('approved_by', { length: 120 }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_deployments_model').on(table.modelId),
    index('idx_ai_deployments_env').on(table.environment),
  ],
)

// ── 15) ai_deployment_routes — entity+app+profile+feature → deployment ──────

export const aiDeploymentRoutes = pgTable(
  'ai_deployment_routes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deploymentId: uuid('deployment_id')
      .notNull()
      .references(() => aiDeployments.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    appKey: varchar('app_key', { length: 60 }).notNull(),
    profileKey: varchar('profile_key', { length: 60 }).notNull(),
    feature: aiRequestFeatureEnum('feature').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_ai_routes_unique').on(
      table.orgId, table.appKey, table.profileKey, table.feature,
    ),
    index('idx_ai_routes_deployment').on(table.deploymentId),
  ],
)
