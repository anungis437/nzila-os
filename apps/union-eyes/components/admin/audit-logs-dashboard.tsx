'use client';

/**
 * Audit Logs Dashboard
 * 
 * Comprehensive audit log viewer with filters, timeline visualization,
 * charts, anomaly alerts, and export functionality for SOC-2 compliance.
 * 
 * @module components/admin/audit-logs-dashboard
 * @author CourtLens Platform Team
 * @date December 3, 2025
 * @phase Phase 3 Week 1 Task 5
 */

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Search,
  Filter,
  AlertTriangle,
  Activity,
  Shield,
  Users,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  AuditQueryParams,
  AuditStatistics,
  AnomalyDetection,
} from '@/services/compliance/audit-analysis';

// ============================================================================
// TYPES
// ============================================================================

interface AuditLog {
  id: string;
  firm_id: string | null;
  user_id: string | null;
  action_type: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  risk_level: 'info' | 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
  failure_reason: string | null;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

interface FilterState {
  search: string;
  actionType: string;
  resourceType: string;
  riskLevel: string;
  onlyFailures: boolean;
  dateRange: 'today' | '7days' | '30days' | '90days' | 'custom';
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RISK_COLORS = {
  info: 'bg-gray-100 text-gray-800',
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ============================================================================
// COMPONENT
// ============================================================================

export function AuditLogsDashboard() {
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    actionType: 'all',
    resourceType: 'all',
    riskLevel: 'all',
    onlyFailures: false,
    dateRange: '7days',
  });

  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);

  // Build query params
  const queryParams = useMemo<AuditQueryParams>(() => {
    const params: AuditQueryParams = {
      limit: pageSize,
      offset: page * pageSize,
      search: filters.search || undefined,
      onlyFailures: filters.onlyFailures,
    };

    if (filters.actionType !== 'all') {
      params.actionTypes = [filters.actionType];
    }

    if (filters.resourceType !== 'all') {
      params.resourceTypes = [filters.resourceType];
    }

    if (filters.riskLevel !== 'all') {
      params.riskLevels = [filters.riskLevel];
    }

    // Date range
    const now = new Date();
    if (filters.dateRange === 'today') {
      params.startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    } else if (filters.dateRange === '7days') {
      params.startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
    } else if (filters.dateRange === '30days') {
      params.startDate = new Date(now.setDate(now.getDate() - 30)).toISOString();
    } else if (filters.dateRange === '90days') {
      params.startDate = new Date(now.setDate(now.getDate() - 90)).toISOString();
    } else if (filters.dateRange === 'custom' && filters.startDate) {
      params.startDate = new Date(filters.startDate).toISOString();
      if (filters.endDate) {
        params.endDate = new Date(filters.endDate).toISOString();
      }
    }

    return params;
  }, [filters, page, pageSize]);

  // Fetch audit logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: async () => {
      const response = await fetch('/api/admin/compliance/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryParams),
      });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json() as Promise<{ logs: AuditLog[]; total: number }>;
    },
  });

  // Fetch statistics
  const { data: statistics, isLoading: _statsLoading } = useQuery({
    queryKey: ['audit-statistics', filters.dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryParams.startDate) {
        params.set('startDate', queryParams.startDate);
      }
      if (queryParams.endDate) {
        params.set('endDate', queryParams.endDate);
      }
      const response = await fetch(`/api/admin/compliance/statistics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json() as Promise<AuditStatistics>;
    },
  });

  // Fetch anomalies
  const { data: anomalies, isLoading: anomaliesLoading } = useQuery({
    queryKey: ['anomalies'],
    queryFn: async () => {
      const response = await fetch('/api/admin/compliance/anomalies');
      if (!response.ok) throw new Error('Failed to fetch anomalies');
      const data = await response.json() as AnomalyDetection;
      return data.anomalies; // Return just the anomalies array
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Export to CSV
  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/compliance/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'audit_log',
          format: 'csv',
          filters: queryParams,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const { reportId } = await response.json();

      // Download the report
      window.location.href = `/api/admin/compliance/reports/${reportId}/download`;
    } catch (_error) {
alert('Failed to export audit logs');
    }
  };

  // Prepare chart data
  const eventsByAction = useMemo(() => {
    if (!statistics?.eventsByAction) return [];
    return Object.entries(statistics.eventsByAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({
        action: action.split('.').pop() || action,
        count,
      }));
  }, [statistics]);

  const eventsByRiskLevel = useMemo(() => {
    if (!statistics?.eventsByRiskLevel) return [];
    return Object.entries(statistics.eventsByRiskLevel).map(([level, count]) => ({
      level,
      count,
    }));
  }, [statistics]);

  const _eventsByResource = useMemo(() => {
    if (!statistics?.eventsByResource) return [];
    return Object.entries(statistics.eventsByResource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([resource, count]) => ({
        resource,
        count,
      }));
  }, [statistics]);

  // Timeline data (events per hour for last 24h)
  const timelineData = useMemo(() => {
    if (!logsData?.logs) return [];
    const hourCounts: Record<number, number> = {};
    
    logsData.logs.forEach(log => {
      const hour = new Date(log.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      events: hourCounts[i] || 0,
    }));
  }, [logsData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">
            Comprehensive security and compliance audit trail
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`${localePrefix}/admin/runbooks/RUNBOOK_INCIDENT_RESPONSE`}>
            <Button variant="outline" size="sm">
              Runbook: Incident Response
            </Button>
          </Link>
          <Link href={`${localePrefix}/admin/runbooks`}>
            <Button variant="outline" size="sm">
              Runbook Library
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {anomalies && anomalies.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Security Anomalies Detected</AlertTitle>
          <AlertDescription>
            {anomalies.length} security anomalies detected. Review immediately.
            <Button
              variant="link"
              className="ml-2"
              onClick={() => {
                // Scroll to anomalies section
                document.getElementById('anomalies-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              View Details
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalEvents.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failure Rate</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.failureRate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.uniqueUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.peakActivityHour}:00</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="charts">Analytics</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
        </TabsList>

        {/* Audit Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Action Type</label>
                  <Select
                    value={filters.actionType}
                    onValueChange={(value) => setFilters({ ...filters, actionType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="auth.login.success">Login Success</SelectItem>
                      <SelectItem value="auth.login.failed">Login Failed</SelectItem>
                      <SelectItem value="data.created">Data Created</SelectItem>
                      <SelectItem value="data.modified">Data Modified</SelectItem>
                      <SelectItem value="data.deleted">Data Deleted</SelectItem>
                      <SelectItem value="rbac.role_assigned">Role Assigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Resource Type</label>
                  <Select
                    value={filters.resourceType}
                    onValueChange={(value) => setFilters({ ...filters, resourceType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Resources</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="matter">Matter</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Risk Level</label>
                  <Select
                    value={filters.riskLevel}
                    onValueChange={(value) => setFilters({ ...filters, riskLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <Select
                    value={filters.dateRange}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onValueChange={(value: any) => setFilters({ ...filters, dateRange: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.onlyFailures}
                    onChange={(e) => setFilters({ ...filters, onlyFailures: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Show only failures</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Events</CardTitle>
              <CardDescription>
                {logsData?.total || 0} total events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Risk</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logsData?.logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs">
                              {new Date(log.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {log.action_type}
                            </TableCell>
                            <TableCell>
                              {log.resource_type && (
                                <span className="text-sm text-muted-foreground">
                                  {log.resource_type}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.user_id?.slice(0, 8)}...
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.ip_address}
                            </TableCell>
                            <TableCell>
                              <Badge className={RISK_COLORS[log.risk_level]}>
                                {log.risk_level}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.success ? 'default' : 'destructive'}>
                                {log.success ? 'Success' : 'Failed'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, logsData?.total || 0)} of {logsData?.total || 0}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={!logsData || (page + 1) * pageSize >= logsData.total}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="charts" className="space-y-4">
          {/* Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="events" stroke={CHART_COLORS[0]} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Events by Action */}
            <Card>
              <CardHeader>
                <CardTitle>Top Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={eventsByAction}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="action" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={CHART_COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Events by Risk Level */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={eventsByRiskLevel}
                      dataKey="count"
                      nameKey="level"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {eventsByRiskLevel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" id="anomalies-section" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Anomalies</CardTitle>
              <CardDescription>
                Automatically detected unusual activity patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anomaliesLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : anomalies && anomalies.length > 0 ? (
                <div className="space-y-4">
                  {anomalies.map((anomaly, index) => (
                    <Alert
                      key={index}
                      variant={anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'destructive' : 'default'}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="flex items-center gap-2">
                        <span className="capitalize">{anomaly.type.replace('_', ' ')}</span>
                        <Badge variant={anomaly.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {anomaly.severity}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription>
                        <p>{anomaly.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(anomaly.timestamp).toLocaleString()}
                        </p>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No anomalies detected
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

