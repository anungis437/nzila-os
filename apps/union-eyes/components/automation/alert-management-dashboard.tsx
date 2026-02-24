"use client";

/**
 * Alert Management Dashboard Component
 * 
 * Centralized dashboard to view, edit, enable/disable, and monitor all alert rules
 * with execution history and performance metrics.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Plus, 
  Search, 
  Play,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bell,
  Activity,
  BarChart3,
  Eye
} from 'lucide-react';

type AlertRuleSummary = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  severity: string;
  triggerType: string;
  frequency: string;
  isEnabled: boolean;
  lastExecutedAt: string | null;
  lastExecutionStatus: string | null;
  executionCount: number;
  successCount: number;
  failureCount: number;
  conditionsCount: number;
  actionsCount: number;
  createdAt: string;
};

type AlertExecutionSummary = {
  id: string;
  alertRuleId: string;
  alertRuleName: string | null;
  triggeredBy: string;
  status: string;
  conditionsMet: boolean | null;
  startedAt: string;
  completedAt: string | null;
  executionTimeMs: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actionsExecuted: any;
  errorMessage?: string | null;
};

type AlertEscalationSummary = {
  id: string;
  alertRuleId: string;
  alertRuleName: string | null;
  name: string;
  description: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  escalationLevels: any;
  status: string;
  currentLevel: number;
  startedAt: string;
  nextEscalationAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
};

const SEVERITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-500',
};

const STATUS_ICONS = {
  success: { icon: CheckCircle2, color: 'text-green-600' },
  failed: { icon: XCircle, color: 'text-red-600' },
  pending: { icon: Clock, color: 'text-gray-600' },
  running: { icon: Activity, color: 'text-blue-600' },
};

const RUNBOOK_LINKS = [
  { slug: 'RUNBOOK_INCIDENT_RESPONSE', label: 'Incident Response' },
  { slug: 'RUNBOOK_DATA_BREACH', label: 'Data Breach' },
  { slug: 'RUNBOOK_UNAUTHORIZED_ACCESS', label: 'Unauthorized Access' },
  { slug: 'RUNBOOK_DOS_ATTACK', label: 'Service Disruption' },
  { slug: 'RUNBOOK_ROLLBACK', label: 'Rollback' },
  { slug: 'RUNBOOK_CONNECTION_POOL', label: 'Connection Pool' },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
};

export default function AlertManagementDashboard() {
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [rules, setRules] = useState<AlertRuleSummary[]>([]);
  const [executions, setExecutions] = useState<AlertExecutionSummary[]>([]);
  const [escalations, setEscalations] = useState<AlertEscalationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAlertData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [rulesRes, executionsRes, escalationsRes] = await Promise.all([
        fetch('/api/admin/alerts/rules'),
        fetch('/api/admin/alerts/executions?limit=50'),
        fetch('/api/admin/alerts/escalations?limit=50'),
      ]);

      if (!rulesRes.ok) throw new Error('Failed to load alert rules');
      if (!executionsRes.ok) throw new Error('Failed to load execution history');
      if (!escalationsRes.ok) throw new Error('Failed to load escalations');

      const rulesJson = await rulesRes.json();
      const executionsJson = await executionsRes.json();
      const escalationsJson = await escalationsRes.json();

      setRules(rulesJson.data?.rules ?? []);
      setExecutions(executionsJson.data?.executions ?? []);
      setEscalations(escalationsJson.data?.escalations ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load alert data';
      setErrorMessage(message);
      toast({
        title: 'Alert data load failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter alert rules
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const categoryValue = rule.category ?? '';
      if (searchQuery && !rule.name.toLowerCase().includes(searchQuery.toLowerCase()) && !categoryValue.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedCategory !== 'all' && rule.category !== selectedCategory) {
        return false;
      }
      if (selectedSeverity !== 'all' && rule.severity !== selectedSeverity) {
        return false;
      }
      if (selectedStatus === 'enabled' && !rule.isEnabled) {
        return false;
      }
      if (selectedStatus === 'disabled' && rule.isEnabled) {
        return false;
      }
      return true;
    });
  }, [rules, searchQuery, selectedCategory, selectedSeverity, selectedStatus]);

  const totalRules = rules.length;
  const enabledRules = rules.filter(r => r.isEnabled).length;
  const totalExecutions = rules.reduce((sum, r) => sum + (r.executionCount || 0), 0);
  const totalSuccesses = rules.reduce((sum, r) => sum + (r.successCount || 0), 0);
  const totalFailures = rules.reduce((sum, r) => sum + (r.failureCount || 0), 0);
  const successRate = totalExecutions > 0 ? ((totalSuccesses / totalExecutions) * 100).toFixed(1) : '0';

  const toggleAlertRule = async (id: string, isEnabled: boolean) => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/admin/alerts/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled }),
      });

      if (!response.ok) throw new Error('Failed to update alert rule');
      await fetchAlertData();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update rule',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const deleteAlertRule = async (id: string) => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/admin/alerts/rules/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete alert rule');
      await fetchAlertData();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete rule',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const testAlertRule = async (id: string) => {
    setIsMutating(true);
    try {
      const response = await fetch('/api/admin/alerts/executions/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: id }),
      });

      if (!response.ok) throw new Error('Failed to execute test');
      await fetchAlertData();
    } catch (error) {
      toast({
        title: 'Test failed',
        description: error instanceof Error ? error.message : 'Failed to run test',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const createEscalation = async (ruleId: string, ruleName: string | null) => {
    setIsMutating(true);
    try {
      const response = await fetch('/api/admin/alerts/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertRuleId: ruleId,
          name: `${ruleName ?? 'Alert'} Escalation`,
          description: 'Created from execution history',
        }),
      });

      if (!response.ok) throw new Error('Failed to create escalation');
      await fetchAlertData();
    } catch (error) {
      toast({
        title: 'Escalation failed',
        description: error instanceof Error ? error.message : 'Failed to create escalation',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const updateEscalationStatus = async (id: string, status: string) => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/admin/alerts/escalations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('Failed to update escalation');
      await fetchAlertData();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update escalation',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Alert Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage all alert rules and execution history
          </p>
        </div>
        <Link href={`${localePrefix}/admin/alerts/rules/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Alert Rule
          </Button>
        </Link>
      </div>

      {errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-700">
            {errorMessage}
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{totalRules}</p>
              </div>
              <Bell className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{enabledRules}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Executions</p>
                <p className="text-2xl font-bold">{totalExecutions}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failures</p>
                <p className="text-2xl font-bold">{totalFailures}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
          <TabsTrigger value="escalations">Escalations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Alert Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search alert rules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="border rounded-md px-3 py-2"
                >
                  <option value="all">All Categories</option>
                  {Array.from(new Set(rules.map((rule) => rule.category).filter(Boolean))).map((category) => (
                    <option key={category} value={category as string}>
                      {String(category).replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="border rounded-md px-3 py-2"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
                <select
                  value={selectedStatus}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="border rounded-md px-3 py-2"
                >
                  <option value="all">All Status</option>
                  <option value="enabled">Enabled Only</option>
                  <option value="disabled">Disabled Only</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Alert Rules List */}
          <div className="space-y-3">
            {filteredRules.map((rule) => {
              const statusKey = rule.lastExecutionStatus ?? 'pending';
              const StatusIcon = STATUS_ICONS[statusKey as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending;
              
              return (
                <Card key={rule.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{rule.name}</h3>
                          <Badge className={SEVERITY_COLORS[rule.severity as keyof typeof SEVERITY_COLORS] ?? 'bg-gray-500'}>
                            {rule.severity}
                          </Badge>
                          <Badge variant="outline">{rule.triggerType}</Badge>
                          <Badge variant="outline">{rule.category ?? 'uncategorized'}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {rule.description ?? 'No description provided'}
                        </p>
                        
                        <div className="grid md:grid-cols-6 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Frequency</p>
                            <p className="font-medium">
                              {rule.frequency ? rule.frequency.replace('_', ' ') : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Conditions</p>
                            <p className="font-medium">{rule.conditionsCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Actions</p>
                            <p className="font-medium">{rule.actionsCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Executions</p>
                            <p className="font-medium">{rule.executionCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Success Rate</p>
                            <p className="font-medium">
                              {rule.executionCount > 0 
                                ? ((rule.successCount / rule.executionCount) * 100).toFixed(0)
                                : 0}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Run</p>
                            <div className="flex items-center gap-1">
                              <StatusIcon.icon className={`h-4 w-4 ${StatusIcon.color}`} />
                              <p className="font-medium">{rule.lastExecutedAt ? formatDateTime(rule.lastExecutedAt) : 'Never'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Switch
                          checked={rule.isEnabled}
                          onCheckedChange={(checked) => toggleAlertRule(rule.id, checked)}
                          disabled={isMutating}
                        />
                        <Button variant="ghost" size="icon" onClick={() => testAlertRule(rule.id)} disabled={isMutating}>
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" disabled>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteAlertRule(rule.id)} disabled={isMutating}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {isLoading && (
              <div className="text-sm text-muted-foreground">Loading alert rules...</div>
            )}

            {filteredRules.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-muted-foreground">No alert rules match your filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>View detailed execution history for all alert rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {executions.map((execution) => {
                  const statusKey = execution.status ?? 'pending';
                  const StatusIcon = STATUS_ICONS[statusKey as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending;
                  const actionsCount = Array.isArray(execution.actionsExecuted)
                    ? execution.actionsExecuted.length
                    : execution.actionsExecuted
                      ? 1
                      : 0;
                  
                  return (
                    <Card key={execution.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <StatusIcon.icon className={`h-5 w-5 ${StatusIcon.color}`} />
                              <h4 className="font-semibold">{execution.alertRuleName ?? 'Alert Rule'}</h4>
                              <Badge variant="outline">{execution.triggeredBy}</Badge>
                            </div>
                            
                            <div className="grid md:grid-cols-6 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Status</p>
                                <p className="font-medium capitalize">{execution.status}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Conditions Met</p>
                                <p className="font-medium">{execution.conditionsMet ? 'Yes' : 'No'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Actions</p>
                                <p className="font-medium">{actionsCount}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Execution Time</p>
                                <p className="font-medium">
                                  {execution.executionTimeMs ? (execution.executionTimeMs / 1000).toFixed(2) : '0.00'}s
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Started</p>
                                <p className="font-medium">{formatDateTime(execution.startedAt)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Completed</p>
                                <p className="font-medium">{formatDateTime(execution.completedAt)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" disabled>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isMutating}
                              onClick={() => createEscalation(execution.alertRuleId, execution.alertRuleName)}
                            >
                              Escalate
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {isLoading && (
                  <div className="text-sm text-muted-foreground">Loading execution history...</div>
                )}
                {!isLoading && executions.length === 0 && (
                  <div className="text-sm text-muted-foreground">No execution history yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Escalations Tab */}
        <TabsContent value="escalations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Escalations</CardTitle>
              <CardDescription>Track and resolve alert escalations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {escalations.map((escalation) => (
                  <Card key={escalation.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold">{escalation.name}</h4>
                            <Badge variant="outline">{escalation.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {escalation.description ?? 'No description provided'}
                          </p>
                          <div className="grid md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Rule</p>
                              <p className="font-medium">{escalation.alertRuleName ?? 'Alert Rule'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Current Level</p>
                              <p className="font-medium">{escalation.currentLevel}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Started</p>
                              <p className="font-medium">{formatDateTime(escalation.startedAt)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Next Escalation</p>
                              <p className="font-medium">{formatDateTime(escalation.nextEscalationAt)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isMutating || escalation.status !== 'pending'}
                            onClick={() => updateEscalationStatus(escalation.id, 'in_progress')}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            disabled={isMutating || escalation.status === 'resolved'}
                            onClick={() => updateEscalationStatus(escalation.id, 'resolved')}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {isLoading && (
                  <div className="text-sm text-muted-foreground">Loading escalations...</div>
                )}
                {!isLoading && escalations.length === 0 && (
                  <div className="text-sm text-muted-foreground">No active escalations.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution Trends</CardTitle>
                <CardDescription>Alert executions over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-2" />
                  <p>Chart visualization would go here</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success Rate by Category</CardTitle>
                <CardDescription>Performance breakdown by alert category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(rules.map((rule) => rule.category).filter(Boolean))).map((category) => {
                    const categoryRules = rules.filter(r => r.category === category);
                    const totalExecs = categoryRules.reduce((sum, r) => sum + r.executionCount, 0);
                    const successExecs = categoryRules.reduce((sum, r) => sum + r.successCount, 0);
                    const rate = totalExecs > 0 ? ((successExecs / totalExecs) * 100).toFixed(1) : '0';

                    return (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{(category as string).replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500" 
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{rate}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most Active Rules</CardTitle>
                <CardDescription>Alert rules with highest execution counts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rules
                    .slice()
                    .sort((a, b) => b.executionCount - a.executionCount)
                    .slice(0, 5)
                    .map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{rule.name}</span>
                        <Badge variant="outline">{rule.executionCount} executions</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Execution Time</CardTitle>
                <CardDescription>Performance metrics by alert rule</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rules.slice(0, 5).map((rule) => {
                    const avgTime = rule.executionCount > 0
                      ? (rule.successCount / rule.executionCount).toFixed(2)
                      : '0.00';

                    return (
                      <div key={rule.id} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{rule.name}</span>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{avgTime}s</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Runbook Quick Access</CardTitle>
          <CardDescription>Jump directly to incident response runbooks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            {RUNBOOK_LINKS.map((runbook) => (
              <Link
                key={runbook.slug}
                href={`${localePrefix}/admin/runbooks/${runbook.slug}`}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              >
                {runbook.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

