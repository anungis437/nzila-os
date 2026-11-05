/**
 * @nzila/platform-policy-engine — Types
 *
 * Governance DSL: policies as code with Zod-validated schemas.
 * Supports access, approval, voting, and financial control policies.
 *
 * @module @nzila/platform-policy-engine/types
 */
import { z } from 'zod'

// ── Policy Taxonomy ─────────────────────────────────────────────────────────

export type PolicyType = 'access' | 'approval' | 'voting' | 'financial'
export type PolicyEffect = 'allow' | 'deny' | 'require_approval'
export type PolicySeverity = 'info' | 'warning' | 'critical'
export type EvaluationResult = 'pass' | 'fail' | 'require_approval'

// ── Policy Definition ───────────────────────────────────────────────────────

export interface PolicyCondition {
  readonly field: string
  readonly operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'matches'
  readonly value?: unknown
}

export interface PolicyRule {
  readonly id: string
  readonly description: string
  readonly conditions: readonly PolicyCondition[]
  readonly effect: PolicyEffect
  readonly severity: PolicySeverity
  readonly requireApprovers?: number
  readonly approverRoles?: readonly string[]
}

export interface PolicyDefinition {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly type: PolicyType
  readonly description: string
  readonly enabled: boolean
  readonly scope: PolicyScope
  readonly rules: readonly PolicyRule[]
  readonly metadata: Record<string, string>
}

export interface PolicyScope {
  readonly orgId?: string
  readonly environments?: readonly string[]
  readonly resources?: readonly string[]
}

// ── Evaluation ──────────────────────────────────────────────────────────────

export interface PolicyEvaluationInput {
  readonly policyId: string
  readonly actor: PolicyActor
  readonly action: string
  readonly resource: string
  readonly context: Record<string, unknown>
  readonly orgId: string
  readonly environment: string
}

export interface PolicyActor {
  readonly userId: string
  readonly roles: readonly string[]
  readonly orgRole?: string
}

export interface PolicyDecision {
  readonly policyId: string
  readonly ruleId: string
  readonly result: EvaluationResult
  readonly effect: PolicyEffect
  readonly severity: PolicySeverity
  readonly reason: string
  readonly requireApprovers?: number
  readonly approverRoles?: readonly string[]
}

export interface PolicyEvaluationOutput {
  readonly evaluationId: string
  readonly policyId: string
  readonly input: PolicyEvaluationInput
  readonly decisions: readonly PolicyDecision[]
  readonly overallResult: EvaluationResult
  readonly evaluatedAt: string
  readonly durationMs: number
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface PolicyAuditEntry {
  readonly id: string
  readonly evaluationId: string
  readonly policyId: string
  readonly actor: PolicyActor
  readonly action: string
  readonly resource: string
  readonly overallResult: EvaluationResult
  readonly decisions: readonly PolicyDecision[]
  readonly orgId: string
  readonly environment: string
  readonly timestamp: string
  readonly includedInEvidencePack?: string
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface PolicyEnginePorts {
  /** Load raw policy YAML content by path */
  readonly loadPolicyFile: (path: string) => Promise<string>
  /** List available policy files */
  readonly listPolicyFiles: () => Promise<readonly string[]>
  /** Record a policy audit entry */
  readonly recordAudit: (entry: PolicyAuditEntry) => Promise<void>
  /** Load audit entries for a given org */
  readonly loadAuditEntries: (orgId: string, limit?: number) => Promise<readonly PolicyAuditEntry[]>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const policyConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'matches']),
  value: z.unknown(),
})

export const policyRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  conditions: z.array(policyConditionSchema),
  effect: z.enum(['allow', 'deny', 'require_approval']),
  severity: z.enum(['info', 'warning', 'critical']),
  requireApprovers: z.number().int().positive().optional(),
  approverRoles: z.array(z.string()).optional(),
})

export const policyScopeSchema = z.object({
  orgId: z.guid().optional(),
  environments: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
})

export const policyDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string(),
  type: z.enum(['access', 'approval', 'voting', 'financial']),
  description: z.string(),
  enabled: z.boolean(),
  scope: policyScopeSchema,
  rules: z.array(policyRuleSchema),
  metadata: z.record(z.string(), z.string()).prefault({}),
})

export const policyFileSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  policies: z.array(policyDefinitionSchema),
})

export type PolicyFile = z.infer<typeof policyFileSchema>
