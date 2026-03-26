/**
 * Events for a specific calendar
 */
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { calendarEvents } from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Scheduling'],
      summary: 'List events for a calendar',
    },
  },
  async ({ request, organizationId, params }) => {
    const calendarId = params.id;
    if (!calendarId) {
      return { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const conditions = [eq(calendarEvents.calendarId, calendarId)];
    if (organizationId) {
      conditions.push(eq(calendarEvents.organizationId, organizationId));
    }
    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      db.select().from(calendarEvents).where(where).orderBy(desc(calendarEvents.startTime)).limit(limit).offset(offset),
      db.select({ total: count() }).from(calendarEvents).where(where),
    ]);

    const total = totalResult[0]?.total ?? 0;
    return {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
);
