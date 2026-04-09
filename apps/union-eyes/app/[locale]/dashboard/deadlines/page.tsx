/**
 * /dashboard/deadlines — DEPRECATED: redirects to Priorities shell.
 * Canonical location: /dashboard/priorities
 */
import { redirect } from "next/navigation";

export default function DeadlinesPage() {
  redirect("/dashboard/priorities");
}
