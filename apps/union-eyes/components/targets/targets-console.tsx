'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Gauge,
  LineChart,
  PieChart,
  Hash,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

import { DataTableAdvanced } from '@/components/ui/data-table-advanced';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/lib/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface KPITarget {
  id: string;
  name: string;
  description: string | null;
  metricType: string;
  dataSource: string;
  calculation: Record<string, unknown>;
  visualizationType: string;
  targetValue: string | null;
  warningThreshold: string | null;
  criticalThreshold: string | null;
  alertEnabled: boolean | null;
  alertRecipients: string[] | null;
  refreshInterval: number | null;
  isActive: boolean | null;
  displayOrder: number | null;
  createdAt: string;
  updatedAt: string;
  // enriched by summary endpoint
  health?: 'on_track' | 'at_risk' | 'critical' | 'no_data';
  currentValue?: number | null;
  progress?: number | null;
  trend?: string | null;
}

interface TargetSummary {
  total: number;
  onTrack: number;
  atRisk: number;
  critical: number;
  noData: number;
  bySource: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const HEALTH_CONFIG = {
  on_track: { label: 'On Track', variant: 'default' as const, icon: CheckCircle2, color: 'text-green-600' },
  at_risk: { label: 'At Risk', variant: 'secondary' as const, icon: AlertTriangle, color: 'text-yellow-600' },
  critical: { label: 'Critical', variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
  no_data: { label: 'No Data', variant: 'outline' as const, icon: Minus, color: 'text-muted-foreground' },
};

const VIZ_ICONS: Record<string, typeof BarChart3> = {
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  gauge: Gauge,
  number: Hash,
};

const SOURCE_LABELS: Record<string, string> = {
  claims: 'Claims',
  members: 'Members',
  financial: 'Financial',
  custom_query: 'Custom',
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function TrendIcon({ trend }: { trend: string | null | undefined }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// Create Target Form
// ---------------------------------------------------------------------------
function CreateTargetDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    description: '',
    metricType: '',
    dataSource: 'claims' as const,
    visualizationType: 'gauge' as const,
    targetValue: '',
    warningThreshold: '',
    criticalThreshold: '',
    alertEnabled: false,
  });

  const handleSubmit = async () => {
    if (!form.name || !form.metricType) {
      toast({ title: 'Validation', description: 'Name and metric type are required.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          metricType: form.metricType,
          dataSource: form.dataSource,
          calculation: { aggregation: 'sum' },
          visualizationType: form.visualizationType,
          targetValue: form.targetValue ? parseFloat(form.targetValue) : undefined,
          warningThreshold: form.warningThreshold ? parseFloat(form.warningThreshold) : undefined,
          criticalThreshold: form.criticalThreshold ? parseFloat(form.criticalThreshold) : undefined,
          alertEnabled: form.alertEnabled,
        }),
      });
      if (!res.ok) throw new Error('Failed to create target');
      toast({ title: 'Target Created', description: `"${form.name}" has been created.` });
      setOpen(false);
      setForm({ name: '', description: '', metricType: '', dataSource: 'claims', visualizationType: 'gauge', targetValue: '', warningThreshold: '', criticalThreshold: '', alertEnabled: false });
      onCreated();
    } catch {
      toast({ title: 'Error', description: 'Failed to create target.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Target
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle>Create Performance Target</DialogTitle>
          <DialogDescription>Define a measurable KPI with thresholds and alerts.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Target Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grievance Resolution Rate" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metricType">Metric Type *</Label>
              <Input id="metricType" value={form.metricType} onChange={(e) => setForm({ ...form, metricType: e.target.value })} placeholder="e.g. resolution_rate" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this target measure?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Source</Label>
              <Select value={form.dataSource} onValueChange={(v) => setForm({ ...form, dataSource: v as typeof form.dataSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claims">Claims</SelectItem>
                  <SelectItem value="members">Members</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="custom_query">Custom Query</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visualization</Label>
              <Select value={form.visualizationType} onValueChange={(v) => setForm({ ...form, visualizationType: v as typeof form.visualizationType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gauge">Gauge</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target">Target Value</Label>
              <Input id="target" type="number" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} placeholder="100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warning">Warning Threshold</Label>
              <Input id="warning" type="number" value={form.warningThreshold} onChange={(e) => setForm({ ...form, warningThreshold: e.target.value })} placeholder="70" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="critical">Critical Threshold</Label>
              <Input id="critical" type="number" value={form.criticalThreshold} onChange={(e) => setForm({ ...form, criticalThreshold: e.target.value })} placeholder="50" />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="alerts" checked={form.alertEnabled} onCheckedChange={(v) => setForm({ ...form, alertEnabled: v })} />
            <Label htmlFor="alerts">Enable threshold alerts</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Creating...' : 'Create Target'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
function buildColumns(onToggle: (id: string, active: boolean) => void): ColumnDef<KPITarget, unknown>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Target',
      cell: ({ row }) => {
        const VizIcon = VIZ_ICONS[row.original.visualizationType] || Target;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <VizIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-medium">{row.original.name}</div>
              {row.original.description && (
                <div className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'dataSource',
      header: 'Source',
      cell: ({ getValue }) => (
        <Badge variant="outline">{SOURCE_LABELS[getValue() as string] ?? getValue()}</Badge>
      ),
    },
    {
      accessorKey: 'progress',
      header: 'Progress',
      cell: ({ row }) => {
        const p = row.original.progress;
        if (p === null || p === undefined) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <div className="flex items-center gap-2 min-w-30">
            <Progress value={Math.min(p, 100)} className="h-2 flex-1" />
            <span className="text-sm font-medium w-10 text-right">{p}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'currentValue',
      header: 'Current',
      cell: ({ row }) => {
        const val = row.original.currentValue;
        const tv = row.original.targetValue ? parseFloat(row.original.targetValue) : null;
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{val !== null && val !== undefined ? val.toLocaleString() : '—'}</span>
            {tv !== null && <span className="text-xs text-muted-foreground">/ {tv.toLocaleString()}</span>}
            <TrendIcon trend={row.original.trend} />
          </div>
        );
      },
    },
    {
      accessorKey: 'health',
      header: 'Health',
      cell: ({ getValue }) => {
        const h = (getValue() as string) || 'no_data';
        const cfg = HEALTH_CONFIG[h as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.no_data;
        const Icon = cfg.icon;
        return (
          <Badge variant={cfg.variant} className="gap-1">
            <Icon className="h-3 w-3" /> {cfg.label}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle(row.original.id, !(row.original.isActive ?? true))}
        >
          {row.original.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Main console
// ---------------------------------------------------------------------------
export function TargetsConsole() {
  const [summary, setSummary] = useState<TargetSummary | null>(null);
  const [targets, setTargets] = useState<KPITarget[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/targets/summary');
      if (!res.ok) throw new Error('Failed to load targets');
      const json = await res.json();
      setSummary(json.data?.summary ?? null);
      setTargets(json.data?.targets ?? []);
    } catch {
      toastRef.current({ title: 'Error', description: 'Failed to load targets.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/targets/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: isActive ? 'Activated' : 'Deactivated' });
      loadData();
    } catch {
      toast({ title: 'Error', description: 'Failed to update target.', variant: 'destructive' });
    }
  };

  const columns = buildColumns(handleToggle);

  // Radial gauge data for summary
  const gaugeData = summary
    ? [
        { name: 'On Track', value: summary.onTrack, fill: '#10b981' },
        { name: 'At Risk', value: summary.atRisk, fill: '#f59e0b' },
        { name: 'Critical', value: summary.critical, fill: '#ef4444' },
      ].filter((d) => d.value > 0)
    : [];

  // Source distribution data
  const sourceData = summary
    ? Object.entries(summary.bySource).map(([key, val], i) => ({
        name: SOURCE_LABELS[key] ?? key,
        count: val,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Targets</h1>
          <p className="text-muted-foreground">Define, track, and manage organizational KPIs and targets.</p>
        </div>
        <CreateTargetDialog onCreated={loadData} />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Targets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">Active KPI configurations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Track</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.onTrack ?? 0}</div>
            <p className="text-xs text-muted-foreground">Meeting or exceeding targets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary?.atRisk ?? 0}</div>
            <p className="text-xs text-muted-foreground">Below warning threshold</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.critical ?? 0}</div>
            <p className="text-xs text-muted-foreground">Below critical threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs — Overview / All Targets */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="all">All Targets</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Health distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Health Distribution</CardTitle>
                <CardDescription>Target health across all active KPIs</CardDescription>
              </CardHeader>
              <CardContent>
                {gaugeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <RadialBarChart
                      innerRadius="30%"
                      outerRadius="90%"
                      data={gaugeData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar dataKey="value" cornerRadius={6} />
                      <Tooltip />
                    </RadialBarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-60 text-muted-foreground">
                    No target data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Source distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Targets by Source</CardTitle>
                <CardDescription>Distribution across data domains</CardDescription>
              </CardHeader>
              <CardContent>
                {sourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={sourceData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {sourceData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-60 text-muted-foreground">
                    No targets configured yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top targets needing attention */}
          {targets.filter((t) => t.health === 'critical' || t.health === 'at_risk').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Needs Attention</CardTitle>
                <CardDescription>Targets below their warning or critical thresholds</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {targets
                    .filter((t) => t.health === 'critical' || t.health === 'at_risk')
                    .slice(0, 5)
                    .map((t) => {
                      const cfg = HEALTH_CONFIG[t.health!];
                      const Icon = cfg.icon;
                      return (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Icon className={`h-5 w-5 ${cfg.color}`} />
                            <div>
                              <div className="font-medium">{t.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {SOURCE_LABELS[t.dataSource] ?? t.dataSource} · {t.metricType}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-mono text-sm">
                                {t.currentValue?.toLocaleString() ?? '—'}
                                <span className="text-muted-foreground"> / {t.targetValue ? parseFloat(t.targetValue).toLocaleString() : '—'}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">{t.progress ?? 0}% complete</div>
                            </div>
                            <TrendIcon trend={t.trend} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All targets table */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Targets</CardTitle>
              <CardDescription>{targets.length} target{targets.length !== 1 ? 's' : ''} configured</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTableAdvanced
                columns={columns}
                data={targets}
                searchKey="name"
                searchPlaceholder="Search targets..."
                pageSize={20}
                enableRowSelection={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
