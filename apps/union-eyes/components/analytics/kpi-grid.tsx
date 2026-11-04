'use client';

/**
 * KPI Grid Component
 * Displays the organization's active KPIs in a responsive grid.
 *
 * A KPI's current value is the latest stored metric of its metric type; a KPI whose metric has not been recorded shows a dash, never zero.
 */

import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { computeKpiHealth, type KpiHealth } from '@/lib/kpi/health';
import type { KpiConfig } from './analytics-readers';

export interface KpiView extends KpiConfig {
  currentValue: number | null;
}

interface KPIGridProps {
  kpis: KpiView[];
}

const HEALTH_TEXT: Record<KpiHealth, string> = {
  on_track: 'text-green-600',
  at_risk: 'text-orange-600',
  critical: 'text-red-600',
  no_data: 'text-foreground',
};

const formatValue = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

function KpiWidget({ kpi }: { kpi: KpiView }) {
  const { currentValue, targetValue } = kpi;
  const health = computeKpiHealth(currentValue, targetValue, kpi.warningThreshold, kpi.criticalThreshold, kpi.direction);
  const color = HEALTH_TEXT[health];

  if (currentValue === null) {
    return (
      <div className="text-center py-6">
        <div className="text-5xl font-bold mb-2 text-muted-foreground">—</div>
        <div className="text-sm text-muted-foreground">No {kpi.metricType.replace(/_/g, ' ')} metric has been recorded yet</div>
      </div>
    );
  }

  if (kpi.visualizationType === 'gauge' && targetValue !== null && targetValue !== 0) {
    const percentage = (currentValue / targetValue) * 100;
    const arc = Math.max(0, Math.min(percentage, 100));
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <div className="relative w-32 h-32">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200" />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${arc * 3.51} 351`}
              className={color}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold">{percentage.toFixed(0)}%</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          {formatValue(currentValue)} / {formatValue(targetValue)}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-6">
      <div className={cn('text-5xl font-bold mb-2', color)}>{formatValue(currentValue)}</div>
      {targetValue !== null && <div className="text-sm text-muted-foreground">Target: {formatValue(targetValue)}</div>}
    </div>
  );
}

export function KPIGrid({ kpis }: KPIGridProps) {
  if (kpis.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No KPIs configured</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi) => (
        <Card key={kpi.id} className={!kpi.isActive ? 'opacity-50' : ''}>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base">{kpi.name}</CardTitle>
              {!kpi.isActive && (
                <Badge variant="outline" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>
            {kpi.description !== null && <CardDescription className="text-xs">{kpi.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <KpiWidget kpi={kpi} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
