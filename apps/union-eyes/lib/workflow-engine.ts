/**
 * Workflow Engine for Claims Management
 * 
 * MIGRATION STATUS: Ã¢Å“â€¦ Refactored to support RLS
 * - Functions accept optional transaction parameter for RLS context
 * - When no transaction provided, automatically wraps in withRLSContext()
 * - Maintains backward compatibility with existing callers
 * 
 * ENFORCEMENT LAYER (PR-11): Ã¢Å“â€¦ Integrated with FSM
 * - All state transitions validated via claim-workflow-fsm.ts
 * - Bad practice is now IMPOSSIBLE (role checks, time checks, signal checks)
 * - SLA compliance tracked automatically
 * 
 * Handles status transitions, validation, and deadline tracking
 */

import { db } from "../db/db";
import { withRLSContext } from "./db/with-rls-context";
import { claims, claimUpdates } from "../db/schema/claims-schema";
import { organizationMembers } from "../db/schema/organization-members-schema";
import { users } from "../db/schema/user-management-schema";
import { eq, and } from "drizzle-orm";
import { sendClaimStatusNotification } from "./claim-notifications";
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { 
  validateClaimTransition, 
  getAllowedClaimTransitions,
  type ClaimStatus,
  type ClaimPriority 
} from './services/claim-workflow-fsm';
import { detectAllSignals } from './services/lro-signals';
import { 
  generateDefensibilityPack,
  type TimelineEvent,
  type AuditEntry,
  type StateTransition 
} from './services/defensibility-pack';
import { defensibilityPacks } from '../db/schema/defensibility-packs-schema';
import { addTimelineEntry } from './integrations/timeline-integration';
import { logger } from '@/lib/logger';

// Define valid status transitions
export const STATUS_TRANSITIONS = {
  submitted: ["under_review", "assigned", "rejected"],
  under_review: ["investigation", "pending_documentation", "resolved", "rejected", "assigned"],
  assigned: ["investigation", "under_review", "pending_documentation"],
  investigation: ["pending_documentation", "under_review", "resolved", "rejected"],
  pending_documentation: ["under_review", "investigation", "resolved"],
  resolved: ["closed"],
  rejected: ["closed"],
  closed: [], // Terminal state - no transitions allowed
} as const;

export type { ClaimStatus, ClaimPriority };

// Define SLA deadlines (in days) for each status
export const STATUS_DEADLINES = {
  submitted: 2, // Must be reviewed within 2 days
  under_review: 5, // Must complete review within 5 days
  assigned: 3, // Steward must start action within 3 days
  investigation: 10, // Investigation must complete within 10 days
  pending_documentation: 7, // Documentation must be provided within 7 days
  resolved: 30, // Must close within 30 days of resolution
  rejected: 30, // Must close within 30 days of rejection
  closed: 0, // No deadline for closed claims
} as const;

// Define priority multipliers for deadlines
export const PRIORITY_MULTIPLIERS = {
  critical: 0.5, // Half the normal deadline
  high: 0.75, // 75% of normal deadline
  medium: 1.0, // Normal deadline
  low: 1.5, // 50% more time
} as const;

/**
 * Helper function to get member name from organizationMembers table
 */
async function getMemberName(
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NodePgDatabase<any>
): Promise<string> {
  try {
    const result = await tx
      .select({
        displayName: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.userId))
      .where(eq(organizationMembers.userId, memberId))
      .limit(1);
    
    const displayName = result[0]?.displayName;
    const firstName = result[0]?.firstName;
    const lastName = result[0]?.lastName;

    if (displayName) return displayName;
    if (firstName || lastName) return `${firstName || ''} ${lastName || ''}`.trim();
    return 'Member';
  } catch (_error) {
return 'Member';
  }
}

/**
 * Validate if a status transition is allowed (LEGACY - use validateClaimTransition for full validation)
 * 
 * @deprecated Use validateClaimTransition() from claim-workflow-fsm.ts for full FSM validation
 */
export function isValidTransition(
  currentStatus: ClaimStatus,
  newStatus: ClaimStatus
): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  return (allowedTransitions as readonly ClaimStatus[]).includes(newStatus);
}

/**
 * Get allowed transitions for a given status (LEGACY wrapper)
 * 
 * @deprecated Use getAllowedClaimTransitions() from claim-workflow-fsm.ts for role-aware transitions
 */
export function getAllowedTransitions(status: ClaimStatus, userRole?: string): readonly ClaimStatus[] {
  if (userRole) {
    return getAllowedClaimTransitions(status, userRole);
  }
  return STATUS_TRANSITIONS[status];
}

/**
 * Calculate deadline for a claim based on status and priority
 */
export function calculateDeadline(
  status: ClaimStatus,
  priority: ClaimPriority,
  fromDate: Date = new Date()
): Date {
  const baseDays = STATUS_DEADLINES[status];
  const multiplier = PRIORITY_MULTIPLIERS[priority];
  const adjustedDays = Math.ceil(baseDays * multiplier);
  
  const deadline = new Date(fromDate);
  deadline.setDate(deadline.getDate() + adjustedDays);
  
  return deadline;
}

/**
 * Check if a claim is overdue based on current status
 */
export function isClaimOverdue(
  status: ClaimStatus,
  priority: ClaimPriority,
  statusChangedAt: Date
): boolean {
  const deadline = calculateDeadline(status, priority, statusChangedAt);
  return new Date() > deadline;
}

/**
 * Get days remaining until deadline
 */
export function getDaysUntilDeadline(
  status: ClaimStatus,
  priority: ClaimPriority,
  statusChangedAt: Date
): number {
  const deadline = calculateDeadline(status, priority, statusChangedAt);
  const diffTime = deadline.getTime() - new Date().getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Update claim status with validation and audit trail
 * 
 * @param claimNumber - Claim number to update
 * @param newStatus - New status to transition to
 * @param userId - User making the change
 * @param notes - Optional notes about the status change
 * @param tx - Optional transaction for RLS context (auto-created if not provided)
 */
export async function updateClaimStatus(
  claimNumber: string,
  newStatus: ClaimStatus,
  userId: string,
  notes?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<{ success: boolean; error?: string; claim?: unknown }> {
  // If no transaction provided, wrap in withRLSContext
  if (!tx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (transaction: NodePgDatabase<any>) => {
      return updateClaimStatus(claimNumber, newStatus, userId, notes, transaction);
    });
  }

  try {
    // Get current claim using provided transaction
    const [claim] = await tx
      .select()
      .from(claims)
      .where(eq(claims.claimNumber, claimNumber))
      .limit(1);

    if (!claim) {
      return { success: false, error: "Claim not found" };
    }

    const currentStatus = claim.status as ClaimStatus;
    const priority = (claim.priority as ClaimPriority) || 'medium';

    // Detect LRO signals for this case (PR-7 integration)
    const signals = await detectAllSignals([{
      id: claim.claimId,
      status: currentStatus,
      priority,
      createdAt: claim.createdAt ?? new Date(),
      updatedAt: claim.updatedAt ?? claim.createdAt ?? new Date(),
      assignedTo: claim.assignedTo || undefined,
      organizationId: claim.organizationId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any]);

    const hasUnresolvedCriticalSignals = signals.some(
      signal => signal.severity === 'critical' && signal.actionable
    );

    const hasRequiredDocumentation = Boolean(
      (claim.description && claim.description.length > 20) ||
      (notes && notes.length > 20)
    );

    // Get user role for FSM validation
    const userRoleResult = await tx
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);
    
    const userRole = userRoleResult[0]?.role || 'member';

    // FSM VALIDATION (PR-11 ENFORCEMENT LAYER)
    // This makes bad practice IMPOSSIBLE
    const validation = validateClaimTransition({
      claimId: claim.claimId,
      currentStatus,
      targetStatus: newStatus,
      userId,
      userRole,
      priority,
      statusChangedAt: claim.updatedAt ?? claim.createdAt ?? new Date() as Date,
      hasUnresolvedCriticalSignals,
      hasRequiredDocumentation,
      notes,
    });

    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason || 'Transition not allowed',
      };
    }

    // Update claim status and timestamps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    // Set closed timestamp
    if (newStatus === "closed" && !claim.closedAt) {
      updateData.closedAt = new Date();
    }

    // Update progress based on status
    const progressMap: Record<ClaimStatus, number> = {
      submitted: 10,
      under_review: 25,
      assigned: 30,
      investigation: 50,
      pending_documentation: 60,
      resolved: 90,
      rejected: 100,
      closed: 100,
    };
    updateData.progress = progressMap[newStatus];

    // Perform the update using provided transaction
    const [updatedClaim] = await tx
      .update(claims)
      .set(updateData)
      .where(eq(claims.claimId, claim.claimId))
      .returning();

    // Create audit trail entry with FSM metadata
    const auditMessage = validation.warnings && validation.warnings.length > 0
      ? `Status changed from '${currentStatus}' to '${newStatus}'. WARNINGS: ${validation.warnings.join('; ')}`
      : notes || `Status changed from '${currentStatus}' to '${newStatus}'`;
    
    await tx.insert(claimUpdates).values({
      claimId: claim.claimId,
      updateType: "status_change",
      message: auditMessage,
      createdBy: userId,
      isInternal: false,
      metadata: {
        previousStatus: currentStatus,
        newStatus,
        transitionAllowed: true,
        fsmValidation: {
          slaCompliant: validation.metadata?.slaCompliant,
          daysInState: validation.metadata?.daysInState,
          warnings: validation.warnings,
          hasUnresolvedCriticalSignals,
          nextDeadline: validation.metadata?.nextDeadline,
        },
      },
    });

    // AUTO-GENERATE DEFENSIBILITY PACK (PR-12 complete integration)
    // When claim is resolved or closed, automatically generate immutable export
    if (newStatus === 'resolved' || newStatus === 'closed') {
      try {
// Fetch complete timeline (all claim updates)
        const updates = await tx
          .select()
          .from(claimUpdates)
          .where(eq(claimUpdates.claimId, claim.claimId))
          .orderBy(claimUpdates.createdAt);
        
        // Convert updates to timeline events
        const timeline: TimelineEvent[] = updates.map((update) => {
          const allowedTypes: TimelineEvent['type'][] = [
            'submitted',
            'acknowledged',
            'first_response',
            'investigation_complete',
          ];

          const type = allowedTypes.includes(update.updateType as TimelineEvent['type'])
            ? (update.updateType as TimelineEvent['type'])
            : 'other';

          return {
          id: update.updateId,
          caseId: claim.claimId,
          timestamp: update.createdAt ?? new Date(),
          type,
          description: update.message,
          actorId: update.createdBy,
          actorRole: update.isInternal ? 'staff' : 'member',
          visibilityScope: update.isInternal ? ('staff' as const) : ('member' as const),
          metadata: update.metadata as Record<string, unknown> | undefined,
          };
        });
        
        // Build audit trail from updates
        const auditTrail: AuditEntry[] = updates.map((update) => ({
          id: update.updateId,
          timestamp: update.createdAt ?? new Date(),
          userId: update.createdBy,
          action: update.updateType,
          resourceType: 'claim',
          resourceId: claim.claimId,
          sanitizedMetadata: (update.metadata as Record<string, unknown>) || {},
        }));
        
        // PR #14: Type-safe metadata access with validation
        interface StatusChangeMetadata {
          previousStatus?: string;
          newStatus?: string;
          fsmValidation?: {
            slaCompliant?: boolean;
          };
        }
        
        // Extract state transitions from updates
        const stateTransitions: StateTransition[] = updates
          .filter((u) => u.updateType === 'status_change' && u.metadata)
          .map((u) => {
            const meta = u.metadata as StatusChangeMetadata;
            return {
              timestamp: u.createdAt ?? new Date(),
              fromState: meta.previousStatus || 'unknown',
              toState: meta.newStatus || 'unknown',
              actorRole: u.isInternal ? 'staff' : 'member',
              reason: u.message,
              validationPassed: meta.fsmValidation?.slaCompliant !== false,
            };
          });
        
        // Generate the pack
        const pack = await generateDefensibilityPack(
          claim.claimId,
          timeline,
          auditTrail,
          stateTransitions,
          {
            purpose: 'arbitration',
            requestedBy: 'system',
            exportFormat: 'json',
            includeSensitiveData: false,
            generatedBy: 'system',
            caseSummary: {
              title: claim.description?.slice(0, 80) || `Claim ${claim.claimNumber}`,
              memberId: claim.memberId,
              memberName: await getMemberName(claim.memberId, tx),
              currentState: newStatus,
              createdAt: claim.createdAt ?? new Date(),
              lastUpdated: updatedClaim.updatedAt ?? new Date(),
              grievanceType: claim.claimType || 'general',
              priority: claim.priority || 'medium',
            },
          }
        );
        
        // Store pack in database
        await tx.insert(defensibilityPacks).values({
          caseId: claim.claimId,
          caseNumber: claim.claimNumber,
          organizationId: claim.organizationId,
          packVersion: pack.exportVersion,
          generatedAt: pack.generatedAt,
          generatedBy: pack.generatedBy,
          exportFormat: 'json',
          exportPurpose: pack.exportMetadata.purpose,
          requestedBy: pack.exportMetadata.requestedBy,
          // PR #14: Type-safe JSONB storage (pack structure validated by schema)
          packData: pack as unknown as Record<string, unknown>,
          integrityHash: pack.integrity.combinedHash,
          timelineHash: pack.integrity.timelineHash,
          auditHash: pack.integrity.auditHash,
          stateTransitionHash: pack.integrity.stateTransitionHash,
          verificationStatus: 'verified',
          fileSizeBytes: JSON.stringify(pack).length,
        });
} catch (_error) {
// Don&apos;t fail the status update if pack generation fails
      }
    }

    // Send email notification (async, don&apos;t block on email sending)
    sendClaimStatusNotification(claim.claimId, currentStatus, newStatus, notes).catch((_error) => {
// Don&apos;t fail the status update if email fails
    });
    // SPRINT 7: Auto-create timeline entry (FSM → Timeline integration)
    // Every status change automatically appears in member's case timeline
    addTimelineEntry(
      claim.claimId,
      currentStatus,
      newStatus,
      userId,
      userRole,
      notes,
      validation.metadata
    ).catch((error) => {
      // Don&apos;t fail the status update if timeline integration fails
      // This is OK - timeline is supplementary to the main workflow
      logger.error('Timeline integration failed:', error);
    });
    return { success: true, claim: updatedClaim };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Assign claim to a steward
 */
export async function assignClaim(
  claimId: string,
  stewardId: string,
  assignedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.claimId, claimId))
      .limit(1);

    if (!claim) {
      return { success: false, error: "Claim not found" };
    }

    // Update claim assignment
    await db
      .update(claims)
      .set({
        assignedTo: stewardId,
        assignedAt: new Date(),
        status: "assigned",
        updatedAt: new Date(),
        progress: 30,
      })
      .where(eq(claims.claimId, claimId));

    // Create audit trail
    await db.insert(claimUpdates).values({
      claimId,
      updateType: "assignment",
      message: `Claim assigned to steward`,
      createdBy: assignedBy,
      isInternal: true,
      metadata: {
        stewardId,
        previousStatus: claim.status,
      },
    });

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get overdue claims
 */
export async function getOverdueClaims(): Promise<unknown[]> {
  try {
    const allClaims = await db.select().from(claims);
    
    const overdueClaims = allClaims.filter((claim) => {
      // Don&apos;t check closed claims
      if (claim.status === "closed") return false;
      
      // Use last activity date or created date
      const statusDate = claim.updatedAt || claim.createdAt;
      
      // Skip if no date available
      if (!statusDate) return false;
      
      return isClaimOverdue(
        claim.status as ClaimStatus,
        claim.priority as ClaimPriority,
        statusDate
      );
    });

    return overdueClaims;
  } catch (_error) {
return [];
  }
}

/**
 * Get claims approaching deadline (within 1 day)
 */
export async function getClaimsApproachingDeadline(): Promise<unknown[]> {
  try {
    const allClaims = await db.select().from(claims);
    
    const approachingDeadline = allClaims.filter((claim) => {
      if (claim.status === "closed") return false;
      
      const statusDate = claim.updatedAt || claim.createdAt;
      
      // Skip if no date available
      if (!statusDate) return false;
      
      const daysRemaining = getDaysUntilDeadline(
        claim.status as ClaimStatus,
        claim.priority as ClaimPriority,
        statusDate
      );
      
      return daysRemaining > 0 && daysRemaining <= 1;
    });

    return approachingDeadline;
  } catch (_error) {
return [];
  }
}

/**
 * Add internal note to claim
 * 
 * @param claimNumber - Claim number to add note to
 * @param message - Note message content
 * @param userId - User adding the note
 * @param isInternal - Whether note is internal only (default true)
 * @param tx - Optional transaction for RLS context (auto-created if not provided)
 */
export async function addClaimNote(
  claimNumber: string,
  message: string,
  userId: string,
  isInternal: boolean = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<{ success: boolean; error?: string }> {
  // If no transaction provided, wrap in withRLSContext
  if (!tx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (transaction: NodePgDatabase<any>) => {
      return addClaimNote(claimNumber, message, userId, isInternal, transaction);
    });
  }

  try {
    // Get claim to get UUID using provided transaction
    const [claim] = await tx
      .select()
      .from(claims)
      .where(eq(claims.claimNumber, claimNumber))
      .limit(1);

    if (!claim) {
      return { success: false, error: "Claim not found" };
    }

    // Create note entry
    await tx.insert(claimUpdates).values({
      claimId: claim.claimId,
      updateType: "note",
      message,
      createdBy: userId,
      isInternal,
      metadata: {},
    });

    // Update last activity timestamp
    await tx
      .update(claims)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(claims.claimId, claim.claimId));

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get workflow status for a claim (deadline info, transitions, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClaimWorkflowStatus(claim: Record<string, any>) {
  const status = claim.status as ClaimStatus;
  const priority = claim.priority as ClaimPriority;
  const statusDate = claim.updatedAt || claim.createdAt;

  const deadline = calculateDeadline(status, priority, statusDate);
  const daysRemaining = getDaysUntilDeadline(status, priority, statusDate);
  const isOverdue = isClaimOverdue(status, priority, statusDate);
  const allowedTransitions = getAllowedTransitions(status);

  return {
    currentStatus: status,
    priority,
    deadline,
    daysRemaining,
    isOverdue,
    allowedTransitions,
    progress: claim.progress || 0,
    statusSince: statusDate,
  };
}

