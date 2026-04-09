/**
 * /dashboard/messages — DEPRECATED: redirects to Inbox with message filter.
 * Canonical location: /dashboard/inbox?type=message
 */
import { redirect } from "next/navigation";

export default function MessagesDashboardPage() {
  redirect("/dashboard/inbox?type=message");
}
