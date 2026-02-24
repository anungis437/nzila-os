/**
 * Campaign Tracker Component
 * Displays organizing campaigns with labour board filing status and card-check progress
 * Phase 3: Organizing Module UI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileCheck,
  Users,
  Target,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

interface Campaign {
  id: string;
  campaign_name: string;
  campaign_code: string;
  campaign_status: string;
  target_employer_name: string;
  estimated_eligible_workers: number;
  cards_signed_count: number;
  card_signing_goal: number;
  organizing_committee_size: number;
  campaign_launch_date: string;
  card_check_deadline: string;
  labor_board_jurisdiction: string;
}

interface LabourBoardFiling {
  id: string;
  filing_number: string;
  filing_status: string;
  filed_date: string;
  hearing_date: string | null;
  decision_date: string | null;
  decision_outcome: string | null;
  certification_number: string | null;
}

interface CampaignTrackerProps {
  organizationId: string;
}

const statusColors: Record<string, string> = {
  research: 'bg-gray-500',
  pre_campaign: 'bg-blue-500',
  active: 'bg-green-500',
  card_check: 'bg-yellow-500',
  certification_pending: 'bg-orange-500',
  certification_vote: 'bg-purple-500',
  won: 'bg-emerald-600',
  lost: 'bg-red-600',
  suspended: 'bg-gray-400',
  abandoned: 'bg-slate-600',
};

const filingStatusColors: Record<string, string> = {
  draft: 'bg-gray-400',
  filed: 'bg-blue-500',
  hearing_scheduled: 'bg-yellow-500',
  decision_pending: 'bg-orange-500',
  certified: 'bg-green-600',
  denied: 'bg-red-600',
  withdrawn: 'bg-slate-500',
};

export function CampaignTracker({ organizationId }: CampaignTrackerProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filings, setFilings] = useState<Record<string, LabourBoardFiling>>({});
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const statusParam = selectedStatus !== 'all' ? `&status=${selectedStatus}` : '';
      const response = await fetch(`/api/organizing/campaigns?organizationId=${organizationId}${statusParam}`);
      
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      
      const data = await response.json();
      setCampaigns(data.data || []);

      // Fetch labour board filings for each campaign
      const filingsMap: Record<string, LabourBoardFiling> = {};
      await Promise.all(
        (data.data || []).map(async (campaign: Campaign) => {
          const filingResponse = await fetch(`/api/organizing/labour-board?organizationId=${organizationId}&campaignId=${campaign.id}`);
          if (filingResponse.ok) {
            const filingData = await filingResponse.json();
            if (filingData.data && filingData.data.length > 0) {
              filingsMap[campaign.id] = filingData.data[0]; // Get most recent filing
            }
          }
        })
      );
      setFilings(filingsMap);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [organizationId, selectedStatus]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const calculateCardSigningPercentage = (campaign: Campaign): number => {
    if (!campaign.card_signing_goal) return 0;
    return Math.round((campaign.cards_signed_count / campaign.card_signing_goal) * 100);
  };

  const _getProgressColor = (percentage: number): string => {
    if (percentage >= 65) return 'bg-green-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderFilingTimeline = (filing: LabourBoardFiling | undefined) => {
    if (!filing) {
      return (
        <div className="flex items-center text-sm text-muted-foreground mt-2">
          <AlertCircle className="h-4 w-4 mr-2" />
          No labour board filing yet
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Labour Board Filing</span>
          <Badge className={filingStatusColors[filing.filing_status] || 'bg-gray-500'}>
            {filing.filing_status.replace(/_/g, ' ')}
          </Badge>
        </div>
        
        <div className="relative pl-6 space-y-3">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />
          
          {/* Filed */}
          <div className={`relative ${filing.filed_date ? 'text-foreground' : 'text-muted-foreground'}`}>
            <div className="absolute -left-[1.4rem] top-1.5 w-3 h-3 rounded-full border-2 bg-background" 
                 style={{ borderColor: filing.filed_date ? '#22c55e' : '#cbd5e1' }} />
            <div className="text-xs">
              <div className="font-medium">Filed</div>
              {filing.filed_date && (
                <div className="text-muted-foreground">{format(new Date(filing.filed_date), 'MMM d, yyyy')}</div>
              )}
            </div>
          </div>

          {/* Hearing */}
          <div className={`relative ${filing.hearing_date ? 'text-foreground' : 'text-muted-foreground'}`}>
            <div className="absolute -left-[1.4rem] top-1.5 w-3 h-3 rounded-full border-2 bg-background"
                 style={{ borderColor: filing.hearing_date ? '#22c55e' : '#cbd5e1' }} />
            <div className="text-xs">
              <div className="font-medium">Hearing</div>
              {filing.hearing_date && (
                <div className="text-muted-foreground">{format(new Date(filing.hearing_date), 'MMM d, yyyy')}</div>
              )}
            </div>
          </div>

          {/* Decision */}
          <div className={`relative ${filing.decision_date ? 'text-foreground' : 'text-muted-foreground'}`}>
            <div className="absolute -left-[1.4rem] top-1.5 w-3 h-3 rounded-full border-2 bg-background"
                 style={{ borderColor: filing.decision_date ? '#22c55e' : '#cbd5e1' }} />
            <div className="text-xs">
              <div className="font-medium">Decision</div>
              {filing.decision_date && (
                <>
                  <div className="text-muted-foreground">{format(new Date(filing.decision_date), 'MMM d, yyyy')}</div>
                  {filing.decision_outcome && (
                    <Badge variant="outline" className="mt-1">{filing.decision_outcome}</Badge>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Certification */}
          {filing.certification_number && (
            <div className="relative text-foreground">
              <CheckCircle2 className="absolute -left-[1.6rem] top-1 w-4 h-4 text-green-600" />
              <div className="text-xs">
                <div className="font-medium">Certified</div>
                <div className="text-muted-foreground">{filing.certification_number}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campaign Tracker</h2>
          <p className="text-muted-foreground">Monitor organizing campaigns and certification progress</p>
        </div>
        <Button onClick={fetchCampaigns}>Refresh</Button>
      </div>

      <Tabs defaultValue="all" onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="all">All Campaigns</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="card_check">Card Check</TabsTrigger>
          <TabsTrigger value="certification_pending">Certification</TabsTrigger>
          <TabsTrigger value="won">Won</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 md:grid-cols-2">
        {campaigns.map((campaign) => {
          const cardPercentage = calculateCardSigningPercentage(campaign);
          const filing = filings[campaign.id];
          
          return (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{campaign.campaign_name}</CardTitle>
                    <CardDescription>{campaign.target_employer_name}</CardDescription>
                  </div>
                  <Badge className={statusColors[campaign.campaign_status] || 'bg-gray-500'}>
                    {campaign.campaign_status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Target className="h-4 w-4 mr-1" />
                      Eligible Workers
                    </div>
                    <div className="text-2xl font-bold">{campaign.estimated_eligible_workers}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="h-4 w-4 mr-1" />
                      Committee Size
                    </div>
                    <div className="text-2xl font-bold">{campaign.organizing_committee_size}</div>
                  </div>
                </div>

                {/* Card Signing Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <FileCheck className="h-4 w-4 mr-2" />
                      <span className="font-medium">Card Signing Progress</span>
                    </div>
                    <span className="text-muted-foreground">
                      {campaign.cards_signed_count} / {campaign.card_signing_goal}
                    </span>
                  </div>
                  <Progress value={cardPercentage} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className={cardPercentage >= 40 ? 'text-green-600 font-medium' : ''}>
                      {cardPercentage}% (40% minimum)
                    </span>
                    <span className={cardPercentage >= 65 ? 'text-green-600 font-medium' : ''}>
                      65% super-majority
                    </span>
                  </div>
                </div>

                {/* Key Dates */}
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    Launch: {format(new Date(campaign.campaign_launch_date), 'MMM d, yyyy')}
                  </div>
                  {campaign.card_check_deadline && (
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="h-4 w-4 mr-2" />
                      Deadline: {format(new Date(campaign.card_check_deadline), 'MMM d')}
                    </div>
                  )}
                </div>

                {/* Labour Board Filing Timeline */}
                {renderFilingTimeline(filing)}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">View Details</Button>
                  <Button variant="outline" size="sm" className="flex-1">Update Status</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {campaigns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No campaigns found</p>
            <p className="text-sm text-muted-foreground">Get started by creating a new organizing campaign</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

