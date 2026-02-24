/**
 * Advanced Document Search Component
 * 
 * Comprehensive search with:
 * - Full-text search
 * - Filters (type, date, size, owner)
 * - Saved searches
 * - Search suggestions
 * - Sort options
 * - Search history
 * 
 * @module components/documents/document-search-advanced
 */

"use client";

import * as React from "react";
import {
  Search,
  Filter,
  X,
  Clock,
  Bookmark,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SearchFilters {
  query: string;
  fileTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  owners?: string[];
  minSize?: number;
  maxSize?: number;
  tags?: string[];
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: "recent" | "popular" | "saved";
}

export interface DocumentSearchAdvancedProps {
  onSearch: (filters: SearchFilters) => void;
  suggestions?: SearchSuggestion[];
  savedSearches?: SavedSearch[];
  onSaveSearch?: (name: string, filters: SearchFilters) => void;
  fileTypes?: string[];
  owners?: { id: string; name: string }[];
  tags?: string[];
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  usageCount: number;
}

export function DocumentSearchAdvanced({
  onSearch,
  suggestions = [],
  savedSearches = [],
  onSaveSearch,
  fileTypes = ["PDF", "DOC", "XLS", "PPT", "IMG"],
  owners = [],
  tags = [],
}: DocumentSearchAdvancedProps) {
  const [filters, setFilters] = React.useState<SearchFilters>({ query: "" });
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [_saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [searchName, setSearchName] = React.useState("");

  const handleSearch = () => {
    onSearch(filters);
    setShowSuggestions(false);
  };

  const handleLoadSaved = (saved: SavedSearch) => {
    setFilters(saved.filters);
    onSearch(saved.filters);
  };

  const _handleSave = () => {
    if (searchName && onSaveSearch) {
      onSaveSearch(searchName, filters);
      setSaveDialogOpen(false);
      setSearchName("");
    }
  };

  const activeFilterCount = 
    (filters.fileTypes?.length || 0) +
    (filters.owners?.length || 0) +
    (filters.tags?.length || 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Main Search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search documents..."
              value={filters.query}
              onChange={(e) => {
                setFilters({ ...filters, query: e.target.value });
                setShowSuggestions(true);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 pr-10"
            />
            {filters.query && (
              <button
                onClick={() => setFilters({ ...filters, query: "" })}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <h4 className="font-semibold">Advanced Filters</h4>

                {/* File Types */}
                <div>
                  <Label className="mb-2 block">File Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {fileTypes.map((type) => (
                      <label
                        key={type}
                        className={cn(
                          "px-3 py-1 border rounded-md cursor-pointer transition-colors",
                          filters.fileTypes?.includes(type)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 hover:border-gray-400"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={filters.fileTypes?.includes(type)}
                          onChange={(e) => {
                            const current = filters.fileTypes || [];
                            setFilters({
                              ...filters,
                              fileTypes: e.target.checked
                                ? [...current, type]
                                : current.filter((t) => t !== type),
                            });
                          }}
                        />
                        <span className="text-sm">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>From Date</Label>
                    <Input
                      type="date"
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          dateFrom: e.target.value ? new Date(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>To Date</Label>
                    <Input
                      type="date"
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          dateTo: e.target.value ? new Date(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Owners */}
                {owners.length > 0 && (
                  <div>
                    <Label>Owner</Label>
                    <Select
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          owners: value ? [value] : undefined,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any owner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any Owner</SelectItem>
                        {owners.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            {owner.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Tags</Label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={filters.tags?.includes(tag) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const current = filters.tags || [];
                            setFilters({
                              ...filters,
                              tags: current.includes(tag)
                                ? current.filter((t) => t !== tag)
                                : [...current, tag],
                            });
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSearch} className="flex-1">
                    Apply Filters
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFilters({ query: filters.query })}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && filters.query && (
          <Card className="absolute top-full mt-2 w-full z-10">
            <CardContent className="p-0">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  className="w-full px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-left"
                  onClick={() => {
                    setFilters({ ...filters, query: suggestion.text });
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion.type === "recent" && <Clock className="h-4 w-4 text-gray-400" />}
                  {suggestion.type === "popular" && (
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                  )}
                  {suggestion.type === "saved" && <Bookmark className="h-4 w-4 text-gray-400" />}
                  <span>{suggestion.text}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.fileTypes?.map((type) => (
            <Badge key={type} variant="secondary">
              {type}
              <button
                onClick={() =>
                  setFilters({
                    ...filters,
                    fileTypes: filters.fileTypes?.filter((t) => t !== type),
                  })
                }
                className="ml-1 hover:text-red-600"
              >
                ×
              </button>
            </Badge>
          ))}
          {filters.tags?.map((tag) => (
            <Badge key={tag} variant="secondary">
              #{tag}
              <button
                onClick={() =>
                  setFilters({
                    ...filters,
                    tags: filters.tags?.filter((t) => t !== tag),
                  })
                }
                className="ml-1 hover:text-red-600"
              >
                ×
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ query: filters.query })}
          >
            Clear all
          </Button>
          {onSaveSearch && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
            >
              <Bookmark className="h-3 w-3 mr-1" />
              Save Search
            </Button>
          )}
        </div>
      )}

      {/* Saved Searches */}
      {savedSearches.length > 0 && (
        <div>
          <Label className="mb-2 block">Saved Searches</Label>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((saved) => (
              <Button
                key={saved.id}
                variant="outline"
                size="sm"
                onClick={() => handleLoadSaved(saved)}
              >
                <Bookmark className="h-3 w-3 mr-1" />
                {saved.name}
                {saved.usageCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {saved.usageCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

