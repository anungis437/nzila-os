"use client";

import { useLocale, useTranslations } from "next-intl";
import { CapabilityUnavailable } from "@/components/system/capability-unavailable";

interface AnalyticsOverviewConsoleProps {
  canViewTopPerformers?: boolean;
}

/**
 * Analytics overview.
 *
 * No route computes an organization overview in this release. The console read /api/v2/analytics/overview, which answers HTTP 410, and
 * showed zero cases, zero resolved and an empty chart when it did (its catch block swallowed the failure); every /api/analytics/* collection
 * that could stand in (dashboard, claims, members, financial, operational, ...) is the stored-metrics list of one table, which holds
 * nothing until a metric is posted by hand (the daily-metrics cron is not implemented).
 */
export function AnalyticsOverviewConsole(_props: AnalyticsOverviewConsoleProps) {
  const t = useTranslations("analytics");
  const locale = useLocale();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-gray-600">{t("subtitle")}</p>
      </div>
      <CapabilityUnavailable locale={locale} capability="UE-ANALYTICS-OVERVIEW" />
    </div>
  );
}
