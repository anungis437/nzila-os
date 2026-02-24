export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import Link from 'next/link';
import ExecutiveDashboard from "@/components/executive/ExecutiveDashboard";
import KeyMetricsWidget from "@/components/executive/KeyMetricsWidget";
import StrategicPlanningBoard from "@/components/executive/StrategicPlanningBoard";

export const metadata: Metadata = {
  title: "Executive Dashboard | UnionEyes",
  description: "Strategic overview and executive tools for union leadership",
};

export default async function ExecutiveDashboardPage() {
  const user = await requireUser();
  
  // Require at least vice_president level (85) to access executive dashboard
  const hasAccess = await hasMinRole("vice_president");
  
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Get user's organization context
  const organizationId = user.organizationId || "default";
  const userRole = user.roles[0] || "president";

  // Example metrics for KeyMetricsWidget
  const executiveMetrics = [
    { label: "Total Members", value: 1247, format: "number" as const, change: 3.2, changeLabel: "vs last month" },
    { label: "Active Grievances", value: 23, format: "number" as const, change: -12.5, changeLabel: "vs last month" },
    { label: "Monthly Budget", value: 125000, format: "currency" as const, change: 5.0, changeLabel: "utilized" },
    { label: "Member Satisfaction", value: 87, format: "percentage" as const, change: 4.2, changeLabel: "improvement" },
  ];

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Main Executive Dashboard */}
      <ExecutiveDashboard organizationId={organizationId} userRole={userRole} />

      {/* Additional Widgets */}
      <div className="grid gap-6 md:grid-cols-2">
        <KeyMetricsWidget metrics={executiveMetrics} title="Executive KPIs" />
        <div className="space-y-4">
          {/* Quick Links Card */}
          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/dashboard/admin/governance" className="block p-3 hover:bg-accent rounded-lg transition-colors">
                <div className="font-medium">Governance</div>
                <div className="text-sm text-muted-foreground">Bylaws, policies, signatories</div>
              </Link>
              <Link href="/dashboard/financial" className="block p-3 hover:bg-accent rounded-lg transition-colors">
                <div className="font-medium">Financial Reports</div>
                <div className="text-sm text-muted-foreground">Budget, expenses, revenue</div>
              </Link>
              <Link href="/dashboard/members" className="block p-3 hover:bg-accent rounded-lg transition-colors">
                <div className="font-medium">Member Directory</div>
                <div className="text-sm text-muted-foreground">View and manage members</div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Planning Board */}
      <StrategicPlanningBoard />
    </div>
  );
}
