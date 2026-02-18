/**
 * Nzila Business OS - Governance Workflows
 * 
 * Approval workflows, resolutions, and governance action tracking.
 */

import { z } from 'zod'
import { 
  ApprovalStatus, 
  ResolutionType, 
  WorkflowType 
} from '../equity/models'

// ============================================================================
// WORKFLOW MODELS
// ============================================================================

/**
 * Approval workflow instance
 */
export const ApprovalWorkflowSchema = z.object({
  id: z.string().uuid(),
  workflowType: z.nativeEnum(WorkflowType),
  
  // Request details
  requestorId: z.string().uuid(),
  requestorName: z.string(),
  requestDate: z.string().datetime(),
  
  // Action being approved
  action: z.string(),           // e.g., "ISSUE_SHARES", "TRANSFER_SHARES"
  actionParams: z.record(z.string(), z.unknown()),
  description: z.string(),
  amount: z.number().optional(), // For financial actions
  
  // Current status
  status: z.nativeEnum(ApprovalStatus),
  currentStep: z.number().int().nonnegative().default(0),
  
  // Resolution reference (if generated)
  resolutionId: z.string().uuid().optional(),
  
  // Steps
  steps: z.array(z.object({
    order: z.number().int(),
    type: z.enum(['APPROVAL', 'NOTICE', 'WAIT', 'DOCUMENT']),
    actor: z.enum(['board', 'shareholders', 'specific', 'system']),
    actorId: z.string().uuid().optional(),
    status: z.nativeEnum(ApprovalStatus),
    required: z.boolean(),
    description: z.string(),
    completedAt: z.string().datetime().optional(),
    deadline: z.string().datetime().optional(),
    response: z.string().optional(),
  })),
  
  // Outcome
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().optional(),
  
  // Metadata
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ApprovalWorkflow = z.infer<typeof ApprovalWorkflowSchema>

/**
 * Resolution document
 */
export const ResolutionSchema = z.object({
  id: z.string().uuid(),
  resolutionNumber: z.string(),  // e.g., "RES-2024-001"
  type: z.nativeEnum(ResolutionType),
  
  // Title and content
  title: z.string(),
  description: z.string(),
  recitals: z.array(z.string()).default([]),
  
  // Operative clauses
  clauses: z.array(z.object({
    number: z.string(),
    text: z.string(),
    votesFor: z.number().int().nonnegative().optional(),
    votesAgainst: z.number().int().nonnegative().optional(),
    votesAbstain: z.number().int().nonnegative().optional(),
  })),
  
  // Approval thresholds
  requiredQuorum: z.number().min(0).max(100),  // Percentage required
  requiredApproval: z.number().min(0).max(100), // Percentage approval needed
  
  // Vote results
  votesFor: z.number().int().nonnegative().default(0),
  votesAgainst: z.number().int().nonnegative().default(0),
  votesAbstain: z.number().int().nonnegative().default(0),
  quorumMet: z.boolean().default(false),
  approved: z.boolean().default(false),
  
  // Signatures
  signatures: z.array(z.object({
    signerId: z.string().uuid(),
    signerName: z.string(),
    signerRole: z.string(),
    signedAt: z.string().datetime(),
    signatureHash: z.string().optional(),
  })),
  
  // Related workflow
  workflowId: z.string().uuid().optional(),
  relatedAction: z.string().optional(),
  
  // Meeting reference (if applicable)
  meetingId: z.string().uuid().optional(),
  meetingDate: z.string().datetime().optional(),
  
  // Status
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FILED']),
  effectiveDate: z.string().datetime().optional(),
  
  // Document references
  documentUrls: z.array(z.string()).default([]),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Resolution = z.infer<typeof ResolutionSchema>

/**
 * Board/Shareholder meeting
 */
export const MeetingSchema = z.object({
  id: z.string().uuid(),
  meetingNumber: z.string(),
  type: z.enum(['ANNUAL', 'SPECIAL', 'BOARD', 'COMMITTEE']),
  
  // Details
  title: z.string(),
  description: z.string().optional(),
  date: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  location: z.string().optional(),
  virtualLink: z.string().optional(),
  
  // Attendance
  attendees: z.array(z.object({
    attendeeId: z.string().uuid(),
    attendeeName: z.string(),
    role: z.string(),
    present: z.boolean(),
    presentAt: z.string().datetime().optional(),
    proxy: z.string().uuid().optional(),  // If someone else voted on their behalf
  })),
  
  // Quorum
  quorumRequired: z.number().min(0).max(100),
  quorumPresent: z.number().int().nonnegative().default(0),
  quorumMet: z.boolean().default(false),
  
  // Resolutions
  resolutions: z.array(z.string().uuid()),  // Resolution IDs
  
  // Minutes
  minutesApproved: z.boolean().default(false),
  minutesApprovedAt: z.string().datetime().optional(),
  minutesUrl: z.string().optional(),
  
  // Status
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'ADJOURNED', 'COMPLETED', 'CANCELLED']),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Meeting = z.infer<typeof MeetingSchema>

/**
 * Document vault entry
 */
export const DocumentVaultSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum([
    'SHARE_CERTIFICATE',
    'SUBSCRIPTION_AGREEMENT',
    'TRANSFER_AGREEMENT',
    'RESOLUTION',
    'MEETING_MINUTES',
    'BOARD_RESOLUTION',
    'SHAREHOLDER_AGREEMENT',
    'ARTICLES_OF_INCORPORATION',
    'BYLAWS',
    'AMENDMENT',
    'OTHER',
  ]),
  
  // Content
  description: z.string().optional(),
  fileUrl: z.string().url().optional(),
  content: z.string().optional(),
  
  // Metadata
  entityType: z.enum(['COMPANY', 'SHAREHOLDER', 'SHARE_CLASS', 'WORKFLOW']),
  entityId: z.string().uuid(),
  
  // Signatures
  requiresSignature: z.boolean().default(false),
  signaturesRequired: z.array(z.object({
    signerId: z.string().uuid(),
    signerName: z.string(),
    signerRole: z.string(),
    signed: z.boolean(),
    signedAt: z.string().datetime().optional(),
  })),
  
  // Access control
  visibility: z.enum(['PUBLIC', 'BOARD_ONLY', 'SHAREHOLDERS', 'RESTRICTED']),
  
  // Status
  status: z.enum(['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'FILED', 'ARCHIVED']),
  
  // Versioning
  version: z.number().int().positive().default(1),
  previousVersionId: z.string().uuid().optional(),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type DocumentVault = z.infer<typeof DocumentVaultSchema>

// ============================================================================
// WORKFLOW SERVICE
// ============================================================================

/**
 * Create a new approval workflow from a policy evaluation
 */
export function createWorkflow(
  workflowType: WorkflowType,
  requestorId: string,
  requestorName: string,
  action: string,
  actionParams: Record<string, unknown>,
  description: string,
  workflowSpec: {
    steps: Array<{
      order: number
      type: 'APPROVAL' | 'NOTICE' | 'WAIT' | 'DOCUMENT'
      actor: 'board' | 'shareholders' | 'specific' | 'system'
      required: boolean
      description: string
      deadline?: number
    }>
    estimatedDuration: number
  },
  options?: {
    amount?: number
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  }
): ApprovalWorkflow {
  const now = new Date().toISOString()
  
  const steps = workflowSpec.steps.map((step, index) => {
    const deadline = step.deadline 
      ? new Date(Date.now() + step.deadline * 24 * 60 * 60 * 1000).toISOString()
      : undefined
    
    return {
      order: step.order,
      type: step.type,
      actor: step.actor,
      status: index === 0 ? ApprovalStatus.PENDING : ApprovalStatus.PENDING,
      required: step.required,
      description: step.description,
      deadline,
    }
  })
  
  const dueDate = new Date(
    Date.now() + workflowSpec.estimatedDuration * 24 * 60 * 60 * 1000
  ).toISOString()
  
  return {
    id: crypto.randomUUID(),
    workflowType,
    requestorId,
    requestorName,
    requestDate: now,
    action,
    actionParams,
    description,
    amount: options?.amount,
    status: ApprovalStatus.PENDING,
    currentStep: 0,
    steps,
    priority: options?.priority || 'NORMAL',
    dueDate,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Advance a workflow to the next step
 */
export function advanceWorkflow(
  workflow: ApprovalWorkflow,
  stepStatus: ApprovalStatus,
  response?: string,
  actorId?: string
): ApprovalWorkflow {
  const now = new Date().toISOString()
  const updatedSteps = [...workflow.steps]
  
  // Complete current step
  updatedSteps[workflow.currentStep] = {
    ...updatedSteps[workflow.currentStep],
    status: stepStatus,
    completedAt: now,
    response,
    actorId,
  }
  
  // Determine new status
  let newStatus = workflow.status
  let newStep = workflow.currentStep
  
  if (stepStatus === ApprovalStatus.APPROVED) {
    // Move to next step
    newStep = workflow.currentStep + 1
    
    if (newStep >= workflow.steps.length) {
      // All steps complete
      newStatus = ApprovalStatus.APPROVED
    } else {
      // Mark next step as pending
      updatedSteps[newStep] = {
        ...updatedSteps[newStep],
        status: ApprovalStatus.PENDING,
      }
    }
  } else if (stepStatus === ApprovalStatus.REJECTED) {
    newStatus = ApprovalStatus.REJECTED
  }
  
  return {
    ...workflow,
    status: newStatus,
    currentStep: newStep,
    steps: updatedSteps,
    approvedAt: newStatus === ApprovalStatus.APPROVED ? now : undefined,
    rejectedAt: newStatus === ApprovalStatus.REJECTED ? now : undefined,
    rejectionReason: stepStatus === ApprovalStatus.REJECTED ? response : undefined,
    updatedAt: now,
  }
}

/**
 * Generate a resolution from workflow approval
 */
export function generateResolution(
  workflow: ApprovalWorkflow,
  resolutionType: ResolutionType,
  title: string,
  description: string,
  recitals: string[] = [],
  clauses: Array<{ number: string; text: string }> = []
): Resolution {
  const now = new Date().toISOString()
  
  // Calculate required thresholds based on type
  let requiredQuorum = 50
  let requiredApproval = 50.01  // Simple majority
  
  if (resolutionType === ResolutionType.SPECIAL) {
    requiredQuorum = 75
    requiredApproval = 75
  } else if (resolutionType === ResolutionType.UNANIMOUS) {
    requiredQuorum = 100
    requiredApproval = 100
  }
  
  return {
    id: crypto.randomUUID(),
    resolutionNumber: `RES-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    type: resolutionType,
    title,
    description,
    recitals,
    clauses: clauses.map(c => ({
      ...c,
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
    })),
    requiredQuorum,
    requiredApproval,
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    quorumMet: false,
    approved: false,
    signatures: [],
    workflowId: workflow.id,
    relatedAction: workflow.action,
    status: 'DRAFT',
    documentUrls: [],
    createdAt: now,
    updatedAt: now,
  }
}

// ============================================================================
// QUEUE HELPERS
// ============================================================================

/**
 * Get all pending approvals for a user
 */
export function getPendingApprovals(
  workflows: ApprovalWorkflow[],
  userId?: string
): ApprovalWorkflow[] {
  return workflows.filter(w => {
    if (w.status !== ApprovalStatus.PENDING) return false
    if (!userId) return true
    
    const currentStep = w.steps[w.currentStep]
    if (!currentStep) return false
    
    // Check if user is the actor for current step
    if (currentStep.actor === 'specific' && currentStep.actorId === userId) {
      return true
    }
    // Board approval - user would need board role
    if (currentStep.actor === 'board') {
      return true  // Would check board membership in real implementation
    }
    // Shareholders - user is a shareholder
    if (currentStep.actor === 'shareholders') {
      return true  // Would check shareholding in real implementation
    }
    
    return false
  })
}

/**
 * Get workflows by status
 */
export function getWorkflowsByStatus(
  workflows: ApprovalWorkflow[],
  status: ApprovalStatus
): ApprovalWorkflow[] {
  return workflows.filter(w => w.status === status)
}

/**
 * Get overdue workflows
 */
export function getOverdueWorkflows(workflows: ApprovalWorkflow[]): ApprovalWorkflow[] {
  const now = new Date()
  return workflows.filter(w => {
    if (w.status !== ApprovalStatus.PENDING) return false
    if (!w.dueDate) return false
    return new Date(w.dueDate) < now
  })
}

// ============================================================================
// QUEUE TYPES FOR DASHBOARD
// ============================================================================

/**
 * Queue item for the dashboard
 */
export interface QueueItem {
  id: string
  type: 'approval' | 'signature' | 'document' | 'governance' | 'yearend'
  title: string
  description: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  dueDate?: string
  actionUrl: string
  assignee?: string
}

/**
 * Convert workflow to queue item
 */
export function workflowToQueueItem(workflow: ApprovalWorkflow): QueueItem {
  return {
    id: workflow.id,
    type: 'approval',
    title: `${workflow.workflowType.replace(/_/g, ' ')} Request`,
    description: workflow.description,
    priority: workflow.priority,
    dueDate: workflow.dueDate,
    actionUrl: `/governance/workflows/${workflow.id}`,
  }
}

/**
 * Resolution to queue item
 */
export function resolutionToQueueItem(resolution: Resolution): QueueItem {
  return {
    id: resolution.id,
    type: resolution.status === 'PENDING_APPROVAL' ? 'approval' : 'signature',
    title: resolution.title,
    description: `Resolution ${resolution.resolutionNumber}`,
    priority: 'HIGH',
    actionUrl: `/governance/resolutions/${resolution.id}`,
  }
}
