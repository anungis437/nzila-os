"use client";

/**
 * Pilot Admin Overview
 *
 * Admin-only view showing:
 *  - Active users, cases created, usage trends
 *  - Friction detection alerts
 *  - Champion candidates
 *  - Conversion readiness signals
 *  - Feedback summary
 *
 * Simple view, pilot phase — no heavy dashboard work.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  TrendingUp,
  AlertTriangle,
  Award,
  CheckCircle2,
  Star,
  Clock,
  XCircle,
} from "lucide-react";

interface Metrics {
  timeToFirstCase: number | null;
  timeToFirstUpdate: number | null;
  casesPerUser: number;
  updatesPerCase: number;
  dailyActiveUsers: number;
  totalUsers: number;
  totalCases: number;
  totalUpdates: number;
}

interface FrictionSummary {
  loginNoCase: number;
  caseNoUpdate: number;
  inactive: number;
}

interface Champion {
  userId: string;
  casesCreated: number;
  updatesAdded: number;
  activeDays: number;
  score: number;
}

interface Readiness {
  isReady: boolean;
  signals: {
    multipleActiveUsers: boolean;
    sufficientCaseVolume: boolean;
    repeatedTracking: boolean;
    consistentUsage: boolean;
  };
  activeUsers14d: number;
  totalCases: number;
  totalUpdates: number;
  activeDays14d: number;
}

interface FeedbackSummary {
  total_responses: number;
  avg_ease_rating: number;
  confusing_count: number;
  slow_count: number;
  unnecessary_count: number;
  missing_feature_count: number;
}

interface PilotAdminOverviewProps {
  organizationId: string;
}

export default function PilotAdminOverview({ organizationId }: PilotAdminOverviewProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [friction, setFriction] = useState<FrictionSummary | null>(null);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [mRes, fRes, cRes, rRes, fbRes] = await Promise.all([
          fetch(`/api/pilot/metrics?organizationId=${organizationId}`),
          fetch(`/api/pilot/friction?organizationId=${organizationId}&summary=true`),
          fetch(`/api/pilot/champions?organizationId=${organizationId}`),
          fetch(`/api/pilot/readiness?organizationId=${organizationId}`),
          fetch(`/api/pilot/feedback?organizationId=${organizationId}`),
        ]);

        if (mRes.ok) setMetrics(await mRes.json());
        if (fRes.ok) setFriction(await fRes.json());
        if (cRes.ok) {
          const data = await cRes.json();
          setChampions(data.champions ?? []);
        }
        if (rRes.ok) setReadiness(await rRes.json());
        if (fbRes.ok) {
          const data = await fbRes.json();
          setFeedback(data.summary ?? null);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Pilot Overview</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={<Users size={18} />} label="Active Users" value={metrics?.totalUsers ?? 0} />
        <MetricCard icon={<FileText size={18} />} label="Cases Created" value={metrics?.totalCases ?? 0} />
        <MetricCard icon={<TrendingUp size={18} />} label="DAU Today" value={metrics?.dailyActiveUsers ?? 0} />
        <MetricCard
          icon={<Clock size={18} />}
          label="Avg Time to First Case"
          value={metrics?.timeToFirstCase ? `${Math.round(metrics.timeToFirstCase)}m` : "—"}
        />
      </div>

      {/* Engagement */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          icon={<FileText size={18} />}
          label="Cases per User"
          value={metrics?.casesPerUser?.toFixed(1) ?? "0"}
        />
        <MetricCard
          icon={<TrendingUp size={18} />}
          label="Updates per Case"
          value={metrics?.updatesPerCase?.toFixed(1) ?? "0"}
        />
      </div>

      {/* Friction Alerts */}
      {friction && (friction.loginNoCase > 0 || friction.caseNoUpdate > 0 || friction.inactive > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              Friction Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {friction.loginNoCase > 0 && (
              <FrictionRow
                label="Logged in but no case"
                count={friction.loginNoCase}
              />
            )}
            {friction.caseNoUpdate > 0 && (
              <FrictionRow
                label="Case created, no updates"
                count={friction.caseNoUpdate}
              />
            )}
            {friction.inactive > 0 && (
              <FrictionRow
                label="Inactive after first session"
                count={friction.inactive}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Conversion Readiness */}
      {readiness && (
        <Card className={readiness.isReady ? "border-green-200 bg-green-50" : "border-gray-200"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {readiness.isReady ? (
                <CheckCircle2 size={16} className="text-green-600" />
              ) : (
                <Clock size={16} className="text-gray-500" />
              )}
              Conversion Readiness
              {readiness.isReady && (
                <Badge className="bg-green-600 text-white ml-2">Ready</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <SignalRow
                label="Multiple active users (≥3)"
                met={readiness.signals.multipleActiveUsers}
                value={readiness.activeUsers14d}
              />
              <SignalRow
                label="Case volume (≥10)"
                met={readiness.signals.sufficientCaseVolume}
                value={readiness.totalCases}
              />
              <SignalRow
                label="Repeated tracking (≥5 updates)"
                met={readiness.signals.repeatedTracking}
                value={readiness.totalUpdates}
              />
              <SignalRow
                label="Consistent usage (≥5 days)"
                met={readiness.signals.consistentUsage}
                value={readiness.activeDays14d}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Champions */}
      {champions.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award size={16} className="text-purple-600" />
              Potential Champions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {champions.map((c) => (
                <div key={c.userId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 font-medium truncate max-w-40">
                    {c.userId}
                  </span>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{c.casesCreated} cases</span>
                    <span>{c.updatesAdded} updates</span>
                    <span>{c.activeDays}d active</span>
                    <Badge variant="outline" className="text-purple-600">
                      Score: {c.score}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Summary */}
      {feedback && feedback.total_responses > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star size={16} className="text-yellow-500" />
              Feedback ({feedback.total_responses} responses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-3">
              <div className="text-2xl font-bold text-gray-900">
                {feedback.avg_ease_rating?.toFixed(1) ?? "—"}
              </div>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    className={
                      s <= Math.round(feedback.avg_ease_rating ?? 0)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">avg ease rating</span>
            </div>
            {(feedback.confusing_count > 0 ||
              feedback.slow_count > 0 ||
              feedback.unnecessary_count > 0 ||
              feedback.missing_feature_count > 0) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {feedback.confusing_count > 0 && (
                  <Badge variant="outline">Confusing ({feedback.confusing_count})</Badge>
                )}
                {feedback.slow_count > 0 && (
                  <Badge variant="outline">Slow ({feedback.slow_count})</Badge>
                )}
                {feedback.unnecessary_count > 0 && (
                  <Badge variant="outline">Extra steps ({feedback.unnecessary_count})</Badge>
                )}
                {feedback.missing_feature_count > 0 && (
                  <Badge variant="outline">Missing feature ({feedback.missing_feature_count})</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="bg-white">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">{icon}</div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FrictionRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-amber-800">{label}</span>
      <Badge variant="outline" className="text-amber-700 border-amber-300">
        {count} users
      </Badge>
    </div>
  );
}

function SignalRow({
  label,
  met,
  value,
}: {
  label: string;
  met: boolean;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <CheckCircle2 size={14} className="text-green-600 shrink-0" />
      ) : (
        <XCircle size={14} className="text-gray-400 shrink-0" />
      )}
      <span className={met ? "text-gray-700" : "text-gray-500"}>
        {label}: {value}
      </span>
    </div>
  );
}
