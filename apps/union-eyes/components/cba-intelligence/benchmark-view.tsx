"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { BenchmarkResult } from "@/lib/services/cba-intelligence/benchmark-service";
import { ApiShapeError, apiErrorMessage, envelopeData, failureText, readApiError } from "@/lib/client/api-envelope";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart3, Save } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A saved benchmark, as GET /api/cba-intelligence/benchmark/[id]?history=true answers (the snapshot's decimal columns arrive as text). */
interface BenchmarkHistory {
  id: string;
  snapshotVersion: number;
  comparableCount: number;
  medianWageIncrease: string | null;
  createdAt: string;
}

interface BenchmarkHistoryPage {
  items: BenchmarkHistory[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JURISDICTIONS = [
  "federal",
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
];

function formatPct(v: number | null | string): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `${n.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BenchmarkView({ canSaveSnapshot = false }: { canSaveSnapshot?: boolean }) {
  const t = useTranslations("benchmarkView");
  const [agreementId, setAgreementId] = useState("");
  const [jurisdiction, setJurisdiction] = useState("all");
  const [sector, setSector] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (jurisdiction !== "all") queryParams.set("jurisdiction", jurisdiction);
  if (sector) queryParams.set("sector", sector);

  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery<BenchmarkResult>({
    queryKey: ["cba-intel-benchmark", agreementId, jurisdiction, sector],
    // A refusal (an agreement that does not exist, an entitlement the organization lacks) is shown as it is stated, not retried.
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/cba-intelligence/benchmark/${agreementId}?${queryParams}`);
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(body, t("errorLoad")));
      const benchmark: BenchmarkResult = envelopeData(body) as unknown as BenchmarkResult;
      return benchmark;
    },
    enabled: !!agreementId,
  });

  const {
    data: history = [],
    error: historyError,
    refetch: refetchHistory,
  } = useQuery<BenchmarkHistory[]>({
    queryKey: ["cba-intel-benchmark-history", agreementId],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/cba-intelligence/benchmark/${agreementId}?history=true`);
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(body, t("errorHistory")));
      const page: BenchmarkHistoryPage = envelopeData(body) as unknown as BenchmarkHistoryPage;
      if (!Array.isArray(page.items)) throw new ApiShapeError("no snapshots");
      return page.items;
    },
    enabled: !!agreementId && showHistory,
  });

  // Saving a snapshot writes to the platform-wide dataset: it is a POST, and platform authority is checked by the route; the button is only offered to those who hold it.
  async function handleSaveSnapshot() {
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/cba-intelligence/benchmark/${agreementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jurisdiction: jurisdiction === "all" ? undefined : jurisdiction, sector: sector || undefined }),
      });

      if (!response.ok) {
        setSaveError(await readApiError(response, t("errorSave")));
        return;
      }

      setShowHistory(true);
      await refetchHistory();
    } catch {
      setSaveError(t("errorSave"));
    } finally {
      setIsSaving(false);
    }
  }

  // Build chart data from clause family coverage
  const clauseChartData = result?.clauseFamilyCoverage
    ? Object.entries(result.clauseFamilyCoverage)
        .map(([family, count]) => ({
          family: family.replace(/_/g, " "),
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {result?.insufficientData && (
          <Alert>
            <AlertDescription>
              Benchmark confidence is limited until at least {result.requiredComparables ?? 5} comparable agreements are available.
            </AlertDescription>
          </Alert>
        )}

        {/* Input controls */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 max-w-md">
            <label className="text-sm font-medium mb-1 block">{t("agreementId")}</label>
            <Input
              placeholder={t("agreementIdPlaceholder")}
              value={agreementId}
              onChange={(e) => setAgreementId(e.target.value.trim())}
            />
          </div>
          <Select value={jurisdiction} onValueChange={setJurisdiction}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("jurisdictionPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("jurisdictionAll")}</SelectItem>
              {JURISDICTIONS.map((j) => (
                <SelectItem key={j} value={j}>{j}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-45">
            <Input
              placeholder={t("sectorPlaceholder")}
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            />
          </div>
          <Button disabled={!agreementId} onClick={() => refetch()}>
            {t("runBenchmark")}
          </Button>
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            {t("computing")}
          </div>
        )}
        {error && (
          <div role="alert" className="text-center py-8 text-red-500">
            {failureText(error, t("errorLoad"))}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">{t("summary.comparables")}</div>
                  <div className="text-2xl font-bold">{result.comparableCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">{t("summary.wageP25")}</div>
                  <div className="text-2xl font-bold">{formatPct(result.wageIncreaseP25)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">{t("summary.wageP50")}</div>
                  <div className="text-2xl font-bold">{formatPct(result.medianWageIncrease)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">{t("summary.wageP75")}</div>
                  <div className="text-2xl font-bold">{formatPct(result.wageIncreaseP75)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">{t("summary.avgTerm")}</div>
                  <div className="text-2xl font-bold">
                    {result.avgTermMonths ? t("summary.monthsShort", { count: Math.round(result.avgTermMonths) }) : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Clause coverage chart */}
            {clauseChartData.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">{t("clauseCoverage")}</h4>
                <div className="h-75">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clauseChartData} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="family" type="category" width={110} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Comparable agreements */}
            {result.comparables.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">{t("comparableAgreements")}</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("table.agreement")}</TableHead>
                        <TableHead>{t("table.employer")}</TableHead>
                        <TableHead>{t("table.union")}</TableHead>
                        <TableHead>{t("table.jurisdiction")}</TableHead>
                        <TableHead>{t("table.match")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.comparables.map((c) => (
                        <TableRow key={c.agreementId}>
                          <TableCell className="font-medium">{c.title}</TableCell>
                          <TableCell>{c.employer}</TableCell>
                          <TableCell>{c.union}</TableCell>
                          <TableCell>{c.jurisdiction || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={c.comparability === "exact" ? "default" : "secondary"}>
                              {t(`comparability.${c.comparability}`)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {canSaveSnapshot && (
                <Button
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => void handleSaveSnapshot()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? t("computing") : t("actions.saveSnapshot")}
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? t("actions.hideHistory") : t("actions.showHistory")}
              </Button>
            </div>

            {saveError && (
              <div role="alert" className="text-sm text-red-500">
                {saveError}
              </div>
            )}

            {showHistory && historyError && (
              <div role="alert" className="text-sm text-red-500">
                {failureText(historyError, t("errorHistory"))}
              </div>
            )}

            {/* History */}
            {showHistory && history.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">{t("history.title")}</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("history.version")}</TableHead>
                        <TableHead>{t("history.comparables")}</TableHead>
                        <TableHead>{t("history.wageP50")}</TableHead>
                        <TableHead>{t("history.date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>{t("history.versionShort", { version: h.snapshotVersion })}</TableCell>
                          <TableCell>{h.comparableCount}</TableCell>
                          <TableCell>{formatPct(h.medianWageIncrease)}</TableCell>
                          <TableCell>
                            {new Date(h.createdAt).toLocaleDateString("en-CA")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
