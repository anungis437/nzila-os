/**
 * Portal Settings Page
 *
 * Allows members to manage their notification preferences, privacy controls,
 * and display settings.  Reads/writes via `/api/v2/notifications/preferences`
 * and `/api/v2/members/me/preferences`.
 */
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useUser } from '@nzila/platform-auth/entra/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Bell,
  Shield,
  Save,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  digestFrequency: "realtime" | "daily" | "weekly" | "none";
  quietHoursStart: string;
  quietHoursEnd: string;
  claimUpdates: boolean;
  documentUpdates: boolean;
  deadlineAlerts: boolean;
  systemAnnouncements: boolean;
  securityAlerts: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  inAppEnabled: true,
  digestFrequency: "daily",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  claimUpdates: true,
  documentUpdates: true,
  deadlineAlerts: true,
  systemAnnouncements: true,
  securityAlerts: true,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PortalSettingsPage() {
  const { user } = useUser();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- fetch ------------------------------------------------ */

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v2/notifications/preferences");
      if (res.ok) {
        const data = await res.json();
        const p = data?.preferences ?? data?.data ?? data ?? {};
        setPrefs({
          emailEnabled: p.emailEnabled ?? p.email_enabled ?? DEFAULT_PREFS.emailEnabled,
          smsEnabled: p.smsEnabled ?? p.sms_enabled ?? DEFAULT_PREFS.smsEnabled,
          pushEnabled: p.pushEnabled ?? p.push_enabled ?? DEFAULT_PREFS.pushEnabled,
          inAppEnabled: p.inAppEnabled ?? p.in_app_enabled ?? DEFAULT_PREFS.inAppEnabled,
          digestFrequency: p.digestFrequency ?? p.digest_frequency ?? DEFAULT_PREFS.digestFrequency,
          quietHoursStart: p.quietHoursStart ?? p.quiet_hours_start ?? DEFAULT_PREFS.quietHoursStart,
          quietHoursEnd: p.quietHoursEnd ?? p.quiet_hours_end ?? DEFAULT_PREFS.quietHoursEnd,
          claimUpdates: p.claimUpdates ?? p.claim_updates ?? DEFAULT_PREFS.claimUpdates,
          documentUpdates: p.documentUpdates ?? p.document_updates ?? DEFAULT_PREFS.documentUpdates,
          deadlineAlerts: p.deadlineAlerts ?? p.deadline_alerts ?? DEFAULT_PREFS.deadlineAlerts,
          systemAnnouncements: p.systemAnnouncements ?? p.system_announcements ?? DEFAULT_PREFS.systemAnnouncements,
          securityAlerts: p.securityAlerts ?? p.security_alerts ?? DEFAULT_PREFS.securityAlerts,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  /* ---------- save ------------------------------------------------- */

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/v2/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- helpers ---------------------------------------------- */

  const toggle = (key: keyof NotificationPreferences) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  /* ---------- render ----------------------------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !prefs) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertCircle className="h-12 w-12 text-red-400" />
          <p className="text-gray-600">{error}</p>
          <Button variant="outline" onClick={fetchPreferences}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your notification preferences, privacy, and display settings
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* ── Notification Channels ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-sm text-gray-500">
                Receive notifications at {user?.emailAddresses[0]?.emailAddress ?? "your email"}
              </p>
            </div>
            <Switch
              checked={prefs.emailEnabled}
              onCheckedChange={() => toggle("emailEnabled")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>SMS Notifications</Label>
              <p className="text-sm text-gray-500">
                Receive text messages for urgent alerts
              </p>
            </div>
            <Switch
              checked={prefs.smsEnabled}
              onCheckedChange={() => toggle("smsEnabled")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Push Notifications</Label>
              <p className="text-sm text-gray-500">
                Browser and mobile push notifications
              </p>
            </div>
            <Switch
              checked={prefs.pushEnabled}
              onCheckedChange={() => toggle("pushEnabled")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>In-App Notifications</Label>
              <p className="text-sm text-gray-500">
                Show notifications within the application
              </p>
            </div>
            <Switch
              checked={prefs.inAppEnabled}
              onCheckedChange={() => toggle("inAppEnabled")}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Digest & Quiet Hours ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Schedule</CardTitle>
          <CardDescription>
            Control when and how often you receive notification digests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Digest Frequency</Label>
              <p className="text-sm text-gray-500">
                How often to receive batched notification summaries
              </p>
            </div>
            <Select
              value={prefs.digestFrequency}
              onValueChange={(v) =>
                setPrefs((p) => ({
                  ...p,
                  digestFrequency: v as NotificationPreferences["digestFrequency"],
                }))
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realtime">Real-time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Quiet Hours</Label>
              <p className="text-sm text-gray-500">
                Pause non-urgent notifications during these hours
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="time"
                value={prefs.quietHoursStart}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, quietHoursStart: e.target.value }))
                }
                className="border rounded px-2 py-1"
              />
              <span>to</span>
              <input
                type="time"
                value={prefs.quietHoursEnd}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, quietHoursEnd: e.target.value }))
                }
                className="border rounded px-2 py-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Notification Types ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Notification Types
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Claim Updates</Label>
              <p className="text-sm text-gray-500">
                Status changes, assignments, and updates to your claims
              </p>
            </div>
            <Switch
              checked={prefs.claimUpdates}
              onCheckedChange={() => toggle("claimUpdates")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Document Updates</Label>
              <p className="text-sm text-gray-500">
                New documents, signature requests, and file changes
              </p>
            </div>
            <Switch
              checked={prefs.documentUpdates}
              onCheckedChange={() => toggle("documentUpdates")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Deadline Alerts</Label>
              <p className="text-sm text-gray-500">
                Upcoming deadlines for cases, votes, and updates
              </p>
            </div>
            <Switch
              checked={prefs.deadlineAlerts}
              onCheckedChange={() => toggle("deadlineAlerts")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>System Announcements</Label>
              <p className="text-sm text-gray-500">
                Union-wide announcements, meeting notices, and updates
              </p>
            </div>
            <Switch
              checked={prefs.systemAnnouncements}
              onCheckedChange={() => toggle("systemAnnouncements")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Security Alerts</Label>
              <p className="text-sm text-gray-500">
                Login attempts, password changes, and security events
              </p>
            </div>
            <Switch
              checked={prefs.securityAlerts}
              onCheckedChange={() => toggle("securityAlerts")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
