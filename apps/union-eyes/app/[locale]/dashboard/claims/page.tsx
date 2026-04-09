/**
 * /dashboard/claims — DEPRECATED: redirects to Inbox with intake filter.
 * Canonical location: /dashboard/inbox?type=intake
 */
import { redirect } from "next/navigation";

export default function ClaimsPage() {
  redirect("/dashboard/inbox?type=intake");
}