"use client";

import { CommitteeManagement } from "@/components/union-structure/CommitteeManagement";
import { useOrganization } from "@/contexts/organization-context";

const WRITE_ROLES = [
  "steward", "chief_steward", "officer",
  "president", "vice_president", "secretary_treasurer",
  "national_officer", "admin", "system_admin", "app_owner",
  "platform_ops", "clerk",
];

export function CommitteesPage({ userRole }: { userRole: string }) {
  const { organizationId } = useOrganization();

  if (!organizationId) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        Select an organization to manage committees.
      </p>
    );
  }

  const readOnly = !WRITE_ROLES.includes(userRole);

  return <CommitteeManagement organizationId={organizationId} readOnly={readOnly} />;
}
