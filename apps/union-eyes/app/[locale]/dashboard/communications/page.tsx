/**
 * Communications Dashboard - Main Hub
 * Central hub for campaigns, distribution lists, templates, and SMS
 */

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, FileText, Mail, BarChart3, Send } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import CampaignsPage from "./campaigns/page";
import DistributionListsPage from "./distribution-lists/page";
import TemplatesPage from "./templates/page";
import { SmsConsole } from "@/components/communications/sms-console";
import { db } from "@/db";
import { campaigns, messageTemplates, newsletterDistributionLists, smsCampaigns } from "@/db/schema";
import { eq, and, inArray, count, sum, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

/** Fetch all hub metrics in parallel */
async function getHubMetrics(orgId: string) {
  try {
    const [
      activeCampaigns,
      scheduledCampaigns,
      sentCampaigns,
      distributionListStats,
      templateCount,
      smsCampaignCount,
      recentCampaigns,
    ] = await Promise.all([
      // Active campaigns (scheduled, sending, or sent)
      db.select({ value: count() })
        .from(campaigns)
        .where(and(
          eq(campaigns.organizationId, orgId),
          inArray(campaigns.status, ['scheduled', 'sending', 'sent']),
        )),
      // Scheduled only
      db.select({ value: count() })
        .from(campaigns)
        .where(and(
          eq(campaigns.organizationId, orgId),
          eq(campaigns.status, 'scheduled'),
        )),
      // Sent campaigns (completed sends)
      db.select({ value: count() })
        .from(campaigns)
        .where(and(
          eq(campaigns.organizationId, orgId),
          eq(campaigns.status, 'sent'),
        )),
      // Distribution lists count + total subscribers
      db.select({ listCount: count(), totalSubscribers: sum(newsletterDistributionLists.subscriberCount) })
        .from(newsletterDistributionLists)
        .where(eq(newsletterDistributionLists.organizationId, orgId)),
      // Templates count
      db.select({ value: count() })
        .from(messageTemplates)
        .where(eq(messageTemplates.organizationId, orgId)),
      // SMS campaigns count
      db.select({ value: count() })
        .from(smsCampaigns)
        .where(eq(smsCampaigns.organizationId, orgId)),
      // Recent campaigns for activity feed
      db.select({
        id: campaigns.id,
        name: campaigns.name,
        status: campaigns.status,
        channel: campaigns.channel,
        createdAt: campaigns.createdAt,
      })
        .from(campaigns)
        .where(eq(campaigns.organizationId, orgId))
        .orderBy(desc(campaigns.createdAt))
        .limit(5),
    ]);

    return {
      activeCampaignCount: activeCampaigns[0]?.value ?? 0,
      scheduledCount: scheduledCampaigns[0]?.value ?? 0,
      sentCount: sentCampaigns[0]?.value ?? 0,
      listCount: distributionListStats[0]?.listCount ?? 0,
      totalSubscribers: Number(distributionListStats[0]?.totalSubscribers ?? 0),
      templateCount: templateCount[0]?.value ?? 0,
      smsCampaignCount: smsCampaignCount[0]?.value ?? 0,
      recentCampaigns: recentCampaigns,
    };
  } catch (err) {
    logger.error('Failed to fetch hub metrics', err);
    return {
      activeCampaignCount: 0, scheduledCount: 0, sentCount: 0,
      listCount: 0, totalSubscribers: 0, templateCount: 0,
      smsCampaignCount: 0, recentCampaigns: [],
    };
  }
}

function formatTimeAgo(date: Date | null, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (!date) return t('time.justNow');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return t('time.minutesAgo', { count: diffMin });
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return t('time.hoursAgo', { count: diffHrs });
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return t('time.daysAgo', { count: diffDays });
  return date.toLocaleDateString();
}

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  push: Send,
  multi_channel: BarChart3,
};

export default async function CommunicationsDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'communicationsHubPage' });
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect(`/${locale}/login`);
  }
  if (!(await hasMinRole("steward"))) {
    redirect(`/${locale}/dashboard`);
  }

  const orgId = user.organizationId;
  const metrics = orgId ? await getHubMetrics(orgId) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8 text-primary" />
          {t('header.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('header.description')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('stats.activeCampaigns')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeCampaignCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('stats.scheduled', { count: metrics?.scheduledCount ?? 0 })}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('stats.distributionLists')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.listCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('stats.totalSubscribers', { count: (metrics?.totalSubscribers ?? 0).toLocaleString() })}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('stats.templates')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.templateCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('stats.acrossChannels')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('stats.campaignsSent')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.sentCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('stats.smsCampaigns', { count: metrics?.smsCampaignCount ?? 0 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="campaigns">{t('tabs.campaigns')}</TabsTrigger>
          <TabsTrigger value="lists">{t('tabs.distributionLists')}</TabsTrigger>
          <TabsTrigger value="templates">{t('tabs.templates')}</TabsTrigger>
          <TabsTrigger value="sms">{t('tabs.sms')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>{t('overview.recentActivity.title')}</CardTitle>
                <CardDescription>{t('overview.recentActivity.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(metrics?.recentCampaigns ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('overview.recentActivity.empty')}</p>
                  )}
                  {(metrics?.recentCampaigns ?? []).map((c) => {
                    const Icon = channelIcons[c.channel] ?? Mail;
                    return (
                      <div key={c.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <Icon className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.status} &middot; {c.channel} &middot; {formatTimeAgo(c.createdAt, t)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>{t('overview.quickActions.title')}</CardTitle>
                <CardDescription>{t('overview.quickActions.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${locale}/dashboard/communications/campaigns/new`}>
                    <Send className="mr-2 h-4 w-4" />
                    {t('overview.quickActions.createCampaign')}
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${locale}/dashboard/communications/sms`}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {t('overview.quickActions.sendSms')}
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${locale}/dashboard/communications/distribution-lists`}>
                    <Users className="mr-2 h-4 w-4" />
                    {t('overview.quickActions.manageLists')}
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${locale}/dashboard/communications/templates`}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t('overview.quickActions.browseTemplates')}
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/${locale}/dashboard/communications/campaigns`}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {t('overview.quickActions.viewAnalytics')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsPage />
        </TabsContent>

        <TabsContent value="lists">
          <DistributionListsPage />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesPage />
        </TabsContent>

        <TabsContent value="sms">
          <SmsConsole />
        </TabsContent>
      </Tabs>
    </div>
  );
}
