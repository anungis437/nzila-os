/**
 * Campaign Detail Page
 *
 * Shows one campaign as it is stored: its content, its status and the delivery statistics its row holds. There is no sender in this release
 * (UE-ACTION-CAMPAIGN-SEND), so there is nothing to send from here; the generic delete route refuses campaigns (their status has no archived
 * value), and there is no edit page, so the page offers none of the three.
 * Path: /dashboard/communications/campaigns/[id]
 */

'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ApiShapeError, envelopeRow, readApiError } from '@/lib/client/api-envelope';
import { campaignFrom, rate, type CampaignRecord, type Counter } from '@/lib/communications/campaign-record';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Bell,
  Send,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Users,
  Eye,
  MousePointerClick,
  Clock,
  Calendar,
} from 'lucide-react';

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations('communicationsCampaignDetailPage');
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/communications/campaigns/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t('errors.notFound'));
        }
        throw new Error(await readApiError(response, t('errors.fetchFailed')));
      }

      setCampaign(campaignFrom(envelopeRow(await response.json())));
    } catch (err) {
      setCampaign(null);
      setError(err instanceof Error && !(err instanceof ApiShapeError) ? err.message : t('errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5" />;
      case 'push':
        return <Bell className="h-5 w-5" />;
      default:
        return <Mail className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      draft: 'secondary',
      scheduled: 'outline',
      sending: 'default',
      sent: 'default',
      paused: 'secondary',
      cancelled: 'destructive',
      failed: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'default'} className="text-sm">
        {t(`statuses.${status}`)}
      </Badge>
    );
  };

  // A rate whose base is zero or not recorded is not worked out: it is absent, never 0% and never NaN.
  const rates = {
    delivery: campaign ? rate(campaign.stats.delivered, campaign.stats.sent) : null,
    open: campaign ? rate(campaign.stats.opened, campaign.stats.delivered) : null,
    click: campaign ? rate(campaign.stats.clicked, campaign.stats.opened) : null,
  };
  // A counter the row does not record is "—", not 0.
  const figure = (value: Counter) => (value === null ? '—' : value.toLocaleString(locale));

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || t('errors.notFound')}</AlertDescription>
        </Alert>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/dashboard/communications/campaigns`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backButton')}
          </Button>
          <Button variant="outline" onClick={fetchCampaign}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/dashboard/communications/campaigns`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backButton')}
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-muted rounded-lg">
              {getChannelIcon(campaign.channel)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold">{campaign.name}</h1>
                {getStatusBadge(campaign.status)}
              </div>
              {campaign.description && (
                <p className="text-muted-foreground">{campaign.description}</p>
              )}
            </div>
          </div>

          <Button variant="outline" onClick={fetchCampaign}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CapabilityUnavailable locale={locale} capability="UE-ACTION-CAMPAIGN-SEND" />

      {/* Key Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('stats.audience.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.audienceCount !== null && campaign.audienceCount > 0 ? campaign.audienceCount.toLocaleString(locale) : '—'}</div>
            <p className="text-xs text-muted-foreground">{t('stats.audience.description')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              {t('stats.sent.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{figure(campaign.stats.sent)}</div>
            {rates.delivery !== null && (
              <p className="text-xs text-muted-foreground">
                {t('stats.sent.description', { rate: rates.delivery })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              {t('stats.opened.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{figure(campaign.stats.opened)}</div>
            {rates.open !== null && (
              <p className="text-xs text-muted-foreground">
                {t('stats.opened.description', { rate: rates.open })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              {t('stats.clicked.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{figure(campaign.stats.clicked)}</div>
            {rates.click !== null && (
              <p className="text-xs text-muted-foreground">
                {t('stats.clicked.description', { rate: rates.click })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('details.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">{t('details.type')}</div>
              <div className="font-medium">{t(`types.${campaign.type}`)}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">{t('details.channel')}</div>
              <div className="font-medium flex items-center gap-2">
                {getChannelIcon(campaign.channel)}
                {t(`channels.${campaign.channel}`)}
              </div>
            </div>

            {campaign.scheduledAt && (
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t('details.scheduledFor')}
                </div>
                <div className="font-medium">
                  {new Date(campaign.scheduledAt).toLocaleString(locale)}
                </div>
              </div>
            )}

            {campaign.sentAt && (
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('details.sentAt')}
                </div>
                <div className="font-medium">
                  {new Date(campaign.sentAt).toLocaleString(locale)}
                </div>
              </div>
            )}

            {campaign.completedAt && (
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('details.completedAt')}
                </div>
                <div className="font-medium">
                  {new Date(campaign.completedAt).toLocaleString(locale)}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm text-muted-foreground">{t('details.created')}</div>
              <div className="font-medium">
                {new Date(campaign.createdAt).toLocaleString(locale)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Stats */}
        <Card>
          <CardHeader>
            <CardTitle>{t('delivery.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.queued')}</span>
              <span className="font-medium">{figure(campaign.stats.queued)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.sent')}</span>
              <span className="font-medium">{figure(campaign.stats.sent)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.delivered')}</span>
              <span className="font-medium">{figure(campaign.stats.delivered)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.failed')}</span>
              <span className="font-medium text-destructive">{figure(campaign.stats.failed)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.bounced')}</span>
              <span className="font-medium text-destructive">{figure(campaign.stats.bounced)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.unsubscribed')}</span>
              <span className="font-medium">{figure(campaign.stats.unsubscribed)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('content.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaign.subject && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t('content.subject')}</div>
              <div className="font-medium">{campaign.subject}</div>
            </div>
          )}

          <div>
            <div className="text-sm text-muted-foreground mb-1">{t('content.message')}</div>
            <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
              {campaign.body}
            </div>
          </div>

          {(campaign.trackOpens || campaign.trackClicks) && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              {campaign.trackOpens && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('content.trackingOpens')}
                </div>
              )}
              {campaign.trackClicks && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('content.trackingClicks')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
