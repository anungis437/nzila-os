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
import { loadCommunicationsHubMetrics, type CommunicationsHubMetrics } from "@/lib/communications/hub-metrics";
import { isUuid } from "@/lib/page-data/uuid";
import { logger } from "@/lib/logger";
// NOTE (Wave 0 §3 — semantic demo isolation): The prior implementation
// contained a runtime-gated branch that dynamically imported a demo
// communications page from `@/components/demo/*`. Both the demo component
// and the runtime gate have been removed from the operational build. Demo
// behaviour now lives exclusively in the `@nzila/union-eyes-demo`
// artifact (`apps/union-eyes-demo/`).

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

// Shown in place of the figures when they could not be read; the message catalogues are shared, so the copy is kept here.
const FIGURES_UNAVAILABLE = {
  en: {
    title: 'The communications figures could not be loaded',
    body: 'The campaign, distribution list and template totals are unavailable right now. Reload the page to try again.',
    recent: 'Recent campaigns could not be loaded.',
  },
  fr: {
    title: 'Les chiffres des communications n’ont pas pu être chargés',
    body: 'Les totaux des campagnes, des listes de distribution et des modèles sont indisponibles pour le moment. Rechargez la page pour réessayer.',
    recent: 'Les campagnes récentes n’ont pas pu être chargées.',
  },
} as const;

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

  // A caller with no tenant organization (a platform administrator who belongs to none) has no hub to show.
  if (!isUuid(user.organizationId)) {
    redirect(`/${locale}/dashboard`);
  }
  // A failed read is shown as "could not load", never as a count of zero.
  let metrics: CommunicationsHubMetrics | null = null;
  try {
    metrics = await loadCommunicationsHubMetrics(user.organizationId);
  } catch (error) {
    logger.error('Communications hub figures failed to load', error, { organizationId: user.organizationId });
  }
  const unavailable = FIGURES_UNAVAILABLE[locale.toLowerCase().startsWith('fr') ? 'fr' : 'en'];

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
      {metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('stats.activeCampaigns')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeCampaignCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('stats.scheduled', { count: metrics.scheduledCount })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('stats.distributionLists')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.listCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('stats.totalSubscribers', { count: metrics.totalSubscribers.toLocaleString() })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('stats.templates')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.templateCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('stats.acrossChannels')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('stats.campaignsSent')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.sentCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('stats.smsCampaigns', { count: metrics.smsCampaignCount })}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">{unavailable.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{unavailable.body}</p>
        </div>
      )}

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
                  {metrics === null && (
                    <p className="text-sm text-muted-foreground">{unavailable.recent}</p>
                  )}
                  {metrics?.recentCampaigns.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('overview.recentActivity.empty')}</p>
                  )}
                  {metrics?.recentCampaigns.map((c) => {
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
                    {/* No text can be sent in this release; the SMS tab lists the records that exist. */}
                    {locale.toLowerCase().startsWith('fr') ? 'Consulter les SMS enregistrés' : 'View stored SMS records'}
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
