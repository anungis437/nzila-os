/**
 * Clause Trends By Type Analytics Component
 * 
 * Visualizes distribution and trends of different clause types across CBAs
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface ClauseTypeStats {
  clauseType: string;
  count: number;
  percentage: number;
  avgConfidence: number;
  recentlyAdded: number;
}

interface ClauseTrendsByTypeProps {
  organizationId?: string;
  jurisdiction?: string;
  sector?: string;
}

export function ClauseTrendsByType({
  organizationId,
  jurisdiction,
  sector,
}: ClauseTrendsByTypeProps) {
  const [clauseStats, setClauseStats] = useState<ClauseTypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalClauses, setTotalClauses] = useState(0);

  useEffect(() => {
    fetchClauseTypeDistribution();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, jurisdiction, sector]);

  const fetchClauseTypeDistribution = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (organizationId) params.append('organizationId', organizationId);
      if (jurisdiction) params.append('jurisdiction', jurisdiction);
      if (sector) params.append('sector', sector);
      params.append('distribution', 'true');

      const response = await fetch(`/api/clauses?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch clause statistics');

      const data = await response.json();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const total = data.distribution?.reduce((sum: number, item: any) => sum + item.count, 0) || 0;
      setTotalClauses(total);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statsWithPercentage = data.distribution?.map((item: any) => ({
        ...item,
        percentage: total > 0 ? (item.count / total) * 100 : 0,
      })) || [];

      setClauseStats(statsWithPercentage);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getClauseTypeLabel = (type: string): string => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getClauseTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      wages: 'bg-blue-500',
      benefits_health: 'bg-green-500',
      benefits_dental: 'bg-green-400',
      benefits_pension: 'bg-green-600',
      hours_of_work: 'bg-purple-500',
      overtime: 'bg-purple-400',
      vacation: 'bg-cyan-500',
      leaves_sick: 'bg-yellow-500',
      leaves_parental: 'bg-yellow-400',
      seniority: 'bg-orange-500',
      layoff_recall: 'bg-red-500',
      discipline: 'bg-red-400',
      grievance_procedure: 'bg-pink-500',
      arbitration: 'bg-pink-400',
      safety: 'bg-indigo-500',
      harassment: 'bg-indigo-400',
      union_business: 'bg-teal-500',
      management_rights: 'bg-gray-500',
      other: 'bg-gray-400',
    };

    return colors[type] || 'bg-gray-400';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clause Distribution by Type</CardTitle>
          <CardDescription>Loading clause type statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clause Distribution by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clause Distribution by Type</CardTitle>
        <CardDescription>
          Analysis of {totalClauses.toLocaleString()} clauses across your agreements
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Top 5 Visual Bar Chart */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Top Clause Types</h3>
          <div className="space-y-3">
            {clauseStats.slice(0, 5).map((stat, index) => (
              <div key={stat.clauseType}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {index + 1}. {getClauseTypeLabel(stat.clauseType)}
                    </span>
                    {stat.avgConfidence >= 0.9 && (
                      <Badge variant="outline" className="text-xs">
                        High Confidence
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {stat.count} ({stat.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-6 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full ${getClauseTypeColor(stat.clauseType)} transition-all duration-500`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Complete Distribution Grid */}
        <div>
          <h3 className="text-sm font-semibold mb-3">All Clause Types</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {clauseStats.map(stat => (
              <div
                key={stat.clauseType}
                className="border rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-3 h-3 rounded-full ${getClauseTypeColor(stat.clauseType)}`}
                  />
                  <span className="text-sm font-medium truncate">
                    {getClauseTypeLabel(stat.clauseType)}
                  </span>
                </div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-muted-foreground">
                  {stat.percentage.toFixed(1)}% of total
                </p>
                {stat.recentlyAdded > 0 && (
                  <Badge variant="secondary" className="text-xs mt-1">
                    +{stat.recentlyAdded} recent
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {clauseStats.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No clause data available
          </p>
        )}
      </CardContent>
    </Card>
  );
}

