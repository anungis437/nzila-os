"use client";

import { CommitteeManagement } from "@/components/union-structure/CommitteeManagement";
import { useOrganization } from "@/contexts/organization-context";

export function CommitteesPage() {
  const { organizationId } = useOrganization();

  if (!organizationId) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        Select an organization to manage committees.
      </p>
    );
  }

  return <CommitteeManagement organizationId={organizationId} />;
}
