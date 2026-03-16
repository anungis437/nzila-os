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

import { requireUser, getUserRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import { withSystemContext } from '@/lib/db/with-rls-context';
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

async function loadPlatformSettings(): Promise<PlatformSettingsData> {
  // Load platform org settings JSONB
  const orgRows = Array.from(
    await db.execute(sql`
      SELECT settings, features_enabled
      FROM organizations
      WHERE organization_type IN ('platform', 'congress')
      LIMIT 1
    `)
  );
  const org = orgRows[0] as Record<string, unknown> | undefined;
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const featuresEnabled = Array.isArray(org?.features_enabled)
    ? (org.features_enabled as string[])
    : [];

  // Load API keys for the platform org
  const keyRows = Array.from(
    await db.execute(sql`
      SELECT k.id, k.name, k.key_prefix, k.environment, k.status,
             k.scopes, k.request_count::int as request_count
      FROM integration_api_keys k
      JOIN organizations o ON o.id = k.organization_id
      WHERE o.organization_type IN ('platform', 'congress')
      ORDER BY k.created_at DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    keyName: String(r.name),
    keyPrefix: String(r.key_prefix),
    environment: String(r.environment),
    status: String(r.status),
    scopes: Array.isArray(r.scopes) ? (r.scopes as string[]) : [],
    requestCount: Number(r.request_count),
  }));

  // Load platform services as integrations
  const serviceRows = Array.from(
    await db.execute(sql`
      SELECT service_name, status
      FROM platform_services
      ORDER BY service_name
    `)
  ).map((r: Record<string, unknown>) => ({
    label: String(r.service_name),
    status: String(r.status) as "healthy" | "degraded" | "down",
    detail: String(r.status),
  }));

  return {
    settings: {
      sessionTimeout: Number(settings.sessionTimeout ?? 30),
      mfaEnforcement: String(settings.mfaEnforcement ?? "admins_only"),
      passwordMinLength: Number(settings.passwordMinLength ?? 12),
      requireMixedCase: Boolean(settings.requireMixedCase ?? true),
      requireSymbol: Boolean(settings.requireSymbol ?? true),
      rateLimitPerMin: Number(settings.rateLimitPerMin ?? 100),
      emailDigest: Boolean(settings.emailDigest ?? true),
      digestFrequency: String(settings.digestFrequency ?? "daily"),
      pushNotifications: Boolean(settings.pushNotifications ?? true),
      smsAlerts: String(settings.smsAlerts ?? "critical"),
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
    apiKeys: keyRows,
    integrations: serviceRows,
    featuresEnabled,
  };
}

export default async function SettingsPage() {
  const user = await requireUser();

  const organizationId = user.organizationId;
  const userRole = await getUserRole(user.userId, organizationId);

  if (PLATFORM_ROLES.has(userRole)) {
    const data = await withSystemContext(() => loadPlatformSettings());
    return <PlatformSettingsContent initialData={data} />;
  }

  return <OrgSettingsContent />;
}
