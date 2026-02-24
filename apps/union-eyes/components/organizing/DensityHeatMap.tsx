/**
 * Organizing Density Heat Map Component
 * Visual representation of card signing progress with 30%, 50%, 70% thresholds
 * Phase 3: Organizing & Density
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  Target,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface OrganizingCampaign {
  id: string;
  campaign_name: string;
  campaign_code: string;
  campaign_status: string;
  target_employer_name: string;
  estimated_eligible_workers: number;
  cards_signed_count: number;
  cards_signed_percentage: number;
  card_signing_threshold_percentage: number;
  super_majority_threshold_percentage: number;
  target_industry: string;
  labor_board_jurisdiction: string;
}

interface DepartmentDensity {
  department: string;
  total_contacts: number;
  cards_signed: number;
  support_percentage: number;
  strong_supporters: number;
  organizing_committee_members: number;
}

interface DensityHeatMapProps {
  organizationId: string;
  campaignId?: string;
}

export function DensityHeatMap({ organizationId, campaignId }: DensityHeatMapProps) {
  const [campaigns, setCampaigns] = useState<OrganizingCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<OrganizingCampaign | null>(null);
  const [departmentDensity, setDepartmentDensity] = useState<DepartmentDensity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchDepartmentDensity(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/organizing/campaigns?organizationId=${organizationId}`);
      const data = await response.json();
      
      if (data.success) {
        setCampaigns(data.data);
        
        // Select specific campaign or first active campaign
        if (campaignId) {
          const campaign = data.data.find((c: OrganizingCampaign) => c.id === campaignId);
          setSelectedCampaign(campaign || data.data[0]);
        } else {
          const activeCampaign = data.data.find((c: OrganizingCampaign) => 
            c.campaign_status === 'active' || c.campaign_status === 'card_check'
          );
          setSelectedCampaign(activeCampaign || data.data[0]);
        }
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const fetchDepartmentDensity = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/organizing/workplace-mapping?campaignId=${campaignId}&groupBy=department`);
      const data = await response.json();
      
      if (data.success) {
        // Calculate support percentages per department
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const densityData = data.data.map((dept: any) => ({
          department: dept.department || 'Unknown',
          total_contacts: dept.total_contacts,
          cards_signed: dept.cards_signed,
          support_percentage: (dept.cards_signed / dept.total_contacts) * 100,
          strong_supporters: dept.strong_supporters || 0,
          organizing_committee_members: dept.organizing_committee_members || 0,
        }));
        
        setDepartmentDensity(densityData);
      }
    } catch (_error) {
}
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getDensityLevel = (percentage: number): { label: string; color: string; icon: any } => {
    if (percentage >= 70) {
      return { label: 'Super Majority', color: 'bg-green-500', icon: CheckCircle };
    } else if (percentage >= 50) {
      return { label: 'Strong Support', color: 'bg-blue-500', icon: TrendingUp };
    } else if (percentage >= 30) {
      return { label: 'Building', color: 'bg-yellow-500', icon: Target };
    } else {
      return { label: 'Organizing', color: 'bg-red-500', icon: AlertTriangle };
    }
  };

  const getOverallDensityLevel = (campaign: OrganizingCampaign) => {
    const percentage = campaign.cards_signed_percentage;
    return getDensityLevel(percentage);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading density data...</div>;
  }

  if (!selectedCampaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Campaigns</CardTitle>
          <CardDescription>Create an organizing campaign to track card signing density.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const overallDensity = getOverallDensityLevel(selectedCampaign);
  const DensityIcon = overallDensity.icon;

  return (
    <div className="space-y-6">
      {/* Campaign Selector */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold">Organizing Density Heat Map</h2>
        <select
          value={selectedCampaign?.id || ''}
          onChange={(e) => {
            const campaign = campaigns.find(c => c.id === e.target.value);
            setSelectedCampaign(campaign || null);
          }}
          aria-label="Filter by organizing campaign"
          className="px-4 py-2 border rounded-md"
        >
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.campaign_name} ({campaign.target_employer_name})
            </option>
          ))}
        </select>
      </div>

      {/* Overall Campaign Density */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{selectedCampaign.campaign_name}</CardTitle>
              <CardDescription>
                {selectedCampaign.target_employer_name} â€¢ {selectedCampaign.labor_board_jurisdiction}
              </CardDescription>
            </div>
            <Badge className={`${overallDensity.color} text-white`}>
              <DensityIcon className="w-4 h-4 mr-2" />
              {overallDensity.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Card Signing Progress</span>
              <span className="text-2xl font-bold">
                {selectedCampaign.cards_signed_percentage.toFixed(1)}%
              </span>
            </div>
            
            <div className="relative">
              <Progress value={selectedCampaign.cards_signed_percentage} className="h-8" />
              
              {/* Threshold markers */}
              <div className="absolute top-0 left-[30%] w-0.5 h-8 bg-yellow-600">
                <span className="absolute -top-6 -left-6 text-xs font-medium">30%</span>
              </div>
              <div className="absolute top-0 left-[50%] w-0.5 h-8 bg-blue-600">
                <span className="absolute -top-6 -left-6 text-xs font-medium">50%</span>
              </div>
              <div className="absolute top-0 left-[70%] w-0.5 h-8 bg-green-600">
                <span className="absolute -top-6 -left-6 text-xs font-medium">70%</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Cards Signed</p>
                <p className="text-2xl font-bold">{selectedCampaign.cards_signed_count}</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Eligible Workers</p>
                <p className="text-2xl font-bold">{selectedCampaign.estimated_eligible_workers}</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Target Threshold</p>
                <p className="text-2xl font-bold">
                  {selectedCampaign.card_signing_threshold_percentage}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department-by-Department Heat Map */}
      <Card>
        <CardHeader>
          <CardTitle>Department Density Breakdown</CardTitle>
          <CardDescription>Card signing progress by workplace department</CardDescription>
        </CardHeader>
        <CardContent>
          {departmentDensity.length === 0 ? (
            <p className="text-muted-foreground">No department data available. Add workplace contacts to see density breakdown.</p>
          ) : (
            <div className="space-y-4">
              {departmentDensity.map((dept) => {
                const deptDensity = getDensityLevel(dept.support_percentage);
                const DeptIcon = deptDensity.icon;
                
                return (
                  <div key={dept.department} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <DeptIcon className={`w-5 h-5 ${deptDensity.color.replace('bg-', 'text-')}`} />
                        <h4 className="font-semibold">{dept.department}</h4>
                      </div>
                      <Badge className={`${deptDensity.color} text-white`}>
                        {dept.support_percentage.toFixed(1)}%
                      </Badge>
                    </div>
                    
                    <Progress value={dept.support_percentage} className="h-3 mb-2" />
                    
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{dept.cards_signed} of {dept.total_contacts} workers</span>
                      <span>
                        {dept.organizing_committee_members > 0 && 
                          `${dept.organizing_committee_members} organizers`
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Density Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Density Thresholds</CardTitle>
          <CardDescription>Understanding card signing benchmarks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="font-semibold">0-29%</span>
              </div>
              <p className="text-sm text-muted-foreground">Organizing phase - building support</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="font-semibold">30-49%</span>
              </div>
              <p className="text-sm text-muted-foreground">Building momentum - intensify outreach</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="font-semibold">50-69%</span>
              </div>
              <p className="text-sm text-muted-foreground">Strong support - near certification</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="font-semibold">70%+</span>
              </div>
              <p className="text-sm text-muted-foreground">Super majority - ready to file</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

