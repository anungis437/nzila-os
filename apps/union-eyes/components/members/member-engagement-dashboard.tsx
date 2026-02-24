/**
 * Member Engagement Dashboard Component
 * 
 * Comprehensive engagement tracking with:
 * - Activity heatmap
 * - Engagement scores
 * - Participation metrics
 * - Event attendance
 * - Communication history
 * - Trend analysis
 * 
 * @module components/members/member-engagement-dashboard
 */

"use client";

import * as React from "react";
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Calendar,
  FileText,
  Users,
  Activity,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
 
import { format, subMonths, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";

export interface EngagementMetrics {
  score: number; // 0-100
  trend: "up" | "down" | "stable";
  eventsAttended: number;
  totalEvents: number;
  claimsSubmitted: number;
  messagesReceived: number;
  messagesOpened: number;
  meetingsAttended: number;
  totalMeetings: number;
  lastActivity?: Date;
}

export interface ActivityData {
  date: Date;
  count: number;
  type: "event" | "claim" | "message" | "meeting";
}

export interface MemberEngagementDashboardProps {
  memberId: string;
  memberName: string;
  metrics: EngagementMetrics;
  activityData: ActivityData[];
  period?: "30d" | "90d" | "12m";
}

export function MemberEngagementDashboard({
  memberId: _memberId,
  memberName,
  metrics,
  activityData,
  period = "90d",
}: MemberEngagementDashboardProps) {
  const engagementLevel = React.useMemo(() => {
    if (metrics.score >= 80) return { label: "Highly Engaged", color: "green", variant: "success" as const };
    if (metrics.score >= 60) return { label: "Engaged", color: "blue", variant: "default" as const };
    if (metrics.score >= 40) return { label: "Moderately Engaged", color: "yellow", variant: "secondary" as const };
    return { label: "Low Engagement", color: "red", variant: "destructive" as const };
  }, [metrics.score]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Engagement Dashboard</h2>
          <p className="text-gray-600">{memberName}</p>
        </div>
        <Badge variant={engagementLevel.variant} className="text-sm">
          {engagementLevel.label}
        </Badge>
      </div>

      {/* Engagement Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Overall Engagement Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="text-5xl font-bold">{metrics.score}</div>
            <div className="flex items-center gap-2 text-sm mb-2">
              {metrics.trend === "up" && (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">Improving</span>
                </>
              )}
              {metrics.trend === "down" && (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-red-600 font-medium">Declining</span>
                </>
              )}
              {metrics.trend === "stable" && (
                <span className="text-gray-600 font-medium">Stable</span>
              )}
            </div>
          </div>
          <Progress value={metrics.score} className="h-3" />
          <p className="text-sm text-gray-600">
            Based on event attendance, claim activity, and communication engagement
          </p>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Events */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Calendar className="h-8 w-8 text-blue-600" />
              <Badge variant="outline">{period}</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{metrics.eventsAttended}</div>
              <div className="text-sm text-gray-600">Events Attended</div>
              <div className="text-xs text-gray-500">
                of {metrics.totalEvents} total events
              </div>
            </div>
            <Progress
              value={(metrics.eventsAttended / metrics.totalEvents) * 100}
              className="mt-3"
            />
          </CardContent>
        </Card>

        {/* Claims */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <FileText className="h-8 w-8 text-green-600" />
              <Badge variant="outline">{period}</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{metrics.claimsSubmitted}</div>
              <div className="text-sm text-gray-600">Claims Submitted</div>
              <div className="text-xs text-gray-500">
                Total cases filed
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="h-8 w-8 text-purple-600" />
              <Badge variant="outline">{period}</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{metrics.messagesOpened}</div>
              <div className="text-sm text-gray-600">Messages Opened</div>
              <div className="text-xs text-gray-500">
                of {metrics.messagesReceived} received
              </div>
            </div>
            <Progress
              value={(metrics.messagesOpened / metrics.messagesReceived) * 100}
              className="mt-3"
            />
          </CardContent>
        </Card>

        {/* Meetings */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Users className="h-8 w-8 text-orange-600" />
              <Badge variant="outline">{period}</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{metrics.meetingsAttended}</div>
              <div className="text-sm text-gray-600">Meetings Attended</div>
              <div className="text-xs text-gray-500">
                of {metrics.totalMeetings} scheduled
              </div>
            </div>
            <Progress
              value={(metrics.meetingsAttended / metrics.totalMeetings) * 100}
              className="mt-3"
            />
          </CardContent>
        </Card>
      </div>

      {/* Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Heatmap - Last 90 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap data={activityData} />
        </CardContent>
      </Card>

      {/* Recent Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={activityData.slice(0, 10)} />
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Award className="h-6 w-6 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                Engagement Recommendations
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                {metrics.eventsAttended / metrics.totalEvents < 0.5 && (
                  <li>• Encourage participation in upcoming union events</li>
                )}
                {metrics.messagesOpened / metrics.messagesReceived < 0.5 && (
                  <li>• Consider changing communication method preferences</li>
                )}
                {metrics.meetingsAttended / metrics.totalMeetings < 0.5 && (
                  <li>• Send reminders for upcoming meetings</li>
                )}
                {metrics.score < 40 && (
                  <li>• Consider a personal outreach call to re-engage member</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: ActivityData[] }) {
  const months = React.useMemo(() => {
    const endDate = new Date();
    const _startDate = subMonths(endDate, 3);
    return [0, 1, 2].map((i) => subMonths(endDate, 2 - i));
  }, []);

  const getDayIntensity = (date: Date): number => {
    const activity = data.find(
      (a) => format(a.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );
    return activity ? activity.count : 0;
  };

  const getIntensityClass = (intensity: number): string => {
    if (intensity === 0) return "bg-gray-100";
    if (intensity <= 2) return "bg-green-200";
    if (intensity <= 4) return "bg-green-400";
    return "bg-green-600";
  };

  return (
    <div className="space-y-3">
      {months.map((month) => {
        const days = eachDayOfInterval({
          start: startOfMonth(month),
          end: endOfMonth(month),
        });

        return (
          <div key={month.toISOString()}>
            <div className="text-sm font-medium mb-2">
              {format(month, "MMMM yyyy")}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const intensity = getDayIntensity(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "aspect-square rounded-sm cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all",
                      getIntensityClass(intensity)
                    )}
                    title={`${format(day, "MMM d")}: ${intensity} activities`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 text-xs text-gray-600 pt-2">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-gray-100 rounded-sm" />
          <div className="w-3 h-3 bg-green-200 rounded-sm" />
          <div className="w-3 h-3 bg-green-400 rounded-sm" />
          <div className="w-3 h-3 bg-green-600 rounded-sm" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

function ActivityTimeline({ activities }: { activities: ActivityData[] }) {
  const getActivityIcon = (type: ActivityData["type"]) => {
    switch (type) {
      case "event":
        return <Calendar className="h-4 w-4" />;
      case "claim":
        return <FileText className="h-4 w-4" />;
      case "message":
        return <MessageSquare className="h-4 w-4" />;
      case "meeting":
        return <Users className="h-4 w-4" />;
    }
  };

  const getActivityLabel = (type: ActivityData["type"]) => {
    switch (type) {
      case "event":
        return "Attended event";
      case "claim":
        return "Submitted claim";
      case "message":
        return "Opened message";
      case "meeting":
        return "Attended meeting";
    }
  };

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1">
            <div className="font-medium">{getActivityLabel(activity.type)}</div>
            <div className="text-sm text-gray-600">
              {format(activity.date, "PPp")}
            </div>
          </div>
          {activity.count > 1 && (
            <Badge variant="secondary">×{activity.count}</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

