/**
 * @nzila/executive-os — Agent Contract
 *
 * Canonical contract every ExecutiveOS agent (Chief of Staff, CFO, RevOps,
 * Platform Reliability, Legal, Knowledge Steward, …) must implement.
 *
 * Agents are pure functions over a request envelope: they read from
 * existing repo data sources (provided by the host), and emit insights +
 * actions. They DO NOT write to the database directly — the host runner
 * (see `runAgent`) persists results via the schema in
 * @nzila/db/schema/executive (executive_agent_runs / _insights / _actions).
 *
 * Material actions ALWAYS require approval before execution.
 */
import { z } from 'zod'

// ── Domains ────────────────────────────────────────────────────────────────

export const EXECUTIVE_DOMAINS = [
  'executive',
  'finance',
  'revenue',
  'operations',
  'platform',
  'governance',
  'people',
  'knowledge',
  'portfolio',
] as const

export type ExecutiveDomain = (typeof EXECUTIVE_DOMAINS)[number]

// ── Action Class ───────────────────────────────────────────────────────────

export const ACTION_CLASSES = ['insight', 'recommendation', 'draft_action'] as const
export type ActionClass = (typeof ACTION_CLASSES)[number]

export const APPROVAL_STATES = ['pending', 'approved', 'rejected', 'auto', 'expired'] as const
export type ApprovalState = (typeof APPROVAL_STATES)[number]

export const EXECUTION_STATUSES = [
  'not_executed',
  'in_progress',
  'succeeded',
  'failed',
  'skipped',
] as const
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number]

export const SEVERITIES = ['info', 'warn', 'critical'] as const
export type Severity = (typeof SEVERITIES)[number]

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

// ── Schemas ────────────────────────────────────────────────────────────────

export const insightSchema = z.object({
  domain: z.enum(EXECUTIVE_DOMAINS),
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(SEVERITIES).default('info'),
  confidence: z.number().min(0).max(1).default(0.5),
  evidence: z.record(z.string(), z.unknown()).optional(),
  consequenceIfIgnored: z.string().optional(),
  recommendedNextStep: z.string().optional(),
})

export type AgentInsight = z.infer<typeof insightSchema>

export const actionSchema = z.object({
  actionClass: z.enum(ACTION_CLASSES),
  title: z.string().min(1),
  description: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  /**
   * Material actions (anything beyond `insight`) default to requiring
   * approval. Agents may set this to false ONLY for purely informational
   * outputs.
   */
  requiresApproval: z.boolean().default(true),
  confidence: z.number().min(0).max(1).default(0.5),
  riskLevel: z.enum(RISK_LEVELS).default('low'),
  dueDate: z.string().optional(),
  /** Optional link back to the insight that generated this action */
  insightRef: z.string().optional(),
})

export type AgentAction = z.infer<typeof actionSchema>

export const agentResultSchema = z.object({
  summary: z.string().optional(),
  insights: z.array(insightSchema).default([]),
  actions: z.array(actionSchema).default([]),
})

export type AgentResult = z.infer<typeof agentResultSchema>

// ── Request envelope ───────────────────────────────────────────────────────

export interface AgentRequest<TInput = Record<string, unknown>> {
  readonly orgId: string
  readonly actorId?: string
  readonly correlationId?: string
  readonly triggeredBy?: 'schedule' | 'manual' | 'event' | 'chained'
  readonly now?: Date
  readonly input?: TInput
}

// ── Agent definition ───────────────────────────────────────────────────────

export interface ExecutiveAgent<TInput = Record<string, unknown>> {
  /** Stable, dash-case key (e.g. `chief-of-staff`, `internal-cfo`) */
  readonly key: string
  /** Human-readable name */
  readonly name: string
  /** Primary domain */
  readonly domain: ExecutiveDomain
  /** Mission statement (one sentence) */
  readonly mission: string
  /** Semver-ish version string */
  readonly version: string
  /** Pure execution — no DB writes, no side effects */
  readonly run: (req: AgentRequest<TInput>) => Promise<AgentResult>
}

// ── Validation helpers ─────────────────────────────────────────────────────

export function validateAgentResult(value: unknown): AgentResult {
  return agentResultSchema.parse(value)
}

/**
 * Material actions (recommendation / draft_action) MUST require approval
 * unless they are explicitly low-risk informational. Enforced server-side
 * before persistence.
 */
export function enforceApprovalDefaults(action: AgentAction): AgentAction {
  if (action.actionClass === 'insight') {
    return { ...action, requiresApproval: false }
  }
  return { ...action, requiresApproval: true }
}
