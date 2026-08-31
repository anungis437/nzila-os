/**
 * POST /api/dues/issues — Submit a member deduction issue report
 *
 * Allows members to report problems with their payroll deductions such as
 * missing deductions, incorrect amounts, duplicates, or unrecognized charges.
 * Persisted to member_dues_issues for review by union administrators.
 */

import { NextResponse } from 'next/server';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { memberDuesIssues } from '@/db/schema/dues-finance-schema';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Dues'],
      summary: 'Report a deduction issue',
    },
  },
  async ({ organizationId, userId, body }) => {
    if (!organizationId || !userId) {
      throw ApiError.badRequest('Organization/user context required');
    }

    const {
      issueType,
      subject,
      description,
      payrollDeductionId,
      expectedAmount,
    } = body as {
      issueType: string;
      subject: string;
      description: string;
      payrollDeductionId?: string;
      expectedAmount?: number;
    };

    if (!issueType || !subject || !description) {
      throw ApiError.badRequest('Missing required fields: issueType, subject, description');
    }

    const validIssueTypes = [
      'missing_deduction',
      'incorrect_amount',
      'duplicate_deduction',
      'unrecognized_deduction',
      'other',
    ];

    if (!validIssueTypes.includes(issueType)) {
      throw ApiError.badRequest(`Invalid issue type. Must be one of: ${validIssueTypes.join(', ')}`);
    }

    const [issue] = await db
      .insert(memberDuesIssues)
      .values({
        organizationId,
        userId,
        issueType,
        subject,
        description,
        payrollDeductionId: payrollDeductionId ?? null,
        expectedAmount: expectedAmount != null ? expectedAmount.toFixed(2) : null,
        status: 'open',
      })
      .returning();

    return NextResponse.json({
      success: true,
      issue,
    });
  },
);
