/**
 * Workplace Map Component
 * Visualize workplace organizing by department/shift with support levels
 * Phase 3: Organizing Module UI
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  FileCheck, 
  TrendingUp,
  Building2,
  Clock,
  Target,
  CheckCircle2,
  Shield
} from 'lucide-react';

interface WorkplaceMapData {
  group_name: string;
  total_contacts: number;
  cards_signed: number;
  committee_members: number;
  strong_supporters: number;
  supporters: number;
  undecided: number;
  soft_opposition: number;
  strong_opposition: number;
  unknown: number;
  card_signed_percentage: number;
}

interface Summary {
  total_contacts: number;
  total_cards_signed: number;
  total_committee_members: number;
  estimated_eligible_workers: number;
  card_signing_goal: number;
  card_signing_threshold_percentage: number;
  super_majority_goal: number;
  super_majority_threshold_percentage: number;
}

interface CommitteeMember {
  contact_number: string;
  job_title: string;
  department: string;
  shift: string;
  organizing_committee_role: string;
  support_level: string;
  card_signed: boolean;
  natural_leader: boolean;
}

interface WorkplaceMapProps {
  campaignId: string;
}

type ViewType = 'department' | 'shift' | 'support_level';

const _supportLevelColors: Record<string, string> = {
  strong_supporter: 'bg-green-600',
  supporter: 'bg-green-400',
  undecided: 'bg-yellow-400',
  soft_opposition: 'bg-orange-400',
  strong_opposition: 'bg-red-600',
  unknown: 'bg-gray-400',
};

const roleColors: Record<string, string> = {
  'workplace lead': 'bg-purple-600',
  'shift captain': 'bg-blue-600',
  'department rep': 'bg-indigo-600',
  'member': 'bg-slate-600',
};

export function WorkplaceMap({ campaignId }: WorkplaceMapProps) {
  const [viewType, setViewType] = useState<ViewType>('department');
  const [mapData, setMapData] = useState<WorkplaceMapData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkplaceMap();
    fetchCommitteeMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, viewType]);

  const fetchWorkplaceMap = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/organizing/workplace-mapping?campaignId=${campaignId}&viewType=${viewType}`);
      
      if (!response.ok) throw new Error('Failed to fetch workplace map');
      
      const data = await response.json();
      setMapData(data.data.aggregations || []);
      setSummary(data.data.summary || null);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const fetchCommitteeMembers = async () => {
    try {
      const response = await fetch(`/api/organizing/committee?campaignId=${campaignId}`);
      
      if (!response.ok) throw new Error('Failed to fetch committee members');
      
      const data = await response.json();
      setCommitteeMembers(data.data.members || []);
    } catch (_error) {
}
  };

  const calculateSupportPercentage = (group: WorkplaceMapData): number => {
    const totalKnown = group.total_contacts - group.unknown;
    if (totalKnown === 0) return 0;
    const supportive = group.strong_supporters + group.supporters;
    return Math.round((supportive / totalKnown) * 100);
  };

  const getSupportColor = (percentage: number): string => {
    if (percentage >= 70) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const overallCardPercentage = summary 
    ? Math.round((summary.total_cards_signed / summary.estimated_eligible_workers) * 100)
    : 0;

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
          <h2 className="text-2xl font-bold">Workplace Map</h2>
          <p className="text-muted-foreground">Visualize support by department, shift, or support level</p>
        </div>
        <Button onClick={fetchWorkplaceMap}>Refresh</Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Total Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_contacts}</div>
              <p className="text-xs text-muted-foreground">
                of {summary.estimated_eligible_workers} eligible
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <FileCheck className="h-4 w-4 mr-2" />
                Cards Signed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_cards_signed}</div>
              <p className="text-xs text-muted-foreground">
                {overallCardPercentage}% of {summary.card_signing_goal} goal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Committee Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_committee_members}</div>
              <p className="text-xs text-muted-foreground">
                Organizing committee
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Target className="h-4 w-4 mr-2" />
                Threshold Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className={overallCardPercentage >= summary.card_signing_threshold_percentage ? 'text-green-600 font-medium' : ''}>
                    {summary.card_signing_threshold_percentage}% min
                  </span>
                  <span className={overallCardPercentage >= summary.super_majority_threshold_percentage ? 'text-green-600 font-medium' : ''}>
                    {summary.super_majority_threshold_percentage}% super
                  </span>
                </div>
                <Progress value={overallCardPercentage} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Type Selector */}
      <Tabs defaultValue="department" onValueChange={(value) => setViewType(value as ViewType)}>
        <TabsList>
          <TabsTrigger value="department">
            <Building2 className="h-4 w-4 mr-2" />
            By Department
          </TabsTrigger>
          <TabsTrigger value="shift">
            <Clock className="h-4 w-4 mr-2" />
            By Shift
          </TabsTrigger>
          <TabsTrigger value="support_level">
            <TrendingUp className="h-4 w-4 mr-2" />
            By Support Level
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Workplace Map Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mapData.map((group) => {
          const supportPercentage = calculateSupportPercentage(group);
          
          return (
            <Card key={group.group_name}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.group_name || 'Unknown'}</CardTitle>
                    <CardDescription>{group.total_contacts} contacts</CardDescription>
                  </div>
                  <Badge variant="outline" className={getSupportColor(supportPercentage)}>
                    {supportPercentage}% support
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Card Signing Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cards Signed</span>
                    <span className="font-medium">{group.cards_signed} / {group.total_contacts}</span>
                  </div>
                  <Progress value={group.card_signed_percentage} className="h-2" />
                  <div className="text-xs text-muted-foreground text-right">
                    {group.card_signed_percentage}%
                  </div>
                </div>

                {/* Committee Members */}
                {group.committee_members > 0 && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Committee Members</span>
                    <Badge variant="secondary">{group.committee_members}</Badge>
                  </div>
                )}

                {/* Support Level Breakdown */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-sm font-medium">Support Breakdown</div>
                  <div className="space-y-1.5">
                    {group.strong_supporters > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-600 mr-2" />
                          <span>Strong Supporters</span>
                        </div>
                        <span className="font-medium">{group.strong_supporters}</span>
                      </div>
                    )}
                    {group.supporters > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-400 mr-2" />
                          <span>Supporters</span>
                        </div>
                        <span className="font-medium">{group.supporters}</span>
                      </div>
                    )}
                    {group.undecided > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2" />
                          <span>Undecided</span>
                        </div>
                        <span className="font-medium">{group.undecided}</span>
                      </div>
                    )}
                    {group.soft_opposition > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-orange-400 mr-2" />
                          <span>Soft Opposition</span>
                        </div>
                        <span className="font-medium">{group.soft_opposition}</span>
                      </div>
                    )}
                    {group.strong_opposition > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-red-600 mr-2" />
                          <span>Strong Opposition</span>
                        </div>
                        <span className="font-medium">{group.strong_opposition}</span>
                      </div>
                    )}
                    {group.unknown > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-gray-400 mr-2" />
                          <span>Unknown</span>
                        </div>
                        <span>{group.unknown}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Organizing Committee Members */}
      {committeeMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Organizing Committee</CardTitle>
            <CardDescription>
              {committeeMembers.length} members across departments and shifts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {committeeMembers.map((member) => (
                <div 
                  key={member.contact_number} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span>{member.contact_number}</span>
                        {member.natural_leader && (
                          <Badge variant="outline" className="text-xs">Natural Leader</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.job_title} â€¢ {member.department} â€¢ {member.shift}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.card_signed && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    <Badge className={roleColors[member.organizing_committee_role] || 'bg-gray-600'}>
                      {member.organizing_committee_role}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

