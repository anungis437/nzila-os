/**
 * Political Campaign Dashboard Component
 * Displays COPE political campaigns with GOTV metrics and budget tracking
 * Phase 3: COPE Political Action UI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Vote,
  DollarSign,
  Calendar,
  Phone,
  Home,
  FileSignature,
  Trophy,
  XCircle,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

interface PoliticalCampaign {
  id: string;
  campaign_name: string;
  campaign_code: string;
  campaign_type: string;
  campaign_status: string;
  target_election_date: string;
  electoral_district: string;
  endorsed_candidate_name: string | null;
  political_party: string | null;
  volunteer_goal: number;
  doors_knocked_goal: number;
  doors_knocked_count: number;
  phone_calls_goal: number;
  phone_calls_count: number;
  petitions_goal: number | null;
  petitions_count: number | null;
  budget_amount: number;
  funds_raised: number;
  outcome: string | null;
  outcome_date: string | null;
}

interface PoliticalCampaignDashboardProps {
  organizationId: string;
}

const campaignTypeColors: Record<string, string> = {
  electoral: 'bg-blue-600',
  legislative: 'bg-purple-600',
  gotv: 'bg-green-600',
  issue_advocacy: 'bg-orange-600',
  referendum: 'bg-pink-600',
};

const statusColors: Record<string, string> = {
  planning: 'bg-gray-500',
  active: 'bg-green-500',
  gotv_phase: 'bg-yellow-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500',
};

const outcomeColors: Record<string, string> = {
  won: 'bg-emerald-600',
  lost: 'bg-red-600',
  passed: 'bg-green-600',
  defeated: 'bg-red-600',
  pending: 'bg-yellow-600',
};

export function PoliticalCampaignDashboard({ organizationId }: PoliticalCampaignDashboardProps) {
  const [campaigns, setCampaigns] = useState<PoliticalCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const typeParam = selectedType !== 'all' ? `&campaignType=${selectedType}` : '';
      const response = await fetch(`/api/cope/campaigns?organizationId=${organizationId}${typeParam}`);
      
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      
      const data = await response.json();
      setCampaigns(data.data || []);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [organizationId, selectedType]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const calculateProgress = (current: number, goal: number): number => {
    if (!goal) return 0;
    return Math.min(Math.round((current / goal) * 100), 100);
  };

  const calculateBudgetProgress = (raised: number, budget: number): number => {
    if (!budget) return 0;
    return Math.min(Math.round((raised / budget) * 100), 100);
  };

  const _getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
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
          <h2 className="text-2xl font-bold">Political Campaign Dashboard</h2>
          <p className="text-muted-foreground">Monitor COPE political action campaigns and GOTV efforts</p>
        </div>
        <Button onClick={fetchCampaigns}>Refresh</Button>
      </div>

      <Tabs defaultValue="all" onValueChange={setSelectedType}>
        <TabsList>
          <TabsTrigger value="all">All Campaigns</TabsTrigger>
          <TabsTrigger value="electoral">Electoral</TabsTrigger>
          <TabsTrigger value="gotv">GOTV</TabsTrigger>
          <TabsTrigger value="legislative">Legislative</TabsTrigger>
          <TabsTrigger value="issue_advocacy">Issue Advocacy</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 md:grid-cols-2">
        {campaigns.map((campaign) => {
          const doorsProgress = calculateProgress(campaign.doors_knocked_count, campaign.doors_knocked_goal);
          const callsProgress = calculateProgress(campaign.phone_calls_count, campaign.phone_calls_goal);
          const petitionsProgress = campaign.petitions_goal 
            ? calculateProgress(campaign.petitions_count || 0, campaign.petitions_goal)
            : null;
          const budgetProgress = calculateBudgetProgress(campaign.funds_raised, campaign.budget_amount);
          
          return (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{campaign.campaign_name}</CardTitle>
                    <CardDescription>
                      {campaign.electoral_district && `${campaign.electoral_district} â€¢ `}
                      {campaign.endorsed_candidate_name || 'Issue campaign'}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge className={campaignTypeColors[campaign.campaign_type] || 'bg-gray-500'}>
                      {campaign.campaign_type.replace(/_/g, ' ')}
                    </Badge>
                    <Badge className={statusColors[campaign.campaign_status] || 'bg-gray-500'}>
                      {campaign.campaign_status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Candidate/Party Info */}
                {campaign.political_party && (
                  <div className="flex items-center gap-2 text-sm">
                    <Vote className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{campaign.political_party}</span>
                  </div>
                )}

                {/* Election Date */}
                {campaign.target_election_date && (
                  <div className="flex items-center justify-between text-sm pb-2 border-b">
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Election Date
                    </div>
                    <span className="font-medium">
                      {format(new Date(campaign.target_election_date), 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}

                {/* GOTV Metrics */}
                <div className="space-y-3">
                  <div className="font-medium text-sm">GOTV Metrics</div>
                  
                  {/* Doors Knocked */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <Home className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Doors Knocked</span>
                      </div>
                      <span className="text-muted-foreground">
                        {campaign.doors_knocked_count.toLocaleString()} / {campaign.doors_knocked_goal.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={doorsProgress} className="h-2" />
                    <div className="text-xs text-right text-muted-foreground">{doorsProgress}%</div>
                  </div>

                  {/* Phone Calls */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Phone Calls</span>
                      </div>
                      <span className="text-muted-foreground">
                        {campaign.phone_calls_count.toLocaleString()} / {campaign.phone_calls_goal.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={callsProgress} className="h-2" />
                    <div className="text-xs text-right text-muted-foreground">{callsProgress}%</div>
                  </div>

                  {/* Petitions (if applicable) */}
                  {petitionsProgress !== null && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                          <FileSignature className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>Petitions Signed</span>
                        </div>
                        <span className="text-muted-foreground">
                          {(campaign.petitions_count || 0).toLocaleString()} / {campaign.petitions_goal?.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={petitionsProgress} className="h-2" />
                      <div className="text-xs text-right text-muted-foreground">{petitionsProgress}%</div>
                    </div>
                  )}
                </div>

                {/* Budget Tracking */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="font-medium">Budget</span>
                    </div>
                    <span className="text-muted-foreground">
                      ${campaign.funds_raised.toLocaleString()} / ${campaign.budget_amount.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={budgetProgress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{budgetProgress}% raised</span>
                    <span>${(campaign.budget_amount - campaign.funds_raised).toLocaleString()} remaining</span>
                  </div>
                </div>

                {/* Outcome */}
                {campaign.outcome && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      {campaign.outcome.includes('won') || campaign.outcome.includes('passed') ? (
                        <Trophy className="h-5 w-5 text-green-600" />
                      ) : campaign.outcome.includes('lost') || campaign.outcome.includes('defeated') ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="text-sm font-medium">Outcome</span>
                    </div>
                    <div className="text-right">
                      <Badge className={outcomeColors[campaign.outcome] || 'bg-gray-500'}>
                        {campaign.outcome.replace(/_/g, ' ')}
                      </Badge>
                      {campaign.outcome_date && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(campaign.outcome_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">View Details</Button>
                  <Button variant="outline" size="sm" className="flex-1">Log Activity</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {campaigns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Vote className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No political campaigns found</p>
            <p className="text-sm text-muted-foreground">Create a new COPE campaign to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

