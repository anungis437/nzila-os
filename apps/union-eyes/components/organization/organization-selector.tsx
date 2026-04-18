'use client';

/**
 * Organization Selector Component
 * 
 * Dropdown/combobox for switching between organizations
 * Shows user's available organizations with icons, names, and hierarchy paths
 */

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Building2, Users, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useOrganization } from '@/lib/hooks/use-organization';

const organizationTypeIcons = {
  congress: Globe,
  federation: Globe,
  union: Building2,
  local: Users,
  chapter: Users,
};

type FallbackOrganization = {
  id: string;
  name: string;
  slug: string;
  type: 'platform' | 'congress' | 'federation' | 'union' | 'local' | 'district' | 'chapter';
};

export function OrganizationSelector() {
  const { 
    organizationId, 
    organization, 
    organizationPath,
    userOrganizations, 
    switchOrganization,
    isLoading,
    error,
    refreshOrganizations
  } = useOrganization();
  
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fallbackOrganization, setFallbackOrganization] = useState<FallbackOrganization | null>(null);
  const [fallbackPath, setFallbackPath] = useState<Array<{ id: string; name: string }>>([]);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleSelectOrganization = async (orgId: string) => {
    if (orgId !== organizationId) {
      await switchOrganization(orgId);
    }
    setOpen(false);
  };

  if (error) {
    return (
      <Button 
        variant="outline" 
        className="w-70 justify-between text-red-600"
        onClick={() => refreshOrganizations()}
      >
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Error loading - Click to retry
        </span>
      </Button>
    );
  }

  // In some auth/context races, `organization` can be null while the org list
  // is already loaded. Fall back to the selected org (or first available)
  // so the selector doesn't get stuck showing "Loading...".
  const effectiveOrganization = organization
    ?? userOrganizations.find((org) => org.id === organizationId)
    ?? userOrganizations[0]
    ?? fallbackOrganization
    ?? null;

  useEffect(() => {
    if (!mounted || effectiveOrganization || isLoading) {
      return;
    }

    let cancelled = false;

    const recoverOrganization = async () => {
      try {
        const profileResponse = await fetch('/api/users/me/profile', {
          credentials: 'include',
        });

        if (!profileResponse.ok) {
          return;
        }

        const profileResult = await profileResponse.json();
        const profileOrg = profileResult.organization as FallbackOrganization | null;
        if (!profileOrg?.id || cancelled) {
          return;
        }

        setFallbackOrganization(profileOrg);

        const pathResponse = await fetch(`/api/organizations/${profileOrg.id}/path`, {
          credentials: 'include',
        });

        if (!pathResponse.ok || cancelled) {
          return;
        }

        const pathResult = await pathResponse.json();
        setFallbackPath(pathResult.data || []);
      } catch {
        // Keep the existing empty state if recovery fails.
      }
    };

    void recoverOrganization();

    return () => {
      cancelled = true;
    };
  }, [effectiveOrganization, isLoading, mounted]);

  // Prevent hydration mismatch - render placeholder until mounted.
  // Keep this return AFTER all hooks so hook ordering stays stable.
  if (!mounted) {
    return (
      <div className="w-70 h-10 flex items-center border rounded-md px-3 bg-background">
        <Building2 className="h-4 w-4 text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (isLoading && !effectiveOrganization) {
    return (
      <Button variant="outline" disabled className="w-70 justify-between">
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Loading...
        </span>
      </Button>
    );
  }

  if (!effectiveOrganization) {
    return (
      <Button
        variant="outline"
        className="w-70 justify-between"
        onClick={() => refreshOrganizations()}
      >
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          No organization
        </span>
      </Button>
    );
  }

  const Icon = organizationTypeIcons[effectiveOrganization.type] || Building2;
  const resolvedPath = organizationPath.length > 0 ? organizationPath : fallbackPath;
  const hierarchyLabel = resolvedPath.length > 1
    ? resolvedPath.slice(0, -1).map((org) => org.name).join(' > ')
    : null;

  // Single-org users don't need a picker — show static label
  if (userOrganizations.length <= 1) {
    return (
      <div className="w-70 min-h-10 flex items-center border rounded-md px-3 py-2 bg-background">
        <Icon className="h-4 w-4 text-muted-foreground mr-2 shrink-0 self-start mt-0.5" />
        <div className="min-w-0">
          <div className="text-sm truncate">{effectiveOrganization.name}</div>
          {hierarchyLabel && (
            <div className="text-[11px] text-muted-foreground truncate">{hierarchyLabel}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-70 justify-between"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0 self-start mt-0.5" />
            <span className="min-w-0 text-left">
              <span className="block truncate">{effectiveOrganization.name}</span>
              {hierarchyLabel && (
                <span className="block text-[11px] text-muted-foreground truncate">{hierarchyLabel}</span>
              )}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-70 p-0">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup>
              {userOrganizations.map((org) => {
                const OrgIcon = organizationTypeIcons[org.type] || Building2;
                return (
                  <CommandItem
                    key={org.id}
                    value={org.name}
                    onSelect={() => handleSelectOrganization(org.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        organizationId === org.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <OrgIcon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{org.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {org.type}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


