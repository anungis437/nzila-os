/**
 * GET /api/governance/events
 * Returns recent governance events from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

// governance_events is a global platform table read in the system context, so it is open to the platform's governance roles only, as the rest of the
// governance console is: a tenant admin's role is not authority over it.
export const GET = withApi(
  { auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] }, entitlement: 'governance_suite' },
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

