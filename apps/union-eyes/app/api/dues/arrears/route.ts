/**
 * Member Arrears List
 *
 * GET /api/dues/arrears — List all members with outstanding dues for the org,
 * joined with organization_members for contact info.
 *
 * Returns:
 *   { members: MemberInArrears[] }
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'List members in arrears' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    // Join with organization_members to get contact details
    const rows = await withRLSContext(() =>
      db.execute(sql`
        SELECT
          ma.id,
          ma.user_id     AS "memberId",
          om.name        AS "memberName",
          om.email,
          om.phone,
          ma.total_owed  AS "amountOwed",
          ma.arrears_status AS "status",
          ma.has_payment_plan AS "hasPaymentPlan",
          ma.last_payment_date AS "lastPayment",
          ROUND(
            EXTRACT(EPOCH FROM (now() - ma.first_arrears_date)) / 2592000
          )::int AS "monthsBehind"
        FROM member_arrears ma
        LEFT JOIN organization_members om
          ON om.user_id = ma.user_id
         AND om.organization_id = ma.organization_id::text
        WHERE ma.organization_id = ${organizationId}::uuid
          AND ma.arrears_status <> 'current'
        ORDER BY ma.total_owed DESC
      `),
    );

    return { members: rows };
  },
);
