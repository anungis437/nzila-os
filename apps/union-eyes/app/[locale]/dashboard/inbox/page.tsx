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

  return <InboxConsole />;
}
