import { z } from 'zod'

// ─── AI Request Schema ──────────────────────────────────────────────────────

export const aiRequestSchema = z.object({
  model: z.string().min(1),
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type AIRequest = z.infer<typeof aiRequestSchema>

// ─── AI Response ────────────────────────────────────────────────────────────

export const aiResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  content: z.string(),
  tokensUsed: z.object({
    prompt: z.number().int().nonnegative(),
    completion: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  costUsd: z.number().nonnegative(),
  classification: z.enum(['safe', 'warning', 'restricted']),
  durationMs: z.number().nonnegative(),
  timestamp: z.string().datetime(),
})

export type AIResponse = z.infer<typeof aiResponseSchema>

// ─── Budget Config ──────────────────────────────────────────────────────────

export const budgetConfigSchema = z.object({
  tenantId: z.string().min(1),
  monthlyCapUsd: z.number().positive(),
  perRequestCapUsd: z.number().positive().optional(),
  warningThresholdPercent: z.number().min(0).max(100).default(80),
  roles: z.record(z.object({
    monthlyCapUsd: z.number().positive(),
  })).optional(),
})

export type BudgetConfig = z.infer<typeof budgetConfigSchema>

// ─── Budget Status ──────────────────────────────────────────────────────────

export const budgetStatusSchema = z.object({
  tenantId: z.string(),
  period: z.string(),
  spentUsd: z.number().nonnegative(),
  monthlyCapUsd: z.number().positive(),
  remainingUsd: z.number(),
  usagePercent: z.number(),
  status: z.enum(['ok', 'warning', 'blocked']),
})

export type BudgetStatus = z.infer<typeof budgetStatusSchema>

// ─── Policy Context ─────────────────────────────────────────────────────────

export const aiPolicyContextSchema = z.object({
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  role: z.string().optional(),
  model: z.string().min(1),
  action: z.string().min(1),
  dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
})

export type AIPolicyContext = z.infer<typeof aiPolicyContextSchema>

// ─── Policy Decision ────────────────────────────────────────────────────────

export const aiPolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  policyId: z.string().optional(),
  restrictions: z.array(z.string()).optional(),
})

export type AIPolicyDecision = z.infer<typeof aiPolicyDecisionSchema>

// ─── Classification ─────────────────────────────────────────────────────────

export type OutputClassification = 'safe' | 'warning' | 'restricted'

// ─── AI Log Entry ───────────────────────────────────────────────────────────

export const aiLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  tenantId: z.string(),
  actorId: z.string(),
  model: z.string(),
  promptHash: z.string(),
  responseHash: z.string(),
  tokensUsed: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  classification: z.enum(['safe', 'warning', 'restricted']),
  durationMs: z.number().nonnegative(),
  policyDecision: aiPolicyDecisionSchema,
})

export type AILogEntry = z.infer<typeof aiLogEntrySchema>
