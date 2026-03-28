/**
 * Rep Ratings Dashboard — LRO Performance Analytics
 *
 * Steward-facing dashboard showing:
 * - All LRO satisfaction rankings
 * - Individual metric breakdowns (radar chart style)
 * - Trend indicators
 * - Recommendation rates
 *
 * @module components/satisfaction/rep-ratings-dashboard
 */

"use client";

import * as React from "react";
import {
  Star,
  ThumbsUp,
  Users,
  Award,
  MessageSquare,
  Clock,
  BookOpen,
  Megaphone,
  Briefcase,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LroPerformanceData {
  lroId: string;
  lroName?: string;
  totalSurveys: number;
  completedSurveys: number;
  avgCommunication: number;
  avgResponsiveness: number;
  avgKnowledge: number;
  avgAdvocacy: number;
  avgProfessionalism: number;
  avgOutcome: number;
  overallAverage: number;
  recommendRate: number;
}

export interface RepRatingsDashboardProps {
  rankings: LroPerformanceData[];
  isLoading?: boolean;
}

// ── Metric config ────────────────────────────────────────────────────────────

const METRIC_CONFIG = [
  { key: "avgCommunication", label: "Communication", icon: MessageSquare, color: "text-blue-500" },
  { key: "avgResponsiveness", label: "Responsiveness", icon: Clock, color: "text-emerald-500" },
  { key: "avgKnowledge", label: "Knowledge", icon: BookOpen, color: "text-purple-500" },
  { key: "avgAdvocacy", label: "Advocacy", icon: Megaphone, color: "text-orange-500" },
  { key: "avgProfessionalism", label: "Professionalism", icon: Briefcase, color: "text-slate-500" },
  { key: "avgOutcome", label: "Outcome", icon: Target, color: "text-rose-500" },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ratingColor(score: number): string {
  if (score >= 4.5) return "text-green-600";
  if (score >= 3.5) return "text-emerald-600";
  if (score >= 2.5) return "text-yellow-600";
  if (score >= 1.5) return "text-orange-600";
  return "text-red-600";
}

function ratingBadge(score: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (score >= 4.5) return { label: "Exceptional", variant: "default" };
  if (score >= 3.5) return { label: "Good", variant: "secondary" };
  if (score >= 2.5) return { label: "Fair", variant: "outline" };
  return { label: "Needs Improvement", variant: "destructive" };
}

// ── Metric Bar Sub-component ────────────────────────────────────────────────

function MetricBar({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const pct = (value / 5) * 100;

  return (
    <div className="flex items-center gap-3">
      <Icon className={cn("h-4 w-4 shrink-0", color)} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium truncate">{label}</span>
          <span className={cn("font-semibold", ratingColor(value))}>{value.toFixed(1)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              value >= 4 ? "bg-green-500" : value >= 3 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── LRO Card Sub-component ──────────────────────────────────────────────────

function LroCard({
  lro,
  rank,
}: {
  lro: LroPerformanceData;
  rank: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const badge = ratingBadge(lro.overallAverage);

  return (
    <Card className={cn(
      "transition-all",
      rank === 1 && "border-yellow-300 shadow-md"
    )}>
      <CardContent className="pt-4 pb-4">
        {/* Header row */}
        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shrink-0",
            rank === 1 ? "bg-yellow-100 text-yellow-700" :
            rank === 2 ? "bg-gray-100 text-gray-700" :
            rank === 3 ? "bg-orange-100 text-orange-700" :
            "bg-muted text-muted-foreground"
          )}>
            {rank <= 3 ? <Award className="h-5 w-5" /> : `#${rank}`}
          </div>

          {/* Name + overall */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">
                {lro.lroName || `LRO ${lro.lroId.slice(0, 8)}`}
              </h3>
              <Badge variant={badge.variant} className="shrink-0 text-xs">
                {badge.label}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className={cn("h-4 w-4", ratingColor(lro.overallAverage))} />
                <strong className={ratingColor(lro.overallAverage)}>
                  {lro.overallAverage.toFixed(1)}
                </strong>
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {lro.completedSurveys} reviews
              </span>
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" />
                {lro.recommendRate}% recommend
              </span>
            </div>
          </div>

          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Expanded metric breakdown */}
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {METRIC_CONFIG.map((metric) => (
              <MetricBar
                key={metric.key}
                label={metric.label}
                value={(lro as Record<string, number>)[metric.key] ?? 0}
                icon={metric.icon}
                color={metric.color}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────

export function RepRatingsDashboard({
  rankings,
  isLoading,
}: RepRatingsDashboardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <div className="animate-pulse">Loading LRO performance data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!rankings || rankings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold">No Ratings Yet</h3>
          <p className="text-muted-foreground mt-1">
            Satisfaction surveys will appear here after cases are closed.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const totalReviews = rankings.reduce((sum, r) => sum + r.completedSurveys, 0);
  const avgOverall =
    rankings.reduce((sum, r) => sum + r.overallAverage * r.completedSurveys, 0) /
    (totalReviews || 1);
  const avgRecommend =
    rankings.reduce((sum, r) => sum + r.recommendRate * r.completedSurveys, 0) /
    (totalReviews || 1);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <div className={cn("text-3xl font-bold", ratingColor(avgOverall))}>
              {avgOverall.toFixed(1)}
            </div>
            <p className="text-sm text-muted-foreground">Avg. Overall Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <div className="text-3xl font-bold">{totalReviews}</div>
            <p className="text-sm text-muted-foreground">Total Reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <ThumbsUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <div className="text-3xl font-bold">{avgRecommend.toFixed(0)}%</div>
            <p className="text-sm text-muted-foreground">Recommend Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Rankings Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            LRO Performance Rankings
          </CardTitle>
          <CardDescription>
            Based on {totalReviews} satisfaction surveys across {rankings.length} representatives
          </CardDescription>
        </CardHeader>
      </Card>

      {/* LRO Cards */}
      <div className="space-y-3">
        {rankings.map((lro, i) => (
          <LroCard key={lro.lroId} lro={lro} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
