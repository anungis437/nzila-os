/**
 * Filter Panel Component
 * 
 * Advanced filtering UI with:
 * - Multiple filter types (text, select, date, range)
 * - Active filter badges
 * - Clear all filters
 * - Collapsible sections
 * - Filter presets
 * - Responsive design
 * 
 * @module components/ui/filter-panel
 */

"use client";

import * as React from "react";
import { X, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type FilterType = "text" | "select" | "multiselect" | "checkbox" | "date" | "range";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  id: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  filters: FilterDefinition[];
  defaultOpen?: boolean;
}

export interface ActiveFilter {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  label: string;
}

export interface FilterPanelProps {
  groups: FilterGroup[];
  activeFilters?: ActiveFilter[];
  onFilterChange?: (filters: ActiveFilter[]) => void;
  onClearAll?: () => void;
  className?: string;
}

export function FilterPanel({
  groups,
  activeFilters = [],
  onFilterChange,
  onClearAll,
  className,
}: FilterPanelProps) {
  const [filters, setFilters] = React.useState<ActiveFilter[]>(activeFilters);
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(
    new Set(groups.filter((g) => g.defaultOpen).map((g) => g.id))
  );

  React.useEffect(() => {
    setFilters(activeFilters);
  }, [activeFilters]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFilterChange = (filterId: string, value: any, label: string) => {
    const newFilters = filters.filter((f) => f.id !== filterId);
    
    if (value !== null && value !== undefined && value !== "") {
      newFilters.push({ id: filterId, value, label });
    }

    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleRemoveFilter = (filterId: string) => {
    const newFilters = filters.filter((f) => f.id !== filterId);
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleClearAll = () => {
    setFilters([]);
    onClearAll?.();
  };

  const toggleGroup = (groupId: string) => {
    const newOpenGroups = new Set(openGroups);
    if (newOpenGroups.has(groupId)) {
      newOpenGroups.delete(groupId);
    } else {
      newOpenGroups.add(groupId);
    }
    setOpenGroups(newOpenGroups);
  };

  const getFilterValue = (filterId: string) => {
    return filters.find((f) => f.id === filterId)?.value;
  };

  const renderFilter = (filter: FilterDefinition) => {
    const value = getFilterValue(filter.id);

    switch (filter.type) {
      case "text":
        return (
          <Input
            placeholder={filter.placeholder}
            value={value || ""}
            onChange={(e) =>
              handleFilterChange(
                filter.id,
                e.target.value,
                `${filter.label}: ${e.target.value}`
              )
            }
          />
        );

      case "select":
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => {
              const option = filter.options?.find((o) => o.value === val);
              handleFilterChange(
                filter.id,
                val,
                `${filter.label}: ${option?.label || val}`
              );
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={filter.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {filter.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${filter.id}-${option.value}`}
                  checked={value?.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const currentValue = value || [];
                    const newValue = checked
                      ? [...currentValue, option.value]
                      : currentValue.filter((v: string) => v !== option.value);
                    handleFilterChange(
                      filter.id,
                      newValue,
                      `${filter.label}: ${newValue.length} selected`
                    );
                  }}
                />
                <label
                  htmlFor={`${filter.id}-${option.value}`}
                  className="text-sm cursor-pointer"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        );

      case "range":
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder={`Min ${filter.min || ""}`}
              value={value?.min || ""}
              min={filter.min}
              max={filter.max}
              onChange={(e) => {
                const min = e.target.value;
                const max = value?.max || "";
                handleFilterChange(
                  filter.id,
                  { min, max },
                  `${filter.label}: ${min}${max ? ` - ${max}` : ""}`
                );
              }}
            />
            <span className="text-gray-500">to</span>
            <Input
              type="number"
              placeholder={`Max ${filter.max || ""}`}
              value={value?.max || ""}
              min={filter.min}
              max={filter.max}
              onChange={(e) => {
                const min = value?.min || "";
                const max = e.target.value;
                handleFilterChange(
                  filter.id,
                  { min, max },
                  `${filter.label}: ${min}${max ? ` - ${max}` : ""}`
                );
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        {filters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-sm"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Badge
              key={filter.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {filter.label}
              <button
                onClick={() => handleRemoveFilter(filter.id)}
                className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Filter Groups */}
      <div className="space-y-2">
        {groups.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups.has(group.id)}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-gray-100 transition-colors">
              <span className="font-medium text-sm">{group.label}</span>
              {openGroups.has(group.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-4">
              {group.filters.map((filter) => (
                <div key={filter.id} className="space-y-2">
                  <Label htmlFor={filter.id} className="text-sm">
                    {filter.label}
                  </Label>
                  {renderFilter(filter)}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

