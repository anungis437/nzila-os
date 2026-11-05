"use client";

import { useLocale } from "next-intl";
import { CapabilityUnavailable } from "@/components/system/capability-unavailable";

/**
 * Cross-union analytics.
 *
 * The console read three routes (/api/analytics/clause-stats, /precedent-stats and /org-activity) that are each a copy of the stored-metrics
 * list of one table, so none returned the statistics, distributions, most-cited lists or sharing adoption the console drew, and every
 * StatCard read zero. The governed queries for these figures exist in lib/clc/data-products.ts but no route serves them.
 */
export default function CrossUnionAnalyticsConsole() {
  const locale = useLocale();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Cross-Union Analytics</h1>
      <CapabilityUnavailable locale={locale} capability="UE-CROSS-UNION-ANALYTICS" />
    </div>
  );
}
