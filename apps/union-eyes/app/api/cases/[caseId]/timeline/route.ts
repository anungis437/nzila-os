/**
 * Case timeline route
 *
 * Returns timeline events for a specific case (claim), combining:
 *  - claimUpdates (status changes, notes, communications)
 *  - grievanceTimeline entries linked via the claim's grievanceId (if any)
 *
 * Fixes:
 *  - Previous implementation used a generic CRUD collection that returned
 *    ALL grievanceTimeline rows in the org (no per-case filter).
 *  - Response fields now match the TimelineEvent interface expected by the UI
 *    (id, timestamp, type, description, actor).
 */
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { claimUpdates } from '@/db/schema';
import { grievanceTimeline } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Claims'],
      summary: 'Get case timeline',
      description: 'Returns timeline events for a specific case.',
    },
  },
  async ({ params }) => {
    const caseId = params?.caseId;
    if (!caseId) {
      return { data: [] };
    }

    // 1. Fetch claimUpdates scoped to this case
    const updates = await withRLSContext(() =>
      db
        .select()
        .from(claimUpdates)
        .where(eq(claimUpdates.claimId, caseId))
        .orderBy(desc(claimUpdates.createdAt)),
    );

    const mapped = updates.map((u) => ({
      id: u.updateId,
      timestamp: u.createdAt?.toISOString() ?? new Date().toISOString(),
      type: u.updateType,
      description: u.message,
      actor: u.createdBy,
    }));

    // 2. Check if there's a linked grievance via claim metadata or
    //    a future grievance_id column. Currently claims table has no FK
    //    to grievances, so attempt a raw lookup and gracefully skip if
    //    the column doesn't exist.
    try {
      const linkResult = await withRLSContext(() =>
        db.execute(
          sql`SELECT grievance_id FROM claims WHERE claim_id = ${caseId} AND grievance_id IS NOT NULL LIMIT 1`,
        ),
      );
      const rows = Array.from(linkResult);
      const grievanceId = (rows[0] as Record<string, unknown> | undefined)?.grievance_id as string | undefined;

      if (grievanceId) {
        const gEvents = await withRLSContext(() =>
          db
            .select()
            .from(grievanceTimeline)
            .where(eq(grievanceTimeline.grievanceId, grievanceId))
            .orderBy(desc(grievanceTimeline.eventDate)),
        );

        for (const ev of gEvents) {
          mapped.push({
            id: ev.id,
            timestamp: ev.eventDate?.toISOString() ?? ev.createdAt?.toISOString() ?? new Date().toISOString(),
            type: ev.eventType,
            description: ev.description,
            actor: ev.actor ?? 'System',
          });
        }
      }
    } catch {
      // Column doesn't exist yet — no linked grievance timeline to include
    }

    // Sort combined list newest-first
    mapped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { data: mapped };
  },
);
