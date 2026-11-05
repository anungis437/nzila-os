'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Flag, AlertCircle, Clock, Search, TrendingUp, Users, CheckCircle, XCircle, Pause, Eye, MapPin, Calendar, Target, Award } from 'lucide-react';
import { ApiShapeError } from '@/lib/client/api-envelope';
import { fetchAllRows } from '@/lib/client/crud-lists';
import { formatCampaignDate, formatStatusLabel, readCampaign, signingPercent, targetPercent, type Campaign } from './organizing-readers';

const LOAD_FAILED = 'Unable to load organizing campaigns. Please try again later.';
const DASH = '—';

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const statusMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    card_check: 'secondary',
    certification_pending: 'secondary',
    certification_vote: 'secondary',
    won: 'default',
    lost: 'destructive',
    research: 'outline',
    planning: 'outline',
    pre_campaign: 'outline',
    suspended: 'destructive',
    abandoned: 'destructive',
  };
  return statusMap[status] || 'outline';
}

function getStatusIcon(status: string) {
  const iconMap: Record<string, React.ReactElement> = {
    active: <TrendingUp className="w-4 h-4" />,
    card_check: <CheckCircle className="w-4 h-4" />,
    won: <Award className="w-4 h-4" />,
    lost: <XCircle className="w-4 h-4" />,
    suspended: <Pause className="w-4 h-4" />,
    research: <Search className="w-4 h-4" />,
  };
  return iconMap[status] || <Flag className="w-4 h-4" />;
}

export function OrganizingConsole() {
  const locale = useLocale();
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAllRows<unknown>('/api/organizing/campaigns');
      setCampaigns(rows.map(readCampaign));
    } catch (failure) {
      setError(failure instanceof ApiShapeError || failure instanceof TypeError ? LOAD_FAILED : (failure as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const needle = searchQuery.toLowerCase();
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.campaignName.toLowerCase().includes(needle) ||
      campaign.targetEmployer.toLowerCase().includes(needle) ||
      campaign.campaignCode.toLowerCase().includes(needle);
    return matchesSearch && (statusFilter === 'all' || campaign.status === statusFilter);
  });
  // The filters are the statuses the campaigns hold, not a fixed list some of them may never use.
  const statuses = [...new Set(campaigns.map((campaign) => campaign.status))].sort();

  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === 'active' || c.status === 'card_check').length,
    certified: campaigns.filter((c) => c.certificationDate !== null).length,
    totalWorkers: campaigns.reduce((sum, c) => sum + c.estimatedUnitSize, 0),
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading organizing campaigns...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <Card role="alert" className="border-2 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h3 className="text-xl font-semibold mb-2 text-red-900">Error Loading Campaigns</h3>
              <p className="text-red-800 mb-4">{error}</p>
              <Button variant="outline" onClick={() => void loadCampaigns()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Flag className="w-8 h-8" />
          Organizing Campaigns
        </h1>
        <p className="text-muted-foreground mt-1">Workplace organizing drives and certification campaigns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
                <p className="text-2xl font-bold">{stats.totalCampaigns}</p>
              </div>
              <Flag className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
                <p className="text-2xl font-bold">{stats.activeCampaigns}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Certified</p>
                <p className="text-2xl font-bold">{stats.certified}</p>
              </div>
              <Award className="w-10 h-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Workers</p>
                <p className="text-2xl font-bold">{stats.totalWorkers.toLocaleString()}</p>
              </div>
              <Users className="w-10 h-10 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search campaigns by name, employer, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>
                All
              </Button>
              {statuses.map((status) => (
                <Button key={status} variant={statusFilter === status ? 'default' : 'outline'} onClick={() => setStatusFilter(status)}>
                  {formatStatusLabel(status)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Flag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Campaigns Found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filters.' : 'No organizing campaign has been recorded yet.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredCampaigns.map((campaign) => {
            const percent = signingPercent(campaign);
            const target = targetPercent(campaign);
            return (
              <Card key={campaign.id} className="border-2 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{campaign.campaignName}</h3>
                        <Badge variant={getStatusBadgeVariant(campaign.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(campaign.status)}
                            {formatStatusLabel(campaign.status)}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{campaign.targetEmployer}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {campaign.workplaceLocation}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {campaign.estimatedUnitSize} estimated workers
                        </span>
                        <span className="text-xs bg-muted px-2 py-1 rounded">{campaign.campaignCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Card Signing Progress</span>
                      <span className="text-sm font-semibold">
                        {campaign.cardsSigned ?? DASH} / {campaign.estimatedUnitSize} ({percent === null ? DASH : `${percent.toFixed(1)}%`})
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                      {target !== null && <div className="absolute h-full border-l-2 border-yellow-800 opacity-50" style={{ left: `${Math.min(target, 100)}%` }} />}
                      <div className="h-full transition-all bg-blue-600" style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
                    </div>
                    {campaign.targetCardCount !== null && (
                      <div className="mt-1 text-xs text-muted-foreground">Target: {campaign.targetCardCount} cards</div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b">
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatCampaignDate(campaign.campaignStartDate, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Card Deadline</p>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {formatCampaignDate(campaign.targetCardDeadline, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Organizing Team</p>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {campaign.teamSize === null ? DASH : `${campaign.teamSize} members`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Campaign Type</p>
                      <p className="text-sm font-semibold">{formatStatusLabel(campaign.campaignType)}</p>
                    </div>
                  </div>

                  <Link href={`${localePrefix}/dashboard/organizing/${campaign.id}`}>
                    <Button variant="default" className="w-full" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Campaign
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
