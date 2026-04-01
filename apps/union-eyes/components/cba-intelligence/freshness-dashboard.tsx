"use client";

import { useQuery } from "@tanstack/react-query";
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
    label: string;
    color: string;
    chartColor: string;
    icon: typeof CheckCircle2;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  fresh: {
    label: "Fresh",
    color: "text-green-600",
    chartColor: "#22c55e",
    icon: CheckCircle2,
    variant: "default",
  },
  aging: {
    label: "Aging",
    color: "text-yellow-600",
    chartColor: "#eab308",
    icon: Clock,
    variant: "secondary",
  },
  stale: {
    label: "Stale",
    color: "text-orange-600",
    chartColor: "#f97316",
    icon: AlertTriangle,
    variant: "secondary",
  },
  expired: {
    label: "Expired",
    color: "text-red-600",
    chartColor: "#ef4444",
    icon: XCircle,
    variant: "destructive",
  },
  unknown: {
    label: "Unknown",
    color: "text-gray-500",
    chartColor: "#6b7280",
    icon: HelpCircle,
    variant: "outline",
  },
};

function formatDaysAgo(days: number | null): string {
  if (days === null) return "Never checked";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
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
          name: STATUS_CONFIG[k].label,
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
                    <div className="text-sm text-muted-foreground">{cfg.label}</div>
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
            <CardTitle className="text-base">Distribution</CardTitle>
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
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source list */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Source Freshness
            </CardTitle>
            <CardDescription>
              Last check times and document staleness per source
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading freshness data...
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                Failed to load freshness
              </div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active sources
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Freshness</TableHead>
                      <TableHead>Last Success</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Stale Docs</TableHead>
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
                              {cfg.label}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDaysAgo(s.daysSinceLastSuccess)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(s.lastSuccessAt)}
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
