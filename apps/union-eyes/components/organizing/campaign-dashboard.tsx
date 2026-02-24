"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  FileSignature,
  TrendingUp,
  AlertTriangle,
  Calendar,
  MapPin,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  Filter,
  Download,
  BarChart3,
} from "lucide-react";

interface Campaign {
  id: string;
  campaignName: string;
  campaignCode: string;
  targetEmployer: string;
  workplaceLocation: string;
  status: string;
  priority: string;
  estimatedUnitSize: number;
  targetCardCount: number;
  cardsSigned: number;
  cardSigningProgress: number;
  contactsIdentified: number;
  contactsCommitted: number;
  leadOrganizerName: string;
  campaignStartDate: string;
  targetCardDeadline: string;
  electionDate?: string;
}

export default function CampaignDashboard() {
  const [campaigns, _setCampaigns] = useState<Campaign[]>([
    {
      id: "1",
      campaignName: "Acme Manufacturing Local 101",
      campaignCode: "ACME-101",
      targetEmployer: "Acme Manufacturing Inc.",
      workplaceLocation: "123 Industrial Way, Detroit, MI",
      status: "card_signing",
      priority: "high",
      estimatedUnitSize: 250,
      targetCardCount: 175,
      cardsSigned: 142,
      cardSigningProgress: 81.14,
      contactsIdentified: 220,
      contactsCommitted: 165,
      leadOrganizerName: "Sarah Johnson",
      campaignStartDate: "2025-10-15",
      targetCardDeadline: "2026-01-15",
    },
    {
      id: "2",
      campaignName: "Tech Support Union Drive",
      campaignCode: "TECH-202",
      targetEmployer: "TechCorp Solutions",
      workplaceLocation: "456 Tech Plaza, San Francisco, CA",
      status: "active",
      priority: "critical",
      estimatedUnitSize: 85,
      targetCardCount: 60,
      cardsSigned: 38,
      cardSigningProgress: 63.33,
      contactsIdentified: 75,
      contactsCommitted: 45,
      leadOrganizerName: "Michael Chen",
      campaignStartDate: "2025-11-01",
      targetCardDeadline: "2026-02-01",
    },
    {
      id: "3",
      campaignName: "Warehouse Workers United",
      campaignCode: "WW-303",
      targetEmployer: "MegaDistribution Corp",
      workplaceLocation: "789 Logistics Blvd, Newark, NJ",
      status: "election_scheduled",
      priority: "critical",
      estimatedUnitSize: 450,
      targetCardCount: 315,
      cardsSigned: 328,
      cardSigningProgress: 104.13,
      contactsIdentified: 425,
      contactsCommitted: 340,
      leadOrganizerName: "David Martinez",
      campaignStartDate: "2025-08-01",
      targetCardDeadline: "2025-11-01",
      electionDate: "2026-01-20",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [_selectedTab, _setSelectedTab] = useState("overview");

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      planning: { label: "Planning", variant: "secondary" as const, icon: Clock, className: "" },
      active: { label: "Active", variant: "default" as const, icon: TrendingUp, className: "" },
      card_signing: { label: "Card Signing", variant: "default" as const, icon: FileSignature, className: "" },
      filing_pending: { label: "Filing Pending", variant: "outline" as const, icon: AlertTriangle, className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
      election_scheduled: { label: "Election Scheduled", variant: "default" as const, icon: Calendar, className: "" },
      won: { label: "Won", variant: "outline" as const, icon: CheckCircle2, className: "bg-green-100 text-green-800 border-green-300" },
      lost: { label: "Lost", variant: "destructive" as const, icon: XCircle, className: "" },
      withdrawn: { label: "Withdrawn", variant: "secondary" as const, icon: XCircle, className: "" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.planning;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { variant: "secondary" as const, className: "bg-gray-100 text-gray-800" },
      medium: { variant: "secondary" as const, className: "bg-blue-100 text-blue-800" },
      high: { variant: "outline" as const, className: "bg-orange-100 text-orange-800 border-orange-300" },
      critical: { variant: "destructive" as const, className: "bg-red-100 text-red-800" },
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium;

    return (
      <Badge variant={config.variant} className={config.className}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const calculateAggregateStats = () => {
    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => ["active", "card_signing", "filing_pending"].includes(c.status)).length,
      totalContacts: campaigns.reduce((sum, c) => sum + c.contactsIdentified, 0),
      totalCards: campaigns.reduce((sum, c) => sum + c.cardsSigned, 0),
      avgProgress: campaigns.reduce((sum, c) => sum + c.cardSigningProgress, 0) / campaigns.length,
      upcomingElections: campaigns.filter((c) => c.electionDate).length,
    };
  };

  const stats = calculateAggregateStats();

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.campaignName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.targetEmployer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.campaignCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || campaign.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizing Campaigns</h1>
          <p className="text-muted-foreground">Manage union organizing drives and certification campaigns</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      {/* Aggregate Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="w-8 h-8 text-blue-600" />
              <div className="text-3xl font-bold">{stats.totalCampaigns}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="text-3xl font-bold">{stats.activeCampaigns}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-8 h-8 text-purple-600" />
              <div className="text-3xl font-bold">{stats.totalContacts.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cards Signed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileSignature className="w-8 h-8 text-indigo-600" />
              <div className="text-3xl font-bold">{stats.totalCards.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-orange-600" />
              <div className="text-3xl font-bold">{stats.avgProgress.toFixed(0)}%</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Upcoming Elections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="w-8 h-8 text-red-600" />
              <div className="text-3xl font-bold">{stats.upcomingElections}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns, employers, codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="card_signing">Card Signing</SelectItem>
                <SelectItem value="filing_pending">Filing Pending</SelectItem>
                <SelectItem value="election_scheduled">Election Scheduled</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns List */}
      <div className="grid gap-4">
        {filteredCampaigns.map((campaign) => (
          <Card key={campaign.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{campaign.campaignName}</CardTitle>
                    {getStatusBadge(campaign.status)}
                    {getPriorityBadge(campaign.priority)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {campaign.targetEmployer}
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {campaign.campaignCode}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Card Signing Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium">Card Signing Progress</span>
                  <span className="text-muted-foreground">
                    {campaign.cardsSigned} / {campaign.targetCardCount} ({campaign.cardSigningProgress.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={campaign.cardSigningProgress} className="h-2" />
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Unit Size</div>
                  <div className="text-lg font-semibold">{campaign.estimatedUnitSize}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Contacts</div>
                  <div className="text-lg font-semibold">{campaign.contactsIdentified}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Committed</div>
                  <div className="text-lg font-semibold text-green-600">{campaign.contactsCommitted}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Lead Organizer</div>
                  <div className="text-sm font-medium">{campaign.leadOrganizerName}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Card Deadline</div>
                  <div className="text-sm font-medium">
                    {new Date(campaign.targetCardDeadline).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Election Date (if scheduled) */}
              {campaign.electionDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium text-blue-900">Election Scheduled</div>
                    <div className="text-sm text-blue-700">
                      {new Date(campaign.electionDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredCampaigns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your filters or create a new campaign</p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

