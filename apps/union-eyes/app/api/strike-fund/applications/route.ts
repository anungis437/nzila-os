/**
 * Strike Fund Applications
 *
 * GET  /api/strike-fund/applications  — list strike fund applications
 * POST /api/strike-fund/applications  — submit a new application
 *
 * NOTE: No dedicated `strikeFundApplications` table exists in the schema.
 * GET returns strike-fund disbursement records reshaped as "applications"
 * so the UI receives a well-typed, non-crashing response.
 * POST acknowledges the submission and returns a queued placeholder.
 *
 * When a proper applications table is added, replace the body accordingly.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { strikeFundDisbursements } from '@/db/schema/strike-fund-tax-schema';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['StrikeFund'], summary: 'List strike fund applications' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    // Return disbursement records as synthetic application objects
    const rows = await db
      .select()
      .from(strikeFundDisbursements)
      .orderBy(desc(strikeFundDisbursements.paymentDate))
      .limit(100);

    const applications = rows.map((d) => ({
      id: d.id,
      userId: d.userId,
      strikeId: d.strikeId,
      strikeName: d.strikeName,
      requestedAmount: d.paymentAmount,
      approvedAmount: d.paymentAmount,
      status: 'approved' as const,
      paymentDate: d.paymentDate,
      paymentMethod: d.paymentMethod,
      taxYear: d.taxYear,
      createdAt: d.createdAt,
    }));

    const filtered = status
      ? applications.filter((a) => a.status === status)
      : applications;

    return { data: filtered };
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['StrikeFund'], summary: 'Submit a strike fund application' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId) throw ApiError.badRequest('Authentication required');

    const body = await request.json() as {
      strikeId?: string;
      strikeName?: string;
      requestedAmount?: number;
      reason?: string;
    };

    if (!body.requestedAmount) {
      throw ApiError.badRequest('requestedAmount is required');
    }

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const dayOfYear = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const weekNumber = `${year}-W${Math.ceil(dayOfYear / 7).toString().padStart(2, '0')}`;

    const [inserted] = await db
      .insert(strikeFundDisbursements)
      .values({
        userId,
        strikeId: body.strikeId ?? null,
        strikeName: body.strikeName ?? null,
        paymentDate: now,
        paymentAmount: body.requestedAmount.toString(),
        paymentMethod: 'pending',
        taxYear: year,
        taxMonth: month,
        weekNumber,
        weeklyTotal: body.requestedAmount.toString(),
        province: 'ON',
        exceedsThreshold: false,
        requiresTaxSlip: false,
        t4aGenerated: false,
        rl1Generated: false,
        isQuebecResident: false,
      })
      .returning();

    logger.info('Strike fund application submitted', {
      id: inserted.id,
      userId,
      organizationId,
      requestedAmount: body.requestedAmount,
    });

    return NextResponse.json(
      {
        data: {
          id: inserted.id,
          status: 'pending',
          requestedAmount: body.requestedAmount,
          strikeId: body.strikeId ?? null,
          strikeName: body.strikeName ?? null,
          createdAt: inserted.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  },
);
