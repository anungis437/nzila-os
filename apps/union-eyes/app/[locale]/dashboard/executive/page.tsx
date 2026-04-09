/**
 * /dashboard/executive — DEPRECATED: redirects to Intelligence shell (executive tab).
 * Canonical location: /dashboard/intelligence?scope=executive
 */
import { redirect } from "next/navigation";

export default function ExecutiveDashboardPage() {
  redirect("/dashboard/intelligence?scope=executive");
}
