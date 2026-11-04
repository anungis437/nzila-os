"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { CbaIntelAgreement, CbaIntelClause, CbaIntelWageAdjustment } from "@/lib/services/cba-intelligence/extraction-service";
import { ApiShapeError, apiErrorMessage, envelopeData, failureText } from "@/lib/client/api-envelope";
import { formatDay } from "@/lib/client/day";
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

/** A row as it arrives in JSON: dates are text (the decimal columns are text already). Typed from the rows the services return, so a field the table does not have is not one a screen can name. */
type Wire<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

type Agreement = Wire<CbaIntelAgreement>;
type WageAdjustment = Wire<CbaIntelWageAdjustment>;
type Clause = Wire<CbaIntelClause>;

interface AgreementPage {
  items: Agreement[];
  total: number;
  page: number;
  limit: number;
}

interface AgreementDetail {
  agreement: Agreement;
  wageAdjustments: WageAdjustment[];
  clauses: Clause[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The statuses a row is reviewed into (cba_intel_review_status). A reader of the dataset only ever sees `approved`; the others are the curators'. */
const REVIEW_STATUSES = ["pending_review", "approved", "rejected", "needs_followup", "superseded"] as const;

const REVIEW_BADGE: Record<(typeof REVIEW_STATUSES)[number], "default" | "secondary" | "destructive" | "outline"> = {
  pending_review: "outline",
  approved: "default",
  rejected: "destructive",
  needs_followup: "secondary",
  superseded: "secondary",
};

const JURISDICTIONS = [
  "federal",
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
];

/** A decimal column arrives as text; null when there is none or it is not a number. */
function asNumber(value: string | null): number | null {
  if (value === null || value === "" || Number.isNaN(Number(value))) return null;
  return Number(value);
}

function confidenceBadge(value: string | null) {
  const c = asNumber(value);
  if (c === null) return <Badge variant="outline">—</Badge>;
  const pct = Math.round(c * 100);
  if (pct >= 80) return <Badge variant="default">{pct}%</Badge>;
  if (pct >= 50) return <Badge variant="secondary">{pct}%</Badge>;
  return <Badge variant="destructive">{pct}%</Badge>;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return formatDay(d, "en-CA", "numeric");
}

function ReviewBadge({ status }: { status: string | null }) {
  const t = useTranslations("agreementExplorer");
  const known = REVIEW_STATUSES.find((value) => value === status);
  return <Badge variant={known ? REVIEW_BADGE[known] : "outline"}>{known ? t(`reviewStatuses.${known}`) : (status ?? "—")}</Badge>;
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
  const { data, isLoading, error } = useQuery<AgreementDetail>({
    queryKey: ["cba-intel-agreement", agreementId],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/cba-intelligence/agreements/${agreementId}`);
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(body, t("errorLoad")));
      const detail: AgreementDetail = envelopeData(body) as unknown as AgreementDetail;
      if (!detail.agreement) throw new ApiShapeError("no agreement");
      return detail;
    },
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

  if (error || !data) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <div role="alert" className="text-red-500">{failureText(error, t("errorLoad"))}</div>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("detail.back")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { agreement, wageAdjustments: wages, clauses } = data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{agreement.title}</CardTitle>
            <CardDescription>
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
              {agreement.employerNormalized}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t("detail.union")}</div>
            <div className="flex items-center gap-1 font-medium">
              <Users className="h-3.5 w-3.5" />
              {agreement.unionNormalized}
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
                        {c.title && ` ${c.title}`}
                        {!c.clauseNumber && !c.title && "—"}
                      </TableCell>
                      <TableCell className="max-w-75 truncate text-sm">
                        {c.summary ?? "—"}
                      </TableCell>
                      <TableCell>{confidenceBadge(c.confidence)}</TableCell>
                      <TableCell>
                        <ReviewBadge status={c.reviewStatus} />
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

export function AgreementExplorer({ canCurate = false }: { canCurate?: boolean }) {
  const t = useTranslations("agreementExplorer");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [jurisdiction, setJurisdiction] = useState("all");
  const [sector, setSector] = useState("");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Only the platform staff who curate the dataset may name a review status: every other reader is shown approved agreements, whatever is asked for.
  const status = canCurate && reviewStatus !== "all" ? reviewStatus : null;

  const queryParams = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) queryParams.set("search", search);
  if (jurisdiction !== "all") queryParams.set("jurisdiction", jurisdiction);
  if (sector) queryParams.set("sector", sector);
  if (status) queryParams.set("reviewStatus", status);

  const exportQueryParams = new URLSearchParams();
  if (search) exportQueryParams.set("search", search);
  if (jurisdiction !== "all") exportQueryParams.set("jurisdiction", jurisdiction);
  if (sector) exportQueryParams.set("sector", sector);
  if (status) exportQueryParams.set("reviewStatus", status);
  const exportHref = `/api/cba-intelligence/agreements/export${exportQueryParams.size > 0 ? `?${exportQueryParams.toString()}` : ""}`;

  const { data, isLoading, error } = useQuery<AgreementPage>({
    queryKey: ["cba-intel-agreements", page, search, jurisdiction, sector, status],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/cba-intelligence/agreements?${queryParams}`);
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(body, t("errorLoad")));
      const agreements: AgreementPage = envelopeData(body) as unknown as AgreementPage;
      if (!Array.isArray(agreements.items)) throw new ApiShapeError("no agreements");
      return agreements;
    },
  });

  if (selectedId) {
    return <AgreementDetailPanel agreementId={selectedId} onClose={() => setSelectedId(null)} />;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
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
          {canCurate && (
            <Select value={reviewStatus} onValueChange={(v) => { setReviewStatus(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("filters.reviewPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allReviews")}</SelectItem>
                {REVIEW_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>{t(`reviewStatuses.${value}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
                  <TableCell colSpan={7} role="alert" className="text-center py-8 text-red-500">
                    {failureText(error, t("errorLoad"))}
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
                      <div className="font-medium">{a.title}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {a.employerNormalized}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {a.unionNormalized}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{a.jurisdiction}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(a.effectiveDate)} — {formatDate(a.expiryDate)}
                    </TableCell>
                    <TableCell>{confidenceBadge(a.overallConfidence)}</TableCell>
                    <TableCell>
                      <ReviewBadge status={a.reviewStatus} />
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
