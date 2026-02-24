/**
 * System Status Badge Component
 * 
 * Purpose: Display real-time status of trust infrastructure
 * Shows: RLS enforcement, immutability, FSM validation, governance
 * 
 * Design: Institutional credibility, technical transparency
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, XCircle, HelpCircle } from 'lucide-react';
 
import { SystemStatus } from '@/types/marketing';

interface SystemStatusBadgeProps {
  system: string;
  status: SystemStatus;
  auditUrl?: string;
  lastCheck?: Date;
  className?: string;
}

const statusConfig: Record<
  SystemStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  active: {
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    label: 'Active',
  },
  degraded: {
    icon: AlertCircle,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    label: 'Degraded',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600 bg-red-50 border-red-200',
    label: 'Error',
  },
  unknown: {
    icon: HelpCircle,
    color: 'text-slate-600 bg-slate-50 border-slate-200',
    label: 'Unknown',
  },
};

export function SystemStatusBadge({
  system,
  status,
  auditUrl,
  lastCheck: _lastCheck,
  className,
}: SystemStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium',
        config.color,
        auditUrl && 'cursor-pointer hover:shadow-sm transition-shadow',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{system}</span>
      <span className="text-xs opacity-75">·</span>
      <span className="text-xs">{config.label}</span>
    </div>
  );

  if (auditUrl) {
    return (
      <a href={auditUrl} className="inline-block">
        {badge}
      </a>
    );
  }

  return badge;
}

/**
 * Full status card with details
 */
interface SystemStatusCardProps {
  system: string;
  status: SystemStatus;
  description: string;
  auditUrl?: string;
  lastCheck?: Date;
  metadata?: Array<{
    label: string;
    value: string | number;
  }>;
  className?: string;
}

export function SystemStatusCard({
  system,
  status,
  description,
  auditUrl,
  lastCheck,
  metadata,
  className,
}: SystemStatusCardProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-lg p-6 shadow-sm',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', config.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{system}</h3>
            <p className="text-sm text-slate-600">{config.label}</p>
          </div>
        </div>
        {lastCheck && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Last checked</p>
            <p className="text-xs text-slate-600 font-medium">
              {formatLastCheck(lastCheck)}
            </p>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-700 mb-4">{description}</p>

      {metadata && metadata.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {metadata.map((item, index) => (
            <div key={index} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-600 mb-1">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {auditUrl && (
        <a
          href={auditUrl}
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          View audit log →
        </a>
      )}
    </div>
  );
}

/**
 * Grid of system status badges
 */
interface SystemStatusGridProps {
  systems: Array<{
    system: string;
    status: SystemStatus;
    description: string;
    auditUrl?: string;
    lastCheck?: Date;
    metadata?: Array<{ label: string; value: string | number }>;
  }>;
  className?: string;
}

export function SystemStatusGrid({ systems, className }: SystemStatusGridProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      {systems.map((sys, index) => (
        <SystemStatusCard key={index} {...sys} />
      ))}
    </div>
  );
}

/**
 * Utility functions
 */
function formatLastCheck(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Example usage:
 * 
 * <SystemStatusBadge
 *   system="RLS Enforcement"
 *   status="active"
 *   auditUrl="/trust#rls"
 * />
 * 
 * <SystemStatusCard
 *   system="Immutability Enforcement"
 *   status="active"
 *   description="Database triggers prevent modification of historical records (Migration 0064)"
 *   lastCheck={new Date()}
 *   metadata={[
 *     { label: "Triggers Active", value: "12" },
 *     { label: "Tables Protected", value: "8" },
 *     { label: "Violations Blocked", value: "0" }
 *   ]}
 *   auditUrl="/trust#immutability"
 * />
 */
