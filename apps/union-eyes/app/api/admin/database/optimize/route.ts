/**
 * POST /api/admin/database/optimize
 * Runs ANALYZE to update query planner statistics, and says what it actually analyzed.
 *
 * ANALYZE changes planner statistics, which are rows of our own database, so the run and its audit record commit in one transaction
 * (a failed audit write abandons it). It runs as the system role, which can analyze only the tables it owns (or is a member of the
 * owner of): every other table is skipped with a warning the client never sees. The answer therefore counts the tables the role can
 * analyze and the ones it cannot, and does not claim database-wide statistics were updated.
 */
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { isPlatformAdminUser, getCurrentUser } from '@/lib/api-auth-guard';
import { performAtomicAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

export const dynamic = 'force-dynamic';

interface AnalyzeCoverage {
  analyzable: number;
  total: number;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId || !(await isPlatformAdminUser(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const actor = await getCurrentUser();
    const coverage = await performAtomicAuditedOperation<AnalyzeCoverage>(
      {
        organizationId: actor?.organizationId,
        userId,
        action: 'platform.database.analyze',
        resourceType: 'database',
        scope: 'system',
        resultDetails: (result) => ({ tablesAnalyzable: result.analyzable, tablesSkipped: result.total - result.analyzable }),
      },
      async (tx) => {
        await tx.execute(sql`ANALYZE`);
        const rows = await tx.execute(sql`
          SELECT count(*) FILTER (WHERE pg_has_role(current_user, c.relowner, 'MEMBER'))::int AS analyzable, count(*)::int AS total
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r', 'p', 'm') AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname !~ '^pg_toast'`);
        const first = ((rows as unknown as { rows?: AnalyzeCoverage[] }).rows ?? (rows as unknown as AnalyzeCoverage[]))[0];
        return { analyzable: Number(first?.analyzable ?? 0), total: Number(first?.total ?? 0) };
      },
    );
    const skipped = coverage.total - coverage.analyzable;
    return NextResponse.json({
      success: coverage.analyzable > 0,
      tablesAnalyzed: coverage.analyzable,
      tablesSkipped: skipped,
      message:
        coverage.analyzable === 0
          ? 'ANALYZE ran but this role owns none of the tables, so no planner statistics were updated'
          : skipped > 0
            ? `ANALYZE updated planner statistics for ${coverage.analyzable} of ${coverage.total} tables; ${skipped} are owned by another role and were skipped`
            : `ANALYZE updated planner statistics for all ${coverage.total} tables`,
      optimizedAt: new Date().toISOString(),
    });
  } catch (error) {
    const refused = operationAuditResponse(error);
    if (refused) return NextResponse.json(refused.body, { status: refused.status });
    return NextResponse.json(
      { success: false, error: 'Optimization failed' },
      { status: 500 },
    );
  }
}
