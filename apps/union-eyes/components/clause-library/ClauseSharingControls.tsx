"use client";

/**
 * Phase 5B: Clause Sharing Controls Component
 * Dialog for managing clause sharing settings
 */

import { useState, useEffect } from "react";
import { Shield, Building2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
 
import {
  Select as _Select,
} from "@/components/ui/select";
 
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Organization {
  id: string;
  organizationName: string;
  organizationLevel: string;
}

interface ClauseSharingControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clauseId: string;
  currentSettings: {
    sharingLevel: "private" | "federation" | "congress" | "public";
    sharedWithOrgIds?: string[];
    isAnonymized: boolean;
    originalEmployerName?: string;
    anonymizedEmployerName?: string;
  };
  availableOrganizations?: Organization[];
  onSave: (settings: {
    sharingLevel: "private" | "federation" | "congress" | "public";
    sharedWithOrgIds?: string[];
    isAnonymized: boolean;
    anonymizedEmployerName?: string;
  }) => Promise<void>;
}

const SHARING_LEVELS = [
  {
    value: "private",
    label: "Private",
    description: "Only accessible to your organization and explicitly granted organizations",
    icon: EyeOff,
  },
  {
    value: "federation",
    label: "Federation",
    description: "Shared with all organizations in your federation",
    icon: Building2,
  },
  {
    value: "congress",
    label: "Congress",
    description: "Shared with all CLC member organizations across all federations",
    icon: Building2,
  },
  {
    value: "public",
    label: "Public",
    description: "Publicly accessible to all users",
    icon: Eye,
  },
] as const;

export function ClauseSharingControls({
  open,
  onOpenChange,
  clauseId: _clauseId,
  currentSettings,
  availableOrganizations = [],
  onSave,
}: ClauseSharingControlsProps) {
  const [sharingLevel, setSharingLevel] = useState<
    "private" | "federation" | "congress" | "public"
  >(currentSettings.sharingLevel);
  const [sharedWithOrgIds, setSharedWithOrgIds] = useState<string[]>(
    currentSettings.sharedWithOrgIds || []
  );
  const [isAnonymized, setIsAnonymized] = useState(currentSettings.isAnonymized);
  const [anonymizedEmployerName, setAnonymizedEmployerName] = useState(
    currentSettings.anonymizedEmployerName || "Anonymous Employer"
  );
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens or settings change
  useEffect(() => {
    setSharingLevel(currentSettings.sharingLevel);
    setSharedWithOrgIds(currentSettings.sharedWithOrgIds || []);
    setIsAnonymized(currentSettings.isAnonymized);
    setAnonymizedEmployerName(
      currentSettings.anonymizedEmployerName || "Anonymous Employer"
    );
  }, [open, currentSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        sharingLevel,
        sharedWithOrgIds: sharingLevel === "private" ? sharedWithOrgIds : undefined,
        isAnonymized,
        anonymizedEmployerName: isAnonymized ? anonymizedEmployerName : undefined,
      });
      onOpenChange(false);
    } catch (_error) {
} finally {
      setIsSaving(false);
    }
  };

  const toggleOrganization = (orgId: string) => {
    setSharedWithOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sharing Settings
          </DialogTitle>
          <DialogDescription>
            Control who can access this clause and manage privacy settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sharing Level */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Sharing Level</Label>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <RadioGroup value={sharingLevel} onValueChange={(value: any) => setSharingLevel(value)}>
              <div className="space-y-3">
                {SHARING_LEVELS.map((level) => {
                  const Icon = level.icon;
                  return (
                    <div key={level.value} className="flex items-start space-x-3">
                      <RadioGroupItem value={level.value} id={level.value} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={level.value} className="flex items-center gap-2 cursor-pointer">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{level.label}</span>
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {level.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Explicit Grants (only for private sharing) */}
          {sharingLevel === "private" && availableOrganizations.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Grant Access To</Label>
              <p className="text-sm text-muted-foreground">
                Select specific organizations that can access this private clause.
              </p>
              <div className="border rounded-md p-4 max-h-[200px] overflow-y-auto space-y-2">
                {availableOrganizations.map((org) => (
                  <div key={org.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`org-${org.id}`}
                      checked={sharedWithOrgIds.includes(org.id)}
                      onCheckedChange={() => toggleOrganization(org.id)}
                    />
                    <Label
                      htmlFor={`org-${org.id}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {org.organizationName}
                      <span className="text-muted-foreground ml-2">
                        ({org.organizationLevel})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anonymization */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Anonymization</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Protect sensitive employer information
                </p>
              </div>
              <Checkbox
                checked={isAnonymized}
                onCheckedChange={(checked) => setIsAnonymized(checked as boolean)}
              />
            </div>

            {isAnonymized && (
              <div className="space-y-2">
                <Label htmlFor="employer-name">Display Name</Label>
                <Input
                  id="employer-name"
                  value={anonymizedEmployerName}
                  onChange={(e) => setAnonymizedEmployerName(e.target.value)}
                  placeholder="Anonymous Employer"
                />
                {currentSettings.originalEmployerName && (
                  <p className="text-xs text-muted-foreground">
                    Original: {currentSettings.originalEmployerName}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Privacy Warning */}
          {(sharingLevel === "congress" || sharingLevel === "public") && (
            <Alert>
              <AlertDescription>
                <strong>Privacy Notice:</strong> This clause will be accessible to{" "}
                {sharingLevel === "congress"
                  ? "all CLC member organizations"
                  : "all users, including those outside the CLC"}
                . Member names are always redacted, but ensure no other sensitive information is
                included.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

