// =====================================================================================
// PKI Workflow Engine
// =====================================================================================
// Purpose: Manage multi-party signature workflows and approval chains
// Features:
// - Sequential and parallel signing workflows
// - Required vs optional signers
// - Workflow state management
// - Expiration handling
// - Notification triggers
// =====================================================================================
// NOTE: Full implementation requires signature_workflows table (migration 051)
// Current implementation provides API structure and in-memory workflow logic
// =====================================================================================

import { db } from '@/db';
import { signatureWorkflows } from '@/db/schema/domains/documents';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// =====================================================================================
// TYPES
// =====================================================================================

export interface WorkflowDefinition {
  id: string;
  documentId: string;
  documentType: string;
  organizationId: string;
  createdBy: string;
  createdByName: string;
  name: string;
  description?: string;
  workflowType: 'sequential' | 'parallel' | 'hybrid';
  steps: WorkflowStep[];
  dueDate?: Date;
  status: WorkflowStatus;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
}

export interface WorkflowStep {
  stepNumber: number;
  stepName: string;
  signers: WorkflowSigner[];
  type: 'sequential' | 'parallel'; // For hybrid workflows
  completionType: 'all_required' | 'any_one' | 'majority';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkflowSigner {
  userId: string;
  userName: string;
  userEmail?: string;
  userTitle?: string;
  role: string;
  required: boolean;
  order: number;
  status: 'pending' | 'signed' | 'rejected' | 'skipped';
  signedAt?: Date;
  signatureId?: string;
  rejectionReason?: string;
}

export type WorkflowStatus = 
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'rejected';

export interface WorkflowCreateParams {
  documentId: string;
  documentType: string;
  organizationId: string;
  createdBy: string;
  createdByName: string;
  name: string;
  description?: string;
  workflowType: 'sequential' | 'parallel' | 'hybrid';
  steps: Omit<WorkflowStep, 'status' | 'startedAt' | 'completedAt'>[];
  dueDate?: Date;
  expiresAt?: Date;
}

export interface WorkflowAdvanceResult {
  workflowId: string;
  currentStep: number;
  totalSteps: number;
  nextSigners: WorkflowSigner[];
  isComplete: boolean;
  completedAt?: Date;
}

// =====================================================================================
// IN-MEMORY WORKFLOW STORE (Temporary until migration 051)
// =====================================================================================

const workflowStore = new Map<string, WorkflowDefinition>();

const mapWorkflowStatus = (status: WorkflowStatus) => {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'pending':
      return 'sent';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'expired':
      return 'expired';
    case 'cancelled':
      return 'cancelled';
    case 'rejected':
      return 'declined';
    default:
      return 'draft';
  }
};

const serializeWorkflow = (workflow: WorkflowDefinition) => ({
  ...workflow,
  createdAt: workflow.createdAt.toISOString(),
  completedAt: workflow.completedAt?.toISOString(),
  dueDate: workflow.dueDate?.toISOString(),
  expiresAt: workflow.expiresAt?.toISOString(),
  steps: workflow.steps.map((step) => ({
    ...step,
    startedAt: step.startedAt?.toISOString(),
    completedAt: step.completedAt?.toISOString(),
    signers: step.signers.map((signer) => ({
      ...signer,
      signedAt: signer.signedAt?.toISOString(),
    })),
  })),
});

const countCompletedSignatures = (workflow: WorkflowDefinition) =>
  workflow.steps.reduce(
    (count, step) => count + step.signers.filter((signer) => signer.status === 'signed').length,
    0
  );

const countTotalSignatures = (workflow: WorkflowDefinition) =>
  workflow.steps.reduce((count, step) => count + step.signers.length, 0);

const persistNewWorkflow = async (workflow: WorkflowDefinition) => {
  try {
    await db.insert(signatureWorkflows).values({
      organizationId: workflow.organizationId,
      documentId: workflow.documentId,
      name: workflow.name,
      description: workflow.description,
      status: mapWorkflowStatus(workflow.status),
      provider: 'signrequest',
      externalEnvelopeId: workflow.id,
      externalWorkflowId: workflow.id,
      totalSigners: countTotalSignatures(workflow),
      completedSignatures: countCompletedSignatures(workflow),
      sentAt: new Date(),
      expiresAt: workflow.expiresAt,
      completedAt: workflow.completedAt,
      workflowData: serializeWorkflow(workflow),
      createdBy: workflow.createdBy,
    }).onConflictDoUpdate({
      target: signatureWorkflows.externalEnvelopeId,
      set: {
        status: mapWorkflowStatus(workflow.status),
        completedSignatures: countCompletedSignatures(workflow),
        expiresAt: workflow.expiresAt,
        completedAt: workflow.completedAt,
        workflowData: serializeWorkflow(workflow),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to persist workflow', { error, workflowId: workflow.id });
  }
};

const updateWorkflowInDb = async (workflow: WorkflowDefinition) => {
  try {
    await db
      .update(signatureWorkflows)
      .set({
        status: mapWorkflowStatus(workflow.status),
        completedSignatures: countCompletedSignatures(workflow),
        completedAt: workflow.completedAt,
        expiresAt: workflow.expiresAt,
        workflowData: serializeWorkflow(workflow),
        updatedAt: new Date(),
      })
      .where(eq(signatureWorkflows.externalEnvelopeId, workflow.id));
  } catch (error) {
    logger.error('Failed to update workflow persistence', { error, workflowId: workflow.id });
  }
};

// =====================================================================================
// WORKFLOW CREATION
// =====================================================================================

/**
 * Create a new signature workflow
 */
export function createWorkflow(params: WorkflowCreateParams): WorkflowDefinition {
  const workflow: WorkflowDefinition = {
    id: crypto.randomUUID(),
    documentId: params.documentId,
    documentType: params.documentType,
    organizationId: params.organizationId,
    createdBy: params.createdBy,
    createdByName: params.createdByName,
    name: params.name,
    description: params.description,
    workflowType: params.workflowType,
    steps: params.steps.map(step => ({
      ...step,
      status: 'pending' as const,
    })),
    dueDate: params.dueDate,
    status: 'pending',
    createdAt: new Date(),
    expiresAt: params.expiresAt,
  };

  // Store in memory for fast access
  workflowStore.set(workflow.id, workflow);

  void persistNewWorkflow(workflow);

  return workflow;
}

/**
 * Start a workflow (move from draft/pending to in_progress)
 */
export function startWorkflow(workflowId: string): WorkflowDefinition {
  const workflow = workflowStore.get(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  if (workflow.status !== 'pending' && workflow.status !== 'draft') {
    throw new Error('Workflow already started or completed');
  }

  workflow.status = 'in_progress';
  
  // Start first step
  if (workflow.steps.length > 0) {
    workflow.steps[0].status = 'in_progress';
    workflow.steps[0].startedAt = new Date();
  }

  void updateWorkflowInDb(workflow);

  return workflow;
}

// =====================================================================================
// WORKFLOW PROGRESSION
// =====================================================================================

/**
 * Record a signature in the workflow
 */
export async function recordSignature(
  workflowId: string,
  userId: string,
  signatureId: string
): Promise<WorkflowAdvanceResult> {
  const workflow = workflowStore.get(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  if (workflow.status !== 'in_progress') {
    throw new Error('Workflow is not in progress');
  }

  // Find current step
  const currentStepIndex = workflow.steps.findIndex(s => s.status === 'in_progress');
  if (currentStepIndex === -1) {
    throw new Error('No active step found');
  }

  const currentStep = workflow.steps[currentStepIndex];

  // Find signer in current step
  const signer = currentStep.signers.find(s => s.userId === userId);
  if (!signer) {
    throw new Error('User not found in current workflow step');
  }

  if (signer.status === 'signed') {
    throw new Error('User has already signed');
  }

  // Update signer status
  signer.status = 'signed';
  signer.signedAt = new Date();
  signer.signatureId = signatureId;

  // Check if step is complete
  const isStepComplete = checkStepCompletion(currentStep);

  if (isStepComplete) {
    currentStep.status = 'completed';
    currentStep.completedAt = new Date();

    // Advance to next step or complete workflow
    const result = advanceWorkflow(workflowId);
    await updateWorkflowInDb(workflow);
    return result;
  }

  await updateWorkflowInDb(workflow);

  // Step not complete yet, return current state
  return {
    workflowId,
    currentStep: currentStepIndex + 1,
    totalSteps: workflow.steps.length,
    nextSigners: currentStep.signers.filter(s => s.status === 'pending'),
    isComplete: false,
  };
}

/**
 * Record a signature rejection in the workflow
 */
export function recordRejection(
  workflowId: string,
  userId: string,
  rejectionReason: string
): void {
  const workflow = workflowStore.get(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const currentStepIndex = workflow.steps.findIndex(s => s.status === 'in_progress');
  if (currentStepIndex === -1) {
    throw new Error('No active step found');
  }

  const currentStep = workflow.steps[currentStepIndex];
  const signer = currentStep.signers.find(s => s.userId === userId);
  
  if (!signer) {
    throw new Error('User not found in current workflow step');
  }

  // Update signer status
  signer.status = 'rejected';
  signer.rejectionReason = rejectionReason;

  // If required signer rejects, workflow is rejected
  if (signer.required) {
    workflow.status = 'rejected';
    currentStep.status = 'completed';
  }

  void updateWorkflowInDb(workflow);
}

/**
 * Advance workflow to next step
 */
export function advanceWorkflow(workflowId: string): WorkflowAdvanceResult {
  const workflow = workflowStore.get(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const currentStepIndex = workflow.steps.findIndex(s => s.status === 'completed');
  const nextStepIndex = currentStepIndex + 1;

  // Check if workflow is complete
  if (nextStepIndex >= workflow.steps.length) {
    workflow.status = 'completed';
    workflow.completedAt = new Date();

    return {
      workflowId,
      currentStep: workflow.steps.length,
      totalSteps: workflow.steps.length,
      nextSigners: [],
      isComplete: true,
      completedAt: workflow.completedAt,
    };
  }

  // Start next step
  const nextStep = workflow.steps[nextStepIndex];
  nextStep.status = 'in_progress';
  nextStep.startedAt = new Date();

  void updateWorkflowInDb(workflow);

  return {
    workflowId,
    currentStep: nextStepIndex + 1,
    totalSteps: workflow.steps.length,
    nextSigners: nextStep.signers.filter(s => s.status === 'pending'),
    isComplete: false,
  };
}

/**
 * Check if workflow step is complete based on completion type
 */
function checkStepCompletion(step: WorkflowStep): boolean {
  const signedSigners = step.signers.filter(s => s.status === 'signed');
  const requiredSigners = step.signers.filter(s => s.required);
  const totalSigners = step.signers.length;

  switch (step.completionType) {
    case 'all_required':
      // All required signers must sign
      return requiredSigners.every(s => s.status === 'signed');

    case 'any_one':
      // At least one signer must sign
      return signedSigners.length >= 1;

    case 'majority':
      // More than half of signers must sign
      return signedSigners.length > totalSigners / 2;

    default:
      return false;
  }
}

// =====================================================================================
// WORKFLOW QUERIES
// =====================================================================================

/**
 * Get workflow by ID
 */
export function getWorkflow(workflowId: string): WorkflowDefinition | null {
  return workflowStore.get(workflowId) ?? null;
}

/**
 * Get workflows for document
 */
export function getDocumentWorkflows(documentId: string): WorkflowDefinition[] {
  return Array.from(workflowStore.values()).filter(w => w.documentId === documentId);
}

/**
 * Get workflows for user (where user is a signer)
 */
export function getUserWorkflows(
  userId: string,
  status?: WorkflowStatus
): WorkflowDefinition[] {
  return Array.from(workflowStore.values()).filter(workflow => {
    // Check if user is in any step
    const isUserInWorkflow = workflow.steps.some(step =>
      step.signers.some(signer => signer.userId === userId)
    );

    if (!isUserInWorkflow) {
      return false;
    }

    // Filter by status if provided
    if (status && workflow.status !== status) {
      return false;
    }

    return true;
  });
}

/**
 * Get pending workflows for user (where user needs to sign)
 */
export function getUserPendingWorkflows(userId: string): WorkflowDefinition[] {
  return Array.from(workflowStore.values()).filter(workflow => {
    if (workflow.status !== 'in_progress') {
      return false;
    }

    // Find current step
    const currentStep = workflow.steps.find(s => s.status === 'in_progress');
    if (!currentStep) {
      return false;
    }

    // Check if user is in current step and hasn't signed
    return currentStep.signers.some(
      signer => signer.userId === userId && signer.status === 'pending'
    );
  });
}

/**
 * Get workflow status summary
 */
export function getWorkflowStatus(workflowId: string): {
  workflowId: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  totalSignatures: number;
  completedSignatures: number;
  pendingSignatures: number;
} {
  const workflow = workflowStore.get(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
  const currentStepIndex = workflow.steps.findIndex(s => s.status === 'in_progress');

  let totalSignatures = 0;
  let completedSignatures = 0;
  let pendingSignatures = 0;

  workflow.steps.forEach(step => {
    step.signers.forEach(signer => {
      totalSignatures++;
      if (signer.status === 'signed') {
        completedSignatures++;
      } else if (signer.status === 'pending') {
        pendingSignatures++;
      }
    });
  });

  return {
    workflowId,
    status: workflow.status,
    currentStep: currentStepIndex === -1 ? completedSteps : currentStepIndex + 1,
    totalSteps: workflow.steps.length,
    completedSteps,
    totalSignatures,
    completedSignatures,
    pendingSignatures,
  };
}

// =====================================================================================
// WORKFLOW MANAGEMENT
// =====================================================================================

/**
 * Cancel workflow
 */
export function cancelWorkflow(
  workflowId: string,
  _cancelledBy: string,
  _cancellationReason: string
): void {
  const workflow = workflowStore.get(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  if (workflow.status === 'completed') {
    throw new Error('Cannot cancel completed workflow');
  }

  workflow.status = 'cancelled';
}

/**
 * Expire workflows past due date
 */
export function expireOverdueWorkflows(): number {
  const now = new Date();
  let expiredCount = 0;

  workflowStore.forEach(workflow => {
    if (workflow.status === 'in_progress' && workflow.expiresAt) {
      if (now > workflow.expiresAt) {
        workflow.status = 'expired';
        expiredCount++;
      }
    }
  });

  return expiredCount;
}

/**
 * Get next signers for workflow (for notifications)
 */
export function getNextSigners(workflowId: string): WorkflowSigner[] {
  const workflow = workflowStore.get(workflowId);
  if (!workflow || workflow.status !== 'in_progress') {
    return [];
  }

  const currentStep = workflow.steps.find(s => s.status === 'in_progress');
  if (!currentStep) {
    return [];
  }

  return currentStep.signers.filter(s => s.status === 'pending');
}

// =====================================================================================
// EXPORTS
// =====================================================================================

export const WorkflowEngine = {
  createWorkflow,
  startWorkflow,
  recordSignature,
  recordRejection,
  advanceWorkflow,
  getWorkflow,
  getDocumentWorkflows,
  getUserWorkflows,
  getUserPendingWorkflows,
  getWorkflowStatus,
  cancelWorkflow,
  expireOverdueWorkflows,
  getNextSigners,
};
