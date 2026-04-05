import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') || 'awards';

  return withSystemContext(async () => {
  let csvContent: string;
  let filename: string;

  switch (type) {
    case 'awards': {
      const rows = await db.execute(sql`
        SELECT ra.id, ra.created_at, ra.status, ra.reason,
               ra.recipient_user_id, ra.issuer_user_id,
               rat.name as award_type, rat.default_credit_amount,
               rp.name as program_name
        FROM recognition_awards ra
        LEFT JOIN recognition_award_types rat ON rat.id = ra.award_type_id
        LEFT JOIN recognition_programs rp ON rp.id = ra.program_id
        WHERE ra.org_id = ${orgId}
        ORDER BY ra.created_at DESC
      `);
      csvContent = toCsv(rows as Record<string, unknown>[]);
      filename = 'awards-export.csv';
      break;
    }
    case 'ledger': {
      const rows = await db.execute(sql`
        SELECT id, created_at, user_id, event_type, amount_credits,
               balance_after, source_type, memo
        FROM reward_wallet_ledger
        WHERE org_id = ${orgId}
        ORDER BY created_at DESC
      `);
      csvContent = toCsv(rows as Record<string, unknown>[]);
      filename = 'ledger-export.csv';
      break;
    }
    case 'budgets': {
      const rows = await db.execute(sql`
        SELECT rbe.id, rbe.name, rbe.scope_type, rbe.period,
               rbe.amount_limit, rbe.amount_used, rbe.starts_at, rbe.ends_at,
               rp.name as program_name
        FROM reward_budget_envelopes rbe
        LEFT JOIN recognition_programs rp ON rp.id = rbe.program_id
        WHERE rbe.org_id = ${orgId}
        ORDER BY rbe.created_at DESC
      `);
      csvContent = toCsv(rows as Record<string, unknown>[]);
      filename = 'budgets-export.csv';
      break;
    }
    default:
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  }

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h];
          if (v == null) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(',')
    );
  }
  return lines.join('\n');
}

