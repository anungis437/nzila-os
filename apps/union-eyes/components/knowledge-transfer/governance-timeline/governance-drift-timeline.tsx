'use client';

/**
 * Governance Drift Timeline
 *
 * Visualizes continuity governance activity and knowledge capture velocity
 * over time. Uses Recharts for time-series rendering.
 *
 * Shows:
 *   - Interview capture rate over time
 *   - Governance update activity
 *   - Average risk trajectory
 *   - Consent coverage rate trend
 *
 * This is ORGANIZATIONAL CONTINUITY OBSERVABILITY.
 * It does NOT track individuals — only governance events and capture patterns.
 */

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface GovernanceTimelineEntry {
  month: string;
  newInterviewCount: number;
  publishedCount: number;
  governanceUpdateCount: number;
  averageRiskScore: number | null;
  consentCoverageRate: number;
}

interface GovernanceDriftReport {
  organizationId: string;
  generatedAt: string;
  timeline: GovernanceTimelineEntry[];
  currentExposureScore: number;
  trendDirection: 'improving' | 'stable' | 'degrading';
  totalInterviewsCaptured: number;
  totalPublished: number;
  governanceActivityLast30Days: number;
}

const TREND_CONFIG = {
  improving: { label: 'Improving', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  stable: { label: 'Stable', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  degrading: { label: 'Needs attention', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
};

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white shadow-md p-3 text-xs space-y-1">
      <p className="font-semibold text-slate-700">{label ? formatMonth(label) : ''}</p>
      {payload.map((entry) =>
        entry.value != null ? (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: <span className="font-medium tabular-nums">{entry.value}</span>
          </p>
        ) : null,
      )}
    </div>
  );
}

export function GovernanceDriftTimeline({ report }: { report: GovernanceDriftReport }) {
  const trendConfig = TREND_CONFIG[report.trendDirection];

  const chartData = report.timeline.map((entry) => ({
    month: entry.month,
    label: formatMonth(entry.month),
    'New captures': entry.newInterviewCount,
    'Published': entry.publishedCount,
    'Governance updates': entry.governanceUpdateCount,
    'Avg risk score': entry.averageRiskScore,
    'Consent rate': entry.consentCoverageRate,
  }));

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border bg-card p-3 text-center">
          <p className="text-xl font-bold tabular-nums">{report.totalInterviewsCaptured}</p>
          <p className="text-xs text-muted-foreground">Captured (12mo)</p>
        </div>
        <div className="rounded-md border bg-card p-3 text-center">
          <p className="text-xl font-bold tabular-nums">{report.totalPublished}</p>
          <p className="text-xs text-muted-foreground">Published</p>
        </div>
        <div className="rounded-md border bg-card p-3 text-center">
          <p className="text-xl font-bold tabular-nums">{report.governanceActivityLast30Days}</p>
          <p className="text-xs text-muted-foreground">Gov. updates (30d)</p>
        </div>
        <div className={`rounded-md border p-3 text-center ${trendConfig.bg} ${trendConfig.border}`}>
          <p className={`text-base font-semibold ${trendConfig.color}`}>{trendConfig.label}</p>
          <p className="text-xs text-muted-foreground">Risk trend</p>
        </div>
      </div>

      {/* Knowledge capture velocity */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Knowledge Capture Velocity</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#64748b' }}
              iconSize={10}
            />
            <Bar dataKey="New captures" fill="#6366f1" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Published" fill="#10b981" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk trajectory */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Risk Trajectory & Governance Activity</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#64748b' }}
              iconSize={10}
            />
            <Line
              type="monotone"
              dataKey="Avg risk score"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Consent rate"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Governance updates activity */}
      {chartData.some((d) => (d['Governance updates'] ?? 0) > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Governance Update Activity</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Governance updates" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing last 12 months of knowledge governance activity.
        Risk scores reflect organizational continuity fragility — not individual performance.
        Last updated {new Date(report.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}

/**
 * Self-loading governance drift timeline container.
 */
export function GovernanceDriftTimelineContainer() {
  const [report, setReport] = useState<GovernanceDriftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/exit-interviews/analytics', { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 403) { setLoading(false); return; }
          throw new Error('Failed to load governance timeline');
        }
        const payload = await res.json() as { data: GovernanceDriftReport };
        setReport(payload.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-48 rounded-lg bg-muted/30 animate-pulse" />
        <div className="h-48 rounded-lg bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load governance timeline.
      </div>
    );
  }

  if (!report) return null;

  return <GovernanceDriftTimeline report={report} />;
}
