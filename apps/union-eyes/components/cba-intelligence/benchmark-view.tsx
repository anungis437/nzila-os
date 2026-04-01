"use client";

import { useState } from "react";
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

interface ComparableAgreement {
  id: string;
  title: string;
  employer: string | null;
  unionName: string | null;
  jurisdiction: string | null;
  sector: string | null;
  matchScore: number;
}

interface BenchmarkResult {
  targetAgreementId: string;
  comparableCount: number;
  comparables: ComparableAgreement[];
  wageIncreaseP25: number | null;
  wageIncreaseP50: number | null;
  wageIncreaseP75: number | null;
  medianWageIncrease: number | null;
  avgTermMonths: number | null;
  clauseFamilyCoverage: Record<string, number>;
}

interface BenchmarkResponse {
  success: boolean;
  data: BenchmarkResult;
}

interface BenchmarkHistory {
  id: string;
  snapshotVersion: number;
  comparableCount: number;
  wageIncreaseP50: string | null;
  medianWageIncrease: string | null;
  createdAt: string;
}

interface BenchmarkHistoryResponse {
  success: boolean;
  data: BenchmarkHistory[];
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

export function BenchmarkView() {
  const [agreementId, setAgreementId] = useState("");
  const [jurisdiction, setJurisdiction] = useState("all");
  const [sector, setSector] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const queryParams = new URLSearchParams();
  if (jurisdiction !== "all") queryParams.set("jurisdiction", jurisdiction);
  if (sector) queryParams.set("sector", sector);

  const {
    data: benchmarkData,
    isLoading,
    error,
    refetch,
  } = useQuery<BenchmarkResponse>({
    queryKey: ["cba-intel-benchmark", agreementId, jurisdiction, sector],
    queryFn: () =>
      fetch(
        `/api/cba-intelligence/benchmark/${agreementId}?${queryParams}`,
      ).then((r) => r.json()),
    enabled: !!agreementId,
  });

  const { data: historyData } = useQuery<BenchmarkHistoryResponse>({
    queryKey: ["cba-intel-benchmark-history", agreementId],
    queryFn: () =>
      fetch(
        `/api/cba-intelligence/benchmark/${agreementId}?history=true`,
      ).then((r) => r.json()),
    enabled: !!agreementId && showHistory,
  });

  const result = benchmarkData?.data;
  const history = historyData?.data ?? [];

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
          Benchmark Analysis
        </CardTitle>
        <CardDescription>
          Compare agreements against comparable CBAs by jurisdiction, sector, and union
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input controls */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 max-w-md">
            <label className="text-sm font-medium mb-1 block">Agreement ID</label>
            <Input
              placeholder="Paste agreement UUID..."
              value={agreementId}
              onChange={(e) => setAgreementId(e.target.value.trim())}
            />
          </div>
          <Select value={jurisdiction} onValueChange={setJurisdiction}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Jurisdiction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {JURISDICTIONS.map((j) => (
                <SelectItem key={j} value={j}>{j}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-[180px]">
            <Input
              placeholder="Sector filter..."
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            />
          </div>
          <Button disabled={!agreementId} onClick={() => refetch()}>
            Run Benchmark
          </Button>
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            Computing benchmark...
          </div>
        )}
        {error && (
          <div className="text-center py-8 text-red-500">
            Failed to compute benchmark
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Comparables</div>
                  <div className="text-2xl font-bold">{result.comparableCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Wage P25</div>
                  <div className="text-2xl font-bold">{formatPct(result.wageIncreaseP25)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Wage P50 (Median)</div>
                  <div className="text-2xl font-bold">{formatPct(result.wageIncreaseP50)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Wage P75</div>
                  <div className="text-2xl font-bold">{formatPct(result.wageIncreaseP75)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Avg Term</div>
                  <div className="text-2xl font-bold">
                    {result.avgTermMonths ? `${Math.round(result.avgTermMonths)}mo` : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Clause coverage chart */}
            {clauseChartData.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Clause Family Coverage</h4>
                <div className="h-[300px]">
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
                <h4 className="font-semibold mb-2">Comparable Agreements</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agreement</TableHead>
                        <TableHead>Employer</TableHead>
                        <TableHead>Union</TableHead>
                        <TableHead>Jurisdiction</TableHead>
                        <TableHead>Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.comparables.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.title}</TableCell>
                          <TableCell>{c.employer ?? "—"}</TableCell>
                          <TableCell>{c.unionName ?? "—"}</TableCell>
                          <TableCell>{c.jurisdiction ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={c.matchScore >= 80 ? "default" : c.matchScore >= 50 ? "secondary" : "outline"}
                            >
                              {c.matchScore}%
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
              <Button
                variant="outline"
                onClick={() =>
                  fetch(`/api/cba-intelligence/benchmark/${agreementId}?save=true&${queryParams}`)
                }
              >
                <Save className="h-4 w-4 mr-2" />
                Save Snapshot
              </Button>
              <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? "Hide History" : "Show History"}
              </Button>
            </div>

            {/* History */}
            {showHistory && history.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Snapshot History</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Comparables</TableHead>
                        <TableHead>Wage P50</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>v{h.snapshotVersion}</TableCell>
                          <TableCell>{h.comparableCount}</TableCell>
                          <TableCell>{formatPct(h.wageIncreaseP50)}</TableCell>
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
