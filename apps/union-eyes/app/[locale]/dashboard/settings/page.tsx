"use client";


export const dynamic = 'force-dynamic';
import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from 'next-intl';
import { Card } from "@/components/ui/card";
import { Building2, Settings as SettingsIcon, Palette, Users, Link2, Bell, Shield, CreditCard, Upload, Save, AlertCircle, Mail, MessageSquare, Database, Calendar, Check, Download, Info } from "lucide-react";

type OrgSettingsSection = "general" | "branding" | "members" | "integrations" | "notifications" | "security" | "billing";

export default function OrganizationSettingsPage() {
  const t = useTranslations();
  const [activeSection, setActiveSection] = useState<OrgSettingsSection>("general");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [orgSettings, setOrgSettings] = useState({
    general: {
      organizationName: "UFCW Local 175 & 633",
      shortName: "UFCW 175",
      region: "ON",
      timezone: "America/Toronto",
      language: "en",
      fiscalYearStart: "January"
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
      memberIdPrefix: "MEM"
    },
    integrations: {
      emailProvider: "sendgrid",
      smsProvider: "twilio",
      storageProvider: "s3",
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
      allowedDomains: ["ufcw175.com", "ufcw633.com"],
      ipWhitelist: ""
    },
    billing: {
      plan: "Union Pro",
      memberCount: 1234,
      billingCycle: "monthly",
      paymentMethod: "Visa ending in 4242"
    }
  });

  const settingsSections = [
    {
      id: "general" as OrgSettingsSection,
      label: t('settings.sections.general'),
      icon: <SettingsIcon size={20} />,
      color: "bg-blue-100 text-blue-700",
    },
    {
      id: "branding" as OrgSettingsSection,
      label: t('settings.sections.branding'),
      icon: <Palette size={20} />,
      color: "bg-purple-100 text-purple-700",
    },
    {
      id: "members" as OrgSettingsSection,
      label: t('settings.sections.members'),
      icon: <Users size={20} />,
      color: "bg-green-100 text-green-700",
    },
    {
      id: "integrations" as OrgSettingsSection,
      label: t('settings.sections.integrations'),
      icon: <Link2 size={20} />,
      color: "bg-orange-100 text-orange-700",
    },
    {
      id: "notifications" as OrgSettingsSection,
      label: t('settings.sections.notifications'),
      icon: <Bell size={20} />,
      color: "bg-yellow-100 text-yellow-700",
    },
    {
      id: "security" as OrgSettingsSection,
      label: t('settings.sections.security'),
      icon: <Shield size={20} />,
      color: "bg-red-100 text-red-700",
    },
    {
      id: "billing" as OrgSettingsSection,
      label: t('settings.sections.billing'),
      icon: <CreditCard size={20} />,
      color: "bg-indigo-100 text-indigo-700",
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
    setHasChanges(true);
  };

  const handleSave = () => {
setHasChanges(false);
  };

  const handleDiscard = () => {
    window.location.reload();
  };

  return (
    <div className="p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('settings.title')}
            </h1>
            <p className="text-gray-600">{t('settings.subtitle')}</p>
          </div>
        </div>
        
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">{t('settings.adminOnly')}</p>
            <p className="text-sm text-amber-700">{t('settings.adminOnlyDescription')}</p>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-8">
        {/* Sidebar Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-64 shrink-0"
        >
          <Card className="p-4 sticky top-24">
            <div className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeSection === section.id
                      ? "bg-blue-50 text-blue-700 shadow-sm"
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
          className="flex-1"
        >
          <Card className="p-8">
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
                    <option value="ON">{t('settings.province.ON')}</option>
                    <option value="QC">{t('settings.province.QC')}</option>
                    <option value="BC">{t('settings.province.BC')}</option>
                    <option value="AB">{t('settings.province.AB')}</option>
                    <option value="MB">{t('settings.province.MB')}</option>
                    <option value="SK">{t('settings.province.SK')}</option>
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
                    <option value="es">{t('settings.languages.es')}</option>
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
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        {t('settings.uploadLogo')}
                      </button>
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
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                      <option value="sendgrid">{t('settings.emailProviders.sendgrid')}</option>
                      <option value="mailgun">{t('settings.emailProviders.mailgun')}</option>
                      <option value="ses">{t('settings.emailProviders.ses')}</option>
                      <option value="smtp">{t('settings.emailProviders.smtp')}</option>
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
                      <option value="twilio">{t('settings.smsProviders.twilio')}</option>
                      <option value="vonage">{t('settings.smsProviders.vonage')}</option>
                      <option value="sns">{t('settings.smsProviders.sns')}</option>
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
                      <option value="s3">{t('settings.storageProviders.s3')}</option>
                      <option value="azure">{t('settings.storageProviders.azure')}</option>
                      <option value="gcs">{t('settings.storageProviders.gcs')}</option>
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
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                      value={orgSettings.notifications.alertThreshold}
                      onChange={(e) => handleInputChange("notifications", "alertThreshold", parseInt(e.target.value))}
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
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                        aria-label="Enforce strong passwords"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                        aria-label="Require multi-factor authentication"
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.sessionTimeout')}
                    </label>
                    <select
                      value={orgSettings.security.sessionTimeout}
                      onChange={(e) => handleInputChange("security", "sessionTimeout", parseInt(e.target.value))}
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
                        <div key={index} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                          {domain}
                          <button
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
                    <p className="text-sm text-gray-500">{t('settings.allowedEmailDomainsDescription')}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.ipWhitelist')}
                    </label>
                    <textarea
                      value={orgSettings.security.ipWhitelist}
                      onChange={(e) => handleInputChange("security", "ipWhitelist", e.target.value)}
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

                <div className="space-y-4">
                  <div className="bg-linear-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{orgSettings.billing.plan}</h3>
                        <p className="text-sm text-gray-600">{orgSettings.billing.memberCount} members</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-gray-900">$299</p>
                        <p className="text-sm text-gray-600">{t('settings.perMonth')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check size={16} className="text-green-600" />
                      <span>{t('settings.unlimitedGrievanceCases')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check size={16} className="text-green-600" />
                      <span>{t('settings.advancedAnalytics')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check size={16} className="text-green-600" />
                      <span>{t('settings.prioritySupport')}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{t('settings.paymentMethod')}</p>
                        <p className="text-sm text-gray-600">{orgSettings.billing.paymentMethod}</p>
                      </div>
                      <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        {t('settings.update')}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">{t('settings.recentInvoices')}</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t('settings.date')}</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t('settings.amount')}</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t('settings.status')}</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">{t('settings.action')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-3 text-sm text-gray-900">Dec 1, 2024</td>
                            <td className="px-4 py-3 text-sm text-gray-900">$299.00</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                <Check size={12} />
                                {t('settings.paid')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button className="text-blue-600 hover:text-blue-700 text-sm" aria-label="Download December 2024 invoice">
                                <Download size={16} />
                              </button>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm text-gray-900">Nov 1, 2024</td>
                            <td className="px-4 py-3 text-sm text-gray-900">$299.00</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                <Check size={12} />
                                {t('settings.paid')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button className="text-blue-600 hover:text-blue-700 text-sm" aria-label="Download November 2024 invoice">
                                <Download size={16} />
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  {t('settings.saveChanges')}
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
    </div>
  );
}
