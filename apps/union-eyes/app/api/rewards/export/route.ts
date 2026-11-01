import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { hasMinRole } from '@/lib/api-auth-guard';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { toSafeCsv } from '@/lib/utils/safe-csv';

export const dynamic = 'force-dynamic';

/** An export is bounded: a larger organization pages through the API, not through one download. */
const MAX_EXPORT_ROWS = 5000;

const EXPORT_TYPES = ['awards', 'ledger', 'budgets'] as const;
type ExportType = (typeof EXPORT_TYPES)[number];

/**
 * GET /api/rewards/export — an organization-wide administrative export of recognition awards, the wallet ledger or
 * the budget envelopes. It names every member who received or issued an award and every ledger movement, so it is an
 * administrator's record, not a member's: the wallet and redemption routes already hold a member to their own rows.
 * The role is checked before any row is read, the export is audited in the same transaction that reads it (a failed
 * audit withholds the file), the result is bounded, and cells that a spreadsheet would run as a formula are neutralised.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get('type') || 'awards';
  if (!(EXPORT_TYPES as readonly string[]).includes(requested)) {
    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  }
  const type = requested as ExportType;

  if (!(await hasMinRole('admin'))) {
    return NextResponse.json({ error: 'Administrator access is required to export rewards records' }, { status: 403 });
  }

  const organizationId = await getOrganizationIdForUser(userId);

  // The callback must query through the `tx` that withRLSContext passes: it carries the organization context and is
  // the transaction the audit row commits with.
  return withRLSContext({ organizationId }, async (tx) => {
    let rows: Record<string, unknown>[];
    let filename: string;

    switch (type) {
      case 'awards':
        rows = (await tx.execute(sql`
          SELECT ra.id, ra.created_at, ra.status, ra.reason,
                 ra.recipient_user_id, ra.issuer_user_id,
                 rat.name as award_type, rat.default_credit_amount,
                 rp.name as program_name
          FROM recognition_awards ra
          LEFT JOIN recognition_award_types rat ON rat.id = ra.award_type_id
          LEFT JOIN recognition_programs rp ON rp.id = ra.program_id
          WHERE ra.org_id = ${organizationId}
          ORDER BY ra.created_at DESC
          LIMIT ${MAX_EXPORT_ROWS}
        `)) as unknown as Record<string, unknown>[];
        filename = 'awards-export.csv';
        break;
      case 'ledger':
        rows = (await tx.execute(sql`
          SELECT id, created_at, user_id, event_type, amount_credits,
                 balance_after, source_type, memo
          FROM reward_wallet_ledger
          WHERE org_id = ${organizationId}
          ORDER BY created_at DESC
          LIMIT ${MAX_EXPORT_ROWS}
        `)) as unknown as Record<string, unknown>[];
        filename = 'ledger-export.csv';
        break;
      case 'budgets':
        rows = (await tx.execute(sql`
          SELECT rbe.id, rbe.name, rbe.scope_type, rbe.period,
                 rbe.amount_limit, rbe.amount_used, rbe.starts_at, rbe.ends_at,
                 rp.name as program_name
          FROM reward_budget_envelopes rbe
          LEFT JOIN recognition_programs rp ON rp.id = rbe.program_id
          WHERE rbe.org_id = ${organizationId}
          ORDER BY rbe.created_at DESC
          LIMIT ${MAX_EXPORT_ROWS}
        `)) as unknown as Record<string, unknown>[];
        filename = 'budgets-export.csv';
        break;
    }

    // A thrown audit failure rolls the transaction back and no file is returned.
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'rewards.export',
      resourceType: 'rewards_export',
      resourceId: type,
      details: { type, rowCount: rows.length, truncated: rows.length >= MAX_EXPORT_ROWS },
    });

    return new NextResponse(toSafeCsv(rows), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
