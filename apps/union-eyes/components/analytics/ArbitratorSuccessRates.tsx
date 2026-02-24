/**
 * Arbitrator Success Rates Analytics Component
 * 
 * Displays comprehensive analytics for arbitrator performance including:
 * - Win rates by party
 * - Average decision timeframes
 * - Specialization areas
 * - Historical trends
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ArbitratorStats {
  id: string;
  name: string;
  jurisdiction: string;
  totalDecisions: number;
  unionWins: number;
  employerWins: number;
  split: number;
  unionWinRate: number;
  employerWinRate: number;
  splitRate: number;
  averageDecisionDays: number;
  specializations: string[];
  yearsActive: number;
  lastDecisionDate: string;
}

interface ArbitratorSuccessRatesProps {
  organizationId?: string;
  jurisdiction?: string;
  limit?: number;
}

export function ArbitratorSuccessRates({
  organizationId,
  jurisdiction,
  limit = 10,
}: ArbitratorSuccessRatesProps) {
  const [arbitrators, setArbitrators] = useState<ArbitratorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'unionWinRate' | 'totalDecisions' | 'averageDecisionDays'>('unionWinRate');

  useEffect(() => {
    fetchArbitratorStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, jurisdiction, sortBy]);

  const fetchArbitratorStats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (organizationId) params.append('organizationId', organizationId);
      if (jurisdiction) params.append('jurisdiction', jurisdiction);
      params.append('limit', limit.toString());
      params.append('sortBy', sortBy);

      const response = await fetch(`/api/precedents?statistics=true&${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch arbitrator stats');

      const data = await response.json();
      
      // Calculate rates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statsWithRates = data.arbitrators?.map((arb: any) => ({
        ...arb,
        unionWinRate: arb.totalDecisions > 0 ? (arb.unionWins / arb.totalDecisions) * 100 : 0,
        employerWinRate: arb.totalDecisions > 0 ? (arb.employerWins / arb.totalDecisions) * 100 : 0,
        splitRate: arb.totalDecisions > 0 ? (arb.split / arb.totalDecisions) * 100 : 0,
      })) || [];

      setArbitrators(statsWithRates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getWinRateColor = (rate: number, perspective: 'union' | 'employer') => {
    if (perspective === 'union') {
      if (rate >= 60) return 'text-green-600 dark:text-green-400';
      if (rate >= 40) return 'text-yellow-600 dark:text-yellow-400';
      return 'text-red-600 dark:text-red-400';
    } else {
      if (rate >= 60) return 'text-red-600 dark:text-red-400';
      if (rate >= 40) return 'text-yellow-600 dark:text-yellow-400';
      return 'text-green-600 dark:text-green-400';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Arbitrator Success Rates</CardTitle>
          <CardDescription>Loading arbitrator statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Arbitrator Success Rates</CardTitle>
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
        <CardTitle>Arbitrator Success Rates</CardTitle>
        <CardDescription>
          Performance metrics and decision patterns for arbitrators
        </CardDescription>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setSortBy('unionWinRate')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'unionWinRate' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            Union Win Rate
          </button>
          <button
            onClick={() => setSortBy('totalDecisions')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'totalDecisions' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            Experience
          </button>
          <button
            onClick={() => setSortBy('averageDecisionDays')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'averageDecisionDays' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            Speed
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {arbitrators.map(arbitrator => (
            <div
              key={arbitrator.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{arbitrator.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {arbitrator.jurisdiction} • {arbitrator.totalDecisions} decisions • {arbitrator.yearsActive} years
                  </p>
                </div>
                <Badge variant={arbitrator.averageDecisionDays <= 30 ? 'default' : 'secondary'}>
                  {arbitrator.averageDecisionDays} days avg
                </Badge>
              </div>

              {/* Win Rate Visualization */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className={getWinRateColor(arbitrator.unionWinRate, 'union')}>
                    Union: {arbitrator.unionWinRate.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">
                    Split: {arbitrator.splitRate.toFixed(1)}%
                  </span>
                  <span className={getWinRateColor(arbitrator.employerWinRate, 'employer')}>
                    Employer: {arbitrator.employerWinRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500"
                    style={{ width: `${arbitrator.unionWinRate}%` }}
                  />
                  <div
                    className="bg-yellow-500"
                    style={{ width: `${arbitrator.splitRate}%` }}
                  />
                  <div
                    className="bg-red-500"
                    style={{ width: `${arbitrator.employerWinRate}%` }}
                  />
                </div>
              </div>

              {/* Specializations */}
              <div className="flex flex-wrap gap-1">
                {arbitrator.specializations?.map((spec, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {spec.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          ))}

          {arbitrators.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No arbitrator data available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

