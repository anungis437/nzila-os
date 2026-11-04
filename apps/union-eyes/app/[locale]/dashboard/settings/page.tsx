/**
 * Dashboard Settings Page
 *
 * Server component that detects the user's role and renders:
 *  - Platform system settings for super-admin roles (app_owner, coo, cto, etc.)
 *  - Organization settings for client-org roles (admin, steward, member, etc.)
 *
 * Both views render inside the same dashboard layout (sidebar + breadcrumb).
 */

export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, getUserRole } from "@/lib/api-auth-guard";
import { canManageOrganizationSettings } from "@/lib/auth/org-settings-access";
import { getTranslations } from "next-intl/server";
import { isUuid } from "@/lib/page-data/uuid";
import { loadPlatformSettings, type PlatformSettingsRows } from "@/lib/dashboard-reads/platform-settings";
import PlatformSettingsContent from "./_components/platform-settings-content";
import OrgSettingsContent from "./_components/org-settings-content";
import type { PlatformSettingsData } from "./_components/platform-settings-content";

const PLATFORM_ROLES = new Set([
  "app_owner", "coo", "cto",
  "platform_lead", "customer_success_director",
  "support_manager", "data_analytics_manager", "billing_manager",
  "integration_manager", "compliance_manager", "security_manager",
  "support_agent", "data_analyst", "billing_specialist",
  "integration_specialist",
  "content_manager", "training_coordinator",
]);

/** The route stores these two as yes/no. A value an earlier screen saved as a level ("admins_only", "critical") is "yes" unless it was "disabled". */
const enabledFlag = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : typeof value === "string" ? value !== "disabled" : fallback;

function toPlatformSettingsData({ settings, featuresEnabled, apiKeys, services }: PlatformSettingsRows): PlatformSettingsData {
  return {
    settings: {
      sessionTimeout: Number(settings.sessionTimeout ?? 30),
      mfaEnforcement: enabledFlag(settings.mfaEnforcement, true),
      passwordMinLength: Number(settings.passwordMinLength ?? 12),
      requireMixedCase: Boolean(settings.requireMixedCase ?? true),
      requireSymbol: Boolean(settings.requireSymbol ?? true),
      rateLimitPerMin: Number(settings.rateLimitPerMin ?? 100),
      emailDigest: Boolean(settings.emailDigest ?? true),
      digestFrequency: String(settings.digestFrequency ?? "daily"),
      pushNotifications: Boolean(settings.pushNotifications ?? true),
      smsAlerts: enabledFlag(settings.smsAlerts, true),
      webhookNotifications: Boolean(settings.webhookNotifications ?? false),
      webhookUrl: String(settings.webhookUrl ?? ""),
      voiceGrievance: Boolean(settings.voiceGrievance ?? true),
      aiClauseAnalysis: Boolean(settings.aiClauseAnalysis ?? true),
      mobileAccess: Boolean(settings.mobileAccess ?? true),
      crossUnionAnalytics: Boolean(settings.crossUnionAnalytics ?? false),
      defaultLanguage: String(settings.defaultLanguage ?? "en"),
      dateFormat: String(settings.dateFormat ?? "YYYY-MM-DD"),
      currency: String(settings.currency ?? "CAD"),
    },
    apiKeys: apiKeys.map((key) => ({
      id: key.id,
      keyName: key.name,
      keyPrefix: key.keyPrefix,
      status: key.status,
      scopes: key.scopes,
      requestCount: key.requestCount,
    })),
    integrations: services.map((service) => ({
      label: service.serviceName,
      status: service.status as "healthy" | "degraded" | "down",
      detail: service.status,
    })),
    featuresEnabled,
  };
}

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboardSettingsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function SettingsPage({ params }: PageProps) {
  const { locale } = await params;
  const user = await requireUser();

  const organizationId = user.organizationId;
  const userRole = await getUserRole(user.userId, organizationId);

  // Organization configuration is for administrators only. Everyone else (including members)
  // goes to their own Profile & Settings, which holds only personal information and preferences.
  if (!canManageOrganizationSettings(userRole)) {
    redirect(`/${locale}/dashboard/profile`);
  }

  if (userRole && PLATFORM_ROLES.has(userRole)) {
    // The platform view is read in the person's own organization; an organization that is not a platform one has no platform settings.
    const rows = isUuid(organizationId) ? await loadPlatformSettings(organizationId) : null;
    if (rows) {
      return <PlatformSettingsContent initialData={toPlatformSettingsData(rows)} />;
    }
  }

  return <OrgSettingsContent />;
}
