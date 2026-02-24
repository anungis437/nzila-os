// ============================================================================
// WORKFLOW AUTOMATION ENGINE
// ============================================================================
// Description: State machine for grievance workflow management with automatic
//              transitions, SLA tracking, approval chains, and notifications
// Created: 2025-12-06
// Updated: 2026-02-09 (PR #9: FSM integration for transition validation)
// ============================================================================

import { db } from "@/db/db";
import { eq, and, or, desc, asc, isNull, lte, gte, sql } from "drizzle-orm";
import { 
  validateClaimTransition, 
  type ClaimStatus,
  type ClaimPriority,
  type ClaimTransitionContext 
} from "@/lib/services/claim-workflow-fsm";
import {
  claims,
  claimUpdates,
  grievanceWorkflows,
  grievanceStages,
  grievanceTransitions,
  grievanceApprovals,
  grievanceAssignments,
  type GrievanceWorkflow,
  type GrievanceStage,
  type _InsertGrievanceTransition,
  type _GrievanceTransition,
  type _WorkflowStageConfig,
  type StageCondition,
  type StageAction,
} from "@/db/schema";
import { grievanceDeadlines } from "@/db/schema/domains/claims";
import { organizationMembers } from "@/db/schema/organization-members-schema";
import { getNotificationService } from "@/lib/services/notification-service";
import { logger } from "@/lib/logger";
import { generatePDF } from "@/lib/utils/pdf-generator";
import { generateExcel } from "@/lib/utils/excel-generator";
import DocumentStorageService from "@/lib/services/document-storage-service";
import {
  _sendGrievanceStageChangeNotification,
  _sendGrievanceAssignedNotification,
  _sendGrievanceResolvedNotification,
  _sendGrievanceEscalationNotification,
  _sendGrievanceDeadlineReminder,
} from "@/lib/services/grievance-notifications";

// ============================================================================
// TYPES
// ============================================================================

export type TransitionResult = {
  success: boolean;
  transitionId?: string;
  error?: string;
  requiresApproval?: boolean;
  nextStage?: GrievanceStage;
  actionsTriggered?: string[];
  fsmValidation?: {
    warnings?: string[];
    metadata?: {
      slaCompliant: boolean;
      daysInState: number;
      nextDeadline?: Date;
    };
  };
};

export type WorkflowStatus = {
  currentStage: GrievanceStage | null;
  workflow: GrievanceWorkflow | null;
  progress: number; // 0-100%
  stagesCompleted: number;
  totalStages: number;
  upcomingDeadlines: Array<{
    type: string;
    date: Date;
    daysRemaining: number;
  }>;
  isOverdue: boolean;
  daysInCurrentStage: number;
};

export type ApprovalRequest = {
  transitionId: string;
  claimId: string;
  fromStage: string;
  toStage: string;
  requestedBy: string;
  requestedAt: Date;
  reason?: string;
};

// ============================================================================
// STAGE TYPE TO FSM STATUS MAPPING (PR #9)
// ============================================================================

/**
 * Maps grievance stage types to FSM claim statuses for validation
 * This enables FSM enforcement on grievance workflows
 */
const STAGE_TYPE_TO_STATUS_MAP: Record<string, ClaimStatus> = {
  filed: 'submitted',
  intake: 'under_review',
  investigation: 'investigation',
  step_1: 'assigned',
  step_2: 'investigation',
  step_3: 'investigation',
  mediation: 'investigation',
  pre_arbitration: 'under_review',
  arbitration: 'investigation',
  resolved: 'resolved',
  withdrawn: 'rejected',
  denied: 'rejected',
  settled: 'closed',
};

/**
 * Get FSM status from grievance stage type
 */
function getStatusFromStageType(stageType: string): ClaimStatus {
  return STAGE_TYPE_TO_STATUS_MAP[stageType] || 'under_review';
}

/**
 * Map user ID to role level for FSM validation
 * Queries the organizationMembers table for the user's actual role
 */
async function getUserRole(userId: string, organizationId: string): Promise<string> {
  // System users have admin-level access
  if (userId === 'system') return 'system';
  
  try {
    // Query the user's role from organizationMembers table
    const result = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);
    
    if (result.length > 0) {
      return result[0].role;
    }
    
    // Default to 'member' if no role found
    return 'member';
  } catch (error) {
    logger.error("Error fetching user role", { error });
    return 'member';
  }
}

/**
 * Check for unresolved critical signals on a claim
 * Returns true if there are any critical signals that need attention
 */
async function checkForUnresolvedCriticalSignals(claimId: string): Promise<boolean> {
  try {
    // Query for recent signal recomputation updates
    const recentSignalUpdates = await db
      .select()
      .from(claimUpdates)
      .where(
        and(
          eq(claimUpdates.claimId, claimId),
          eq(claimUpdates.updateType, 'signal_recompute')
        )
      )
      .orderBy(desc(claimUpdates.createdAt))
      .limit(1);

    if (!recentSignalUpdates.length) {
      return false; // No signal data available
    }

    const latestSignalData = recentSignalUpdates[0];
    const metadata = latestSignalData.metadata as unknown;

    // Check for critical signals in the metadata
    if (metadata?.criticalCount && metadata.criticalCount > 0) {
      logger.info(`Found ${metadata.criticalCount} unresolved critical signal(s) for claim ${claimId}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`Error checking for critical signals on claim ${claimId}:`, { error });
    return false; // Don&apos;t block transitions on signal check errors
  }
}

/**
 * Check if a claim is overdue based on SLA deadlines
 */
async function checkClaimOverdue(claimId: string): Promise<boolean> {
  try {
    const now = new Date();
    
    // Query unmet deadlines for this claim
    const overdueDeadlines = await db
      .select({ id: grievanceDeadlines.id })
      .from(grievanceDeadlines)
      .where(
        and(
          eq(grievanceDeadlines.claimId, claimId),
          isNull(grievanceDeadlines.isMet),
          lte(grievanceDeadlines.deadlineDate, now.toISOString().split('T')[0])
        )
      )
      .limit(1);
    
    return overdueDeadlines.length > 0;
  } catch (error) {
    logger.error("Error checking claim overdue status", { error });
    return false;
  }
}

// ============================================================================
// WORKFLOW INITIALIZATION
// ============================================================================

/**
 * Initialize workflow for a new grievance/claim
 */
export async function initializeWorkflow(
  claimId: string,
  grievanceType: string,
  organizationId: string,
  userId: string
): Promise<{ success: boolean; workflowId?: string; error?: string }> {
  try {
    // Find appropriate workflow for this grievance type
    const workflow = await db.query.grievanceWorkflows.findFirst({
      where: and(
        eq(grievanceWorkflows.organizationId, organizationId),
        eq(grievanceWorkflows.grievanceType, grievanceType),
        eq(grievanceWorkflows.status, "active")
      ),
      with: {
        stages: {
          orderBy: [asc(grievanceStages.orderIndex)],
        },
      },
    });

    if (!workflow) {
      // Try to find default workflow
      const defaultWorkflow = await db.query.grievanceWorkflows.findFirst({
        where: and(
          eq(grievanceWorkflows.organizationId, organizationId),
          eq(grievanceWorkflows.isDefault, true),
          eq(grievanceWorkflows.status, "active")
        ),
        with: {
          stages: {
            orderBy: [asc(grievanceStages.orderIndex)],
          },
        },
      });

      if (!defaultWorkflow) {
        return { success: false, error: "No workflow found for grievance type" };
      }

      // Use default workflow
      return await startWorkflow(claimId, defaultWorkflow.id, organizationId, userId);
    }

    return await startWorkflow(claimId, workflow.id, organizationId, userId);
  } catch (error) {
    logger.error("Error initializing workflow", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Start workflow by transitioning to first stage
 */
async function startWorkflow(
  claimId: string,
  workflowId: string,
  organizationId: string,
  userId: string
): Promise<{ success: boolean; workflowId?: string; error?: string }> {
  try {
    // Get first stage of workflow
    const firstStage = await db.query.grievanceStages.findFirst({
      where: and(
        eq(grievanceStages.workflowId, workflowId),
        eq(grievanceStages.orderIndex, 0)
      ),
    });

    if (!firstStage) {
      return { success: false, error: "No stages defined in workflow" };
    }

    // Create initial transition to first stage
    const [_transition] = await db
      .insert(grievanceTransitions)
      .values({
        organizationId,
        claimId,
        fromStageId: null, // No previous stage
        toStageId: firstStage.id,
        triggerType: "manual",
        reason: "Workflow initialization",
        transitionedBy: userId,
        transitionedAt: new Date(),
      })
      .returning();

    // Execute entry actions for first stage
    await executeStageActions(firstStage.entryActions as StageAction[], claimId, organizationId, userId);

    // Create SLA deadline if defined
    if (firstStage.slaDays) {
      await createStageDeadline(claimId, firstStage.id, firstStage.slaDays, organizationId);
    }

    // Send notifications if configured
    if (firstStage.notifyOnEntry) {
      await sendStageNotification(claimId, firstStage, "entered", organizationId);
    }

    return { success: true, workflowId };
  } catch (error) {
    logger.error("Error starting workflow", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// STAGE TRANSITIONS
// ============================================================================

/**
 * Transition grievance to next stage (manual or automatic)
 */
export async function transitionToStage(
  claimId: string,
  toStageId: string,
  organizationId: string,
  userId: string,
  options: {
    reason?: string;
    notes?: string;
    requiresApproval?: boolean;
    triggerType?: "manual" | "automatic" | "deadline" | "approval";
    priority?: ClaimPriority;
  } = {}
): Promise<TransitionResult> {
  try {
    // Get current stage
    const currentTransition = await db.query.grievanceTransitions.findFirst({
      where: eq(grievanceTransitions.claimId, claimId),
      orderBy: [desc(grievanceTransitions.transitionedAt)],
      with: {
        fromStage: true,
        toStage: true,
      },
    });

    const currentStageId = currentTransition?.toStageId;

    // Get current stage details (for FSM validation)
    let currentStage: GrievanceStage | undefined;
    if (currentStageId) {
      currentStage = await db.query.grievanceStages.findFirst({
        where: eq(grievanceStages.id, currentStageId),
      });
    }

    // Get target stage details
    const toStage = await db.query.grievanceStages.findFirst({
      where: eq(grievanceStages.id, toStageId),
    });

    if (!toStage) {
      return { success: false, error: "Target stage not found" };
    }

    // ========================================================================
    // PR #9: FSM VALIDATION (Enforce state machine rules)
    // ========================================================================

    // Get claim details for FSM validation
    const claim = await db.query.claims.findFirst({
      where: eq(claims.claimId, claimId),
    });

    if (!claim) {
      return { success: false, error: "Claim not found" };
    }

    // Map stage types to FSM statuses
    const currentStatus = currentStage 
      ? getStatusFromStageType(currentStage.stageType)
      : 'submitted';
    const targetStatus = getStatusFromStageType(toStage.stageType);

    // Get user role for permission check
    const userRole = await getUserRole(userId, organizationId);

    // Check if claim has required documentation
    const hasRequiredDocumentation = options.notes ? options.notes.length > 0 : false;

    // Check for unresolved critical signals (integrate with LRO signals)
    const hasUnresolvedCriticalSignals = await checkForUnresolvedCriticalSignals(claimId);

    // Calculate if claim is overdue based on SLA deadlines
    const isOverdue = await checkClaimOverdue(claimId);

    // Build FSM validation context
    const fsmContext: ClaimTransitionContext = {
      claimId,
      currentStatus,
      targetStatus,
      userId,
      userRole,
      priority: (options.priority || claim.priority || 'medium') as ClaimPriority,
      statusChangedAt: currentTransition?.transitionedAt || claim.createdAt || new Date(),
      hasUnresolvedCriticalSignals,
      hasRequiredDocumentation,
      isOverdue,
      notes: options.notes,
    };

    // Validate transition with FSM
    const fsmValidation = validateClaimTransition(fsmContext);

    if (!fsmValidation.allowed) {
      return {
        success: false,
        error: `FSM Validation Failed: ${fsmValidation.reason}`,
        requiresApproval: false,
        fsmValidation: {
          warnings: fsmValidation.requiredActions,
        },
      };
    }

    // Log FSM warnings (if any) but allow transition
    if (fsmValidation.warnings && fsmValidation.warnings.length > 0) {
      logger.warn('FSM warnings for transition', { warnings: fsmValidation.warnings });
    }

    // ========================================================================

    // Check if approval required
    if (toStage.requireApproval && !options.requiresApproval) {
      // Create pending transition requiring approval
      const [pendingTransition] = await db
        .insert(grievanceTransitions)
        .values({
          organizationId,
          claimId,
          fromStageId: currentStageId || null,
          toStageId,
          triggerType: options.triggerType || "manual",
          reason: options.reason,
          notes: options.notes,
          transitionedBy: userId,
          requiresApproval: true,
        })
        .returning();

      return {
        success: true,
        transitionId: pendingTransition.id,
        requiresApproval: true,
        nextStage: toStage,
      };
    }

    // Execute exit actions for current stage
    if (currentStageId) {
      const currentStage = await db.query.grievanceStages.findFirst({
        where: eq(grievanceStages.id, currentStageId),
      });
      
      if (currentStage) {
        await executeStageActions(
          currentStage.exitActions as StageAction[],
          claimId,
          organizationId,
          userId
        );
      }
    }

    // Create transition record
    const [transition] = await db
      .insert(grievanceTransitions)
      .values({
        organizationId,
        claimId,
        fromStageId: currentStageId || null,
        toStageId,
        triggerType: options.triggerType || "manual",
        reason: options.reason,
        notes: options.notes,
        transitionedBy: userId,
        transitionedAt: new Date(),
        requiresApproval: false,
      })
      .returning();

    // Execute entry actions for new stage
    const actionsTriggered = await executeStageActions(
      toStage.entryActions as StageAction[],
      claimId,
      organizationId,
      userId
    );

    // Create SLA deadline if defined
    if (toStage.slaDays) {
      await createStageDeadline(claimId, toStage.id, toStage.slaDays, organizationId);
    }

    // Send notifications
    if (toStage.notifyOnEntry) {
      await sendStageNotification(claimId, toStage, "entered", organizationId);
    }

    // Update claim progress
    await updateClaimProgress(claimId, organizationId);

    // Check if auto-transition to next stage is configured
    if (toStage.autoTransition && toStage.nextStageId) {
      // Schedule auto-transition (could be delayed or conditional)
      await scheduleAutoTransition(claimId, toStage.id, toStage.nextStageId, organizationId);
    }

    return {
      success: true,
      transitionId: transition.id,
      nextStage: toStage,
      actionsTriggered,
      fsmValidation: {
        warnings: fsmValidation.warnings,
        metadata: fsmValidation.metadata,
      },
    };
  } catch (error) {
    logger.error("Error transitioning stage", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Approve pending transition
 */
export async function approveTransition(
  transitionId: string,
  organizationId: string,
  approverId: string
): Promise<TransitionResult> {
  try {
    // Get pending transition
    const transition = await db.query.grievanceTransitions.findFirst({
      where: and(
        eq(grievanceTransitions.id, transitionId),
        eq(grievanceTransitions.organizationId, organizationId),
        eq(grievanceTransitions.requiresApproval, true),
        isNull(grievanceTransitions.approvedBy)
      ),
    });

    if (!transition) {
      return { success: false, error: "Pending transition not found" };
    }

    // PR #10: Create append-only approval record (immutable transition history)
    await db.insert(grievanceApprovals).values({
      organizationId,
      transitionId: transitionId,
      approverUserId: approverId,
      action: 'approved',
      reviewedAt: new Date(),
      metadata: { originalTransition: transition },
    });

    // Mark transition as no longer requiring approval
    await db
      .update(grievanceTransitions)
      .set({ requiresApproval: false })
      .where(eq(grievanceTransitions.id, transitionId));

    // Execute the transition
    return await transitionToStage(
      transition.claimId,
      transition.toStageId,
      organizationId,
      approverId,
      {
        reason: transition.reason || undefined,
        notes: transition.notes || undefined,
        requiresApproval: true, // Skip approval check since already approved
        triggerType: "approval",
      }
    );
  } catch (error) {
    logger.error("Error approving transition", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reject pending transition
 */
export async function rejectTransition(
  transitionId: string,
  organizationId: string,
  rejectorId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // PR #10: Create append-only rejection record (immutable transition history)
    await db.insert(grievanceApprovals).values({
      organizationId,
      transitionId: transitionId,
      approverUserId: rejectorId,
      action: 'rejected',
      rejectionReason: reason,
      reviewedAt: new Date(),
      metadata: {},
    });

    // Mark transition as no longer requiring approval and append rejection note
    await db
      .update(grievanceTransitions)
      .set({
        requiresApproval: false,
        notes: sql`${grievanceTransitions.notes} || ' | Rejected: ' || ${reason}`,
        metadata: sql`jsonb_set(${grievanceTransitions.metadata}, '{rejected}', 'true'::jsonb)`,
      })
      .where(eq(grievanceTransitions.id, transitionId));

    // Send rejection notification
    const transition = await db.query.grievanceTransitions.findFirst({
      where: eq(grievanceTransitions.id, transitionId),
    });

    if (transition) {
      await sendTransitionRejectedNotification(
        transition.claimId,
        transition.transitionedBy,
        reason,
        organizationId
      );
    }

    return { success: true };
  } catch (error) {
    logger.error("Error rejecting transition", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// WORKFLOW STATUS & PROGRESS
// ============================================================================

/**
 * Get current workflow status for a grievance
 */
export async function getWorkflowStatus(
  claimId: string,
  organizationId: string
): Promise<WorkflowStatus | null> {
  try {
    // Get claim details
    const claim = await db.query.claims.findFirst({
      where: and(eq(claims.claimId, claimId), eq(claims.organizationId, organizationId)),
    });

    if (!claim) return null;

    // Get current transition
    const currentTransition = await db.query.grievanceTransitions.findFirst({
      where: eq(grievanceTransitions.claimId, claimId),
      orderBy: [desc(grievanceTransitions.transitionedAt)],
      with: {
        toStage: {
          with: {
            workflow: true,
          },
        },
      },
    });

    if (!currentTransition || !currentTransition.toStage) {
      return {
        currentStage: null,
        workflow: null,
        progress: 0,
        stagesCompleted: 0,
        totalStages: 0,
        upcomingDeadlines: [],
        isOverdue: false,
        daysInCurrentStage: 0,
      };
    }

    const currentStage = currentTransition.toStage;
    const workflow = currentTransition.toStage.workflow;

    // Get all stages in workflow
    const allStages = await db.query.grievanceStages.findMany({
      where: eq(grievanceStages.workflowId, workflow!.id),
      orderBy: [asc(grievanceStages.orderIndex)],
    });

    // Count completed stages
    const completedStages = allStages.filter(
      (stage) => stage.orderIndex < currentStage.orderIndex
    ).length;

    // Calculate progress percentage
    const progress = Math.round((completedStages / allStages.length) * 100);

    // Get upcoming deadlines
    const deadlines = await db
      .select()
      .from(grievanceDeadlines)
      .where(
        and(
          eq(grievanceDeadlines.claimId, claimId),
          isNull(grievanceDeadlines.isMet)
        )
      )
      .orderBy(asc(grievanceDeadlines.deadlineDate));

    const upcomingDeadlines = deadlines.map((deadline) => {
      const deadlineDate = deadline.deadlineDate || new Date();
      const daysRemaining = Math.ceil(
        (new Date(deadlineDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return {
        type: deadline.deadlineType,
        date: new Date(deadlineDate),
        daysRemaining,
      };
    });

    // Check if any deadlines are overdue
    const isOverdue = upcomingDeadlines.some((d) => d.daysRemaining < 0);

    // Calculate days in current stage
    const transitionDate = currentTransition.transitionedAt || new Date();
    const daysInCurrentStage = Math.floor(
      (new Date().getTime() - new Date(transitionDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      currentStage,
      workflow,
      progress,
      stagesCompleted: completedStages,
      totalStages: allStages.length,
      upcomingDeadlines,
      isOverdue,
      daysInCurrentStage,
    };
  } catch (error) {
    logger.error("Error getting workflow status", { error });
    return null;
  }
}

/**
 * Update claim progress based on workflow completion
 */
async function updateClaimProgress(claimId: string, organizationId: string): Promise<void> {
  try {
    const status = await getWorkflowStatus(claimId, organizationId);
    if (status) {
      await db
        .update(claims)
        .set({ progress: status.progress })
        .where(eq(claims.claimId, claimId));
    }
  } catch (error) {
    logger.error("Error updating claim progress", { error });
  }
}

// ============================================================================
// STAGE ACTIONS & AUTOMATION
// ============================================================================

/**
 * Execute actions configured for stage entry/exit
 */
async function executeStageActions(
  actions: StageAction[],
  claimId: string,
  organizationId: string,
  userId: string
): Promise<string[]> {
  const executedActions: string[] = [];

  for (const action of actions) {
    try {
      switch (action.action_type) {
        case "notify":
          await sendActionNotification(claimId, action.action_config, organizationId);
          executedActions.push(`notify:${action.action_config.recipient || "all"}`);
          break;

        case "assign":
          await autoAssignOfficer(
            claimId,
            action.action_config.role,
            action.action_config.criteria,
            organizationId,
            userId
          );
          executedActions.push(`assign:${action.action_config.role}`);
          break;

        case "create_deadline":
          await createActionDeadline(
            claimId,
            action.action_config.type,
            action.action_config.days,
            organizationId
          );
          executedActions.push(`deadline:${action.action_config.type}`);
          break;

        case "send_email":
          await sendActionEmail(claimId, action.action_config, organizationId);
          executedActions.push(`email:${action.action_config.template}`);
          break;

        case "create_document":
          await generateActionDocument(claimId, action.action_config, organizationId, userId);
          executedActions.push(`document:${action.action_config.template}`);
          break;

        default:
          logger.warn(`Unknown action type: ${action.action_type}`);
      }
    } catch (error) {
      logger.error(`Error executing action ${action.action_type}`, { error });
    }
  }

  return executedActions;
}

/**
 * Schedule automatic transition based on conditions
 */
async function scheduleAutoTransition(
  claimId: string,
  currentStageId: string,
  nextStageId: string,
  organizationId: string
): Promise<void> {
  // Get stage conditions
  const stage = await db.query.grievanceStages.findFirst({
    where: eq(grievanceStages.id, currentStageId),
  });

  if (!stage) return;

  const conditions = stage.conditions as StageCondition[];

  // Check if conditions are met
  const conditionsMet = await evaluateConditions(claimId, conditions, organizationId);

  if (conditionsMet) {
    // Execute transition
    await transitionToStage(claimId, nextStageId, organizationId, "system", {
      triggerType: "automatic",
      reason: "Auto-transition conditions met",
    });
  }
}

/**
 * Evaluate transition conditions
 */
async function evaluateConditions(
  claimId: string,
  conditions: StageCondition[],
  organizationId: string
): Promise<boolean> {
  if (conditions.length === 0) return true;

  // Get claim data
  const claim = await db.query.claims.findFirst({
    where: and(eq(claims.claimId, claimId), eq(claims.organizationId, organizationId)),
  });

  if (!claim) return false;

  // PR #14: Type-safe field access with proper validation
  const getClaimField = (fieldName: string): unknown => {
    // Runtime check for valid claim fields
    if (fieldName in claim) {
      return (claim as Record<string, unknown>)[fieldName];
    }
    logger.warn(`Invalid field name: ${fieldName}`, { fieldName });
    return undefined;
  };

  // Evaluate each condition
  for (const condition of conditions) {
    const fieldValue = getClaimField(condition.field);

    switch (condition.operator) {
      case "equals":
        if (fieldValue !== condition.value) return false;
        break;
      case "not_equals":
        if (fieldValue === condition.value) return false;
        break;
      case "greater_than": {
        const fieldNumber = Number(fieldValue);
        const compareNumber = Number(condition.value);
        if (Number.isNaN(fieldNumber) || Number.isNaN(compareNumber) || fieldNumber <= compareNumber) {
          return false;
        }
        break;
      }
      case "less_than": {
        const fieldNumber = Number(fieldValue);
        const compareNumber = Number(condition.value);
        if (Number.isNaN(fieldNumber) || Number.isNaN(compareNumber) || fieldNumber >= compareNumber) {
          return false;
        }
        break;
      }
      case "contains":
        if (!String(fieldValue).includes(condition.value)) return false;
        break;
    }
  }

  return true;
}

// ============================================================================
// HELPER FUNCTIONS (Stubs - to be implemented)
// ============================================================================

async function createStageDeadline(
  claimId: string,
  stageId: string,
  days: number,
  organizationId: string
): Promise<void> {
  await db.insert(grievanceDeadlines).values({
    organizationId,
    claimId,
    stageId,
    deadlineType: "stage_completion",
    deadlineDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    calculatedFrom: "stage_entry",
    daysFromSource: days,
  });
}

async function sendStageNotification(
  claimId: string,
  stage: GrievanceStage,
  action: string,
  organizationId: string
): Promise<void> {
  try {
    // Get claim details
    const claim = await db.query.claims.findFirst({
      where: eq(claims.claimId, claimId),
    });

    if (!claim) {
      logger.warn(`Cannot send stage notification: claim ${claimId} not found`);
      return;
    }

    // Get assignments for this claim
    const assignments = await db.query.grievanceAssignments.findMany({
      where: and(
        eq(grievanceAssignments.claimId, claimId),
        or(
          eq(grievanceAssignments.status, 'assigned'),
          eq(grievanceAssignments.status, 'in_progress')
        )
      ),
    });

    const notificationService = getNotificationService();

    // Notify assigned officers
    for (const assignment of assignments) {
      await notificationService.send({
        organizationId,
        recipientId: assignment.assignedTo,
        type: 'email',
        priority: 'normal',
        title: `Grievance Stage ${action}`,
        body: `Claim ${claim.claimNumber} has ${action} stage: ${stage.name}`,
        actionUrl: `/grievances/${claimId}`,
        actionLabel: 'View Claim',
        metadata: {
          type: 'grievance_stage_notification',
          claimId,
          stageId: stage.id,
        },
        userId: assignment.assignedBy,
      });
    }

    logger.info(`Stage notification sent for claim ${claimId}`);
  } catch (error) {
    logger.error(`Failed to send stage notification for claim ${claimId}`, { error });
  }
}

async function sendActionNotification(
  claimId: string,
  config: Record<string, unknown>,
  organizationId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();
    
    const recipientId = config.recipient || config.recipientId;
    const recipientEmail = config.recipientEmail;
    
    if (!recipientId && !recipientEmail) {
      logger.warn(`No recipient specified for action notification on claim ${claimId}`);
      return;
    }

    await notificationService.send({
      organizationId,
      recipientId: recipientId,
      recipientEmail: recipientEmail,
      type: config.notificationType || 'email',
      priority: config.priority || 'normal',
      title: config.title || 'Grievance Action Notification',
      body: config.message || 'An action has been triggered on a grievance',
      actionUrl: config.actionUrl || `/grievances/${claimId}`,
      actionLabel: config.actionLabel || 'View Details',
      metadata: {
        type: 'grievance_action_notification',
        claimId,
      },
      userId: config.userId || 'system',
    });

    logger.info(`Action notification sent for claim ${claimId}`);
  } catch (error) {
    logger.error(`Failed to send action notification for claim ${claimId}`, { error });
  }
}

async function autoAssignOfficer(
  claimId: string,
  role: string,
  criteria: Record<string, unknown>,
  organizationId: string,
  userId: string
): Promise<void> {
  try {
    // Import the assignment engine
    const { autoAssignGrievance } = await import('@/lib/case-assignment-engine');
    
    // Map criteria to AssignmentCriteria type
    const assignmentCriteria = {
      claimType: criteria.claimType,
      priority: criteria.priority,
      department: criteria.department,
      location: criteria.location,
      complexity: criteria.complexity,
      estimatedHours: criteria.estimatedHours,
      requiresLegal: criteria.requiresLegal,
      requiresArbitration: criteria.requiresArbitration,
    };
    
    // Attempt automatic assignment with intelligent matching
    const result = await autoAssignGrievance(
      claimId,
      organizationId,
      assignmentCriteria,
      userId,
      {
        role: role as unknown,
        forceAssignment: criteria.forceAssignment || false,
        minScore: criteria.minScore || 0.5,
      }
    );
    
    if (result.success) {
      logger.info(
        `Auto-assigned claim ${claimId} to officer ${result.assignedTo} with role ${result.role}`
      );
    } else {
      logger.warn(
        `Failed to auto-assign claim ${claimId}: ${result.error}. Recommendations available: ${result.recommendations?.length || 0}`
      );
    }
  } catch (error) {
    logger.error(`Error in autoAssignOfficer for claim ${claimId}:`, { error });
    throw error;
  }
}

async function createActionDeadline(
  claimId: string,
  type: string,
  days: number,
  organizationId: string
): Promise<void> {
  await db.insert(grievanceDeadlines).values({
    organizationId,
    claimId,
    deadlineType: type,
    deadlineDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    calculatedFrom: "action_triggered",
    daysFromSource: days,
  });
}

async function sendActionEmail(
  claimId: string,
  config: Record<string, unknown>,
  organizationId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();
    
    const recipientEmail = config.recipientEmail || config.recipient;
    if (!recipientEmail) {
      logger.warn(`No recipient email specified for action email on claim ${claimId}`);
      return;
    }

    await notificationService.send({
      organizationId,
      recipientEmail: recipientEmail,
      type: 'email',
      priority: config.priority || 'normal',
      subject: config.subject || 'Grievance Update',
      title: config.title || 'Grievance Update',
      body: config.body || config.message || 'You have a new grievance update',
      htmlBody: config.htmlBody,
      actionUrl: config.actionUrl,
      actionLabel: config.actionLabel,
      metadata: {
        type: 'grievance_action_email',
        claimId,
      },
      userId: config.userId || 'system',
    });

    logger.info(`Action email sent for claim ${claimId}`);
  } catch (error) {
    logger.error(`Failed to send action email for claim ${claimId}`, { error });
  }
}

async function generateActionDocument(
  claimId: string,
  config: Record<string, unknown>,
  organizationId: string,
  userId: string
): Promise<void> {
  // Document generation can use the PDF/Excel generators we created
  try {
    const documentType = config.documentType || 'pdf';
    const templateType = config.template || 'generic';
    const documentName = config.documentName || `claim-${claimId}-${Date.now()}.${documentType === 'excel' ? 'xlsx' : 'pdf'}`;
    const payload = config.data || {
      claimId,
      template: templateType,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
    };
    
    logger.info(`Generating ${documentType} document for claim ${claimId} using template ${templateType}`);
    
    const fileBuffer = documentType === 'excel'
      ? await generateExcel({
          title: config.title || `Claim ${claimId} Document`,
          data: Object.entries(payload).map(([field, value]) => ({ field, value })),
          columns: [
            { header: 'Field', key: 'field', width: 30 },
            { header: 'Value', key: 'value', width: 50 },
          ],
          sheetName: config.sheetName || 'Claim Document',
        })
      : await generatePDF({
          title: config.title || `Claim ${claimId} Document`,
          data: payload,
          template: config.template,
          metadata: {
            author: 'UnionEyes Workflow Automation',
            subject: `Claim ${claimId} Document`,
          },
        });

    const storageService = new DocumentStorageService();
    const uploadResult = await storageService.uploadDocument({
      organizationId,
      documentName,
      documentBuffer: fileBuffer,
      documentType: 'workflow_document',
      contentType: documentType === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf',
      metadata: {
        claimId,
        template: templateType,
        generatedBy: userId,
      },
    });

    logger.info(`Document generated and stored for claim ${claimId}`, {
      url: uploadResult.url,
      key: uploadResult.key,
    });
  } catch (error) {
    logger.error(`Failed to generate document for claim ${claimId}`, { error });
  }
}

async function sendTransitionRejectedNotification(
  claimId: string,
  requesterId: string,
  reason: string,
  organizationId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();
    
    await notificationService.send({
      organizationId,
      recipientId: requesterId,
      type: 'email',
      priority: 'high',
      title: 'Stage Transition Rejected',
      body: `Your request to transition claim ${claimId} was rejected. Reason: ${reason}`,
      actionUrl: `/grievances/${claimId}`,
      actionLabel: 'View Claim',
      metadata: {
        type: 'grievance_transition_rejected',
        claimId,
        reason,
      },
      userId: 'system',
    });

    logger.info(`Transition rejected notification sent for claim ${claimId}`);
  } catch (error) {
    logger.error(`Failed to send transition rejected notification for claim ${claimId}`, { error });
  }
}

// ============================================================================
// SCHEDULED JOBS
// ============================================================================

/**
 * Process overdue deadlines and trigger escalations
 * Should be run as a cron job every hour
 */
export async function processOverdueDeadlines(): Promise<void> {
  try {
    const overdueDeadlines = await db
      .select()
      .from(grievanceDeadlines)
      .where(
        and(
          isNull(grievanceDeadlines.isMet),
          lte(grievanceDeadlines.deadlineDate, new Date().toISOString().split("T")[0]),
          eq(grievanceDeadlines.escalateOnMiss, true),
          isNull(grievanceDeadlines.escalatedAt)
        )
      );

    for (const deadline of overdueDeadlines) {
      // Mark as escalated
      await db
        .update(grievanceDeadlines)
        .set({ escalatedAt: new Date() })
        .where(eq(grievanceDeadlines.id, deadline.id));

      // Send escalation notification
      if (deadline.escalateTo) {
        try {
          const notificationService = getNotificationService();
          await notificationService.send({
            organizationId: deadline.organizationId,
            recipientId: deadline.escalateTo,
            type: 'email',
            priority: 'urgent',
            title: 'ESCALATION: Overdue Deadline',
            body: `Deadline "${deadline.deadlineType}" for claim ${deadline.claimId} is overdue and has been escalated to you.`,
            actionUrl: `/grievances/${deadline.claimId}`,
            actionLabel: 'Review Claim',
            metadata: {
              type: 'grievance_deadline_escalation',
              deadlineId: deadline.id,
              claimId: deadline.claimId,
            },
            userId: 'system',
          });
          logger.info(`Escalation notification sent for overdue deadline ${deadline.id}`);
        } catch (error) {
          logger.error(`Failed to send escalation notification for deadline ${deadline.id}`, { error });
        }
      }
    }
  } catch (error) {
    logger.error("Error processing overdue deadlines", { error });
  }
}

/**
 * Send deadline reminders
 * Should be run as a cron job daily
 */
export async function sendDeadlineReminders(): Promise<void> {
  try {
    const allDeadlines = await db
      .select()
      .from(grievanceDeadlines)
      .where(
        and(
          isNull(grievanceDeadlines.isMet),
          gte(grievanceDeadlines.deadlineDate, new Date().toISOString().split("T")[0])
        )
      );

    for (const deadline of allDeadlines) {
      const deadlineDate = deadline.deadlineDate || new Date();
      const daysUntilDeadline = Math.ceil(
        (new Date(deadlineDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Check if reminder should be sent
      if (deadline.reminderDays?.includes(daysUntilDeadline)) {
        try {
          // Get claim details for notification context
          const claim = await db.query.claims.findFirst({
            where: eq(claims.claimId, deadline.claimId),
          });

          if (claim && deadline.assignedTo) {
            const assignees = Array.isArray(deadline.assignedTo) 
              ? deadline.assignedTo 
              : [deadline.assignedTo];

            const notificationService = getNotificationService();
            for (const assignee of assignees) {
              await notificationService.send({
                organizationId: deadline.organizationId,
                recipientEmail: assignee,
                type: 'email',
                priority: daysUntilDeadline <= 1 ? 'urgent' : 'high',
                title: `Deadline Reminder: ${daysUntilDeadline} Day(s) Remaining`,
                body: `Reminder: Deadline "${deadline.deadlineType}" for claim ${claim.claimNumber} is due in ${daysUntilDeadline} day(s).`,
                actionUrl: `/grievances/${deadline.claimId}`,
                actionLabel: 'View Claim',
                metadata: {
                  type: 'grievance_deadline_reminder',
                  deadlineId: deadline.id,
                  claimId: deadline.claimId,
                  daysRemaining: daysUntilDeadline,
                },
                userId: 'system',
              });
            }
            logger.info(`Reminder sent for deadline ${deadline.id}, ${daysUntilDeadline} days remaining`);
          }
        } catch (error) {
          logger.error(`Failed to send reminder for deadline ${deadline.id}`, { error });
        }

        // Update last reminder sent timestamp
        await db
          .update(grievanceDeadlines)
          .set({ lastReminderSentAt: new Date() })
          .where(eq(grievanceDeadlines.id, deadline.id));
      }
    }
  } catch (error) {
    logger.error("Error sending deadline reminders", { error });
  }
}

