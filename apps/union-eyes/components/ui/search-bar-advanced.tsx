/**
 * Advanced Search Bar Component
 * 
 * Production-ready search with:
 * - Auto-complete suggestions
 * - Recent searches
 * - Search history
 * - Keyboard navigation (arrows, Enter, Esc)
 * - Debounced search
 * - Loading states
 * - Accessibility
 * 
 * @module components/ui/search-bar-advanced
 */

"use client";

import * as React from "react";
import { Search, X, Clock, TrendingUp, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchSuggestion {
  id: string;
  label: string;
  value: string;
  category?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface SearchBarAdvancedProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  suggestions?: SearchSuggestion[];
  placeholder?: string;
  debounceMs?: number;
  showRecentSearches?: boolean;
  maxRecentSearches?: number;
  loading?: boolean;
  className?: string;
}

const RECENT_SEARCHES_KEY = "recent-searches";

export function SearchBarAdvanced({
  value = "",
  onChange,
  onSearch,
  onSuggestionSelect,
  suggestions = [],
  placeholder = "Search...",
  debounceMs = 300,
  showRecentSearches = true,
  maxRecentSearches = 5,
  loading = false,
  className,
}: SearchBarAdvancedProps) {
  const [searchValue, setSearchValue] = React.useState(value);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load recent searches
  React.useEffect(() => {
    if (showRecentSearches) {
      try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch (_error) {
}
    }
  }, [showRecentSearches]);

  // Sync external value
  React.useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // Debounced onChange
  React.useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onChange?.(searchValue);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue, debounceMs, onChange]);

  const addToRecentSearches = (search: string) => {
    if (!showRecentSearches || !search.trim()) return;

    const updated = [
      search,
      ...recentSearches.filter((s) => s !== search),
    ].slice(0, maxRecentSearches);

    setRecentSearches(updated);
    
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (_error) {
}
  };

  const handleSearch = (value?: string) => {
    const searchTerm = value || searchValue;
    if (searchTerm.trim()) {
      addToRecentSearches(searchTerm);
      onSearch?.(searchTerm);
      setIsOpen(false);
    }
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setSearchValue(suggestion.value);
    addToRecentSearches(suggestion.value);
    onSuggestionSelect?.(suggestion);
    onSearch?.(suggestion.value);
    setIsOpen(false);
  };

  const handleRecentSearchSelect = (search: string) => {
    setSearchValue(search);
    onSearch?.(search);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchValue("");
    onChange?.("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...suggestions, ...recentSearches.map(s => ({ id: s, label: s, value: s }))];
      if (items.length === 0) return;

      let newIndex = selectedIndex;
      if (e.key === "ArrowDown") {
        newIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
      } else {
        newIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
      }
      setSelectedIndex(newIndex);
    }
  };

  const groupedSuggestions = React.useMemo(() => {
    const groups: Record<string, SearchSuggestion[]> = {};
    suggestions.forEach((suggestion) => {
      const category = suggestion.category || "Results";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(suggestion);
    });
    return groups;
  }, [suggestions]);

  const hasContent = suggestions.length > 0 || (showRecentSearches && recentSearches.length > 0);

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={isOpen && hasContent} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsOpen(true)}
              className="pl-10 pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              {searchValue && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClear}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleSearch()}
                className="h-7"
              >
                Search
              </Button>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-full"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          // eslint-disable-next-line react-hooks/refs
          style={{ width: inputRef.current?.offsetWidth }}
        >
          <Command>
            <CommandList>
              {/* Suggestions */}
              {Object.keys(groupedSuggestions).length > 0 &&
                Object.entries(groupedSuggestions).map(([category, items]) => (
                  <CommandGroup key={category} heading={category}>
                    {items.map((suggestion) => (
                      <CommandItem
                        key={suggestion.id}
                        onSelect={() => handleSuggestionSelect(suggestion)}
                        className="cursor-pointer"
                      >
                        <TrendingUp className="mr-2 h-4 w-4 text-gray-400" />
                        {suggestion.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}

              {/* Recent Searches */}
              {showRecentSearches && recentSearches.length > 0 && (
                <CommandGroup heading="Recent Searches">
                  {recentSearches.map((search, index) => (
                    <CommandItem
                      key={`recent-${index}`}
                      onSelect={() => handleRecentSearchSelect(search)}
                      className="cursor-pointer"
                    >
                      <Clock className="mr-2 h-4 w-4 text-gray-400" />
                      {search}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Empty State */}
              {suggestions.length === 0 && recentSearches.length === 0 && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

