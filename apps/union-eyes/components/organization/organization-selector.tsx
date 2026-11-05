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
import { logger } from '@/lib/logger';
import {
  readOrganizationPath,
  readProfileOrganization,
  reasonOf,
  type OrganizationPath,
  type ProfileOrganization,
} from './profile-organization';

const organizationTypeIcons = {
  congress: Globe,
  federation: Globe,
  union: Building2,
  local: Users,
  chapter: Users,
};

/**
 * What the profile names when the context has no organization: the organization, and its path or why the path could not be read. A profile that
 * could not be read is its own state: it is not "no organization".
 */
type Found =
  | { status: 'none' }
  | { status: 'found'; organization: ProfileOrganization; path: OrganizationPath | { error: string } };
type Fallback = { attempt: number } & ({ status: 'failed'; message: string } | Found);

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
  const [attempt, setAttempt] = useState(0);
  const [fallback, setFallback] = useState<Fallback | null>(null);

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


  // In some auth/context races, `organization` can be null while the org list
  // is already loaded. Fall back to the selected org (or first available)
  // so the selector doesn't get stuck showing "Loading...".
  const contextOrganization = organization
    ?? userOrganizations.find((org) => org.id === organizationId)
    ?? userOrganizations[0]
    ?? null;
  const needsFallback = mounted && contextOrganization === null && !isLoading;

  useEffect(() => {
    if (!needsFallback) {
      return;
    }

    let cancelled = false;

    const recoverOrganization = async (): Promise<Found> => {
      const profileOrganization = await readProfileOrganization();
      if (profileOrganization === null) return { status: 'none' };
      // The organization is known; a path that cannot be read is said so beside it.
      const path = await readOrganizationPath(profileOrganization.id).catch((failure: unknown) => {
        logger.error('Failed to read the organization path', failure);
        return { error: reasonOf(failure) };
      });
      return { status: 'found', organization: profileOrganization, path };
    };

    recoverOrganization().then(
      (found) => {
        if (!cancelled) setFallback({ attempt, ...found });
      },
      (failure: unknown) => {
        logger.error('Failed to recover the organization of the signed-in user', failure);
        if (!cancelled) setFallback({ attempt, status: 'failed', message: reasonOf(failure) });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [needsFallback, attempt]);

  const settledFallback = fallback !== null && fallback.attempt === attempt ? fallback : null;
  const effectiveOrganization: { id: string; name: string; type: string | null } | null = contextOrganization
    ?? (settledFallback?.status === 'found'
      ? { id: settledFallback.organization.id, name: settledFallback.organization.name, type: settledFallback.organization.type }
      : null);

  const retry = () => {
    setAttempt((count) => count + 1);
    void refreshOrganizations();
  };

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

  if (error) {
    return (
      <Button 
        variant="outline" 
        className="ue-organization-selector justify-between text-red-600"
        title={error}
        onClick={() => refreshOrganizations()}
      >
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Error loading - Click to retry
        </span>
      </Button>
    );
  }

  if (!effectiveOrganization && (isLoading || (needsFallback && settledFallback === null))) {
    return (
      <div role="status" className="ue-organization-selector flex h-10 items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        Loading...
      </div>
    );
  }

  if (!effectiveOrganization && settledFallback?.status === 'failed') {
    return (
      <Button
        variant="outline"
        className="ue-organization-selector justify-between text-red-600"
        title={settledFallback.message}
        onClick={retry}
      >
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Error loading - Click to retry
        </span>
      </Button>
    );
  }

  if (!effectiveOrganization) {
    return (
      <Button
        variant="outline"
        className="ue-organization-selector justify-between"
        onClick={() => refreshOrganizations()}
      >
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          No organization
        </span>
      </Button>
    );
  }

  const Icon = organizationTypeIcons[effectiveOrganization.type as keyof typeof organizationTypeIcons] || Building2;
  const fallbackPath = settledFallback?.status === 'found' ? settledFallback.path : null;
  const pathFailure = organizationPath.length === 0 && fallbackPath !== null && 'error' in fallbackPath ? fallbackPath.error : null;
  const resolvedPath = organizationPath.length > 0
    ? organizationPath
    : fallbackPath !== null && 'entries' in fallbackPath ? fallbackPath.entries : [];
  const hierarchyLabel = pathFailure !== null
    ? 'Hierarchy unavailable'
    : resolvedPath.length > 1
      ? resolvedPath.slice(0, -1).map((org) => org.name).join(' > ')
      : null;

  // Single-org users don't need a picker — show static label
  if (userOrganizations.length <= 1) {
    return (
      <div className="ue-organization-selector min-h-11 flex items-center border rounded-md px-3 py-2 bg-background">
        <Icon className="h-4 w-4 text-muted-foreground mr-2 shrink-0 self-start mt-0.5" />
        <div className="min-w-0">
          <div className="text-sm whitespace-normal break-words">{effectiveOrganization.name}</div>
          {hierarchyLabel && (
            <div className="text-[11px] text-muted-foreground whitespace-normal break-words">{hierarchyLabel}</div>
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
          className="ue-organization-selector justify-between"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0 self-start mt-0.5" />
            <span className="min-w-0 text-left">
              <span className="block whitespace-normal break-words">{effectiveOrganization.name}</span>
              {hierarchyLabel && (
                <span className="block text-[11px] text-muted-foreground whitespace-normal break-words">{hierarchyLabel}</span>
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
                const OrgIcon = organizationTypeIcons[org.type as keyof typeof organizationTypeIcons] || Building2;
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


