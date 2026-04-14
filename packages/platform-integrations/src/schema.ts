/**
 * @nzila/platform-integrations — Drizzle Schema
 *
 * Database tables for the Integration Fabric.
 * 7 tables: connections, subscriptions, runs, delivery attempts,
 * dead letters, external identity links, mapping rules.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
} from 'drizzle-orm/pg-core'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const connectorTypeEnum = pgEnum('connector_type', [
  'webhook',
  'rest_api',
  'email_ingestion',
  'csv_sftp',
  'document_system',
  'crm',
  'hris',
  'custom',
])

export const connectionStatusEnum = pgEnum('connection_status', [
  'active',
  'inactive',
  'error',
  'pending',
  'suspended',
])

export const runStatusEnum = pgEnum('integration_run_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'partial',
  'cancelled',
  'retrying',
])

export const syncDirectionEnum = pgEnum('sync_direction', [
  'inbound',
  'outbound',
  'bidirectional',
])

export const deliveryStatusEnum = pgEnum('delivery_attempt_status', [
  'pending',
  'success',
  'failed',
  'retrying',
])

export const sourceOfTruthModeEnum = pgEnum('source_of_truth_mode', [
  'internal',
  'external',
  'field_level',
  'append_only',
])

// ─── Integration Connections ─────────────────────────────────────────────────

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    connectorId: varchar('connector_id', { length: 255 }).notNull(),
    connectorType: connectorTypeEnum('connector_type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: connectionStatusEnum('status').notNull().default('pending'),
    config: jsonb('config').notNull().default({}),
    credentialRef: varchar('credential_ref', { length: 512 }),
    appScopes: jsonb('app_scopes').notNull().default([]),
    lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
    lastHealthStatus: varchar('last_health_status', { length: 50 }),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_connections_org_idx').on(table.orgId),
    index('integration_connections_connector_idx').on(table.connectorId),
    index('integration_connections_status_idx').on(table.orgId, table.status),
  ],
)

// ─── Integration Event Subscriptions ─────────────────────────────────────────

export const integrationEventSubscriptions = pgTable(
  'integration_event_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    connectionId: uuid('connection_id').notNull().references(() => integrationConnections.id),
    eventType: varchar('event_type', { length: 255 }).notNull(),
    targetUrl: text('target_url').notNull(),
    secret: text('secret'),
    signatureAlgorithm: varchar('signature_algorithm', { length: 50 }).default('sha256'),
    active: boolean('active').notNull().default(true),
    filterExpression: jsonb('filter_expression'),
    metadata: jsonb('metadata').notNull().default({}),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_subscriptions_org_idx').on(table.orgId),
    index('integration_subscriptions_conn_idx').on(table.connectionId),
    index('integration_subscriptions_event_idx').on(table.eventType),
    index('integration_subscriptions_active_idx').on(table.orgId, table.eventType, table.active),
  ],
)

// ─── Integration Runs ────────────────────────────────────────────────────────

export const integrationRuns = pgTable(
  'integration_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    connectionId: uuid('connection_id').notNull().references(() => integrationConnections.id),
    direction: syncDirectionEnum('direction').notNull(),
    eventType: varchar('event_type', { length: 255 }),
    status: runStatusEnum('status').notNull().default('pending'),
    inputPayload: jsonb('input_payload').notNull().default({}),
    outputPayload: jsonb('output_payload'),
    errorMessage: text('error_message'),
    mappingRuleId: uuid('mapping_rule_id'),
    idempotencyKey: varchar('idempotency_key', { length: 512 }),
    traceId: varchar('trace_id', { length: 128 }),
    durationMs: integer('duration_ms'),
    retryCount: integer('retry_count').notNull().default(0),
    createdBy: text('created_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    index('integration_runs_org_idx').on(table.orgId),
    index('integration_runs_conn_idx').on(table.connectionId),
    index('integration_runs_status_idx').on(table.orgId, table.status),
    index('integration_runs_idempotency_idx').on(table.idempotencyKey),
    index('integration_runs_trace_idx').on(table.traceId),
  ],
)

// ─── Integration Delivery Attempts ───────────────────────────────────────────

export const integrationDeliveryAttempts = pgTable(
  'integration_delivery_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    subscriptionId: uuid('subscription_id').notNull().references(() => integrationEventSubscriptions.id),
    runId: uuid('run_id').references(() => integrationRuns.id),
    eventType: varchar('event_type', { length: 255 }).notNull(),
    targetUrl: text('target_url').notNull(),
    requestBody: jsonb('request_body').notNull().default({}),
    requestHeaders: jsonb('request_headers').notNull().default({}),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    status: deliveryStatusEnum('status').notNull().default('pending'),
    attempt: integer('attempt').notNull().default(1),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_delivery_org_idx').on(table.orgId),
    index('integration_delivery_sub_idx').on(table.subscriptionId),
    index('integration_delivery_status_idx').on(table.orgId, table.status),
  ],
)

// ─── Integration Dead Letters ────────────────────────────────────────────────

export const integrationDeadLetters = pgTable(
  'integration_dead_letters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    connectionId: uuid('connection_id').notNull().references(() => integrationConnections.id),
    subscriptionId: uuid('subscription_id').references(() => integrationEventSubscriptions.id),
    eventType: varchar('event_type', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    errorMessage: text('error_message').notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    totalAttempts: integer('total_attempts').notNull().default(0),
    replayed: boolean('replayed').notNull().default(false),
    replayedAt: timestamp('replayed_at', { withTimezone: true }),
    replayedBy: text('replayed_by'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_dead_letters_org_idx').on(table.orgId),
    index('integration_dead_letters_conn_idx').on(table.connectionId),
    index('integration_dead_letters_replayed_idx').on(table.orgId, table.replayed),
  ],
)

// ─── External Identity Links ─────────────────────────────────────────────────

export const externalIdentityLinks = pgTable(
  'external_identity_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    connectionId: uuid('connection_id').notNull().references(() => integrationConnections.id),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    internalId: uuid('internal_id').notNull(),
    externalId: varchar('external_id', { length: 512 }).notNull(),
    externalSystem: varchar('external_system', { length: 255 }).notNull(),
    metadataJson: jsonb('metadata_json').notNull().default({}),
    staleAt: timestamp('stale_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ext_identity_org_idx').on(table.orgId),
    index('ext_identity_conn_idx').on(table.connectionId),
    index('ext_identity_resolve_idx').on(table.orgId, table.entityType, table.externalId, table.externalSystem),
    index('ext_identity_internal_idx').on(table.orgId, table.entityType, table.internalId),
  ],
)

// ─── Integration Mapping Rules ───────────────────────────────────────────────

export const integrationMappingRules = pgTable(
  'integration_mapping_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    connectionId: uuid('connection_id').notNull().references(() => integrationConnections.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    direction: syncDirectionEnum('direction').notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    version: integer('version').notNull().default(1),
    active: boolean('active').notNull().default(true),
    definition: jsonb('definition').notNull(),
    preValidation: jsonb('pre_validation').notNull().default([]),
    postValidation: jsonb('post_validation').notNull().default([]),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_mapping_org_idx').on(table.orgId),
    index('integration_mapping_conn_idx').on(table.connectionId),
    index('integration_mapping_entity_idx').on(table.orgId, table.entityType, table.direction),
    index('integration_mapping_active_idx').on(table.orgId, table.active),
  ],
)

// ─── Type Exports ────────────────────────────────────────────────────────────

export type IntegrationConnectionRow = typeof integrationConnections.$inferSelect
export type NewIntegrationConnectionRow = typeof integrationConnections.$inferInsert

export type IntegrationEventSubscriptionRow = typeof integrationEventSubscriptions.$inferSelect
export type NewIntegrationEventSubscriptionRow = typeof integrationEventSubscriptions.$inferInsert

export type IntegrationRunRow = typeof integrationRuns.$inferSelect
export type NewIntegrationRunRow = typeof integrationRuns.$inferInsert

export type IntegrationDeliveryAttemptRow = typeof integrationDeliveryAttempts.$inferSelect
export type NewIntegrationDeliveryAttemptRow = typeof integrationDeliveryAttempts.$inferInsert

export type IntegrationDeadLetterRow = typeof integrationDeadLetters.$inferSelect
export type NewIntegrationDeadLetterRow = typeof integrationDeadLetters.$inferInsert

export type ExternalIdentityLinkRow = typeof externalIdentityLinks.$inferSelect
export type NewExternalIdentityLinkRow = typeof externalIdentityLinks.$inferInsert

export type IntegrationMappingRuleRow = typeof integrationMappingRules.$inferSelect
export type NewIntegrationMappingRuleRow = typeof integrationMappingRules.$inferInsert
