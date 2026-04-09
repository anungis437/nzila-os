/**
 * CBA Intelligence Page
 * Auth-gated — requires commercial_reporting entitlement.
 * Tabbed interface for Sources, Ingestion, Agreements, Review, Benchmark, Freshness.
 */

import { requireUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { CbaIntelligenceClient } from "./cba-intelligence-client";

export const dynamic = "force-dynamic";

export default async function CbaIntelligencePage() {
  const user = await requireUser();

  // Require at least steward-level access
  const allowedRoles = [
    "app_owner", "system_admin", "admin",
    "clc_executive", "clc_staff",
    "fed_executive", "fed_staff",
    "national_officer", "president", "vice_president",
    "secretary_treasurer", "chief_steward", "officer", "steward",
    "bargaining_committee", "health_safety_rep",
    "congress_staff", "federation_staff",
  ];

  const hasAccess = user.roles.some((r) => allowedRoles.includes(r));
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <CbaIntelligenceClient />;
}
