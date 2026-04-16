/**
 * Committee Workspace Service
 *
 * Manages the full lifecycle of committee meetings, minutes, action items,
 * documents, and cross-committee intelligence synthesis.
 */

import { db } from '@/db';
import { eq, and, desc, asc, sql, inArray, between } from 'drizzle-orm';
import { createAuditLog } from './audit-service';
import {
  committeeMeetings,
  committeeMeetingAttendees,
  committeeActionItems,
  committeeDocuments,
  committeeIntelligenceSnapshots,
  type NewCommitteeMeeting,
  type NewCommitteeActionItem,
  type NewCommitteeDocument,
} from '@/db/schema';

// =====================================================================================
// MEETINGS
// =====================================================================================

export async function createMeeting(
  data: Omit<NewCommitteeMeeting, 'id' | 'createdAt' | 'updatedAt'> & { attendeeIds?: string[] }
) {
  const { attendeeIds, ...meetingData } = data;

  const [meeting] = await db
    .insert(committeeMeetings)
    .values(meetingData)
    .returning();

  // Add attendees if provided
  if (attendeeIds?.length && meeting) {
    await db.insert(committeeMeetingAttendees).values(
      attendeeIds.map((memberId) => ({
        meetingId: meeting.id,
        memberId,
        attended: false,
      }))
    );
  }

  createAuditLog({
    action: 'committee.meeting.created',
    resourceType: 'committee_meeting',
    resourceId: meeting.id,
    userId: data.createdBy ?? 'system',
    organizationId: data.organizationId,
    metadata: { committeeId: data.committeeId, title: data.title },
  });

  return meeting;
}

export async function getMeeting(meetingId: string) {
  const [meeting] = await db
    .select()
    .from(committeeMeetings)
    .where(eq(committeeMeetings.id, meetingId));
  return meeting ?? null;
}

export async function listMeetings(
  committeeId: string,
  options?: { status?: string; limit?: number; offset?: number }
) {
  const conditions = [eq(committeeMeetings.committeeId, committeeId)];
  if (options?.status) {
    conditions.push(eq(committeeMeetings.status, options.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed'));
  }

  const meetings = await db
    .select()
    .from(committeeMeetings)
    .where(and(...conditions))
    .orderBy(desc(committeeMeetings.meetingDate))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return meetings;
}

export async function updateMeeting(
  meetingId: string,
  data: Partial<NewCommitteeMeeting> & { updatedBy?: string }
) {
  const [updated] = await db
    .update(committeeMeetings)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(committeeMeetings.id, meetingId))
    .returning();
  return updated ?? null;
}

export async function recordMinutes(
  meetingId: string,
  minutes: string,
  updatedBy: string
) {
  const [updated] = await db
    .update(committeeMeetings)
    .set({
      minutes,
      status: 'completed',
      updatedBy,
      updatedAt: sql`now()`,
    })
    .where(eq(committeeMeetings.id, meetingId))
    .returning();

  if (updated) {
    createAuditLog({
      action: 'committee.minutes.recorded',
      resourceType: 'committee_meeting',
      resourceId: meetingId,
      userId: updatedBy,
      organizationId: updated.organizationId,
      metadata: { committeeId: updated.committeeId },
    });
  }

  return updated ?? null;
}

export async function approveMinutes(
  meetingId: string,
  approvedBy: string
) {
  const [updated] = await db
    .update(committeeMeetings)
    .set({
      minutesApprovedBy: approvedBy,
      minutesApprovedAt: sql`now()`,
      updatedBy: approvedBy,
      updatedAt: sql`now()`,
    })
    .where(eq(committeeMeetings.id, meetingId))
    .returning();

  if (updated) {
    createAuditLog({
      action: 'committee.minutes.approved',
      resourceType: 'committee_meeting',
      resourceId: meetingId,
      userId: approvedBy,
      organizationId: updated.organizationId,
      metadata: { committeeId: updated.committeeId },
    });
  }

  return updated ?? null;
}

// =====================================================================================
// ATTENDANCE
// =====================================================================================

export async function recordAttendance(
  meetingId: string,
  attendees: Array<{
    memberId: string;
    attended: boolean;
    arrivedLate?: boolean;
    leftEarly?: boolean;
    proxy?: string;
    regrets?: boolean;
  }>
) {
  // Upsert attendees
  for (const a of attendees) {
    const existing = await db
      .select()
      .from(committeeMeetingAttendees)
      .where(
        and(
          eq(committeeMeetingAttendees.meetingId, meetingId),
          eq(committeeMeetingAttendees.memberId, a.memberId)
        )
      );

    if (existing.length > 0) {
      await db
        .update(committeeMeetingAttendees)
        .set(a)
        .where(eq(committeeMeetingAttendees.id, existing[0].id));
    } else {
      await db.insert(committeeMeetingAttendees).values({
        meetingId,
        ...a,
      });
    }
  }

  // Update attendance count on meeting
  const attendedCount = attendees.filter((a) => a.attended).length;
  await db
    .update(committeeMeetings)
    .set({ attendeeCount: attendedCount, updatedAt: sql`now()` })
    .where(eq(committeeMeetings.id, meetingId));
}

export async function getMeetingAttendees(meetingId: string) {
  return db
    .select()
    .from(committeeMeetingAttendees)
    .where(eq(committeeMeetingAttendees.meetingId, meetingId));
}

// =====================================================================================
// ACTION ITEMS
// =====================================================================================

export async function createActionItem(
  data: Omit<NewCommitteeActionItem, 'id' | 'createdAt' | 'updatedAt'>
) {
  const [item] = await db
    .insert(committeeActionItems)
    .values(data)
    .returning();

  createAuditLog({
    action: 'committee.action_item.created',
    resourceType: 'committee_action_item',
    resourceId: item.id,
    userId: data.createdBy ?? 'system',
    organizationId: data.organizationId,
    metadata: { committeeId: data.committeeId, title: data.title },
  });

  return item;
}

export async function listActionItems(
  committeeId: string,
  options?: { status?: string; assignedTo?: string; includeCompleted?: boolean }
) {
  const conditions = [eq(committeeActionItems.committeeId, committeeId)];

  if (options?.status) {
    conditions.push(eq(committeeActionItems.status, options.status as 'pending' | 'in_progress' | 'completed' | 'deferred' | 'cancelled'));
  } else if (!options?.includeCompleted) {
    // By default, exclude completed/cancelled
    conditions.push(
      sql`${committeeActionItems.status} NOT IN ('completed', 'cancelled')`
    );
  }

  if (options?.assignedTo) {
    conditions.push(eq(committeeActionItems.assignedTo, options.assignedTo));
  }

  return db
    .select()
    .from(committeeActionItems)
    .where(and(...conditions))
    .orderBy(
      asc(committeeActionItems.dueDate),
      desc(committeeActionItems.priority)
    );
}

export async function updateActionItem(
  itemId: string,
  data: Partial<NewCommitteeActionItem> & { updatedBy?: string }
) {
  const updateData: Record<string, unknown> = { ...data, updatedAt: sql`now()` };

  // Auto-set completedAt when status changes to completed
  if (data.status === 'completed' && !data.completedAt) {
    updateData.completedAt = sql`now()`;
    updateData.completedBy = data.updatedBy;
  }

  const [updated] = await db
    .update(committeeActionItems)
    .set(updateData)
    .where(eq(committeeActionItems.id, itemId))
    .returning();

  return updated ?? null;
}

export async function carryForwardActionItems(
  fromMeetingId: string,
  toMeetingId: string,
  userId: string
) {
  // Find open action items from the source meeting
  const openItems = await db
    .select()
    .from(committeeActionItems)
    .where(
      and(
        eq(committeeActionItems.meetingId, fromMeetingId),
        sql`${committeeActionItems.status} IN ('pending', 'in_progress')`
      )
    );

  const carried: (typeof committeeActionItems.$inferSelect)[] = [];
  for (const item of openItems) {
    const [newItem] = await db
      .insert(committeeActionItems)
      .values({
        committeeId: item.committeeId,
        organizationId: item.organizationId,
        meetingId: toMeetingId,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        assignedTo: item.assignedTo,
        dueDate: item.dueDate,
        carriedFromMeetingId: fromMeetingId,
        carryCount: (item.carryCount ?? 0) + 1,
        createdBy: userId,
      })
      .returning();
    carried.push(newItem);

    // Mark original as deferred
    await db
      .update(committeeActionItems)
      .set({ status: 'deferred', updatedBy: userId, updatedAt: sql`now()` })
      .where(eq(committeeActionItems.id, item.id));
  }

  return carried;
}

// =====================================================================================
// DOCUMENTS
// =====================================================================================

export async function linkDocument(
  data: Omit<NewCommitteeDocument, 'id' | 'createdAt'>
) {
  const [doc] = await db
    .insert(committeeDocuments)
    .values(data)
    .returning();
  return doc;
}

export async function listCommitteeDocuments(
  committeeId: string,
  options?: { category?: string; meetingId?: string }
) {
  const conditions = [eq(committeeDocuments.committeeId, committeeId)];
  if (options?.category) {
    conditions.push(eq(committeeDocuments.category, options.category));
  }
  if (options?.meetingId) {
    conditions.push(eq(committeeDocuments.meetingId, options.meetingId));
  }

  return db
    .select()
    .from(committeeDocuments)
    .where(and(...conditions))
    .orderBy(desc(committeeDocuments.createdAt));
}

export async function removeDocument(documentId: string) {
  await db
    .delete(committeeDocuments)
    .where(eq(committeeDocuments.id, documentId));
}

// =====================================================================================
// INTELLIGENCE
// =====================================================================================

export async function createIntelligenceSnapshot(
  data: Omit<typeof committeeIntelligenceSnapshots.$inferInsert, 'id' | 'generatedAt'>
) {
  const [snapshot] = await db
    .insert(committeeIntelligenceSnapshots)
    .values(data)
    .returning();

  createAuditLog({
    action: 'committee.intelligence.generated',
    resourceType: 'committee_intelligence',
    resourceId: snapshot.id,
    userId: data.generatedBy ?? 'system',
    organizationId: data.organizationId,
    metadata: { committeeId: data.committeeId, title: data.title },
  });

  return snapshot;
}

export async function listIntelligenceSnapshots(
  organizationId: string,
  options?: { committeeId?: string; limit?: number }
) {
  const conditions = [
    eq(committeeIntelligenceSnapshots.organizationId, organizationId),
  ];
  if (options?.committeeId) {
    conditions.push(
      eq(committeeIntelligenceSnapshots.committeeId, options.committeeId)
    );
  }

  return db
    .select()
    .from(committeeIntelligenceSnapshots)
    .where(and(...conditions))
    .orderBy(desc(committeeIntelligenceSnapshots.generatedAt))
    .limit(options?.limit ?? 20);
}

/**
 * Gather minutes across committees for a given period to feed into AI synthesis.
 * Returns raw meeting data that can be sent to an LLM for cross-committee analysis.
 */
export async function gatherCrossCommitteeMinutes(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
  committeeIds?: string[]
) {
  const conditions = [
    eq(committeeMeetings.organizationId, organizationId),
    eq(committeeMeetings.status, 'completed'),
    between(
      committeeMeetings.meetingDate,
      periodStart,
      periodEnd
    ),
  ];

  if (committeeIds?.length) {
    conditions.push(inArray(committeeMeetings.committeeId, committeeIds));
  }

  const meetings = await db
    .select({
      id: committeeMeetings.id,
      committeeId: committeeMeetings.committeeId,
      title: committeeMeetings.title,
      meetingDate: committeeMeetings.meetingDate,
      minutes: committeeMeetings.minutes,
      decisions: committeeMeetings.decisions,
      agendaItems: committeeMeetings.agendaItems,
    })
    .from(committeeMeetings)
    .where(and(...conditions))
    .orderBy(asc(committeeMeetings.meetingDate));

  return meetings;
}

// =====================================================================================
// STATS
// =====================================================================================

export async function getCommitteeStats(committeeId: string) {
  const [meetingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(committeeMeetings)
    .where(eq(committeeMeetings.committeeId, committeeId));

  const [upcomingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(committeeMeetings)
    .where(
      and(
        eq(committeeMeetings.committeeId, committeeId),
        eq(committeeMeetings.status, 'scheduled'),
        sql`${committeeMeetings.meetingDate} > now()`
      )
    );

  const [openActionItems] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(committeeActionItems)
    .where(
      and(
        eq(committeeActionItems.committeeId, committeeId),
        sql`${committeeActionItems.status} IN ('pending', 'in_progress')`
      )
    );

  const [overdueItems] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(committeeActionItems)
    .where(
      and(
        eq(committeeActionItems.committeeId, committeeId),
        sql`${committeeActionItems.status} IN ('pending', 'in_progress')`,
        sql`${committeeActionItems.dueDate} < CURRENT_DATE`
      )
    );

  const [documentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(committeeDocuments)
    .where(eq(committeeDocuments.committeeId, committeeId));

  return {
    totalMeetings: meetingCount?.count ?? 0,
    upcomingMeetings: upcomingCount?.count ?? 0,
    openActionItems: openActionItems?.count ?? 0,
    overdueActionItems: overdueItems?.count ?? 0,
    totalDocuments: documentCount?.count ?? 0,
  };
}
