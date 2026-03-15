/**
 * GET /api/v2/governance/events
 * Returns recent governance events from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async () => {
    return withSystemContext(async () => {
      const rows = await db.execute(sql`
        SELECT id, title, event_type, event_date, description, impact
        FROM governance_events ORDER BY event_date DESC LIMIT 50
      `);
      return { events: Array.from(rows) };
    });
  },
);
