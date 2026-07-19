"use client";

import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SourceRegistryTable } from "@/components/cba-intelligence/source-registry-table";
import { IngestionMonitor } from "@/components/cba-intelligence/ingestion-monitor";
import { AgreementExplorer } from "@/components/cba-intelligence/agreement-explorer";
import { ReviewQueue } from "@/components/cba-intelligence/review-queue";
import { BenchmarkView } from "@/components/cba-intelligence/benchmark-view";
import { FreshnessDashboard } from "@/components/cba-intelligence/freshness-dashboard";
import { OperationalHealthPanel } from "@/components/cba-intelligence/operational-health-panel";
import { Database } from "lucide-react";

type HealthLevel = "healthy" | "warning" | "critical";

interface HealthCheck {
  name: string;
  level: HealthLevel;
}

interface OperationalHealthResponse {
  success: boolean;
  data: {
    checks: HealthCheck[];
  };
}

export interface CbaTabHealth {
  ingestion: HealthLevel;
  review: HealthLevel;
  freshness: HealthLevel;
}

function maxLevel(levels: HealthLevel[]): HealthLevel {
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warning")) return "warning";
  return "healthy";
}

export function deriveCbaTabHealth(checks: HealthCheck[]): CbaTabHealth {
  const byName = new Map(checks.map((check) => [check.name, check.level]));
  return {
    ingestion: maxLevel([
      byName.get("ingestion_success_rate") ?? "healthy",
      byName.get("extraction_success_rate") ?? "healthy",
    ]),
    review: maxLevel([byName.get("review_backlog") ?? "healthy"]),
    freshness: maxLevel([byName.get("source_freshness") ?? "healthy"]),
  };
}

function TabSeverityBadge({ level }: { level: HealthLevel }) {
  if (level === "healthy") return null;
  if (level === "critical") {
    return (
      <Badge variant="destructive" className="ml-1 text-[10px] leading-4 px-1.5 py-0.5">
        CRIT
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="ml-1 text-[10px] leading-4 px-1.5 py-0.5">
      WARN
    </Badge>
  );
}

export function CbaIntelligenceClient() {
  const { data: healthData } = useQuery<OperationalHealthResponse>({
    queryKey: ["cba-intel-operational-health"],
    queryFn: () => fetch("/api/cba-intelligence/health").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const tabHealth = deriveCbaTabHealth(healthData?.data?.checks ?? []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Institutional Labor Continuity Intelligence</h1>
          <p className="text-muted-foreground">
            Governance-safe continuity operations for agreement sources, ingestion, review, and institutional memory support
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        This surface supports continuity interpretation and stewardship operations. It does not
        issue authoritative labor rulings. Escalate governance-sensitive conclusions to human
        steward, committee, or executive review.
      </div>

      <OperationalHealthPanel />

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="ingestion">
            Ingestion
            <TabSeverityBadge level={tabHealth.ingestion} />
          </TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="review">
            Review
            <TabSeverityBadge level={tabHealth.review} />
          </TabsTrigger>
          <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
          <TabsTrigger value="freshness">
            Freshness
            <TabSeverityBadge level={tabHealth.freshness} />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sources">
          <SourceRegistryTable />
        </TabsContent>
        <TabsContent value="ingestion">
          <IngestionMonitor />
        </TabsContent>
        <TabsContent value="agreements">
          <AgreementExplorer />
        </TabsContent>
        <TabsContent value="review">
          <ReviewQueue />
        </TabsContent>
        <TabsContent value="benchmark">
          <BenchmarkView />
        </TabsContent>
        <TabsContent value="freshness">
          <FreshnessDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
