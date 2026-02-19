/**
 * @nzila/ai-core — Zod schemas for structured outputs + action proposals
 */
import { z } from 'zod'
import type { AiFeature, DataClass } from './types'

// ── Request validation schemas ──────────────────────────────────────────────

export const AiGenerateRequestSchema = z.object({
  entityId: z.string().uuid(),
  appKey: z.string().min(1).max(60),
  profileKey: z.string().min(1).max(120),
  promptKey: z.string().optional(),
  input: z.union([z.string(), z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  }))]),
  variables: z.record(z.string()).optional(),
  dataClass: z.enum(['public', 'internal', 'sensitive', 'regulated']),
  trace: z.object({
    correlationId: z.string().optional(),
    domainType: z.string().optional(),
    domainId: z.string().optional(),
  }).optional(),
  params: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
  }).optional(),
})

export const AiChatStreamRequestSchema = AiGenerateRequestSchema

export const AiEmbedRequestSchema = z.object({
  entityId: z.string().uuid(),
  appKey: z.string().min(1).max(60),
  profileKey: z.string().min(1).max(120),
  input: z.union([z.string(), z.array(z.string())]),
  dataClass: z.enum(['public', 'internal', 'sensitive', 'regulated']),
})

export const AiRagQueryRequestSchema = z.object({
  entityId: z.string().uuid(),
  appKey: z.string().min(1).max(60),
  profileKey: z.string().min(1).max(120),
  query: z.string().min(1),
  topK: z.number().int().min(1).max(50).default(5),
  filters: z.record(z.unknown()).optional(),
  dataClass: z.enum(['public', 'internal', 'sensitive', 'regulated']),
})

export const AiExtractRequestSchema = z.object({
  entityId: z.string().uuid(),
  appKey: z.string().min(1).max(60),
  profileKey: z.string().min(1).max(120),
  promptKey: z.string(),
  input: z.string(),
  schemaKey: z.string().optional(),
  variables: z.record(z.string()).optional(),
  dataClass: z.enum(['public', 'internal', 'sensitive', 'regulated']),
  trace: z.object({
    correlationId: z.string().optional(),
    domainType: z.string().optional(),
    domainId: z.string().optional(),
  }).optional(),
})

export const AiActionProposeRequestSchema = z.object({
  entityId: z.string().uuid(),
  appKey: z.string().min(1).max(60),
  profileKey: z.string().min(1).max(120),
  actionType: z.string().min(1).max(120),
  input: z.string().min(1),
  trace: z.object({
    correlationId: z.string().optional(),
    domainType: z.string().optional(),
    domainId: z.string().optional(),
  }).optional(),
})

export const AiActionApproveRequestSchema = z.object({
  actionId: z.string().uuid(),
  approved: z.boolean(),
  notes: z.string().optional(),
})

// ── Action type schemas registry ────────────────────────────────────────────

/**
 * Registry of Zod schemas for different action types.
 * Each action type's proposal JSON must conform to its schema.
 */
const ACTION_SCHEMAS: Record<string, z.ZodType<unknown>> = {
  create_close_exception: z.object({
    periodId: z.string().uuid(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    suggestedAction: z.string(),
  }),
  draft_resolution: z.object({
    title: z.string(),
    bodyMarkdown: z.string(),
    kind: z.enum(['board', 'shareholder', 'special']),
  }),
  open_jira_issue: z.object({
    project: z.string(),
    summary: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
  }),
}

/**
 * Validate proposal JSON against the registered schema for the action type.
 * Returns { valid: true, data } or { valid: false, error }.
 */
export function validateActionProposal(
  actionType: string,
  proposal: unknown,
): { valid: true; data: unknown } | { valid: false; error: string } {
  const schema = ACTION_SCHEMAS[actionType]
  if (!schema) {
    // No schema registered — allow freeform (v1 flexibility)
    return { valid: true, data: proposal }
  }

  const result = schema.safeParse(proposal)
  if (!result.success) {
    return { valid: false, error: result.error.message }
  }
  return { valid: true, data: result.data }
}

/**
 * Validate structured output from an extract call against a JSON schema.
 * Uses a basic Zod-from-JSON-schema approach for v1.
 */
export function validateOutputSchema(
  output: unknown,
  jsonSchema: Record<string, unknown>,
): { valid: true; data: unknown } | { valid: false; error: string } {
  // For v1, we do a basic type check
  // In production, use a full JSON Schema → Zod compiler (e.g. zod-to-json-schema inverse)
  try {
    if (typeof output !== 'object' || output === null) {
      return { valid: false, error: 'Output must be a JSON object' }
    }
    // Check required fields if present in schema
    const required = (jsonSchema.required ?? []) as string[]
    const obj = output as Record<string, unknown>
    for (const key of required) {
      if (!(key in obj)) {
        return { valid: false, error: `Missing required field: ${key}` }
      }
    }
    return { valid: true, data: output }
  } catch (err) {
    return { valid: false, error: String(err) }
  }
}
