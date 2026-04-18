'use client';

/**
 * Organization Breadcrumb Component
 * 
 * Shows the hierarchical path of the current organization
 * Example: CLC > CUPE > Local 1000
 */

import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/hooks/use-organization';
 
import { cn } from '@/lib/utils';

interface OrganizationBreadcrumbProps {
  className?: string;
  showIcons?: boolean;
}

export function OrganizationBreadcrumb({ 
  className,
  showIcons: _showIcons = false 
}: OrganizationBreadcrumbProps) {
  const { organizationPath, isLoading } = useOrganization();
  const [fallbackPath, setFallbackPath] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (isLoading || organizationPath.length > 0) {
      return;
    }

    let cancelled = false;

    const recoverPath = async () => {
      try {
        const profileResponse = await fetch('/api/users/me/profile', {
          credentials: 'include',
        });

        if (!profileResponse.ok) {
          return;
        }

        const profileResult = await profileResponse.json();
        const organizationId = profileResult.organization?.id as string | undefined;
        if (!organizationId || cancelled) {
          return;
        }

        const pathResponse = await fetch(`/api/organizations/${organizationId}/path`, {
          credentials: 'include',
        });

        if (!pathResponse.ok || cancelled) {
          return;
        }

        const pathResult = await pathResponse.json();
        setFallbackPath(pathResult.data || []);
      } catch {
        // Leave breadcrumb empty if recovery fails.
      }
    };

    void recoverPath();

    return () => {
      cancelled = true;
    };
  }, [isLoading, organizationPath]);

  const resolvedPath = organizationPath.length > 0 ? organizationPath : fallbackPath;

  if (isLoading || resolvedPath.length === 0) {
    return null;
  }

  return (
    <nav className={cn('flex items-center space-x-1 text-sm text-muted-foreground', className)}>
      {resolvedPath.map((org, index) => (
        <div key={org.id} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
          <span 
            className={cn(
              'hover:text-foreground transition-colors',
              index === resolvedPath.length - 1 && 'text-foreground font-medium'
            )}
          >
            {org.name}
          </span>
        </div>
      ))}
    </nav>
  );
}

