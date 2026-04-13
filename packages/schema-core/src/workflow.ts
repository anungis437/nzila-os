import { z } from 'zod'

/**
 * Workflow / FSM state schemas — canonical workflow state contracts.
 */

export const workflowStateSchema = z.object({
  id: z.string().uuid(),
  workflowKey: z.string().min(1),
  currentState: z.string().min(1),
  previousState: z.string().nullable(),
  entityId: z.string().uuid(),
  entityType: z.string().min(1),
  orgId: z.string().min(1),
  sourceModule: z.string().min(1),
  lastTransitionBy: z.string().min(1),
  lastTransitionAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  isTerminal: z.boolean().default(false),
  transitionCount: z.number().int().nonnegative().default(0),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
  schemaVersion: z.string().default('1.0.0'),
})
export type WorkflowState = z.infer<typeof workflowStateSchema>

export const workflowTransitionRecordSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  fromState: z.string().min(1),
  toState: z.string().min(1),
  trigger: z.string().min(1),
  actorId: z.string().min(1),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()).optional(),
  auditId: z.string().uuid().optional(),
})
export type WorkflowTransitionRecord = z.infer<typeof workflowTransitionRecordSchema>
