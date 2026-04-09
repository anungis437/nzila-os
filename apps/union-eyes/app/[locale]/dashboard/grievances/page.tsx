/**
 * /dashboard/grievances — DEPRECATED: redirects to Work surface (grievances tab).
 * Canonical location: /dashboard/work
 */
import { redirect } from "next/navigation";

export default function GrievancesPage() {
  redirect("/dashboard/work");
}
