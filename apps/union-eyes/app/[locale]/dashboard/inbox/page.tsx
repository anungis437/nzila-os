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
import { redirect } from "next/navigation";
import { InboxConsole } from "@/components/inbox/inbox-console";

export const metadata = {
  title: "Inbox | UnionEyes",
  description: "Unified signal feed — everything that needs your attention",
};

export default async function InboxPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  return <InboxConsole />;
}
