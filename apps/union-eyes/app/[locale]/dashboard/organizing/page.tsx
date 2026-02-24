'use client';


export const dynamic = 'force-dynamic';
import React from 'react';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Flag, 
  AlertCircle, 
  Clock, 
  Search,
  Plus,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Pause,
  Eye,
  Edit,
  BarChart3,
  MapPin,
  Calendar,
  Target,
  Award
} from 'lucide-react';
import Link from 'next/link';

interface OrganizingCampaign {
  id: string;
  campaignName: string;
  campaignCode: string;
  campaignType: string;
  campaignStatus: string;
  targetEmployerName: string;
  workplaceCity: string;
  workplaceProvince: string;
  estimatedEligibleWorkers: number;
  cardsSignedCount: number;
  cardsSignedPercentage: number;
  cardSigningThresholdPercentage: number;
  superMajorityThresholdPercentage: number;
  organizingCommitteeSize: number;
  campaignLaunchDate?: string;
  cardCheckDeadline?: string;
}

export default function OrganizingDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<OrganizingCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      
      // Mock data for demonstration - replace with actual API call
      const mockCampaigns: OrganizingCampaign[] = [
        {
          id: '1',
          campaignName: 'Healthcare Workers Union Drive',
          campaignCode: 'ORG-2024-HCW-001',
          campaignType: 'new_workplace',
          campaignStatus: 'active',
          targetEmployerName: 'City General Hospital',
          workplaceCity: 'Toronto',
          workplaceProvince: 'ON',
          estimatedEligibleWorkers: 450,
          cardsSignedCount: 285,
          cardsSignedPercentage: 63.33,
          cardSigningThresholdPercentage: 40.00,
          superMajorityThresholdPercentage: 65.00,
          organizingCommitteeSize: 12,
          campaignLaunchDate: '2024-01-15',
          cardCheckDeadline: '2024-03-15'
        },
        {
          id: '2',
          campaignName: 'Manufacturing Workers Expansion',
          campaignCode: 'ORG-2024-MFG-002',
          campaignType: 'expansion',
          campaignStatus: 'card_check',
          targetEmployerName: 'AutoParts Manufacturing Inc.',
          workplaceCity: 'Windsor',
          workplaceProvince: 'ON',
          estimatedEligibleWorkers: 180,
          cardsSignedCount: 145,
          cardsSignedPercentage: 80.56,
          cardSigningThresholdPercentage: 40.00,
          superMajorityThresholdPercentage: 65.00,
          organizingCommitteeSize: 8,
          campaignLaunchDate: '2023-11-01',
          cardCheckDeadline: '2024-01-30'
        },
        {
          id: '3',
          campaignName: 'Retail Workers Certification',
          campaignCode: 'ORG-2024-RTL-003',
          campaignType: 'new_workplace',
          campaignStatus: 'research',
          targetEmployerName: 'MegaStore Retail Chain',
          workplaceCity: 'Ottawa',
          workplaceProvince: 'ON',
          estimatedEligibleWorkers: 320,
          cardsSignedCount: 45,
          cardsSignedPercentage: 14.06,
          cardSigningThresholdPercentage: 40.00,
          superMajorityThresholdPercentage: 65.00,
          organizingCommitteeSize: 3,
          campaignLaunchDate: '2024-02-01'
        }
      ];

      setCampaigns(mockCampaigns);
    } catch (_err) {
setError('Unable to load organizing campaigns. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const statusMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'active': 'default',
      'card_check': 'secondary',
      'certification_pending': 'secondary',
      'certification_vote': 'secondary',
      'won': 'default',
      'lost': 'destructive',
      'research': 'outline',
      'pre_campaign': 'outline',
      'suspended': 'destructive',
      'abandoned': 'destructive'
    };
    return statusMap[status] || 'outline';
  };

  const getStatusIcon = (status: string) => {
    const iconMap: Record<string, React.ReactElement> = {
      'active': <TrendingUp className="w-4 h-4" />,
      'card_check': <CheckCircle className="w-4 h-4" />,
      'won': <Award className="w-4 h-4" />,
      'lost': <XCircle className="w-4 h-4" />,
      'suspended': <Pause className="w-4 h-4" />,
      'research': <Search className="w-4 h-4" />
    };
    return iconMap[status] || <Flag className="w-4 h-4" />;
  };

  const formatStatusLabel = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProgressColor = (percentage: number, threshold: number, superMajority: number) => {
    if (percentage >= superMajority) return 'bg-green-600';
    if (percentage >= threshold) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         campaign.targetEmployerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         campaign.campaignCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || campaign.campaignStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate summary statistics
  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.campaignStatus === 'active' || c.campaignStatus === 'card_check').length,
    wonCampaigns: campaigns.filter(c => c.campaignStatus === 'won').length,
    totalWorkers: campaigns.reduce((sum, c) => sum + c.estimatedEligibleWorkers, 0)
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
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h3 className="text-xl font-semibold mb-2 text-red-900">Error Loading Campaigns</h3>
              <p className="text-red-800 mb-4">{error}</p>
              <Button variant="outline" onClick={() => loadCampaigns()}>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Flag className="w-8 h-8" />
            Organizing Campaigns
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage new workplace organizing drives and certification campaigns
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Summary Stats */}
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
                <p className="text-sm text-muted-foreground">Certifications Won</p>
                <p className="text-2xl font-bold">{stats.wonCampaigns}</p>
              </div>
              <Award className="w-10 h-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Workers</p>
                <p className="text-2xl font-bold">{stats.totalWorkers.toLocaleString()}</p>
              </div>
              <Users className="w-10 h-10 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
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
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'card_check' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('card_check')}
              >
                Card Check
              </Button>
              <Button
                variant={statusFilter === 'research' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('research')}
              >
                Research
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign List */}
      <div className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Flag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Campaigns Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters.' 
                    : 'Start your first organizing campaign to begin building worker power.'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Launch New Campaign
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="border-2 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{campaign.campaignName}</h3>
                      <Badge variant={getStatusBadgeVariant(campaign.campaignStatus)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(campaign.campaignStatus)}
                          {formatStatusLabel(campaign.campaignStatus)}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{campaign.targetEmployerName}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {campaign.workplaceCity}, {campaign.workplaceProvince}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {campaign.estimatedEligibleWorkers} eligible workers
                      </span>
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        {campaign.campaignCode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Signing Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Card Signing Progress</span>
                    <span className="text-sm font-semibold">{campaign.cardsSignedCount} / {campaign.estimatedEligibleWorkers} ({campaign.cardsSignedPercentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                    {/* Threshold markers */}
                    <div 
                      className="absolute h-full border-l-2 border-yellow-800 opacity-50"
                      style={{ left: `${campaign.cardSigningThresholdPercentage}%` }}
                    />
                    <div 
                      className="absolute h-full border-l-2 border-green-800 opacity-50"
                      style={{ left: `${campaign.superMajorityThresholdPercentage}%` }}
                    />
                    {/* Progress bar */}
                    <div 
                      className={`h-full transition-all ${getProgressColor(campaign.cardsSignedPercentage, campaign.cardSigningThresholdPercentage, campaign.superMajorityThresholdPercentage)}`}
                      style={{ width: `${Math.min(campaign.cardsSignedPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>Threshold: {campaign.cardSigningThresholdPercentage}%</span>
                    <span>Super Majority: {campaign.superMajorityThresholdPercentage}%</span>
                  </div>
                </div>

                {/* Campaign Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b">
                  <div>
                    <p className="text-xs text-muted-foreground">Launch Date</p>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(campaign.campaignLaunchDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Card Deadline</p>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {formatDate(campaign.cardCheckDeadline)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Committee Size</p>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {campaign.organizingCommitteeSize} members
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Campaign Type</p>
                    <p className="text-sm font-semibold">
                      {formatStatusLabel(campaign.campaignType)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link href={`/dashboard/organizing/${campaign.id}`} className="flex-1">
                    <Button variant="default" className="w-full" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Campaign
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
