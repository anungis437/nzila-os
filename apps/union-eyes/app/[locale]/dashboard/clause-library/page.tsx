"use client";


export const dynamic = 'force-dynamic';
/**
 * Phase 5B: Shared Clause Library Main Page
 * Integrates search, view, compare, share, and tag management
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ClauseLibrarySearch } from "@/components/clause-library/ClauseLibrarySearch";
import { ClauseViewer } from "@/components/clause-library/ClauseViewer";
import { ClauseCompareView } from "@/components/clause-library/ClauseCompareView";
import { ClauseSharingControls } from "@/components/clause-library/ClauseSharingControls";
import { ClauseTagManager } from "@/components/clause-library/ClauseTagManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/use-toast";

interface SearchFilters {
  query: string;
  clauseTypes: string[];
  sectors: string[];
  provinces: string[];
  sharingLevels: string[];
  includeExpired: boolean;
}

export default function ClauseLibraryPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "view" | "compare">("browse");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: "",
    clauseTypes: [],
    sectors: [],
    provinces: [],
    sharingLevels: [],
    includeExpired: false,
  });
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [selectedClauseIds, setSelectedClauseIds] = useState<string[]>([]);
  const [comparisonNotes, setComparisonNotes] = useState("");
  const [sharingDialogOpen, setSharingDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clausesData, setClausesData] = useState<any>(null);
  const [isLoadingClauses, setIsLoadingClauses] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedClause, setSelectedClause] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [isLoadingClause, setIsLoadingClause] = useState(false);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const pageSize = 20;
  
  // Use ref to track if we&apos;re currently fetching to prevent race conditions
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchParamsRef = useRef<string>("");

  // Create stable filter key for dependency tracking
  const filterKey = useMemo(() => 
    JSON.stringify({
      query: searchFilters.query,
      clauseTypes: searchFilters.clauseTypes,
      sectors: searchFilters.sectors,
      provinces: searchFilters.provinces,
      sharingLevels: searchFilters.sharingLevels,
      includeExpired: searchFilters.includeExpired,
      page: currentPage,
    }),
    [searchFilters.query, searchFilters.clauseTypes, searchFilters.sectors, 
     searchFilters.provinces, searchFilters.sharingLevels, searchFilters.includeExpired, currentPage]
  );

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch clause list
  useEffect(() => {
    const fetchClauses = async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(searchFilters.query && { search: searchFilters.query }),
        ...(searchFilters.clauseTypes.length > 0 && {
          clauseTypes: searchFilters.clauseTypes.join(","),
        }),
        ...(searchFilters.sectors.length > 0 && {
          sectors: searchFilters.sectors.join(","),
        }),
        ...(searchFilters.provinces.length > 0 && {
          provinces: searchFilters.provinces.join(","),
        }),
        ...(searchFilters.sharingLevels.length > 0 && {
          sharingLevels: searchFilters.sharingLevels.join(","),
        }),
        includeExpired: searchFilters.includeExpired.toString(),
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
      setIsLoadingClauses(true);
      
      try {
        const response = await fetch(`/api/clause-library?${params}`, {
          signal: abortControllerRef.current.signal,
        });
        
        if (response.ok) {
          const data = await response.json();
          setClausesData(data);
        } else if (response.status === 401) {
          // Authentication error - stop retrying to prevent infinite loop
setClausesData({ clauses: [], total: 0, page: currentPage, limit: pageSize });
        } else {
setClausesData({ clauses: [], total: 0, page: currentPage, limit: pageSize });
        }
      } catch (error) {
        // Ignore abort errors
        if (error.name !== 'AbortError') {
// Set empty data to prevent further retries
          setClausesData({ clauses: [], total: 0, page: currentPage, limit: pageSize });
        }
      } finally {
        isFetchingRef.current = false;
        setIsLoadingClauses(false);
      }
    };

    // Only fetch if mounted (prevents SSR issues)
    if (mounted) {
      fetchClauses();
    }
    
    // Cleanup function to abort fetch on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, mounted, pageSize]);

  const handleSearch = useCallback((filters: SearchFilters) => {
    setSearchFilters(filters);
    setCurrentPage(1);
  }, []);

  const handleViewClause = async (clauseId: string) => {
    setSelectedClauseId(clauseId);
    setActiveTab("view");
    setIsLoadingClause(true);
    
    // Fetch full clause details
    try {
      const response = await fetch(`/api/clause-library/${clauseId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedClause(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load clause details",
          variant: "destructive",
        });
        setSelectedClause(null);
      }
    } catch (_error) {
toast({
        title: "Error",
        description: "Failed to load clause details",
        variant: "destructive",
      });
      setSelectedClause(null);
    } finally {
      setIsLoadingClause(false);
    }
  };

  const handleToggleCompare = (clauseId: string) => {
    setSelectedClauseIds((prev) => {
      if (prev.includes(clauseId)) {
        return prev.filter((id) => id !== clauseId);
      }
      if (prev.length >= 10) {
        toast({
          title: "Maximum reached",
          description: "You can compare up to 10 clauses at once.",
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, clauseId];
    });
  };

  const fetchComparison = async () => {
    if (selectedClauseIds.length < 2) return;
    
    setIsLoadingComparison(true);
    try {
      const response = await fetch("/api/clause-library/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clauseIds: selectedClauseIds, comparisonNotes }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setComparisonData(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load comparison",
          variant: "destructive",
        });
        setComparisonData(null);
      }
    } catch (_error) {
toast({
        title: "Error",
        description: "Failed to load comparison",
        variant: "destructive",
      });
      setComparisonData(null);
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const handleStartComparison = () => {
    if (selectedClauseIds.length < 2) {
      toast({
        title: "Select more clauses",
        description: "Please select at least 2 clauses to compare.",
        variant: "destructive",
      });
      return;
    }
    setActiveTab("compare");
    fetchComparison();
  };

  const handleRemoveFromComparison = (clauseId: string) => {
    setSelectedClauseIds((prev) => {
      const newIds = prev.filter((id) => id !== clauseId);
      // Re-fetch comparison if we still have 2+ clauses
      if (newIds.length >= 2) {
        // Will be refetched when user is on compare tab
        return newIds;
      } else {
        // Clear comparison data if less than 2 clauses
        setComparisonData(null);
        if (newIds.length < 2 && activeTab === "compare") {
          setActiveTab("browse");
        }
        return newIds;
      }
    });
  };

  // Re-fetch comparison when clause IDs change and we&apos;re on compare tab
  useEffect(() => {
    if (activeTab === "compare" && selectedClauseIds.length >= 2) {
      fetchComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClauseIds, activeTab]);

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
            <BookOpen className="h-8 w-8" />
            Shared Clause Library
          </h1>
          <p className="text-muted-foreground">
            Search and compare collective agreement clauses across unions
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Clause
        </Button>
      </div>

      {/* Search */}
      <ClauseLibrarySearch onSearch={handleSearch} isLoading={isLoadingClauses} />

      {/* Comparison Bar */}
      {selectedClauseIds.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedClauseIds.length} selected</Badge>
              <span className="text-sm text-muted-foreground">for comparison</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedClauseIds([])}>
                Clear
              </Button>
              <Button onClick={handleStartComparison} disabled={selectedClauseIds.length < 2}>
                Compare
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="view" disabled={!selectedClauseId}>
            View
          </TabsTrigger>
          <TabsTrigger value="compare" disabled={selectedClauseIds.length < 2}>
            Compare ({selectedClauseIds.length})
          </TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          {isLoadingClauses ? (
            <div className="text-center py-12 text-muted-foreground">Loading clauses...</div>
          ) : !clausesData?.clauses?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              No clauses found. Try adjusting your filters.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {clausesData?.clauses?.map((clause: any) => (
                  <Card key={clause.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {clause.clauseNumber && (
                              <span className="text-muted-foreground mr-2">
                                {clause.clauseNumber}
                              </span>
                            )}
                            {clause.clauseTitle}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {clause.sourceOrganization?.organizationName}
                          </CardDescription>
                        </div>
                        <Checkbox
                          checked={selectedClauseIds.includes(clause.id)}
                          onCheckedChange={() => handleToggleCompare(clause.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </CardHeader>
                    <CardContent onClick={() => handleViewClause(clause.id)}>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {clause.clauseText}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{clause.clauseType}</Badge>
                          <Badge variant="secondary">{clause.sharingLevel}</Badge>
                          {clause.sector && <Badge variant="outline">{clause.sector}</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {clausesData?.pagination && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {clausesData.pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage >= clausesData.pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* View Tab */}
        <TabsContent value="view" className="space-y-6">
          {isLoadingClause ? (
            <div className="text-center py-12 text-muted-foreground">Loading clause details...</div>
          ) : selectedClause ? (
            <>
              <ClauseViewer
                clause={selectedClause}
                isOwner={selectedClause.isOwner}
                onEdit={() => {
                  toast({
                    title: "Coming soon",
                    description: "Clause editing will be available in a future update",
                  });
                }}
                onDelete={async () => {
                  try {
                    const response = await fetch(`/api/clause-library/${selectedClause.id}`, {
                      method: "DELETE",
                    });
                    
                    if (response.ok) {
                      toast({
                        title: "Clause deleted",
                        description: "The clause has been removed from the library",
                      });
                      // Go back to browse tab and refresh
                      setActiveTab("browse");
                      setSelectedClauseId(null);
                      setSelectedClause(null);
                      // Trigger refetch by updating filter key
                      setSearchFilters({ ...searchFilters });
                    } else {
                      throw new Error("Failed to delete");
                    }
                  } catch (_error) {
                    toast({
                      title: "Error",
                      description: "Failed to delete clause",
                      variant: "destructive",
                    });
                  }
                }}
                onCompare={() => {
                  handleToggleCompare(selectedClause.id);
                  handleStartComparison();
                }}
                onShare={() => setSharingDialogOpen(true)}
              />

              {selectedClause.isOwner && (
                <ClauseTagManager
                  clauseId={selectedClause.id}
                  tags={selectedClause.tags || []}
                  isOwner={selectedClause.isOwner}
                  onAddTag={async (tagName) => {
                    try {
                      const response = await fetch(`/api/clause-library/${selectedClause.id}/tags`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tagName }),
                      });
                      
                      if (response.ok) {
                        // Refresh clause data
                        const updatedResponse = await fetch(`/api/clause-library/${selectedClause.id}`);
                        if (updatedResponse.ok) {
                          const updated = await updatedResponse.json();
                          setSelectedClause(updated);
                        }
                        toast({
                          title: "Tag added",
                          description: `Tag "${tagName}" has been added to the clause`,
                        });
                      } else {
                        throw new Error("Failed to add tag");
                      }
                    } catch (_error) {
                      toast({
                        title: "Error",
                        description: "Failed to add tag",
                        variant: "destructive",
                      });
                    }
                  }}
                  onRemoveTag={async (tagName) => {
                    try {
                      const response = await fetch(`/api/clause-library/${selectedClause.id}/tags`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tagName }),
                      });
                      
                      if (response.ok) {
                        // Refresh clause data
                        const updatedResponse = await fetch(`/api/clause-library/${selectedClause.id}`);
                        if (updatedResponse.ok) {
                          const updated = await updatedResponse.json();
                          setSelectedClause(updated);
                        }
                        toast({
                          title: "Tag removed",
                          description: `Tag "${tagName}" has been removed`,
                        });
                      } else {
                        throw new Error("Failed to remove tag");
                      }
                    } catch (_error) {
                      toast({
                        title: "Error",
                        description: "Failed to remove tag",
                        variant: "destructive",
                      });
                    }
                  }}
                />
              )}

              <ClauseSharingControls
                open={sharingDialogOpen}
                onOpenChange={setSharingDialogOpen}
                clauseId={selectedClause.id}
                currentSettings={{
                  sharingLevel: selectedClause.sharingLevel,
                  sharedWithOrgIds: selectedClause.sharedWithOrgIds,
                  isAnonymized: selectedClause.isAnonymized,
                  originalEmployerName: selectedClause.originalEmployerName,
                  anonymizedEmployerName: selectedClause.anonymizedEmployerName,
                }}
                onSave={async (settings) => {
                  try {
                    const response = await fetch(`/api/clause-library/${selectedClause.id}/share`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(settings),
                    });
                    
                    if (response.ok) {
                      // Refresh clause data
                      const updatedResponse = await fetch(`/api/clause-library/${selectedClause.id}`);
                      if (updatedResponse.ok) {
                        const updated = await updatedResponse.json();
                        setSelectedClause(updated);
                      }
                      toast({
                        title: "Sharing updated",
                        description: "Clause sharing settings have been updated",
                      });
                      setSharingDialogOpen(false);
                    } else {
                      throw new Error("Failed to update sharing");
                    }
                  } catch (_error) {
                    toast({
                      title: "Error",
                      description: "Failed to update sharing settings",
                      variant: "destructive",
                    });
                  }
                }}
              />
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No clause selected. Click on a clause from the browse tab to view it.
            </div>
          )}
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare">
          {isLoadingComparison ? (
            <div className="text-center py-12 text-muted-foreground">Loading comparison...</div>
          ) : comparisonData ? (
            <ClauseCompareView
              clauses={comparisonData.clauses}
              analysis={comparisonData.analysis}
              onRemoveClause={handleRemoveFromComparison}
              onExport={() => {
                // Generate text report
                let report = "CLAUSE COMPARISON REPORT\n";
                report += "=".repeat(80) + "\n\n";
                report += `Generated: ${new Date().toLocaleString()}\n`;
                report += `Comparing ${comparisonData.clauses.length} clauses\n\n`;
                
                if (comparisonNotes) {
                  report += "NOTES:\n";
                  report += comparisonNotes + "\n\n";
                }
                
                report += "ANALYSIS SUMMARY\n";
                report += "-".repeat(80) + "\n";
                report += `Total Clauses: ${comparisonData.analysis?.statistics.totalClauses || 0}\n`;
                report += `Average Length: ${comparisonData.analysis?.statistics.averageTextLength || 0} characters\n`;
                report += `Unique Types: ${comparisonData.analysis?.statistics.uniqueTypes || 0}\n`;
                report += `Unique Sectors: ${comparisonData.analysis?.statistics.uniqueSectors || 0}\n\n`;
                
                if (comparisonData.analysis?.commonKeywords?.length > 0) {
                  report += "Common Keywords: " + comparisonData.analysis.commonKeywords.join(", ") + "\n\n";
                }
                
                report += "CLAUSES\n";
                report += "=".repeat(80) + "\n\n";
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                comparisonData.clauses.forEach((clause: any, index: number) => {
                  report += `${index + 1}. ${clause.clauseTitle}\n`;
                  report += "-".repeat(80) + "\n";
                  report += `Organization: ${clause.sourceOrganization?.organizationName || "Unknown"}\n`;
                  report += `Type: ${clause.clauseType}\n`;
                  report += `Sharing Level: ${clause.sharingLevel}\n`;
                  if (clause.sector) report += `Sector: ${clause.sector}\n`;
                  if (clause.province) report += `Province: ${clause.province}\n`;
                  if (clause.effectiveDate) report += `Effective: ${clause.effectiveDate}\n`;
                  report += `\nClause Text:\n${clause.clauseText}\n\n`;
                  if (clause.tags?.length > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    report += `Tags: ${clause.tags.map((t: any) => t.tagName).join(", ")}\n`;
                  }
                  report += "\n";
                });
                
                // Download as text file
                const blob = new Blob([report], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `clause-comparison-${new Date().toISOString().split("T")[0]}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                toast({
                  title: "Report exported",
                  description: "Comparison report has been downloaded",
                });
              }}
              comparisonNotes={comparisonNotes}
              onNotesChange={setComparisonNotes}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Select at least 2 clauses to compare
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
