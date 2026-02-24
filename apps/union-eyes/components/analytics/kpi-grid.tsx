'use client';

/**
 * KPI Grid Component
 * Displays custom KPIs in a responsive grid layout
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MoreVertical,
  AlertCircle,
  Edit,
  Trash,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface KPI {
  id: string;
  name: string;
  description?: string;
  metricType: string;
  visualizationType: 'line' | 'bar' | 'pie' | 'gauge' | 'number';
  targetValue?: string;
  warningThreshold?: string;
  criticalThreshold?: string;
  isActive: boolean;
  currentValue?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface KPIGridProps {
  kpis: KPI[];
}

export function KPIGrid({ kpis }: KPIGridProps) {
  const renderKPIWidget = (kpi: KPI) => {
    const currentValue = kpi.currentValue || 0;
    const target = kpi.targetValue ? Number(kpi.targetValue) : null;
    const warning = kpi.warningThreshold ? Number(kpi.warningThreshold) : null;
    const critical = kpi.criticalThreshold ? Number(kpi.criticalThreshold) : null;

    // Determine status based on thresholds
    let status: 'success' | 'warning' | 'critical' = 'success';
    if (critical && currentValue >= critical) {
      status = 'critical';
    } else if (warning && currentValue >= warning) {
      status = 'warning';
    }

    const statusColors = {
      success: 'text-green-600 bg-green-50 border-green-200',
      warning: 'text-orange-600 bg-orange-50 border-orange-200',
      critical: 'text-red-600 bg-red-50 border-red-200'
    };

    switch (kpi.visualizationType) {
      case 'number':
        return (
          <div className="text-center py-6">
            <div className={cn('text-5xl font-bold mb-2', statusColors[status].split(' ')[0])}>
              {currentValue.toFixed(0)}
            </div>
            {target && (
              <div className="text-sm text-muted-foreground">
                Target: {target.toFixed(0)}
              </div>
            )}
          </div>
        );

      case 'gauge':
        const percentage = target ? (currentValue / target) * 100 : 0;
        return (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-32 h-32">
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-gray-200"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${percentage * 3.51} 351`}
                  className={statusColors[status].split(' ')[0]}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{percentage.toFixed(0)}%</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {currentValue.toFixed(0)} / {target?.toFixed(0)}
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Chart visualization coming soon
          </div>
        );
    }
  };

  if (kpis.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="mb-4">No KPIs configured</p>
            <Button size="sm">Create Your First KPI</Button>
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
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-base">{kpi.name}</CardTitle>
                  {!kpi.isActive && (
                    <Badge variant="outline" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
                {kpi.description && (
                  <CardDescription className="text-xs">
                    {kpi.description}
                  </CardDescription>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>{renderKPIWidget(kpi)}</CardContent>
        </Card>
      ))}
    </div>
  );
}

