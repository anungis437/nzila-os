'use client';

/**
 * Organization Breadcrumb Component
 *
 * Shows the hierarchical path of the current organization
 * Example: CLC > CUPE > Local 1000
 *
 * The path comes from the organization context. When the context has none, it is read from the signed-in user's profile and
 * GET /api/organizations/{id}/path. A path that could not be read is said to be unavailable, with a retry: it is not drawn as no path.
 * When the caller may not see every ancestor, the path starts with an ellipsis.
 */

import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/hooks/use-organization';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { readOrganizationPath, readProfileOrganization, reasonOf, type OrganizationPath } from './profile-organization';

interface OrganizationBreadcrumbProps {
  className?: string;
  showIcons?: boolean;
}

type Recovery = { attempt: number } & ({ path: OrganizationPath | null } | { error: string });

export function OrganizationBreadcrumb({
  className,
  showIcons: _showIcons = false
}: OrganizationBreadcrumbProps) {
  const { organizationPath, isLoading } = useOrganization();
  const [attempt, setAttempt] = useState(0);
  const [recovery, setRecovery] = useState<Recovery | null>(null);

  const needsRecovery = !isLoading && organizationPath.length === 0;

  useEffect(() => {
    if (!needsRecovery) return;
    let cancelled = false;

    const recoverPath = async (): Promise<OrganizationPath | null> => {
      const organization = await readProfileOrganization();
      return organization === null ? null : readOrganizationPath(organization.id);
    };

    recoverPath().then(
      (path) => {
        if (!cancelled) setRecovery({ attempt, path });
      },
      (failure: unknown) => {
        logger.error('Failed to recover the organization path', failure);
        if (!cancelled) setRecovery({ attempt, error: reasonOf(failure) });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [needsRecovery, attempt]);

  if (isLoading) {
    return null;
  }

  let path: { id: string; name: string }[];
  let omittedAncestors = 0;
  if (organizationPath.length > 0) {
    path = organizationPath;
  } else {
    const settled = recovery !== null && recovery.attempt === attempt ? recovery : null;
    // Still being read, or the profile names no organization: there is no path to show.
    if (settled === null || ('path' in settled && settled.path === null)) {
      return null;
    }
    if ('error' in settled) {
      return (
        <div role="status" className={cn('flex items-center gap-2 text-sm text-destructive', className)}>
          <span title={settled.error}>Organization path unavailable</span>
          <button type="button" className="underline" onClick={() => setAttempt((count) => count + 1)}>
            Retry
          </button>
        </div>
      );
    }
    path = settled.path?.entries ?? [];
    omittedAncestors = settled.path?.omittedAncestors ?? 0;
  }

  if (path.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Organization path" className={cn('flex items-center space-x-1 text-sm text-muted-foreground', className)}>
      {omittedAncestors > 0 && (
        <div className="flex items-center">
          <span title="Higher organizations you cannot see are not listed">…</span>
          <ChevronRight className="h-4 w-4 mx-1" />
        </div>
      )}
      {path.map((org, index) => (
        <div key={org.id} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
          <span
            className={cn(
              'hover:text-foreground transition-colors',
              index === path.length - 1 && 'text-foreground font-medium'
            )}
          >
            {org.name}
          </span>
        </div>
      ))}
    </nav>
  );
}
