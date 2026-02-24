/**
 * Federation Selector Component
 * 
 * Dropdown selector for choosing a federation with:
 * - List of accessible federations
 * - Search/filter functionality
 * - Federation details (province, member count)
 * - Role-based filtering
 * - Loading states
 * 
 * @module components/federation/FederationSelector
 */

"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Building2, Search, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Federation {
  id: string;
  name: string;
  shortName: string;
  province: string;
  memberCount: number;
  status: "active" | "inactive";
}

export interface FederationSelectorProps {
  value?: string;
  onChange: (federationId: string) => void;
  userRole?: string;
  className?: string;
}

export function FederationSelector({
  value,
  onChange,
  userRole,
  className
}: FederationSelectorProps) {
  const { toast } = useToast();
  const [federations, setFederations] = React.useState<Federation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    loadFederations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  async function loadFederations() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (userRole) params.append("role", userRole);

      const response = await fetch(`/api/federation/list?${params}`);
      
      if (!response.ok) {
        throw new Error("Failed to load federations");
      }

      const data = await response.json();
      if (data.success) {
        setFederations(data.federations);
      } else {
        throw new Error(data.error || "Failed to load federations");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load federations",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  const filteredFederations = React.useMemo(() => {
    if (!searchQuery) return federations;
    
    const query = searchQuery.toLowerCase();
    return federations.filter(fed => 
      fed.name.toLowerCase().includes(query) ||
      fed.shortName.toLowerCase().includes(query) ||
      fed.province.toLowerCase().includes(query)
    );
  }, [federations, searchQuery]);

  const selectedFederation = federations.find(f => f.id === value);

  if (isLoading) {
    return (
      <div className={cn("w-[280px]", className)}>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Loading federations..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  if (federations.length === 0) {
    return (
      <div className={cn("w-[280px]", className)}>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="No federations available" />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn("w-[280px]", className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select federation">
            {selectedFederation && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="truncate">{selectedFederation.shortName}</span>
                <Badge variant="secondary" className="ml-auto">
                  {selectedFederation.province}
                </Badge>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search federations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filteredFederations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No federations found
              </div>
            ) : (
              filteredFederations.map((federation) => (
                <SelectItem 
                  key={federation.id} 
                  value={federation.id}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {federation.shortName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {federation.name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {federation.province}
                      </Badge>
                      {federation.status === "active" ? (
                        <Badge variant="success" className="text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {federation.memberCount.toLocaleString()} members
                  </div>
                </SelectItem>
              ))
            )}
          </div>
          {filteredFederations.length > 0 && (
            <div className="p-2 border-t text-xs text-muted-foreground text-center">
              {filteredFederations.length} federation{filteredFederations.length !== 1 ? 's' : ''} available
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
