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
import { InboxConsole } from "@/components/inbox/inbox-console";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";
import { Cupe4373InboxPage } from "@/components/demo/cupe4373-inbox-page";

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

  if (isCupe4373DemoRuntime()) {
    return <Cupe4373InboxPage />;
  }

  return <InboxConsole />;
}
