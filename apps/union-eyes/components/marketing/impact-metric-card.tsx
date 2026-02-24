/**
 * Impact Metric Card Component
 * 
 * Purpose: Display before/after metrics from case studies and pilots
 * Shows tangible improvements in union operations
 * 
 * Design: Data-driven, serious, institutional credibility
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, ArrowRight } from 'lucide-react';

interface ImpactMetricCardProps {
  label: string;
  before: number;
  after: number;
  unit: string;
  improvement?: string; // Auto-calculated if not provided
  context?: string; // e.g., "CLC Pilot (6 months)"
  higherIsBetter?: boolean; // Default true
  className?: string;
  compact?: boolean;
}

export function ImpactMetricCard({
  label,
  before,
  after,
  unit,
  improvement,
  context,
  higherIsBetter = false, // For most metrics, lower is better (time, escalations, etc.)
  className,
  compact = false,
}: ImpactMetricCardProps) {
  // Calculate improvement if not provided
  const calculatedImprovement = improvement || calculateImprovement(before, after);
  const isPositive = higherIsBetter ? after > before : after < before;
  const ImprovementIcon = isPositive ? TrendingDown : TrendingUp;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg',
          className
        )}
      >
        <div className="flex-1">
          <p className="text-sm text-slate-600 mb-1">{label}</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-slate-900">
              {formatNumber(after)} {unit}
            </span>
            <span
              className={cn(
                'text-sm font-medium',
                isPositive ? 'text-emerald-600' : 'text-slate-500'
              )}
            >
              {calculatedImprovement}
            </span>
          </div>
        </div>
        {isPositive && (
          <ImprovementIcon className="h-5 w-5 text-emerald-600 shrink-0" />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-lg p-6 shadow-sm',
        className
      )}
    >
      <div className="mb-4">
        <h4 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
          {label}
        </h4>
        {context && (
          <p className="text-xs text-slate-500 mt-1">{context}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Before</p>
          <p className="text-2xl font-bold text-slate-400">
            {formatNumber(before)}
            <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
          </p>
        </div>

        <ArrowRight className="h-5 w-5 text-slate-300 shrink-0" />

        <div>
          <p className="text-xs text-slate-500 mb-1">After</p>
          <p className="text-2xl font-bold text-slate-900">
            {formatNumber(after)}
            <span className="text-sm font-normal text-slate-600 ml-1">{unit}</span>
          </p>
        </div>
      </div>

      <div
        className={cn(
          'flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
          isPositive ? 'bg-emerald-50' : 'bg-slate-50'
        )}
      >
        {isPositive && (
          <ImprovementIcon className="h-4 w-4 text-emerald-600" />
        )}
        <span
          className={cn(
            'text-sm font-semibold',
            isPositive ? 'text-emerald-700' : 'text-slate-600'
          )}
        >
          {calculatedImprovement} {isPositive ? 'improvement' : 'change'}
        </span>
      </div>
    </div>
  );
}

/**
 * Grid layout for multiple metrics
 */
interface ImpactMetricGridProps {
  metrics: Array<{
    label: string;
    before: number;
    after: number;
    unit: string;
    improvement?: string;
    higherIsBetter?: boolean;
  }>;
  context?: string;
  className?: string;
}

export function ImpactMetricGrid({
  metrics,
  context,
  className,
}: ImpactMetricGridProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {context && (
        <div className="text-center pb-2">
          <p className="text-sm text-slate-600 font-medium">{context}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <ImpactMetricCard
            key={index}
            {...metric}
            context={undefined} // Context shown at grid level
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Utility functions
 */
function calculateImprovement(before: number, after: number): string {
  if (before === 0) return 'N/A';
  
  const percentChange = ((after - before) / before) * 100;
  const sign = percentChange > 0 ? '+' : '';
  
  return `${sign}${Math.round(percentChange)}%`;
}

function formatNumber(num: number): string {
  // Format with commas for thousands
  if (num >= 1000) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }
  
  // Show decimals for small numbers
  if (num < 10 && num % 1 !== 0) {
    return num.toFixed(1);
  }
  
  return Math.round(num).toString();
}

/**
 * Example usage:
 * 
 * <ImpactMetricCard
 *   label="Average time to resolution"
 *   before={45}
 *   after={18}
 *   unit="days"
 *   context="CLC Pilot (6 months)"
 *   higherIsBetter={false}
 * />
 * 
 * <ImpactMetricGrid
 *   metrics={[
 *     { label: "Time to resolution", before: 45, after: 18, unit: "days" },
 *     { label: "Member satisfaction", before: 3.2, after: 4.6, unit: "/5", higherIsBetter: true },
 *     { label: "Escalation rate", before: 35, after: 12, unit: "%" },
 *   ]}
 *   context="Union Local 123 - 12 Month Impact"
 * />
 */
