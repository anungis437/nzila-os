"use client";

import { useLocale } from "next-intl";
import { CapabilityUnavailable } from "@/components/system/capability-unavailable";

/**
 * CLC labour intelligence.
 *
 * The console read six routes under /api/v2/analytics/clc (sector signals, affiliate trends, knowledge index, governance, decision
 * intelligence, executive brief). /api/v2 answers HTTP 410 and no replacement route exists; the governed queries are in
 * lib/clc/data-products.ts but nothing serves them.
 */
export default function CLCIntelligenceConsole() {
  const locale = useLocale();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Labour Intelligence</h1>
      <CapabilityUnavailable locale={locale} capability="UE-CLC-INTELLIGENCE" />
    </div>
  );
}
