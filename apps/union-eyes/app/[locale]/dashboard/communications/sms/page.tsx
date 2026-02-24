/**
 * SMS Communications Dashboard (Phase 5 - Week 1)
 * Main page for SMS management
 * 
 * Features:
 * - Quick stats (messages sent, delivered, failed, cost)
 * - Campaign list with status
 * - Template library
 * - SMS inbox for two-way conversations
 * - Quick actions (new campaign, new template, send single SMS)
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MessageSquare,
  Send,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  FileText,
  Plus,
  Inbox,
  Clock,
  Play,
} from 'lucide-react';
import { SmsTemplateEditor } from '@/components/communications/sms-template-editor';
import { SmsCampaignBuilder } from '@/components/communications/sms-campaign-builder';
import { SmsInbox } from '@/components/communications/sms-inbox';
 
import { useOrganizationId } from '@/lib/hooks/use-organization';

interface SmsPageProps {
  params: {
    locale: string;
  };
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  totalCost: string;
  successRate: number;
  failureRate: number;
  costPerMessage: string;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export default function SmsPage({ params: _params }: SmsPageProps) {
  const organizationId = useOrganizationId();
  const [activeView, setActiveView] = useState<'dashboard' | 'template' | 'campaign' | 'inbox'>(
    'dashboard'
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);

  // Load campaigns
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fetch('/api/communications/sms/campaigns');
        if (!response.ok) throw new Error('Failed to fetch campaigns');
        const data = await response.json();
        setCampaigns(data.campaigns);
      } catch (_error) {
} finally {
        setIsLoadingCampaigns(false);
      }
    };

    if (activeView === 'dashboard') {
      fetchCampaigns();
    }
  }, [activeView]);

  // Calculate stats from campaigns data
  const stats = {
    messagesSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
    messagesDelivered: campaigns.reduce((sum, c) => sum + c.deliveredCount, 0),
    messagesFailed: campaigns.reduce((sum, c) => sum + c.failedCount, 0),
    totalCost: campaigns.reduce((sum, c) => sum + parseFloat(c.totalCost || '0'), 0),
    campaignsActive: campaigns.filter((c) => c.status === 'active' || c.status === 'sending').length,
    templatesCount: 15,
    unreadMessages: 5,
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
            <p className="text-xs text-muted-foreground">This month</p>
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
              {((stats.messagesDelivered / stats.messagesSent) * 100).toFixed(1)}% success rate
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
              {((stats.messagesFailed / stats.messagesSent) * 100).toFixed(1)}% failure rate
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
              ${(stats.totalCost / stats.messagesSent).toFixed(4)} per message
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common SMS tasks</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={() => setActiveView('campaign')}>
            <Send className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
          <Button variant="outline" onClick={() => setActiveView('template')}>
            <FileText className="mr-2 h-4 w-4" />
            Create Template
          </Button>
          <Button variant="outline" onClick={() => setActiveView('inbox')}>
            <Inbox className="mr-2 h-4 w-4" />
            View Inbox {stats.unreadMessages > 0 && `(${stats.unreadMessages})`}
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
          {isLoadingCampaigns ? (
            <div className="text-sm text-muted-foreground">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No campaigns yet</p>
              <Button className="mt-4" onClick={() => setActiveView('campaign')}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Campaign
              </Button>
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
                            {campaign.successRate}% delivered
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
                    <div className="font-semibold">${parseFloat(campaign.totalCost).toFixed(2)}</div>
                    {campaign.sentCount > 0 && (
                      <div className="text-xs text-muted-foreground">
                        ${campaign.costPerMessage}/msg
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {campaigns.length > 5 && (
                <Button variant="outline" className="w-full mt-4">
                  View All Campaigns ({campaigns.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates Library */}
      <Card>
        <CardHeader>
          <CardTitle>Template Library</CardTitle>
          <CardDescription>{stats.templatesCount} templates available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => setActiveView('template')}
            >
              <Plus className="h-6 w-6" />
              <span>Create New Template</span>
            </Button>
            <div className="col-span-2 text-sm text-muted-foreground flex items-center justify-center">
              Create SMS templates for common messages and campaigns
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-sm text-muted-foreground">Loading organization...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Communications</h1>
          <p className="text-muted-foreground">
            Send bulk SMS, manage templates, and handle two-way conversations
          </p>
        </div>
        {activeView !== 'dashboard' && (
          <Button variant="outline" onClick={() => setActiveView('dashboard')}>
            Back to Dashboard
          </Button>
        )}
      </div>

      {/* Content */}
      {activeView === 'dashboard' && renderDashboard()}
      {activeView === 'template' && (
        <SmsTemplateEditor
          organizationId={organizationId}
          onSave={() => setActiveView('dashboard')}
          onCancel={() => setActiveView('dashboard')}
        />
      )}
      {activeView === 'campaign' && (
        <SmsCampaignBuilder
          organizationId={organizationId}
          onComplete={() => setActiveView('dashboard')}
          onCancel={() => setActiveView('dashboard')}
        />
      )}
      {activeView === 'inbox' && <SmsInbox organizationId={organizationId} />}
    </div>
  );
}
