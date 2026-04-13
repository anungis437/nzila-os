/**
 * @nzila/platform-integrations-types — Zod Schemas (API Boundary)
 *
 * Input/output validation schemas for integration endpoints.
 */
import { z } from 'zod'

// ─── Shared ──────────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// ─── Connector Types ─────────────────────────────────────────────────────────

export const connectorTypeSchema = z.enum([
  'webhook', 'rest_api', 'email_ingestion', 'csv_sftp',
  'document_system', 'crm', 'hris', 'custom',
])

export const connectionStatusSchema = z.enum([
  'active', 'inactive', 'error', 'suspended', 'pending_setup',
])

export const appScopeSchema = z.enum([
  'union-eyes', 'zonga', 'flow', 'console', 'platform',
])

export const authMethodSchema = z.enum([
  'api_key', 'oauth2', 'basic', 'bearer', 'hmac_signature', 'mtls', 'none',
])

export const syncDirectionSchema = z.enum(['inbound', 'outbound', 'bidirectional'])

export const runStatusSchema = z.enum([
  'pending', 'running', 'completed', 'failed', 'partial', 'cancelled', 'retrying',
])

export const entityTypeSchema = z.enum([
  'user', 'case', 'grievance', 'organization', 'member',
  'employer', 'document', 'claim', 'agreement', 'custom',
])

export const sourceOfTruthModeSchema = z.enum([
  'internal', 'external', 'field_level', 'append_only',
])

// ─── Connection Schemas ──────────────────────────────────────────────────────

export const createConnectionSchema = z.object({
  orgId: uuidSchema,
  appScope: appScopeSchema,
  connectorType: connectorTypeSchema,
  name: z.string().min(1).max(255),
  configJson: z.record(z.unknown()).default({}),
  credentialRef: z.string().min(1).max(512).optional(),
})

export const updateConnectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: connectionStatusSchema.optional(),
  configJson: z.record(z.unknown()).optional(),
  credentialRef: z.string().min(1).max(512).optional(),
})

// ─── Subscription Schemas ────────────────────────────────────────────────────

export const createSubscriptionSchema = z.object({
  orgId: uuidSchema,
  connectionId: uuidSchema,
  eventType: z.string().min(1).max(128).regex(
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)*$/,
    'Event type must be dot-namespaced lowercase',
  ),
  targetEndpoint: z.string().url().max(2048).optional(),
  targetAction: z.string().min(1).max(255).optional(),
  filterRules: z.record(z.unknown()).optional(),
})

// ─── Inbound Payload Schema ──────────────────────────────────────────────────

export const inboundPayloadSchema = z.object({
  connectionId: uuidSchema,
  eventType: z.string().min(1).max(128),
  idempotencyKey: z.string().min(1).max(255).optional(),
  traceId: z.string().min(1).max(255).optional(),
  sourceSystem: z.string().min(1).max(128),
  actorId: z.string().min(1).max(255),
  actorType: z.enum(['user', 'service', 'connector', 'system']).default('service'),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
})

// ─── Mapping Rule Schemas ────────────────────────────────────────────────────

export const mappingOperationSchema = z.enum([
  'rename', 'constant', 'default', 'enum_translate', 'nested_extract',
  'date_normalize', 'identity_lookup', 'computed', 'coerce', 'omit', 'flatten',
])

export const fieldMappingSchema = z.object({
  sourceField: z.string().min(1),
  targetField: z.string().min(1),
  operation: mappingOperationSchema,
  config: z.record(z.unknown()).default({}),
  required: z.boolean().default(false),
})

export const validationRuleSchema = z.object({
  field: z.string().min(1),
  rule: z.enum(['required', 'min_length', 'max_length', 'pattern', 'enum', 'range', 'type', 'custom']),
  params: z.record(z.unknown()).default({}),
  message: z.string().min(1),
})

export const mappingRuleDefinitionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  sourceEntityType: z.string().min(1).max(128),
  targetEntityType: z.string().min(1).max(128),
  fields: z.array(fieldMappingSchema).min(1),
  preValidation: z.array(validationRuleSchema).optional(),
  postValidation: z.array(validationRuleSchema).optional(),
})

export const createMappingRuleSchema = z.object({
  orgId: uuidSchema,
  connectionId: uuidSchema,
  entityType: z.string().min(1).max(128),
  ruleJson: mappingRuleDefinitionSchema,
})

// ─── Identity Link Schemas ───────────────────────────────────────────────────

export const createIdentityLinkSchema = z.object({
  orgId: uuidSchema,
  connectionId: uuidSchema,
  entityType: entityTypeSchema,
  internalId: z.string().min(1).max(255),
  externalId: z.string().min(1).max(255),
  externalSystem: z.string().min(1).max(128),
  metadataJson: z.record(z.unknown()).optional(),
})

export const resolveIdentitySchema = z.object({
  orgId: uuidSchema,
  entityType: entityTypeSchema,
  externalId: z.string().min(1).max(255),
  externalSystem: z.string().min(1).max(128),
})

// ─── Replay Schema ───────────────────────────────────────────────────────────

export const replayRequestSchema = z.object({
  deadLetterIds: z.array(uuidSchema).min(1).max(100),
  actorId: z.string().min(1).max(255),
  reason: z.string().min(1).max(1024),
})

// ─── Retry Policy Schema ────────────────────────────────────────────────────

export const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  initialDelayMs: z.number().int().min(100).max(60000).default(1000),
  maxDelayMs: z.number().int().min(1000).max(600000).default(60000),
  backoffMultiplier: z.number().min(1).max(10).default(2),
  retryableStatusCodes: z.array(z.number().int().min(400).max(599)).default([408, 429, 500, 502, 503, 504]),
})

// ─── Source of Truth Policy Schema ───────────────────────────────────────────

export const fieldOwnershipRuleSchema = z.object({
  field: z.string().min(1),
  owner: z.enum(['internal', 'external']),
  writePolicy: z.enum(['overwrite', 'ignore', 'append', 'merge', 'error']),
  lastWriteWins: z.boolean().default(false),
})

export const sourceOfTruthPolicySchema = z.object({
  orgId: uuidSchema,
  connectionId: uuidSchema,
  entityType: z.string().min(1).max(128),
  mode: sourceOfTruthModeSchema,
  fieldOwnership: z.array(fieldOwnershipRuleSchema).default([]),
  conflictResolution: z.enum([
    'internal_wins', 'external_wins', 'last_write_wins', 'manual_review', 'field_level',
  ]).default('internal_wins'),
})
