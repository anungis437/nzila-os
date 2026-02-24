"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  Users,
  AlertTriangle,
  Award,
  Calendar,
  Download,
  Mail,
  Phone,
  MessageSquare,
  Search,
  Activity,
  Target,
} from "lucide-react";

// Types
type LifecycleStage = "new" | "growing" | "engaged" | "at_risk" | "dormant";
type ChurnRisk = "high" | "medium" | "low";

interface EngagementMember {
  id: string;
  name: string;
  engagementScore: number;
  lastActivity: string;
  daysInactive: number;
  lifecycleStage: LifecycleStage;
  churnRisk: ChurnRisk | null;
  email: string;
  phone: string;
}

interface ScoreDistributionBucket {
  range: string;
  count: number;
  percentage: number;
  color: string;
}

interface ActivityHeatmapCell {
  day: string;
  hour: number;
  activityCount: number;
}

interface TrendDataPoint {
  month: string;
  averageScore: number;
  medianScore: number;
}

interface LifecycleStageMetrics {
  stage: LifecycleStage;
  count: number;
  percentage: number;
  label: string;
  color: string;
}

// Sample data
const SCORE_DISTRIBUTION: ScoreDistributionBucket[] = [
  { range: "0-20", count: 42, percentage: 8.4, color: "bg-red-500" },
  { range: "21-40", count: 68, percentage: 13.6, color: "bg-orange-500" },
  { range: "41-60", count: 152, percentage: 30.4, color: "bg-yellow-500" },
  { range: "61-80", count: 184, percentage: 36.8, color: "bg-green-500" },
  { range: "81-100", count: 54, percentage: 10.8, color: "bg-blue-500" },
];

const TOP_ENGAGED_MEMBERS: EngagementMember[] = [
  { id: "1", name: "Sarah Johnson", engagementScore: 98, lastActivity: "2 hours ago", daysInactive: 0, lifecycleStage: "engaged", churnRisk: null, email: "sarah.j@email.com", phone: "(555) 123-4567" },
  { id: "2", name: "Michael Chen", engagementScore: 96, lastActivity: "5 hours ago", daysInactive: 0, lifecycleStage: "engaged", churnRisk: null, email: "m.chen@email.com", phone: "(555) 234-5678" },
  { id: "3", name: "Emily Rodriguez", engagementScore: 94, lastActivity: "1 day ago", daysInactive: 1, lifecycleStage: "engaged", churnRisk: null, email: "emily.r@email.com", phone: "(555) 345-6789" },
  { id: "4", name: "David Kim", engagementScore: 92, lastActivity: "1 day ago", daysInactive: 1, lifecycleStage: "engaged", churnRisk: null, email: "d.kim@email.com", phone: "(555) 456-7890" },
  { id: "5", name: "Jennifer Taylor", engagementScore: 91, lastActivity: "2 days ago", daysInactive: 2, lifecycleStage: "engaged", churnRisk: null, email: "jen.t@email.com", phone: "(555) 567-8901" },
  { id: "6", name: "Robert Martinez", engagementScore: 89, lastActivity: "3 days ago", daysInactive: 3, lifecycleStage: "engaged", churnRisk: null, email: "r.martinez@email.com", phone: "(555) 678-9012" },
  { id: "7", name: "Lisa Anderson", engagementScore: 88, lastActivity: "3 days ago", daysInactive: 3, lifecycleStage: "engaged", churnRisk: null, email: "lisa.a@email.com", phone: "(555) 789-0123" },
  { id: "8", name: "James Wilson", engagementScore: 87, lastActivity: "4 days ago", daysInactive: 4, lifecycleStage: "engaged", churnRisk: null, email: "james.w@email.com", phone: "(555) 890-1234" },
  { id: "9", name: "Maria Garcia", engagementScore: 86, lastActivity: "5 days ago", daysInactive: 5, lifecycleStage: "engaged", churnRisk: null, email: "maria.g@email.com", phone: "(555) 901-2345" },
  { id: "10", name: "Thomas Brown", engagementScore: 85, lastActivity: "5 days ago", daysInactive: 5, lifecycleStage: "engaged", churnRisk: null, email: "thomas.b@email.com", phone: "(555) 012-3456" },
];

const AT_RISK_MEMBERS: EngagementMember[] = [
  { id: "11", name: "Patricia Lee", engagementScore: 28, lastActivity: "45 days ago", daysInactive: 45, lifecycleStage: "at_risk", churnRisk: "high", email: "pat.lee@email.com", phone: "(555) 111-2222" },
  { id: "12", name: "Christopher Davis", engagementScore: 32, lastActivity: "38 days ago", daysInactive: 38, lifecycleStage: "at_risk", churnRisk: "high", email: "chris.d@email.com", phone: "(555) 222-3333" },
  { id: "13", name: "Angela Moore", engagementScore: 35, lastActivity: "32 days ago", daysInactive: 32, lifecycleStage: "at_risk", churnRisk: "medium", email: "angela.m@email.com", phone: "(555) 333-4444" },
  { id: "14", name: "Daniel White", engagementScore: 37, lastActivity: "28 days ago", daysInactive: 28, lifecycleStage: "at_risk", churnRisk: "medium", email: "dan.white@email.com", phone: "(555) 444-5555" },
  { id: "15", name: "Michelle Harris", engagementScore: 39, lastActivity: "25 days ago", daysInactive: 25, lifecycleStage: "at_risk", churnRisk: "medium", email: "michelle.h@email.com", phone: "(555) 555-6666" },
  { id: "16", name: "Kevin Thompson", engagementScore: 34, lastActivity: "35 days ago", daysInactive: 35, lifecycleStage: "at_risk", churnRisk: "high", email: "kevin.t@email.com", phone: "(555) 666-7777" },
  { id: "17", name: "Laura Jackson", engagementScore: 36, lastActivity: "30 days ago", daysInactive: 30, lifecycleStage: "at_risk", churnRisk: "medium", email: "laura.j@email.com", phone: "(555) 777-8888" },
  { id: "18", name: "Steven Clark", engagementScore: 31, lastActivity: "40 days ago", daysInactive: 40, lifecycleStage: "at_risk", churnRisk: "high", email: "steven.c@email.com", phone: "(555) 888-9999" },
];

const TREND_DATA: TrendDataPoint[] = [
  { month: "Jun", averageScore: 64, medianScore: 66 },
  { month: "Jul", averageScore: 66, medianScore: 68 },
  { month: "Aug", averageScore: 68, medianScore: 70 },
  { month: "Sep", averageScore: 67, medianScore: 69 },
  { month: "Oct", averageScore: 70, medianScore: 72 },
  { month: "Nov", averageScore: 72, medianScore: 74 },
  { month: "Dec", averageScore: 73, medianScore: 75 },
];

const LIFECYCLE_STAGES: LifecycleStageMetrics[] = [
  { stage: "new", count: 85, percentage: 17.0, label: "New Members", color: "bg-blue-500" },
  { stage: "growing", count: 124, percentage: 24.8, label: "Growing", color: "bg-cyan-500" },
  { stage: "engaged", count: 198, percentage: 39.6, label: "Engaged", color: "bg-green-500" },
  { stage: "at_risk", count: 72, percentage: 14.4, label: "At Risk", color: "bg-orange-500" },
  { stage: "dormant", count: 21, percentage: 4.2, label: "Dormant", color: "bg-red-500" },
];

// Activity heatmap data (day × hour)
const ACTIVITY_HEATMAP: ActivityHeatmapCell[] = [
  // Monday
  { day: "Mon", hour: 8, activityCount: 42 },
  { day: "Mon", hour: 9, activityCount: 68 },
  { day: "Mon", hour: 10, activityCount: 85 },
  { day: "Mon", hour: 11, activityCount: 72 },
  { day: "Mon", hour: 12, activityCount: 54 },
  { day: "Mon", hour: 13, activityCount: 48 },
  { day: "Mon", hour: 14, activityCount: 62 },
  { day: "Mon", hour: 15, activityCount: 58 },
  { day: "Mon", hour: 16, activityCount: 45 },
  { day: "Mon", hour: 17, activityCount: 38 },
  // Tuesday
  { day: "Tue", hour: 8, activityCount: 48 },
  { day: "Tue", hour: 9, activityCount: 75 },
  { day: "Tue", hour: 10, activityCount: 92 },
  { day: "Tue", hour: 11, activityCount: 78 },
  { day: "Tue", hour: 12, activityCount: 58 },
  { day: "Tue", hour: 13, activityCount: 52 },
  { day: "Tue", hour: 14, activityCount: 68 },
  { day: "Tue", hour: 15, activityCount: 64 },
  { day: "Tue", hour: 16, activityCount: 52 },
  { day: "Tue", hour: 17, activityCount: 42 },
  // Wednesday
  { day: "Wed", hour: 8, activityCount: 52 },
  { day: "Wed", hour: 9, activityCount: 82 },
  { day: "Wed", hour: 10, activityCount: 88 },
  { day: "Wed", hour: 11, activityCount: 75 },
  { day: "Wed", hour: 12, activityCount: 62 },
  { day: "Wed", hour: 13, activityCount: 55 },
  { day: "Wed", hour: 14, activityCount: 72 },
  { day: "Wed", hour: 15, activityCount: 68 },
  { day: "Wed", hour: 16, activityCount: 58 },
  { day: "Wed", hour: 17, activityCount: 45 },
  // Thursday
  { day: "Thu", hour: 8, activityCount: 58 },
  { day: "Thu", hour: 9, activityCount: 88 },
  { day: "Thu", hour: 10, activityCount: 95 },
  { day: "Thu", hour: 11, activityCount: 82 },
  { day: "Thu", hour: 12, activityCount: 65 },
  { day: "Thu", hour: 13, activityCount: 58 },
  { day: "Thu", hour: 14, activityCount: 78 },
  { day: "Thu", hour: 15, activityCount: 72 },
  { day: "Thu", hour: 16, activityCount: 62 },
  { day: "Thu", hour: 17, activityCount: 48 },
  // Friday
  { day: "Fri", hour: 8, activityCount: 45 },
  { day: "Fri", hour: 9, activityCount: 65 },
  { day: "Fri", hour: 10, activityCount: 72 },
  { day: "Fri", hour: 11, activityCount: 68 },
  { day: "Fri", hour: 12, activityCount: 52 },
  { day: "Fri", hour: 13, activityCount: 42 },
  { day: "Fri", hour: 14, activityCount: 55 },
  { day: "Fri", hour: 15, activityCount: 48 },
  { day: "Fri", hour: 16, activityCount: 38 },
  { day: "Fri", hour: 17, activityCount: 32 },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export default function EngagementMetricsDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("last_30_days");

  // Calculate summary metrics
  const totalMembers = SCORE_DISTRIBUTION.reduce((sum, bucket) => sum + bucket.count, 0);
  const averageScore = 73;
  const medianScore = 75;
  const engagedMembers = LIFECYCLE_STAGES.find((s) => s.stage === "engaged")?.count || 0;

  // Get churn risk styling
  const getChurnRiskStyle = (risk: ChurnRisk) => {
    switch (risk) {
      case "high":
        return "bg-red-500 text-white";
      case "medium":
        return "bg-orange-500 text-white";
      case "low":
        return "bg-yellow-500 text-white";
    }
  };

  // Get lifecycle stage styling
  const _getLifecycleStageStyle = (stage: LifecycleStage) => {
    const stageData = LIFECYCLE_STAGES.find((s) => s.stage === stage);
    return stageData?.color || "bg-gray-500";
  };

  // Get heatmap cell color
  const getHeatmapColor = (activityCount: number) => {
    if (activityCount >= 80) return "bg-green-600";
    if (activityCount >= 60) return "bg-green-400";
    if (activityCount >= 40) return "bg-yellow-400";
    if (activityCount >= 20) return "bg-orange-400";
    return "bg-red-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Engagement Metrics</h1>
          <p className="text-muted-foreground mt-1">
            Track member engagement scores and identify at-risk members
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="last_365_days">Last 365 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
            <Badge variant="outline" className="text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +5.2%
            </Badge>
          </div>
          <div className="text-3xl font-bold mb-1">{averageScore}</div>
          <div className="text-sm text-muted-foreground">Average Engagement Score</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="text-3xl font-bold mb-1">{medianScore}</div>
          <div className="text-sm text-muted-foreground">Median Engagement Score</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <Badge variant="outline" className="text-green-600">
              {((engagedMembers / totalMembers) * 100).toFixed(1)}%
            </Badge>
          </div>
          <div className="text-3xl font-bold mb-1">{engagedMembers}</div>
          <div className="text-sm text-muted-foreground">Engaged Members</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <Badge variant="destructive">
              {AT_RISK_MEMBERS.length}
            </Badge>
          </div>
          <div className="text-3xl font-bold mb-1">
            {AT_RISK_MEMBERS.filter((m) => m.churnRisk === "high").length}
          </div>
          <div className="text-sm text-muted-foreground">High Churn Risk</div>
        </Card>
      </div>

      {/* Score Distribution & Lifecycle Stages */}
      <div className="grid grid-cols-2 gap-6">
        {/* Score Distribution Histogram */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Score Distribution</h3>
          <div className="space-y-3">
            {SCORE_DISTRIBUTION.map((bucket) => (
              <div key={bucket.range}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{bucket.range}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{bucket.count} members</span>
                    <span className="text-sm font-semibold">{bucket.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bucket.color} flex items-center justify-center text-white text-sm font-medium`}
                    style={{ width: `${bucket.percentage * 2}%` }}
                  >
                    {bucket.percentage >= 10 && `${bucket.percentage.toFixed(0)}%`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Member Lifecycle Stages */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Member Lifecycle Stages</h3>
          <div className="space-y-3">
            {LIFECYCLE_STAGES.map((stage) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                    <span className="text-sm font-medium">{stage.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{stage.count} members</span>
                    <span className="text-sm font-semibold">{stage.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${stage.color}`}
                    style={{ width: `${stage.percentage * 2}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Engagement Trend Over Time */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Engagement Trend (Last 6 Months)</h3>
        <div className="space-y-4">
          <div className="flex items-end justify-between h-48">
            {TREND_DATA.map((dataPoint, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div className="relative flex items-end gap-1 h-40">
                  {/* Average Score Bar */}
                  <div className="relative group">
                    <div
                      className="w-8 bg-blue-500 rounded-t-md hover:bg-blue-600 transition-colors"
                      style={{ height: `${(dataPoint.averageScore / 100) * 160}px` }}
                    />
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Avg: {dataPoint.averageScore}
                    </div>
                  </div>
                  {/* Median Score Bar */}
                  <div className="relative group">
                    <div
                      className="w-8 bg-green-500 rounded-t-md hover:bg-green-600 transition-colors"
                      style={{ height: `${(dataPoint.medianScore / 100) * 160}px` }}
                    />
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Median: {dataPoint.medianScore}
                    </div>
                  </div>
                </div>
                <span className="text-sm font-medium">{dataPoint.month}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded" />
              <span>Average Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded" />
              <span>Median Score</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Top Engaged Members */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Engaged Members</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
        <div className="space-y-2">
          {TOP_ENGAGED_MEMBERS.slice(0, 10).map((member, index) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full font-semibold">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-muted-foreground">Last active: {member.lastActivity}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Engagement Score</div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500 text-white">
                      <Award className="h-3 w-3 mr-1" />
                      {member.engagementScore}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* At-Risk Members */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">At-Risk Members</h3>
            <Badge variant="destructive">{AT_RISK_MEMBERS.length} members</Badge>
          </div>
          <Button>
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Re-Engagement Campaign
          </Button>
        </div>
        <div className="space-y-2">
          {AT_RISK_MEMBERS.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Last active: {member.lastActivity} ({member.daysInactive} days inactive)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Engagement Score</div>
                  <div className="text-lg font-bold text-red-600">{member.engagementScore}</div>
                </div>
                {member.churnRisk && (
                  <Badge className={getChurnRiskStyle(member.churnRisk)}>
                    {member.churnRisk.toUpperCase()} RISK
                  </Badge>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button size="sm">Schedule Call</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity Heatmap */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Activity Heatmap (Day × Hour)</h3>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour labels */}
            <div className="flex items-center mb-2">
              <div className="w-16" />
              {HOURS.map((hour) => (
                <div key={hour} className="w-12 text-center text-xs text-muted-foreground">
                  {hour}:00
                </div>
              ))}
            </div>
            {/* Heatmap rows */}
            {DAYS.map((day) => (
              <div key={day} className="flex items-center mb-1">
                <div className="w-16 text-sm font-medium">{day}</div>
                {HOURS.map((hour) => {
                  const cell = ACTIVITY_HEATMAP.find((c) => c.day === day && c.hour === hour);
                  const activityCount = cell?.activityCount || 0;
                  return (
                    <div key={`${day}-${hour}`} className="w-12 px-1">
                      <div
                        className={`h-8 rounded ${getHeatmapColor(activityCount)} flex items-center justify-center text-white text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity`}
                        title={`${day} ${hour}:00 - ${activityCount} activities`}
                      >
                        {activityCount}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs">
          <span className="text-muted-foreground">Activity Level:</span>
          <div className="flex items-center gap-1">
            <div className="w-6 h-4 bg-red-400 rounded" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-4 bg-orange-400 rounded" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-4 bg-yellow-400 rounded" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-4 bg-green-400 rounded" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-4 bg-green-600 rounded" />
            <span>High</span>
          </div>
        </div>
      </Card>

      {/* Predictive Analytics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Predictive Analytics</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Engagement Trajectory</span>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">+2.4%</div>
            <div className="text-sm text-muted-foreground">Projected growth next 30 days</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="font-medium">Churn Probability</span>
            </div>
            <div className="text-3xl font-bold text-orange-600 mb-1">8.4%</div>
            <div className="text-sm text-muted-foreground">42 members at high risk</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-green-600" />
              <span className="font-medium">Retention Rate</span>
            </div>
            <div className="text-3xl font-bold text-green-600 mb-1">91.6%</div>
            <div className="text-sm text-muted-foreground">Expected 30-day retention</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

