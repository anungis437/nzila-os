/**
 * POST /api/dues/issues — Submit a member deduction issue report
 *
 * Allows members to report problems with their payroll deductions such as
 * missing deductions, incorrect amounts, duplicates, or unrecognized charges.
 * Persisted to member_dues_issues for review by union administrators.
 */

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { memberDuesIssues, payrollDeductions } from '@/db/schema/dues-finance-schema';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SUBJECT_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
// expected_amount is numeric(10,2).
const MAX_EXPECTED_AMOUNT = 99_999_999.99;

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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw ApiError.badRequest('A JSON object is required');
    }

    const {
      issueType,
      subject,
      description,
      payrollDeductionId,
      expectedAmount,
    } = body as Record<string, unknown>;

    if (typeof issueType !== 'string' || typeof subject !== 'string' || typeof description !== 'string' || !issueType || !subject.trim() || !description.trim()) {
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

    if (subject.length > MAX_SUBJECT_LENGTH) {
      throw ApiError.badRequest(`subject must be at most ${MAX_SUBJECT_LENGTH} characters`);
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw ApiError.badRequest(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    }

    const deductionId = payrollDeductionId ?? null;
    if (deductionId !== null && (typeof deductionId !== 'string' || !UUID.test(deductionId))) {
      throw ApiError.badRequest('payrollDeductionId must be a UUID');
    }

    const amount = expectedAmount ?? null;
    if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > MAX_EXPECTED_AMOUNT)) {
      throw ApiError.badRequest('expectedAmount must be a non-negative amount');
    }

    // A member reports an issue about their own deductions; it is filed as the caller's, as open.
    const issue = await withRLSContext({ organizationId }, async (tx) => {
      // The deduction an issue names must be one of the caller's own: another member's deduction is not found, exactly as one that does not exist is.
      if (deductionId !== null) {
        const [owned] = await tx
          .select({ id: payrollDeductions.id })
          .from(payrollDeductions)
          .where(and(eq(payrollDeductions.id, deductionId), eq(payrollDeductions.organizationId, organizationId), eq(payrollDeductions.userId, userId)))
          .limit(1);
        if (!owned) throw ApiError.notFound('Payroll deduction');
      }
      const [row] = await tx
        .insert(memberDuesIssues)
        .values({
          organizationId,
          userId,
          issueType,
          subject,
          description,
          payrollDeductionId: deductionId,
          expectedAmount: amount !== null ? amount.toFixed(2) : null,
          status: 'open',
        })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'dues.issue.report',
        resourceType: 'member_dues_issues',
        resourceId: row.id,
        details: { issueType },
      });
      return row;
    });

    return NextResponse.json({
      success: true,
      issue,
    });
  },
);
