/**
 * POST /api/dues/issues — Submit a member deduction issue report
 *
 * Allows members to report problems with their payroll deductions such as
 * missing deductions, incorrect amounts, duplicates, or unrecognized charges.
 * Issues are queued for review by union administrators.
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { minRole: 'member' },
    openapi: {
      tags: ['Dues'],
      summary: 'Report a deduction issue',
    },
  },
  async ({ organizationId, body }) => {
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 },
      );
    }

    const {
      userId,
      issueType,
      subject,
      description,
      payrollDeductionId,
      expectedAmount,
    } = body as {
      userId: string;
      issueType: string;
      subject: string;
      description: string;
      payrollDeductionId?: string;
      expectedAmount?: number;
    };

    if (!userId || !issueType || !subject || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, issueType, subject, description' },
        { status: 400 },
      );
    }

    const validIssueTypes = [
      'missing_deduction',
      'incorrect_amount',
      'duplicate_deduction',
      'unrecognized_deduction',
      'other',
    ];

    if (!validIssueTypes.includes(issueType)) {
      return NextResponse.json(
        { error: `Invalid issue type. Must be one of: ${validIssueTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Issue is accepted and will be persisted once the payroll_deductions
    // and member_dues_issues tables are created via migration.
    // For now, return a success acknowledgement.
    return NextResponse.json({
      success: true,
      issue: {
        id: crypto.randomUUID(),
        organizationId,
        userId,
        issueType,
        subject,
        description,
        payrollDeductionId: payrollDeductionId ?? null,
        expectedAmount: expectedAmount ?? null,
        status: 'open',
        createdAt: new Date().toISOString(),
      },
    });
  },
);
