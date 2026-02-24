/**
 * Timeline Integration Service
 * 
 * SPRINT 7: FSM → Timeline Integration
 * 
 * This service connects the FSM state machine (updateClaimStatus) to the Member Timeline API.
 * Every claim status change automatically creates a timeline entry, ensuring members get
 * comprehensive case journey visualization.
 * 
 * Philosophy: "No manual timeline entries required - FSM state changes ARE the timeline"
 */

import { db } from '@/db';
import { grievances } from '@/db/schema/grievance-schema';
import { eq } from 'drizzle-orm';
import { generateStatusUpdateMessage } from '@/lib/member-experience/timeline-builder';
import type { ClaimStatus } from '@/lib/workflow-engine';
import { logger } from '@/lib/logger';

export interface TimelineStatusEntry {
  status: string;
  timestamp: Date;
  metadata: {
    previousStatus?: string;
    notes?: string;
    actorId?: string;
    actorRole?: string;
    fsmValidation?: {
      slaCompliant?: boolean;
      daysInState?: number;
      warnings?: string[];
      hasUnresolvedCriticalSignals?: boolean;
      nextDeadline?: Date;
    };
  };
}

/**
 * Add a status change to the grievance timeline
 * Called automatically by updateClaimStatus() in workflow-engine.ts
 * 
 * @param claimId - Claim ID (maps to grievances.id)
 * @param previousStatus - Previous status
 * @param newStatus - New status
 * @param actorId - User ID who made the change
 * @param actorRole - User role (member/steward/admin)
 * @param notes - Optional notes about the change
 * @param fsmMetadata - FSM validation metadata (SLA compliance, warnings, etc.)
 */
export async function addTimelineEntry(
  claimId: string,
  previousStatus: ClaimStatus,
  newStatus: ClaimStatus,
  actorId: string,
  actorRole: string,
  notes?: string,
  fsmMetadata?: {
    slaCompliant?: boolean;
    daysInState?: number;
    warnings?: string[];
    hasUnresolvedCriticalSignals?: boolean;
    nextDeadline?: Date;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch current grievance
    const [grievance] = await db
      .select()
      .from(grievances)
      .where(eq(grievances.id, claimId))
      .limit(1);

    if (!grievance) {
      // Claim not found in grievances table (might be in claims table only)
      // This is OK - not all claims are grievances
      return { success: false, error: 'Grievance not found (may not be a grievance case)' };
    }

    // Get existing status history (stored in timeline jsonb column)
    const statusHistory: TimelineStatusEntry[] = (grievance.timeline as unknown as TimelineStatusEntry[]) || [];

    // Add new entry
    const newEntry: TimelineStatusEntry = {
      status: newStatus,
      timestamp: new Date(),
      metadata: {
        previousStatus,
        notes,
        actorId,
        actorRole,
        fsmValidation: fsmMetadata,
      },
    };

    statusHistory.push(newEntry);

    // Update grievance with new status and history
    await db
      .update(grievances)
      .set({
        status: newStatus as string as (typeof grievances.status.enumValues)[number],
        timeline: statusHistory as unknown as Array<{ date: string; action: string; actor: string; notes?: string }>,
        updatedAt: new Date(),
      })
      .where(eq(grievances.id, claimId));

    return { success: true };
  } catch (error) {
    logger.error('Failed to add timeline entry', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build a human-readable timeline entry message
 * Uses human-explainers.ts to generate compassionate, context-aware explanations
 * 
 * @param currentStatus - Current case status
 * @param daysInState - Days case has been in current state
 * @param priority - Case priority
 * @param assignedSteward - Steward name (if assigned)
 * @returns Human-readable status message
 */
export function generateTimelineMessage(
  currentStatus: ClaimStatus,
  daysInState: number,
  priority?: string,
  assignedSteward?: string
): string {
  return generateStatusUpdateMessage(currentStatus as string, String(daysInState), { priority: priority as 'low' | 'medium' | 'high' | 'urgent', assignedSteward: assignedSteward ? { id: '', name: assignedSteward } : undefined });
}

/**
 * Get full timeline for a case (for member/steward view)
 * Fetches and enriches timeline with human-readable messages
 * 
 * @param claimId - Claim ID
 * @returns Array of timeline entries with human-readable messages
 */
export async function getEnrichedTimeline(
  claimId: string
): Promise<{
  success: boolean;
  timeline?: Array<TimelineStatusEntry & { message: string }>;
  error?: string;
}> {
  try {
    const [grievance] = await db
      .select()
      .from(grievances)
      .where(eq(grievances.id, claimId))
      .limit(1);

    if (!grievance) {
      return { success: false, error: 'Case not found' };
    }

    const statusHistory: TimelineStatusEntry[] = (grievance.timeline as unknown as TimelineStatusEntry[]) || [];

    // Enrich each entry with human-readable message
    const enrichedTimeline = statusHistory.map((entry, index) => {
      const previousEntry = index > 0 ? statusHistory[index - 1] : null;
      const _daysInState = previousEntry
        ? Math.floor(
            (entry.timestamp.getTime() - previousEntry.timestamp.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0;

      const message = generateStatusUpdateMessage(
        entry.metadata?.previousStatus || '',
        entry.status,
        { priority: grievance.priority as 'low' | 'medium' | 'high' | 'urgent' }
      );

      return {
        ...entry,
        message,
      };
    });

    return { success: true, timeline: enrichedTimeline };
  } catch (error) {
    logger.error('Failed to fetch enriched timeline', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
