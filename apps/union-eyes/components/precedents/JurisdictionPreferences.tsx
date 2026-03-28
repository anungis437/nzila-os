"use client";

/**
 * Jurisdiction Preferences Component
 *
 * Allows users to select their preferred jurisdictions and levels
 * for filtering arbitration precedents. Displayed in Settings > Preferences
 * and as an onboarding step on first visit to the Precedents console.
 */

import { useState, useEffect, useCallback } from "react";
import { MapPin, Globe, Building2, Scale, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/use-toast";

const JURISDICTIONS = [
  { value: "federal", label: "Federal", labelFr: "Fédéral", icon: Globe },
  { value: "ON", label: "Ontario", labelFr: "Ontario", icon: MapPin },
  { value: "QC", label: "Quebec", labelFr: "Québec", icon: MapPin },
  { value: "BC", label: "British Columbia", labelFr: "Colombie-Britannique", icon: MapPin },
  { value: "AB", label: "Alberta", labelFr: "Alberta", icon: MapPin },
  { value: "MB", label: "Manitoba", labelFr: "Manitoba", icon: MapPin },
  { value: "SK", label: "Saskatchewan", labelFr: "Saskatchewan", icon: MapPin },
  { value: "NS", label: "Nova Scotia", labelFr: "Nouvelle-Écosse", icon: MapPin },
  { value: "NB", label: "New Brunswick", labelFr: "Nouveau-Brunswick", icon: MapPin },
  { value: "PE", label: "Prince Edward Island", labelFr: "Île-du-Prince-Édouard", icon: MapPin },
  { value: "NL", label: "Newfoundland and Labrador", labelFr: "Terre-Neuve-et-Labrador", icon: MapPin },
  { value: "YT", label: "Yukon", labelFr: "Yukon", icon: MapPin },
  { value: "NT", label: "Northwest Territories", labelFr: "Territoires du Nord-Ouest", icon: MapPin },
  { value: "NU", label: "Nunavut", labelFr: "Nunavut", icon: MapPin },
];

const LEVELS = [
  {
    value: "federal",
    label: "Federal",
    description: "Canada Labour Relations Board, Federal Public Service Labour Relations Board",
    icon: Globe,
  },
  {
    value: "provincial",
    label: "Provincial",
    description: "OLRB, TAT, BCLRB, ALRB and other provincial labour relations boards",
    icon: Building2,
  },
  {
    value: "municipal",
    label: "Municipal",
    description: "Municipal and regional labour arbitration tribunals",
    icon: MapPin,
  },
];

interface JurisdictionPreferencesProps {
  /** Called when preferences are saved, for parent to refresh data */
  onSaved?: () => void;
  /** Compact mode for inline display (e.g., onboarding wizard) */
  compact?: boolean;
}

export function JurisdictionPreferences({ onSaved, compact }: JurisdictionPreferencesProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [includeNational, setIncludeNational] = useState(true);
  const [autoApply, setAutoApply] = useState(true);

  // Load existing preferences
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/precedents/jurisdiction-preferences");
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          setSelectedJurisdictions(data.preferredJurisdictions ?? []);
          setSelectedLevels(data.preferredLevels ?? []);
          setIncludeNational(data.includeNational ?? true);
          setAutoApply(data.autoApply ?? true);
          setIsConfigured(data.isConfigured ?? false);
        }
      } catch {
        // silently fail — defaults are fine
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const toggleJurisdiction = useCallback((value: string) => {
    setSelectedJurisdictions((prev) =>
      prev.includes(value) ? prev.filter((j) => j !== value) : [...prev, value]
    );
  }, []);

  const toggleLevel = useCallback((value: string) => {
    setSelectedLevels((prev) =>
      prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value]
    );
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/precedents/jurisdiction-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredJurisdictions: selectedJurisdictions,
          preferredLevels: selectedLevels,
          includeNational,
          autoApply,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save preferences");
      }

      setIsConfigured(true);
      toast({
        title: "Preferences saved",
        description: "Your jurisdiction preferences have been updated. Precedent results will now reflect your selections.",
      });
      onSaved?.();
    } catch (e) {
      toast({
        title: "Error saving preferences",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* Header — only show outside compact mode */}
      {!compact && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Jurisdiction Preferences
            </CardTitle>
            <CardDescription>
              Select the jurisdictions and levels relevant to your work.
              Precedent search results will be tailored to these preferences.
              {isConfigured && (
                <Badge variant="secondary" className="ml-2">
                  <Check className="mr-1 h-3 w-3" />
                  Configured
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Jurisdiction Level */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="text-base">Jurisdiction Level</CardTitle>
          <CardDescription>
            What level of labour board decisions are relevant to your work?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {LEVELS.map((level) => (
            <div
              key={level.value}
              className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                selectedLevels.includes(level.value)
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => toggleLevel(level.value)}
            >
              <Checkbox
                id={`level-${level.value}`}
                checked={selectedLevels.includes(level.value)}
                onCheckedChange={() => toggleLevel(level.value)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <level.icon className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={`level-${level.value}`} className="font-medium cursor-pointer">
                    {level.label}
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{level.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Geographic Jurisdictions */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="text-base">Geographic Jurisdiction</CardTitle>
          <CardDescription>
            Which provinces or territories are relevant? Select all that apply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {JURISDICTIONS.map((j) => {
              const isSelected = selectedJurisdictions.includes(j.value);
              return (
                <div
                  key={j.value}
                  className={`flex items-center space-x-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleJurisdiction(j.value)}
                >
                  <Checkbox
                    id={`jurisdiction-${j.value}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleJurisdiction(j.value)}
                  />
                  <Label
                    htmlFor={`jurisdiction-${j.value}`}
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    {j.label}
                  </Label>
                  {j.value === "federal" && (
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Additional Options */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="text-base">Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Always include national / federal precedents</Label>
              <p className="text-sm text-muted-foreground">
                National decisions are often cited across all jurisdictions
              </p>
            </div>
            <Switch checked={includeNational} onCheckedChange={setIncludeNational} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-apply when browsing precedents</Label>
              <p className="text-sm text-muted-foreground">
                Automatically filter precedent search results by your selections
              </p>
            </div>
            <Switch checked={autoApply} onCheckedChange={setAutoApply} />
          </div>
        </CardContent>
      </Card>

      {/* Summary + Save */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedJurisdictions.length === 0 && selectedLevels.length === 0 ? (
            "No preferences set — all precedents will be shown"
          ) : (
            <>
              {selectedJurisdictions.length} jurisdiction{selectedJurisdictions.length !== 1 ? "s" : ""},{" "}
              {selectedLevels.length} level{selectedLevels.length !== 1 ? "s" : ""} selected
            </>
          )}
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
      </div>
    </div>
  );
}
