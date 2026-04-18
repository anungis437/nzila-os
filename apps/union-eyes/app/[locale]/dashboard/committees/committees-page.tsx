"use client";

import { useEffect, useState } from "react";
import { CommitteeManagement } from "@/components/union-structure/CommitteeManagement";
import { useOrganization } from "@/contexts/organization-context";

const WRITE_ROLES = [
  "steward", "chief_steward", "officer",
  "president", "vice_president", "secretary_treasurer",
  "national_officer", "admin", "system_admin", "app_owner",
  "platform_ops", "clerk",
];

export function CommitteesPage({ userRole }: { userRole: string }) {
  const { organizationId, organization, userOrganizations } = useOrganization();
  const [recoveredOrganizationId, setRecoveredOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId || organization?.id || userOrganizations[0]?.id) {
      return;
    }

    let cancelled = false;

    const recoverOrganization = async () => {
      try {
        const response = await fetch('/api/users/me/profile', {
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json();
        const fallbackId = result?.organization?.id as string | undefined;
        if (!cancelled && fallbackId) {
          setRecoveredOrganizationId(fallbackId);
        }
      } catch {
        // Keep existing empty state if recovery fails.
      }
    };

    void recoverOrganization();

    return () => {
      cancelled = true;
    };
  }, [organization?.id, organizationId, userOrganizations]);

  const resolvedOrganizationId =
    organizationId
    ?? organization?.id
    ?? userOrganizations[0]?.id
    ?? recoveredOrganizationId;

  if (!resolvedOrganizationId) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        Select an organization to manage committees.
      </p>
    );
  }

  const readOnly = !WRITE_ROLES.includes(userRole);

  return <CommitteeManagement organizationId={resolvedOrganizationId} readOnly={readOnly} />;
}
