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
  federation: Globe,
  union: Building2,
  local: Users,
  chapter: Users,
};

export function OrganizationSelector() {
  const { 
    organizationId, 
    organization, 
    userOrganizations, 
    switchOrganization,
    isLoading,
    error,
    refreshOrganizations
  } = useOrganization();
  
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Prevent hydration mismatch - render placeholder until mounted
  if (!mounted) {
    return (
      <div className="w-[280px] h-10 flex items-center border rounded-md px-3 bg-background">
        <Building2 className="h-4 w-4 text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

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
        className="w-[280px] justify-between text-red-600"
        onClick={() => refreshOrganizations()}
      >
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Error loading - Click to retry
        </span>
      </Button>
    );
  }

  if (isLoading || !organization) {
    return (
      <Button variant="outline" disabled className="w-[280px] justify-between">
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Loading...
        </span>
      </Button>
    );
  }

  const Icon = organizationTypeIcons[organization.type] || Building2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between"
        >
          <span className="flex items-center gap-2 truncate">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{organization.name}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
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

