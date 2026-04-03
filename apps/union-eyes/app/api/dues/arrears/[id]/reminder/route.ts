/**
 * Send Arrears Reminder to Member
 *
 * POST /api/dues/arrears/[id]/reminder
 *
 * Sends a dues arrears reminder notification to the member.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { memberArrears } from '@/db/schema/dues-finance-schema';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and } from 'drizzle-orm';
import { getNotificationService } from '@/lib/services/notification-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Send arrears reminder to a member' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

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

    await notificationService.send({
      organizationId,
      recipientId: memberId,
      recipientEmail: member.email,
      type: 'email',
      priority: 'high',
      subject: 'Union Dues Arrears — Reminder',
      title: 'Dues Arrears Reminder',
      body: `Hi ${member.name ?? 'Member'},\n\nThis is a reminder that you have outstanding union dues of $${amountOwed}.\n\nPlease contact your local to arrange payment or a payment plan.\n\nThank you.`,
      userId: userId ?? undefined,
    });

    logger.info('Arrears reminder sent', { memberId, amountOwed });

    return { sent: true };
  },
);
