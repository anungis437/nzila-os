/**
 * Labor Continuity Intelligence Page
 * Auth-gated — requires commercial_reporting entitlement.
 * Tabbed interface for sources, ingestion, agreements, review, benchmarks, and freshness.
 */

import type { Metadata } from "next";
import { requireUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CbaIntelligenceClient } from "./cba-intelligence-client";
import { RuntimeHydrationFooter } from "@/components/runtime-hydration";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cbaIntelligencePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

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

  return (
    <>
      <CbaIntelligenceClient />
      <RuntimeHydrationFooter
        surface="Labour Continuity Intelligence"
        provenance={{
          sourceAdapter: 'cba-intelligence/freshness + institutional-governance-graph chronology',
          contractVersion: 'cba.intelligence.v1',
        }}
        chronology={{}}
        continuity={{}}
        explainability={{
          visibilityRationale:
            'CBA freshness, agreement, and benchmark refs are projected read-only and joined to the institutional chronology. Reviewer-led — no automated bargaining recommendations.',
          reviewPosture: 'assistive · human-reviewed · review-required',
        }}
      />
    </>
  );
}
