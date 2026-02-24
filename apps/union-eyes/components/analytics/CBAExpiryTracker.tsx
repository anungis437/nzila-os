/**
 * CBA Expiry Tracker Component
 * 
 * Monitors upcoming CBA expirations and provides timeline visualization
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Calendar, Users } from 'lucide-react';

interface ExpiringCBA {
  id: string;
  agreementName: string;
  employerName: string;
  unionName: string;
  expiryDate: string;
  totalMembers: number;
  daysUntilExpiry: number;
  status: string;
  bargainingStart: string | null;
}

interface ExpiryTrackerProps {
  organizationId?: string;
  timeframe?: '30d' | '60d' | '90d' | '180d' | '365d';
}

export function CBAExpiryTracker({
  organizationId,
  timeframe = '180d',
}: ExpiryTrackerProps) {
  const [expiringCBAs, setExpiringCBAs] = useState<ExpiringCBA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  useEffect(() => {
    fetchExpiringCBAs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, selectedTimeframe]);

  const fetchExpiringCBAs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (organizationId) params.append('organizationId', organizationId);
      params.append('expiringSoon', 'true');
      params.append('timeframe', selectedTimeframe);

      const response = await fetch(`/api/cbas?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch expiring CBAs');

      const data = await response.json();
      setExpiringCBAs(data.cbas || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getUrgencyLevel = (daysUntilExpiry: number): 'critical' | 'warning' | 'info' => {
    if (daysUntilExpiry <= 30) return 'critical';
    if (daysUntilExpiry <= 90) return 'warning';
    return 'info';
  };

  const getUrgencyColor = (urgency: 'critical' | 'warning' | 'info'): string => {
    switch (urgency) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-950';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      case 'info':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
    }
  };

  const getUrgencyBadge = (urgency: 'critical' | 'warning' | 'info') => {
    switch (urgency) {
      case 'critical':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-600 text-white">Soon</Badge>;
      case 'info':
        return <Badge variant="secondary">Upcoming</Badge>;
    }
  };

  const totalMembersAffected = expiringCBAs.reduce((sum, cba) => sum + (cba.totalMembers || 0), 0);
  const criticalCount = expiringCBAs.filter(cba => getUrgencyLevel(cba.daysUntilExpiry) === 'critical').length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CBA Expiry Tracker</CardTitle>
          <CardDescription>Loading expiry data...</CardDescription>
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
          <CardTitle>CBA Expiry Tracker</CardTitle>
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
        <CardTitle>CBA Expiry Tracker</CardTitle>
        <CardDescription>
          Monitor upcoming agreement expirations and plan for bargaining
        </CardDescription>

        {/* Timeframe Selector */}
        <div className="flex gap-2 mt-4">
          {(['30d', '60d', '90d', '180d', '365d'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm ${
                selectedTimeframe === tf ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {tf === '30d' ? '30 Days' : tf === '60d' ? '60 Days' : tf === '90d' ? '90 Days' : tf === '180d' ? '6 Months' : '1 Year'}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary Alert */}
        {criticalCount > 0 && (
          <Alert className="mb-4 border-red-500 bg-red-50 dark:bg-red-950">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              {criticalCount} agreement{criticalCount > 1 ? 's' : ''} expiring within 30 days affecting{' '}
              {totalMembersAffected.toLocaleString()} members
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Expiring</span>
            </div>
            <p className="text-2xl font-bold">{expiringCBAs.length}</p>
            <p className="text-xs text-muted-foreground">
              in next {selectedTimeframe === '30d' ? '30 days' : selectedTimeframe === '180d' ? '6 months' : '1 year'}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Members</span>
            </div>
            <p className="text-2xl font-bold">{totalMembersAffected.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">total affected</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">Critical</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">urgent actions</p>
          </div>
        </div>

        {/* Expiring CBAs List */}
        <div className="space-y-4">
          {expiringCBAs.map(cba => {
            const urgency = getUrgencyLevel(cba.daysUntilExpiry);
            return (
              <div
                key={cba.id}
                className={`border-l-4 rounded-lg p-4 ${getUrgencyColor(urgency)} hover:shadow-md transition-shadow`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold">{cba.agreementName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {cba.unionName} & {cba.employerName}
                    </p>
                  </div>
                  {getUrgencyBadge(urgency)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Expiry Date</p>
                    <p className="text-sm font-medium">{formatDate(cba.expiryDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Days Until Expiry</p>
                    <p className={`text-sm font-medium ${urgency === 'critical' ? 'text-red-600' : ''}`}>
                      {cba.daysUntilExpiry} days
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Members</p>
                    <p className="text-sm font-medium">{cba.totalMembers?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant={cba.status === 'negotiating' ? 'default' : 'secondary'}>
                      {cba.status}
                    </Badge>
                  </div>
                </div>

                {cba.bargainingStart && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Bargaining started: {formatDate(cba.bargainingStart)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {expiringCBAs.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                No CBAs expiring in the selected timeframe
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

