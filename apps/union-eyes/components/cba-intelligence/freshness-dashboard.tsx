"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  {
    labelKey: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
    color: string;
    chartColor: string;
    icon: typeof CheckCircle2;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  fresh: {
    labelKey: "fresh",
    color: "text-green-600",
    chartColor: "#22c55e",
    icon: CheckCircle2,
    variant: "default",
  },
  aging: {
    labelKey: "aging",
    color: "text-yellow-600",
    chartColor: "#eab308",
    icon: Clock,
    variant: "secondary",
  },
  stale: {
    labelKey: "stale",
    color: "text-orange-600",
    chartColor: "#f97316",
    icon: AlertTriangle,
    variant: "secondary",
  },
  expired: {
    labelKey: "expired",
    color: "text-red-600",
    chartColor: "#ef4444",
    icon: XCircle,
    variant: "destructive",
  },
  unknown: {
    labelKey: "unknown",
    color: "text-gray-500",
    chartColor: "#6b7280",
    icon: HelpCircle,
    variant: "outline",
  },
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FreshnessDashboard() {
  const t = useTranslations("freshnessDashboard");
  const { data, isLoading, error } = useQuery<FreshnessResponse>({
    queryKey: ["cba-intel-freshness"],
    queryFn: () =>
      fetch("/api/cba-intelligence/freshness").then((r) => r.json()),
    refetchInterval: 60_000, // Refresh every minute
  });

  const overview = data?.data;
  const sources = overview?.sources ?? [];
  const summary = overview?.summary;

  // Pie chart data
  const pieData = summary
    ? (["fresh", "aging", "stale", "expired", "unknown"] as const)
        .filter((k) => summary[k] > 0)
        .map((k) => ({
          name: t(`statuses.${k}` as 'statuses.fresh'),
          value: summary[k],
          color: STATUS_CONFIG[k].chartColor,
        }))
    : [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
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
                    <div className="text-sm text-muted-foreground">{t(`statuses.${cfg.labelKey}` as 'statuses.fresh')}</div>
                    <div className="text-2xl font-bold">{count}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("distribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-[250px]">
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
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t("noData")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source list */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {t("sourceFreshness")}
            </CardTitle>
            <CardDescription>
              {t("sourceDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("loading")}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                {t("loadError")}
              </div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("noSources")}
              </div>
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
                    {sources.map((s) => {
                      const cfg = STATUS_CONFIG[s.freshnessStatus] ?? STATUS_CONFIG.unknown;
                      const Icon = cfg.icon;
                      return (
                        <TableRow key={s.sourceId}>
                          <TableCell className="font-medium">{s.nameEn}</TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {t(`statuses.${cfg.labelKey}` as 'statuses.fresh')}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDaysAgo(s.daysSinceLastSuccess, t)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(s.lastSuccessAt, t)}
                          </TableCell>
                          <TableCell className="text-sm">{s.documentCount}</TableCell>
                          <TableCell>
                            {s.staleDocumentCount > 0 ? (
                              <Badge variant="destructive">{s.staleDocumentCount}</Badge>
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
