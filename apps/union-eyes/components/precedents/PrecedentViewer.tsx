/**
 * Phase 5B: Precedent Viewer Component
 * 
 * Displays detailed view of a single arbitration precedent with:
 * - Case information (title, number, date)
 * - Parties information (union, employer, anonymization status)
 * - Arbitrator and tribunal details
 * - Grievance type and outcome
 * - Decision content and reasoning
 * - Precedent level and citations
 * - Documents (decision and redacted)
 * - Action buttons (View, Compare, Share, Edit, Delete)
 * - Owner-only restrictions on Edit/Delete
 */

"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Eye,
  GitCompare,
  Share2,
  Edit,
  Trash2,
  Building2,
  Calendar,
  MapPin,
  Briefcase,
  Shield,
  Tag,
  TrendingUp,
  FileText,
  Download,
  Scale,
  Users,
  Gavel,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Sharing level colors
const SHARING_LEVEL_COLORS = {
  private: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  federation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  congress: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  public: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

// Outcome colors
const OUTCOME_COLORS = {
  upheld: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  dismissed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  partially_upheld: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  settled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// Precedent level colors
const PRECEDENT_LEVEL_COLORS = {
  binding: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  persuasive: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  informative: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// Grievance type labels (formatted)
const GRIEVANCE_TYPE_LABELS: Record<string, string> = {
  discipline: "Discipline",
  discharge: "Discharge",
  suspension: "Suspension",
  policy_grievance: "Policy Grievance",
  harassment: "Harassment",
  discrimination: "Discrimination",
  health_safety: "Health & Safety",
  job_classification: "Job Classification",
  layoff: "Layoff",
  recall: "Recall",
  overtime: "Overtime",
  hours_of_work: "Hours of Work",
  leave: "Leave",
  benefits: "Benefits",
  seniority: "Seniority",
  transfer: "Transfer",
  promotion: "Promotion",
  demotion: "Demotion",
  contracting_out: "Contracting Out",
  technological_change: "Technological Change",
  union_security: "Union Security",
  union_business: "Union Business",
  strikes_lockouts: "Strikes & Lockouts",
  grievance_procedure: "Grievance Procedure",
  other: "Other",
};

interface PrecedentViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  precedent: any;
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onCompare?: () => void;
  onShare?: () => void;
  onDownloadDocument?: (documentType: "decision" | "redacted") => void;
}

export function PrecedentViewer({
  precedent,
  isOwner,
  onEdit,
  onDelete,
  onCompare,
  onShare,
  onDownloadDocument,
}: PrecedentViewerProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    try {
      setIsDeleting(true);
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {precedent.caseNumber} - {precedent.caseTitle}
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{precedent.organization?.name || "Unknown Organization"}</span>
            {precedent.isPartiesAnonymized && (
              <Badge variant="secondary" className="ml-2">
                Parties Anonymized
              </Badge>
            )}
            {precedent.isMemberNamesRedacted && (
              <Badge variant="secondary">
                Member Names Redacted
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onCompare && (
            <Button variant="outline" size="sm" onClick={onCompare}>
              <GitCompare className="h-4 w-4 mr-2" />
              Compare
            </Button>
          )}
          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          )}
          {isOwner && onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {isOwner && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Precedent</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this precedent? This action
                    cannot be undone. All citations and references to this precedent
                    will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Metadata Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {/* Sharing Level */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sharing Level</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              className={
                SHARING_LEVEL_COLORS[
                  precedent.sharingLevel as keyof typeof SHARING_LEVEL_COLORS
                ] || ""
              }
            >
              {precedent.sharingLevel?.charAt(0).toUpperCase() +
                precedent.sharingLevel?.slice(1)}
            </Badge>
          </CardContent>
        </Card>

        {/* Outcome */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outcome</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              className={
                OUTCOME_COLORS[
                  precedent.outcome as keyof typeof OUTCOME_COLORS
                ] || ""
              }
            >
              {precedent.outcome
                ?.split("_")
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")}
            </Badge>
          </CardContent>
        </Card>

        {/* Precedent Level */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precedent Level</CardTitle>
            <Gavel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              className={
                PRECEDENT_LEVEL_COLORS[
                  precedent.precedentLevel as keyof typeof PRECEDENT_LEVEL_COLORS
                ] || ""
              }
            >
              {precedent.precedentLevel?.charAt(0).toUpperCase() +
                precedent.precedentLevel?.slice(1)}
            </Badge>
          </CardContent>
        </Card>

        {/* Engagement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{precedent.viewCount || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <GitCompare className="h-3 w-3" />
                <span>{precedent.citationCount || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Case Information */}
      <Card>
        <CardHeader>
          <CardTitle>Case Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Decision Date */}
            {precedent.decisionDate && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  <span>Decision Date</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(precedent.decisionDate), "MMMM d, yyyy")}
                </div>
              </div>
            )}

            {/* Jurisdiction */}
            {precedent.jurisdiction && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4" />
                  <span>Jurisdiction</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {precedent.jurisdiction === "federal"
                    ? "Federal"
                    : precedent.jurisdiction.toUpperCase()}
                </div>
              </div>
            )}

            {/* Grievance Type */}
            {precedent.grievanceType && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="h-4 w-4" />
                  <span>Grievance Type</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {GRIEVANCE_TYPE_LABELS[precedent.grievanceType] ||
                    precedent.grievanceType}
                </div>
              </div>
            )}

            {/* Tribunal */}
            {precedent.tribunal && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  <span>Tribunal</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {precedent.tribunal}
                </div>
              </div>
            )}
          </div>

          {/* Arbitrator */}
          {precedent.arbitratorName && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Gavel className="h-4 w-4" />
                  <span>Arbitrator</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {precedent.arbitratorName}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Parties */}
      <Card>
        <CardHeader>
          <CardTitle>Parties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Union */}
            {precedent.unionName && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  <span>Union</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {precedent.unionName}
                </div>
              </div>
            )}

            {/* Employer */}
            {precedent.employerName && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  <span>Employer</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {precedent.employerName}
                </div>
              </div>
            )}
          </div>

          {/* Grievor Names */}
          {precedent.grievorNames && !precedent.isMemberNamesRedacted && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-sm font-medium">Grievor(s)</div>
                <div className="text-sm text-muted-foreground">
                  {precedent.grievorNames}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Issue Summary */}
      {precedent.issueSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Issue Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{precedent.issueSummary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positions */}
      {(precedent.unionPosition || precedent.employerPosition) && (
        <Card>
          <CardHeader>
            <CardTitle>Positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {precedent.unionPosition && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Union Position</div>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {precedent.unionPosition}
                  </p>
                </div>
              </div>
            )}

            {precedent.employerPosition && (
              <>
                {precedent.unionPosition && <Separator />}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Employer Position</div>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {precedent.employerPosition}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Decision Summary */}
      {precedent.decisionSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Decision Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{precedent.decisionSummary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reasoning */}
      {precedent.reasoning && (
        <Card>
          <CardHeader>
            <CardTitle>Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{precedent.reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Findings */}
      {precedent.keyFindings && (
        <Card>
          <CardHeader>
            <CardTitle>Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{precedent.keyFindings}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {(precedent.decisionDocumentUrl || precedent.redactedDocumentUrl) && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {precedent.decisionDocumentUrl && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Decision Document</div>
                    <div className="text-xs text-muted-foreground">
                      Full arbitration decision
                    </div>
                  </div>
                </div>
                {onDownloadDocument && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownloadDocument("decision")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            )}

            {precedent.redactedDocumentUrl && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Redacted Document</div>
                    <div className="text-xs text-muted-foreground">
                      Document with confidential information removed
                    </div>
                  </div>
                </div>
                {onDownloadDocument && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownloadDocument("redacted")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Details */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Sector & Industry */}
            {(precedent.sector || precedent.industry) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="h-4 w-4" />
                  <span>Sector & Industry</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {precedent.sector && (
                    <div>
                      Sector:{" "}
                      {precedent.sector.charAt(0).toUpperCase() +
                        precedent.sector.slice(1)}
                    </div>
                  )}
                  {precedent.industry && <div>Industry: {precedent.industry}</div>}
                </div>
              </div>
            )}

            {/* Bargaining Unit Size */}
            {precedent.bargainingUnitSize && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  <span>Bargaining Unit Size</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {precedent.bargainingUnitSize} members
                </div>
              </div>
            )}
          </div>

          {/* Cited Cases */}
          {precedent.citedCases && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Scale className="h-4 w-4" />
                  <span>Cited Cases</span>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {precedent.citedCases}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          {precedent.tags && precedent.tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" />
                  <span>Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {precedent.tags.map((tag: any) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.tagName}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Source Arbitration Decision */}
      {precedent.sourceArbitrationDecision && (
        <Card>
          <CardHeader>
            <CardTitle>Source Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Case: </span>
              {precedent.sourceArbitrationDecision.caseNumber}
            </div>
            {precedent.sourceArbitrationDecision.decisionDate && (
              <div className="text-sm text-muted-foreground">
                Decided:{" "}
                {format(
                  new Date(precedent.sourceArbitrationDecision.decisionDate),
                  "MMM d, yyyy"
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground">
        Created {format(new Date(precedent.createdAt), "MMM d, yyyy 'at' h:mm a")}
        {precedent.updatedAt !== precedent.createdAt && (
          <>
            {" "}
            · Updated{" "}
            {format(new Date(precedent.updatedAt), "MMM d, yyyy 'at' h:mm a")}
          </>
        )}
      </div>
    </div>
  );
}

