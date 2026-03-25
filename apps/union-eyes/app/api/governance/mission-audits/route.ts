/**
 * GET POST /api/governance/mission-audits
 * Records and retrieves mission audit results from PostgreSQL.
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
      SELECT id, audit_year, auditor_firm, auditor_name, audit_date,
             union_revenue_percent, member_satisfaction_percent,
             data_violations, overall_pass, auditor_opinion
      FROM mission_audits ORDER BY audit_date DESC LIMIT 50
    `);
    return { audits: Array.from(rows) };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    body: z.object({
      auditYear: z.number().int(),
      auditPeriodStart: z.string().min(1),
      auditPeriodEnd: z.string().min(1),
      auditorFirm: z.string().min(1),
      auditorName: z.string().min(1),
      auditDate: z.string().min(1),
      unionRevenuePercent: z.number().int(),
      memberSatisfactionPercent: z.number().int(),
      dataViolations: z.number().int(),
      auditorOpinion: z.string().optional(),
    }),
  },
  async ({ body }) => {
    return withSystemContext(async () => {
    const id = crypto.randomUUID();
    const revenuePass = body.unionRevenuePercent >= 50;
    const satisfactionPass = body.memberSatisfactionPercent >= 70;
    const dataPass = body.dataViolations === 0;
    const overallPass = revenuePass && satisfactionPass && dataPass;

    await db.execute(sql`
      INSERT INTO mission_audits (
        id, created_at, updated_at, audit_year, audit_period_start, audit_period_end,
        auditor_firm, auditor_name, auditor_certification, audit_date,
        union_revenue_percent, member_satisfaction_percent, data_violations,
        union_revenue_threshold, member_satisfaction_threshold, data_violations_threshold,
        union_revenue_pass, member_satisfaction_pass, data_violations_pass, overall_pass,
        auditor_opinion
      ) VALUES (
        ${id}::uuid, NOW(), NOW(), ${body.auditYear},
        ${body.auditPeriodStart}::date, ${body.auditPeriodEnd}::date,
        ${body.auditorFirm}, ${body.auditorName}, '',
        ${body.auditDate}::date,
        ${body.unionRevenuePercent}, ${body.memberSatisfactionPercent}, ${body.dataViolations},
        50, 70, 0,
        ${revenuePass}, ${satisfactionPass}, ${dataPass}, ${overallPass},
        ${body.auditorOpinion ?? ''}
      )
    `);
    return { id, overallPass };
    });
  },
);

