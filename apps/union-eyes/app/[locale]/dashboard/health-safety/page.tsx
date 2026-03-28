/**
 * Health & Safety Dashboard - Server Component Gate
 * 
 * Restricts the H&S dashboard to health_safety_rep role and above.
 * Regular members can still report incidents via /incidents/new.
 * 
 * @page app/[locale]/dashboard/health-safety/page.tsx
 */

export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import HealthSafetyOverview from "@/components/health-safety/HealthSafetyOverview";

export const metadata: Metadata = {
  title: "Health & Safety | UnionEyes",
  description: "Workplace health and safety monitoring and incident management",
};

export default async function HealthSafetyPage() {
  await requireUser();

  const hasAccess = await hasMinRole("health_safety_rep");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <HealthSafetyOverview />;
}
