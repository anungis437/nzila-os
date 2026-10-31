/**
 * Committee Workspace Service
 *
 * Manages the full lifecycle of committee meetings, minutes, action items,
 * documents, and cross-committee intelligence synthesis.
 */

import { db } from '@/db';
import { eq, and, desc, asc, sql, inArray, between, isNull, isNotNull } from 'drizzle-orm';
import { committees } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
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
// SCOPE
// =====================================================================================

/**
 * A committee, and optionally one of its meetings, action items or documents, must belong to the caller's
 * organization and to each other. Anything else is indistinguishable from a missing record, so a request cannot
 * reach another organization's committee by guessing an id, nor attach a record to a committee that is not theirs.
 */
export async function requireCommitteeScope(
  organizationId: string,
  committeeId: string,
  children: { meetingId?: string; actionItemId?: string; documentId?: string } = {},
) {
  const [committee] = await db
    .select({ id: committees.id })
    .from(committees)
    .where(and(eq(committees.id, committeeId), eq(committees.organizationId, organizationId)));
  if (!committee) throw ApiError.notFound('Committee');

  if (children.meetingId) {
    const [row] = await db
      .select({ id: committeeMeetings.id })
      .from(committeeMeetings)
      .where(and(eq(committeeMeetings.id, children.meetingId), eq(committeeMeetings.committeeId, committeeId), eq(committeeMeetings.organizationId, organizationId)));
    if (!row) throw ApiError.notFound('Meeting');
  }
  if (children.actionItemId) {
    const [row] = await db
      .select({ id: committeeActionItems.id })
      .from(committeeActionItems)
      .where(and(eq(committeeActionItems.id, children.actionItemId), eq(committeeActionItems.committeeId, committeeId), eq(committeeActionItems.organizationId, organizationId)));
    if (!row) throw ApiError.notFound('Action item');
  }
  if (children.documentId) {
    const [row] = await db
      .select({ id: committeeDocuments.id })
      .from(committeeDocuments)
      .where(and(eq(committeeDocuments.id, children.documentId), eq(committeeDocuments.committeeId, committeeId), eq(committeeDocuments.organizationId, organizationId)));
    if (!row) throw ApiError.notFound('Document');
  }
}

// =====================================================================================
// MEETINGS
// =====================================================================================

export async function createMeeting(
  data: Omit<NewCommitteeMeeting, 'id' | 'createdAt' | 'updatedAt'> & { attendeeIds?: string[] }
) {
  const { attendeeIds, ...meetingData } = data;

  return withRLSContext({ organizationId: data.organizationId }, async (tx) => {
    const [meeting] = await tx.insert(committeeMeetings).values(meetingData).returning();

    if (attendeeIds?.length && meeting) {
      await tx.insert(committeeMeetingAttendees).values(
        attendeeIds.map((memberId) => ({ meetingId: meeting.id, memberId, attended: false }))
      );
    }

    await persistAtomicAudit(tx, {
      organizationId: data.organizationId,
      userId: data.createdBy ?? 'system',
      action: 'committee.meeting.created',
      resourceType: 'committee_meeting',
      resourceId: meeting.id,
      details: { committeeId: data.committeeId, title: data.title },
    });
    return meeting;
  });
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
  organizationId: string,
  data: Partial<NewCommitteeMeeting> & { updatedBy?: string }
) {
  // Minutes and their approval have their own operations; a generic update cannot rewrite them.
  const { minutes: _minutes, minutesApprovedBy: _by, minutesApprovedAt: _at, organizationId: _org, committeeId: _committee, ...changes } = data;
  // Once the minutes are approved, the recorded decisions, the agenda and the meeting status are part of the approved record.
  const touchesApprovedRecord = (['decisions', 'agendaItems', 'agenda', 'status'] as const).some((key) => key in changes);
  return withRLSContext(async (tx) => {
    const conditions = [eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId)];
    if (touchesApprovedRecord) conditions.push(isNull(committeeMeetings.minutesApprovedAt));
    const [updated] = await tx
      .update(committeeMeetings)
      .set({ ...changes, updatedAt: sql`now()` })
      .where(and(...conditions))
      .returning();
    if (!updated) {
      if (!touchesApprovedRecord) return null;
      const [exists] = await tx
        .select({ id: committeeMeetings.id })
        .from(committeeMeetings)
        .where(and(eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId)));
      if (exists) throw ApiError.conflict('The decisions, agenda and status of a meeting with approved minutes cannot be changed');
      return null;
    }
    await persistAtomicAudit(tx, {
      organizationId: updated.organizationId,
      userId: data.updatedBy ?? 'system',
      action: 'committee.meeting.updated',
      resourceType: 'committee_meeting',
      resourceId: meetingId,
      details: { fields: Object.keys(changes).filter((k) => k !== 'updatedBy') },
    });
    return updated;
  });
}

export async function recordMinutes(
  meetingId: string,
  organizationId: string,
  minutes: string,
  updatedBy: string
) {
  return withRLSContext(async (tx) => {
    // Approved minutes are the committee's record and are not rewritten: the predicate keeps an edit from landing on
    // minutes that were approved in the meantime.
    const [updated] = await tx
      .update(committeeMeetings)
      .set({ minutes, status: 'completed', minutesRecordedBy: updatedBy, updatedBy, updatedAt: sql`now()` })
      .where(and(eq(committeeMeetings.id, meetingId), isNull(committeeMeetings.minutesApprovedAt), eq(committeeMeetings.organizationId, organizationId)))
      .returning();
    if (!updated) return null;
    await persistAtomicAudit(tx, {
      organizationId: updated.organizationId,
      userId: updatedBy,
      action: 'committee.minutes.recorded',
      resourceType: 'committee_meeting',
      resourceId: meetingId,
      details: { committeeId: updated.committeeId },
    });
    return updated;
  });
}

export async function approveMinutes(
  meetingId: string,
  organizationId: string,
  approvedBy: string
) {
  return withRLSContext(async (tx) => {
    const [updated] = await tx
      .update(committeeMeetings)
      .set({
        minutesApprovedBy: approvedBy,
        minutesApprovedAt: sql`now()`,
        updatedBy: approvedBy,
        updatedAt: sql`now()`,
      })
      .where(and(eq(committeeMeetings.id, meetingId), isNull(committeeMeetings.minutesApprovedAt), isNotNull(committeeMeetings.minutes), eq(committeeMeetings.organizationId, organizationId)))
      .returning();
    if (!updated) return null;
    await persistAtomicAudit(tx, {
      organizationId: updated.organizationId,
      userId: approvedBy,
      action: 'committee.minutes.approved',
      resourceType: 'committee_meeting',
      resourceId: meetingId,
      details: { committeeId: updated.committeeId },
    });
    return updated;
  });
}

// =====================================================================================
// ATTENDANCE
// =====================================================================================

export async function recordAttendance(
  meetingId: string,
  organizationId: string,
  attendees: Array<{
    memberId: string;
    attended: boolean;
    arrivedLate?: boolean;
    leftEarly?: boolean;
    proxy?: string;
    regrets?: boolean;
  }>,
  recordedBy?: string
) {
  return withRLSContext(async (tx) => {
    for (const a of attendees) {
      const existing = await tx
        .select()
        .from(committeeMeetingAttendees)
        .where(and(eq(committeeMeetingAttendees.meetingId, meetingId), eq(committeeMeetingAttendees.memberId, a.memberId)));

      if (existing.length > 0) {
        // Attendee rows carry no organization of their own: ownership is proven through the meeting's organization in the statement.
        await tx
          .update(committeeMeetingAttendees)
          .set(a)
          .where(
            and(
              eq(committeeMeetingAttendees.id, existing[0].id),
              inArray(
                committeeMeetingAttendees.meetingId,
                tx.select({ id: committeeMeetings.id }).from(committeeMeetings).where(and(eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId)))
              )
            )
          );
      } else {
        await tx.insert(committeeMeetingAttendees).values({ meetingId, ...a });
      }
    }

    const attendedCount = attendees.filter((a) => a.attended).length;
    const [meeting] = await tx
      .update(committeeMeetings)
      .set({ attendeeCount: attendedCount, updatedAt: sql`now()` })
      .where(and(eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId)))
      .returning({ organizationId: committeeMeetings.organizationId });
    if (!meeting) throw ApiError.notFound('Meeting');

    await persistAtomicAudit(tx, {
      organizationId: meeting.organizationId,
      userId: recordedBy ?? 'system',
      action: 'committee.attendance.recorded',
      resourceType: 'committee_meeting',
      resourceId: meetingId,
      details: { attendees: attendees.length, attended: attendedCount },
    });
  });
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
  return withRLSContext({ organizationId: data.organizationId }, async (tx) => {
    const [item] = await tx.insert(committeeActionItems).values(data).returning();
    await persistAtomicAudit(tx, {
      organizationId: data.organizationId,
      userId: data.createdBy ?? 'system',
      action: 'committee.action_item.created',
      resourceType: 'committee_action_item',
      resourceId: item.id,
      details: { committeeId: data.committeeId, title: data.title },
    });
    return item;
  });
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
  organizationId: string,
  data: Partial<NewCommitteeActionItem> & { updatedBy?: string }
) {
  const { organizationId: _org, committeeId: _committee, ...changes } = data;
  const updateData: Record<string, unknown> = { ...changes, updatedAt: sql`now()` };

  // Auto-set completedAt when status changes to completed
  if (data.status === 'completed' && !data.completedAt) {
    updateData.completedAt = sql`now()`;
    updateData.completedBy = data.updatedBy;
  }

  return withRLSContext(async (tx) => {
    const [updated] = await tx
      .update(committeeActionItems)
      .set(updateData)
      .where(and(eq(committeeActionItems.id, itemId), eq(committeeActionItems.organizationId, organizationId)))
      .returning();
    if (!updated) return null;
    await persistAtomicAudit(tx, {
      organizationId: updated.organizationId,
      userId: data.updatedBy ?? 'system',
      action: 'committee.action_item.updated',
      resourceType: 'committee_action_item',
      resourceId: itemId,
      details: { fields: Object.keys(changes).filter((k) => k !== 'updatedBy'), status: data.status },
    });
    return updated;
  });
}

export async function carryForwardActionItems(
  fromMeetingId: string,
  toMeetingId: string,
  organizationId: string,
  userId: string
) {
  return withRLSContext(async (tx) => {
    const openItems = await tx
      .select()
      .from(committeeActionItems)
      .where(
        and(
          eq(committeeActionItems.meetingId, fromMeetingId),
          eq(committeeActionItems.organizationId, organizationId),
          sql`${committeeActionItems.status} IN ('pending', 'in_progress')`
        )
      );

    const carried: (typeof committeeActionItems.$inferSelect)[] = [];
    for (const item of openItems) {
      const [newItem] = await tx
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

      await tx
        .update(committeeActionItems)
        .set({ status: 'deferred', updatedBy: userId, updatedAt: sql`now()` })
        .where(and(eq(committeeActionItems.id, item.id), eq(committeeActionItems.organizationId, organizationId)));
    }

    if (carried.length > 0) {
      await persistAtomicAudit(tx, {
        organizationId: carried[0].organizationId,
        userId,
        action: 'committee.action_items.carried_forward',
        resourceType: 'committee_meeting',
        resourceId: toMeetingId,
        details: { fromMeetingId, count: carried.length },
      });
    }
    return carried;
  });
}

// =====================================================================================
// DOCUMENTS
// =====================================================================================

export async function linkDocument(
  data: Omit<NewCommitteeDocument, 'id' | 'createdAt'>
) {
  return withRLSContext({ organizationId: data.organizationId }, async (tx) => {
    const [doc] = await tx.insert(committeeDocuments).values(data).returning();
    await persistAtomicAudit(tx, {
      organizationId: data.organizationId,
      userId: data.uploadedBy ?? 'system',
      action: 'committee.document.linked',
      resourceType: 'committee_document',
      resourceId: doc.id,
      details: { committeeId: data.committeeId, title: data.title },
    });
    return doc;
  });
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

export async function removeDocument(documentId: string, organizationId: string, removedBy?: string) {
  await withRLSContext(async (tx) => {
    const [removed] = await tx
      .delete(committeeDocuments)
      .where(and(eq(committeeDocuments.id, documentId), eq(committeeDocuments.organizationId, organizationId)))
      .returning();
    if (!removed) return;
    await persistAtomicAudit(tx, {
      organizationId: removed.organizationId,
      userId: removedBy ?? 'system',
      action: 'committee.document.removed',
      resourceType: 'committee_document',
      resourceId: documentId,
      details: { committeeId: removed.committeeId, title: removed.title },
    });
  });
}

// =====================================================================================
// INTELLIGENCE
// =====================================================================================

export async function createIntelligenceSnapshot(
  data: Omit<typeof committeeIntelligenceSnapshots.$inferInsert, 'id' | 'generatedAt'>
) {
  return withRLSContext({ organizationId: data.organizationId }, async (tx) => {
    const [snapshot] = await tx.insert(committeeIntelligenceSnapshots).values(data).returning();
    await persistAtomicAudit(tx, {
      organizationId: data.organizationId,
      userId: data.generatedBy ?? 'system',
      action: 'committee.intelligence.generated',
      resourceType: 'committee_intelligence',
      resourceId: snapshot.id,
      details: { committeeId: data.committeeId, title: data.title },
    });
    return snapshot;
  });
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
