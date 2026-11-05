"use client";

/**
 * One public arbitration decision, as GET /api/arbitration/precedents/:id serves it (see precedent-record.ts).
 *
 * It shows the columns a decision has and nothing it does not: a field the record lacks is left out, not filled in, and a count that
 * records no measurement is not shown as zero. Every word comes from the message catalogs (the `precedents` namespace), the outcome,
 * precedent value, tribunal, decision type, language and jurisdiction through their own members, and dates in the viewer's language.
 * Nothing here edits, shares, deletes or downloads a decision: no route could complete it. The one action is to compare.
 */
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Briefcase, Building2, Calendar, Eye, Gavel, GitCompare, MapPin, Scale, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  citationTypeLabel,
  decisionTypeLabel,
  issueTypeLabel,
  jurisdictionLabel,
  languageLabel,
  outcomeColor,
  outcomeLabel,
  precedentValueColor,
  precedentValueLabel,
  tribunalLabel,
} from "@/components/precedents/precedent-filters";
import { formatDay, formatMoment } from "@/components/precedents/precedent-format";
import type { PrecedentRecord } from "@/components/precedents/precedent-record";

interface PrecedentViewerProps {
  precedent: PrecedentRecord;
  onCompare?: () => void;
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function TextCard({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PrecedentViewer({ precedent, onCompare }: PrecedentViewerProps) {
  const t = useTranslations("precedents");
  const format = useFormatter();
  const heading = [precedent.caseNumber, precedent.caseTitle].filter(Boolean).join(" - ");
  const { viewCount, citationCount } = precedent;
  const day = (value: string | undefined) => (value ? formatDay(format, value) : undefined);

  const caseFields: Array<{ key: string; icon: ReactNode; label: string; value: ReactNode }> = [];
  const addField = (key: string, symbol: ReactNode, label: string, value: ReactNode | undefined) => {
    if (value !== undefined) caseFields.push({ key, icon: symbol, label, value });
  };
  const icon = "h-4 w-4";
  addField("decisionDate", <Calendar className={icon} />, t("fields.decisionDate"), day(precedent.decisionDate));
  addField("filingDate", <Calendar className={icon} />, t("fields.filingDate"), day(precedent.filingDate));
  addField("hearingDate", <Calendar className={icon} />, t("fields.hearingDate"), day(precedent.hearingDate));
  addField(
    "jurisdiction",
    <MapPin className={icon} />,
    t("fields.jurisdiction"),
    precedent.jurisdiction ? jurisdictionLabel(precedent.jurisdiction, t) : undefined,
  );
  addField("tribunal", <Building2 className={icon} />, t("fields.tribunal"), precedent.tribunal ? tribunalLabel(precedent.tribunal, t) : undefined);
  addField(
    "decisionType",
    <Scale className={icon} />,
    t("fields.decisionType"),
    precedent.decisionType ? decisionTypeLabel(precedent.decisionType, t) : undefined,
  );
  addField("language", <Briefcase className={icon} />, t("fields.language"), precedent.language ? languageLabel(precedent.language, t) : undefined);
  addField("sector", <Briefcase className={icon} />, t("fields.sector"), precedent.sector);
  addField("arbitrator", <Gavel className={icon} />, t("fields.arbitrator"), precedent.arbitrator);
  addField(
    "issueTypes",
    <Scale className={icon} />,
    t("fields.issueTypes"),
    precedent.issueTypes ? (
      <div className="flex flex-wrap gap-2">
        {precedent.issueTypes.map((issueType) => (
          <Badge key={issueType} variant="outline">
            {issueTypeLabel(issueType)}
          </Badge>
        ))}
      </div>
    ) : undefined,
  );

  const hasParties = precedent.union !== undefined || precedent.employer !== undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="flex-1 text-2xl font-bold tracking-tight">{heading}</h2>
        {onCompare && (
          <Button variant="outline" size="sm" onClick={onCompare} className="shrink-0">
            <GitCompare className="mr-2 h-4 w-4" />
            {t("compare")}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {precedent.outcome && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("fields.outcome")}</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge className={outcomeColor(precedent.outcome)}>{outcomeLabel(precedent.outcome, t)}</Badge>
            </CardContent>
          </Card>
        )}

        {precedent.precedentValue && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("fields.precedentValue")}</CardTitle>
              <Gavel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge className={precedentValueColor(precedent.precedentValue)}>{precedentValueLabel(precedent.precedentValue, t)}</Badge>
            </CardContent>
          </Card>
        )}

        {(viewCount !== undefined || citationCount !== undefined) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("viewer.engagement")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                {viewCount !== undefined && (
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    <span>{t("viewer.viewCount", { count: viewCount })}</span>
                  </div>
                )}
                {citationCount !== undefined && (
                  <div className="flex items-center gap-1">
                    <GitCompare className="h-3 w-3" aria-hidden="true" />
                    <span>{t("viewer.citationCount", { count: citationCount })}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {caseFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("viewer.caseInformation")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {caseFields.map((field) => (
                <Field key={field.key} icon={field.icon} label={field.label}>
                  {field.value}
                </Field>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasParties && (
        <Card>
          <CardHeader>
            <CardTitle>{t("viewer.parties")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {precedent.union && (
                <Field icon={<Users className="h-4 w-4" />} label={t("fields.union")}>
                  {precedent.union}
                </Field>
              )}
              {precedent.employer && (
                <Field icon={<Building2 className="h-4 w-4" />} label={t("fields.employer")}>
                  {precedent.employer}
                </Field>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {precedent.summary && <TextCard title={t("viewer.summary")} text={precedent.summary} />}
      {precedent.headnote && <TextCard title={t("viewer.headnote")} text={precedent.headnote} />}
      {precedent.precedentSummary && <TextCard title={t("viewer.precedentSummary")} text={precedent.precedentSummary} />}
      {precedent.keyFacts && <TextCard title={t("viewer.keyFacts")} text={precedent.keyFacts} />}
      {precedent.reasoning && <TextCard title={t("viewer.reasoning")} text={precedent.reasoning} />}
      {precedent.keyFindings && <TextCard title={t("viewer.keyFindings")} text={precedent.keyFindings} />}

      {precedent.legalCitations && (
        <Card>
          <CardHeader>
            <CardTitle>{t("viewer.legalCitations")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {precedent.legalCitations.map((citation, index) => (
                <li key={`${citation.citation}-${index}`}>
                  <span className="font-medium">{citation.citation}</span>
                  {citation.type && (
                    <Badge variant="outline" className="ml-2">
                      {citationTypeLabel(citation.type, t)}
                    </Badge>
                  )}
                  {citation.relevance && <p className="text-muted-foreground">{citation.relevance}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {precedent.createdAt && (
        <div className="text-xs text-muted-foreground">
          {precedent.updatedAt && precedent.updatedAt !== precedent.createdAt
            ? t("viewer.createdUpdated", {
                created: formatMoment(format, precedent.createdAt),
                updated: formatMoment(format, precedent.updatedAt),
              })
            : t("viewer.created", { created: formatMoment(format, precedent.createdAt) })}
        </div>
      )}
    </div>
  );
}
