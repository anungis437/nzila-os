"use client";

/**
 * CLC Labour Intelligence Console
 *
 * Six-tab client component for CLC national staff and executives:
 * 1. Overview — key metrics + cohort confidence badge
 * 2. Decision Intelligence — risk posture, patterns, recommendations, briefing cards
 * 3. Sector Signals — cross-sector clause/precedent trends
 * 4. Affiliate Trends — per-affiliate sharing and engagement
 * 5. Shared Knowledge — clause library + precedent database health
 * 6. Governance — consent, participation, and cohort health
 */

import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  FileText,
  Scale,
  Users,
  Eye,
  Building2,
  BarChart3,
  Calendar,
  Shield,
  Network,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Brain,
  Zap,
  Target,
  Activity,
} from "lucide-react";
import { StatCard } from "@/components/analytics/StatCard";
import { TopItemsList } from "@/components/analytics/TopItemsList";
import { DistributionChart } from "@/components/analytics/DistributionChart";

// ── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = "overview" | "decisions" | "sectors" | "affiliates" | "knowledge" | "governance";

interface SectorSignal {
  sector: string;
  clauseCount: number;
  precedentCount: number;
  totalCitations: number;
  totalViews: number;
  uniqueOrgs: number;
  topClauseTypes: { clauseType: string; count: number }[];
}

interface AffiliateTrend {
  organizationType: string;
  affiliateCount: number;
  clausesShared: number;
  precedentsShared: number;
  accessesInitiated: number;
  resourcesAccessed: number;
  clauseSharingEnabledCount: number;
  precedentSharingEnabledCount: number;
}

interface SharedKnowledgeIndex {
  totalClauses: number;
  totalPrecedents: number;
  totalCitations: number;
  totalViews: number;
  uniqueOrgs: number;
  topCited: {
    id: string;
    title: string;
    type: "clause" | "precedent";
    citationCount: number;
    sector: string | null;
  }[];
  clauseTypeDistribution: { name: string; value: number }[];
  outcomeDistribution: { name: string; value: number }[];
}

interface GovernanceSummary {
  totalAffiliates: number;
  consentedCrossUnion: number;
  consentedSectorBenchmarks: number;
  consentedNationalSignals: number;
  sharingAdoption: {
    clauseSharingEnabled: number;
    precedentSharingEnabled: number;
    federationSharingEnabled: number;
  };
  cohortHealth: "healthy" | "marginal" | "insufficient";
}

// ── NIL Briefing Types ──────────────────────────────────────────────────────

// ── Decision Intelligence Types ─────────────────────────────────────────────

interface DecisionPattern {
  id: string;
  patternType: string;
  title: string;
  summary: string;
  affectedSectors: string[];
  affectedAffiliateTypes: string[];
  confidence: number;
  watchLevel: "normal" | "elevated" | "high" | "critical";
}

interface DecisionRecommendation {
  id: string;
  signalId: string;
  recommendedAction: "monitor" | "prepare" | "escalate" | "intervene";
  rationale: string;
  timeframe: string;
  targetAudience: string;
  confidence: number;
}

interface ExecutiveBriefingCard {
  id: string;
  category: "risk" | "opportunity" | "trend";
  headline: string;
  significance: string;
  confidence: number;
  confidenceBand: "low" | "medium" | "high";
  recommendedAction: string;
  timeframe: string;
  watchLevel: "normal" | "elevated" | "high" | "critical";
  evidenceRefs: string[];
}

interface MovementRiskPosture {
  posture: "steady" | "vigilant" | "heightened";
  watchAreas: string[];
  risingSectors: string[];
  issueClusters: string[];
  summary: string;
  confidence: number;
}

interface BargainingWatch {
  sectors: string[];
  headline: string;
  preparationIndicators: string[];
  signalStrength: 'weak' | 'moderate' | 'strong';
  recommendedAction: string;
  confidence: number;
  evidenceRefs: string[];
}

interface SectorDivergence {
  sector: string;
  divergenceScore: number;
  uniqueFactors: string[];
  commonFactors: string[];
  velocity: number;
  classification: string;
}

interface DecisionIntelligenceOutput {
  riskPosture: MovementRiskPosture;
  sectorDivergence: SectorDivergence[];
  bargainingWatch: BargainingWatch | null;
  patterns: DecisionPattern[];
  recommendations: DecisionRecommendation[];
  briefingCards: ExecutiveBriefingCard[];
  meta: {
    fromDate: string | null;
    toDate: string | null;
    sectorCount: number;
    affiliateTypeCount: number;
    timeSeriesAvailable: boolean;
  };
}

interface BriefingFinding {
  title: string;
  detail: string;
  confidence: number;
  severity: "info" | "advisory" | "action-required";
}

interface IntelligenceBriefing {
  useCase: string;
  generatedAt: string;
  overallConfidence: number;
  findings: BriefingFinding[];
}

// ── Briefing Panel ──────────────────────────────────────────────────────────

function BriefingPanel({ briefing, isLoading }: { briefing: IntelligenceBriefing | null; isLoading: boolean }) {
  if (isLoading) return null;
  if (!briefing || briefing.findings.length === 0) return null;

  const severityConfig = {
    "info": { bg: "bg-blue-50 border-blue-200", text: "text-blue-800", icon: CheckCircle2, label: "Info" },
    "advisory": { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-800", icon: AlertTriangle, label: "Advisory" },
    "action-required": { bg: "bg-red-50 border-red-200", text: "text-red-800", icon: XCircle, label: "Action Required" },
  };

  return (
    <Card className="border-indigo-200 bg-indigo-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          Intelligence Briefing
          <Badge variant="outline" className="ml-auto text-xs">
            Confidence: {(briefing.overallConfidence * 100).toFixed(0)}%
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Why this matters — key findings from governed aggregate data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {briefing.findings.map((finding, i) => {
          const config = severityConfig[finding.severity];
          const Icon = config.icon;
          return (
            <div key={i} className={`p-3 rounded-lg border ${config.bg}`}>
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 ${config.text}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-sm ${config.text}`}>{finding.title}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                      {(finding.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{finding.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Cohort badge ────────────────────────────────────────────────────────────

function CohortBadge({ health }: { health?: GovernanceSummary["cohortHealth"] }) {
  if (!health) return null;
  const config = {
    healthy: { label: "Cohort: Healthy", variant: "default" as const, icon: CheckCircle2, className: "bg-green-100 text-green-800 border-green-200" },
    marginal: { label: "Cohort: Marginal", variant: "secondary" as const, icon: AlertTriangle, className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    insufficient: { label: "Cohort: Insufficient", variant: "destructive" as const, icon: XCircle, className: "bg-red-100 text-red-800 border-red-200" },
  }[health];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function CLCIntelligenceConsole() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [dateRange, setDateRange] = useState("30");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [sectorSignals, setSectorSignals] = useState<SectorSignal[] | null>(null);
  const [affiliateTrends, setAffiliateTrends] = useState<AffiliateTrend[] | null>(null);
  const [knowledgeIndex, setKnowledgeIndex] = useState<SharedKnowledgeIndex | null>(null);
  const [governance, setGovernance] = useState<GovernanceSummary | null>(null);

  // Briefing states
  const [sectorBriefing, setSectorBriefing] = useState<IntelligenceBriefing | null>(null);
  const [affiliateBriefing, setAffiliateBriefing] = useState<IntelligenceBriefing | null>(null);
  const [knowledgeBriefing, setKnowledgeBriefing] = useState<IntelligenceBriefing | null>(null);
  const [governanceBriefing, setGovernanceBriefing] = useState<IntelligenceBriefing | null>(null);

  // Decision intelligence state
  const [decisionIntel, setDecisionIntel] = useState<DecisionIntelligenceOutput | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fromDate = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString();
      const toDate = new Date().toISOString();
      const params = new URLSearchParams({ fromDate, toDate, briefing: 'true' });

      const [sectorsRes, affiliatesRes, knowledgeRes, govRes, decisionRes] = await Promise.all([
        fetch(`/api/v2/analytics/clc/sector-signals?${params}`),
        fetch(`/api/v2/analytics/clc/affiliate-trends?${params}`),
        fetch(`/api/v2/analytics/clc/knowledge-index?briefing=true`),
        fetch(`/api/v2/analytics/clc/governance?briefing=true`),
        fetch(`/api/v2/analytics/clc/decision-intelligence?${params}`),
      ]);

      // Check for governance failures
      if (!govRes.ok) {
        const body = await govRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error || `Governance check failed (${govRes.status})`);
      }

      const [sectorsData, affiliatesData, knowledgeData, govData] = await Promise.all([
        sectorsRes.ok ? sectorsRes.json() : null,
        affiliatesRes.ok ? affiliatesRes.json() : null,
        knowledgeRes.ok ? knowledgeRes.json() : null,
        govRes.json(),
      ]);

      // Decision intelligence — fetched separately to handle graceful degradation
      const decisionData = decisionRes.ok ? await decisionRes.json() : null;

      setSectorSignals(sectorsData?.signals ?? null);
      setAffiliateTrends(affiliatesData?.trends ?? null);
      setKnowledgeIndex(knowledgeData?.index ?? null);
      setGovernance(govData?.summary ?? null);

      // Briefings
      setSectorBriefing(sectorsData?.briefing ?? null);
      setAffiliateBriefing(affiliatesData?.briefing ?? null);
      setKnowledgeBriefing(knowledgeData?.briefing ?? null);
      setGovernanceBriefing(govData?.briefing ?? null);

      // Decision intelligence
      setDecisionIntel(decisionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intelligence data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (mounted) fetchData();
  }, [mounted, fetchData]);

  if (!mounted) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-indigo-600" />
            <h1 className="text-3xl font-bold">Labour Intelligence</h1>
            <CohortBadge health={governance?.cohortHealth} />
          </div>
          <p className="text-muted-foreground mt-1">
            Governed cross-union intelligence for CLC national leadership
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Period:</span>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-45">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 6 months</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="decisions">Decision Intelligence</TabsTrigger>
          <TabsTrigger value="sectors">Sector Signals</TabsTrigger>
          <TabsTrigger value="affiliates">Affiliate Trends</TabsTrigger>
          <TabsTrigger value="knowledge">Shared Knowledge</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Participating Affiliates"
              value={governance?.consentedCrossUnion ?? 0}
              icon={Building2}
              description={`of ${governance?.totalAffiliates ?? 0} total`}
              iconColor="text-indigo-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Shared Clauses"
              value={knowledgeIndex?.totalClauses ?? 0}
              icon={FileText}
              description={`${knowledgeIndex?.uniqueOrgs ?? 0} contributing orgs`}
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Shared Precedents"
              value={knowledgeIndex?.totalPrecedents ?? 0}
              icon={Scale}
              description="Across consented affiliates"
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Views"
              value={knowledgeIndex?.totalViews ?? 0}
              icon={Eye}
              description="Across all shared resources"
              iconColor="text-green-600"
              isLoading={isLoading}
            />
          </div>

          {/* Sector Signal Summary */}
          {sectorSignals && sectorSignals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  Top Sector Signals
                </CardTitle>
                <CardDescription>
                  Cross-sector trends from {governance?.consentedCrossUnion ?? 0} consenting affiliates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sectorSignals.slice(0, 5).map((signal) => (
                    <div
                      key={signal.sector}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <p className="font-medium capitalize">{signal.sector}</p>
                        <p className="text-sm text-muted-foreground">
                          {signal.clauseCount} clauses &bull; {signal.precedentCount} precedents
                          &bull; {signal.uniqueOrgs} orgs
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-medium text-indigo-600">
                          {signal.totalCitations} citations
                        </div>
                        <div className="text-muted-foreground">
                          {signal.totalViews} views
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Decision Intelligence Tab ─────────────────────────────────── */}
        <TabsContent value="decisions" className="space-y-6">
          {/* Risk Posture Banner */}
          {decisionIntel?.riskPosture && (
            <Card className={
              decisionIntel.riskPosture.posture === 'heightened'
                ? 'border-red-200 bg-red-50/30'
                : decisionIntel.riskPosture.posture === 'vigilant'
                  ? 'border-yellow-200 bg-yellow-50/30'
                  : 'border-green-200 bg-green-50/30'
            }>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Activity className={`h-5 w-5 ${
                    decisionIntel.riskPosture.posture === 'heightened' ? 'text-red-600'
                    : decisionIntel.riskPosture.posture === 'vigilant' ? 'text-yellow-600'
                    : 'text-green-600'
                  }`} />
                  Movement Risk Posture
                  <Badge variant={
                    decisionIntel.riskPosture.posture === 'heightened' ? 'destructive'
                    : decisionIntel.riskPosture.posture === 'vigilant' ? 'secondary'
                    : 'default'
                  } className="ml-2 capitalize">
                    {decisionIntel.riskPosture.posture}
                  </Badge>
                  <Badge variant="outline" className="ml-auto text-xs">
                    Confidence: {(decisionIntel.riskPosture.confidence * 100).toFixed(0)}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-3">{decisionIntel.riskPosture.summary}</p>
                {decisionIntel.riskPosture.watchAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {decisionIntel.riskPosture.watchAreas.map((area) => (
                      <Badge key={area} variant="outline" className="text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Correlated Patterns"
              value={decisionIntel?.patterns.length ?? 0}
              icon={Brain}
              description={`${decisionIntel?.patterns.filter(p => p.watchLevel === 'high' || p.watchLevel === 'critical').length ?? 0} high/critical`}
              iconColor="text-indigo-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Recommendations"
              value={decisionIntel?.recommendations.length ?? 0}
              icon={Target}
              description={`${decisionIntel?.recommendations.filter(r => r.recommendedAction === 'intervene' || r.recommendedAction === 'escalate').length ?? 0} urgent`}
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Briefing Cards"
              value={decisionIntel?.briefingCards.length ?? 0}
              icon={FileText}
              description="Executive-ready insights"
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Sectors Diverging"
              value={decisionIntel?.sectorDivergence.filter(d => d.divergenceScore > 0.3).length ?? 0}
              icon={TrendingUp}
              description={`of ${decisionIntel?.sectorDivergence.length ?? 0} analyzed`}
              iconColor="text-orange-600"
              isLoading={isLoading}
            />
          </div>

          {/* Bargaining Watch Alert */}
          {decisionIntel?.bargainingWatch && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-5 w-5 text-amber-600" />
                  Bargaining Watch
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Signal: {decisionIntel.bargainingWatch.signalStrength}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium">{decisionIntel.bargainingWatch.headline}</p>
                <div className="flex flex-wrap gap-1.5">
                  {decisionIntel.bargainingWatch.sectors.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs capitalize">{s}</Badge>
                  ))}
                </div>
                {decisionIntel.bargainingWatch.preparationIndicators.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Preparation Indicators</p>
                    <ul className="text-xs space-y-0.5">
                      {decisionIntel.bargainingWatch.preparationIndicators.map((ind, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 bg-amber-500 rounded-full shrink-0" />
                          {ind}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Executive Briefing Cards */}
          {decisionIntel?.briefingCards && decisionIntel.briefingCards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-indigo-600" />
                  Executive Briefing Cards
                </CardTitle>
                <CardDescription>
                  Decision-ready intelligence insights for CLC leadership
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {decisionIntel.briefingCards.map((card) => (
                  <div
                    key={card.id}
                    className={`p-4 rounded-lg border ${
                      card.watchLevel === 'critical' ? 'border-red-200 bg-red-50/50'
                      : card.watchLevel === 'high' ? 'border-orange-200 bg-orange-50/50'
                      : card.watchLevel === 'elevated' ? 'border-yellow-200 bg-yellow-50/50'
                      : 'border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={
                            card.category === 'risk' ? 'destructive'
                            : card.category === 'opportunity' ? 'default'
                            : 'secondary'
                          } className="text-[10px] px-1.5 py-0 h-4 capitalize">
                            {card.category}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 capitalize ${
                            card.watchLevel === 'critical' || card.watchLevel === 'high'
                              ? 'border-red-300 text-red-700'
                              : card.watchLevel === 'elevated'
                                ? 'border-yellow-300 text-yellow-700'
                                : ''
                          }`}>
                            {card.watchLevel}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {card.confidenceBand}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm">{card.headline}</p>
                        <p className="text-xs text-muted-foreground mt-1">{card.significance}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{card.timeframe.replace(/_/g, ' ')}</p>
                        <p className="text-xs font-medium capitalize mt-0.5">{card.recommendedAction}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Correlated Patterns */}
          {decisionIntel?.patterns && decisionIntel.patterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-purple-600" />
                  Correlated Patterns
                </CardTitle>
                <CardDescription>
                  Cross-affiliate patterns detected from governed aggregate data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {decisionIntel.patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{pattern.title}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 capitalize ${
                            pattern.watchLevel === 'critical' || pattern.watchLevel === 'high'
                              ? 'border-red-300 text-red-700'
                              : pattern.watchLevel === 'elevated'
                                ? 'border-yellow-300 text-yellow-700'
                                : ''
                          }`}>
                            {pattern.watchLevel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{pattern.summary}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pattern.affectedSectors.map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s}</Badge>
                          ))}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {(pattern.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {decisionIntel?.recommendations && decisionIntel.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  Recommendations
                </CardTitle>
                <CardDescription>
                  Prioritized actions based on detected patterns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {decisionIntel.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <Badge variant={
                      rec.recommendedAction === 'intervene' ? 'destructive'
                      : rec.recommendedAction === 'escalate' ? 'secondary'
                      : rec.recommendedAction === 'prepare' ? 'default'
                      : 'outline'
                    } className="capitalize shrink-0 mt-0.5">
                      {rec.recommendedAction}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{rec.rationale}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>Timeframe: {rec.timeframe.replace(/_/g, ' ')}</span>
                        <span>Audience: {rec.targetAudience.replace(/_/g, ' ')}</span>
                        <span>Confidence: {(rec.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Sector Divergence */}
          {decisionIntel?.sectorDivergence && decisionIntel.sectorDivergence.filter(d => d.divergenceScore > 0.1).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  Sector Divergence
                </CardTitle>
                <CardDescription>
                  How sectors differ from movement-wide baselines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {decisionIntel.sectorDivergence
                  .filter(d => d.divergenceScore > 0.1)
                  .sort((a, b) => b.divergenceScore - a.divergenceScore)
                  .map((div) => (
                  <div
                    key={div.sector}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium capitalize">{div.sector}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {div.classification.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Divergence: {(div.divergenceScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    {div.uniqueFactors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {div.uniqueFactors.map((f) => (
                          <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* No patterns state */}
          {decisionIntel && decisionIntel.patterns.length === 0 && decisionIntel.briefingCards.length === 0 && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="pt-6 flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  No actionable patterns detected. The movement posture is steady.
                </span>
              </CardContent>
            </Card>
          )}

          {/* Loading state */}
          {isLoading && !decisionIntel && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Analyzing governed aggregates...
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Sector Signals Tab ────────────────────────────────────────── */}
        <TabsContent value="sectors" className="space-y-6">
          <BriefingPanel briefing={sectorBriefing} isLoading={isLoading} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Active Sectors"
              value={sectorSignals?.length ?? 0}
              icon={BarChart3}
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Citations"
              value={sectorSignals?.reduce((sum, s) => sum + s.totalCitations, 0) ?? 0}
              icon={TrendingUp}
              iconColor="text-indigo-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Contributing Orgs"
              value={
                new Set(
                  sectorSignals?.flatMap((s) =>
                    Array.from({ length: s.uniqueOrgs }, (_, i) => `${s.sector}-${i}`),
                  ) ?? [],
                ).size || sectorSignals?.reduce((max, s) => Math.max(max, s.uniqueOrgs), 0) ?? 0
              }
              icon={Network}
              iconColor="text-green-600"
              isLoading={isLoading}
            />
          </div>

          <DistributionChart
            title="Clauses by Sector"
            data={
              sectorSignals?.map((s) => ({
                name: s.sector,
                value: s.clauseCount,
              })) ?? []
            }
            type="bar"
            isLoading={isLoading}
            height={300}
          />

          {sectorSignals && sectorSignals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sector Detail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sectorSignals.map((signal) => (
                    <div
                      key={signal.sector}
                      className="p-4 rounded-lg border bg-card space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold capitalize text-lg">{signal.sector}</h3>
                        <Badge variant="outline">{signal.uniqueOrgs} orgs</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Clauses</p>
                          <p className="font-medium">{signal.clauseCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Precedents</p>
                          <p className="font-medium">{signal.precedentCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Citations</p>
                          <p className="font-medium">{signal.totalCitations}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Views</p>
                          <p className="font-medium">{signal.totalViews}</p>
                        </div>
                      </div>
                      {signal.topClauseTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {signal.topClauseTypes.map((ct) => (
                            <Badge key={ct.clauseType} variant="secondary" className="text-xs">
                              {ct.clauseType} ({ct.count})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Affiliate Trends Tab ──────────────────────────────────────── */}
        <TabsContent value="affiliates" className="space-y-6">
          <BriefingPanel briefing={affiliateBriefing} isLoading={isLoading} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Organization Types"
              value={affiliateTrends?.length ?? 0}
              icon={Building2}
              description={`${affiliateTrends?.reduce((s, t) => s + t.affiliateCount, 0) ?? 0} total affiliates`}
              iconColor="text-indigo-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Clauses Shared"
              value={affiliateTrends?.reduce((sum, t) => sum + t.clausesShared, 0) ?? 0}
              icon={FileText}
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Precedents Shared"
              value={affiliateTrends?.reduce((sum, t) => sum + t.precedentsShared, 0) ?? 0}
              icon={Scale}
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Accesses"
              value={affiliateTrends?.reduce((sum, t) => sum + t.accessesInitiated, 0) ?? 0}
              icon={Users}
              iconColor="text-green-600"
              isLoading={isLoading}
            />
          </div>

          {affiliateTrends && affiliateTrends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  Engagement by Organization Type
                </CardTitle>
                <CardDescription>
                  Aggregate sharing and activity metrics per organization category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {affiliateTrends
                    .sort((a, b) => (b.clausesShared + b.precedentsShared) - (a.clausesShared + a.precedentsShared))
                    .map((t) => (
                    <div
                      key={t.organizationType}
                      className="p-4 rounded-lg border bg-card space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold capitalize text-lg">{t.organizationType}</h3>
                        <Badge variant="outline">{t.affiliateCount} affiliates</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Clauses Shared</p>
                          <p className="font-medium">{t.clausesShared}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Precedents Shared</p>
                          <p className="font-medium">{t.precedentsShared}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Accesses</p>
                          <p className="font-medium">{t.accessesInitiated}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Unique Resources</p>
                          <p className="font-medium">{t.resourcesAccessed}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Badge variant={t.clauseSharingEnabledCount > 0 ? "default" : "secondary"} className="text-xs">
                          Clause sharing: {t.clauseSharingEnabledCount}/{t.affiliateCount}
                        </Badge>
                        <Badge variant={t.precedentSharingEnabledCount > 0 ? "default" : "secondary"} className="text-xs">
                          Precedent sharing: {t.precedentSharingEnabledCount}/{t.affiliateCount}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Shared Knowledge Tab ──────────────────────────────────────── */}
        <TabsContent value="knowledge" className="space-y-6">
          <BriefingPanel briefing={knowledgeBriefing} isLoading={isLoading} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Shared Clauses"
              value={knowledgeIndex?.totalClauses ?? 0}
              icon={FileText}
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Shared Precedents"
              value={knowledgeIndex?.totalPrecedents ?? 0}
              icon={Scale}
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Citations"
              value={knowledgeIndex?.totalCitations ?? 0}
              icon={TrendingUp}
              iconColor="text-indigo-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Contributing Orgs"
              value={knowledgeIndex?.uniqueOrgs ?? 0}
              icon={Building2}
              iconColor="text-green-600"
              isLoading={isLoading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DistributionChart
              title="Clause Type Distribution"
              data={knowledgeIndex?.clauseTypeDistribution ?? []}
              type="bar"
              isLoading={isLoading}
              height={300}
            />
            <DistributionChart
              title="Precedent Outcomes"
              data={knowledgeIndex?.outcomeDistribution ?? []}
              type="pie"
              isLoading={isLoading}
              height={300}
            />
          </div>

          <TopItemsList
            title="Most Referenced Resources"
            items={
              knowledgeIndex?.topCited?.map((item) => ({
                id: item.id,
                title: item.title,
                subtitle: item.sector ?? "No sector",
                metric: item.citationCount,
                metricLabel: "citations",
                badge: item.type,
                badgeVariant: item.type === "clause" ? ("secondary" as const) : ("outline" as const),
              })) ?? []
            }
            isLoading={isLoading}
            maxItems={10}
          />
        </TabsContent>

        {/* ── Governance Tab ────────────────────────────────────────────── */}
        <TabsContent value="governance" className="space-y-6">
          <BriefingPanel briefing={governanceBriefing} isLoading={isLoading} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Affiliates"
              value={governance?.totalAffiliates ?? 0}
              icon={Building2}
              iconColor="text-slate-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Cross-Union Consent"
              value={governance?.consentedCrossUnion ?? 0}
              icon={Shield}
              description={`of ${governance?.totalAffiliates ?? 0} affiliates`}
              iconColor="text-green-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Sector Benchmark Consent"
              value={governance?.consentedSectorBenchmarks ?? 0}
              icon={BarChart3}
              description={`of ${governance?.totalAffiliates ?? 0} affiliates`}
              iconColor="text-indigo-600"
              isLoading={isLoading}
            />
            <StatCard
              title="National Signals Consent"
              value={governance?.consentedNationalSignals ?? 0}
              icon={TrendingUp}
              description={`of ${governance?.totalAffiliates ?? 0} affiliates`}
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
          </div>

          {/* Sharing adoption */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                Sharing Adoption
              </CardTitle>
              <CardDescription>
                How many affiliates have enabled automatic sharing features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border bg-card text-center">
                  <p className="text-sm text-muted-foreground">Clause Sharing</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {governance?.sharingAdoption.clauseSharingEnabled ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {governance?.totalAffiliates ?? 0} affiliates
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-card text-center">
                  <p className="text-sm text-muted-foreground">Precedent Sharing</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {governance?.sharingAdoption.precedentSharingEnabled ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {governance?.totalAffiliates ?? 0} affiliates
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-card text-center">
                  <p className="text-sm text-muted-foreground">Federation Sharing</p>
                  <p className="text-2xl font-bold text-green-600">
                    {governance?.sharingAdoption.federationSharingEnabled ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {governance?.totalAffiliates ?? 0} affiliates
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cohort health detail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Cohort Health
                <CohortBadge health={governance?.cohortHealth} />
              </CardTitle>
              <CardDescription>
                Minimum 5 consenting affiliates required per dimension for aggregate analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded border">
                  <span>Cross-Union Analytics</span>
                  <span
                    className={
                      (governance?.consentedCrossUnion ?? 0) >= 5
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {governance?.consentedCrossUnion ?? 0} / 5 minimum
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded border">
                  <span>Sector Benchmarks</span>
                  <span
                    className={
                      (governance?.consentedSectorBenchmarks ?? 0) >= 5
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {governance?.consentedSectorBenchmarks ?? 0} / 5 minimum
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded border">
                  <span>National Signals</span>
                  <span
                    className={
                      (governance?.consentedNationalSignals ?? 0) >= 5
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {governance?.consentedNationalSignals ?? 0} / 5 minimum
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
