"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Key,
  Server,
  ToggleLeft,
} from "lucide-react";

type PlatformSection = "security" | "notifications" | "integrations" | "featureFlags" | "localization" | "apiKeys";

/* ── Placeholder settings (will be read from DB / env in a future sprint) ── */
const SYSTEM_SETTINGS: Record<PlatformSection, {
  label: string;
  icon: typeof Shield;
  description: string;
  items: { label: string; value: string; status: "active" | "warning" | "inactive" }[];
}> = {
  security: {
    label: "Security",
    icon: Shield,
    description: "Authentication, session, and access-control policies",
    items: [
      { label: "Session timeout", value: "30 minutes", status: "active" },
      { label: "MFA enforcement", value: "Required for admins", status: "active" },
      { label: "Password policy", value: "12+ chars, mixed case, symbol", status: "active" },
      { label: "API rate limiting", value: "100 req/min per user", status: "active" },
    ],
  },
  notifications: {
    label: "Notifications",
    icon: Bell,
    description: "Default notification channels and digest frequency",
    items: [
      { label: "Email digest", value: "Daily", status: "active" },
      { label: "Push notifications", value: "Enabled", status: "active" },
      { label: "SMS alerts", value: "Critical only", status: "warning" },
      { label: "Webhook notifications", value: "Disabled", status: "inactive" },
    ],
  },
  integrations: {
    label: "Integrations",
    icon: Server,
    description: "Third-party service connections and API keys",
    items: [
      { label: "Clerk authentication", value: "Connected", status: "active" },
      { label: "Stripe payments", value: "Connected", status: "active" },
      { label: "PayPal payments", value: "Connected", status: "active" },
      { label: "Django backend", value: "Connected", status: "active" },
    ],
  },
  featureFlags: {
    label: "Feature Flags",
    icon: ToggleLeft,
    description: "Enable or disable platform features globally",
    items: [
      { label: "Voice grievance filing", value: "Enabled", status: "active" },
      { label: "AI clause analysis", value: "Enabled", status: "active" },
      { label: "Mobile app access", value: "Enabled", status: "active" },
      { label: "Cross-union analytics", value: "Beta", status: "warning" },
    ],
  },
  localization: {
    label: "Localization",
    icon: Globe,
    description: "Language and regional settings",
    items: [
      { label: "Default language", value: "English (en)", status: "active" },
      { label: "Supported locales", value: "en, fr", status: "active" },
      { label: "Date format", value: "YYYY-MM-DD", status: "active" },
      { label: "Currency", value: "CAD", status: "active" },
    ],
  },
  apiKeys: {
    label: "API Keys",
    icon: Key,
    description: "Platform API key management",
    items: [
      { label: "Production API key", value: "••••••••k7x2", status: "active" },
      { label: "Staging API key", value: "••••••••m3p9", status: "active" },
      { label: "Webhook signing secret", value: "••••••••a1b4", status: "active" },
    ],
  },
};

const SECTION_ORDER: PlatformSection[] = [
  "security", "notifications", "integrations", "featureFlags", "localization", "apiKeys",
];

const SECTION_COLORS: Record<PlatformSection, string> = {
  security: "bg-red-100 text-red-700",
  notifications: "bg-yellow-100 text-yellow-700",
  integrations: "bg-orange-100 text-orange-700",
  featureFlags: "bg-green-100 text-green-700",
  localization: "bg-blue-100 text-blue-700",
  apiKeys: "bg-purple-100 text-purple-700",
};

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "warning":
      return "bg-yellow-100 text-yellow-700";
    case "inactive":
      return "bg-gray-100 text-gray-500";
    default:
      return "bg-gray-100 text-gray-500";
  }
}

export default function PlatformSettingsContent() {
  const [activeSection, setActiveSection] = useState<PlatformSection>("security");
  const current = SYSTEM_SETTINGS[activeSection];
  const Icon = current.icon;

  return (
    <div className="p-8">
      {/* Header — matches org settings layout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
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
        {/* Sidebar Navigation — same structure as org settings */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-64 shrink-0"
        >
          <Card className="p-4 sticky top-24">
            <div className="space-y-1">
              {SECTION_ORDER.map((key) => {
                const s = SYSTEM_SETTINGS[key];
                const SIcon = s.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeSection === key
                        ? "bg-blue-50 text-blue-700 shadow-sm"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${SECTION_COLORS[key]} flex items-center justify-center`}>
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
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1"
        >
          <Card className="p-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Icon className="h-6 w-6 text-blue-600" />
                  {current.label}
                </h2>
                <p className="text-gray-600">{current.description}</p>
              </div>

              <div className="space-y-3">
                {current.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {item.label}
                    </span>
                    <Badge
                      variant="secondary"
                      className={statusColor(item.status)}
                    >
                      {item.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
