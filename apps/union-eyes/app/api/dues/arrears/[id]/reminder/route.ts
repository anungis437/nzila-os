/**
 * Send Arrears Reminder to Member
 *
 * POST /api/dues/arrears/[id]/reminder
 *
 * Sends a dues arrears reminder notification to the member.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { db } from '@/db';
import { memberArrears } from '@/db/schema/dues-finance-schema';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and } from 'drizzle-orm';
import { getNotificationService } from '@/lib/services/notification-service';
import { logger } from '@/lib/logger';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Send arrears reminder to a member' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const memberId = params.id;

    // Look up arrears record
    const [arrears] = await db
      .select()
      .from(memberArrears)
      .where(
        and(
          eq(memberArrears.userId, memberId),
          eq(memberArrears.organizationId, organizationId),
        ),
      );

    if (!arrears) throw ApiError.notFound('Arrears record not found');

    // Look up member contact info
    const [member] = await db
      .select({ name: organizationMembers.name, email: organizationMembers.email })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, memberId),
          eq(organizationMembers.organizationId, organizationId),
        ),
      );

    if (!member?.email) {
      throw ApiError.badRequest('Member email not found — cannot send reminder');
    }

    const notificationService = getNotificationService();
    const amountOwed = parseFloat(arrears.totalOwed ?? '0').toFixed(2);

    // A message is an effect outside the database: the intent is recorded before it is sent, the outcome after.
    try {
      await performAuditedOperation(
        { organizationId, userId, action: 'dues.arrears.reminder', resourceType: 'member_arrears', resourceId: arrears.id, details: { memberId } },
        () => notificationService.send({
      organizationId,
      recipientId: memberId,
      recipientEmail: member.email,
      type: 'email',
      priority: 'high',
      subject: 'Union Dues Arrears — Reminder',
      title: 'Dues Arrears Reminder',
      body: `Hi ${member.name ?? 'Member'},\n\nThis is a reminder that you have outstanding union dues of $${amountOwed}.\n\nPlease contact your local to arrange payment or a payment plan.\n\nThank you.`,
      userId: userId ?? undefined,
        }),
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }

    logger.info('Arrears reminder sent', { memberId, amountOwed });

    return { sent: true };
  },
);
