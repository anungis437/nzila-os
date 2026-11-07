"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from 'next-intl';
import { PageHeading } from '@/components/dashboard/page-heading';
import { Card } from "@/components/ui/card";
import { Settings as SettingsIcon, Palette, Users, Link2, Bell, Shield, CreditCard, Upload, Save, AlertCircle, Mail, MessageSquare, Database, Calendar, Info, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { isRecord, readApiError } from "@/lib/client/api-envelope";
import { ApiShapeError } from "@/lib/client/row-fields";

type OrgSettingsSection = "general" | "branding" | "members" | "integrations" | "notifications" | "security" | "billing";

/**
 * What the form shows before the server has answered, and for a preference the organization never set. The form sends only the fields the
 * administrator changed, so a value shown here that nobody chose is never written as the organization's own.
 */
const DEFAULT_SETTINGS = {
  general: {
    organizationName: "",
    shortName: "",
    region: "",
    timezone: "America/Toronto",
    language: "en",
    fiscalYearStart: "january"
  },
  branding: {
    primaryColor: "#0066CC",
    logoUrl: "",
    showBranding: true,
    customDomain: ""
  },
  members: {
    autoApproval: false,
    requireEmailVerification: true,
    allowSelfRegistration: true,
    defaultRole: "member",
    memberIdPrefix: ""
  },
  integrations: {
    emailProvider: "",
    smsProvider: "",
    storageProvider: "",
    calendarSync: false
  },
  notifications: {
    sendAdminDigest: true,
    digestFrequency: "daily",
    alertThreshold: 10,
    enableSystemAlerts: true
  },
  security: {
    enforceStrongPasswords: true,
    requireMFA: false,
    sessionTimeout: 30,
    allowedDomains: [] as string[],
    ipWhitelist: ""
  },
  billing: {
    plan: "Free",
    memberCount: 0,
    billingCycle: "monthly",
    paymentMethod: ""
  }
};

/** The form fields that are columns of the organization rather than keys of its settings, with the name the route gives them. */
const COLUMN_FIELDS: Record<string, string> = {
  "general.organizationName": "name",
  "general.shortName": "shortName",
  "general.region": "provinceTerritory",
};

/** A list kept as text (an administrator may have saved "a.com, b.org") is its entries, never an empty list. */
const entriesOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : typeof value === "string"
      ? value.split(/[\s,;]+/).filter((entry) => entry !== "")
      : [];

/** The options of a select, with the stored value among them when the screen has no name for it, so that the select never shows another value than the one stored. */
function OptionsWithStored({ known, stored }: { known: { value: string; label: string }[]; stored: string }) {
  return (
    <>
      <option value="">—</option>
      {known.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
      {stored !== "" && !known.some((option) => option.value === stored) && <option value={stored}>{stored}</option>}
    </>
  );
}

export default function OrgSettingsContent() {
  const t = useTranslations();
  const isFrench = useLocale().startsWith('fr');
  const [activeSection, setActiveSection] = useState<OrgSettingsSection>("general");
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notEnforced, setNotEnforced] = useState<string[]>([]);
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
  const [domainDraft, setDomainDraft] = useState("");
  
  const [orgSettings, setOrgSettings] = useState(DEFAULT_SETTINGS);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/settings/organization');
      if (!res.ok) throw new Error(await readApiError(res, `Request failed with status ${res.status}`));
      const json: unknown = await res.json();
      // withApi's envelope: { success, data: { organization, notEnforced } }. No organization selected is { organization: null }.
      const data = isRecord(json) && isRecord(json.data) ? json.data : null;
      if (data === null) throw new ApiShapeError('no data');
      if (data.organization === null) throw new Error('No organization is selected, so there are no settings to show.');
      if (!isRecord(data.organization)) throw new ApiShapeError('no organization');
      setNotEnforced(entriesOf(data.notEnforced));
      const org = data.organization;
      const s = isRecord(org.settings) ? org.settings : {};
      const text = (source: Record<string, unknown>, key: string, fallback: string): string => {
        const value = source[key];
        return typeof value === 'string' ? value : fallback;
      };
      const flag = (key: string, fallback: boolean): boolean => {
        const value = s[key];
        return typeof value === 'boolean' ? value : fallback;
      };
      const number = (key: string, fallback: number): number => {
        const value = s[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
      };
      setOrgSettings({
        general: {
          organizationName: text(org, 'name', ''),
          shortName: text(org, 'shortName', ''),
          region: text(org, 'provinceTerritory', ''),
          timezone: text(s, 'timezone', DEFAULT_SETTINGS.general.timezone),
          language: text(s, 'language', DEFAULT_SETTINGS.general.language),
          fiscalYearStart: text(s, 'fiscalYearStart', DEFAULT_SETTINGS.general.fiscalYearStart),
        },
        branding: {
          primaryColor: text(s, 'primaryColor', DEFAULT_SETTINGS.branding.primaryColor),
          logoUrl: text(s, 'logoUrl', ''),
          showBranding: flag('showBranding', true),
          customDomain: text(s, 'customDomain', ''),
        },
        members: {
          autoApproval: flag('autoApproval', false),
          requireEmailVerification: flag('requireEmailVerification', true),
          allowSelfRegistration: flag('allowSelfRegistration', true),
          defaultRole: text(s, 'defaultRole', DEFAULT_SETTINGS.members.defaultRole),
          memberIdPrefix: text(s, 'memberIdPrefix', ''),
        },
        integrations: {
          emailProvider: text(s, 'emailProvider', ''),
          smsProvider: text(s, 'smsProvider', ''),
          storageProvider: text(s, 'storageProvider', ''),
          calendarSync: flag('calendarSync', false),
        },
        notifications: {
          sendAdminDigest: flag('sendAdminDigest', true),
          digestFrequency: text(s, 'digestFrequency', DEFAULT_SETTINGS.notifications.digestFrequency),
          // A stored zero is zero: the threshold is not "unset" because it is falsy.
          alertThreshold: number('alertThreshold', DEFAULT_SETTINGS.notifications.alertThreshold),
          enableSystemAlerts: flag('enableSystemAlerts', true),
        },
        security: {
          enforceStrongPasswords: flag('enforceStrongPasswords', true),
          requireMFA: flag('requireMFA', false),
          sessionTimeout: number('sessionTimeout', DEFAULT_SETTINGS.security.sessionTimeout),
          allowedDomains: entriesOf(s.allowedDomains),
          ipWhitelist: Array.isArray(s.ipWhitelist) ? entriesOf(s.ipWhitelist).join('\n') : text(s, 'ipWhitelist', ''),
        },
        billing: {
          plan: text(org, 'subscriptionTier', DEFAULT_SETTINGS.billing.plan),
          memberCount: typeof org.memberCount === 'number' ? org.memberCount : DEFAULT_SETTINGS.billing.memberCount,
          billingCycle: text(s, 'billingCycle', DEFAULT_SETTINGS.billing.billingCycle),
          paymentMethod: text(s, 'paymentMethod', ''),
        },
      });
      setDirty(new Set());
    } catch (failure) {
      logger.error('Failed to load the organization settings', failure);
      setLoadError(failure instanceof Error && failure.message ? failure.message : 'The settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const settingsSections = [
    {
      id: "general" as OrgSettingsSection,
      label: t('settings.sections.general'),
      icon: <SettingsIcon size={20} />,
      color: "bg-secondary text-primary",
    },
    {
      id: "branding" as OrgSettingsSection,
      label: t('settings.sections.branding'),
      icon: <Palette size={20} />,
      color: "bg-secondary text-primary",
    },
    {
      id: "members" as OrgSettingsSection,
      label: t('settings.sections.members'),
      icon: <Users size={20} />,
      color: "bg-secondary text-primary",
    },
    {
      id: "integrations" as OrgSettingsSection,
      label: t('settings.sections.integrations'),
      icon: <Link2 size={20} />,
      color: "bg-secondary text-primary",
    },
    {
      id: "notifications" as OrgSettingsSection,
      label: t('settings.sections.notifications'),
      icon: <Bell size={20} />,
      color: "bg-secondary text-primary",
    },
    {
      id: "security" as OrgSettingsSection,
      label: t('settings.sections.security'),
      icon: <Shield size={20} />,
      color: "bg-secondary text-primary",
    },
    {
      id: "billing" as OrgSettingsSection,
      label: t('settings.sections.billing'),
      icon: <CreditCard size={20} />,
      color: "bg-secondary text-primary",
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (section: OrgSettingsSection, field: string, value: any) => {
    setOrgSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    setDirty(prev => new Set(prev).add(`${section}.${field}`));
    setHasChanges(true);
  };

  const addDomain = () => {
    const domain = domainDraft.trim().toLowerCase();
    setDomainDraft("");
    if (domain === "" || orgSettings.security.allowedDomains.includes(domain)) return;
    handleInputChange("security", "allowedDomains", [...orgSettings.security.allowedDomains, domain]);
  };

  const handleSave = async () => {
    // The route accepts a threshold between 0 and 1000; the control offers 1 to 100, and a cleared field is not a number.
    const threshold = orgSettings.notifications.alertThreshold;
    if (dirty.has('notifications.alertThreshold') && !(Number.isInteger(threshold) && threshold >= 1 && threshold <= 100)) {
      setSaveError(isFrench ? 'Le seuil d’alerte doit être un nombre entier de 1 à 100.' : 'The alert threshold must be a whole number from 1 to 100.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Only what the administrator changed is sent: the route merges it into the stored settings, and a value the form shows by default is not written as a choice.
      const body: Record<string, unknown> = {};
      const settingsPatch: Record<string, unknown> = {};
      for (const path of dirty) {
        const [section, field] = path.split('.') as [OrgSettingsSection, string];
        const value = (orgSettings[section] as Record<string, unknown>)[field];
        const column = COLUMN_FIELDS[path];
        if (column !== undefined) body[column] = value;
        else settingsPatch[field] = value;
      }
      if (Object.keys(settingsPatch).length > 0) body.settings = settingsPatch;

      const res = await fetch('/api/settings/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readApiError(res, `Request failed with status ${res.status}`));
      const json: unknown = await res.json();
      const data = isRecord(json) && isRecord(json.data) ? json.data : null;
      if (data === null || data.updated !== true) {
        throw new Error(isRecord(data) && typeof data.message === 'string' ? data.message : 'The server did not confirm that the settings were saved.');
      }
      // A successful write does not imply these settings are enforced by the platform.
      setNotEnforced(entriesOf(data.notEnforced));
      setDirty(new Set());
      setHasChanges(false);
    } catch (failure) {
      logger.error('Failed to save the organization settings', failure);
      // Never display a false save-success state or clear unsaved edits after a failed request.
      setSaveError(failure instanceof Error && failure.message ? failure.message : 'The settings were not saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setSaveError(null);
    setLoading(true);
    setHasChanges(false);
    loadSettings();
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div role="status" aria-label="Loading settings" className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : loadError !== null ? (
        <div role="alert" className="rounded-lg border border-destructive p-6">
          <h1>{t('settings.title')}</h1>
          <p className="mt-2">{t('settings.loadUnavailable')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <button type="button" className="mt-4 min-h-11 rounded-md border border-input px-4" onClick={loadSettings}>{t('settings.retryLoad')}</button>
        </div>
      ) : (
      <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <PageHeading title={t('settings.title')} description={t('settings.subtitle')} />

        {saveError !== null && (
          <div role="alert" className="mt-4 rounded-lg border border-destructive p-4 text-sm text-destructive">
            <p>{isFrench ? 'Les paramètres n’ont pas été enregistrés. Vos modifications sont conservées; veuillez réessayer.' : 'Settings were not saved. Your changes are preserved; please try again.'}</p>
            <p className="mt-1">{saveError}</p>
          </div>
        )}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">{t('settings.adminOnly')}</p>
            <p className="text-sm text-amber-700">{t('settings.adminOnlyDescription')}</p>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Sidebar Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full shrink-0 xl:w-60"
        >
          <Card className="p-3">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  aria-pressed={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeSection === section.id
                      ? "bg-secondary text-primary shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${section.color} flex items-center justify-center`}>
                    {section.icon}
                  </div>
                  <span className="font-medium">{section.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Main Content */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 flex-1"
        >
          <Card className="p-4 sm:p-6">
            {activeSection === "general" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('settings.generalSettings')}</h2>
                  <p className="text-gray-600">{t('settings.generalSettingsDescription')}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.organizationName')}
                    </label>
                    <input
                      type="text"
                      value={orgSettings.general.organizationName}
                      onChange={(e) => handleInputChange("general", "organizationName", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.shortName')}
                    </label>
                    <input
                      type="text"
                      value={orgSettings.general.shortName}
                      onChange={(e) => handleInputChange("general", "shortName", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.region')}
                  </label>
                  <select
                    value={orgSettings.general.region}
                    onChange={(e) => handleInputChange("general", "region", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <OptionsWithStored
                      stored={orgSettings.general.region}
                      known={(['ON', 'QC', 'BC', 'AB', 'MB', 'SK'] as const).map((code) => ({ value: code, label: t(`settings.province.${code}`) }))}
                    />
                  </select>
                </div>                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select
                      value={orgSettings.general.timezone}
                      onChange={(e) => handleInputChange("general", "timezone", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="America/Toronto">Eastern (Toronto)</option>
                      <option value="America/Winnipeg">Central (Winnipeg)</option>
                      <option value="America/Edmonton">Mountain (Edmonton)</option>
                      <option value="America/Vancouver">Pacific (Vancouver)</option>
                    </select>
                  </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.language')}
                  </label>
                  <select
                    value={orgSettings.general.language}
                    onChange={(e) => handleInputChange("general", "language", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="en">{t('settings.languages.en')}</option>
                    <option value="fr">{t('settings.languages.fr')}</option>
                    <option value="it">{t('settings.languages.it')}</option>
                    <option value="pt">{t('settings.languages.pt')}</option>
                  </select>
                </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.fiscalYearStart')}
                    </label>
                    <select
                      value={orgSettings.general.fiscalYearStart}
                      onChange={(e) => handleInputChange("general", "fiscalYearStart", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="january">{t('settings.months.january')}</option>
                      <option value="april">{t('settings.months.april')}</option>
                      <option value="july">{t('settings.months.july')}</option>
                      <option value="october">{t('settings.months.october')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "branding" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('settings.brandingAppearance')}</h2>
                  <p className="text-gray-600">{t('settings.brandingAppearanceDescription')}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.organizationLogo')}
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                        {orgSettings.branding.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={orgSettings.branding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <Upload className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="url"
                        value={orgSettings.branding.logoUrl}
                        onChange={(e) => handleInputChange("branding", "logoUrl", e.target.value)}
                        placeholder="https://"
                        aria-label="Logo URL (https)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.primaryColor')}
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="color"
                        value={orgSettings.branding.primaryColor}
                        onChange={(e) => handleInputChange("branding", "primaryColor", e.target.value)}
                        aria-label="Primary color picker"
                        className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={orgSettings.branding.primaryColor}
                        onChange={(e) => handleInputChange("branding", "primaryColor", e.target.value)}
                        aria-label="Primary color hex value"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.customDomain')}
                    </label>
                    <input
                      type="text"
                      value={orgSettings.branding.customDomain}
                      onChange={(e) => handleInputChange("branding", "customDomain", e.target.value)}
                      placeholder={t('settings.customDomainPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t('settings.showBranding')}</p>
                      <p className="text-sm text-gray-600">{t('settings.showBrandingDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.branding.showBranding}
                        onChange={(e) => handleInputChange("branding", "showBranding", e.target.checked)}
                        aria-label="Show branding"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "members" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('settings.memberManagement')}</h2>
                  <p className="text-gray-600">{t('settings.memberManagementDescription')}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t('settings.allowSelfRegistration')}</p>
                      <p className="text-sm text-gray-600">{t('settings.allowSelfRegistrationDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.members.allowSelfRegistration}
                        onChange={(e) => handleInputChange("members", "allowSelfRegistration", e.target.checked)}
                        aria-label="Allow self registration"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t('settings.autoApproveMembers')}</p>
                      <p className="text-sm text-gray-600">{t('settings.autoApproveMembersDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.members.autoApproval}
                        onChange={(e) => handleInputChange("members", "autoApproval", e.target.checked)}
                        aria-label="Auto approve members"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t('settings.requireEmailVerification')}</p>
                      <p className="text-sm text-gray-600">{t('settings.requireEmailVerificationDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.members.requireEmailVerification}
                        onChange={(e) => handleInputChange("members", "requireEmailVerification", e.target.checked)}
                        aria-label="Require email verification"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.defaultRole')}
                    </label>
                    <select
                      value={orgSettings.members.defaultRole}
                      onChange={(e) => handleInputChange("members", "defaultRole", e.target.value)}
                      aria-label="Default member role"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="member">{t('settings.roles.member')}</option>
                      <option value="steward">{t('settings.roles.steward')}</option>
                      <option value="union_admin">{t('settings.roles.unionAdmin')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.memberIdPrefix')}
                    </label>
                    <input
                      type="text"
                      value={orgSettings.members.memberIdPrefix}
                      onChange={(e) => handleInputChange("members", "memberIdPrefix", e.target.value)}
                      placeholder={t('settings.memberIdPrefixPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "integrations" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('settings.integrationsTitle')}</h2>
                  <p className="text-gray-600">{t('settings.integrationsDescription')}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                      <Mail size={16} />
                      {t('settings.emailProvider')}
                    </label>
                    <select
                      value={orgSettings.integrations.emailProvider}
                      onChange={(e) => handleInputChange("integrations", "emailProvider", e.target.value)}
                      aria-label="Email provider selection"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <OptionsWithStored
                        stored={orgSettings.integrations.emailProvider}
                        known={[
                          { value: 'sendgrid', label: t('settings.emailProviders.sendgrid') },
                          { value: 'mailgun', label: t('settings.emailProviders.mailgun') },
                          { value: 'ses', label: t('settings.emailProviders.ses') },
                          { value: 'smtp', label: t('settings.emailProviders.smtp') },
                        ]}
                      />
                    </select>
                  </div>

                  <div>
                    <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                      <MessageSquare size={16} />
                      {t('settings.smsProvider')}
                    </label>
                    <select
                      value={orgSettings.integrations.smsProvider}
                      onChange={(e) => handleInputChange("integrations", "smsProvider", e.target.value)}
                      aria-label="SMS provider selection"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <OptionsWithStored
                        stored={orgSettings.integrations.smsProvider}
                        known={[
                          { value: 'twilio', label: t('settings.smsProviders.twilio') },
                          { value: 'vonage', label: t('settings.smsProviders.vonage') },
                          { value: 'sns', label: t('settings.smsProviders.sns') },
                        ]}
                      />
                    </select>
                  </div>

                  <div>
                    <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                      <Database size={16} />
                      {t('settings.storageProvider')}
                    </label>
                    <select
                      value={orgSettings.integrations.storageProvider}
                      onChange={(e) => handleInputChange("integrations", "storageProvider", e.target.value)}
                      aria-label="Storage provider selection"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <OptionsWithStored
                        stored={orgSettings.integrations.storageProvider}
                        known={[
                          { value: 's3', label: t('settings.storageProviders.s3') },
                          { value: 'azure', label: t('settings.storageProviders.azure') },
                          { value: 'gcs', label: t('settings.storageProviders.gcs') },
                        ]}
                      />
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <Calendar size={16} />
                        {t('settings.calendarSync')}
                      </p>
                      <p className="text-sm text-gray-600">{t('settings.calendarSyncDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.integrations.calendarSync}
                        onChange={(e) => handleInputChange("integrations", "calendarSync", e.target.checked)}
                        aria-label="Enable calendar sync"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('settings.organizationNotifications')}</h2>
                  <p className="text-gray-600">{t('settings.organizationNotificationsDescription')}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t('settings.sendAdminDigest')}</p>
                      <p className="text-sm text-gray-600">{t('settings.sendAdminDigestDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.notifications.sendAdminDigest}
                        onChange={(e) => handleInputChange("notifications", "sendAdminDigest", e.target.checked)}
                        aria-label="Send admin digest"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.digestFrequency')}
                    </label>
                    <select
                      value={orgSettings.notifications.digestFrequency}
                      onChange={(e) => handleInputChange("notifications", "digestFrequency", e.target.value)}
                      aria-label="Digest frequency"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!orgSettings.notifications.sendAdminDigest}
                    >
                      <option value="daily">{t('common.daily')}</option>
                      <option value="weekly">{t('common.weekly')}</option>
                      <option value="monthly">{t('common.monthly')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.alertThreshold')}
                    </label>
                    <input
                      type="number"
                      value={Number.isNaN(orgSettings.notifications.alertThreshold) ? "" : orgSettings.notifications.alertThreshold}
                      onChange={(e) => handleInputChange("notifications", "alertThreshold", e.target.value === "" ? Number.NaN : Number(e.target.value))}
                      min="1"
                      max="100"
                      aria-label="Alert threshold percentage"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-sm text-gray-500 mt-1">{t('settings.alertThresholdDescription')}</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t('settings.systemAlerts')}</p>
                      <p className="text-sm text-gray-600">{t('settings.systemAlertsDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.notifications.enableSystemAlerts}
                        onChange={(e) => handleInputChange("notifications", "enableSystemAlerts", e.target.checked)}
                        aria-label="Enable system alerts"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "security" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('settings.securityCompliance')}</h2>
                  <p className="text-gray-600">{t('settings.securityComplianceDescription')}</p>
                </div>
                <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-semibold">{isFrench ? 'Préférences enregistrées, non appliquées' : 'Stored preferences, not enforced controls'}</p>
                  <p className="mt-1">{isFrench
                    ? 'Les options de sécurité ci-dessous ne sont pas appliquées par les mécanismes de connexion, de session ou de mot de passe. Ne les considérez pas comme des protections actives.'
                    : 'The security options below are not enforced by sign-in, session or password mechanisms. Do not rely on them as active protections.'}</p>
                  <p className="mt-1">{isFrench
                    ? 'Elles ne peuvent pas être modifiées ici : la plateforme refuse d’enregistrer un contrôle qu’elle n’applique pas. Les valeurs affichées sont celles enregistrées auparavant.'
                    : 'They cannot be changed here: the platform refuses to save a control it does not enforce. The values shown are what was stored before.'}</p>
                  {notEnforced.length > 0 && (
                    <p className="mt-2 break-words">{isFrench ? 'Champs enregistrés sans application : ' : 'Saved but unenforced fields: '}{notEnforced.join(', ')}</p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t('settings.enforceStrongPasswords')}</p>
                      <p className="text-sm text-gray-600">{t('settings.enforceStrongPasswordsDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.security.enforceStrongPasswords}
                        onChange={(e) => handleInputChange("security", "enforceStrongPasswords", e.target.checked)}
                        disabled
                        aria-label="Enforce strong passwords"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{t('settings.requireMultiFactorAuth')}</p>
                      <p className="text-sm text-gray-600">{t('settings.requireMultiFactorAuthDescription')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgSettings.security.requireMFA}
                        onChange={(e) => handleInputChange("security", "requireMFA", e.target.checked)}
                        disabled
                        aria-label="Require multi-factor authentication"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.sessionTimeout')}
                    </label>
                    <select
                      value={orgSettings.security.sessionTimeout}
                      onChange={(e) => handleInputChange("security", "sessionTimeout", parseInt(e.target.value))}
                      disabled
                      aria-label="Session timeout duration"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={15}>{t('settings.sessionTimeout15')}</option>
                      <option value={30}>{t('settings.sessionTimeout30')}</option>
                      <option value={60}>{t('settings.sessionTimeout60')}</option>
                      <option value={120}>{t('settings.sessionTimeout120')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.allowedEmailDomains')}
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {orgSettings.security.allowedDomains.map((domain, index) => (
                        <div key={domain} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                          {domain}
                          <button
                            type="button"
                            disabled
                            aria-label={`Remove ${domain}`}
                            onClick={() => {
                              const newDomains = orgSettings.security.allowedDomains.filter((_, i) => i !== index);
                              handleInputChange("security", "allowedDomains", newDomains);
                            }}
                            className="text-blue-700 hover:text-blue-900"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={domainDraft}
                        onChange={(e) => setDomainDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addDomain();
                          }
                        }}
                        placeholder="example.org"
                        disabled
                        aria-label="Add an allowed email domain"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={addDomain}
                        disabled
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        {isFrench ? 'Ajouter' : 'Add'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">{t('settings.allowedEmailDomainsDescription')}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.ipWhitelist')}
                    </label>
                    <textarea
                      value={orgSettings.security.ipWhitelist}
                      onChange={(e) => handleInputChange("security", "ipWhitelist", e.target.value)}
                      disabled
                      aria-label="IP allowlist"
                      placeholder={t('settings.ipWhitelistPlaceholder')}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-sm text-gray-500 mt-1">{t('settings.ipWhitelistDescription')}</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "billing" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('settings.billingSubscription')}</h2>
                  <p className="text-gray-600">{t('settings.billingSubscriptionDescription')}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                  <h3 className="text-lg font-semibold text-gray-900">{orgSettings.billing.plan}</h3>
                  <p className="mt-1 text-sm text-gray-700">
                    {orgSettings.billing.memberCount} {isFrench ? 'membres' : 'members'}
                  </p>
                </div>
                <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-semibold">
                    {isFrench ? 'Facturation non disponible sur cette page' : 'Billing records unavailable on this page'}
                  </p>
                  <p className="mt-1">
                    {isFrench
                      ? 'Aucune source de facturation autorisée n’est connectée à cet écran. Les prix, les paiements, les factures et les droits du forfait ne sont pas vérifiés ici. Pour obtenir une facture ou modifier un paiement, utilisez le processus de facturation approuvé par votre organisation.'
                      : 'No authoritative billing source is connected to this screen. Prices, payments, invoices and plan entitlements are not verified here. Use your organization’s approved billing process to obtain invoices or change a payment method.'}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Floating Save Bar */}
      {hasChanges && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
        >
          <Card className="px-6 py-4 shadow-xl border-2 border-blue-200 bg-white">
            <div className="flex items-center gap-4">
              <Info size={20} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-900">You have unsaved changes</span>
              <div className="flex gap-2">
                <button
                  onClick={handleDiscard}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('settings.discard')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? "Saving…" : t('settings.saveChanges')}
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
      
      {/* Help Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-200"
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">{t('settings.needHelp')}</h3>
            <p className="text-sm text-blue-700">
              {t('settings.needHelpDescription')}
            </p>
          </div>
        </div>
      </motion.div>
      </>
      )}
    </div>
  );
}

