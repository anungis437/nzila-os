"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Siren, ShieldCheck } from "lucide-react";

type HealthLevel = "healthy" | "warning" | "critical";

interface OperationalHealthResponse {
  success: boolean;
  data: {
    level: HealthLevel;
    generatedAt: string;
    throughput: {
      ingestionSuccessRate: number | null;
      extractionSuccessRate: number | null;
    };
    quality: {
      reviewBacklog: number;
      staleSources: number;
      expiredSources: number;
    };
    checks: Array<{
      name: string;
      level: HealthLevel;
      detail: string;
    }>;
  };
}

function toPct(value: number | null): string {
  if (value == null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function levelBadge(level: HealthLevel) {
  if (level === "healthy") return <Badge className="bg-green-600">Healthy</Badge>;
  if (level === "warning") return <Badge variant="secondary">Warning</Badge>;
  return <Badge variant="destructive">Critical</Badge>;
}

function levelIcon(level: HealthLevel) {
  if (level === "healthy") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (level === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  return <Siren className="h-4 w-4 text-red-600" />;
}

export function OperationalHealthPanel() {
  const { data, isLoading, error } = useQuery<OperationalHealthResponse>({
    queryKey: ["cba-intel-operational-health"],
    queryFn: () => fetch("/api/cba-intelligence/health").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const health = data?.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5" />
          Operational Health
          {health && levelBadge(health.level)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading health snapshot...</div>
        ) : error ? (
          <div className="text-sm text-red-600">Failed to load health snapshot.</div>
        ) : !health ? (
          <div className="text-sm text-muted-foreground">No health snapshot available.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Ingestion Success</div>
                <div className="text-lg font-semibold">{toPct(health.throughput.ingestionSuccessRate)}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Extraction Success</div>
                <div className="text-lg font-semibold">{toPct(health.throughput.extractionSuccessRate)}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Review Backlog</div>
                <div className="text-lg font-semibold">{health.quality.reviewBacklog}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Stale/Expired Sources</div>
                <div className="text-lg font-semibold">
                  {health.quality.staleSources}/{health.quality.expiredSources}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {health.checks.map((check) => (
                <div key={check.name} className="flex items-start gap-2 rounded border p-2 text-sm">
                  {levelIcon(check.level)}
                  <div>
                    <div className="font-medium">{check.name.replace(/_/g, " ")}</div>
                    <div className="text-muted-foreground">{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
