import { and, eq, inArray, ne } from 'drizzle-orm';

import { communicationPreferences, consentRecords, newsletterDistributionLists, newsletterListSubscribers } from '@/db/schema';
import type { RLSTx } from '@/lib/db/with-rls-context';

/**
 * Ends one recipient's email communication with one organization, on the caller's transaction: the preference, the organization's list
 * subscriptions and a consent record. The consent record is the durable evidence of the revocation (who, how, why and for which campaign) and is
 * written in the same transaction as the change it records, so a failure leaves neither.
 *
 * The caller has already verified the signed capability that authorizes exactly this recipient for this organization.
 */
export async function revokeEmailForOrganization(
  tx: RLSTx,
  organizationId: string,
  recipientId: string,
  reason: string,
  campaignId: string | null,
): Promise<void> {
  const now = new Date();
  const [existingPreference] = await tx
    .select({ id: communicationPreferences.id })
    .from(communicationPreferences)
    .where(and(eq(communicationPreferences.organizationId, organizationId), eq(communicationPreferences.userId, recipientId)))
    .limit(1);

  if (existingPreference) {
    await tx
      .update(communicationPreferences)
      .set({ emailEnabled: false, globallyUnsubscribed: true, unsubscribedAt: now, unsubscribeReason: reason, updatedAt: now })
      .where(and(eq(communicationPreferences.id, existingPreference.id), eq(communicationPreferences.organizationId, organizationId)));
  } else {
    await tx.insert(communicationPreferences).values({
      organizationId,
      userId: recipientId,
      emailEnabled: false,
      globallyUnsubscribed: true,
      unsubscribedAt: now,
      unsubscribeReason: reason,
    });
  }

  // An unsubscribe also ends the recipient's subscriptions to this organization's distribution lists.
  await tx
    .update(newsletterListSubscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: now })
    .where(
      and(
        eq(newsletterListSubscribers.profileId, recipientId),
        ne(newsletterListSubscribers.status, 'unsubscribed'),
        inArray(
          newsletterListSubscribers.listId,
          tx.select({ id: newsletterDistributionLists.id }).from(newsletterDistributionLists).where(eq(newsletterDistributionLists.organizationId, organizationId)),
        ),
      ),
    );

  await tx.insert(consentRecords).values({
    organizationId,
    userId: recipientId,
    consentType: 'email_marketing',
    channel: 'email',
    status: 'revoked',
    method: 'unsubscribe_link',
    metadata: { reason, campaignId },
  });
}
