/**
 * The communications hub's figures, read inside the organization's own transaction.
 *
 * The page read these five tables through the module-level handle with no organization set, so the runtime role saw none of them, and a
 * failure was logged and rendered as zeros. Every statement here runs in withRLSContext({ organizationId }); a failure is thrown to the page.
 */
import { count, desc, eq, sql, sum } from 'drizzle-orm';
import { campaigns, messageTemplates, newsletterDistributionLists, smsCampaigns } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';

export interface CommunicationsHubMetrics {
  /** Campaigns that are scheduled, sending or sent. */
  activeCampaignCount: number;
  scheduledCount: number;
  sentCount: number;
  listCount: number;
  totalSubscribers: number;
  templateCount: number;
  smsCampaignCount: number;
  recentCampaigns: Array<Pick<typeof campaigns.$inferSelect, 'id' | 'name' | 'status' | 'channel' | 'createdAt'>>;
}

export function loadCommunicationsHubMetrics(organizationId: string): Promise<CommunicationsHubMetrics> {
  return withRLSContext({ organizationId }, async (tx) => {
    const ownCampaigns = eq(campaigns.organizationId, organizationId);

    const [{ active, scheduled, sent }] = await tx
      .select({
        active: sql<number>`count(*) filter (where ${campaigns.status} in ('scheduled', 'sending', 'sent'))::int`,
        scheduled: sql<number>`count(*) filter (where ${campaigns.status} = 'scheduled')::int`,
        sent: sql<number>`count(*) filter (where ${campaigns.status} = 'sent')::int`,
      })
      .from(campaigns)
      .where(ownCampaigns);
    const [lists] = await tx
      .select({ listCount: count(), totalSubscribers: sum(newsletterDistributionLists.subscriberCount) })
      .from(newsletterDistributionLists)
      .where(eq(newsletterDistributionLists.organizationId, organizationId));
    const [templates] = await tx.select({ value: count() }).from(messageTemplates).where(eq(messageTemplates.organizationId, organizationId));
    const [sms] = await tx.select({ value: count() }).from(smsCampaigns).where(eq(smsCampaigns.organizationId, organizationId));
    const recentCampaigns = await tx
      .select({ id: campaigns.id, name: campaigns.name, status: campaigns.status, channel: campaigns.channel, createdAt: campaigns.createdAt })
      .from(campaigns)
      .where(ownCampaigns)
      .orderBy(desc(campaigns.createdAt))
      .limit(5);

    return {
      activeCampaignCount: active,
      scheduledCount: scheduled,
      sentCount: sent,
      listCount: lists?.listCount ?? 0,
      totalSubscribers: Number(lists?.totalSubscribers ?? 0),
      templateCount: templates?.value ?? 0,
      smsCampaignCount: sms?.value ?? 0,
      recentCampaigns,
    };
  });
}
