import { z } from 'zod'

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked'
export type EngineeringOutcomePhase = 'IMPLEMENTED' | 'VERIFIED'

/**
 * Completed is a verified workflow outcome, NOT a release authorization.
 * No skill, agent, MCP descriptor, or workflow step can grant release authority.
 */
export interface OutcomeEvidence {
  phase: 'VERIFIED'
  verificationRef: string
  verifierId: string
  source: string
  commitSha: string
  artifactDigest: string
  evidenceRefs: readonly string[]
  verifiedAt: string
}

export interface WorkflowStep {
  id: string
  name: string
  status: WorkflowStatus
  policyCheck?: {
    policyId: string
    result: 'allow' | 'deny' | 'requires_approval'
  }
  outcomeEvidence?: OutcomeEvidence
  output?: Record<string, unknown>
  error?: string
}

export interface AgentWorkflow {
  id: string
  name: string
  triggerEvent: string
  app: string
  orgId: string
  status: WorkflowStatus
  steps: WorkflowStep[]
  createdAt: string
  completedAt?: string
}

export const outcomeEvidenceSchema = z.object({
  phase: z.literal('VERIFIED'),
  verificationRef: z.string().min(1),
  verifierId: z.string().min(1),
  source: z.string().min(1),
  commitSha: z.string().regex(/^[0-9a-f]{40}$/i),
  artifactDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/i),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  verifiedAt: z.string().datetime(),
}).strict()

export const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'blocked']),
  policyCheck: z.object({
    policyId: z.string(),
    result: z.enum(['allow', 'deny', 'requires_approval']),
  }).optional(),
  outcomeEvidence: outcomeEvidenceSchema.optional(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
}).superRefine((step, ctx) => {
  if (step.status === 'completed' && (!step.outcomeEvidence || step.policyCheck?.result !== 'allow')) {
    ctx.addIssue({ code: 'custom', message: 'Completed step requires policy allow and independently verified evidence' })
  }
})

export const agentWorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  triggerEvent: z.string(),
  app: z.string(),
  orgId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'blocked']),
  steps: z.array(workflowStepSchema),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
}).superRefine((workflow, ctx) => {
  if (workflow.status === 'completed' && (!workflow.steps.length || workflow.steps.some(s => s.status !== 'completed'))) {
    ctx.addIssue({ code: 'custom', message: 'Completed workflow requires every step verified' })
  }
})

export interface Recommendation {
  id: string
  workflowId: string
  timestamp: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  actionable: boolean
  suggestedAction?: string
  evidenceRefs?: string[]
  humanReviewRequired: boolean
}

export const recommendationSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string(),
  timestamp: z.string().datetime(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  actionable: z.boolean(),
  suggestedAction: z.string().optional(),
  evidenceRefs: z.array(z.string()).optional(),
  humanReviewRequired: z.boolean(),
})
