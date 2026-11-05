/**
 * SMS Communications Console (client component)
 * Extracted from page for server-side auth wrapper
 *
 * What the SMS records hold, read-only. This release cannot send a text: there is no sender, no consent (opt-out) store the application may
 * write, and no route that creates a campaign, a template or a conversation. So the console lists the campaign records and the conversation
 * records that exist and offers no way to send, schedule, template, reply, mark read or archive. Nothing on it is an estimate or a placeholder:
 * a figure is a sum of stored counts, and a list that cannot be read says so instead of showing zeros.
 */

'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  MessageSquare,
  Send,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  Inbox,
  Clock,
  Play,
} from 'lucide-react';
import { SmsInbox } from '@/components/communications/sms-inbox';
import { ApiShapeError, envelopeRows, isRecord, readApiError } from '@/lib/client/api-envelope';

const COPY = {
  en: {
    description: 'The SMS campaign and conversation records that are stored',
    noticeTitle: 'Sending texts is not available in this release',
    noticeBody:
      'Nothing here sends, schedules or answers a text message, and there are no SMS templates. You can read the campaign and conversation records that already exist.',
    totals: (count: number) => `Across the ${count} campaign${count === 1 ? '' : 's'} listed`,
    loading: 'Loading campaigns...',
    loadFailed: 'The campaigns could not be loaded.',
    retry: 'Try again',
    viewInbox: 'View Inbox',
    inboxHelp: 'Read the stored conversations',
    noCampaigns: 'No campaigns yet',
    backToDashboard: 'Back to Dashboard',
  },
  fr: {
    description: 'Les campagnes et conversations SMS enregistrées',
    noticeTitle: 'L’envoi de textos n’est pas disponible dans cette version',
    noticeBody:
      'Rien ici n’envoie, ne planifie ni ne répond à un message texte, et il n’existe aucun modèle de SMS. Vous pouvez consulter les campagnes et les conversations déjà enregistrées.',
    totals: (count: number) => `Parmi les ${count} campagne${count === 1 ? '' : 's'} listée${count === 1 ? '' : 's'}`,
    loading: 'Chargement des campagnes...',
    loadFailed: 'Les campagnes n’ont pas pu être chargées.',
    retry: 'Réessayer',
    viewInbox: 'Voir la boîte de réception',
    inboxHelp: 'Lire les conversations enregistrées',
    noCampaigns: 'Aucune campagne pour l’instant',
    backToDashboard: 'Retour au tableau de bord',
  },
} as const;

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  totalCost: number;
}

/** A counter column defaults to 0, so a missing one reads as 0. */
const counted = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** A campaign record of GET /api/communications/sms/campaigns; a record without an id and a name is refused, not listed blank. */
function campaignFrom(row: unknown): Campaign {
  if (!isRecord(row) || typeof row.id !== 'string' || typeof row.name !== 'string') throw new ApiShapeError('not a campaign');
  const cost = Number.parseFloat(String(row.totalCost ?? '0'));
  return {
    id: row.id,
    name: row.name,
    description: typeof row.description === 'string' ? row.description : null,
    status: typeof row.status === 'string' ? row.status : 'draft',
    recipientCount: counted(row.recipientCount),
    sentCount: counted(row.sentCount),
    deliveredCount: counted(row.deliveredCount),
    failedCount: counted(row.failedCount),
    totalCost: Number.isFinite(cost) ? cost : 0,
  };
}

const percent = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export function SmsConsole() {
  const copy = useLocale().toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;
  const [activeView, setActiveView] = useState<'dashboard' | 'inbox'>('dashboard');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Load campaigns
  useEffect(() => {
    if (activeView !== 'dashboard') return;
    let stale = false;
    const load = async () => {
      try {
        const response = await fetch('/api/communications/sms/campaigns');
        if (!response.ok) throw new Error(await readApiError(response, copy.loadFailed));
        // withApi wraps the list route's { data: rows, pagination } in { success, data, timestamp }
        const rows = envelopeRows(await response.json()).map(campaignFrom);
        if (stale) return;
        setCampaigns(rows);
        setCampaignsError(null);
      } catch (error) {
        if (stale) return;
        setCampaigns([]);
        setCampaignsError(error instanceof Error && !(error instanceof ApiShapeError) ? error.message : copy.loadFailed);
      } finally {
        if (!stale) setIsLoadingCampaigns(false);
      }
    };
    void load();
    return () => {
      stale = true;
    };
  }, [activeView, reloadTick, copy.loadFailed]);

  // Totals are sums of the stored counts
  const stats = {
    messagesSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
    messagesDelivered: campaigns.reduce((sum, c) => sum + c.deliveredCount, 0),
    messagesFailed: campaigns.reduce((sum, c) => sum + c.failedCount, 0),
    totalCost: campaigns.reduce((sum, c) => sum + c.totalCost, 0),
  };

  // Render main dashboard
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{copy.totals(campaigns.length)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesDelivered.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {percent(stats.messagesDelivered, stats.messagesSent).toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesFailed}</div>
            <p className="text-xs text-muted-foreground">
              {percent(stats.messagesFailed, stats.messagesSent).toFixed(1)}% failure rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ${stats.messagesSent > 0 ? (stats.totalCost / stats.messagesSent).toFixed(4) : '0.0000'} per message
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversations */}
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
          <CardDescription>{copy.inboxHelp}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setActiveView('inbox')}>
            <Inbox className="mr-2 h-4 w-4" />
            {copy.viewInbox}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>Latest SMS campaigns with status and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">{copy.noCampaigns}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{campaign.name}</h4>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          campaign.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : campaign.status === 'sending' || campaign.status === 'active'
                            ? 'bg-blue-100 text-blue-700'
                            : campaign.status === 'scheduled'
                            ? 'bg-yellow-100 text-yellow-700'
                            : campaign.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {campaign.status === 'sending' && <Play className="mr-1 h-3 w-3" />}
                        {campaign.status === 'scheduled' && <Clock className="mr-1 h-3 w-3" />}
                        {campaign.status === 'completed' && <CheckCircle className="mr-1 h-3 w-3" />}
                        {campaign.status === 'cancelled' && <XCircle className="mr-1 h-3 w-3" />}
                        {campaign.status}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {campaign.recipientCount} recipients
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" />
                        {campaign.sentCount} sent
                      </span>
                      {campaign.sentCount > 0 && (
                        <>
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            {percent(campaign.deliveredCount, campaign.sentCount)}% delivered
                          </span>
                          {campaign.failedCount > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-3 w-3" />
                              {campaign.failedCount} failed
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-semibold">${campaign.totalCost.toFixed(2)}</div>
                    {campaign.sentCount > 0 && (
                      <div className="text-xs text-muted-foreground">
                        ${(campaign.totalCost / campaign.sentCount).toFixed(4)}/msg
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Communications</h1>
          <p className="text-muted-foreground">{copy.description}</p>
        </div>
        {activeView !== 'dashboard' && (
          <Button variant="outline" onClick={() => setActiveView('dashboard')}>
            {copy.backToDashboard}
          </Button>
        )}
      </div>

      <div role="status" className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{copy.noticeTitle}</p>
          <p className="text-sm">{copy.noticeBody}</p>
          <p className="mt-1 text-xs opacity-80">UE-ACTION-SMS-SEND</p>
        </div>
      </div>

      {/* Content */}
      {activeView === 'dashboard' && (
        <>
          {isLoadingCampaigns && <div className="text-sm text-muted-foreground">{copy.loading}</div>}
          {!isLoadingCampaigns && campaignsError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <span>{campaignsError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCampaignsError(null);
                  setIsLoadingCampaigns(true);
                  setReloadTick((tick) => tick + 1);
                }}
              >
                {copy.retry}
              </Button>
            </div>
          )}
          {!isLoadingCampaigns && !campaignsError && renderDashboard()}
        </>
      )}
      {activeView === 'inbox' && <SmsInbox />}
    </div>
  );
}
