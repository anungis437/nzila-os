"use client";


export const dynamic = 'force-dynamic';
/**
 * Phase 5B: Arbitration Precedents Main Page
 * Integrates search, view, compare, and document management
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslations } from 'next-intl';
import { Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrecedentSearch } from "@/components/precedents/PrecedentSearch";
import { PrecedentViewer } from "@/components/precedents/PrecedentViewer";
import { PrecedentCompareView } from "@/components/precedents/PrecedentCompareView";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/use-toast";
import { format } from "date-fns";

interface SearchFilters {
  query: string;
  grievanceTypes: string[];
  outcomes: string[];
  jurisdictions: string[];
  precedentLevels: string[];
  sectors: string[];
  sharingLevels: string[];
  arbitratorName: string;
  fromDate: string;
  toDate: string;
}

const OUTCOME_COLORS = {
  upheld: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  dismissed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  partially_upheld:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  settled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function PrecedentsPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "view" | "compare">("browse");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: "",
    grievanceTypes: [],
    outcomes: [],
    jurisdictions: [],
    precedentLevels: [],
    sectors: [],
    sharingLevels: [],
    arbitratorName: "",
    fromDate: "",
    toDate: "",
  });
  const [selectedPrecedentId, setSelectedPrecedentId] = useState<string | null>(null);
  const [selectedPrecedentIds, setSelectedPrecedentIds] = useState<string[]>([]);
  const [comparisonNotes, setComparisonNotes] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [precedentsData, setPrecedentsData] = useState<any>(null);
  const [isLoadingPrecedents, setIsLoadingPrecedents] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedPrecedent, setSelectedPrecedent] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingShare, setIsSavingShare] = useState(false);
  const [editForm, setEditForm] = useState({
    caseNumber: "",
    caseTitle: "",
    decisionDate: "",
    issueSummary: "",
    decisionSummary: "",
  });
  const [shareForm, setShareForm] = useState({
    sharingLevel: "private",
    sharedWithOrgIds: "",
  });
  const pageSize = 20;

  // Use ref to track if we&apos;re currently fetching to prevent race conditions
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchParamsRef = useRef<string>("");

  // Create stable filter key for dependency tracking
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        query: searchFilters.query,
        grievanceTypes: searchFilters.grievanceTypes,
        outcomes: searchFilters.outcomes,
        jurisdictions: searchFilters.jurisdictions,
        precedentLevels: searchFilters.precedentLevels,
        sectors: searchFilters.sectors,
        sharingLevels: searchFilters.sharingLevels,
        arbitratorName: searchFilters.arbitratorName,
        fromDate: searchFilters.fromDate,
        toDate: searchFilters.toDate,
        page: currentPage,
      }),
    [
      searchFilters.query,
      searchFilters.grievanceTypes,
      searchFilters.outcomes,
      searchFilters.jurisdictions,
      searchFilters.precedentLevels,
      searchFilters.sectors,
      searchFilters.sharingLevels,
      searchFilters.arbitratorName,
      searchFilters.fromDate,
      searchFilters.toDate,
      currentPage,
    ]
  );

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch precedent list
  useEffect(() => {
    const fetchPrecedents = async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(searchFilters.query && { search: searchFilters.query }),
        ...(searchFilters.grievanceTypes.length > 0 && {
          grievanceTypes: searchFilters.grievanceTypes.join(","),
        }),
        ...(searchFilters.outcomes.length > 0 && {
          outcomes: searchFilters.outcomes.join(","),
        }),
        ...(searchFilters.jurisdictions.length > 0 && {
          jurisdictions: searchFilters.jurisdictions.join(","),
        }),
        ...(searchFilters.precedentLevels.length > 0 && {
          precedentLevels: searchFilters.precedentLevels.join(","),
        }),
        ...(searchFilters.sectors.length > 0 && {
          sectors: searchFilters.sectors.join(","),
        }),
        ...(searchFilters.sharingLevels.length > 0 && {
          sharingLevels: searchFilters.sharingLevels.join(","),
        }),
        ...(searchFilters.arbitratorName && {
          arbitrator: searchFilters.arbitratorName,
        }),
        ...(searchFilters.fromDate && { fromDate: searchFilters.fromDate }),
        ...(searchFilters.toDate && { toDate: searchFilters.toDate }),
      });

      const paramsString = params.toString();

      // Prevent duplicate fetches with same parameters
      if (isFetchingRef.current || lastFetchParamsRef.current === paramsString) {
        return;
      }

      lastFetchParamsRef.current = paramsString;

      // Cancel any previous fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      isFetchingRef.current = true;
      setIsLoadingPrecedents(true);

      try {
        const response = await fetch(`/api/arbitration/precedents?${params}`, {
          signal: abortControllerRef.current.signal,
        });

        if (response.ok) {
          const data = await response.json();
          setPrecedentsData(data);
        } else if (response.status === 401) {
setPrecedentsData({
            precedents: [],
            total: 0,
            page: currentPage,
            limit: pageSize,
          });
        } else {
setPrecedentsData({
            precedents: [],
            total: 0,
            page: currentPage,
            limit: pageSize,
          });
        }
      } catch (error) {
        // Ignore abort errors
        if (error.name !== "AbortError") {
setPrecedentsData({
            precedents: [],
            total: 0,
            page: currentPage,
            limit: pageSize,
          });
        }
      } finally {
        isFetchingRef.current = false;
        setIsLoadingPrecedents(false);
      }
    };

    // Only fetch if mounted (prevents SSR issues)
    if (mounted) {
      fetchPrecedents();
    }

    // Cleanup function to abort fetch on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, mounted, pageSize]);

  // Fetch selected precedent details
  useEffect(() => {
    const fetchPrecedent = async () => {
      if (!selectedPrecedentId) return;

      try {
        const response = await fetch(`/api/arbitration/precedents/${selectedPrecedentId}`);
        if (response.ok) {
          const data = await response.json();
          setSelectedPrecedent(data);
        }
      } catch (_error) {
}
    };

    fetchPrecedent();
  }, [selectedPrecedentId]);

  const handleSearch = useCallback((filters: SearchFilters) => {
    setSearchFilters(filters);
    setCurrentPage(1);
  }, []);

  const handleViewPrecedent = (precedentId: string) => {
    setSelectedPrecedentId(precedentId);
    setActiveTab("view");
  };

  const handleToggleCompare = (precedentId: string) => {
    setSelectedPrecedentIds((prev) => {
      if (prev.includes(precedentId)) {
        return prev.filter((id) => id !== precedentId);
      }
      if (prev.length >= 10) {
        toast({
          title: "Maximum reached",
          description: "You can compare up to 10 precedents at once.",
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, precedentId];
    });
  };

  const fetchComparison = async () => {
    if (selectedPrecedentIds.length < 2) return;

    try {
      const response = await fetch("/api/arbitration/precedents/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          precedentIds: selectedPrecedentIds,
          notes: comparisonNotes,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComparisonData(data);
      }
    } catch (_error) {
}
  };

  const handleStartComparison = () => {
    if (selectedPrecedentIds.length < 2) {
      toast({
        title: "Select more precedents",
        description: "Please select at least 2 precedents to compare.",
        variant: "destructive",
      });
      return;
    }
    setActiveTab("compare");
    fetchComparison();
  };

  const handleRemoveFromComparison = (precedentId: string) => {
    setSelectedPrecedentIds((prev) => prev.filter((id) => id !== precedentId));
  };

  const handleDownloadDocument = async (documentType: "decision" | "redacted") => {
    if (!selectedPrecedent) return;

    const url =
      documentType === "decision"
        ? selectedPrecedent.decisionDocumentUrl
        : selectedPrecedent.redactedDocumentUrl;

    if (!url) {
      toast({
        title: "Document not available",
        description: `No ${documentType} document found for this precedent.`,
        variant: "destructive",
      });
      return;
    }

    // Open document in new tab
    window.open(url, "_blank");
  };

  const openEditDialog = () => {
    if (!selectedPrecedent) return;
    setEditForm({
      caseNumber: selectedPrecedent.caseNumber || "",
      caseTitle: selectedPrecedent.caseTitle || "",
      decisionDate: selectedPrecedent.decisionDate
        ? selectedPrecedent.decisionDate.slice(0, 10)
        : "",
      issueSummary: selectedPrecedent.issueSummary || "",
      decisionSummary: selectedPrecedent.decisionSummary || "",
    });
    setIsEditDialogOpen(true);
  };

  const openShareDialog = () => {
    if (!selectedPrecedent) return;
    setShareForm({
      sharingLevel: selectedPrecedent.sharingLevel || "private",
      sharedWithOrgIds: Array.isArray(selectedPrecedent.sharedWithOrgIds)
        ? selectedPrecedent.sharedWithOrgIds.join(", ")
        : "",
    });
    setIsShareDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPrecedent) return;
    try {
      setIsSavingEdit(true);
      const response = await fetch(`/api/arbitration/precedents/${selectedPrecedent.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseNumber: editForm.caseNumber || null,
            caseTitle: editForm.caseTitle || null,
            decisionDate: editForm.decisionDate || null,
            issueSummary: editForm.issueSummary || null,
            decisionSummary: editForm.decisionSummary || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update precedent");
      }

      const updated = await response.json();
      setSelectedPrecedent(updated);
      toast({
        title: "Precedent updated",
        description: "Your changes have been saved.",
      });
      setIsEditDialogOpen(false);
    } catch (_error) {
toast({
        title: "Update failed",
        description: "Could not update precedent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveShare = async () => {
    if (!selectedPrecedent) return;
    try {
      setIsSavingShare(true);
      const sharedWithOrgIds = shareForm.sharedWithOrgIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      const response = await fetch(`/api/arbitration/precedents/${selectedPrecedent.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sharingLevel: shareForm.sharingLevel,
            sharedWithOrgIds: sharedWithOrgIds.length > 0 ? sharedWithOrgIds : null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update sharing settings");
      }

      const updated = await response.json();
      setSelectedPrecedent(updated);
      toast({
        title: "Sharing updated",
        description: "Precedent sharing settings have been updated.",
      });
      setIsShareDialogOpen(false);
    } catch (_error) {
toast({
        title: "Update failed",
        description: "Could not update sharing settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingShare(false);
    }
  };

  const handleExportComparison = () => {
    if (!comparisonData) return;
    const report = {
      generatedAt: new Date().toISOString(),
      notes: comparisonNotes,
      analysis: comparisonData.analysis,
      precedents: comparisonData.precedents,
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

  const handleDeletePrecedent = async () => {
    if (!selectedPrecedent) return;

    try {
      const response = await fetch(
        `/api/arbitration/precedents/${selectedPrecedent.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast({
          title: "Precedent deleted",
          description: "The precedent has been successfully deleted.",
        });
        setSelectedPrecedentId(null);
        setActiveTab("browse");
        // Refresh list
        lastFetchParamsRef.current = "";
      } else {
        toast({
          title: "Delete failed",
          description: "Failed to delete the precedent. Please try again.",
          variant: "destructive",
        });
      }
    } catch (_error) {
toast({
        title: "Error",
        description: "An error occurred while deleting the precedent.",
        variant: "destructive",
      });
    }
  };

  if (!mounted) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-8 w-8" />
            {t('precedents.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('precedents.subtitle')}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('precedents.addPrecedent')}
        </Button>
      </div>

      {/* Search */}
      <PrecedentSearch onSearch={handleSearch} isLoading={isLoadingPrecedents} />

      {/* Comparison Bar */}
      {selectedPrecedentIds.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedPrecedentIds.length} {t('precedents.selected')}</Badge>
              <span className="text-sm text-muted-foreground">{t('precedents.forComparison')}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedPrecedentIds([])}>
                {t('precedents.clear')}
              </Button>
              <Button
                onClick={handleStartComparison}
                disabled={selectedPrecedentIds.length < 2}
              >
                {t('precedents.compare')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="browse">{t('precedents.browse')}</TabsTrigger>
          <TabsTrigger value="view" disabled={!selectedPrecedentId}>
            {t('precedents.view')}
          </TabsTrigger>
          <TabsTrigger value="compare" disabled={selectedPrecedentIds.length < 2}>
            {t('precedents.compare')} ({selectedPrecedentIds.length})
          </TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          {isLoadingPrecedents ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('precedents.loadingPrecedents')}
            </div>
          ) : !precedentsData?.precedents?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('precedents.noPrecedentsFound')}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {precedentsData?.precedents?.map((precedent: any) => (
                  <Card
                    key={precedent.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            <span className="text-muted-foreground mr-2">
                              {precedent.caseNumber}
                            </span>
                            {precedent.caseTitle}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {precedent.organization?.name}
                          </CardDescription>
                        </div>
                        <Checkbox
                          checked={selectedPrecedentIds.includes(precedent.id)}
                          onCheckedChange={() => handleToggleCompare(precedent.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </CardHeader>
                    <CardContent onClick={() => handleViewPrecedent(precedent.id)}>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {precedent.issueSummary || precedent.decisionSummary}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {precedent.grievanceType
                              ?.split("_")
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(" ")}
                          </Badge>
                          <Badge
                            className={
                              OUTCOME_COLORS[
                                precedent.outcome as keyof typeof OUTCOME_COLORS
                              ] || ""
                            }
                          >
                            {precedent.outcome
                              ?.split("_")
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(" ")}
                          </Badge>
                          {precedent.decisionDate && (
                            <Badge variant="secondary">
                              {format(new Date(precedent.decisionDate), "MMM yyyy")}
                            </Badge>
                          )}
                          {precedent.jurisdiction && (
                            <Badge variant="outline">
                              {precedent.jurisdiction === "federal"
                                ? "Federal"
                                : precedent.jurisdiction.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {precedentsData?.pagination && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    {t('precedents.previous')}
                  </Button>
                  <div className="flex items-center px-4 text-sm text-muted-foreground">
                    {t('precedents.pageXofY', { current: currentPage, total: precedentsData.pagination.totalPages })}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage >= precedentsData.pagination.totalPages}
                  >
                    {t('precedents.next')}
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* View Tab */}
        <TabsContent value="view" className="space-y-6">
          {selectedPrecedent && (
            <PrecedentViewer
              precedent={selectedPrecedent}
              isOwner={selectedPrecedent.isOwner}
              onEdit={() => {
                openEditDialog();
              }}
              onDelete={handleDeletePrecedent}
              onCompare={() => {
                handleToggleCompare(selectedPrecedent.id);
                handleStartComparison();
              }}
              onShare={() => {
                openShareDialog();
              }}
              onDownloadDocument={handleDownloadDocument}
            />
          )}
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare">
          {comparisonData && (
            <PrecedentCompareView
              precedents={comparisonData.precedents}
              analysis={comparisonData.analysis}
              onRemovePrecedent={handleRemoveFromComparison}
              onExport={() => {
                handleExportComparison();
              }}
              comparisonNotes={comparisonNotes}
              onNotesChange={setComparisonNotes}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Precedent</DialogTitle>
            <DialogDescription>
              Update key fields for this precedent. Changes are saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Case Number</label>
              <Input
                value={editForm.caseNumber}
                onChange={(e) => setEditForm((prev) => ({ ...prev, caseNumber: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Case Title</label>
              <Input
                value={editForm.caseTitle}
                onChange={(e) => setEditForm((prev) => ({ ...prev, caseTitle: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Decision Date</label>
              <Input
                type="date"
                value={editForm.decisionDate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, decisionDate: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Issue Summary</label>
              <Textarea
                value={editForm.issueSummary}
                onChange={(e) => setEditForm((prev) => ({ ...prev, issueSummary: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Decision Summary</label>
              <Textarea
                value={editForm.decisionSummary}
                onChange={(e) => setEditForm((prev) => ({ ...prev, decisionSummary: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Share Precedent</DialogTitle>
            <DialogDescription>
              Control how this precedent is shared across organizations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Sharing Level</label>
              <Select
                value={shareForm.sharingLevel}
                onValueChange={(value) =>
                  setShareForm((prev) => ({ ...prev, sharingLevel: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sharing level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="federation">Federation</SelectItem>
                  <SelectItem value="congress">Congress</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Shared With Organization IDs</label>
              <Input
                placeholder="comma-separated org IDs"
                value={shareForm.sharedWithOrgIds}
                onChange={(e) =>
                  setShareForm((prev) => ({ ...prev, sharedWithOrgIds: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Required for private sharing. Leave empty for broader levels.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveShare} disabled={isSavingShare}>
              {isSavingShare ? "Saving..." : "Save Sharing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
