"use client";

import { useEffect, useState } from "react";
import { CommitteeManagement } from "@/components/union-structure/CommitteeManagement";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/organization-context";
import { logger } from "@/lib/logger";
import { reasonOf, readProfileOrganization } from "@/components/organization/profile-organization";

const WRITE_ROLES = [
  "steward", "chief_steward", "officer",
  "president", "vice_president", "secretary_treasurer",
  "national_officer", "admin", "system_admin", "app_owner",
  "platform_ops", "clerk",
];

type Recovery = { attempt: number } & ({ organizationId: string | null } | { error: string });

export function CommitteesPage({ userRole }: { userRole: string }) {
  const { organizationId, organization, userOrganizations, isLoading, error, refreshOrganizations } = useOrganization();
  const [attempt, setAttempt] = useState(0);
  const [recovery, setRecovery] = useState<Recovery | null>(null);

  const contextOrganizationId = organizationId ?? organization?.id ?? userOrganizations[0]?.id ?? null;
  // The context has settled without an organization: ask the profile, which can name one when the membership list could not.
  const needsRecovery = contextOrganizationId === null && !isLoading;

  useEffect(() => {
    if (!needsRecovery) return;
    let cancelled = false;
    readProfileOrganization().then(
      (found) => {
        if (!cancelled) setRecovery({ attempt, organizationId: found?.id ?? null });
      },
      (failure: unknown) => {
        logger.error("Failed to look up the organization of the signed-in user", failure);
        if (!cancelled) setRecovery({ attempt, error: reasonOf(failure) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [needsRecovery, attempt]);

  const settled = recovery !== null && recovery.attempt === attempt ? recovery : null;
  const resolvedOrganizationId = contextOrganizationId ?? (settled !== null && "organizationId" in settled ? settled.organizationId : null);

  if (resolvedOrganizationId) {
    const readOnly = !WRITE_ROLES.includes(userRole);
    return <CommitteeManagement organizationId={resolvedOrganizationId} readOnly={readOnly} />;
  }

  if (isLoading || settled === null) {
    return (
      <div role="status" aria-label="Loading organization" className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Without an organization, the reason is shown when there is one: the profile lookup failed, or the context itself could not load.
  const problem = "error" in settled ? settled.error : error;
  if (problem) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-destructive">Your organization could not be loaded: {problem}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAttempt((count) => count + 1);
            void refreshOrganizations();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <p className="text-sm text-gray-400 py-8 text-center">
      Select an organization to manage committees.
    </p>
  );
}
