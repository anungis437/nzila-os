/**
 * Case Timeline Service
 * PR-4: Visibility Scopes (dual-surface enforcement)
 * PR-13: Signal Recomputation Triggers (auto-refresh LRO alerts)
 * 
 * Purpose: Same events, different views - members see status, LROs see process.
 * This service ensures that timeline events are filtered based on the viewer's role.
 * 
 * Key Principle: "One system. Two surfaces. One truth."
 * - Member surface: Status updates only (visibility_scope: 'member')
 * - LRO surface: Full process details (visibility_scope: 'member' | 'staff' | 'admin')
 */

import { db } from '@/db/db';
import { claimUpdates, grievanceTransitions, claims, organizationMembers, users } from '@/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { detectSignals, type CaseForSignals } from './lro-signals';
import { NotificationService } from '@/lib/services/notification-service';
import { logger } from '@/lib/logger';

export type VisibilityScope = 'member' | 'staff' | 'admin' | 'system';

export type TimelineEvent = {
  id: string;
  type: 'update' | 'transition';
  timestamp: Date;
  message: string;
  createdBy: string;
  visibilityScope: VisibilityScope;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
};

/**
 * Get timeline visible to union members
 * Members only see 'member' scope events - status updates, public communications
 * They DO NOT see internal staff discussions, strategic decisions, or process details
 */
export async function getMemberVisibleTimeline(
  claimId: string,
  memberId: string
): Promise<TimelineEvent[]> {
  // Verify member has access to this claim (either they created it or it&apos;s assigned to them)
  const claim = await db
    .select()
    .from(claims)
    .where(eq(claims.claimId, claimId))
    .limit(1);

  if (!claim.length) {
    throw new Error('Claim not found');
  }

  const claimData = claim[0];

  // Basic access check (simplified - in production, verify organization membership)
  if (claimData.memberId !== memberId) {
    // Allow viewing if member is in same organization (would check org membership in production)
    // For now, allow all for demonstration
  }

  // Fetch only 'member' scope events
  const updates = await db
    .select()
    .from(claimUpdates)
    .where(
      and(
        eq(claimUpdates.claimId, claimId),
        eq(claimUpdates.visibilityScope, 'member')
      )
    )
    .orderBy(desc(claimUpdates.createdAt));

  // Map to common timeline format
  const events: TimelineEvent[] = updates.map((update) => ({
    id: update.updateId,
    type: 'update',
    timestamp: update.createdAt!,
    message: update.message,
    createdBy: update.createdBy,
    visibilityScope: update.visibilityScope as VisibilityScope,
    metadata: update.metadata,
  }));

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Get full timeline visible to LROs (Labour Relations Officers)
 * LROs see ALL events: member, staff, and admin scope
 * They need full transparency to manage cases effectively and ensure defensibility
 */
export async function getLroVisibleTimeline(
  claimId: string,
  organizationId: string
): Promise<TimelineEvent[]> {
  // Verify claim belongs to this organization
  const claim = await db
    .select()
    .from(claims)
    .where(eq(claims.claimId, claimId))
    .limit(1);

  if (!claim.length) {
    throw new Error('Claim not found');
  }

  if (claim[0].organizationId !== organizationId) {
    throw new Error('Claim does not belong to this organization');
  }

  // Fetch all updates (member, staff, admin) - exclude 'system' scope
  const updates = await db
    .select()
    .from(claimUpdates)
    .where(
      and(
        eq(claimUpdates.claimId, claimId),
        inArray(claimUpdates.visibilityScope, ['member', 'staff', 'admin'])
      )
    )
    .orderBy(desc(claimUpdates.createdAt));

  // Fetch all transitions (staff, admin)
  const transitions = await db
    .select()
    .from(grievanceTransitions)
    .where(
      and(
        eq(grievanceTransitions.claimId, claimId),
        inArray(grievanceTransitions.visibilityScope, ['staff', 'admin'])
      )
    )
    .orderBy(desc(grievanceTransitions.transitionedAt));

  // Combine and format events
  const events: TimelineEvent[] = [
    ...updates.map((update) => ({
      id: update.updateId,
      type: 'update' as const,
      timestamp: update.createdAt!,
      message: update.message,
      createdBy: update.createdBy,
      visibilityScope: update.visibilityScope as VisibilityScope,
      metadata: update.metadata,
    })),
    ...transitions.map((transition) => ({
      id: transition.id,
      type: 'transition' as const,
      timestamp: transition.transitionedAt!,
      message: `Stage transition: ${transition.reason || 'Status changed'}`,
      createdBy: transition.transitionedBy,
      visibilityScope: transition.visibilityScope as VisibilityScope,
      metadata: {
        fromStageId: transition.fromStageId,
        toStageId: transition.toStageId,
        notes: transition.notes,
      },
    })),
  ];

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Add a timeline event with automatic visibility scope assignment
 * 
 * Scope assignment rules:
 * - Member communications → 'member'
 * - Status changes visible to member → 'member'
 * - Internal notes, strategy → 'staff'
 * - Administrative actions → 'admin'
 * - System events (automated) → 'system'
 */
export async function addCaseEvent(payload: {
  claimId: string;
  updateType: string;
  message: string;
  createdBy: string;
  isInternal?: boolean;
  visibilityScope?: VisibilityScope;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
}): Promise<string> {
  // Auto-determine scope if not explicitly provided
  let scope = payload.visibilityScope;

  if (!scope) {
    if (payload.isInternal) {
      scope = 'staff';
    } else if (payload.updateType === 'status_change') {
      scope = 'member';
    } else if (payload.updateType === 'member_communication') {
      scope = 'member';
    } else if (payload.updateType.startsWith('admin_')) {
      scope = 'admin';
    } else {
      // Default to staff for safety
      scope = 'staff';
    }
  }

  const [update] = await db
    .insert(claimUpdates)
    .values({
      claimId: payload.claimId,
      updateType: payload.updateType,
      message: payload.message,
      createdBy: payload.createdBy,
      isInternal: payload.isInternal || false,
      visibilityScope: scope,
      metadata: payload.metadata || {},
    })
    .returning();

  // PR #13: Recompute signals after timeline event insertion
  // This ensures LRO dashboard stays up-to-date with real-time alerts
  try {
    await recomputeSignalsForCase(payload.claimId);
  } catch (error) {
    // Log error but don&apos;t fail timeline insertion
    logger.error('Signal recomputation failed for case', { error, claimId: payload.claimId });
  }

  return update.updateId;
}

/**
 * Get visible scopes for a given role
 * Helper function to determine which scopes a role can see
 */
export function getVisibleScopesForRole(role: string): VisibilityScope[] {
  switch (role.toLowerCase()) {
    case 'member':
      return ['member'];
    case 'steward':
    case 'officer':
    case 'staff':
      return ['member', 'staff'];
    case 'admin':
    case 'administrator':
      return ['member', 'staff', 'admin'];
    case 'system':
      return ['member', 'staff', 'admin', 'system'];
    default:
      return ['member']; // Safe default
  }
}

// ============================================================================
// PR #13: SIGNAL RECOMPUTATION AFTER TIMELINE CHANGES
// ============================================================================

/**
 * Recompute LRO signals for a case after timeline update
 * 
 * This function is called automatically after timeline events are inserted,
 * ensuring that the LRO dashboard shows real-time alerts without manual refresh.
 * 
 * Features:
 * - Detects SLA breaches, stale cases, member waiting, etc.
 * - Stores last-computed timestamp
 * - Sends notifications if critical signals detected
 * 
 * @param claimId - The case/claim ID to recompute signals for
 */
async function recomputeSignalsForCase(claimId: string): Promise<void> {
  // Fetch claim data with timeline
  const claim = await db
    .select()
    .from(claims)
    .where(eq(claims.claimId, claimId))
    .limit(1);

  if (!claim.length) {
    logger.warn('Cannot recompute signals: Claim not found', { claimId });
    return;
  }

  const claimData = claim[0];

  // Fetch timeline events
  const updates = await db
    .select()
    .from(claimUpdates)
    .where(eq(claimUpdates.claimId, claimId))
    .orderBy(desc(claimUpdates.createdAt));

  // Map to signal-compatible format
  const timeline = updates.map(u => ({
    timestamp: u.createdAt!,
    type: mapUpdateTypeToTimelineType(u.updateType),
  }));

  // Fetch member name from organizationMembers table
  const memberResult = await db
    .select({ name: organizationMembers.name })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, claimData.memberId))
    .limit(1);
  
  const memberName = memberResult[0]?.name || 'Member';

  const caseForSignals: CaseForSignals = {
    id: claimData.claimId,
    title: claimData.description || 'Untitled',
    memberId: claimData.memberId,
    memberName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentState: claimData.status as any, // Map claim status to case state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    priority: (claimData.priority as any) || 'medium',
    createdAt: claimData.createdAt!,
    lastUpdated: claimData.updatedAt || claimData.createdAt!,
    timeline,
    assignedOfficerId: claimData.assignedTo || undefined,
  };

  // Detect signals
  const signals = detectSignals(caseForSignals, new Date());

  // Log signal changes (production: store in database)
  if (signals.length > 0) {
    logger.info('Detected signals for case', {
      claimId,
      signalCount: signals.length,
      signals: signals.map(s => ({ severity: s.severity, title: s.title })),
    });

    // Send notifications for critical signals
    const criticalSignals = signals.filter(s => s.severity === 'critical');
    if (criticalSignals.length > 0) {
      logger.warn('Critical signals detected', {
        claimId,
        criticalCount: criticalSignals.length,
      });
      
      // Send notification to assigned officer
      if (claimData.assignedTo) {
        try {
          const assignedOfficer = await db.query.users.findFirst({
            where: eq(users.userId, claimData.assignedTo),
          });
          
          if (assignedOfficer?.email) {
            const notificationService = new NotificationService();
            await notificationService.send({
              organizationId: claimData.organizationId,
              recipientId: claimData.assignedTo,
              recipientEmail: assignedOfficer.email,
              type: 'email',
              priority: 'urgent',
              subject: `⚠️ CRITICAL Signals Detected - Case ${claimId}`,
              body: `${criticalSignals.length} critical signals have been detected for case ${claimId}:\n\n${criticalSignals.map(s => `- ${s.title}`).join('\n')}\n\nPlease review this case immediately.`,
              htmlBody: `
                <h2>⚠️ CRITICAL Signals Detected</h2>
                <p><strong>Case ID:</strong> ${claimId}</p>
                <p>${criticalSignals.length} critical signals have been detected:</p>
                <ul>
                  ${criticalSignals.map(s => `<li><strong>${s.title}</strong></li>`).join('')}
                </ul>
                <p><strong>Please review this case immediately.</strong></p>
              `,
              metadata: {
                claimId,
                signalCount: criticalSignals.length,
                signalTitles: criticalSignals.map(s => s.title),
              },
            });
          }
        } catch (error) {
          logger.error('Failed to send critical signal notification', { error, claimId });
        }
      }
    }
  } else {
    logger.info('No signals detected for case', { claimId });
  }

  // Store signals in database with lastComputedAt timestamp
  try {
    // Store signals as JSON metadata in claim_updates table
    await db.insert(claimUpdates).values({
      claimId,
      updateType: 'signal_recompute',
      message: `Recomputed ${signals.length} signal(s)`,
      createdBy: 'system',
      visibilityScope: 'admin',
      metadata: {
        signals,
        lastComputedAt: new Date().toISOString(),
        criticalCount: signals.filter(s => s.severity === 'critical').length,
        urgentCount: signals.filter(s => s.severity === 'urgent').length,
        warningCount: signals.filter(s => s.severity === 'warning').length,
      },
    });
    
    logger.info('Stored signals for case', { claimId, signalCount: signals.length });
  } catch (error) {
    logger.error('Failed to store signals for case', { error, claimId });
  }
}

/**
 * Map claim update type to timeline event type for signal detection
 */
function mapUpdateTypeToTimelineType(
  updateType: string
): 'submitted' | 'acknowledged' | 'first_response' | 'investigation_complete' | 'other' {
  switch (updateType) {
    case 'claim_submitted':
    case 'status_change':
      return 'submitted';
    case 'claim_acknowledged':
      return 'acknowledged';
    case 'first_response':
    case 'member_communication':
      return 'first_response';
    case 'investigation_complete':
      return 'investigation_complete';
    default:
      return 'other';
  }
}
