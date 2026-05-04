'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  RefreshCcw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Lightbulb,
  Info,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIBanner } from '@/components/ai';

// ── Types matching the API envelope ─────────────────────────────────────────

interface FinancialInsightEntry {
  label: string;
  value: number | string;
  trend: 'up' | 'down' | 'stable';
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

interface FinancialRiskEntry {
  area: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  currentMetric: number | string;
  threshold: number | string;
  description: string;
}

interface FinancialRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
  impact: string;
  timeframe: string;
}

interface FinancialInsightResult {
  analysisType: string;
  timeframe: string;
  title: string;
  executiveSummary: string;
  insights: FinancialInsightEntry[];
  risks: FinancialRiskEntry[];
  recommendations: FinancialRecommendation[];
  dataSourcesUsed: string[];
}

interface AiEnvelope {
  available: boolean;
  data: FinancialInsightResult;
  confidence: number;
  explanation: string;
  modelVersion: string;
  disclaimer: string;
  auditRef: string;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function FinancialAiInsights() {
  const [envelope, setEnvelope] = useState<AiEnvelope | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/finance/analysis?type=comprehensive&timeframe=90d');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const json = await res.json();
      // API returns { success, data: AiEnvelope }
      setEnvelope(json.data ?? json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate financial insights');
    } finally {
      setLoading(false);
    }
  }, []);

  // Not yet generated
  if (!envelope && !loading && !error) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Brain className="h-12 w-12 text-blue-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">AI Financial Intelligence</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Generate AI-powered analysis of your financial health including collection anomalies,
            arrears risk scoring, budget variance, and executive recommendations.
          </p>
          <button
            onClick={generateInsights}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Brain className="h-4 w-4" />
            Generate Financial Analysis
          </button>
        </CardContent>
      </Card>
    );
  }

  // Loading
  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
          <p className="text-sm font-medium text-gray-900">Analyzing financial data...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
        </CardContent>
      </Card>
    );
  }

  // Error
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/30">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
          <p className="text-sm font-medium text-gray-900">Analysis Failed</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">{error}</p>
          <button
            onClick={generateInsights}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!envelope) return null;

  const { data: insight } = envelope;

  return (
    <div className="space-y-6">
      <AIBanner variant="info" context="analysis" />
      {/* Header + Confidence */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            {insight.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{insight.executiveSummary}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ConfidenceBadge confidence={envelope.confidence} />
          <button
            onClick={generateInsights}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <RefreshCcw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Insights Grid */}
      {insight.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Key Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insight.insights.map((entry, i) => (
                <InsightCard key={i} entry={entry} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Assessment */}
      {insight.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Risk Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insight.risks.map((risk, i) => (
                <RiskRow key={i} risk={risk} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {insight.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-emerald-600" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insight.recommendations.map((rec, i) => (
                <RecommendationRow key={i} rec={rec} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800">
          <p className="font-medium mb-0.5">AI Advisory Disclaimer</p>
          <p>{envelope.disclaimer}</p>
          <p className="mt-1 text-blue-600">
            Confidence: {Math.round(envelope.confidence * 100)}% · Model: {envelope.modelVersion} · Audit: {envelope.auditRef}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? 'bg-emerald-100 text-emerald-800' :
    pct >= 60 ? 'bg-amber-100 text-amber-800' :
    'bg-red-100 text-red-800';

  return (
    <Badge className={cn('text-xs', color)}>
      {pct}% confidence
    </Badge>
  );
}

function InsightCard({ entry }: { entry: FinancialInsightEntry }) {
  const severityColors = {
    info: 'border-blue-200 bg-blue-50/50',
    warning: 'border-amber-200 bg-amber-50/50',
    critical: 'border-red-200 bg-red-50/50',
  };

  const TrendIcon = entry.trend === 'up' ? TrendingUp : entry.trend === 'down' ? TrendingDown : Minus;
  const trendColor = entry.trend === 'up' ? 'text-emerald-600' : entry.trend === 'down' ? 'text-red-600' : 'text-gray-400';

  return (
    <div className={cn('rounded-lg border p-3 space-y-1', severityColors[entry.severity])}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{entry.label}</span>
        <div className="flex items-center gap-1">
          <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
          <SeverityBadge severity={entry.severity} />
        </div>
      </div>
      <p className="text-lg font-bold">{entry.value}</p>
      <p className="text-xs text-muted-foreground">{entry.description}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'info' | 'warning' | 'critical' }) {
  const config = {
    info: { label: 'Info', className: 'bg-blue-100 text-blue-700' },
    warning: { label: 'Warning', className: 'bg-amber-100 text-amber-700' },
    critical: { label: 'Critical', className: 'bg-red-100 text-red-700' },
  };
  const c = config[severity];
  return <Badge className={cn('text-[10px] px-1.5 py-0', c.className)}>{c.label}</Badge>;
}

function RiskRow({ risk }: { risk: FinancialRiskEntry }) {
  const riskColors = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };
  const riskLabels = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn('mt-1 h-2.5 w-2.5 rounded-full shrink-0', riskColors[risk.riskLevel])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{risk.area}</span>
          <Badge variant="outline" className="text-[10px]">{riskLabels[risk.riskLevel]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{risk.description}</p>
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
          <span>Current: <strong>{risk.currentMetric}</strong></span>
          <span>Threshold: <strong>{risk.threshold}</strong></span>
        </div>
      </div>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: FinancialRecommendation }) {
  const priorityColors = {
    low: 'bg-blue-100 text-blue-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <Lightbulb className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{rec.action}</span>
          <Badge className={cn('text-[10px] px-1.5 py-0', priorityColors[rec.priority])}>
            {rec.priority}
          </Badge>
        </div>
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
          <span>Impact: {rec.impact}</span>
          <span>Timeline: {rec.timeframe}</span>
        </div>
      </div>
    </div>
  );
}
