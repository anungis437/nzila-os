"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock, HelpCircle } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface SourceFreshness {
  sourceId: string;
  nameEn: string;
  healthStatus: string;
  freshnessStatus: string;
  daysSinceLastSuccess: number | null;
  documentCount: number;
  staleDocumentCount: number;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
}

interface FreshnessOverview {
  sources: SourceFreshness[];
  summary: {
    fresh: number;
    aging: number;
    stale: number;
    expired: number;
    unknown: number;
    total: number;
  };
}

interface FreshnessResponse {
  success: boolean;
  data: FreshnessOverview;
}

interface OperationalHealthResponse {
  success: boolean;
  data: {
    checks: Array<{
      name: string;
      level: "healthy" | "warning" | "critical";
      detail: string;
    }>;
  };
}

const STATUS_CONFIG: Record<
  string,
  {
    labelKey: "fresh" | "aging" | "stale" | "expired" | "unknown";
    color: string;
    chartColor: string;
    icon: typeof CheckCircle2;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  fresh: { labelKey: "fresh", color: "text-green-600", chartColor: "#22c55e", icon: CheckCircle2, variant: "default" },
  aging: { labelKey: "aging", color: "text-yellow-600", chartColor: "#eab308", icon: Clock, variant: "secondary" },
  stale: { labelKey: "stale", color: "text-orange-600", chartColor: "#f97316", icon: AlertTriangle, variant: "secondary" },
  expired: { labelKey: "expired", color: "text-red-600", chartColor: "#ef4444", icon: XCircle, variant: "destructive" },
  unknown: { labelKey: "unknown", color: "text-gray-500", chartColor: "#6b7280", icon: HelpCircle, variant: "outline" },
};

function formatDaysAgo(
  days: number | null,
  t: (key: string, vars?: Record<string, string | number | Date>) => string,
): string {
  if (days === null) return t("neverChecked");
  if (days === 0) return t("today");
  if (days === 1) return t("dayAgo");
  return t("daysAgo", { count: days });
}

function formatDate(
  dateStr: string | null,
  t: (key: string, vars?: Record<string, string | number | Date>) => string,
): string {
  if (!dateStr) return t("never");
  return new Date(dateStr).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDays(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function FreshnessDashboard() {
  const t = useTranslations("freshnessDashboard");
  const [draftAgingDays, setDraftAgingDays] = useState("14");
  const [draftStaleDays, setDraftStaleDays] = useState("30");
  const [draftExpiredDays, setDraftExpiredDays] = useState("90");
  const [agingDays, setAgingDays] = useState(14);
  const [staleDays, setStaleDays] = useState(30);
  const [expiredDays, setExpiredDays] = useState(90);

  const freshnessQuery = new URLSearchParams({
    agingDays: String(agingDays),
    staleDays: String(staleDays),
    expiredDays: String(expiredDays),
  });

  const { data, isLoading, error } = useQuery<FreshnessResponse>({
    queryKey: ["cba-intel-freshness", agingDays, staleDays, expiredDays],
    queryFn: () => fetch(`/api/cba-intelligence/freshness?${freshnessQuery}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: healthData } = useQuery<OperationalHealthResponse>({
    queryKey: ["cba-intel-operational-health"],
    queryFn: () => fetch("/api/cba-intelligence/health").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const overview = data?.data;
  const sources = overview?.sources ?? [];
  const summary = overview?.summary;
  const sourceFreshnessHealth = healthData?.data.checks.find((c) => c.name === "source_freshness");
  const showFreshnessAlert = sourceFreshnessHealth && sourceFreshnessHealth.level !== "healthy";

  const pieData = summary
    ? (["fresh", "aging", "stale", "expired", "unknown"] as const)
        .filter((key) => summary[key] > 0)
        .map((key) => ({
          name: t(`statuses.${key}` as "statuses.fresh"),
          value: summary[key],
          color: STATUS_CONFIG[key].chartColor,
        }))
    : [];

  function applyThresholds() {
    const nextAging = parseDays(draftAgingDays, 14);
    const nextStale = Math.max(parseDays(draftStaleDays, 30), nextAging + 1);
    const nextExpired = Math.max(parseDays(draftExpiredDays, 90), nextStale + 1);

    setAgingDays(nextAging);
    setStaleDays(nextStale);
    setExpiredDays(nextExpired);

    // Keep input controls aligned with the normalized values.
    setDraftAgingDays(String(nextAging));
    setDraftStaleDays(String(nextStale));
    setDraftExpiredDays(String(nextExpired));
  }

  function resetThresholds() {
    setDraftAgingDays("14");
    setDraftStaleDays("30");
    setDraftExpiredDays("90");
    setAgingDays(14);
    setStaleDays(30);
    setExpiredDays(90);
  }

  return (
    <div className="space-y-6">
      {showFreshnessAlert && (
        <Alert
          className={`${sourceFreshnessHealth.level === "critical" ? "border-red-300 text-red-700" : "border-yellow-300 text-yellow-700"}`}
          variant={sourceFreshnessHealth.level === "critical" ? "destructive" : "default"}
        >
          <AlertDescription>
            {sourceFreshnessHealth.detail}. Trigger focused refreshes for stale and expired sources before benchmark comparisons.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("thresholds.title")}</CardTitle>
          <CardDescription>{t("thresholds.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto] md:items-end">
          <div>
            <label htmlFor="freshness-aging-days" className="mb-1 block text-sm font-medium">{t("thresholds.agingDays")}</label>
            <Input id="freshness-aging-days" type="number" min={1} value={draftAgingDays} onChange={(e) => setDraftAgingDays(e.target.value)} />
          </div>
          <div>
            <label htmlFor="freshness-stale-days" className="mb-1 block text-sm font-medium">{t("thresholds.staleDays")}</label>
            <Input id="freshness-stale-days" type="number" min={1} value={draftStaleDays} onChange={(e) => setDraftStaleDays(e.target.value)} />
          </div>
          <div>
            <label htmlFor="freshness-expired-days" className="mb-1 block text-sm font-medium">{t("thresholds.expiredDays")}</label>
            <Input id="freshness-expired-days" type="number" min={1} value={draftExpiredDays} onChange={(e) => setDraftExpiredDays(e.target.value)} />
          </div>
          <Button onClick={applyThresholds}>{t("thresholds.apply")}</Button>
          <Button variant="outline" onClick={resetThresholds}>{t("thresholds.reset")}</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(["fresh", "aging", "stale", "expired", "unknown"] as const).map((key) => {
          const cfg = STATUS_CONFIG[key];
          const Icon = cfg.icon;
          const count = summary?.[key] ?? 0;
          return (
            <Card key={key}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                  <div>
                    <div className="text-sm text-muted-foreground">{t(`statuses.${cfg.labelKey}` as "statuses.fresh")}</div>
                    <div className="text-2xl font-bold">{count}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("distribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-62.5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">{t("noData")}</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {t("sourceFreshness")}
            </CardTitle>
            <CardDescription>{t("sourceDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">{t("loading")}</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">{t("loadError")}</div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t("noSources")}</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.source")}</TableHead>
                      <TableHead>{t("table.freshness")}</TableHead>
                      <TableHead>{t("table.lastSuccess")}</TableHead>
                      <TableHead>{t("table.documents")}</TableHead>
                      <TableHead>{t("table.staleDocs")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((source) => {
                      const cfg = STATUS_CONFIG[source.freshnessStatus] ?? STATUS_CONFIG.unknown;
                      const Icon = cfg.icon;
                      return (
                        <TableRow key={source.sourceId}>
                          <TableCell className="font-medium">{source.nameEn}</TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {t(`statuses.${cfg.labelKey}` as "statuses.fresh")}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDaysAgo(source.daysSinceLastSuccess, t)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(source.lastSuccessAt, t)}</TableCell>
                          <TableCell className="text-sm">{source.documentCount}</TableCell>
                          <TableCell>
                            {source.staleDocumentCount > 0 ? (
                              <Badge variant="destructive">{source.staleDocumentCount}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">0</span>
                            )}
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
      </div>
    </div>
  );
}
