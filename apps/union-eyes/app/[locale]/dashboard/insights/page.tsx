/**
 * /dashboard/insights — DEPRECATED: redirects to Intelligence shell (federation tab).
 * Canonical location: /dashboard/intelligence?scope=federation
 */
import { redirect } from "next/navigation";

export default function InsightsPage() {
  redirect("/dashboard/intelligence?scope=federation");
}
