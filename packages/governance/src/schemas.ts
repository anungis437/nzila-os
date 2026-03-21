import { z } from "zod";

// ── Actor & Resource ────────────────────────────────────────

export const ActorSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  roles: z.array(z.string()),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
export type Actor = z.infer<typeof ActorSchema>;

export const ResourceSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  orgId: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
export type Resource = z.infer<typeof ResourceSchema>;

// ── Policy ──────────────────────────────────────────────────

export type PolicyAction = string; // e.g. "read", "write", "delete", "approve"

export const PolicyConditionSchema = z.object({
  field: z.string(),       // dot-path on context, e.g. "actor.orgId"
  operator: z.enum(["eq", "neq", "in", "not_in", "exists", "gt", "lt"]),
  value: z.unknown(),
});
export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;

export const PolicyRuleSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  resource: z.string(),                     // resource type, e.g. "claim", "*"
  actions: z.array(z.string()),             // e.g. ["read", "write"]
  effect: z.enum(["allow", "deny"]),
  conditions: z.array(PolicyConditionSchema).optional(),
  roles: z.array(z.string()).optional(),    // required roles (any match)
  priority: z.number().default(0),          // higher = evaluated first
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicySetSchema = z.object({
  id: z.string(),
  name: z.string(),
  rules: z.array(PolicyRuleSchema),
  defaultEffect: z.enum(["allow", "deny"]).default("deny"),
});
export type PolicySet = z.infer<typeof PolicySetSchema>;

// ── Access Request & Decision ───────────────────────────────

export const AccessRequestSchema = z.object({
  actor: ActorSchema,
  resource: ResourceSchema,
  action: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});
export type AccessRequest = z.infer<typeof AccessRequestSchema>;

export type DecisionOutcome = "allow" | "deny";

export interface GovernanceDecision {
  outcome: DecisionOutcome;
  matchedRuleId: string | null;
  reason: string;
  request: AccessRequest;
  evaluatedAt: string;
  durationMs: number;
}

// ── Decision Log ────────────────────────────────────────────

export interface DecisionLogEntry extends GovernanceDecision {
  id: string;
  policySetId: string;
}
