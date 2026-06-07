/**
 * Campaign Detail Page
 * 
 * View and manage a single campaign
 * Path: /dashboard/communications/campaigns/[id]
 * 
 * Phase 4: Communications & Organizing
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  Mail, 
  MessageSquare, 
  Bell, 
  Send, 
  Edit, 
  Trash2,
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

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string;
  variables: Record<string, string>;
  segmentId: string | null;
  segmentQuery: Record<string, unknown> | null;
  testMode: boolean;
  audienceCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  completedAt: string | null;
  stats: {
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    bounced: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
  };
  settings: {
    trackOpens: boolean;
    trackClicks: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('communicationsCampaignDetailPage');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dryRunResult, setDryRunResult] = useState<unknown>(null);

  useEffect(() => {
    fetchCampaign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/messages/threads/${params.id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t('errors.notFound'));
        }
        throw new Error(t('errors.fetchFailed'));
      }

      const data = await response.json();
      setCampaign(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async (dryRun: boolean = false) => {
    try {
      setActionLoading(true);
      setError(null);

      const response = await fetch(`/api/messages/threads/${params.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('errors.sendFailed'));
      }

      const result = await response.json();
      
      if (dryRun) {
        setDryRunResult(result);
      } else {
        setShowSendDialog(false);
        await fetchCampaign(); // Refresh campaign data
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.sendFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCampaign = async () => {
    try {
      setActionLoading(true);
      setError(null);

      const response = await fetch(`/api/messages/threads/${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('errors.deleteFailed'));
      }

      router.push(`/${locale}/dashboard/communications/campaigns`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.deleteFailed'));
      setShowDeleteDialog(false);
    } finally {
      setActionLoading(false);
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

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'email':
        return t('channels.email');
      case 'sms':
        return t('channels.sms');
      case 'push':
        return t('channels.push');
      default:
        return channel;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'broadcast':
        return t('types.broadcast');
      case 'campaign':
        return t('types.campaign');
      case 'newsletter':
        return t('types.newsletter');
      case 'alert':
        return t('types.alert');
      default:
        return type;
    }
  };

  const calculateRates = () => {
    if (!campaign) return { deliveryRate: 0, openRate: 0, clickRate: 0 };
    
    const sent = campaign.stats.sent || 0;
    if (sent === 0) return { deliveryRate: 0, openRate: 0, clickRate: 0 };

    const deliveryRate = ((campaign.stats.delivered || 0) / sent) * 100;
    const openRate = ((campaign.stats.opened || 0) / campaign.stats.delivered) * 100;
    const clickRate = ((campaign.stats.clicked || 0) / campaign.stats.opened) * 100;

    return {
      deliveryRate: deliveryRate.toFixed(1),
      openRate: openRate.toFixed(1),
      clickRate: clickRate.toFixed(1),
    };
  };

  const canEdit = campaign && (campaign.status === 'draft' || campaign.status === 'scheduled');
  const canDelete = campaign && campaign.status === 'draft';
  const canSend = campaign && (campaign.status === 'draft' || campaign.status === 'scheduled');

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
        <Button
          variant="outline"
          onClick={() => router.push(`/${locale}/dashboard/communications/campaigns`)}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backButton')}
        </Button>
      </div>
    );
  }

  const rates = calculateRates();

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
              {campaign.testMode && (
                <Badge variant="outline" className="mt-2">
                  {t('testMode')}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {canSend && (
              <Button onClick={() => setShowSendDialog(true)} disabled={actionLoading}>
                <Send className="mr-2 h-4 w-4" />
                {t('actions.sendCampaign')}
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => router.push(`/${locale}/dashboard/communications/campaigns/${campaign.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </Button>
            )}
            {canDelete && (
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={actionLoading}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('actions.delete')}
              </Button>
            )}
            <Button variant="outline" onClick={fetchCampaign} disabled={actionLoading}>
              <RefreshCw className={`h-4 w-4 ${actionLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
            <div className="text-2xl font-bold">{campaign.audienceCount?.toLocaleString(locale) || 0}</div>
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
            <div className="text-2xl font-bold">{campaign.stats.sent?.toLocaleString(locale) || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.sent.description', { rate: rates.deliveryRate })}
            </p>
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
            <div className="text-2xl font-bold">{campaign.stats.opened?.toLocaleString(locale) || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.opened.description', { rate: rates.openRate })}
            </p>
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
            <div className="text-2xl font-bold">{campaign.stats.clicked?.toLocaleString(locale) || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.clicked.description', { rate: rates.clickRate })}
            </p>
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
              <div className="font-medium capitalize">{getTypeLabel(campaign.type)}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">{t('details.channel')}</div>
              <div className="font-medium capitalize flex items-center gap-2">
                {getChannelIcon(campaign.channel)}
                {getChannelLabel(campaign.channel)}
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
              <span className="font-medium">{campaign.stats.queued || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.sent')}</span>
              <span className="font-medium">{campaign.stats.sent || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.delivered')}</span>
              <span className="font-medium">{campaign.stats.delivered || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.failed')}</span>
              <span className="font-medium text-destructive">{campaign.stats.failed || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.bounced')}</span>
              <span className="font-medium text-destructive">{campaign.stats.bounced || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('delivery.unsubscribed')}</span>
              <span className="font-medium">{campaign.stats.unsubscribed || 0}</span>
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

          {campaign.settings && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              {campaign.settings.trackOpens && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('content.trackingOpens')}
                </div>
              )}
              {campaign.settings.trackClicks && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('content.trackingClicks')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', { name: campaign.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>{t('dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaign}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('deleteDialog.deleting')}
                </>
              ) : (
                t('deleteDialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sendDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sendDialog.description', {
                name: campaign.name,
                count: campaign.audienceCount,
              })}
              {campaign.testMode ? ` ${t('sendDialog.testModeNote')}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {dryRunResult && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div>{t('sendDialog.readyToSend', { count: dryRunResult.totalAudience })}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('sendDialog.estimatedCompletion', {
                      minutes: dryRunResult.estimatedCompletionMinutes,
                    })}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>{t('dialog.cancel')}</AlertDialogCancel>
            {!dryRunResult ? (
              <Button onClick={() => handleSendCampaign(true)} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('sendDialog.checking')}
                  </>
                ) : (
                  t('sendDialog.previewFirst')
                )}
              </Button>
            ) : (
              <AlertDialogAction
                onClick={() => handleSendCampaign(false)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('sendDialog.sending')}
                  </>
                ) : (
                  t('sendDialog.sendNow')
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
