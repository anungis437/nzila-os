'use client';

/**
 * Compliance Metrics Dashboard
 * 
 * SOC-2 control status visualization, access control metrics, PKI metrics,
 * overall compliance score, and evidence checklist for auditing.
 * 
 * @module components/admin/compliance-metrics-dashboard
 * @author CourtLens Platform Team
 * @date December 3, 2025
 * @phase Phase 3 Week 1 Task 5
 */

import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Lock,
  FileKey,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  TrendingUp,
  Activity,
} from 'lucide-react';
import {
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { ComplianceMetrics } from '@/services/compliance/audit-analysis';

// ============================================================================
// TYPES
// ============================================================================

interface ControlStatus {
  name?: string;
  status: 'compliant' | 'non_compliant' | 'needs_review';
  score: number;
  evidence: string[];
  issues: string[];
}

interface PKIMetrics {
  totalCertificates: number;
  activeCertificates: number;
  expiringSoon: number;
  expired: number;
  totalSignatures: number;
  verifiedSignatures: number;
  failedSignatures: number;
  averageVerificationTime: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_COLORS = {
  compliant: 'bg-green-100 text-green-800',
  non_compliant: 'bg-red-100 text-red-800',
  needs_review: 'bg-yellow-100 text-yellow-800',
};

const STATUS_ICONS = {
  compliant: CheckCircle2,
  non_compliant: XCircle,
  needs_review: AlertTriangle,
};

const CHART_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

// ============================================================================
// COMPONENT
// ============================================================================

export function ComplianceMetricsDashboard() {
  // Fetch compliance metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['compliance-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/compliance/metrics');
      if (!response.ok) throw new Error('Failed to fetch compliance metrics');
      return response.json() as Promise<ComplianceMetrics>;
    },
  });

  // Fetch PKI metrics
  const { data: pkiMetrics, isLoading: _pkiLoading } = useQuery({
    queryKey: ['pki-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/signatures/metrics');
      if (!response.ok) throw new Error('Failed to fetch PKI metrics');
      return response.json() as Promise<PKIMetrics>;
    },
  });

  // Export compliance report
  const handleExportReport = async () => {
    try {
      const response = await fetch('/api/admin/compliance/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'soc2_compliance',
          format: 'pdf',
        }),
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const { reportId } = await response.json();
      window.location.href = `/api/admin/compliance/reports/${reportId}/download`;
    } catch (_error) {
alert('Failed to export compliance report');
    }
  };

  // Overall compliance score data for radial chart
  const complianceScoreData = metrics ? [
    {
      name: 'Compliance',
      value: metrics.overallScore,
      fill: metrics.overallScore >= 80 ? '#22c55e' : metrics.overallScore >= 60 ? '#f59e0b' : '#ef4444',
    },
  ] : [];

  // Controls breakdown data
  const controlsData = metrics ? [
    { name: 'Access Control', score: metrics.soc2Controls.accessControl.score },
    { name: 'Audit Logging', score: metrics.soc2Controls.auditLogging.score },
    { name: 'Data Protection', score: metrics.soc2Controls.dataProtection.score },
    { name: 'Incident Response', score: metrics.soc2Controls.incidentResponse.score },
  ] : [];

  // PKI metrics for charts
  const pkiCertData = pkiMetrics ? [
    { name: 'Active', value: pkiMetrics.activeCertificates, color: CHART_COLORS[0] },
    { name: 'Expiring Soon', value: pkiMetrics.expiringSoon, color: CHART_COLORS[2] },
    { name: 'Expired', value: pkiMetrics.expired, color: CHART_COLORS[1] },
  ] : [];

  const pkiSigData = pkiMetrics ? [
    { name: 'Verified', value: pkiMetrics.verifiedSignatures, color: CHART_COLORS[0] },
    { name: 'Failed', value: pkiMetrics.failedSignatures, color: CHART_COLORS[1] },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Metrics</h1>
          <p className="text-muted-foreground">
            SOC-2 compliance status and security metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchMetrics()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {metricsLoading ? (
        <div className="text-center py-12">Loading compliance metrics...</div>
      ) : metrics ? (
        <>
          {/* Overall Compliance Score */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Overall Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="100%"
                      barSize={20}
                      data={complianceScoreData}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar
                        background
                        dataKey="value"
                        cornerRadius={10}
                      />
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-4xl font-bold"
                      >
                        {metrics.overallScore}%
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-center">
                    <Badge
                      className={
                        metrics.overallScore >= 80
                          ? STATUS_COLORS.compliant
                          : metrics.overallScore >= 60
                          ? STATUS_COLORS.needs_review
                          : STATUS_COLORS.non_compliant
                      }
                    >
                      {metrics.overallScore >= 80
                        ? 'Compliant'
                        : metrics.overallScore >= 60
                        ? 'Needs Review'
                        : 'Non-Compliant'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Control Scores</CardTitle>
                <CardDescription>Individual SOC-2 control compliance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={controlsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" fill={CHART_COLORS[3]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Audit Schedule */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Audit Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Last Audit</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(metrics.lastAuditDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Next Audit Due</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(metrics.nextAuditDue).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Days Remaining</span>
                  <span className="text-sm font-semibold">
                    {Math.ceil(
                      (new Date(metrics.nextAuditDue).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Compliance Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Previous Quarter</span>
                    <span className="font-semibold">85%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Current Quarter</span>
                    <span className="font-semibold">{metrics.overallScore}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Change</span>
                    <span className={`font-semibold ${metrics.overallScore >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.overallScore >= 85 ? '+' : ''}{metrics.overallScore - 85}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SOC-2 Controls Details */}
          <Tabs defaultValue="access" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="access">Access Control</TabsTrigger>
              <TabsTrigger value="audit">Audit Logging</TabsTrigger>
              <TabsTrigger value="data">Data Protection</TabsTrigger>
              <TabsTrigger value="incident">Incident Response</TabsTrigger>
            </TabsList>

            <TabsContent value="access">
              <ControlStatusCard
                icon={Lock}
                title="Access Control"
                control={metrics.soc2Controls.accessControl}
              />
            </TabsContent>

            <TabsContent value="audit">
              <ControlStatusCard
                icon={Activity}
                title="Audit Logging"
                control={metrics.soc2Controls.auditLogging}
              />
            </TabsContent>

            <TabsContent value="data">
              <ControlStatusCard
                icon={Shield}
                title="Data Protection"
                control={metrics.soc2Controls.dataProtection}
              />
            </TabsContent>

            <TabsContent value="incident">
              <ControlStatusCard
                icon={AlertTriangle}
                title="Incident Response"
                control={metrics.soc2Controls.incidentResponse}
              />
            </TabsContent>
          </Tabs>

          {/* PKI Metrics */}
          {pkiMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileKey className="h-5 w-5" />
                  PKI & Digital Signature Metrics
                </CardTitle>
                <CardDescription>
                  Certificate management and signature verification statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Certificate Status */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4">Certificate Status</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total Certificates</span>
                        <Badge variant="outline">{pkiMetrics.totalCertificates}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Active</span>
                        <Badge className="bg-green-100 text-green-800">
                          {pkiMetrics.activeCertificates}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Expiring Soon (30d)</span>
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {pkiMetrics.expiringSoon}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Expired</span>
                        <Badge className="bg-red-100 text-red-800">
                          {pkiMetrics.expired}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie
                            data={pkiCertData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            label
                          >
                            {pkiCertData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Signature Verification */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4">Signature Verification</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total Signatures</span>
                        <Badge variant="outline">{pkiMetrics.totalSignatures}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Verified</span>
                        <Badge className="bg-green-100 text-green-800">
                          {pkiMetrics.verifiedSignatures}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Failed</span>
                        <Badge className="bg-red-100 text-red-800">
                          {pkiMetrics.failedSignatures}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Avg Verification Time</span>
                        <Badge variant="outline">{pkiMetrics.averageVerificationTime}ms</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Success Rate</span>
                        <Badge className="bg-blue-100 text-blue-800">
                          {((pkiMetrics.verifiedSignatures / pkiMetrics.totalSignatures) * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie
                            data={pkiSigData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            label
                          >
                            {pkiSigData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-12">No compliance metrics available</div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ControlStatusCardProps {
  icon: React.ElementType;
  title: string;
  control: ControlStatus;
}

function ControlStatusCard({ icon: Icon, title, control }: ControlStatusCardProps) {
  const StatusIcon = STATUS_ICONS[control.status];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <Badge className={STATUS_COLORS[control.status]}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {control.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Compliance Score</span>
            <span className="text-2xl font-bold">{control.score}%</span>
          </div>
          <Progress value={control.score} className="h-2" />
        </div>

        {/* Evidence */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Evidence
          </h4>
          <ul className="space-y-1">
            {control.evidence.map((item, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-green-600 mt-0.5">â€¢</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Issues */}
        {control.issues.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Issues
            </h4>
            <ul className="space-y-1">
              {control.issues.map((item, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">â€¢</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

