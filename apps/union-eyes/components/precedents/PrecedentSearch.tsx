"use client";

/**
 * Phase 5B: Precedent Search Component
 * Advanced search interface with filters for arbitration precedents
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

const GRIEVANCE_TYPES = [
  { value: "discipline", label: "Discipline" },
  { value: "discharge", label: "Discharge/Termination" },
  { value: "suspension", label: "Suspension" },
  { value: "policy_grievance", label: "Policy Grievance" },
  { value: "individual_grievance", label: "Individual Grievance" },
  { value: "group_grievance", label: "Group Grievance" },
  { value: "union_grievance", label: "Union Grievance" },
  { value: "harassment", label: "Harassment" },
  { value: "discrimination", label: "Discrimination" },
  { value: "health_safety", label: "Health & Safety" },
  { value: "hours_of_work", label: "Hours of Work" },
  { value: "overtime", label: "Overtime" },
  { value: "seniority", label: "Seniority" },
  { value: "bumping", label: "Bumping Rights" },
  { value: "layoff", label: "Layoff/Recall" },
  { value: "job_posting", label: "Job Posting" },
  { value: "classification", label: "Classification" },
  { value: "wages", label: "Wages/Pay" },
  { value: "benefits", label: "Benefits" },
  { value: "vacation", label: "Vacation" },
  { value: "sick_leave", label: "Sick Leave" },
  { value: "leaves_of_absence", label: "Leaves of Absence" },
  { value: "subcontracting", label: "Subcontracting" },
  { value: "technological_change", label: "Technological Change" },
  { value: "other", label: "Other" },
];

const OUTCOMES = [
  { value: "upheld", label: "Grievance Upheld" },
  { value: "dismissed", label: "Grievance Dismissed" },
  { value: "partially_upheld", label: "Partially Upheld" },
  { value: "settled", label: "Settled" },
  { value: "withdrawn", label: "Withdrawn" },
];

const JURISDICTIONS = [
  { value: "federal", label: "Federal" },
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

const PRECEDENT_LEVELS = [
  { value: "binding", label: "Binding Precedent" },
  { value: "persuasive", label: "Persuasive Authority" },
  { value: "informative", label: "Informative Only" },
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
  { value: "utilities", label: "Utilities" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "financial", label: "Financial Services" },
  { value: "other", label: "Other" },
];

const SHARING_LEVELS = [
  { value: "private", label: "Private" },
  { value: "federation", label: "Federation" },
  { value: "congress", label: "Congress" },
  { value: "public", label: "Public" },
];

interface SearchFilters {
  query: string;
  grievanceTypes: string[];
  outcomes: string[];
  jurisdictions: string[];
  precedentLevels: string[];
  sectors: string[];
  sharingLevels: string[];
  arbitratorName: string;
  fromDate: string;
  toDate: string;
}

interface PrecedentSearchProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading?: boolean;
  /** Pre-selected jurisdictions from user preferences */
  initialJurisdictions?: string[];
}

export function PrecedentSearch({ onSearch, isLoading, initialJurisdictions }: PrecedentSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedGrievanceTypes, setSelectedGrievanceTypes] = useState<string[]>([]);
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>(initialJurisdictions ?? []);
  const [selectedPrecedentLevels, setSelectedPrecedentLevels] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedSharingLevels, setSelectedSharingLevels] = useState<string[]>([]);
  const [arbitratorName, setArbitratorName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const debouncedQuery = useDebounce(query, 500);
  const debouncedArbitrator = useDebounce(arbitratorName, 500);

  // Sync when initialJurisdictions changes (preferences loaded async)
  useEffect(() => {
    if (initialJurisdictions && initialJurisdictions.length > 0) {
      setSelectedJurisdictions(initialJurisdictions);
    }
  }, [initialJurisdictions]);

  // Trigger search when filters change
  useEffect(() => {
    onSearch({
      query: debouncedQuery,
      grievanceTypes: selectedGrievanceTypes,
      outcomes: selectedOutcomes,
      jurisdictions: selectedJurisdictions,
      precedentLevels: selectedPrecedentLevels,
      sectors: selectedSectors,
      sharingLevels: selectedSharingLevels,
      arbitratorName: debouncedArbitrator,
      fromDate,
      toDate,
    });
  }, [
    debouncedQuery,
    selectedGrievanceTypes,
    selectedOutcomes,
    selectedJurisdictions,
    selectedPrecedentLevels,
    selectedSectors,
    selectedSharingLevels,
    debouncedArbitrator,
    fromDate,
    toDate,
    onSearch,
  ]);

  const toggleGrievanceType = (type: string) => {
    setSelectedGrievanceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleOutcome = (outcome: string) => {
    setSelectedOutcomes((prev) =>
      prev.includes(outcome) ? prev.filter((o) => o !== outcome) : [...prev, outcome]
    );
  };

  const toggleJurisdiction = (jurisdiction: string) => {
    setSelectedJurisdictions((prev) =>
      prev.includes(jurisdiction)
        ? prev.filter((j) => j !== jurisdiction)
        : [...prev, jurisdiction]
    );
  };

  const togglePrecedentLevel = (level: string) => {
    setSelectedPrecedentLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const toggleSector = (sector: string) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  };

  const toggleSharingLevel = (level: string) => {
    setSelectedSharingLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const clearAllFilters = () => {
    setQuery("");
    setSelectedGrievanceTypes([]);
    setSelectedOutcomes([]);
    setSelectedJurisdictions([]);
    setSelectedPrecedentLevels([]);
    setSelectedSectors([]);
    setSelectedSharingLevels([]);
    setArbitratorName("");
    setFromDate("");
    setToDate("");
  };

  const activeFilterCount =
    selectedGrievanceTypes.length +
    selectedOutcomes.length +
    selectedJurisdictions.length +
    selectedPrecedentLevels.length +
    selectedSectors.length +
    selectedSharingLevels.length +
    (arbitratorName ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search precedents by case title, issue, decision..."
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
              {/* Grievance Types */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Grievance Type</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {GRIEVANCE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type.value}`}
                        checked={selectedGrievanceTypes.includes(type.value)}
                        onCheckedChange={() => toggleGrievanceType(type.value)}
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

              {/* Outcomes */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Outcome</Label>
                <div className="space-y-2">
                  {OUTCOMES.map((outcome) => (
                    <div key={outcome.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`outcome-${outcome.value}`}
                        checked={selectedOutcomes.includes(outcome.value)}
                        onCheckedChange={() => toggleOutcome(outcome.value)}
                      />
                      <label
                        htmlFor={`outcome-${outcome.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {outcome.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jurisdictions */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Jurisdiction</Label>
                <div className="grid grid-cols-2 gap-2">
                  {JURISDICTIONS.map((jurisdiction) => (
                    <div key={jurisdiction.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`jurisdiction-${jurisdiction.value}`}
                        checked={selectedJurisdictions.includes(jurisdiction.value)}
                        onCheckedChange={() => toggleJurisdiction(jurisdiction.value)}
                      />
                      <label
                        htmlFor={`jurisdiction-${jurisdiction.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {jurisdiction.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Precedent Level */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Precedent Level</Label>
                <div className="space-y-2">
                  {PRECEDENT_LEVELS.map((level) => (
                    <div key={level.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`precedent-${level.value}`}
                        checked={selectedPrecedentLevels.includes(level.value)}
                        onCheckedChange={() => togglePrecedentLevel(level.value)}
                      />
                      <label
                        htmlFor={`precedent-${level.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {level.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sectors */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Sector</Label>
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

              {/* Sharing Levels */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Sharing Level</Label>
                <div className="space-y-2">
                  {SHARING_LEVELS.map((level) => (
                    <div key={level.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`sharing-${level.value}`}
                        checked={selectedSharingLevels.includes(level.value)}
                        onCheckedChange={() => toggleSharingLevel(level.value)}
                      />
                      <label
                        htmlFor={`sharing-${level.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {level.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Arbitrator Name */}
              <div className="space-y-3">
                <Label htmlFor="arbitrator" className="text-base font-semibold">
                  Arbitrator Name
                </Label>
                <Input
                  id="arbitrator"
                  placeholder="Search by arbitrator name..."
                  value={arbitratorName}
                  onChange={(e) => setArbitratorName(e.target.value)}
                />
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Decision Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="from-date" className="text-sm">From</Label>
                    <Input
                      id="from-date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to-date" className="text-sm">To</Label>
                    <Input
                      id="to-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>
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
          {selectedGrievanceTypes.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1">
              {GRIEVANCE_TYPES.find((t) => t.value === type)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleGrievanceType(type)}
              />
            </Badge>
          ))}
          {selectedOutcomes.map((outcome) => (
            <Badge key={outcome} variant="secondary" className="gap-1">
              {OUTCOMES.find((o) => o.value === outcome)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleOutcome(outcome)}
              />
            </Badge>
          ))}
          {selectedJurisdictions.map((jurisdiction) => (
            <Badge key={jurisdiction} variant="secondary" className="gap-1">
              {JURISDICTIONS.find((j) => j.value === jurisdiction)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleJurisdiction(jurisdiction)}
              />
            </Badge>
          ))}
          {selectedPrecedentLevels.map((level) => (
            <Badge key={level} variant="secondary" className="gap-1">
              {PRECEDENT_LEVELS.find((l) => l.value === level)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => togglePrecedentLevel(level)}
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
          {selectedSharingLevels.map((level) => (
            <Badge key={level} variant="secondary" className="gap-1">
              {SHARING_LEVELS.find((l) => l.value === level)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleSharingLevel(level)}
              />
            </Badge>
          ))}
          {arbitratorName && (
            <Badge variant="secondary" className="gap-1">
              Arbitrator: {arbitratorName}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setArbitratorName("")}
              />
            </Badge>
          )}
          {fromDate && (
            <Badge variant="secondary" className="gap-1">
              From: {fromDate}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setFromDate("")}
              />
            </Badge>
          )}
          {toDate && (
            <Badge variant="secondary" className="gap-1">
              To: {toDate}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setToDate("")}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

