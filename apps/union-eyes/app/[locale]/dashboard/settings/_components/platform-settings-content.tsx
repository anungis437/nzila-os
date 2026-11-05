"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger";
import { isRecord, readApiError } from "@/lib/client/api-envelope";
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Key,
  Server,
  ToggleLeft,
  Save,
  Info,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";

type PlatformSection = "security" | "notifications" | "integrations" | "featureFlags" | "localization" | "apiKeys";

const SECTION_ORDER: PlatformSection[] = [
  "security", "notifications", "integrations", "featureFlags", "localization", "apiKeys",
];

const SECTION_META: Record<PlatformSection, { label: string; icon: typeof Shield; description: string; color: string }> = {
  security: { label: "Security", icon: Shield, description: "Authentication, session, and access-control policies", color: "bg-red-100 text-red-700" },
  notifications: { label: "Notifications", icon: Bell, description: "Default notification channels and digest frequency", color: "bg-yellow-100 text-yellow-700" },
  integrations: { label: "Integrations", icon: Server, description: "Third-party service connections and platform services", color: "bg-orange-100 text-orange-700" },
  featureFlags: { label: "Feature Flags", icon: ToggleLeft, description: "Enable or disable platform features globally", color: "bg-green-100 text-green-700" },
  localization: { label: "Localization", icon: Globe, description: "Language and regional settings", color: "bg-blue-100 text-blue-700" },
  apiKeys: { label: "API Keys", icon: Key, description: "Platform API key management", color: "bg-purple-100 text-purple-700" },
};

/* ── Exported types for server → client props ─────────────────────────────── */
export interface PlatformSettingsValues {
  sessionTimeout: number;
  mfaEnforcement: boolean;
  passwordMinLength: number;
  requireMixedCase: boolean;
  requireSymbol: boolean;
  rateLimitPerMin: number;
  emailDigest: boolean;
  digestFrequency: string;
  pushNotifications: boolean;
  smsAlerts: boolean;
  webhookNotifications: boolean;
  webhookUrl: string;
  voiceGrievance: boolean;
  aiClauseAnalysis: boolean;
  mobileAccess: boolean;
  crossUnionAnalytics: boolean;
  defaultLanguage: string;
  dateFormat: string;
  currency: string;
}

export interface ApiKeyRow {
  id: string;
  keyName: string;
  keyPrefix: string;
  status: string;
  scopes: string[];
  requestCount: number;
}

export interface IntegrationRow {
  label: string;
  status: "healthy" | "degraded" | "down";
  detail: string;
}

export interface PlatformSettingsData {
  settings: PlatformSettingsValues;
  apiKeys: ApiKeyRow[];
  integrations: IntegrationRow[];
  featuresEnabled: string[];
}

/* ── Toggle switch helper ─────────────────────────────────────────────────── */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
    </label>
  );
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "bg-green-100 text-green-700",
  degraded: "bg-yellow-100 text-yellow-700",
  down: "bg-red-100 text-red-700",
  active: "bg-green-100 text-green-700",
  revoked: "bg-red-100 text-red-700",
};

export default function PlatformSettingsContent({ initialData }: { initialData: PlatformSettingsData }) {
  const { settings: init, apiKeys: dbKeys, integrations: dbIntegrations, featuresEnabled } = initialData;

  const [activeSection, setActiveSection] = useState<PlatformSection>("security");
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Security settings ──────────────────────────────────────────────────── */
  const [sessionTimeout, setSessionTimeout] = useState(init.sessionTimeout);
  const [mfaEnforcement, setMfaEnforcement] = useState(init.mfaEnforcement);
  const [passwordMinLength, setPasswordMinLength] = useState(init.passwordMinLength);
  const [requireMixedCase, setRequireMixedCase] = useState(init.requireMixedCase);
  const [requireSymbol, setRequireSymbol] = useState(init.requireSymbol);
  const [rateLimitPerMin, setRateLimitPerMin] = useState(init.rateLimitPerMin);

  /* ── Notification settings ──────────────────────────────────────────────── */
  const [emailDigest, setEmailDigest] = useState(init.emailDigest);
  const [digestFrequency, setDigestFrequency] = useState(init.digestFrequency);
  const [pushNotifications, setPushNotifications] = useState(init.pushNotifications);
  const [smsAlerts, setSmsAlerts] = useState(init.smsAlerts);
  const [webhookNotifications, setWebhookNotifications] = useState(init.webhookNotifications);
  const [webhookUrl, setWebhookUrl] = useState(init.webhookUrl);

  /* ── Feature flags ──────────────────────────────────────────────────────── */
  const [voiceGrievance, setVoiceGrievance] = useState(init.voiceGrievance);
  const [aiClauseAnalysis, setAiClauseAnalysis] = useState(init.aiClauseAnalysis);
  const [mobileAccess, setMobileAccess] = useState(init.mobileAccess);
  const [crossUnionAnalytics, setCrossUnionAnalytics] = useState(init.crossUnionAnalytics);

  /* ── Localization ───────────────────────────────────────────────────────── */
  const [defaultLanguage, setDefaultLanguage] = useState(init.defaultLanguage);
  const [dateFormat, setDateFormat] = useState(init.dateFormat);
  const [currency, setCurrency] = useState(init.currency);

  /* ── API keys (reveal / copy state) ───────────────────────────────────── */
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const isFrench = useLocale().startsWith("fr");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  // What the server holds, as far as this screen knows: the settings as loaded, then as last saved.
  const [baseline, setBaseline] = useState<PlatformSettingsValues>(init);

  const markChanged = () => setHasChanges(true);

  const handleSave = async () => {
    const current: PlatformSettingsValues = {
      sessionTimeout, mfaEnforcement, passwordMinLength, requireMixedCase, requireSymbol, rateLimitPerMin,
      emailDigest, digestFrequency, pushNotifications, smsAlerts, webhookNotifications, webhookUrl,
      voiceGrievance, aiClauseAnalysis, mobileAccess, crossUnionAnalytics,
      defaultLanguage, dateFormat, currency,
    };
    // Only what was changed is sent: the route merges it into the stored settings, and a value the screen shows by default is not written as a choice.
    const changed = Object.fromEntries(Object.entries(current).filter(([key, value]) => value !== baseline[key as keyof PlatformSettingsValues]));
    if (Object.keys(changed).length === 0) {
      setHasChanges(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveNote(null);
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: changed }),
      });
      if (!res.ok) throw new Error(await readApiError(res, `Request failed with status ${res.status}`));
      const json: unknown = await res.json();
      const data = isRecord(json) && isRecord(json.data) ? json.data : null;
      if (data === null || data.updated !== true) {
        throw new Error('The server did not confirm that the settings were saved.');
      }
      setBaseline(current);
      setHasChanges(false);
      // The route says when a saved setting is stored but not enforced by the platform.
      setSaveNote(typeof data.message === 'string' ? data.message : null);
    } catch (failure) {
      logger.error('Failed to save the platform settings', failure);
      // The changes stay on the screen and the bar stays up: nothing was saved.
      setSaveError(failure instanceof Error && failure.message ? failure.message : 'The settings were not saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    window.location.reload();
  };

  const handleCopyKey = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFailed(false);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (failure) {
      logger.error('Failed to copy the key prefix', failure);
      setCopiedKey(null);
      setCopyFailed(true);
    }
  };

  const meta = SECTION_META[activeSection];
  const Icon = meta.icon;

  return (
    <div className="p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Settings size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-600">Platform-wide configuration and feature management</p>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-64 shrink-0">
          <Card className="p-4 sticky top-24">
            <div className="space-y-1">
              {SECTION_ORDER.map((key) => {
                const s = SECTION_META[key];
                const SIcon = s.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeSection === key ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center`}>
                      <SIcon size={20} />
                    </div>
                    <span className="font-medium">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Main Content */}
        <motion.div key={activeSection} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1">
          <Card className="p-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Icon className="h-6 w-6 text-blue-600" />
                  {meta.label}
                </h2>
                <p className="text-gray-600">{meta.description}</p>
              </div>

              {saveError !== null && (
                <div role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">
                  <p>{isFrench ? 'Les paramètres n’ont pas été enregistrés. Vos modifications sont conservées; veuillez réessayer.' : 'Settings were not saved. Your changes are kept; please try again.'}</p>
                  <p className="mt-1">{saveError}</p>
                </div>
              )}
              {saveNote !== null && (
                <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{saveNote}</div>
              )}
              {activeSection === "security" && (
                <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-semibold">{isFrench ? 'Préférences enregistrées, non appliquées' : 'Stored preferences, not enforced controls'}</p>
                  <p className="mt-1">{isFrench
                    ? 'Les options de sécurité ci-dessous sont enregistrées avec l’organisation, mais les mécanismes de connexion, de session, de mot de passe et de limitation de débit ne les lisent pas. Ne les considérez pas comme des protections actives.'
                    : 'The security options below are saved with the organization, but sign-in, session, password and rate-limit mechanisms do not read them. Do not rely on them as active protections.'}</p>
                </div>
              )}

              {/* ═══════════ SECURITY ═══════════ */}
              {activeSection === "security" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Session timeout</label>
                    <select value={sessionTimeout} onChange={(e) => { setSessionTimeout(Number(e.target.value)); markChanged(); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Require multi-factor authentication</p>
                      <p className="text-sm text-gray-600">A stored preference: sign-in does not read it</p>
                    </div>
                    <Toggle checked={mfaEnforcement} onChange={(v) => { setMfaEnforcement(v); markChanged(); }} label="Require multi-factor authentication" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Min password length</label>
                      <input type="number" min={8} max={64} value={passwordMinLength}
                        onChange={(e) => { setPasswordMinLength(Number(e.target.value)); markChanged(); }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">API rate limit (req/min)</label>
                      <input type="number" min={10} max={1000} value={rateLimitPerMin}
                        onChange={(e) => { setRateLimitPerMin(Number(e.target.value)); markChanged(); }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Require mixed case</p>
                      <p className="text-sm text-gray-600">Passwords must include uppercase and lowercase letters</p>
                    </div>
                    <Toggle checked={requireMixedCase} onChange={(v) => { setRequireMixedCase(v); markChanged(); }} label="Require mixed case" />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Require symbols</p>
                      <p className="text-sm text-gray-600">Passwords must include at least one special character</p>
                    </div>
                    <Toggle checked={requireSymbol} onChange={(v) => { setRequireSymbol(v); markChanged(); }} label="Require symbols" />
                  </div>
                </div>
              )}

              {/* ═══════════ NOTIFICATIONS ═══════════ */}
              {activeSection === "notifications" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Email digest</p>
                      <p className="text-sm text-gray-600">Send periodic email summaries to admins</p>
                    </div>
                    <Toggle checked={emailDigest} onChange={(v) => { setEmailDigest(v); markChanged(); }} label="Email digest" />
                  </div>

                  {emailDigest && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Digest frequency</label>
                      <select value={digestFrequency} onChange={(e) => { setDigestFrequency(e.target.value); markChanged(); }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Push notifications</p>
                      <p className="text-sm text-gray-600">Send real-time push notifications to users</p>
                    </div>
                    <Toggle checked={pushNotifications} onChange={(v) => { setPushNotifications(v); markChanged(); }} label="Push notifications" />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">SMS alerts</p>
                      <p className="text-sm text-gray-600">Send alerts to members by text message</p>
                    </div>
                    <Toggle checked={smsAlerts} onChange={(v) => { setSmsAlerts(v); markChanged(); }} label="SMS alerts" />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Webhook notifications</p>
                      <p className="text-sm text-gray-600">Forward events to an external webhook endpoint</p>
                    </div>
                    <Toggle checked={webhookNotifications} onChange={(v) => { setWebhookNotifications(v); markChanged(); }} label="Webhook notifications" />
                  </div>
                  {webhookNotifications && (
                    <p className="text-xs text-amber-800">Saved only: no webhook is sent from this setting yet.</p>
                  )}

                  {webhookNotifications && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                      <input type="url" value={webhookUrl} placeholder="https://example.com/webhook"
                        onChange={(e) => { setWebhookUrl(e.target.value); markChanged(); }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════ INTEGRATIONS ═══════════ */}
              {activeSection === "integrations" && (
                <div className="space-y-4">
                  {dbIntegrations.map((integ) => (
                    <div key={integ.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{integ.label}</p>
                        <p className="text-sm text-gray-600">{integ.detail}</p>
                      </div>
                      <Badge className={STATUS_COLORS[integ.status] ?? "bg-gray-100 text-gray-700"}>
                        {integ.status}
                      </Badge>
                    </div>
                  ))}
                  {featuresEnabled.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">Enabled Features</p>
                      <div className="flex flex-wrap gap-2">
                        {featuresEnabled.map(f => (
                          <Badge key={f} variant="outline" className="capitalize">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-blue-600 mt-0.5" />
                      <p className="text-sm text-blue-700">Integration configuration is managed via environment variables. Contact DevOps to add or modify connections.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ FEATURE FLAGS ═══════════ */}
              {activeSection === "featureFlags" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Voice grievance filing</p>
                      <p className="text-sm text-gray-600">Allow members to submit grievances via voice recording</p>
                    </div>
                    <Toggle checked={voiceGrievance} onChange={(v) => { setVoiceGrievance(v); markChanged(); }} label="Voice grievance filing" />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">AI clause analysis</p>
                      <p className="text-sm text-gray-600">Enable AI-powered collective agreement clause analysis</p>
                    </div>
                    <Toggle checked={aiClauseAnalysis} onChange={(v) => { setAiClauseAnalysis(v); markChanged(); }} label="AI clause analysis" />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Mobile app access</p>
                      <p className="text-sm text-gray-600">Allow members to access the platform via mobile app</p>
                    </div>
                    <Toggle checked={mobileAccess} onChange={(v) => { setMobileAccess(v); markChanged(); }} label="Mobile app access" />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Cross-union analytics</p>
                      <p className="text-sm text-gray-600">
                        Enable aggregated analytics across organizations
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">Beta</span>
                      </p>
                    </div>
                    <Toggle checked={crossUnionAnalytics} onChange={(v) => { setCrossUnionAnalytics(v); markChanged(); }} label="Cross-union analytics" />
                  </div>
                </div>
              )}

              {/* ═══════════ LOCALIZATION ═══════════ */}
              {activeSection === "localization" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Default language</label>
                    <select value={defaultLanguage} onChange={(e) => { setDefaultLanguage(e.target.value); markChanged(); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="en">English (en)</option>
                      <option value="fr">French (fr)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date format</label>
                    <select value={dateFormat} onChange={(e) => { setDateFormat(e.target.value); markChanged(); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select value={currency} onChange={(e) => { setCurrency(e.target.value); markChanged(); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="CAD">CAD — Canadian Dollar</option>
                      <option value="USD">USD — US Dollar</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ═══════════ API KEYS ═══════════ */}
              {activeSection === "apiKeys" && (
                <div className="space-y-4">
                  {dbKeys.map((k) => (
                    <div key={k.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700">{k.keyName}</p>
                        <div className="flex items-center gap-2">
                          <Badge className={STATUS_COLORS[k.status] ?? "bg-gray-100 text-gray-700"}>
                            {k.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 font-mono">
                          {revealedKeys[k.id] ? k.keyPrefix + "••••••••" : "••••••••••••••••••••"}
                        </code>
                        <button
                          onClick={() => setRevealedKeys((prev) => ({ ...prev, [k.id]: !prev[k.id] }))}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label={revealedKeys[k.id] ? "Hide key" : "Reveal key"}
                        >
                          {revealedKeys[k.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        <button
                          onClick={() => void handleCopyKey(k.id, k.keyPrefix)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Copy key prefix"
                        >
                          {copiedKey === k.id ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                        </button>
                      </div>
                      {copyFailed && <p role="alert" className="text-xs text-destructive mb-2">The key prefix could not be copied.</p>}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Scopes: {k.scopes.join(', ')}</span>
                        <span>•</span>
                        <span>{k.requestCount.toLocaleString()} requests</span>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-amber-600 mt-0.5" />
                      <p className="text-sm text-amber-700">API keys are rotated via the platform CLI. Changing a key here does not regenerate it.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Floating Save Bar */}
      {hasChanges && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="px-6 py-4 shadow-xl border-2 border-blue-200 bg-white">
            <div className="flex items-center gap-4">
              <Info size={20} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-900">You have unsaved changes</span>
              <div className="flex gap-2">
                <button onClick={handleDiscard} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  Discard
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
