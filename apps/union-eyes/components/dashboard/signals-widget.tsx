/**
 * Dashboard Signals Widget
 * 
 * Real-time display of case signals and statistics for LRO dashboard.
 * Auto-refreshes every minute to detect new signals.
 * 
 * Feature flags:
 * - lro_dashboard_widget: Enable dashboard widget
 * - lro_auto_refresh: Enable auto-refresh functionality
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  detectAllSignals,
  getDashboardStats,
  filterBySeverity,
  type CaseForSignals,
  type Signal,
  type DashboardStats,
} from '@/lib/services/lro-signals';
import { SignalBadge } from '../cases/signal-badge';
import { useFeatureFlags } from '@/lib/hooks/use-feature-flags';
import { LRO_FEATURES } from '@/lib/services/feature-flags';

interface DashboardSignalsWidgetProps {
  cases: CaseForSignals[];
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  maxSignalsToShow?: number;
}

export function DashboardSignalsWidget({
  cases,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
  maxSignalsToShow = 10,
}: DashboardSignalsWidgetProps) {
  // Feature flags
  const flags = useFeatureFlags([
    LRO_FEATURES.AUTO_REFRESH,
  ]);
  
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refreshSignals = useCallback(() => {
    const currentDate = new Date();
    const allSignals = detectAllSignals(cases, currentDate);
    const dashboardStats = getDashboardStats(allSignals);
    
    setSignals(allSignals);
    setStats(dashboardStats);
    setLastRefresh(currentDate);
  }, [cases]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSignals();

    // Auto-refresh only if feature flag enabled
    if (autoRefresh && flags[LRO_FEATURES.AUTO_REFRESH]) {
      const interval = setInterval(refreshSignals, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refreshSignals, flags]);

  if (!stats) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const highPrioritySignals = filterBySeverity(signals, ['critical', 'urgent'])
    .slice(0, maxSignalsToShow);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Case Signals</h2>
        <div className="text-sm text-gray-500">
          Updated {formatRelativeTime(lastRefresh)}
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Critical"
          value={stats.totalCritical}
          severity="critical"
          icon="🔴"
          description="Immediate action required"
        />
        <StatCard
          label="Urgent"
          value={stats.totalUrgent}
          severity="urgent"
          icon="🟠"
          description="Priority action needed"
        />
        <StatCard
          label="At Risk"
          value={stats.atRiskCases}
          severity="warning"
          icon="⚠️"
          description="SLA approaching breach"
        />
        <StatCard
          label="Breached"
          value={stats.breachedCases}
          severity="critical"
          icon="❌"
          description="SLA standards violated"
        />
      </div>

      {/* Detailed Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MiniStatCard
          label="Awaiting Acknowledgment"
          value={stats.awaitingAcknowledgment}
          icon="📝"
        />
        <MiniStatCard
          label="Member Waiting"
          value={stats.memberWaiting}
          icon="⏳"
        />
        <MiniStatCard
          label="Stale Cases"
          value={stats.staleCases}
          icon="📅"
        />
      </div>

      {/* High Priority Signals List */}
      {highPrioritySignals.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              High Priority Alerts
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {highPrioritySignals.length} critical and urgent signals requiring attention
            </p>
          </div>
          
          <div className="divide-y">
            {highPrioritySignals.map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </div>

          {signals.length > maxSignalsToShow && (
            <div className="px-6 py-4 bg-gray-50 border-t">
              <Link
                href="/cases?filter=signals"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all {signals.length} signals →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* No signals state */}
      {highPrioritySignals.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            All Clear!
          </h3>
          <p className="text-sm text-green-700">
            No critical or urgent signals detected. All cases are on track.
          </p>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  severity: 'critical' | 'urgent' | 'warning';
  icon: string;
  description: string;
}

function StatCard({ label, value, severity, icon, description }: StatCardProps) {
  const severityColors = {
    critical: 'bg-red-50 border-red-200 text-red-900',
    urgent: 'bg-orange-50 border-orange-200 text-orange-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  };

  const valueColors = {
    critical: 'text-red-600',
    urgent: 'text-orange-600',
    warning: 'text-yellow-600',
  };

  return (
    <div className={`rounded-lg border p-4 ${severityColors[severity]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-bold ${valueColors[severity]}`}>
          {value}
        </span>
      </div>
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-xs opacity-75 mt-1">{description}</div>
    </div>
  );
}

interface MiniStatCardProps {
  label: string;
  value: number;
  icon: string;
}

function MiniStatCard({ label, value, icon }: MiniStatCardProps) {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-600">{label}</div>
        </div>
      </div>
    </div>
  );
}

interface SignalRowProps {
  signal: Signal;
}

function SignalRow({ signal }: SignalRowProps) {
  return (
    <Link
      href={`/cases/${signal.caseId}`}
      className="block px-6 py-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <SignalBadge signal={signal} size="sm" />
            <span className="text-xs text-gray-500">
              Case {signal.caseId}
            </span>
          </div>
          
          <h4 className="font-medium text-gray-900 mb-1">{signal.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">{signal.description}</p>
          
          {signal.context.memberName && (
            <div className="text-xs text-gray-500 mt-2">
              👤 {signal.context.memberName}
            </div>
          )}
        </div>

        {signal.actionable && signal.actionText && (
          <div className="shrink-0">
            <span className="inline-block px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium whitespace-nowrap">
              {signal.actionText}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  
  return date.toLocaleTimeString();
}

