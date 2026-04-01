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
import {
  Database,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (matching API response shape)
// ---------------------------------------------------------------------------

interface CbaIntelSource {
  id: string;
  slug: string;
  nameEn: string;
  nameFr?: string;
  sourceType: string;
  collectionMethod: string;
  trustTier: string;
  jurisdictions: string[];
  healthStatus: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  isActive: boolean;
  baseUrl?: string;
  adapterKey?: string;
}

interface SourceListResponse {
  success: boolean;
  data: {
    items: CbaIntelSource[];
    total: number;
    page: number;
    limit: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEALTH_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  healthy: { label: "Healthy", variant: "default", icon: CheckCircle2 },
  degraded: { label: "Degraded", variant: "secondary", icon: AlertTriangle },
  unreachable: { label: "Unreachable", variant: "destructive", icon: XCircle },
  unknown: { label: "Unknown", variant: "outline", icon: HelpCircle },
};

const TRUST_LABELS: Record<string, string> = {
  official: "Official",
  authoritative: "Authoritative",
  curated: "Curated",
  unverified: "Unverified",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SourceRegistryTable() {
  const [page, setPage] = useState(1);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const queryParams = new URLSearchParams({ page: String(page), limit: "25" });
  if (sourceTypeFilter !== "all") queryParams.set("sourceType", sourceTypeFilter);
  if (healthFilter !== "all") queryParams.set("healthStatus", healthFilter);

  const { data, isLoading, error } = useQuery<SourceListResponse>({
    queryKey: ["cba-intel-sources", page, sourceTypeFilter, healthFilter],
    queryFn: () =>
      fetch(`/api/cba-intelligence/sources?${queryParams}`).then((r) => r.json()),
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  // Client-side name filter
  const filtered = searchTerm
    ? items.filter(
        (s) =>
          s.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.slug.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : items;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Source Registry
            </CardTitle>
            <CardDescription>
              Registered CBA data sources with health tracking and provenance metadata
            </CardDescription>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sources..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Source type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="federal_labour">Federal Labour</SelectItem>
              <SelectItem value="provincial_labour_board">Provincial LRB</SelectItem>
              <SelectItem value="provincial_ministry">Provincial Ministry</SelectItem>
              <SelectItem value="quebec_labour">Québec Labour</SelectItem>
              <SelectItem value="legal_arbitration">Legal/Arbitration</SelectItem>
              <SelectItem value="stats_benchmark">Stats/Benchmark</SelectItem>
            </SelectContent>
          </Select>
          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All health</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="unreachable">Unreachable</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Trust</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Last Success</TableHead>
                <TableHead>Failures</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading sources...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-red-500">
                    Failed to load sources
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No sources found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((source) => {
                  const health = HEALTH_CONFIG[source.healthStatus] ?? HEALTH_CONFIG.unknown;
                  const HealthIcon = health.icon;
                  return (
                    <TableRow key={source.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{source.nameEn}</div>
                          <div className="text-sm text-muted-foreground">
                            {source.jurisdictions?.join(", ") || "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {source.sourceType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {TRUST_LABELS[source.trustTier] ?? source.trustTier}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={health.variant} className="gap-1">
                          <HealthIcon className="h-3 w-3" />
                          {health.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(source.lastSuccessAt)}
                      </TableCell>
                      <TableCell>
                        {source.consecutiveFailures > 0 ? (
                          <Badge variant="destructive">{source.consecutiveFailures}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.isActive ? "default" : "secondary"}>
                          {source.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {source.baseUrl && (
                          <a
                            href={source.baseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              {total} source{total !== 1 ? "s" : ""} total
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm py-1.5">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
