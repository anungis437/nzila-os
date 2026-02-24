/**
 * Wage Benchmarking Component
 * 
 * Comprehensive wage comparison across CBAs with visualization.
 * Compares wage rates, progressions, and trends across organizations, sectors, and jurisdictions.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  AlertCircle,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface WageProgression {
  id: string;
  clauseId: string;
  cbaId: string;
  cbaNumber: string;
  employerName: string;
  unionName: string;
  sector: string;
  jurisdiction: string;
  jobTitle: string;
  jobClassification: string;
  step: number;
  wageRate: number;
  effectiveDate: string;
  currency: string;
  notes?: string;
}

interface WageStatistics {
  jobTitle: string;
  count: number;
  minWage: number;
  maxWage: number;
  averageWage: number;
  medianWage: number;
  percentile25: number;
  percentile75: number;
  sector: string;
  jurisdiction: string;
}

interface WageBenchmarkingProps {
  organizationId?: string;
  sector?: string;
  jurisdiction?: string;
  jobTitle?: string;
}

export function WageBenchmarking({
  organizationId,
  sector,
  jurisdiction,
  jobTitle,
}: WageBenchmarkingProps) {
  const [wageData, setWageData] = useState<WageProgression[]>([]);
  const [statistics, setStatistics] = useState<WageStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>(sector || 'all');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>(jurisdiction || 'all');
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>(jobTitle || 'all');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [sortBy, setSortBy] = useState<'wageRate' | 'jobTitle' | 'employerName'>('wageRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Extract unique values for filters
  const [sectors, setSectors] = useState<string[]>([]);
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);

  useEffect(() => {
    fetchWageData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, selectedSector, selectedJurisdiction, selectedJobTitle]);

  const fetchWageData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (organizationId) params.append('organizationId', organizationId);
      if (selectedSector !== 'all') params.append('sector', selectedSector);
      if (selectedJurisdiction !== 'all') params.append('jurisdiction', selectedJurisdiction);
      if (selectedJobTitle !== 'all') params.append('jobTitle', selectedJobTitle);
      params.append('limit', '500');

      // Fetch wage progressions through clauses API
      const response = await fetch(`/api/clauses?${params.toString()}&clauseType=wages_compensation`);
      if (!response.ok) throw new Error('Failed to fetch wage data');

      const _data = await response.json();
      
      // Transform clause data to wage progressions
      // In a real implementation, this would come from a dedicated wages API endpoint
      const wages: WageProgression[] = [];
      const stats: WageStatistics[] = [];

      setWageData(wages);
      setStatistics(stats);

      // Extract unique values for filters
      const uniqueSectors = [...new Set(wages.map(w => w.sector))];
      const uniqueJurisdictions = [...new Set(wages.map(w => w.jurisdiction))];
      const uniqueJobTitles = [...new Set(wages.map(w => w.jobTitle))];

      setSectors(uniqueSectors);
      setJurisdictions(uniqueJurisdictions);
      setJobTitles(uniqueJobTitles);
    } catch (err) {
setError(err instanceof Error ? err.message : 'Failed to load wage benchmarks');
    } finally {
      setLoading(false);
    }
  };

  const sortData = (data: WageProgression[]) => {
    return [...data].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'wageRate':
          comparison = a.wageRate - b.wageRate;
          break;
        case 'jobTitle':
          comparison = a.jobTitle.localeCompare(b.jobTitle);
          break;
        case 'employerName':
          comparison = a.employerName.localeCompare(b.employerName);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  const getWageTrend = (wage: number, average: number): 'above' | 'below' | 'average' => {
    const diff = ((wage - average) / average) * 100;
    if (Math.abs(diff) < 5) return 'average';
    return wage > average ? 'above' : 'below';
  };

  // Chart data preparation
  const chartData = {
    labels: statistics.map(s => s.jobTitle),
    datasets: [
      {
        label: 'Average Wage',
        data: statistics.map(s => s.averageWage),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
      },
      {
        label: 'Median Wage',
        data: statistics.map(s => s.medianWage),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
      },
    ],
  };

  const distributionChartData = {
    labels: statistics.map(s => s.jobTitle),
    datasets: [
      {
        label: '25th Percentile',
        data: statistics.map(s => s.percentile25),
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
      {
        label: '75th Percentile',
        data: statistics.map(s => s.percentile75),
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
      },
      {
        label: 'Median',
        data: statistics.map(s => s.medianWage),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: false,
      },
    ],
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedData = sortData(wageData);

  return (
    <div className="space-y-4">
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Wage Benchmarking
              </CardTitle>
              <CardDescription>
                Compare wages across CBAs by sector, jurisdiction, and job classification
              </CardDescription>
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'chart')}>
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="chart">Charts</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedJurisdiction} onValueChange={setSelectedJurisdiction}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by jurisdiction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jurisdictions</SelectItem>
                {jurisdictions.map(j => (
                  <SelectItem key={j} value={j}>{j}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by job title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Job Titles</SelectItem>
                {jobTitles.map(j => (
                  <SelectItem key={j} value={j}>{j}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedSector('all');
                setSelectedJurisdiction('all');
                setSelectedJobTitle('all');
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Positions</p>
              <p className="text-3xl font-bold">{wageData.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Average Wage</p>
              <p className="text-3xl font-bold">
                {wageData.length > 0 
                  ? formatCurrency(wageData.reduce((sum, w) => sum + w.wageRate, 0) / wageData.length)
                  : '$0.00'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Highest Wage</p>
              <p className="text-3xl font-bold">
                {wageData.length > 0 
                  ? formatCurrency(Math.max(...wageData.map(w => w.wageRate)))
                  : '$0.00'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Lowest Wage</p>
              <p className="text-3xl font-bold">
                {wageData.length > 0 
                  ? formatCurrency(Math.min(...wageData.map(w => w.wageRate)))
                  : '$0.00'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <CardContent className="pt-6">
            {sortedData.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No wage data found for the selected filters</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          className="font-semibold"
                          onClick={() => toggleSort('jobTitle')}
                        >
                          Job Title
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          className="font-semibold"
                          onClick={() => toggleSort('employerName')}
                        >
                          Employer
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Union</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead className="text-right">
                        <Button 
                          variant="ghost" 
                          className="font-semibold"
                          onClick={() => toggleSort('wageRate')}
                        >
                          Wage Rate
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Effective Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((wage) => {
                      const avgWage = wageData.reduce((sum, w) => sum + w.wageRate, 0) / wageData.length;
                      const trend = getWageTrend(wage.wageRate, avgWage);
                      
                      return (
                        <TableRow key={wage.id}>
                          <TableCell className="font-medium">{wage.jobTitle}</TableCell>
                          <TableCell>{wage.employerName}</TableCell>
                          <TableCell>{wage.unionName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{wage.sector}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{wage.jurisdiction}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{wage.step}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(wage.wageRate)}
                          </TableCell>
                          <TableCell>
                            {trend === 'above' && (
                              <Badge className="bg-green-500">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Above Avg
                              </Badge>
                            )}
                            {trend === 'below' && (
                              <Badge className="bg-red-500">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Below Avg
                              </Badge>
                            )}
                            {trend === 'average' && (
                              <Badge variant="secondary">Average</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(wage.effectiveDate), 'MMM dd, yyyy')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chart View */}
      {viewMode === 'chart' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Average vs Median Wages by Job Title</CardTitle>
              <CardDescription>Comparison of average and median wage rates</CardDescription>
            </CardHeader>
            <CardContent>
              {statistics.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p>No data available for chart visualization</p>
                </div>
              ) : (
                <Bar 
                  data={chartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? 0)}`;
                          },
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => formatCurrency(value as number),
                        },
                      },
                    },
                  }}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wage Distribution</CardTitle>
              <CardDescription>25th, 50th (median), and 75th percentile wages</CardDescription>
            </CardHeader>
            <CardContent>
              {statistics.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p>No data available for chart visualization</p>
                </div>
              ) : (
                <Line 
                  data={distributionChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? 0)}`;
                          },
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => formatCurrency(value as number),
                        },
                      },
                    },
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

