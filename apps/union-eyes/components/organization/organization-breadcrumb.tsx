'use client';

/**
 * Organization Breadcrumb Component
 * 
 * Shows the hierarchical path of the current organization
 * Example: CLC > CUPE > Local 1000
 */

import { ChevronRight } from 'lucide-react';
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

  if (isLoading || organizationPath.length === 0) {
    return null;
  }

  return (
    <nav className={cn('flex items-center space-x-1 text-sm text-muted-foreground', className)}>
      {organizationPath.map((org, index) => (
        <div key={org.id} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
          <span 
            className={cn(
              'hover:text-foreground transition-colors',
              index === organizationPath.length - 1 && 'text-foreground font-medium'
            )}
          >
            {org.name}
          </span>
        </div>
      ))}
    </nav>
  );
}

