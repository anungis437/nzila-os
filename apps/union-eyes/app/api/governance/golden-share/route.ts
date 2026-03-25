/**
 * GET POST /api/governance/golden-share
 * Manages golden share certificates in PostgreSQL.
 */
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' }, entitlement: 'governance_suite' },
  async () => {
    return withSystemContext(async () => {
    const rows = await db.execute(sql`
      SELECT id, certificate_number, issue_date, share_class, holder_type,
             council_members, status, sunset_clause_active,
             sunset_clause_duration, consecutive_compliance_years
      FROM golden_shares ORDER BY created_at DESC LIMIT 1
    `);
    const share = Array.from(rows)[0] as Record<string, unknown> | undefined;
    return { share: share ?? null };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    body: z.object({
      certificateNumber: z.string().min(1),
      issueDate: z.string().min(1),
      councilMembers: z.array(z.record(z.unknown())),
    }),
  },
  async ({ body }) => {
    return withSystemContext(async () => {
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO golden_shares (
        id, created_at, updated_at, share_class, certificate_number,
        issue_date, holder_type, council_members,
        voting_power_reserved_matters, voting_power_ordinary_matters,
        redemption_value, dividend_rights, sunset_clause_active,
        sunset_clause_duration, consecutive_compliance_years, status, transferable
      ) VALUES (
        ${id}::uuid, NOW(), NOW(), 'Class B', ${body.certificateNumber},
        ${body.issueDate}::date, 'union_council', ${JSON.stringify(body.councilMembers)}::jsonb,
        100, 0, 0, false, true, 5, 0, 'active', false
      )
    `);
    return { id };
    });
  },
);

