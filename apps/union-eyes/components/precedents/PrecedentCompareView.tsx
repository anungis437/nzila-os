"use client";

/**
 * Side-by-side comparison of 2 to 10 decisions, as the console read them (see precedent-comparison.ts).
 *
 * Two decisions are shown at a time, with the rest one step away, and a table lines all of them up. A value a decision does not have is
 * shown as unavailable, never filled in, and a row no decision has a value for is left out. Nothing is analysed here: no analysis is
 * computed anywhere, so none is shown. Every word comes from the message catalogs (the `precedents` namespace).
 */
import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  decisionTypeLabel,
  issueTypeLabel,
  jurisdictionLabel,
  outcomeColor,
  outcomeLabel,
  precedentValueLabel,
  tribunalLabel,
} from "@/components/precedents/precedent-filters";
import { formatDay } from "@/components/precedents/precedent-format";
import type { PrecedentRecord } from "@/components/precedents/precedent-record";

const VISIBLE = 2;

interface PrecedentCompareViewProps {
  precedents: PrecedentRecord[];
  onRemovePrecedent: (precedentId: string) => void;
  onExport?: () => void;
  comparisonNotes?: string;
  onNotesChange?: (notes: string) => void;
}

const nameOf = (precedent: PrecedentRecord): string => precedent.caseNumber ?? precedent.caseTitle ?? precedent.id;

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ScrollingText({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
      <ScrollArea className="h-[150px]">
        <div className="whitespace-pre-wrap pr-4 text-sm">{text}</div>
      </ScrollArea>
    </div>
  );
}

export function PrecedentCompareView({ precedents, onRemovePrecedent, onExport, comparisonNotes, onNotesChange }: PrecedentCompareViewProps) {
  const t = useTranslations("precedents");
  const format = useFormatter();
  const [scrollPosition, setScrollPosition] = useState(0);
  const maxScroll = Math.max(0, precedents.length - VISIBLE);
  // A decision removed from the end can leave the window past the last step; it is brought back so that no decision is out of reach.
  const first = Math.min(scrollPosition, maxScroll);
  const visiblePrecedents = precedents.slice(first, first + VISIBLE);

  const unavailable = (
    <span>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t("comparison.notAvailable")}</span>
    </span>
  );
  const day = (value: string | undefined) => (value ? formatDay(format, value) : undefined);

  const rows: Array<{ key: string; label: string; cell: (precedent: PrecedentRecord) => ReactNode | undefined }> = [
    { key: "issueTypes", label: t("fields.issueTypes"), cell: (p) => p.issueTypes?.map(issueTypeLabel).join(", ") },
    {
      key: "outcome",
      label: t("fields.outcome"),
      cell: (p) =>
        p.outcome ? (
          <Badge variant="outline" className={outcomeColor(p.outcome)}>
            {outcomeLabel(p.outcome, t)}
          </Badge>
        ) : undefined,
    },
    { key: "jurisdiction", label: t("fields.jurisdiction"), cell: (p) => (p.jurisdiction ? jurisdictionLabel(p.jurisdiction, t) : undefined) },
    { key: "tribunal", label: t("fields.tribunal"), cell: (p) => (p.tribunal ? tribunalLabel(p.tribunal, t) : undefined) },
    { key: "decisionType", label: t("fields.decisionType"), cell: (p) => (p.decisionType ? decisionTypeLabel(p.decisionType, t) : undefined) },
    { key: "arbitrator", label: t("fields.arbitrator"), cell: (p) => p.arbitrator },
    { key: "union", label: t("fields.union"), cell: (p) => p.union },
    { key: "employer", label: t("fields.employer"), cell: (p) => p.employer },
    { key: "decisionDate", label: t("fields.decisionDate"), cell: (p) => day(p.decisionDate) },
    {
      key: "precedentValue",
      label: t("fields.precedentValue"),
      cell: (p) => (p.precedentValue ? precedentValueLabel(p.precedentValue, t) : undefined),
    },
    { key: "sector", label: t("fields.sector"), cell: (p) => p.sector },
    { key: "views", label: t("fields.views"), cell: (p) => p.viewCount },
    { key: "citations", label: t("fields.citations"), cell: (p) => p.citationCount },
  ];
  const shownRows = rows.filter((row) => precedents.some((precedent) => row.cell(precedent) !== undefined));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("comparison.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("comparison.comparing", { count: precedents.length })}</p>
        </div>
        {onExport && (
          <Button variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            {t("comparison.exportReport")}
          </Button>
        )}
      </div>

      {onNotesChange && (
        <Card>
          <CardHeader>
            <CardTitle>{t("comparison.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              aria-label={t("comparison.notes")}
              value={comparisonNotes ?? ""}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={t("comparison.notesPlaceholder")}
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      <div className="relative">
        {precedents.length > VISIBLE && (
          <div className="mb-4 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setScrollPosition(Math.max(0, first - 1))} disabled={first === 0}>
              <ChevronLeft className="h-4 w-4" />
              {t("previous")}
            </Button>
            <div className="text-sm text-muted-foreground">
              {t("comparison.showing", { from: first + 1, to: Math.min(first + VISIBLE, precedents.length), total: precedents.length })}
            </div>
            <Button variant="outline" size="sm" onClick={() => setScrollPosition(Math.min(maxScroll, first + 1))} disabled={first >= maxScroll}>
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {visiblePrecedents.map((precedent) => (
            <Card key={precedent.id} className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6"
                aria-label={t("comparison.remove", { name: nameOf(precedent) })}
                onClick={() => onRemovePrecedent(precedent.id)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>

              <CardHeader className="pr-10">
                <div className="space-y-2">
                  <CardTitle className="text-lg">
                    {precedent.caseNumber && <span className="mr-2 text-muted-foreground">{precedent.caseNumber}</span>}
                    {precedent.caseTitle}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {precedent.issueTypes?.map((issueType) => (
                      <Badge key={issueType} variant="outline">
                        {issueTypeLabel(issueType)}
                      </Badge>
                    ))}
                    {precedent.outcome && <Badge className={outcomeColor(precedent.outcome)}>{outcomeLabel(precedent.outcome, t)}</Badge>}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {precedent.decisionDate && <Detail label={t("fields.decisionDate")}>{day(precedent.decisionDate)}</Detail>}
                  {precedent.jurisdiction && <Detail label={t("fields.jurisdiction")}>{jurisdictionLabel(precedent.jurisdiction, t)}</Detail>}
                  {precedent.arbitrator && (
                    <Detail label={t("fields.arbitrator")} wide>
                      {precedent.arbitrator}
                    </Detail>
                  )}
                  {precedent.tribunal && (
                    <Detail label={t("fields.tribunal")} wide>
                      {tribunalLabel(precedent.tribunal, t)}
                    </Detail>
                  )}
                  {precedent.precedentValue && <Detail label={t("fields.precedentValue")}>{precedentValueLabel(precedent.precedentValue, t)}</Detail>}
                  {precedent.sector && <Detail label={t("fields.sector")}>{precedent.sector}</Detail>}
                  {precedent.union && <Detail label={t("fields.union")}>{precedent.union}</Detail>}
                  {precedent.employer && <Detail label={t("fields.employer")}>{precedent.employer}</Detail>}
                </div>

                {precedent.summary && (
                  <>
                    <Separator />
                    <ScrollingText label={t("viewer.summary")} text={precedent.summary} />
                  </>
                )}
                {precedent.keyFindings && (
                  <>
                    <Separator />
                    <ScrollingText label={t("viewer.keyFindings")} text={precedent.keyFindings} />
                  </>
                )}
                {precedent.reasoning && (
                  <>
                    <Separator />
                    <ScrollingText label={t("viewer.reasoning")} text={precedent.reasoning} />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("comparison.table")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="py-2 text-left font-medium">
                    {t("comparison.attribute")}
                  </th>
                  {precedents.map((precedent) => (
                    <th key={precedent.id} scope="col" className="py-2 text-left font-medium">
                      {nameOf(precedent)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownRows.map((row) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <th scope="row" className="py-2 text-left font-normal text-muted-foreground">
                      {row.label}
                    </th>
                    {precedents.map((precedent) => (
                      <td key={precedent.id} className="py-2">
                        {row.cell(precedent) ?? unavailable}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
