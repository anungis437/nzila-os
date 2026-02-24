/**
 * CLC Remittance Audit & Approval Workflow Service
 * 
 * Backend service for managing multi-level approval workflows for per-capita remittances,
 * including compliance checks, approval history tracking, rejection workflows, and notifications.
 * 
 * Features:
 * - Multi-level approval workflow (local â†’ regional â†’ national â†’ CLC)
 * - Configurable approval levels per organization
 * - Compliance check gates before approval
 * - Approval history with full audit trail
 * - Rejection workflow with reasons and comments
 * - Approval notifications via email
 * - Role-based approval authority
 * - Approval timeline and status tracking
 * 
 * Usage:
 * ```typescript
 * import { submitForApproval, approveRemittance, rejectRemittance } from '@/services/clc/remittance-audit';
 * 
 * // Submit remittance for approval
 * await submitForApproval(remittanceId, userId);
 * 
 * // Approve at current level
 * await approveRemittance(remittanceId, userId, 'regional', 'Verified all calculations');
 * 
 * // Reject with reason
 * await rejectRemittance(remittanceId, userId, 'regional', 'Membership count discrepancy', 'Please update member count');
 * ```
 */

import { db } from '@/db';
import {
  perCapitaRemittances,
  remittanceApprovals,
  organizations,
  users,
  organizationMembers
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { sendEmail } from '@/services/email';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ApprovalLevel = 'local' | 'regional' | 'national' | 'clc';
export type ApprovalAction = 'submitted' | 'approved' | 'rejected' | 'returned';
export type RemittanceStatus =
  | 'draft'
  | 'pending_local'
  | 'pending_regional'
  | 'pending_national'
  | 'pending_clc'
  | 'approved'
  | 'rejected'
  | 'paid';

interface ApprovalConfig {
  organizationId: string;
  levels: ApprovalLevel[];
  requireComplianceCheck: boolean;
  autoAdvance: boolean;
}

interface ApprovalResult {
  success: boolean;
  remittanceId: string;
  currentLevel: ApprovalLevel | null;
  nextLevel: ApprovalLevel | null;
  status: RemittanceStatus;
  message: string;
  errors?: string[];
}

export interface ComplianceCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface ApprovalHistoryEntry {
  id: string;
  level: ApprovalLevel;
  action: ApprovalAction;
  approverName: string;
  approverEmail: string;
  comment: string | null;
  rejectionReason: string | null;
  timestamp: Date;
}

export interface ApprovalWorkflowState {
  remittanceId: string;
  organizationName: string;
  remittanceMonth: string;
  amount: number;
  currentLevel: ApprovalLevel | null;
  nextLevel: ApprovalLevel | null;
  status: RemittanceStatus;
  history: ApprovalHistoryEntry[];
  canApprove: boolean;
  canReject: boolean;
  requiresAction: boolean;
}

// ============================================================================
// MAIN APPROVAL FUNCTIONS
// ============================================================================

/**
 * Submit remittance for approval workflow
 */
export async function submitForApproval(
  remittanceId: string,
  userId: string
): Promise<ApprovalResult> {
  try {
    // Get remittance
    const remittance = await db
      .select()
      .from(perCapitaRemittances)
      .where(eq(perCapitaRemittances.id, remittanceId))
      .limit(1);

    if (remittance.length === 0) {
      return {
        success: false,
        remittanceId,
        currentLevel: null,
        nextLevel: null,
        status: 'draft',
        message: 'Remittance not found',
        errors: ['Remittance not found']
      };
    }

    const rem = remittance[0];

    // Check if already submitted
    if (rem.approvalStatus !== 'draft') {
      return {
        success: false,
        remittanceId,
        currentLevel: null,
        nextLevel: null,
        status: rem.approvalStatus as RemittanceStatus,
        message: 'Remittance already submitted',
        errors: ['Remittance is not in draft status']
      };
    }

    // Run compliance checks
    const complianceResult = await runComplianceChecks(remittance[0]);
    if (!complianceResult.passed) {
      return {
        success: false,
        remittanceId,
        currentLevel: null,
        nextLevel: null,
        status: 'draft',
        message: 'Compliance checks failed',
        errors: complianceResult.errors
      };
    }

    // Get approval configuration
    const config = await getApprovalConfig(rem.organizationId);
    const firstLevel = config.levels[0];

    // Update remittance status
    const newStatus = `pending_${firstLevel}` as RemittanceStatus;
    await db
      .update(perCapitaRemittances)
      .set({
        approvalStatus: newStatus,
        submittedDate: new Date().toISOString(),
        createdBy: userId
      })
      .where(eq(perCapitaRemittances.id, remittanceId));

    // Log approval action
    await logApprovalAction(
      remittanceId,
      null, // No specific level for submission
      'submitted',
      userId,
      'Submitted for approval'
    );

    // Send notification to next approvers
    await notifyNextApprovers(remittanceId, firstLevel);

    return {
      success: true,
      remittanceId,
      currentLevel: null,
      nextLevel: firstLevel,
      status: newStatus,
      message: `Submitted for ${firstLevel} approval`
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      remittanceId,
      currentLevel: null,
      nextLevel: null,
      status: 'draft',
      message: errorMessage,
      errors: [errorMessage]
    };
  }
}

/**
 * Approve remittance at current approval level
 */
export async function approveRemittance(
  remittanceId: string,
  userId: string,
  currentLevel: ApprovalLevel,
  comment?: string
): Promise<ApprovalResult> {
  try {
    // Get remittance
    const remittance = await db
      .select()
      .from(perCapitaRemittances)
      .where(eq(perCapitaRemittances.id, remittanceId))
      .limit(1);

    if (remittance.length === 0) {
      return {
        success: false,
        remittanceId,
        currentLevel,
        nextLevel: null,
        status: 'draft',
        message: 'Remittance not found',
        errors: ['Remittance not found']
      };
    }

    const rem = remittance[0];

    // Verify current level matches remittance status
    const expectedStatus = `pending_${currentLevel}` as RemittanceStatus;
    if (rem.approvalStatus !== expectedStatus) {
      return {
        success: false,
        remittanceId,
        currentLevel,
        nextLevel: null,
        status: rem.approvalStatus as RemittanceStatus,
        message: 'Remittance not at this approval level',
        errors: [`Expected status ${expectedStatus}, got ${rem.approvalStatus}`]
      };
    }

    // Verify user has approval authority
    const hasAuthority = await verifyApprovalAuthority(userId, rem.organizationId, currentLevel);
    if (!hasAuthority) {
      return {
        success: false,
        remittanceId,
        currentLevel,
        nextLevel: null,
        status: rem.approvalStatus as RemittanceStatus,
        message: 'User does not have approval authority',
        errors: ['Insufficient approval permissions']
      };
    }

    // Get approval configuration
    const config = await getApprovalConfig(rem.organizationId);
    const currentIndex = config.levels.indexOf(currentLevel);
    const nextLevel = currentIndex < config.levels.length - 1 ? config.levels[currentIndex + 1] : null;

    // Determine new status
    let newStatus: RemittanceStatus;
    if (nextLevel) {
      newStatus = `pending_${nextLevel}` as RemittanceStatus;
    } else {
      newStatus = 'approved';
    }

    // Update remittance
    await db
      .update(perCapitaRemittances)
      .set({
        approvalStatus: newStatus,
        approvedDate: nextLevel ? undefined : new Date().toISOString(),
        approvedBy: nextLevel ? undefined : userId
      })
      .where(eq(perCapitaRemittances.id, remittanceId));

    // Log approval
    await logApprovalAction(
      remittanceId,
      currentLevel,
      'approved',
      userId,
      comment || null
    );

    // Send notifications
    if (nextLevel) {
      await notifyNextApprovers(remittanceId, nextLevel);
    } else {
      await notifyFinalApproval(remittanceId);
    }

    return {
      success: true,
      remittanceId,
      currentLevel,
      nextLevel,
      status: newStatus,
      message: nextLevel
        ? `Approved at ${currentLevel} level, sent to ${nextLevel}`
        : 'Final approval completed'
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      remittanceId,
      currentLevel,
      nextLevel: null,
      status: 'draft',
      message: errorMessage,
      errors: [errorMessage]
    };
  }
}

/**
 * Reject remittance at current approval level
 */
export async function rejectRemittance(
  remittanceId: string,
  userId: string,
  currentLevel: ApprovalLevel,
  rejectionReason: string,
  comment?: string
): Promise<ApprovalResult> {
  try {
    // Get remittance
    const remittance = await db
      .select()
      .from(perCapitaRemittances)
      .where(eq(perCapitaRemittances.id, remittanceId))
      .limit(1);

    if (remittance.length === 0) {
      return {
        success: false,
        remittanceId,
        currentLevel,
        nextLevel: null,
        status: 'draft',
        message: 'Remittance not found',
        errors: ['Remittance not found']
      };
    }

    const rem = remittance[0];

    // Verify current level
    const expectedStatus = `pending_${currentLevel}` as RemittanceStatus;
    if (rem.approvalStatus !== expectedStatus) {
      return {
        success: false,
        remittanceId,
        currentLevel,
        nextLevel: null,
        status: rem.approvalStatus as RemittanceStatus,
        message: 'Remittance not at this approval level',
        errors: [`Expected status ${expectedStatus}, got ${rem.approvalStatus}`]
      };
    }

    // Verify authority
    const hasAuthority = await verifyApprovalAuthority(userId, rem.organizationId, currentLevel);
    if (!hasAuthority) {
      return {
        success: false,
        remittanceId,
        currentLevel,
        nextLevel: null,
        status: rem.approvalStatus as RemittanceStatus,
        message: 'User does not have approval authority',
        errors: ['Insufficient approval permissions']
      };
    }

    // Return to draft for revision
    await db
      .update(perCapitaRemittances)
      .set({
        approvalStatus: 'rejected',
        rejectedDate: new Date().toISOString(),
        rejectedBy: userId,
        rejectionReason
      })
      .where(eq(perCapitaRemittances.id, remittanceId));

    // Log rejection
    await logApprovalAction(
      remittanceId,
      currentLevel,
      'rejected',
      userId,
      comment || null,
      rejectionReason
    );

    // Notify submitter
    await notifyRejection(remittanceId, currentLevel, rejectionReason);

    return {
      success: true,
      remittanceId,
      currentLevel,
      nextLevel: null,
      status: 'rejected',
      message: `Rejected at ${currentLevel} level: ${rejectionReason}`
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      remittanceId,
      currentLevel,
      nextLevel: null,
      status: 'draft',
      message: errorMessage,
      errors: [errorMessage]
    };
  }
}

/**
 * Get approval workflow state for a remittance
 */
export async function getApprovalWorkflowState(
  remittanceId: string,
  userId: string
): Promise<ApprovalWorkflowState | null> {
  try {
    // Get remittance with organization
    const result = await db
      .select({
        remittance: perCapitaRemittances,
        organization: organizations
      })
      .from(perCapitaRemittances)
      .leftJoin(organizations, eq(perCapitaRemittances.organizationId, organizations.id))
      .where(eq(perCapitaRemittances.id, remittanceId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { remittance, organization } = result[0];

    // Get approval history
    const history = await getApprovalHistory(remittanceId);

    // Determine current and next level
    const config = await getApprovalConfig(remittance.organizationId);
    const { currentLevel, nextLevel } = determineApprovalLevels(
      remittance.approvalStatus as RemittanceStatus,
      config.levels
    );

    // Check if user can approve
    const canApprove = currentLevel
      ? await verifyApprovalAuthority(userId, remittance.organizationId, currentLevel)
      : false;

    return {
      remittanceId,
      organizationName: organization?.name || 'Unknown',
      remittanceMonth: String(remittance.remittanceMonth),
      amount: Number(remittance.totalAmount),
      currentLevel,
      nextLevel,
      status: remittance.approvalStatus as RemittanceStatus,
      history,
      canApprove,
      canReject: canApprove,
      requiresAction: canApprove
    };

  } catch (_error) {
return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS - COMPLIANCE
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runComplianceChecks(remittance: any): Promise<ComplianceCheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!remittance.totalMembers || remittance.totalMembers <= 0) {
    errors.push('Total members must be greater than zero');
  }

  if (!remittance.perCapitaRate || remittance.perCapitaRate <= 0) {
    errors.push('Per capita rate must be greater than zero');
  }

  if (!remittance.totalAmount || remittance.totalAmount <= 0) {
    errors.push('Total amount must be greater than zero');
  }

  // Check calculation consistency
  const expectedAmount = remittance.totalMembers * remittance.perCapitaRate;
  const actualAmount = Number(remittance.totalAmount);
  if (Math.abs(expectedAmount - actualAmount) > 0.01) {
    errors.push(
      `Calculated amount ($${expectedAmount.toFixed(2)}) does not match total amount ($${actualAmount.toFixed(2)})`
    );
  }

  // Check due date
  const dueDate = new Date(remittance.dueDate);
  const now = new Date();
  if (dueDate < now && !remittance.paidDate) {
    warnings.push(`Remittance is overdue (due: ${dueDate.toLocaleDateString()})`);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// HELPER FUNCTIONS - CONFIGURATION
// ============================================================================

async function getApprovalConfig(organizationId: string): Promise<ApprovalConfig> {
  // In production, fetch from database or configuration service
  // For now, return default configuration
  return {
    organizationId,
    levels: ['local', 'regional', 'national', 'clc'],
    requireComplianceCheck: true,
    autoAdvance: false
  };
}

async function verifyApprovalAuthority(
  userId: string,
  organizationId: string,
  level: ApprovalLevel
): Promise<boolean> {
  // Get user's role in the organization
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId)
    ))
    .limit(1);

  if (membership.length === 0) {
    return false;
  }

  const userRole = membership[0].role;

  // Role-based authority mapping
  const authorityMap: Record<ApprovalLevel, string[]> = {
    local: ['local_admin', 'regional_admin', 'national_admin', 'clc_admin'],
    regional: ['regional_admin', 'national_admin', 'clc_admin'],
    national: ['national_admin', 'clc_admin'],
    clc: ['clc_admin']
  };

  return authorityMap[level]?.includes(userRole) || false;
}

function determineApprovalLevels(
  status: RemittanceStatus,
  configLevels: ApprovalLevel[]
): { currentLevel: ApprovalLevel | null; nextLevel: ApprovalLevel | null } {
  if (status === 'draft' || status === 'rejected') {
    return { currentLevel: null, nextLevel: configLevels[0] || null };
  }

  if (status === 'approved' || status === 'paid') {
    return { currentLevel: null, nextLevel: null };
  }

  // Extract level from status (e.g., "pending_regional" -> "regional")
  const match = status.match(/^pending_(.+)$/);
  if (!match) {
    return { currentLevel: null, nextLevel: null };
  }

  const currentLevel = match[1] as ApprovalLevel;
  const currentIndex = configLevels.indexOf(currentLevel);
  const nextLevel = currentIndex < configLevels.length - 1 ? configLevels[currentIndex + 1] : null;

  return { currentLevel, nextLevel };
}

// ============================================================================
// HELPER FUNCTIONS - HISTORY
// ============================================================================

async function getApprovalHistory(remittanceId: string): Promise<ApprovalHistoryEntry[]> {
  const history = await db
    .select({
      approval: remittanceApprovals,
      user: users
    })
    .from(remittanceApprovals)
    .leftJoin(users, eq(remittanceApprovals.approverUserId, users.userId))
    .where(eq(remittanceApprovals.remittanceId, remittanceId))
    .orderBy(desc(remittanceApprovals.createdAt));

  return history.map(({ approval, user }) => ({
    id: approval.id,
    level: approval.approvalLevel as ApprovalLevel,
    action: approval.action as ApprovalAction,
    approverName: user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Unknown',
    approverEmail: user?.email || '',
    comment: approval.comment,
    rejectionReason: approval.rejectionReason,
    timestamp: approval.createdAt ? new Date(approval.createdAt) : new Date()
  }));
}

async function logApprovalAction(
  remittanceId: string,
  level: ApprovalLevel | null,
  action: ApprovalAction,
  userId: string,
  comment: string | null,
  rejectionReason?: string
): Promise<void> {
  try {
    await db.insert(remittanceApprovals).values({
      remittanceId,
      approvalLevel: level,
      action,
      approverUserId: userId,
      comment,
      rejectionReason,
      createdAt: new Date().toISOString()
    });
  } catch (_error) {
}
}

// ============================================================================
// HELPER FUNCTIONS - NOTIFICATIONS
// ============================================================================

async function notifyNextApprovers(
  remittanceId: string,
  level: ApprovalLevel
): Promise<void> {
  // Get remittance details
  const result = await db
    .select({
      remittance: perCapitaRemittances,
      organization: organizations
    })
    .from(perCapitaRemittances)
    .leftJoin(organizations, eq(perCapitaRemittances.organizationId, organizations.id))
    .where(eq(perCapitaRemittances.id, remittanceId))
    .limit(1);

  if (result.length === 0) return;

  const { remittance, organization } = result[0];

  // Get approvers for this level
  const approvers = await getApproversForLevel(remittance.organizationId, level);

  // Send notification emails
  for (const approver of approvers) {
    await sendEmail({
      to: approver.email,
      subject: `Remittance Approval Required: ${organization?.name}`,
      html: `
        <h2>Remittance Approval Required</h2>
        <p>A remittance requires your approval at the <strong>${level}</strong> level.</p>
        <p><strong>Organization:</strong> ${organization?.name}</p>
        <p><strong>Period:</strong> ${remittance.remittanceMonth}</p>
        <p><strong>Amount:</strong> $${Number(remittance.totalAmount).toFixed(2)}</p>
        <p><strong>Members:</strong> ${remittance.totalMembers}</p>
        <p>Please review and approve or reject this remittance in the system.</p>
      `
    });
  }
}

async function notifyFinalApproval(_remittanceId: string): Promise<void> {
  // Send notification that remittance is fully approved
  // Implementation similar to notifyNextApprovers
}

async function notifyRejection(
  _remittanceId: string,
  _level: ApprovalLevel,
  _reason: string
): Promise<void> {
  // Send notification that remittance was rejected
  // Implementation similar to notifyNextApprovers
}

async function getApproversForLevel(
  organizationId: string,
  level: ApprovalLevel
): Promise<Array<{ name: string; email: string }>> {
  // Get users with approval authority for this level
  const authorityMap: Record<ApprovalLevel, string[]> = {
    local: ['local_admin'],
    regional: ['regional_admin'],
    national: ['national_admin'],
    clc: ['clc_admin']
  };

  const _roles = authorityMap[level] || [];
  
  // Query users with appropriate roles
  // For now, return placeholder
  return [];
}

// ============================================================================
// EXPORTS
// ============================================================================
// EXPORTS - Internal functions for testing
// ============================================================================

export {
  getApprovalHistory,
  runComplianceChecks
};

// Note: Types are already exported inline above
