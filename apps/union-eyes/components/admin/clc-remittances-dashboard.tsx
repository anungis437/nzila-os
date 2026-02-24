/**
 * CLC Remittances Dashboard Component
 * Purpose: View, filter, and manage per-capita remittances
 * Features: Status filtering, export, bulk actions, submission workflow
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Download,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Filter,
  Upload,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// =====================================================================================
// TYPES
// =====================================================================================

interface Remittance {
  id: string;
  remittanceMonth: number;
  remittanceYear: number;
  fromOrganizationId: string;
  toOrganizationId: string;
  totalMembers: number;
  goodStandingMembers: number;
  remittableMembers: number;
  perCapitaRate: string;
  totalAmount: string;
  dueDate: Date;
  status: 'pending' | 'submitted' | 'paid' | 'overdue';
  submittedDate?: Date;
  paidDate?: Date;
  fromOrganization?: {
    id: string;
    name: string;
    slug: string;
    clcAffiliateCode?: string | null;
  };
  toOrganization?: {
    id: string;
    name: string;
    slug: string;
    clcAffiliateCode?: string | null;
  };
}

interface RemittancesResponse {
  remittances: Remittance[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

// =====================================================================================
// COMPONENT
// =====================================================================================

export function ClcRemittancesDashboard() {
  const { toast } = useToast();
  
  // State
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: '',
    month: '',
    year: new Date().getFullYear().toString(),
    dueDateFrom: '',
    dueDateTo: '',
    organizationId: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 0,
  });
  const [summary, setSummary] = useState({
    totalDue: 0,
    totalPaid: 0,
    pendingCount: 0,
    overdueCount: 0,
  });
  const [trendData, setTrendData] = useState<{ month: string; amount: number; count: number }[]>([]);

  // Calculate summary statistics
  const calculateSummary = useCallback((remittancesList: Remittance[]) => {
    const totalDue = remittancesList.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);
    const totalPaid = remittancesList
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);
    const pendingCount = remittancesList.filter(r => r.status === 'pending').length;
    const overdueCount = remittancesList.filter(r => r.status === 'overdue').length;

    setSummary({ totalDue, totalPaid, pendingCount, overdueCount });
  }, []);

  // Fetch remittances
  const fetchRemittances = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      
      // Add filters
      if (filters.status) params.append('status', filters.status);
      if (filters.month) params.append('month', filters.month);
      if (filters.year) params.append('year', filters.year);
      if (filters.dueDateFrom) params.append('dueDateFrom', filters.dueDateFrom);
      if (filters.dueDateTo) params.append('dueDateTo', filters.dueDateTo);
      if (filters.organizationId) params.append('organizationId', filters.organizationId);

      const response = await fetch(`/api/admin/clc/remittances?${params}`);
      if (!response.ok) throw new Error('Failed to fetch remittances');

      const data: RemittancesResponse = await response.json();
      setRemittances(data.remittances);
      setPagination(data.pagination);
      
      // Calculate summary
      calculateSummary(data.remittances);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to fetch remittances',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [calculateSummary, filters, pagination.page, pagination.pageSize, toast]);

  // Fetch 12-month trend data
  const fetchTrendData = async () => {
    try {
      const now = new Date();
      const trends: { month: string; amount: number; count: number }[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        const params = new URLSearchParams({
          month: month.toString(),
          year: year.toString(),
          pageSize: '1000', // Get all for trend
        });
        
        const response = await fetch(`/api/admin/clc/remittances?${params}`);
        if (response.ok) {
          const data: RemittancesResponse = await response.json();
          const total = data.remittances.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);
          
          trends.push({
            month: format(date, 'MMM yyyy'),
            amount: total,
            count: data.remittances.length,
          });
        }
      }
      
      setTrendData(trends);
    } catch (_error) {
}
  };

  // Initial load
  useEffect(() => {
    fetchRemittances();
    fetchTrendData();
  }, [fetchRemittances, pagination.page, pagination.pageSize]);

  // Handle filter changes
  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchRemittances();
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      month: '',
      year: new Date().getFullYear().toString(),
      dueDateFrom: '',
      dueDateTo: '',
      organizationId: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchRemittances();
  };

  // Export handlers
  const handleExport = async (format: 'csv' | 'xml' | 'statcan') => {
    try {
      const params = new URLSearchParams({ format });
      
      if (format === 'statcan') {
        params.append('fiscalYear', filters.year);
      } else {
        // Export selected or all on current page
        const ids = selectedIds.size > 0
          ? Array.from(selectedIds)
          : remittances.map(r => r.id);
        
        if (ids.length === 0) {
          toast({
            title: 'No remittances selected',
            description: 'Please select remittances to export',
            variant: 'destructive',
          });
          return;
        }
        
        params.append('remittanceIds', ids.join(','));
      }

      const response = await fetch(`/api/admin/clc/remittances/export?${params}`);
      if (!response.ok) throw new Error('Export failed');

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || 'export.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export successful',
        description: `Downloaded ${format.toUpperCase()} file`,
      });
    } catch (_error) {
toast({
        title: 'Export failed',
        description: 'Failed to export remittances',
        variant: 'destructive',
      });
    }
  };

  // Submit remittance
  const handleSubmit = async (remittanceId: string) => {
    try {
      const response = await fetch(`/api/admin/clc/remittances/${remittanceId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: 'Submitted via dashboard',
        }),
      });

      if (!response.ok) throw new Error('Submission failed');

      toast({
        title: 'Remittance submitted',
        description: 'Status updated to submitted',
      });

      fetchRemittances();
    } catch (_error) {
toast({
        title: 'Submission failed',
        description: 'Failed to submit remittance',
        variant: 'destructive',
      });
    }
  };

  // Status badge
  const getStatusBadge = (status: Remittance['status']) => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock },
      submitted: { variant: 'default' as const, icon: Upload },
      paid: { variant: 'default' as const, icon: CheckCircle },
      overdue: { variant: 'destructive' as const, icon: AlertCircle },
    };

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === remittances.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(remittances.map(r => r.id)));
    }
  };

  // =====================================================================================
  // RENDER
  // =====================================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Per-Capita Remittances
          </CardTitle>
          <CardDescription>
            Manage monthly per-capita tax remittances from local unions to parent organizations
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Overdue Alert */}
      {summary.overdueCount > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Overdue Remittances
            </CardTitle>
            <CardDescription>
              {summary.overdueCount} remittance{summary.overdueCount !== 1 ? 's' : ''} past due date - immediate action required
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Annual Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Due</CardDescription>
            <CardTitle className="text-2xl">${summary.totalDue.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Paid</CardDescription>
            <CardTitle className="text-2xl text-green-600">${summary.totalPaid.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{summary.pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl text-red-600">{summary.overdueCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 12-Month Trend Chart */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>12-Month Trend</CardTitle>
            <CardDescription>Per-capita remittances over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'amount') return [`$${value.toFixed(2)}`, 'Total Amount'];
                    return [value, 'Count'];
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#8884d8" name="Total Amount" />
                <Line type="monotone" dataKey="count" stroke="#82ca9d" name="Remittance Count" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Actions</CardTitle>
        </CardHeader>
        
        {/* Filters */}
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.month}
              onValueChange={(value) => setFilters(prev => ({ ...prev, month: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All months</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {format(new Date(2024, i, 1), 'MMMM')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Year"
              value={filters.year}
              onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
            />

            <Input
              placeholder="Organization ID"
              value={filters.organizationId}
              onChange={(e) => setFilters(prev => ({ ...prev, organizationId: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={applyFilters} variant="default">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            <Button onClick={clearFilters} variant="outline">
              Clear
            </Button>
            <Button onClick={fetchRemittances} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={() => handleExport('csv')} variant="outline" disabled={selectedIds.size === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV ({selectedIds.size || remittances.length})
            </Button>
            <Button onClick={() => handleExport('xml')} variant="outline" disabled={selectedIds.size === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export XML ({selectedIds.size || remittances.length})
            </Button>
            <Button onClick={() => handleExport('statcan')} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              StatCan LAB-05302
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : remittances.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No remittances found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === remittances.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remittances.map((remittance) => (
                  <TableRow key={remittance.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(remittance.id)}
                        onCheckedChange={() => toggleSelection(remittance.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(remittance.remittanceYear, remittance.remittanceMonth - 1), 'MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{remittance.fromOrganization?.name}</div>
                        {remittance.fromOrganization?.clcAffiliateCode && (
                          <div className="text-xs text-muted-foreground">
                            {remittance.fromOrganization.clcAffiliateCode}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{remittance.toOrganization?.name}</div>
                        {remittance.toOrganization?.clcAffiliateCode && (
                          <div className="text-xs text-muted-foreground">
                            {remittance.toOrganization.clcAffiliateCode}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">
                        {remittance.remittableMembers} / {remittance.totalMembers}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {remittance.goodStandingMembers} good standing
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(remittance.perCapitaRate).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${parseFloat(remittance.totalAmount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(remittance.dueDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{getStatusBadge(remittance.status)}</TableCell>
                    <TableCell>
                      {remittance.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSubmit(remittance.id)}
                        >
                          Submit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

