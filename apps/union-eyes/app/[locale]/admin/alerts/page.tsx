/**
 * Admin Alerts Page
 *
 * Provides the alert management dashboard for rule monitoring and execution history.
 */


export const dynamic = 'force-dynamic';

import AlertManagementDashboard from "@/components/automation/alert-management-dashboard";

export default function AdminAlertsPage() {
  return <AlertManagementDashboard />;
}
