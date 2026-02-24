"use client";


export const dynamic = 'force-dynamic';
import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useTranslations } from 'next-intl';
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import {
  User,
  Bell,
  Lock,
  Palette,
  Globe,
  Shield,
  Mail,
  Smartphone,
  Download,
  Trash2,
  Save,
  Info,
  Eye,
  LogOut,
  EyeOff,
  Check,
} from "lucide-react";

type SettingsSection =
  | "profile"
  | "notifications"
  | "security"
  | "appearance"
  | "language"
  | "privacy";

export default function ProfilePage() {
  const t = useTranslations();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // User settings state
  const [settings, setSettings] = useState({
    profile: {
      name: user?.fullName || "John Smith",
      email: user?.primaryEmailAddress?.emailAddress || "john.smith@union.ca",
      phone: "+1 (416) 555-0123",
      local: "301 - Toronto Central",
      memberNumber: "301-12345",
      role: "Member",
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      caseUpdates: true,
      deadlineReminders: true,
      voteNotifications: true,
      meetingReminders: true,
      newsletterSubscription: true,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 30,
    },
    appearance: {
      theme: "light",
      compactMode: false,
      animations: true,
    },
    language: {
      interface: "en",
      timezone: "America/Toronto",
    },
    privacy: {
      profileVisibility: "members",
      activityTracking: true,
      dataSharing: false,
    },
  });

  const settingsSections = [
    {
      id: "profile",
      label: t('profile.sections.profile'),
      icon: <User className="w-5 h-5" />,
      color: "bg-blue-100 text-blue-700",
    },
    {
      id: "notifications",
      label: t('profile.sections.notifications'),
      icon: <Bell className="w-5 h-5" />,
      color: "bg-purple-100 text-purple-700",
    },
    {
      id: "security",
      label: t('profile.sections.security'),
      icon: <Lock className="w-5 h-5" />,
      color: "bg-red-100 text-red-700",
    },
    {
      id: "appearance",
      label: t('profile.sections.appearance'),
      icon: <Palette className="w-5 h-5" />,
      color: "bg-green-100 text-green-700",
    },
    {
      id: "language",
      label: t('profile.sections.language'),
      icon: <Globe className="w-5 h-5" />,
      color: "bg-orange-100 text-orange-700",
    },
    {
      id: "privacy",
      label: t('profile.sections.privacy'),
      icon: <Shield className="w-5 h-5" />,
      color: "bg-indigo-100 text-indigo-700",
    },
  ];

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/" });
  };

  const handleSaveChanges = () => {
    setHasChanges(false);
    alert("Settings saved successfully!");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('profile.title')}</h1>
          <p className="text-gray-600">
            {t('profile.subtitle')}
          </p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-64 shrink-0">
            <Card className="p-4 bg-white/80 backdrop-blur-sm border-gray-200 sticky top-8">
              <nav className="space-y-2">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id as SettingsSection)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeSection === section.id
                        ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className={activeSection === section.id ? "" : section.color}>
                      {section.icon}
                    </div>
                    <span className="font-medium text-sm">{section.label}</span>
                  </button>
                ))}
              </nav>
              
              {/* Sign Out Button */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium text-sm">{t('profile.signOut')}</span>
                </button>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Profile Section */}
            {activeSection === "profile" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    {t('profile.profileInformation')}
                  </h2>

                  <div className="space-y-6">
                    {/* Profile Picture */}
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 bg-linear-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                        {settings.profile.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 mr-2">
                          {t('profile.changePhoto')}
                        </button>
                        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                          {t('profile.remove')}
                        </button>
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('profile.fullName')}
                        </label>
                        <input
                          type="text"
                          value={settings.profile.name}
                          onChange={(e) => {
                            setSettings({
                              ...settings,
                              profile: { ...settings.profile, name: e.target.value },
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('profile.emailAddress')}
                        </label>
                        <input
                          type="email"
                          value={settings.profile.email}
                          onChange={(e) => {
                            setSettings({
                              ...settings,
                              profile: { ...settings.profile, email: e.target.value },
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('profile.phoneNumber')}
                        </label>
                        <input
                          type="tel"
                          value={settings.profile.phone}
                          onChange={(e) => {
                            setSettings({
                              ...settings,
                              profile: { ...settings.profile, phone: e.target.value },
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('profile.memberNumber')}
                        </label>
                        <input
                          type="text"
                          value={settings.profile.memberNumber}
                          disabled
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('profile.localSection')}
                        </label>
                        <input
                          type="text"
                          value={settings.profile.local}
                          disabled
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('profile.role')}
                        </label>
                        <input
                          type="text"
                          value={settings.profile.role}
                          disabled
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Notifications Section - Content from old settings page */}
            {activeSection === "notifications" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    {t('profile.notificationPreferences')}
                  </h2>

                  <div className="space-y-6">
                    {/* Notification Channels */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.channels')}</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-gray-200">
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-gray-600" />
                            <div>
                              <p className="font-medium text-gray-900">{t('profile.emailNotifications')}</p>
                              <p className="text-sm text-gray-600">{t('profile.emailNotificationsDescription')}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSettings({
                                ...settings,
                                notifications: {
                                  ...settings.notifications,
                                  emailNotifications: !settings.notifications.emailNotifications,
                                },
                              });
                              setHasChanges(true);
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.notifications.emailNotifications ? "bg-blue-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                settings.notifications.emailNotifications ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-gray-200">
                          <div className="flex items-center gap-3">
                            <Smartphone className="w-5 h-5 text-gray-600" />
                            <div>
                              <p className="font-medium text-gray-900">{t('profile.smsNotifications')}</p>
                              <p className="text-sm text-gray-600">{t('profile.smsNotificationsDescription')}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSettings({
                                ...settings,
                                notifications: {
                                  ...settings.notifications,
                                  smsNotifications: !settings.notifications.smsNotifications,
                                },
                              });
                              setHasChanges(true);
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.notifications.smsNotifications ? "bg-blue-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                settings.notifications.smsNotifications ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-gray-200">
                          <div className="flex items-center gap-3">
                            <Bell className="w-5 h-5 text-gray-600" />
                            <div>
                              <p className="font-medium text-gray-900">{t('profile.pushNotifications')}</p>
                              <p className="text-sm text-gray-600">{t('profile.pushNotificationsDescription')}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSettings({
                                ...settings,
                                notifications: {
                                  ...settings.notifications,
                                  pushNotifications: !settings.notifications.pushNotifications,
                                },
                              });
                              setHasChanges(true);
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.notifications.pushNotifications ? "bg-blue-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                settings.notifications.pushNotifications ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Notification Types */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.notificationTypes')}</h3>
                      <div className="space-y-4">
                        {[
                          { key: "caseUpdates", label: t('profile.caseUpdates'), description: t('profile.caseUpdatesDescription') },
                          { key: "deadlineReminders", label: t('profile.deadlineReminders'), description: t('profile.deadlineRemindersDescription') },
                          { key: "voteNotifications", label: t('profile.voteNotifications'), description: t('profile.voteNotificationsDescription') },
                          { key: "meetingReminders", label: t('profile.meetingReminders'), description: t('profile.meetingRemindersDescription') },
                          { key: "newsletterSubscription", label: t('profile.newsletterSubscription'), description: t('profile.newsletterSubscriptionDescription') },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-200">
                            <div>
                              <p className="font-medium text-gray-900">{item.label}</p>
                              <p className="text-sm text-gray-600">{item.description}</p>
                            </div>
                            <button
                              onClick={() => {
                                setSettings({
                                  ...settings,
                                  notifications: {
                                    ...settings.notifications,
                                    [item.key]: !settings.notifications[item.key as keyof typeof settings.notifications],
                                  },
                                });
                                setHasChanges(true);
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                settings.notifications[item.key as keyof typeof settings.notifications]
                                  ? "bg-blue-600"
                                  : "bg-gray-200"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                  settings.notifications[item.key as keyof typeof settings.notifications]
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Security Section */}
            {activeSection === "security" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-8 bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('profile.securitySettings')}</h2>
                      <p className="text-gray-600">{t('profile.securityDescription')}</p>
                    </div>

                    {/* Password Change */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.changePassword')}</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('profile.currentPassword')}
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder={t('profile.currentPasswordPlaceholder')}
                            />
                            <button
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('profile.newPassword')}
                          </label>
                          <input
                            type={showPassword ? "text" : "password"}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={t('profile.newPasswordPlaceholder')}
                          />
                          <p className="text-sm text-gray-500 mt-2">
                            {t('profile.passwordRequirements')}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('profile.confirmNewPassword')}
                          </label>
                          <input
                            type={showPassword ? "text" : "password"}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={t('profile.confirmPasswordPlaceholder')}
                          />
                        </div>

                        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                          {t('profile.updatePassword')}
                        </button>
                      </div>
                    </div>

                    {/* Two-Factor Authentication */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.twoFactorAuthentication')}</h3>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{t('profile.enable2FA')}</p>
                          <p className="text-sm text-gray-600">{t('profile.enable2FADescription')}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSettings({
                              ...settings,
                              security: {
                                ...settings.security,
                                twoFactorEnabled: !settings.security.twoFactorEnabled,
                              },
                            });
                            setHasChanges(true);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.security.twoFactorEnabled ? "bg-blue-600" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              settings.security.twoFactorEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      {settings.security.twoFactorEnabled && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Check className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-blue-900">{t('profile.twoFactorEnabled')}</p>
                              <p className="text-sm text-blue-700 mt-1">
                                {t('profile.twoFactorEnabledDescription')}
                              </p>
                              <button className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                                {t('profile.viewRecoveryCodes')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Session Timeout */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.sessionSettings')}</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('profile.autoLogout')}
                        </label>
                        <select
                          aria-label="Session timeout duration"
                          value={settings.security.sessionTimeout}
                          onChange={(e) => {
                            setSettings({
                              ...settings,
                              security: {
                                ...settings.security,
                                sessionTimeout: parseInt(e.target.value),
                              },
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={120}>2 hours</option>
                          <option value={0}>Never</option>
                        </select>
                      </div>
                    </div>

                    {/* Active Sessions */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.activeSessions')}</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <Check className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{t('profile.chromeWindows')}</p>
                              <p className="text-sm text-gray-600">{t('profile.torontoCanada')} • {t('profile.activeNow')}</p>
                            </div>
                          </div>
                          <span className="text-sm text-green-600 font-medium">{t('profile.current')}</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Smartphone className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{t('profile.iphone')}</p>
                              <p className="text-sm text-gray-600">{t('profile.torontoCanada')} • {t('profile.hoursAgo', { hours: 2 })}</p>
                            </div>
                          </div>
                          <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                            {t('profile.revoke')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Appearance Section */}
            {activeSection === "appearance" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-8 bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('profile.appearanceSettings')}</h2>
                      <p className="text-gray-600">{t('profile.appearanceDescription')}</p>
                    </div>

                    {/* Theme Selection */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.theme')}</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { value: "light", label: t('profile.themeLight'), icon: "☀️" },
                          { value: "dark", label: t('profile.themeDark'), icon: "🌙" },
                          { value: "auto", label: t('profile.themeAuto'), icon: "🔄" },
                        ].map((theme) => (
                          <button
                            key={theme.value}
                            onClick={() => {
                              setSettings({
                                ...settings,
                                appearance: {
                                  ...settings.appearance,
                                  theme: theme.value,
                                },
                              });
                              setHasChanges(true);
                            }}
                            className={`p-6 border-2 rounded-lg text-center transition-all ${
                              settings.appearance.theme === theme.value
                                ? "border-blue-600 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="text-4xl mb-2">{theme.icon}</div>
                            <p className="font-medium text-gray-900">{theme.label}</p>
                            {settings.appearance.theme === theme.value && (
                              <div className="mt-2 flex items-center justify-center">
                                <Check className="w-4 h-4 text-blue-600" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 mt-3">
                        {t('profile.autoThemeDescription')}
                      </p>
                    </div>

                    {/* Compact Mode */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.displayDensity')}</h3>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{t('profile.compactMode')}</p>
                          <p className="text-sm text-gray-600">{t('profile.compactModeDescription')}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSettings({
                              ...settings,
                              appearance: {
                                ...settings.appearance,
                                compactMode: !settings.appearance.compactMode,
                              },
                            });
                            setHasChanges(true);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.appearance.compactMode ? "bg-blue-600" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              settings.appearance.compactMode ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Animations */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.animations')}</h3>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{t('profile.enableAnimations')}</p>
                          <p className="text-sm text-gray-600">{t('profile.animationsDescription')}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSettings({
                              ...settings,
                              appearance: {
                                ...settings.appearance,
                                animations: !settings.appearance.animations,
                              },
                            });
                            setHasChanges(true);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.appearance.animations ? "bg-blue-600" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              settings.appearance.animations ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-3">
                        {t('profile.animationsPerformance')}
                      </p>
                    </div>

                    {/* Font Size Preview */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.preview')}</h3>
                      <div className="p-6 border border-gray-200 rounded-lg bg-white">
                        <p className="text-sm text-gray-600 mb-2">{t('profile.sampleText')}</p>
                        <p className="text-gray-900 mb-1">{t('profile.quickBrownFox')}</p>
                        <p className="text-sm text-gray-600">{t('profile.sampleTextDescription')}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Language & Region Section */}
            {activeSection === "language" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-8 bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('profile.languageRegion')}</h2>
                      <p className="text-gray-600">{t('profile.languageRegionDescription')}</p>
                    </div>

                    {/* Interface Language */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.interfaceLanguage')}</h3>
                      <select
                        aria-label="Interface language"
                        value={settings.language.interface}
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            language: {
                              ...settings.language,
                              interface: e.target.value,
                            },
                          });
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="en">English</option>
                        <option value="fr">Français (French)</option>
                        <option value="es">Español (Spanish)</option>
                        <option value="pt">Português (Portuguese)</option>
                      </select>
                      <p className="text-sm text-gray-600 mt-2">
                        {t('profile.languageChangeNote')}
                      </p>
                    </div>

                    {/* Timezone */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.timezone')}</h3>
                      <select
                        aria-label="Timezone"
                        value={settings.language.timezone}
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            language: {
                              ...settings.language,
                              timezone: e.target.value,
                            },
                          });
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="America/Toronto">Eastern Time (Toronto)</option>
                        <option value="America/Vancouver">Pacific Time (Vancouver)</option>
                        <option value="America/Edmonton">Mountain Time (Edmonton)</option>
                        <option value="America/Winnipeg">Central Time (Winnipeg)</option>
                        <option value="America/Halifax">Atlantic Time (Halifax)</option>
                        <option value="America/St_Johns">Newfoundland Time (St. John&apos;s)</option>
                      </select>
                      <p className="text-sm text-gray-600 mt-2">
                        {t('profile.timezoneDescription')}
                      </p>
                    </div>

                    {/* Date Format */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.dateTimeFormat')}</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('profile.dateFormat')}
                          </label>
                          <select aria-label="Date format" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option>MM/DD/YYYY (12/31/2025)</option>
                            <option>DD/MM/YYYY (31/12/2025)</option>
                            <option>YYYY-MM-DD (2025-12-31)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('profile.timeFormat')}
                          </label>
                          <select aria-label="Time format" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option>12-hour (3:30 PM)</option>
                            <option>24-hour (15:30)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.preview')}</h3>
                      <div className="p-6 border border-gray-200 rounded-lg bg-white space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t('profile.currentDate')}</span>
                          <span className="font-medium text-gray-900">November 13, 2025</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t('profile.currentTime')}</span>
                          <span className="font-medium text-gray-900">2:30 PM EST</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t('profile.weekStartsOn')}</span>
                          <span className="font-medium text-gray-900">Sunday</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Privacy Section */}
            {activeSection === "privacy" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-8 bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('profile.privacySettings')}</h2>
                      <p className="text-gray-600">{t('profile.privacyDescription')}</p>
                    </div>

                    {/* Profile Visibility */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.profileVisibility')}</h3>
                      <select
                        aria-label="Profile visibility"
                        value={settings.privacy.profileVisibility}
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            privacy: {
                              ...settings.privacy,
                              profileVisibility: e.target.value,
                            },
                          });
                          setHasChanges(true);
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="public">{t('profile.visibilityPublic')}</option>
                        <option value="members">{t('profile.visibilityMembers')}</option>
                        <option value="private">{t('profile.visibilityPrivate')}</option>
                      </select>
                      <p className="text-sm text-gray-600 mt-2">
                        {t('profile.profileVisibilityDescription')}
                      </p>
                    </div>

                    {/* Activity Tracking */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.activityAnalytics')}</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{t('profile.activityTracking')}</p>
                            <p className="text-sm text-gray-600">
                              {t('profile.activityTrackingDescription')}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSettings({
                                ...settings,
                                privacy: {
                                  ...settings.privacy,
                                  activityTracking: !settings.privacy.activityTracking,
                                },
                              });
                              setHasChanges(true);
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.privacy.activityTracking ? "bg-blue-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                settings.privacy.activityTracking ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{t('profile.dataSharing')}</p>
                            <p className="text-sm text-gray-600">
                              {t('profile.dataSharingDescription')}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSettings({
                                ...settings,
                                privacy: {
                                  ...settings.privacy,
                                  dataSharing: !settings.privacy.dataSharing,
                                },
                              });
                              setHasChanges(true);
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.privacy.dataSharing ? "bg-blue-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                settings.privacy.dataSharing ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Data Management */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.dataManagement')}</h3>
                      <div className="space-y-3">
                        <button className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Download className="w-5 h-5 text-blue-600" />
                            <div className="text-left">
                              <p className="font-medium text-gray-900">{t('profile.downloadYourData')}</p>
                              <p className="text-sm text-gray-600">
                                {t('profile.downloadDataDescription')}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm text-blue-600 font-medium">{t('profile.downloadButton')}</span>
                        </button>

                        <button className="w-full flex items-center justify-between p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Trash2 className="w-5 h-5 text-red-600" />
                            <div className="text-left">
                              <p className="font-medium text-red-900">{t('profile.deleteAccount')}</p>
                              <p className="text-sm text-red-600">
                                {t('profile.deleteAccountDescription')}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm text-red-600 font-medium">{t('profile.deleteButton')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Privacy Policy */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.legal')}</h3>
                      <div className="space-y-3">
                        <button className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <p className="font-medium text-gray-900">{t('profile.privacyPolicy')}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {t('profile.privacyPolicyDescription')}
                          </p>
                        </button>

                        <button className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <p className="font-medium text-gray-900">{t('profile.termsOfService')}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {t('profile.termsDescription')}
                          </p>
                        </button>

                        <button className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <p className="font-medium text-gray-900">{t('profile.cookieSettings')}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {t('profile.cookieSettingsDescription')}
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Save Changes Bar */}
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
              >
                <Card className="px-6 py-4 bg-white shadow-2xl border-gray-200">
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-medium text-gray-900">You have unsaved changes</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHasChanges(false)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                      >
                        Discard
                      </button>
                      <button
                        onClick={handleSaveChanges}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <Card className="mt-8 p-6 bg-blue-50/80 backdrop-blur-sm border-blue-200">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('profile.profileHelp')}</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• {t('profile.helpAutoSave')}</li>
                <li>• {t('profile.helpAdminFields')}</li>
                <li>• {t('profile.help2FA')}</li>
                <li>• {t('profile.helpDataPrivacy')}</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
