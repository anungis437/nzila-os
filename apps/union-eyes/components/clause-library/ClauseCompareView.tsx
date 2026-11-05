"use client";

/**
 * Phase 5B: Clause Compare View Component
 * Side-by-side comparison of 2-10 clauses with analysis
 */

import { useState } from "react";
import { format } from "date-fns";
import { recordedDay } from "@/lib/client/day";
import { X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface CompareClause {
  id: string;
  clauseNumber?: string;
  clauseTitle: string;
  clauseText: string;
  clauseType: string;
  sector?: string;
  province?: string;
  effectiveDate?: string;
  expiryDate?: string;
  sharingLevel: string;
  /** Absent when the clause is anonymized and shared by another organization: its source is not disclosed (lib/clause-library/source-projection.ts). */
  sourceOrganization?: {
    id: string;
    organizationName: string | null;
  };
  tags?: Array<{ tagName: string }>;
}

interface ComparisonAnalysis {
  commonKeywords: string[];
  differences: {
    clauseTypes: string[];
    sectors: string[];
    provinces: string[];
    dateRanges: string;
    sharingLevels: string[];
  };
  statistics: {
    totalClauses: number;
    averageTextLength: number;
    uniqueTypes: number;
    uniqueSectors: number;
    uniqueProvinces: number;
  };
}

interface ClauseCompareViewProps {
  clauses: CompareClause[];
  analysis?: ComparisonAnalysis;
  onRemoveClause: (clauseId: string) => void;
  onExport?: () => void;
  comparisonNotes?: string;
  onNotesChange?: (notes: string) => void;
}

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  wages: "Wages",
  benefits: "Benefits",
  hours_of_work: "Hours",
  overtime: "Overtime",
  vacation: "Vacation",
  sick_leave: "Sick Leave",
  grievance_procedure: "Grievance",
  discipline: "Discipline",
  seniority: "Seniority",
  health_safety: "H&S",
  job_security: "Job Security",
  pension: "Pension",
  other: "Other",
};

const ANONYMIZED_SOURCE = "Anonymized";

export function ClauseCompareView({
  clauses,
  analysis,
  onRemoveClause,
  onExport,
  comparisonNotes,
  onNotesChange,
}: ClauseCompareViewProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const maxScroll = Math.max(0, clauses.length - 2);

  const visibleClauses = clauses.slice(scrollPosition, scrollPosition + 2);

  const handleScrollLeft = () => {
    setScrollPosition(Math.max(0, scrollPosition - 1));
  };

  const handleScrollRight = () => {
    setScrollPosition(Math.min(maxScroll, scrollPosition + 1));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clause Comparison</h2>
          <p className="text-sm text-muted-foreground">
            Comparing {clauses.length} clause{clauses.length !== 1 ? "s" : ""}
          </p>
        </div>
        {onExport && (
          <Button variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        )}
      </div>

      {/* Analysis Summary */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statistics */}
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <div className="text-2xl font-bold">{analysis.statistics.totalClauses}</div>
                <div className="text-xs text-muted-foreground">Clauses</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{analysis.statistics.averageTextLength}</div>
                <div className="text-xs text-muted-foreground">Avg. Length</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{analysis.statistics.uniqueTypes}</div>
                <div className="text-xs text-muted-foreground">Unique Types</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{analysis.statistics.uniqueSectors}</div>
                <div className="text-xs text-muted-foreground">Sectors</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{analysis.statistics.uniqueProvinces}</div>
                <div className="text-xs text-muted-foreground">Provinces</div>
              </div>
            </div>

            <Separator />

            {/* Common Keywords */}
            {analysis.commonKeywords.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Common Keywords</div>
                <div className="flex flex-wrap gap-2">
                  {analysis.commonKeywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Differences */}
            <div>
              <div className="text-sm font-medium mb-2">Key Differences</div>
              <div className="space-y-2 text-sm">
                {analysis.differences.clauseTypes.length > 1 && (
                  <div>
                    <span className="font-medium">Types:</span>{" "}
                    {analysis.differences.clauseTypes.join(", ")}
                  </div>
                )}
                {analysis.differences.sectors.length > 1 && (
                  <div>
                    <span className="font-medium">Sectors:</span>{" "}
                    {analysis.differences.sectors.join(", ")}
                  </div>
                )}
                {analysis.differences.provinces.length > 1 && (
                  <div>
                    <span className="font-medium">Provinces:</span>{" "}
                    {analysis.differences.provinces.join(", ")}
                  </div>
                )}
                {analysis.differences.dateRanges && (
                  <div>
                    <span className="font-medium">Date Range:</span>{" "}
                    {analysis.differences.dateRanges}
                  </div>
                )}
                {analysis.differences.sharingLevels.length > 1 && (
                  <div>
                    <span className="font-medium">Sharing Levels:</span>{" "}
                    {analysis.differences.sharingLevels.join(", ")}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Notes */}
      {onNotesChange && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={comparisonNotes || ""}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add notes about this comparison..."
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {/* Side-by-Side Comparison */}
      <div className="relative">
        {/* Scroll Controls */}
        {clauses.length > 2 && (
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScrollLeft}
              disabled={scrollPosition === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Showing {scrollPosition + 1}-{Math.min(scrollPosition + 2, clauses.length)} of{" "}
              {clauses.length}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScrollRight}
              disabled={scrollPosition >= maxScroll}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Comparison Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {visibleClauses.map((clause) => (
            <Card key={clause.id} className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6"
                onClick={() => onRemoveClause(clause.id)}
              >
                <X className="h-4 w-4" />
              </Button>

              <CardHeader className="pr-10">
                <div className="space-y-2">
                  <CardTitle className="text-lg">
                    {clause.clauseNumber && (
                      <span className="text-muted-foreground mr-2">
                        {clause.clauseNumber}
                      </span>
                    )}
                    {clause.clauseTitle}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {CLAUSE_TYPE_LABELS[clause.clauseType] || clause.clauseType}
                    </Badge>
                    <Badge variant="secondary">{clause.sharingLevel}</Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Organization */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Organization
                  </div>
                  <div className="text-sm">{clause.sourceOrganization?.organizationName ?? ANONYMIZED_SOURCE}</div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {clause.sector && (
                    <div>
                      <div className="text-xs text-muted-foreground">Sector</div>
                      <div>{clause.sector}</div>
                    </div>
                  )}
                  {clause.province && (
                    <div>
                      <div className="text-xs text-muted-foreground">Province</div>
                      <div>{clause.province}</div>
                    </div>
                  )}
                  {clause.effectiveDate && (
                    <div>
                      <div className="text-xs text-muted-foreground">Effective</div>
                      <div>{format(recordedDay(clause.effectiveDate), "MMM yyyy")}</div>
                    </div>
                  )}
                  {clause.expiryDate && (
                    <div>
                      <div className="text-xs text-muted-foreground">Expiry</div>
                      <div>{format(recordedDay(clause.expiryDate), "MMM yyyy")}</div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Clause Text */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Clause Text
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="text-sm whitespace-pre-wrap pr-4">
                      {clause.clauseText}
                    </div>
                  </ScrollArea>
                </div>

                {/* Tags */}
                {clause.tags && clause.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {clause.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag.tagName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comparison Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Attribute</th>
                  {clauses.map((clause) => (
                    <th key={clause.id} className="text-left py-2 font-medium">
                      {clause.clauseNumber || clause.clauseTitle.substring(0, 20)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Type</td>
                  {clauses.map((clause) => (
                    <td key={clause.id} className="py-2">
                      {CLAUSE_TYPE_LABELS[clause.clauseType] || clause.clauseType}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Organization</td>
                  {clauses.map((clause) => (
                    <td key={clause.id} className="py-2">
                      {clause.sourceOrganization?.organizationName ?? ANONYMIZED_SOURCE}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Sector</td>
                  {clauses.map((clause) => (
                    <td key={clause.id} className="py-2">
                      {clause.sector || "-"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Province</td>
                  {clauses.map((clause) => (
                    <td key={clause.id} className="py-2">
                      {clause.province || "-"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Effective Date</td>
                  {clauses.map((clause) => (
                    <td key={clause.id} className="py-2">
                      {clause.effectiveDate
                        ? format(recordedDay(clause.effectiveDate), "MMM d, yyyy")
                        : "-"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Sharing Level</td>
                  {clauses.map((clause) => (
                    <td key={clause.id} className="py-2">
                      <Badge variant="outline" className="text-xs">
                        {clause.sharingLevel}
                      </Badge>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 text-muted-foreground">Text Length</td>
                  {clauses.map((clause) => (
                    <td key={clause.id} className="py-2">
                      {clause.clauseText.length} chars
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

