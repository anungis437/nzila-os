"use client";

import PilotAdminOverview from "@/components/pilot/pilot-admin-overview";
import { useOrganizationId } from "@/lib/hooks/use-organization";

export default function PilotAdminPage() {
  const organizationId = useOrganizationId();

  if (!organizationId) {
    return (
      <div className="text-center py-12 text-gray-500">
        Select an organization to view pilot metrics.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Pilot Overview</h2>
        <p className="text-sm text-gray-600 mt-1">
          Usage metrics, friction alerts, and conversion readiness for the active pilot.
        </p>
      </div>
      <PilotAdminOverview organizationId={organizationId} />
    </div>
  );
}
