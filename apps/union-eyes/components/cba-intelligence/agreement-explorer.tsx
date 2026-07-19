"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  Download,
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
  const t = useTranslations("agreementExplorer");
  const { data, isLoading } = useQuery<AgreementDetailResponse>({
    queryKey: ["cba-intel-agreement", agreementId],
    queryFn: () =>
      fetch(`/api/cba-intelligence/agreements/${agreementId}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t("detail.loading")}
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
              {agreement.cbaNumber && `${t("detail.cbaPrefix", { number: agreement.cbaNumber })} · `}
              {agreement.jurisdiction} · {agreement.sector}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("detail.back")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">{t("detail.employer")}</div>
            <div className="flex items-center gap-1 font-medium">
              <Building2 className="h-3.5 w-3.5" />
              {agreement.employer ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t("detail.union")}</div>
            <div className="flex items-center gap-1 font-medium">
              <Users className="h-3.5 w-3.5" />
              {agreement.unionName ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t("detail.coverage")}</div>
            <div className="font-medium">
              {agreement.employeeCoverage != null ? t("detail.employees", { count: agreement.employeeCoverage }) : "—"}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t("detail.term")}</div>
            <div className="font-medium">
              {formatDate(agreement.effectiveDate)} — {formatDate(agreement.expiryDate)}
            </div>
          </div>
        </div>

        {/* Wage Adjustments */}
        {wages.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">{t("detail.wageAdjustments", { count: wages.length })}</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("detail.wageTable.year")}</TableHead>
                    <TableHead>{t("detail.wageTable.type")}</TableHead>
                    <TableHead>{t("detail.wageTable.adjustment")}</TableHead>
                    <TableHead>{t("detail.wageTable.classification")}</TableHead>
                    <TableHead>{t("detail.wageTable.confidence")}</TableHead>
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
                      <TableCell>{w.classification ?? t("detail.wageTable.general")}</TableCell>
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
            <h4 className="font-semibold mb-2">{t("detail.clauses", { count: clauses.length })}</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("detail.clauseTable.family")}</TableHead>
                    <TableHead>{t("detail.clauseTable.clause")}</TableHead>
                    <TableHead>{t("detail.clauseTable.summary")}</TableHead>
                    <TableHead>{t("detail.clauseTable.confidence")}</TableHead>
                    <TableHead>{t("detail.clauseTable.review")}</TableHead>
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
                      <TableCell className="max-w-75 truncate text-sm">
                        {c.summary ?? "—"}
                      </TableCell>
                      <TableCell>{confidenceBadge(c.confidence)}</TableCell>
                      <TableCell>
                        <Badge variant={REVIEW_BADGE[c.reviewStatus] ?? "outline"}>
                          {(['pending','approved','rejected','needs_revision','auto_approved'] as const).includes(c.reviewStatus as 'pending') ? t(`reviewStatuses.${c.reviewStatus}` as 'reviewStatuses.pending') : c.reviewStatus.replace(/_/g, ' ')}
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
  const t = useTranslations("agreementExplorer");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [jurisdiction, setJurisdiction] = useState("all");
  const [sector, setSector] = useState("");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queryParams = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) queryParams.set("search", search);
  if (jurisdiction !== "all") queryParams.set("jurisdiction", jurisdiction);
  if (sector) queryParams.set("sector", sector);
  if (reviewStatus !== "all") queryParams.set("reviewStatus", reviewStatus);

  const exportQueryParams = new URLSearchParams();
  if (search) exportQueryParams.set("search", search);
  if (jurisdiction !== "all") exportQueryParams.set("jurisdiction", jurisdiction);
  if (sector) exportQueryParams.set("sector", sector);
  if (reviewStatus !== "all") exportQueryParams.set("reviewStatus", reviewStatus);
  const exportHref = `/api/cba-intelligence/agreements/export${exportQueryParams.size > 0 ? `?${exportQueryParams.toString()}` : ""}`;

  const { data, isLoading, error } = useQuery<AgreementListResponse>({
    queryKey: ["cba-intel-agreements", page, search, jurisdiction, sector, reviewStatus],
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
          {t("title")}
        </CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={jurisdiction} onValueChange={(v) => { setJurisdiction(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("filters.jurisdictionPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allJurisdictions")}</SelectItem>
              {JURISDICTIONS.map((j) => (
                <SelectItem key={j} value={j}>{j}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t("filters.sectorPlaceholder")}
            className="w-45"
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setPage(1);
            }}
          />
          <Select value={reviewStatus} onValueChange={(v) => { setReviewStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("filters.reviewPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allReviews")}</SelectItem>
              <SelectItem value="pending">{t("reviewStatuses.pending")}</SelectItem>
              <SelectItem value="approved">{t("reviewStatuses.approved")}</SelectItem>
              <SelectItem value="rejected">{t("reviewStatuses.rejected")}</SelectItem>
              <SelectItem value="needs_revision">{t("reviewStatuses.needs_revision")}</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild variant="outline" className="ml-auto">
            <a href={exportHref} download>
              <Download className="mr-2 h-4 w-4" />
              {t("actions.exportCsv")}
            </a>
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.agreement")}</TableHead>
                <TableHead>{t("table.employerUnion")}</TableHead>
                <TableHead>{t("table.jurisdiction")}</TableHead>
                <TableHead>{t("table.term")}</TableHead>
                <TableHead>{t("table.confidence")}</TableHead>
                <TableHead>{t("table.review")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("loading")}
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-red-500">
                    {t("errorLoad")}
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("empty")}
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
                        {(['pending','approved','rejected','needs_revision','auto_approved'] as const).includes(a.reviewStatus as 'pending') ? t(`reviewStatuses.${a.reviewStatus}` as 'reviewStatuses.pending') : a.reviewStatus.replace(/_/g, ' ')}
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
              {t(total === 1 ? "pagination.count" : "pagination.countPlural", { count: total })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t("pagination.previous")}
              </Button>
              <span className="text-sm py-1.5">{t("pagination.pageOf", { page, total: totalPages })}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {t("pagination.next")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
