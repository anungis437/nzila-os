export const dynamic = 'force-dynamic';

/**
 * Inbox — Unified Signal Feed
 *
 * Merges intake submissions, messages, alerts, notifications, and
 * system signals into a single feed.  Answers the question:
 * "What needs my attention right now?"
 *
 * Quick actions: review, request info, convert to case.
 */

import { requireUser } from "@/lib/api-auth-guard";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, currentUser } from "@nzila/platform-auth/entra/server";
import { getDashboardExperience } from "@/lib/dashboard/role-experience";
import { Cupe4373InboxPage } from "@/components/demo/cupe4373-inbox-page";
import { Cupe4373MemberInboxPage } from "@/components/demo/cupe4373-member-views";
import {
  resolveDemoMemberPersona,
  getMemberInboxItems,
  getMemberCases,
} from "@/lib/demo/cupe4373-member-view";
import { getUserRole } from "@/lib/auth/rbac-server";
import { UserRole } from "@/lib/auth/roles";
import { getOrganizationIdForUser, DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";
import { logger } from "@/lib/logger";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inboxPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function InboxPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  // Demo build: scope inbox by role in demo mode. Members see only their
  // own messages and case-update alerts; stewards / officers / admins see
  // the full demo intake console. No operational fallback exists here.
  const { userId } = await auth();
  let demoOrgId: string = DEFAULT_ORGANIZATION_ID;
  try {
    if (userId) demoOrgId = await getOrganizationIdForUser(userId);
  } catch (error) {
    logger.warn("[dashboard:inbox] demo getOrganizationIdForUser threw", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  let role: UserRole = UserRole.MEMBER;
  try {
    if (userId) role = await getUserRole(userId, demoOrgId);
  } catch (error) {
    logger.warn("[dashboard:inbox] demo getUserRole threw — defaulting to member", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (getDashboardExperience(role) === "member") {
    const user = await currentUser();
    const persona = resolveDemoMemberPersona({
      fullName: user?.fullName ?? null,
      firstName: user?.firstName ?? null,
      email: user?.emailAddresses?.[0]?.emailAddress ?? null,
    });
    return (
      <Cupe4373MemberInboxPage
        persona={persona}
        items={getMemberInboxItems(persona)}
        memberCases={getMemberCases(persona)}
      />
    );
  }
  return <Cupe4373InboxPage />;
}
