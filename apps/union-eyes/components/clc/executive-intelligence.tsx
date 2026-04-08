"use client";

/**
 * CLC Executive Intelligence UI Components
 *
 * Four components consumed by the CLC Intelligence Console "Executive Brief" tab:
 * 1. ExecutiveSummaryBanner — posture headline + confidence badge
 * 2. ExecutivePriorityList — ranked priority cards with watch levels
 * 3. WhatChangedPanel — delta detection timeline
 * 4. ExecutiveActionBriefCard — action brief with next steps
 *
 * @module components/clc/executive-intelligence
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  Shield,
  Target,
  Zap,
  Plus,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

type MovementPosture = "steady" | "vigilant" | "heightened";
type WatchLevel = "monitor" | "elevated" | "high" | "critical";
type DeltaDirection = "up" | "down" | "new" | "resolved";

interface ExecutivePriority {
  id: string;
  title: string;
  watchLevel: WatchLevel;
  timeframe: string;
  confidence: number;
  whyItMatters: string;
  sourceTypes: string[];
  priorityScore: number;
}

interface MovementSummary {
  headline: string;
  summary: string;
  posture: MovementPosture;
  confidence: number;
  dominantSignals: string[];
  whyNow: string;
}

interface ExecutiveDelta {
  id: string;
  title: string;
  direction: DeltaDirection;
  explanation: string;
  confidence: number;
}

interface ExecutiveActionBrief {
  generatedAt: string;
  posture: MovementPosture;
  headline: string;
  summary: string;
  recommendedNextSteps: string[];
  confidence: number;
  nilInvoked: boolean;
  usedTimeSeries: boolean;
}

// ── Posture Styling ─────────────────────────────────────────────────────────

const POSTURE_CONFIG: Record<
  MovementPosture,
  { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }
> = {
  steady: {
    label: "Steady",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    icon: CheckCircle2,
  },
  vigilant: {
    label: "Vigilant",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
    icon: Eye,
  },
  heightened: {
    label: "Heightened",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
    icon: AlertTriangle,
  },
};

const WATCH_COLORS: Record<WatchLevel, string> = {
  monitor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  elevated: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const DELTA_ICONS: Record<DeltaDirection, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  new: Plus,
  resolved: CheckCircle2,
};

const DELTA_COLORS: Record<DeltaDirection, string> = {
  up: "text-red-600 dark:text-red-400",
  down: "text-green-600 dark:text-green-400",
  new: "text-blue-600 dark:text-blue-400",
  resolved: "text-green-600 dark:text-green-400",
};

// ── Executive Summary Banner ────────────────────────────────────────────────

interface ExecutiveSummaryBannerProps {
  summary: MovementSummary;
}

export function ExecutiveSummaryBanner({ summary }: ExecutiveSummaryBannerProps) {
  const posture = POSTURE_CONFIG[summary.posture];
  const PostureIcon = posture.icon;

  return (
    <Card className={`border ${posture.bgColor}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${posture.bgColor}`}>
            <PostureIcon className={`h-8 w-8 ${posture.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className={`text-xl font-semibold ${posture.color}`}>
                {posture.label} Posture
              </h2>
              <Badge variant="outline" className={posture.color}>
                {Math.round(summary.confidence * 100)}% confidence
              </Badge>
            </div>
            <p className="text-base font-medium text-foreground mb-1">
              {summary.headline}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              {summary.summary}
            </p>
            {summary.whyNow && (
              <div className="flex items-start gap-2 mt-2 p-2 rounded bg-background/50">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Why now:</span> {summary.whyNow}
                </p>
              </div>
            )}
            {summary.dominantSignals.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {summary.dominantSignals.map((signal, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {signal}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Executive Priority List ─────────────────────────────────────────────────

interface ExecutivePriorityListProps {
  priorities: ExecutivePriority[];
}

export function ExecutivePriorityList({ priorities }: ExecutivePriorityListProps) {
  if (priorities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" /> Executive Priorities
          </CardTitle>
          <CardDescription>No priorities detected in current data.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" /> Executive Priorities
        </CardTitle>
        <CardDescription>
          {priorities.length} priorit{priorities.length === 1 ? "y" : "ies"} ranked by composite score
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {priorities.map((p, index) => (
            <div
              key={p.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{p.title}</span>
                  <Badge className={`text-xs ${WATCH_COLORS[p.watchLevel]}`}>
                    {p.watchLevel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {p.whyItMatters}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {p.timeframe.replace(/_/g, " ")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" /> {Math.round(p.confidence * 100)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" /> {p.priorityScore.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── What Changed Panel ──────────────────────────────────────────────────────

interface WhatChangedPanelProps {
  deltas: ExecutiveDelta[];
}

export function WhatChangedPanel({ deltas }: WhatChangedPanelProps) {
  if (deltas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> What Changed
          </CardTitle>
          <CardDescription>No changes detected since last review.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> What Changed
        </CardTitle>
        <CardDescription>
          {deltas.length} change{deltas.length === 1 ? "" : "s"} since last review
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {deltas.map((delta) => {
            const DeltaIcon = DELTA_ICONS[delta.direction];
            const colorClass = DELTA_COLORS[delta.direction];
            return (
              <div
                key={delta.id}
                className="flex items-start gap-3 p-2.5 rounded border"
              >
                <DeltaIcon className={`h-4 w-4 mt-0.5 shrink-0 ${colorClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{delta.title}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {delta.direction}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {delta.explanation}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Executive Action Brief Card ───────────────────────────────────────────

interface ExecutiveActionBriefCardProps {
  brief: ExecutiveActionBrief;
}

export function ExecutiveActionBriefCard({ brief }: ExecutiveActionBriefCardProps) {
  const posture = POSTURE_CONFIG[brief.posture];
  const PostureIcon = posture.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" /> Action Brief
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>Generated {new Date(brief.generatedAt).toLocaleString()}</span>
          {brief.nilInvoked && (
            <Badge variant="outline" className="text-xs">
              AI-enhanced
            </Badge>
          )}
          {brief.usedTimeSeries && (
            <Badge variant="outline" className="text-xs">
              Time-series
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Headline */}
          <div className="flex items-start gap-3">
            <PostureIcon className={`h-5 w-5 mt-0.5 shrink-0 ${posture.color}`} />
            <div>
              <p className="font-medium">{brief.headline}</p>
              <p className="text-sm text-muted-foreground mt-1">{brief.summary}</p>
            </div>
          </div>

          {/* Next Steps */}
          {brief.recommendedNextSteps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <ArrowRight className="h-4 w-4" /> Recommended Next Steps
              </h4>
              <ul className="space-y-1.5">
                {brief.recommendedNextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground font-mono text-xs mt-0.5">
                      {i + 1}.
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Confidence */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Confidence: {Math.round(brief.confidence * 100)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
