/**
 * Grievance Intake Review
 *
 * Review screen that displays all entered data before submission.
 * Read-only summary with edit-back navigation per section.
 * Professional, print-friendly layout.
 *
 * @module components/grievances/grievance-intake-review
 */

"use client";

import * as React from "react";
import { format } from "date-fns";
import { AlertCircle, ChevronRight, Shield, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface GrievanceIntakeData {
  // Step 1 - Member
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  memberNumber: string;
  localChapter: string;
  // Step 2 - Employer
  employerName: string;
  workplaceName: string;
  department: string;
  branch: string;
  supervisorName: string;
  // Step 3 - Issue
  grievanceType: string;
  issueDate: Date | null;
  urgency: string;
  workplaceSafetyFlag: boolean;
  harassmentFlag: boolean;
  discriminationFlag: boolean;
  accommodationFlag: boolean;
  // Step 4 - Description
  title: string;
  description: string;
  location: string;
  desiredResolution: string;
  // Step 5 - Documents
  attachments: string[];
}

interface ReviewSectionProps {
  title: string;
  stepIndex: number;
  onEdit?: (step: number) => void;
  children: React.ReactNode;
}

function ReviewSection({ title, stepIndex, onEdit, children }: ReviewSectionProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(stepIndex)}
            className="text-blue-600 hover:text-blue-700 -mr-2"
          >
            Edit
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
}

function ReviewField({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">
        {value || <span className="text-muted-foreground italic">Not provided</span>}
      </dd>
    </div>
  );
}

export interface GrievanceIntakeReviewProps {
  data: GrievanceIntakeData;
  onEdit?: (stepIndex: number) => void;
}

const GRIEVANCE_TYPE_LABELS: Record<string, string> = {
  individual: "Individual Grievance",
  group: "Group Grievance",
  policy: "Policy Grievance",
  contract: "Contract Violation",
  harassment: "Harassment",
  discrimination: "Discrimination",
  safety: "Workplace Safety",
  seniority: "Seniority Dispute",
  discipline: "Discipline",
  termination: "Termination",
  other: "Other",
};

const URGENCY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent — Immediate attention required",
};

export function GrievanceIntakeReview({ data, onEdit }: GrievanceIntakeReviewProps) {
  const flagsActive = [
    data.workplaceSafetyFlag && "Workplace Safety",
    data.harassmentFlag && "Harassment",
    data.discriminationFlag && "Discrimination",
    data.accommodationFlag && "Accommodation",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      {/* Advisory banner */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-900 dark:text-blue-200">
          <p className="font-medium mb-1">Please review your intake carefully</p>
          <p>
            Once submitted, your intake will be reviewed by a steward. If approved,
            a formal case will be created with a case number. You can add documents and notes after submission.
          </p>
        </div>
      </div>

      {/* Flags alert */}
      {flagsActive.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
              Sensitive flags active
            </p>
            <div className="flex flex-wrap gap-1.5">
              {flagsActive.map((flag) => (
                <Badge key={flag} variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  {flag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Member Details */}
      <ReviewSection title="Member Details" stepIndex={0} onEdit={onEdit}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReviewField label="Full Name" value={data.memberName} />
          <ReviewField label="Membership Number" value={data.memberNumber} />
          <ReviewField label="Email" value={data.memberEmail} />
          <ReviewField label="Phone" value={data.memberPhone} />
          <ReviewField label="Local / Chapter" value={data.localChapter} />
        </dl>
      </ReviewSection>

      {/* Employer / Workplace */}
      <ReviewSection title="Employer & Workplace" stepIndex={1} onEdit={onEdit}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReviewField label="Employer" value={data.employerName} />
          <ReviewField label="Workplace" value={data.workplaceName} />
          <ReviewField label="Department" value={data.department} />
          <ReviewField label="Branch" value={data.branch} />
          <ReviewField label="Supervisor" value={data.supervisorName} />
        </dl>
      </ReviewSection>

      {/* Issue Type */}
      <ReviewSection title="Issue Classification" stepIndex={2} onEdit={onEdit}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReviewField label="Grievance Type" value={GRIEVANCE_TYPE_LABELS[data.grievanceType] ?? data.grievanceType} />
          <ReviewField label="Issue Date" value={data.issueDate ? format(data.issueDate, "PPP") : undefined} />
          <ReviewField label="Urgency" value={URGENCY_LABELS[data.urgency] ?? data.urgency} />
        </dl>
      </ReviewSection>

      {/* Incident Description */}
      <ReviewSection title="Incident Description" stepIndex={3} onEdit={onEdit}>
        <dl className="space-y-4">
          <ReviewField label="Title" value={data.title} />
          <ReviewField label="Location" value={data.location} />
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded p-3">
              {data.description || <span className="text-muted-foreground italic">Not provided</span>}
            </dd>
          </div>
          <ReviewField label="Desired Resolution" value={data.desiredResolution} />
        </dl>
      </ReviewSection>

      {/* Documents */}
      <ReviewSection title="Supporting Documents" stepIndex={4} onEdit={onEdit}>
        {data.attachments.length > 0 ? (
          <ul className="space-y-1">
            {data.attachments.map((file, i) => (
              <li key={i} className="text-sm text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {file}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic">No documents attached</p>
        )}
      </ReviewSection>
    </div>
  );
}
