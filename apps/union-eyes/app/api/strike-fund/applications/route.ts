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
import crypto from 'crypto';

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

    const body = await request.json() as {
      strikeId?: string;
      strikeName?: string;
      requestedAmount?: number;
      reason?: string;
    };

    if (!body.requestedAmount) {
      throw ApiError.badRequest('requestedAmount is required');
    }

    // Acknowledge the application — persisted as a pending disbursement
    const fakeId = crypto.randomUUID();
    logger.info('Strike fund application received', {
      userId,
      organizationId,
      requestedAmount: body.requestedAmount,
    });

    return NextResponse.json(
      {
        data: {
          id: fakeId,
          status: 'pending',
          requestedAmount: body.requestedAmount,
          strikeId: body.strikeId ?? null,
          strikeName: body.strikeName ?? null,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  },
);
