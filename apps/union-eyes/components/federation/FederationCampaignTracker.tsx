/**
 * Federation Campaign Tracker Component
 * 
 * Track provincial campaigns and initiatives with:
 * - Active campaign list
 * - Campaign progress tracking
 * - Resource allocation
 * - Milestone tracking
 * - Impact metrics
 * - Quick actions
 * 
 * @module components/federation/FederationCampaignTracker
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
 
import {
  Megaphone,
  Target as _Target,
  Users,
  Calendar,
  Eye,
  Edit,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

export interface Campaign {
  id: string;
  title: string;
  type: "organizing" | "political" | "bargaining" | "education" | "solidarity";
  status: "planning" | "active" | "completed" | "paused";
  startDate: Date;
  endDate: Date;
  progress: number;
  budget: number;
  spent: number;
  coordinator: string;
  participatingAffiliates: number;
  totalAffiliates: number;
  targetReached: number;
  targetGoal: number;
  description?: string;
  milestones: {
    id: string;
    title: string;
    completed: boolean;
    dueDate: Date;
  }[];
}

export interface FederationCampaignTrackerProps {
  federationId: string;
}

export function FederationCampaignTracker({
  federationId
}: FederationCampaignTrackerProps) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  React.useEffect(() => {
    loadCampaigns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId]);

  async function loadCampaigns() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/federation/campaigns?federationId=${federationId}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to load campaigns");
      }

      const data = await response.json();
      if (data.success) {
        setCampaigns(data.campaigns);
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load campaigns",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  const filteredCampaigns = React.useMemo(() => {
    let filtered = campaigns;

    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(c => c.type === typeFilter);
    }

    return filtered;
  }, [campaigns, statusFilter, typeFilter]);

  const getTypeBadge = (type: Campaign["type"]) => {
    const variants: Record<Campaign["type"], { variant: string; label: string }> = {
      organizing: { variant: "default", label: "Organizing" },
      political: { variant: "secondary", label: "Political" },
      bargaining: { variant: "outline", label: "Bargaining" },
      education: { variant: "secondary", label: "Education" },
      solidarity: { variant: "default", label: "Solidarity" }
    };
    const config = variants[type];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: Campaign["status"]) => {
    switch (status) {
      case "planning":
        return <Badge variant="secondary">Planning</Badge>;
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "completed":
        return <Badge variant="outline">Completed</Badge>;
      case "paused":
        return <Badge variant="warning">Paused</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Campaign Tracker
            </CardTitle>
            <CardDescription>
              Track provincial campaigns and initiatives
            </CardDescription>
          </div>
          <Button asChild>
            <a href={`/federation/${federationId}/campaigns/new`}>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-45">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-45">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="organizing">Organizing</SelectItem>
              <SelectItem value="political">Political</SelectItem>
              <SelectItem value="bargaining">Bargaining</SelectItem>
              <SelectItem value="education">Education</SelectItem>
              <SelectItem value="solidarity">Solidarity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campaign List */}
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No campaigns found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => {
              const daysRemaining = differenceInDays(new Date(campaign.endDate), new Date());
              const budgetUsed = Math.round((campaign.spent / campaign.budget) * 100);
              const targetProgress = Math.round((campaign.targetReached / campaign.targetGoal) * 100);
              const completedMilestones = campaign.milestones.filter(m => m.completed).length;

              return (
                <Card key={campaign.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{campaign.title}</h3>
                            {getTypeBadge(campaign.type)}
                            {getStatusBadge(campaign.status)}
                          </div>
                          {campaign.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {campaign.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {format(new Date(campaign.startDate), "MMM d")} - {format(new Date(campaign.endDate), "MMM d, yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>
                                {campaign.participatingAffiliates} / {campaign.totalAffiliates} affiliates
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Coordinator:</span>
                              <span>{campaign.coordinator}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/federation/campaigns/${campaign.id}`}>
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/federation/campaigns/${campaign.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>

                      {/* Progress Metrics */}
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Overall Progress</span>
                            <span className="font-medium">{campaign.progress}%</span>
                          </div>
                          <Progress value={campaign.progress} />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Target Progress</span>
                            <span className="font-medium">{targetProgress}%</span>
                          </div>
                          <Progress value={targetProgress} className={cn(
                            targetProgress >= 75 ? "bg-green-200" : "bg-orange-200"
                          )} />
                          <div className="text-xs text-muted-foreground">
                            {campaign.targetReached.toLocaleString()} / {campaign.targetGoal.toLocaleString()}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Budget Used</span>
                            <span className="font-medium">{budgetUsed}%</span>
                          </div>
                          <Progress value={budgetUsed} className={cn(
                            budgetUsed > 90 ? "bg-red-200" : budgetUsed > 75 ? "bg-orange-200" : "bg-blue-200"
                          )} />
                          <div className="text-xs text-muted-foreground">
                            ${campaign.spent.toLocaleString()} / ${campaign.budget.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Milestones & Timeline */}
                      <div className="flex flex-wrap items-center gap-4 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm">
                            <span className="font-medium">{completedMilestones}</span>
                            <span className="text-muted-foreground"> / {campaign.milestones.length} milestones</span>
                          </span>
                        </div>
                        {campaign.status === "active" && (
                          <div className="flex items-center gap-2">
                            {daysRemaining > 0 ? (
                              <>
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  <span className="font-medium">{daysRemaining}</span>
                                  <span className="text-muted-foreground"> days remaining</span>
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-red-600 font-medium">
                                  Overdue by {Math.abs(daysRemaining)} days
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
