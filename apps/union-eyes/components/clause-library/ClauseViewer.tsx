"use client";

/**
 * Phase 5B: Clause Viewer Component
 * Displays single clause with metadata and actions
 */

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
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface ClauseViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clause: any;
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onCompare?: () => void;
  onShare?: () => void;
}

const SHARING_LEVEL_COLORS = {
  private: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  federation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  congress: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  public: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  wages: "Wages & Compensation",
  benefits: "Benefits",
  hours_of_work: "Hours of Work",
  overtime: "Overtime",
  vacation: "Vacation",
  sick_leave: "Sick Leave",
  grievance_procedure: "Grievance Procedure",
  discipline: "Discipline",
  seniority: "Seniority",
  health_safety: "Health & Safety",
  job_security: "Job Security",
  pension: "Pension",
  other: "Other",
};

export function ClauseViewer({
  clause,
  isOwner,
  onEdit,
  onDelete,
  onCompare,
  onShare,
}: ClauseViewerProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete?.();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {clause.clauseNumber && (
                <span className="text-muted-foreground mr-2">
                  {clause.clauseNumber}
                </span>
              )}
              {clause.clauseTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{clause.sourceOrganization?.organizationName}</span>
            {clause.isAnonymized && (
              <Badge variant="outline" className="ml-2">
                Anonymized
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {onCompare && (
            <Button variant="outline" size="sm" onClick={onCompare}>
              <GitCompare className="mr-2 h-4 w-4" />
              Compare
            </Button>
          )}
          {isOwner && (
            <>
              {onShare && (
                <Button variant="outline" size="sm" onClick={onShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              )}
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Clause?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the clause
                        from the shared library.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      </div>

      {/* Metadata Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Sharing Level */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sharing Level</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className={SHARING_LEVEL_COLORS[clause.sharingLevel as keyof typeof SHARING_LEVEL_COLORS]}>
              {clause.sharingLevel.charAt(0).toUpperCase() + clause.sharingLevel.slice(1)}
            </Badge>
          </CardContent>
        </Card>

        {/* Clause Type */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clause Type</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {CLAUSE_TYPE_LABELS[clause.clauseType] || clause.clauseType}
            </div>
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
                <span>{clause.viewCount || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <GitCompare className="h-3 w-3" />
                <span>{clause.comparisonCount || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Clause Text</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <p className="whitespace-pre-wrap">{clause.clauseText}</p>
          </div>
        </CardContent>
      </Card>

      {/* Additional Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Dates */}
            {(clause.effectiveDate || clause.expiryDate) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  <span>Dates</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {clause.effectiveDate && (
                    <div>
                      Effective: {format(new Date(clause.effectiveDate), "MMM d, yyyy")}
                    </div>
                  )}
                  {clause.expiryDate && (
                    <div>
                      Expiry: {format(new Date(clause.expiryDate), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Location & Sector */}
            {(clause.province || clause.sector) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4" />
                  <span>Location & Sector</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {clause.province && <div>Province: {clause.province}</div>}
                  {clause.sector && (
                    <div>
                      Sector: {clause.sector.charAt(0).toUpperCase() + clause.sector.slice(1)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Employer Info */}
          {(clause.originalEmployerName || clause.anonymizedEmployerName) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  <span>Employer</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {clause.isAnonymized
                    ? clause.anonymizedEmployerName || "Anonymous Employer"
                    : clause.originalEmployerName}
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          {clause.tags && clause.tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" />
                  <span>Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {clause.tags.map((tag: any) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.tagName}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Version */}
          {clause.version > 1 && (
            <>
              <Separator />
              <div className="text-sm text-muted-foreground">
                Version {clause.version}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Source CBA Info */}
      {clause.sourceCba && (
        <Card>
          <CardHeader>
            <CardTitle>Source Agreement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Employer: </span>
              {clause.sourceCba.employerName}
            </div>
            {clause.sourceCba.effectiveDate && (
              <div className="text-sm text-muted-foreground">
                Effective: {format(new Date(clause.sourceCba.effectiveDate), "MMM d, yyyy")}
                {clause.sourceCba.expiryDate && (
                  <> - {format(new Date(clause.sourceCba.expiryDate), "MMM d, yyyy")}</>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground">
        Created {format(new Date(clause.createdAt), "MMM d, yyyy 'at' h:mm a")}
        {clause.updatedAt !== clause.createdAt && (
          <> · Updated {format(new Date(clause.updatedAt), "MMM d, yyyy 'at' h:mm a")}</>
        )}
      </div>
    </div>
  );
}

