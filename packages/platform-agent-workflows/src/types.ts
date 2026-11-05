import { z } from 'zod'

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked'

export interface WorkflowStep {
  id: string
  name: string
  status: WorkflowStatus
  policyCheck?: {
    policyId: string
    result: 'allow' | 'deny' | 'requires_approval'
  }
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

export const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'blocked']),
  policyCheck: z
    .object({
      policyId: z.string(),
      result: z.enum(['allow', 'deny', 'requires_approval']),
    })
    .optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
})

export const agentWorkflowSchema = z.object({
  id: z.guid(),
  name: z.string(),
  triggerEvent: z.string(),
  app: z.string(),
  orgId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'blocked']),
  steps: z.array(workflowStepSchema),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
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
  id: z.guid(),
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
