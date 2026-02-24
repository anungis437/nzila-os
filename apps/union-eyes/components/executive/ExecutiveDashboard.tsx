"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, AlertCircle, CheckCircle, Calendar, DollarSign } from "lucide-react";
 
import { useTranslations } from "next-intl";

interface ExecutiveDashboardProps {
  organizationId: string;
  userRole: string;
}

interface ExecutiveMetrics {
  totalMembers: number;
  activeGrievances: number;
  pendingApprovals: number;
  upcomingMeetings: number;
  monthlyBudget: {
    allocated: number;
    spent: number;
    currency: string;
  };
  membershipTrend: number; // percentage change
  grievanceResolutionRate: number; // percentage
}

export default function ExecutiveDashboard({ organizationId: _organizationId, userRole }: ExecutiveDashboardProps) {
  const _t = useTranslations();

  // Mock data - replace with actual API call
  const metrics: ExecutiveMetrics = {
    totalMembers: 1247,
    activeGrievances: 23,
    pendingApprovals: 8,
    upcomingMeetings: 4,
    monthlyBudget: {
      allocated: 125000,
      spent: 87500,
      currency: "CAD"
    },
    membershipTrend: 3.2,
    grievanceResolutionRate: 87.5
  };

  const metricCards = [
    {
      title: "Total Members",
      value: metrics.totalMembers.toLocaleString(),
      icon: Users,
      trend: `+${metrics.membershipTrend}%`,
      trendPositive: true,
      description: "Active members"
    },
    {
      title: "Active Grievances",
      value: metrics.activeGrievances,
      icon: AlertCircle,
      trend: metrics.grievanceResolutionRate + "% resolved",
      trendPositive: true,
      description: "Resolution rate"
    },
    {
      title: "Pending Approvals",
      value: metrics.pendingApprovals,
      icon: CheckCircle,
      trend: "Requires action",
      trendPositive: false,
      description: "Awaiting review"
    },
    {
      title: "Upcoming Meetings",
      value: metrics.upcomingMeetings,
      icon: Calendar,
      trend: "This week",
      trendPositive: null,
      description: "Board & committee"
    },
    {
      title: "Monthly Budget",
      value: `$${(metrics.monthlyBudget.spent / 1000).toFixed(0)}K / $${(metrics.monthlyBudget.allocated / 1000).toFixed(0)}K`,
      icon: DollarSign,
      trend: `${((metrics.monthlyBudget.spent / metrics.monthlyBudget.allocated) * 100).toFixed(0)}% utilized`,
      trendPositive: (metrics.monthlyBudget.spent / metrics.monthlyBudget.allocated) < 0.9,
      description: "Current spend"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Strategic overview and key performance indicators
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {userRole.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center space-x-2 mt-1">
                {metric.trendPositive !== null && (
                  <TrendingUp 
                    className={`h-3 w-3 ${metric.trendPositive ? 'text-green-500' : 'text-amber-500'}`} 
                  />
                )}
                <p className={`text-xs ${metric.trendPositive ? 'text-green-500' : metric.trendPositive === false ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {metric.trend}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common executive tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <button className="p-4 border rounded-lg hover:bg-accent text-left transition-colors">
              <div className="font-medium">Review Approvals</div>
              <div className="text-sm text-muted-foreground">{metrics.pendingApprovals} pending</div>
            </button>
            <button className="p-4 border rounded-lg hover:bg-accent text-left transition-colors">
              <div className="font-medium">View Calendar</div>
              <div className="text-sm text-muted-foreground">{metrics.upcomingMeetings} meetings</div>
            </button>
            <button className="p-4 border rounded-lg hover:bg-accent text-left transition-colors">
              <div className="font-medium">Financial Reports</div>
              <div className="text-sm text-muted-foreground">Monthly summary</div>
            </button>
            <button className="p-4 border rounded-lg hover:bg-accent text-left transition-colors">
              <div className="font-medium">Member Directory</div>
              <div className="text-sm text-muted-foreground">{metrics.totalMembers} members</div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
