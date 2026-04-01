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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  ChevronRight,
  Building2,
  MapPin,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Agreement {
  id: string;
  cbaNumber: string | null;
  title: string;
  employer: string | null;
  unionName: string | null;
  jurisdiction: string | null;
  sector: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  employeeCoverage: number | null;
  overallConfidence: number | null;
  reviewStatus: string;
  createdAt: string;
}

interface AgreementListResponse {
  success: boolean;
  data: {
    items: Agreement[];
    total: number;
    page: number;
    limit: number;
  };
}

interface AgreementDetail {
  id: string;
  cbaNumber: string | null;
  title: string;
  employer: string | null;
  unionName: string | null;
  jurisdiction: string | null;
  sector: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  employeeCoverage: number | null;
  overallConfidence: number | null;
  reviewStatus: string;
}

interface WageAdjustment {
  id: string;
  effectiveDate: string | null;
  year: number | null;
  adjustmentType: string;
  adjustmentPercent: string | null;
  adjustmentFlat: string | null;
  classification: string | null;
  confidence: number | null;
}

interface Clause {
  id: string;
  clauseFamily: string;
  clauseNumber: string | null;
  clauseTitle: string | null;
  summary: string | null;
  confidence: number | null;
  reviewStatus: string;
}

interface AgreementDetailResponse {
  success: boolean;
  data: {
    agreement: AgreementDetail;
    wageAdjustments: WageAdjustment[];
    clauses: Clause[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REVIEW_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
  needs_revision: "secondary",
  auto_approved: "default",
};

const JURISDICTIONS = [
  "federal",
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
];

function confidenceBadge(c: number | null) {
  if (c === null) return <Badge variant="outline">—</Badge>;
  const pct = Math.round(c * 100);
  if (pct >= 80) return <Badge variant="default">{pct}%</Badge>;
  if (pct >= 50) return <Badge variant="secondary">{pct}%</Badge>;
  return <Badge variant="destructive">{pct}%</Badge>;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA");
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function AgreementDetailPanel({
  agreementId,
  onClose,
}: {
  agreementId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<AgreementDetailResponse>({
    queryKey: ["cba-intel-agreement", agreementId],
    queryFn: () =>
      fetch(`/api/cba-intelligence/agreements/${agreementId}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading agreement details...
        </CardContent>
      </Card>
    );
  }

  const agreement = data?.data?.agreement;
  const wages = data?.data?.wageAdjustments ?? [];
  const clauses = data?.data?.clauses ?? [];

  if (!agreement) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{agreement.title}</CardTitle>
            <CardDescription>
              {agreement.cbaNumber && `CBA #${agreement.cbaNumber} · `}
              {agreement.jurisdiction} · {agreement.sector}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Back to list
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Employer</div>
            <div className="flex items-center gap-1 font-medium">
              <Building2 className="h-3.5 w-3.5" />
              {agreement.employer ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Union</div>
            <div className="flex items-center gap-1 font-medium">
              <Users className="h-3.5 w-3.5" />
              {agreement.unionName ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Coverage</div>
            <div className="font-medium">
              {agreement.employeeCoverage?.toLocaleString() ?? "—"} employees
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Term</div>
            <div className="font-medium">
              {formatDate(agreement.effectiveDate)} — {formatDate(agreement.expiryDate)}
            </div>
          </div>
        </div>

        {/* Wage Adjustments */}
        {wages.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Wage Adjustments ({wages.length})</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Adjustment</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wages.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{w.year ?? formatDate(w.effectiveDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{w.adjustmentType}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {w.adjustmentPercent
                          ? `${w.adjustmentPercent}%`
                          : w.adjustmentFlat
                            ? `$${w.adjustmentFlat}`
                            : "—"}
                      </TableCell>
                      <TableCell>{w.classification ?? "General"}</TableCell>
                      <TableCell>{confidenceBadge(w.confidence)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Clauses */}
        {clauses.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Clauses ({clauses.length})</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Family</TableHead>
                    <TableHead>Clause</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clauses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {c.clauseFamily.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.clauseNumber && `§${c.clauseNumber}`}
                        {c.clauseTitle && ` ${c.clauseTitle}`}
                        {!c.clauseNumber && !c.clauseTitle && "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">
                        {c.summary ?? "—"}
                      </TableCell>
                      <TableCell>{confidenceBadge(c.confidence)}</TableCell>
                      <TableCell>
                        <Badge variant={REVIEW_BADGE[c.reviewStatus] ?? "outline"}>
                          {c.reviewStatus.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AgreementExplorer() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [jurisdiction, setJurisdiction] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queryParams = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) queryParams.set("search", search);
  if (jurisdiction !== "all") queryParams.set("jurisdiction", jurisdiction);
  if (reviewStatus !== "all") queryParams.set("reviewStatus", reviewStatus);

  const { data, isLoading, error } = useQuery<AgreementListResponse>({
    queryKey: ["cba-intel-agreements", page, search, jurisdiction, reviewStatus],
    queryFn: () =>
      fetch(`/api/cba-intelligence/agreements?${queryParams}`).then((r) => r.json()),
  });

  if (selectedId) {
    return <AgreementDetailPanel agreementId={selectedId} onClose={() => setSelectedId(null)} />;
  }

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Agreement Explorer
        </CardTitle>
        <CardDescription>
          Browse and search extracted collective bargaining agreements
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agreements..."
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={jurisdiction} onValueChange={(v) => { setJurisdiction(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Jurisdiction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jurisdictions</SelectItem>
              {JURISDICTIONS.map((j) => (
                <SelectItem key={j} value={j}>{j}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reviewStatus} onValueChange={(v) => { setReviewStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Review" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reviews</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="needs_revision">Needs revision</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agreement</TableHead>
                <TableHead>Employer / Union</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Review</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading agreements...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-red-500">
                    Failed to load agreements
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No agreements found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedId(a.id)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{a.title}</div>
                        {a.cbaNumber && (
                          <div className="text-xs text-muted-foreground">#{a.cbaNumber}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {a.employer && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {a.employer}
                          </div>
                        )}
                        {a.unionName && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {a.unionName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{a.jurisdiction ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(a.effectiveDate)} — {formatDate(a.expiryDate)}
                    </TableCell>
                    <TableCell>{confidenceBadge(a.overallConfidence)}</TableCell>
                    <TableCell>
                      <Badge variant={REVIEW_BADGE[a.reviewStatus] ?? "outline"}>
                        {a.reviewStatus.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              {total} agreement{total !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm py-1.5">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
