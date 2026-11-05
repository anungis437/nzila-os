"use client";

/**
 * Arbitration precedents: search, view and compare.
 *
 * The list comes from GET /api/precedents, the route that filters (see precedent-filters.ts for what it honours), and a decision from
 * GET /api/arbitration/precedents/:id (see precedent-record.ts for both response shapes). A request that fails is shown as a failure with
 * a way to retry; it is never shown as "no precedents". Every word comes from the message catalogs (the `precedents` namespace).
 *
 * Adding, editing, sharing and deleting a decision are not offered here. Nothing on this screen could complete them: the list route is
 * read-only for members, a write needs the platform content_manager role, and the generic write route refuses a field that is not a
 * column of arbitration_decisions (which has no sharing or summary columns for the edit and share forms to write).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Scale, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrecedentSearch } from "@/components/precedents/PrecedentSearch";
import { PrecedentViewer } from "@/components/precedents/PrecedentViewer";
import { PrecedentCompareView } from "@/components/precedents/PrecedentCompareView";
import { fetchPrecedentComparison } from "@/components/precedents/precedent-comparison";
import {
  NO_FILTERS,
  issueTypeLabel,
  jurisdictionLabel,
  listParams,
  outcomeColor,
  outcomeLabel,
  type PrecedentFilters,
} from "@/components/precedents/precedent-filters";
import { formatDay } from "@/components/precedents/precedent-format";
import { readPrecedent, readPrecedentList, type PrecedentRecord } from "@/components/precedents/precedent-record";
import { JurisdictionPreferences } from "@/components/precedents/JurisdictionPreferences";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { envelopeData, readApiError } from "@/lib/client/api-envelope";

const MAX_COMPARED = 10;
const PAGE_SIZE = 20;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function LoadFailure({ title, body, detail, onRetry }: { title: string; body: string; detail: string; onRetry: () => void }) {
  const t = useTranslations("precedents");
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{body}</p>
        <p className="text-xs">{detail}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("console.retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function PrecedentsConsole() {
  const t = useTranslations("precedents");
  const format = useFormatter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "view" | "compare" | "setup">("browse");
  const [searchFilters, setSearchFilters] = useState<PrecedentFilters>(NO_FILTERS);
  const [selectedPrecedentId, setSelectedPrecedentId] = useState<string | null>(null);
  const [selectedPrecedentIds, setSelectedPrecedentIds] = useState<string[]>([]);
  const [comparisonNotes, setComparisonNotes] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [precedentsData, setPrecedentsData] = useState<{ precedents: PrecedentRecord[]; totalPages: number } | null>(null);
  const [isLoadingPrecedents, setIsLoadingPrecedents] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listReload, setListReload] = useState(0);
  const [selectedPrecedent, setSelectedPrecedent] = useState<PrecedentRecord | null>(null);
  const [isLoadingPrecedent, setIsLoadingPrecedent] = useState(false);
  const [precedentError, setPrecedentError] = useState<string | null>(null);
  const [precedentReload, setPrecedentReload] = useState(0);
  const [comparisonData, setComparisonData] = useState<PrecedentRecord[] | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const comparisonRequest = useRef(0);
  const [showJurisdictionSetup, setShowJurisdictionSetup] = useState(false);
  const [jurisdictionPrefsLoaded, setJurisdictionPrefsLoaded] = useState(false);
  const [jurisdictionPrefsFailed, setJurisdictionPrefsFailed] = useState(false);
  const [jurisdictionPrefsSeveral, setJurisdictionPrefsSeveral] = useState(false);

  // The query the list is read with; it changes exactly when a filter or the page does.
  const listQuery = useMemo(() => listParams(searchFilters, currentPage, PAGE_SIZE).toString(), [searchFilters, currentPage]);

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load the saved jurisdiction preference and apply it where the list can honour it
  useEffect(() => {
    if (!mounted || jurisdictionPrefsLoaded) return;
    const loadPrefs = async () => {
      try {
        const res = await fetch("/api/precedents/jurisdiction-preferences");
        if (!res.ok) throw new Error(await readApiError(res, `HTTP ${res.status}`));
        const data = envelopeData(await res.json());
        setJurisdictionPrefsFailed(false);

        if (!data.isConfigured) {
          setShowJurisdictionSetup(true);
          return;
        }

        const preferred = Array.isArray(data.preferredJurisdictions)
          ? data.preferredJurisdictions.filter((jurisdiction): jurisdiction is string => typeof jurisdiction === "string")
          : [];
        if (data.autoApply === true && preferred.length > 0) {
          const jurisdictions = data.includeNational === true && !preferred.includes("federal") ? ["federal", ...preferred] : preferred;
          if (jurisdictions.length === 1) {
            setSearchFilters((prev) => ({ ...prev, jurisdiction: jurisdictions[0] }));
          } else {
            // The list takes one jurisdiction at a time, so several saved ones cannot be applied together, and the page says so.
            setJurisdictionPrefsSeveral(true);
          }
        }
      } catch {
        // The results are then not filtered by the member's preferences, and the page says so.
        setJurisdictionPrefsFailed(true);
      } finally {
        setJurisdictionPrefsLoaded(true);
      }
    };
    loadPrefs();
  }, [mounted, jurisdictionPrefsLoaded]);

  // Fetch precedent list
  useEffect(() => {
    if (!mounted) return;
    const controller = new AbortController();
    const fetchPrecedents = async () => {
      setIsLoadingPrecedents(true);
      setListError(null);
      try {
        const response = await fetch(`/api/precedents?${listQuery}`, { signal: controller.signal });
        if (!response.ok) throw new Error(await readApiError(response, `HTTP ${response.status}`));
        setPrecedentsData(readPrecedentList(await response.json()));
      } catch (error) {
        // A request that a newer one replaced says nothing about the list.
        if (controller.signal.aborted) return;
        setPrecedentsData(null);
        setListError(errorText(error));
      } finally {
        if (!controller.signal.aborted) setIsLoadingPrecedents(false);
      }
    };

    fetchPrecedents();
    return () => controller.abort();
  }, [listQuery, mounted, listReload]);

  // Fetch selected precedent details
  useEffect(() => {
    if (!selectedPrecedentId) return;
    const controller = new AbortController();
    const fetchPrecedent = async () => {
      setSelectedPrecedent(null);
      setPrecedentError(null);
      setIsLoadingPrecedent(true);
      try {
        const response = await fetch(`/api/arbitration/precedents/${encodeURIComponent(selectedPrecedentId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await readApiError(response, `HTTP ${response.status}`));
        setSelectedPrecedent(readPrecedent(await response.json()));
      } catch (error) {
        if (controller.signal.aborted) return;
        setPrecedentError(errorText(error));
      } finally {
        if (!controller.signal.aborted) setIsLoadingPrecedent(false);
      }
    };

    fetchPrecedent();
    return () => controller.abort();
  }, [selectedPrecedentId, precedentReload]);

  const handleFiltersChange = useCallback((filters: PrecedentFilters) => {
    setSearchFilters(filters);
    setCurrentPage(1);
  }, []);

  const handleViewPrecedent = (precedentId: string) => {
    setSelectedPrecedentId(precedentId);
    setActiveTab("view");
  };

  const warnMaxReached = () =>
    toast({ title: t("console.maxReachedTitle"), description: t("console.maxReached", { max: MAX_COMPARED }), variant: "destructive" });

  const handleToggleCompare = (precedentId: string) => {
    if (selectedPrecedentIds.includes(precedentId)) {
      setSelectedPrecedentIds(selectedPrecedentIds.filter((id) => id !== precedentId));
      return;
    }
    if (selectedPrecedentIds.length >= MAX_COMPARED) {
      warnMaxReached();
      return;
    }
    setSelectedPrecedentIds([...selectedPrecedentIds, precedentId]);
  };

  const fetchComparison = async (ids: readonly string[]) => {
    // Only the newest request may answer: an older one that finishes later must not replace, or fail over, the comparison asked for last.
    const request = ++comparisonRequest.current;
    setComparisonData(null);
    setComparisonError(null);
    setIsLoadingComparison(true);
    try {
      const precedents = await fetchPrecedentComparison(ids);
      if (request === comparisonRequest.current) setComparisonData(precedents);
    } catch (error) {
      if (request === comparisonRequest.current) setComparisonError(errorText(error));
    } finally {
      if (request === comparisonRequest.current) setIsLoadingComparison(false);
    }
  };

  // Takes the selection it should compare, so a decision added a moment ago is part of it.
  const startComparison = (ids: readonly string[]) => {
    if (ids.length < 2) {
      toast({ title: t("console.selectMoreTitle"), description: t("console.selectMore"), variant: "destructive" });
      return;
    }
    setActiveTab("compare");
    fetchComparison(ids);
  };

  // The viewer's Compare adds the decision being read to the selection, then compares if there are now two or more.
  const handleCompareViewed = () => {
    if (!selectedPrecedent) return;
    if (selectedPrecedentIds.includes(selectedPrecedent.id)) {
      startComparison(selectedPrecedentIds);
      return;
    }
    if (selectedPrecedentIds.length >= MAX_COMPARED) {
      warnMaxReached();
      return;
    }
    const ids = [...selectedPrecedentIds, selectedPrecedent.id];
    setSelectedPrecedentIds(ids);
    startComparison(ids);
  };

  const handleRemoveFromComparison = (precedentId: string) => {
    const remaining = selectedPrecedentIds.filter((id) => id !== precedentId);
    setSelectedPrecedentIds(remaining);
    setComparisonData((prev) => (prev ? prev.filter((precedent) => precedent.id !== precedentId) : prev));
    if (remaining.length < 2) setActiveTab("browse");
  };

  const handleExportComparison = () => {
    if (!comparisonData) return;
    const report = {
      generatedAt: new Date().toISOString(),
      notes: comparisonNotes,
      precedents: comparisonData,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `precedent-comparison-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!mounted) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">{t("console.loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Scale className="h-8 w-8" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Search */}
      <PrecedentSearch filters={searchFilters} onChange={handleFiltersChange} />

      {/* The member's saved jurisdictions could not be read, so the results below are not filtered by them */}
      {jurisdictionPrefsFailed && (
        <Alert role="status">
          <AlertTitle>{t("console.prefsFailedTitle")}</AlertTitle>
          <AlertDescription>{t("console.prefsFailed")}</AlertDescription>
        </Alert>
      )}

      {/* Several saved jurisdictions cannot be applied together: the list filters by one at a time */}
      {jurisdictionPrefsSeveral && (
        <Alert role="status">
          <AlertTitle>{t("console.prefsFailedTitle")}</AlertTitle>
          <AlertDescription>{t("console.prefsSeveral")}</AlertDescription>
        </Alert>
      )}

      {/* Jurisdiction Setup Banner — shown when user hasn't configured preferences */}
      {showJurisdictionSetup && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">{t("console.setupTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("console.setupBody")}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("setup")}>
              {t("console.configure")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Comparison Bar */}
      {selectedPrecedentIds.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedPrecedentIds.length} {t("selected")}
              </Badge>
              <span className="text-sm text-muted-foreground">{t("forComparison")}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedPrecedentIds([])}>
                {t("clear")}
              </Button>
              <Button onClick={() => startComparison(selectedPrecedentIds)} disabled={selectedPrecedentIds.length < 2}>
                {t("compare")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "browse" | "view" | "compare" | "setup")}>
        <TabsList>
          <TabsTrigger value="browse">{t("browse")}</TabsTrigger>
          <TabsTrigger value="view" disabled={!selectedPrecedentId}>
            {t("view")}
          </TabsTrigger>
          <TabsTrigger value="compare" disabled={selectedPrecedentIds.length < 2}>
            {t("compare")} ({selectedPrecedentIds.length})
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            {t("console.jurisdictionsTab")}
          </TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          {isLoadingPrecedents ? (
            <div className="text-center py-12 text-muted-foreground">{t("loadingPrecedents")}</div>
          ) : listError !== null ? (
            <LoadFailure
              title={t("console.listFailedTitle")}
              body={t("console.listFailed")}
              detail={listError}
              onRetry={() => setListReload((count) => count + 1)}
            />
          ) : !precedentsData?.precedents.length ? (
            <div className="text-center py-12 text-muted-foreground">{t("noPrecedentsFound")}</div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {precedentsData.precedents.map((precedent: PrecedentRecord) => (
                  <Card key={precedent.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            <span className="text-muted-foreground mr-2">{precedent.caseNumber}</span>
                            {precedent.caseTitle}
                          </CardTitle>
                          <CardDescription className="mt-1">{precedent.union}</CardDescription>
                        </div>
                        <Checkbox
                          aria-label={t("console.selectForComparison", { name: precedent.caseNumber ?? precedent.caseTitle ?? precedent.id })}
                          checked={selectedPrecedentIds.includes(precedent.id)}
                          onCheckedChange={() => handleToggleCompare(precedent.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </CardHeader>
                    <CardContent onClick={() => handleViewPrecedent(precedent.id)}>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {precedent.summary ?? precedent.headnote ?? precedent.precedentSummary}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {precedent.issueTypes?.map((issueType) => (
                            <Badge key={issueType} variant="outline">
                              {issueTypeLabel(issueType)}
                            </Badge>
                          ))}
                          {precedent.outcome && <Badge className={outcomeColor(precedent.outcome)}>{outcomeLabel(precedent.outcome, t)}</Badge>}
                          {precedent.decisionDate && <Badge variant="secondary">{formatDay(format, precedent.decisionDate, "month")}</Badge>}
                          {precedent.jurisdiction && <Badge variant="outline">{jurisdictionLabel(precedent.jurisdiction, t)}</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  {t("previous")}
                </Button>
                <div className="flex items-center px-4 text-sm text-muted-foreground">
                  {t("pageXofY", { current: currentPage, total: precedentsData.totalPages })}
                </div>
                <Button variant="outline" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= precedentsData.totalPages}>
                  {t("next")}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* View Tab */}
        <TabsContent value="view" className="space-y-6">
          {isLoadingPrecedent ? (
            <div className="text-center py-12 text-muted-foreground">{t("loadingPrecedents")}</div>
          ) : precedentError !== null ? (
            <LoadFailure
              title={t("console.viewFailedTitle")}
              body={t("console.viewFailed")}
              detail={precedentError}
              onRetry={() => setPrecedentReload((count) => count + 1)}
            />
          ) : (
            selectedPrecedent && <PrecedentViewer precedent={selectedPrecedent} onCompare={handleCompareViewed} />
          )}
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare">
          {isLoadingComparison ? (
            <div className="text-center py-12 text-muted-foreground">{t("loadingPrecedents")}</div>
          ) : comparisonError !== null ? (
            <LoadFailure
              title={t("console.comparisonFailedTitle")}
              body={t("console.comparisonFailed")}
              detail={comparisonError}
              onRetry={() => fetchComparison(selectedPrecedentIds)}
            />
          ) : (
            comparisonData && (
              <PrecedentCompareView
                precedents={comparisonData}
                onRemovePrecedent={handleRemoveFromComparison}
                onExport={handleExportComparison}
                comparisonNotes={comparisonNotes}
                onNotesChange={setComparisonNotes}
              />
            )
          )}
        </TabsContent>

        {/* Jurisdiction Setup Tab */}
        <TabsContent value="setup" className="space-y-4">
          <JurisdictionPreferences
            compact
            onSaved={() => {
              setShowJurisdictionSetup(false);
              // Reload preferences and re-apply filters
              setJurisdictionPrefsLoaded(false);
              setActiveTab("browse");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
