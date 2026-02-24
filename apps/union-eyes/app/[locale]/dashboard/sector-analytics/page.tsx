export const dynamic = 'force-dynamic';

import { BarChart3, TrendingUp, Users, DollarSign, AlertTriangle } from "lucide-react";

export default function SectorAnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-8 h-8" />
            Sector Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Industry-wide trends, wage data, and strategic intelligence across all sectors
          </p>
        </div>
      </div>

      {/* Sector Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Sectors</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg. Wage Increase</p>
              <p className="text-2xl font-bold text-green-600">--%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Campaigns</p>
              <p className="text-2xl font-bold text-orange-600">--</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Key Sectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">Public Sector</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Members</span>
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Avg. Wage</span>
              <span className="font-semibold">$--/hr</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Active CBAs</span>
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Trend</span>
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">Healthcare</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Members</span>
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Avg. Wage</span>
              <span className="font-semibold">$--/hr</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Active CBAs</span>
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Trend</span>
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">Manufacturing</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Members</span>
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Avg. Wage</span>
              <span className="font-semibold">$--/hr</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Active CBAs</span>
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Trend</span>
              <TrendingUp className="w-4 h-4 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Wage Trends */}
      <div className="border rounded-lg p-6 bg-card">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          National Wage Trends
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Settlements</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Public Sector (Q4 2024)</span>
                <span className="font-semibold text-green-600">+3.2%</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Healthcare (Q4 2024)</span>
                <span className="font-semibold text-green-600">+4.1%</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Manufacturing (Q3 2024)</span>
                <span className="font-semibold text-green-600">+2.8%</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Industry Benchmarks</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Inflation Rate</span>
                <span className="font-semibold">--%</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Union Premium</span>
                <span className="font-semibold text-blue-600">--%</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Sector Average</span>
                <span className="font-semibold">$--/hr</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/50">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">Advanced Sector Analytics</h3>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Comprehensive sector intelligence coming soon. This will include interactive wage
          comparisons, bargaining trend analysis, sector-specific organizing metrics, and
          strategic intelligence reports for national campaigns.
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          <strong>Note:</strong> This feature is restricted to Congress staff and system administrators
          to support national-level strategic planning and coordination.
        </p>
      </div>
    </div>
  );
}
