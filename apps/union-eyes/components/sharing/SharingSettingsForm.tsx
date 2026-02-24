"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Shield, FileText, Scale, BarChart3, Save, AlertCircle } from "lucide-react";

interface SharingSettings {
  organization_id: string;
  enable_clause_sharing: boolean;
  default_clause_sharing_level: "private" | "federation" | "congress" | "public";
  auto_anonymize_clauses: boolean;
  enable_precedent_sharing: boolean;
  default_precedent_sharing_level: "private" | "federation" | "congress" | "public";
  always_redact_member_names: boolean;
  enable_analytics_sharing: boolean;
  share_member_counts: boolean;
  share_financial_data: boolean;
  share_claims_data: boolean;
}

interface SharingSettingsFormProps {
  organizationId: string;
  initialSettings?: SharingSettings;
  onSave?: (settings: SharingSettings) => void;
}

export default function SharingSettingsForm({
  organizationId,
  initialSettings,
  onSave,
}: SharingSettingsFormProps) {
  const [settings, setSettings] = useState<SharingSettings>(
    initialSettings || {
      organization_id: organizationId,
      enable_clause_sharing: false,
      default_clause_sharing_level: "federation",
      auto_anonymize_clauses: true,
      enable_precedent_sharing: false,
      default_precedent_sharing_level: "federation",
      always_redact_member_names: true,
      enable_analytics_sharing: false,
      share_member_counts: true,
      share_financial_data: false,
      share_claims_data: true,
    }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleToggle = (field: keyof SharingSettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleSelectChange = (field: keyof SharingSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/sharing-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }

      const updated = await response.json();
      setSettings(updated);
      setSaveSuccess(true);
      onSave?.(updated);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clause Library Sharing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Clause Library Sharing</CardTitle>
              <CardDescription>
                Control how your collective bargaining clauses are shared with other unions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-clause-sharing">Enable Clause Sharing</Label>
              <div className="text-sm text-muted-foreground">
                Allow other unions to view your shared clauses
              </div>
            </div>
            <Switch
              id="enable-clause-sharing"
              checked={settings.enable_clause_sharing}
              onCheckedChange={(checked) => handleToggle("enable_clause_sharing", checked)}
            />
          </div>

          {settings.enable_clause_sharing && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clause-sharing-level">Default Sharing Level</Label>
                  <Select
                    value={settings.default_clause_sharing_level}
                    onValueChange={(value) =>
                      handleSelectChange("default_clause_sharing_level", value)
                    }
                  >
                    <SelectTrigger id="clause-sharing-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private (Only this organization)</SelectItem>
                      <SelectItem value="federation">Federation (Your federation members)</SelectItem>
                      <SelectItem value="congress">Congress (All CLC members)</SelectItem>
                      <SelectItem value="public">Public (Everyone)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This will be the default level for new shared clauses
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-anonymize">Auto-Anonymize Employer Names</Label>
                    <div className="text-sm text-muted-foreground">
                      Automatically hide employer names in shared clauses
                    </div>
                  </div>
                  <Switch
                    id="auto-anonymize"
                    checked={settings.auto_anonymize_clauses}
                    onCheckedChange={(checked) => handleToggle("auto_anonymize_clauses", checked)}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Arbitration Precedents Sharing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Arbitration Precedents Sharing</CardTitle>
              <CardDescription>
                Control how arbitration cases and decisions are shared
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-precedent-sharing">Enable Precedent Sharing</Label>
              <div className="text-sm text-muted-foreground">
                Allow other unions to view your arbitration precedents
              </div>
            </div>
            <Switch
              id="enable-precedent-sharing"
              checked={settings.enable_precedent_sharing}
              onCheckedChange={(checked) => handleToggle("enable_precedent_sharing", checked)}
            />
          </div>

          {settings.enable_precedent_sharing && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="precedent-sharing-level">Default Sharing Level</Label>
                  <Select
                    value={settings.default_precedent_sharing_level}
                    onValueChange={(value) =>
                      handleSelectChange("default_precedent_sharing_level", value)
                    }
                  >
                    <SelectTrigger id="precedent-sharing-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private (Only this organization)</SelectItem>
                      <SelectItem value="federation">Federation (Your federation members)</SelectItem>
                      <SelectItem value="congress">Congress (All CLC members)</SelectItem>
                      <SelectItem value="public">Public (Everyone)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="redact-member-names">Always Redact Member Names</Label>
                    <div className="text-sm text-muted-foreground">
                      Remove member names from all shared precedents (recommended)
                    </div>
                  </div>
                  <Switch
                    id="redact-member-names"
                    checked={settings.always_redact_member_names}
                    onCheckedChange={(checked) =>
                      handleToggle("always_redact_member_names", checked)
                    }
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Analytics Sharing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Analytics Sharing</CardTitle>
              <CardDescription>
                Control what data is included in cross-union analytics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-analytics-sharing">Enable Analytics Sharing</Label>
              <div className="text-sm text-muted-foreground">
                Include your organization in aggregate analytics
              </div>
            </div>
            <Switch
              id="enable-analytics-sharing"
              checked={settings.enable_analytics_sharing}
              onCheckedChange={(checked) => handleToggle("enable_analytics_sharing", checked)}
            />
          </div>

          {settings.enable_analytics_sharing && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="share-member-counts">Share Member Counts</Label>
                    <div className="text-sm text-muted-foreground">
                      Include membership size in analytics
                    </div>
                  </div>
                  <Switch
                    id="share-member-counts"
                    checked={settings.share_member_counts}
                    onCheckedChange={(checked) => handleToggle("share_member_counts", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="share-financial-data">Share Financial Data</Label>
                    <div className="text-sm text-muted-foreground">
                      Include strike fund and financial metrics
                    </div>
                  </div>
                  <Switch
                    id="share-financial-data"
                    checked={settings.share_financial_data}
                    onCheckedChange={(checked) => handleToggle("share_financial_data", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="share-claims-data">Share Claims Data</Label>
                    <div className="text-sm text-muted-foreground">
                      Include claim types and resolution metrics
                    </div>
                  </div>
                  <Switch
                    id="share-claims-data"
                    checked={settings.share_claims_data}
                    onCheckedChange={(checked) => handleToggle("share_claims_data", checked)}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Privacy Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Privacy Notice:</strong> All sharing is opt-in. You control what is shared and with whom.
          You can revoke sharing access at any time. Access logs track all cross-organization data access.
        </AlertDescription>
      </Alert>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {saveSuccess && (
            <p className="text-sm text-green-600">Settings saved successfully</p>
          )}
          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{saveError}</span>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

