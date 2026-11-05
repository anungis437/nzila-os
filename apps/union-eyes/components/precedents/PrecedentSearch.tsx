"use client";

/**
 * Search and filters for the precedents list.
 *
 * Only the filters GET /api/precedents honours are offered, with the database's own outcome and precedent-value members (see
 * precedent-filters.ts). The parent owns the filters; text typed here is passed up once typing has paused, and the other controls act at once.
 * Every word comes from the message catalogs (the `precedents` namespace).
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Filter, Search } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";
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
import {
  JURISDICTION_CODES,
  NO_FILTERS,
  OUTCOMES,
  PRECEDENT_VALUES,
  activeFilterCount,
  jurisdictionLabel,
  outcomeLabel,
  precedentValueLabel,
  type PrecedentFilters,
} from "@/components/precedents/precedent-filters";

/** Passes a text draft up once typing has paused for 500 ms, and not while the draft and the paused value still differ. */
function useCommitWhenSettled(draft: string, committed: string, commit: (value: string) => void) {
  const settled = useDebounce(draft, 500);
  useEffect(() => {
    if (draft === settled && settled !== committed) commit(settled);
  }, [draft, settled, committed, commit]);
}

const toggle = (list: string[], value: string): string[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

interface PrecedentSearchProps {
  filters: PrecedentFilters;
  onChange: (filters: PrecedentFilters) => void;
}

export function PrecedentSearch({ filters, onChange }: PrecedentSearchProps) {
  const t = useTranslations("precedents");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const [sectorDraft, setSectorDraft] = useState(filters.sector);
  const [arbitratorDraft, setArbitratorDraft] = useState(filters.arbitrator);

  useCommitWhenSettled(queryDraft, filters.query, (query) => onChange({ ...filters, query }));
  useCommitWhenSettled(sectorDraft, filters.sector, (sector) => onChange({ ...filters, sector }));
  useCommitWhenSettled(arbitratorDraft, filters.arbitrator, (arbitrator) => onChange({ ...filters, arbitrator }));

  const clearAll = () => {
    setQueryDraft("");
    setSectorDraft("");
    setArbitratorDraft("");
    onChange(NO_FILTERS);
  };

  const activeCount = activeFilterCount(filters);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("search.searchLabel")}
            placeholder={t("search.searchPlaceholder")}
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            className="pl-10"
          />
        </div>

        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter aria-hidden="true" className="mr-2 h-4 w-4" />
              {t("search.filters")}
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-100 sm:w-135 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("search.sheetTitle")}</SheetTitle>
              <SheetDescription>{t("search.sheetDescription")}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-base font-semibold">{t("search.outcome")}</legend>
                <div className="space-y-2">
                  {OUTCOMES.map((outcome) => (
                    <div key={outcome} className="flex items-center space-x-2">
                      <Checkbox
                        id={`outcome-${outcome}`}
                        checked={filters.outcomes.includes(outcome)}
                        onCheckedChange={() => onChange({ ...filters, outcomes: toggle(filters.outcomes, outcome) })}
                      />
                      <label htmlFor={`outcome-${outcome}`} className="text-sm font-medium leading-none cursor-pointer">
                        {outcomeLabel(outcome, t)}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-base font-semibold">{t("search.precedentValue")}</legend>
                <div className="space-y-2">
                  {PRECEDENT_VALUES.map((value) => (
                    <div key={value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`value-${value}`}
                        checked={filters.precedentValues.includes(value)}
                        onCheckedChange={() => onChange({ ...filters, precedentValues: toggle(filters.precedentValues, value) })}
                      />
                      <label htmlFor={`value-${value}`} className="text-sm font-medium leading-none cursor-pointer">
                        {precedentValueLabel(value, t)}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="precedent-jurisdiction" className="text-base font-semibold">
                  {t("search.jurisdiction")}
                </Label>
                <select
                  id="precedent-jurisdiction"
                  value={filters.jurisdiction}
                  onChange={(event) => onChange({ ...filters, jurisdiction: event.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t("search.anyJurisdiction")}</option>
                  {JURISDICTION_CODES.map((code) => (
                    <option key={code} value={code}>
                      {jurisdictionLabel(code, t)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="precedent-sector" className="text-base font-semibold">
                  {t("search.sector")}
                </Label>
                <Input id="precedent-sector" value={sectorDraft} onChange={(event) => setSectorDraft(event.target.value)} />
                <p className="text-xs text-muted-foreground">{t("search.sectorHint")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="precedent-arbitrator" className="text-base font-semibold">
                  {t("search.arbitrator")}
                </Label>
                <Input id="precedent-arbitrator" value={arbitratorDraft} onChange={(event) => setArbitratorDraft(event.target.value)} />
                <p className="text-xs text-muted-foreground">{t("search.arbitratorHint")}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="precedent-from" className="text-sm font-medium">
                    {t("search.fromDate")}
                  </Label>
                  <Input
                    id="precedent-from"
                    type="date"
                    value={filters.fromDate}
                    max={filters.toDate || undefined}
                    onChange={(event) => onChange({ ...filters, fromDate: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precedent-to" className="text-sm font-medium">
                    {t("search.toDate")}
                  </Label>
                  <Input
                    id="precedent-to"
                    type="date"
                    value={filters.toDate}
                    min={filters.fromDate || undefined}
                    onChange={(event) => onChange({ ...filters, toDate: event.target.value })}
                  />
                </div>
              </div>

              {activeCount > 0 && (
                <Button variant="outline" className="w-full" onClick={clearAll}>
                  {t("search.clear")}
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
