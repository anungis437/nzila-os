"use client";

/**
 * Phase 5B: Clause Library Search Component
 * Advanced search interface with filters for shared clauses
 */

import { useState, useEffect } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const CLAUSE_TYPES = [
  { value: "wages", label: "Wages & Compensation" },
  { value: "benefits", label: "Benefits" },
  { value: "hours_of_work", label: "Hours of Work" },
  { value: "overtime", label: "Overtime" },
  { value: "vacation", label: "Vacation" },
  { value: "sick_leave", label: "Sick Leave" },
  { value: "grievance_procedure", label: "Grievance Procedure" },
  { value: "discipline", label: "Discipline" },
  { value: "seniority", label: "Seniority" },
  { value: "health_safety", label: "Health & Safety" },
  { value: "job_security", label: "Job Security" },
  { value: "pension", label: "Pension" },
  { value: "other", label: "Other" },
];

const SECTORS = [
  { value: "public", label: "Public Sector" },
  { value: "private", label: "Private Sector" },
  { value: "education", label: "Education" },
  { value: "healthcare", label: "Healthcare" },
  { value: "construction", label: "Construction" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail" },
  { value: "transportation", label: "Transportation" },
  { value: "hospitality", label: "Hospitality" },
  { value: "other", label: "Other" },
];

const PROVINCES = [
  { value: "ON", label: "Ontario" },
  { value: "QC", label: "Quebec" },
  { value: "BC", label: "British Columbia" },
  { value: "AB", label: "Alberta" },
  { value: "MB", label: "Manitoba" },
  { value: "SK", label: "Saskatchewan" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NB", label: "New Brunswick" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "YT", label: "Yukon" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
];

const SHARING_LEVELS = [
  { value: "private", label: "Private" },
  { value: "federation", label: "Federation" },
  { value: "congress", label: "Congress" },
  { value: "public", label: "Public" },
];

interface SearchFilters {
  query: string;
  clauseTypes: string[];
  sectors: string[];
  provinces: string[];
  sharingLevels: string[];
  includeExpired: boolean;
}

interface ClauseLibrarySearchProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading?: boolean;
}

export function ClauseLibrarySearch({ onSearch, isLoading }: ClauseLibrarySearchProps) {
  const [query, setQuery] = useState("");
  const [selectedClauseTypes, setSelectedClauseTypes] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedSharingLevels, setSelectedSharingLevels] = useState<string[]>([]);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const debouncedQuery = useDebounce(query, 500);

  // Trigger search when filters change
  useEffect(() => {
    onSearch({
      query: debouncedQuery,
      clauseTypes: selectedClauseTypes,
      sectors: selectedSectors,
      provinces: selectedProvinces,
      sharingLevels: selectedSharingLevels,
      includeExpired,
    });
  }, [
    debouncedQuery,
    selectedClauseTypes,
    selectedSectors,
    selectedProvinces,
    selectedSharingLevels,
    includeExpired,
    onSearch,
  ]);

  const toggleClauseType = (type: string) => {
    setSelectedClauseTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleSector = (sector: string) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  };

  const toggleProvince = (province: string) => {
    setSelectedProvinces((prev) =>
      prev.includes(province) ? prev.filter((p) => p !== province) : [...prev, province]
    );
  };

  const toggleSharingLevel = (level: string) => {
    setSelectedSharingLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const clearAllFilters = () => {
    setQuery("");
    setSelectedClauseTypes([]);
    setSelectedSectors([]);
    setSelectedProvinces([]);
    setSelectedSharingLevels([]);
    setIncludeExpired(false);
  };

  const activeFilterCount =
    selectedClauseTypes.length +
    selectedSectors.length +
    selectedProvinces.length +
    selectedSharingLevels.length +
    (includeExpired ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clauses by title, text, or number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>

        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Search Filters</SheetTitle>
              <SheetDescription>
                Refine your search with advanced filters
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Clause Types */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Clause Types</Label>
                <div className="space-y-2">
                  {CLAUSE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type.value}`}
                        checked={selectedClauseTypes.includes(type.value)}
                        onCheckedChange={() => toggleClauseType(type.value)}
                      />
                      <label
                        htmlFor={`type-${type.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {type.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sectors */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Sectors</Label>
                <div className="space-y-2">
                  {SECTORS.map((sector) => (
                    <div key={sector.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`sector-${sector.value}`}
                        checked={selectedSectors.includes(sector.value)}
                        onCheckedChange={() => toggleSector(sector.value)}
                      />
                      <label
                        htmlFor={`sector-${sector.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {sector.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provinces */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Provinces/Territories</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVINCES.map((province) => (
                    <div key={province.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`province-${province.value}`}
                        checked={selectedProvinces.includes(province.value)}
                        onCheckedChange={() => toggleProvince(province.value)}
                      />
                      <label
                        htmlFor={`province-${province.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {province.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sharing Levels */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Sharing Level</Label>
                <div className="space-y-2">
                  {SHARING_LEVELS.map((level) => (
                    <div key={level.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`level-${level.value}`}
                        checked={selectedSharingLevels.includes(level.value)}
                        onCheckedChange={() => toggleSharingLevel(level.value)}
                      />
                      <label
                        htmlFor={`level-${level.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {level.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Include Expired */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-expired"
                  checked={includeExpired}
                  onCheckedChange={(checked) => setIncludeExpired(checked as boolean)}
                />
                <label
                  htmlFor="include-expired"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Include expired clauses
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={clearAllFilters}
                  className="flex-1"
                >
                  Clear All
                </Button>
                <Button
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearAllFilters}
            title="Clear all filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedClauseTypes.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1">
              {CLAUSE_TYPES.find((t) => t.value === type)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleClauseType(type)}
              />
            </Badge>
          ))}
          {selectedSectors.map((sector) => (
            <Badge key={sector} variant="secondary" className="gap-1">
              {SECTORS.find((s) => s.value === sector)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleSector(sector)}
              />
            </Badge>
          ))}
          {selectedProvinces.map((province) => (
            <Badge key={province} variant="secondary" className="gap-1">
              {PROVINCES.find((p) => p.value === province)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleProvince(province)}
              />
            </Badge>
          ))}
          {selectedSharingLevels.map((level) => (
            <Badge key={level} variant="secondary" className="gap-1">
              {SHARING_LEVELS.find((l) => l.value === level)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleSharingLevel(level)}
              />
            </Badge>
          ))}
          {includeExpired && (
            <Badge variant="secondary" className="gap-1">
              Include Expired
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setIncludeExpired(false)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

