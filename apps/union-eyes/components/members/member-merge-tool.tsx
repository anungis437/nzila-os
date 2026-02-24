/**
 * Member Merge Tool Component
 * 
 * Tool for merging duplicate member records with:
 * - Side-by-side comparison
 * - Field selection
 * - Conflict resolution
 * - Audit trail
 * - Activity consolidation
 * 
 * @module components/members/member-merge-tool
 */

"use client";

import * as React from "react";
import {
  ArrowRight,
  AlertTriangle,
  Info,
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface MemberRecord {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  employer?: string;
  department?: string;
  jobTitle?: string;
  joinDate: Date;
  seniorityDate?: Date;
  claimsCount: number;
  eventsAttended: number;
  duesStatus: string;
  lastActivity?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MergeField {
  key: keyof MemberRecord;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "personal" | "employment" | "union" | "stats";
}

export interface MemberMergeToolProps {
  primaryMember: MemberRecord;
  duplicateMember: MemberRecord;
  onMerge: (mergedData: Partial<MemberRecord>, notes: string) => Promise<void>;
  onCancel?: () => void;
}

const mergeFields: MergeField[] = [
  // Personal
  { key: "firstName", label: "First Name", icon: User, category: "personal" },
  { key: "lastName", label: "Last Name", icon: User, category: "personal" },
  { key: "email", label: "Email", icon: Mail, category: "personal" },
  { key: "phone", label: "Phone", icon: Phone, category: "personal" },
  { key: "address", label: "Address", icon: User, category: "personal" },
  { key: "city", label: "City", icon: User, category: "personal" },
  { key: "state", label: "State", icon: User, category: "personal" },
  { key: "zipCode", label: "Zip Code", icon: User, category: "personal" },
  
  // Employment
  { key: "employer", label: "Employer", icon: Briefcase, category: "employment" },
  { key: "department", label: "Department", icon: Briefcase, category: "employment" },
  { key: "jobTitle", label: "Job Title", icon: Briefcase, category: "employment" },
  
  // Union
  { key: "memberNumber", label: "Member Number", icon: FileText, category: "union" },
  { key: "joinDate", label: "Join Date", icon: Calendar, category: "union" },
  { key: "seniorityDate", label: "Seniority Date", icon: Calendar, category: "union" },
];

export function MemberMergeTool({
  primaryMember,
  duplicateMember,
  onMerge,
  onCancel,
}: MemberMergeToolProps) {
  const { toast } = useToast();
  const [selectedValues, setSelectedValues] = React.useState<
    Partial<Record<keyof MemberRecord, string>>
  >({});
  const [mergeNotes, setMergeNotes] = React.useState("");
  const [isMerging, setIsMerging] = React.useState(false);

  // Initialize with primary member values
  React.useEffect(() => {
    const initial: Partial<Record<keyof MemberRecord, string>> = {};
    mergeFields.forEach((field) => {
      initial[field.key] = "primary";
    });
    setSelectedValues(initial);
  }, []);

  const handleFieldSelect = (fieldKey: keyof MemberRecord, source: "primary" | "duplicate") => {
    setSelectedValues((prev) => ({
      ...prev,
      [fieldKey]: source,
    }));
  };

  const getMergedData = (): Partial<MemberRecord> => {
    const merged: Partial<MemberRecord> = { id: primaryMember.id };
    
    mergeFields.forEach((field) => {
      const source = selectedValues[field.key] === "primary" ? primaryMember : duplicateMember;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      merged[field.key] = source[field.key] as any;
    });

    // Always sum statistics
    merged.claimsCount = primaryMember.claimsCount + duplicateMember.claimsCount;
    merged.eventsAttended = primaryMember.eventsAttended + duplicateMember.eventsAttended;

    return merged;
  };

  const handleMerge = async () => {
    if (!mergeNotes.trim()) {
      toast({
        title: "Notes required",
        description: "Please provide notes for this merge operation",
        variant: "destructive",
      });
      return;
    }

    setIsMerging(true);
    try {
      const mergedData = getMergedData();
      await onMerge(mergedData, mergeNotes);
      toast({
        title: "Merge successful",
        description: "Member records have been merged successfully",
      });
    } catch (error) {
      toast({
        title: "Merge failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  const conflicts = mergeFields.filter((field) => {
    const primaryValue = primaryMember[field.key];
    const duplicateValue = duplicateMember[field.key];
    return primaryValue !== duplicateValue && primaryValue && duplicateValue;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Warning Banner */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-yellow-900">
                Warning: This action cannot be undone
              </p>
              <p className="text-sm text-yellow-800 mt-1">
                Merging will permanently combine these member records. The duplicate record 
                will be archived and all associated data will be transferred to the primary record.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Merge Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {conflicts.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Conflicts Found</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {primaryMember.claimsCount + duplicateMember.claimsCount}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Claims</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">
                {primaryMember.eventsAttended + duplicateMember.eventsAttended}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Events</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Select Field Values</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Headers */}
          <div className="grid grid-cols-[200px_1fr_80px_1fr] gap-4 pb-4 border-b">
            <div className="font-medium text-gray-500">Field</div>
            <div className="text-center">
              <MemberHeader member={primaryMember} label="Primary Record" />
            </div>
            <div />
            <div className="text-center">
              <MemberHeader member={duplicateMember} label="Duplicate Record" />
            </div>
          </div>

          {/* Field Rows */}
          {["personal", "employment", "union"].map((category) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                {category}
              </h3>
              <div className="space-y-3">
                {mergeFields
                  .filter((field) => field.category === category)
                  .map((field) => (
                    <FieldComparisonRow
                      key={field.key}
                      field={field}
                      primaryValue={primaryMember[field.key]}
                      duplicateValue={duplicateMember[field.key]}
                      selectedSource={selectedValues[field.key] || "primary"}
                      onSelect={(source) => handleFieldSelect(field.key, source)}
                    />
                  ))}
              </div>
            </div>
          ))}

          {/* Statistics (read-only, will be summed) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
              Statistics
              <Badge variant="outline" className="text-xs">
                Auto-combined
              </Badge>
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Claims:</span>
                <span>
                  {primaryMember.claimsCount} + {duplicateMember.claimsCount} = 
                  <strong className="ml-2">
                    {primaryMember.claimsCount + duplicateMember.claimsCount}
                  </strong>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Events Attended:</span>
                <span>
                  {primaryMember.eventsAttended} + {duplicateMember.eventsAttended} = 
                  <strong className="ml-2">
                    {primaryMember.eventsAttended + duplicateMember.eventsAttended}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Merge Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Merge Notes *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Provide detailed notes about why these records are being merged, including how duplicates were identified..."
            rows={4}
            value={mergeNotes}
            onChange={(e) => setMergeNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleMerge} disabled={isMerging || !mergeNotes.trim()}>
          {isMerging ? "Merging..." : "Complete Merge"}
        </Button>
      </div>
    </div>
  );
}

function MemberHeader({ member, label }: { member: MemberRecord; label: string }) {
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  return (
    <div className="flex items-center gap-3 justify-center">
      <Avatar className="h-8 w-8">
        <AvatarImage src={member.avatar} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="text-left">
        <div className="font-medium">
          {member.firstName} {member.lastName}
        </div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function FieldComparisonRow({
  field,
  primaryValue,
  duplicateValue,
  selectedSource,
  onSelect,
}: {
  field: MergeField;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  primaryValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  duplicateValue: any;
  selectedSource: string;
  onSelect: (source: "primary" | "duplicate") => void;
}) {
  const Icon = field.icon;
  const hasConflict = primaryValue !== duplicateValue && primaryValue && duplicateValue;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatValue = (value: any) => {
    if (!value) return "—";
    if (value instanceof Date) return format(value, "PPP");
    return String(value);
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[200px_1fr_80px_1fr] gap-4 items-center p-3 rounded-lg",
        hasConflict ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-gray-400" />
        {field.label}
        {hasConflict && (
          <AlertTriangle className="h-3 w-3 text-yellow-600" />
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="radio"
          checked={selectedSource === "primary"}
          onChange={() => onSelect("primary")}
          className="shrink-0"
        />
        <span className="text-sm truncate">{formatValue(primaryValue)}</span>
      </div>

      <div className="flex justify-center">
        <ArrowRight className="h-4 w-4 text-gray-400" />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="radio"
          checked={selectedSource === "duplicate"}
          onChange={() => onSelect("duplicate")}
          className="shrink-0"
        />
        <span className="text-sm truncate">{formatValue(duplicateValue)}</span>
      </div>
    </div>
  );
}

