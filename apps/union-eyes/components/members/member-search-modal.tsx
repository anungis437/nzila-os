/**
 * Member Search Modal Component
 * 
 * Advanced member search with:
 * - Real-time search
 * - Faceted filtering (status, chapter, employer)
 * - Recent searches
 * - Quick actions
 * - Keyboard navigation
 * 
 * @module components/members/member-search-modal
 */

"use client";

import * as React from "react";
import {
  Search,
  X,
  User,
  Mail,
  Phone,
  Building,
  Clock,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface MemberSearchResult {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: "active" | "inactive" | "suspended" | "retired";
  employer?: string;
  chapter?: string;
  jobTitle?: string;
}

export interface MemberSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember: (member: MemberSearchResult) => void;
  onSearch: (query: string, filters: SearchFilters) => Promise<MemberSearchResult[]>;
  placeholder?: string;
}

export interface SearchFilters {
  status?: string[];
  chapter?: string[];
  employer?: string[];
}

const recentSearchesKey = "union-eyes-recent-member-searches";

export function MemberSearchModal({
  isOpen,
  onClose,
  onSelectMember,
  onSearch,
  placeholder = "Search members by name, email, or member number...",
}: MemberSearchModalProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<MemberSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [filters, _setFilters] = React.useState<SearchFilters>({});

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load recent searches on mount
  React.useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(recentSearchesKey);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounced search
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchResults = await onSearch(query, filters);
        setResults(searchResults);
        setSelectedIndex(0);
      } catch (_error) {
} finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, filters, onSearch]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectMember(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, selectedIndex, onClose]);

  const handleSelectMember = (member: MemberSearchResult) => {
    // Save to recent searches
    const updated = [
      query,
      ...recentSearches.filter((s) => s !== query),
    ].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(recentSearchesKey, JSON.stringify(updated));

    onSelectMember(member);
    onClose();
    setQuery("");
    setResults([]);
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(recentSearchesKey);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">Search Members</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10 h-12 text-base"
            />
            {query && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[500px]">
          <div className="p-4">
            {/* Loading State */}
            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}

            {/* Results */}
            {!isSearching && results.length > 0 && (
              <div className="space-y-1">
                {results.map((member, index) => (
                  <MemberResultItem
                    key={member.id}
                    member={member}
                    isSelected={index === selectedIndex}
                    onClick={() => handleSelectMember(member)}
                  />
                ))}
              </div>
            )}

            {/* No Results */}
            {!isSearching && query && results.length === 0 && (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600">No members found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try adjusting your search terms
                </p>
              </div>
            )}

            {/* Recent Searches */}
            {!query && recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Searches
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearRecentSearches}
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                      onClick={() => handleRecentSearch(search)}
                    >
                      <Search className="inline h-3 w-3 mr-2 text-gray-400" />
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!query && recentSearches.length === 0 && (
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600">Start typing to search members</p>
                <p className="text-sm text-gray-500 mt-1">
                  Search by name, email, phone, or member number
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with keyboard shortcuts */}
        <div className="border-t px-4 py-3 bg-gray-50 text-xs text-gray-500 flex items-center gap-4">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">â†‘</kbd>
            <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">â†“</kbd>
            <span className="ml-1">Navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">â†µ</kbd>
            <span className="ml-1">Select</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">Esc</kbd>
            <span className="ml-1">Close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberResultItem({
  member,
  isSelected,
  onClick,
}: {
  member: MemberSearchResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();

  return (
    <button
      className={cn(
        "w-full text-left p-3 rounded-lg transition-colors",
        isSelected ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50",
        "border"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={member.avatar} alt={`${member.firstName} ${member.lastName}`} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">
              {member.firstName} {member.lastName}
            </span>
            <Badge variant="outline" className="text-xs">
              #{member.memberNumber}
            </Badge>
            {member.status === "active" && (
              <Badge variant="success" className="text-xs">
                Active
              </Badge>
            )}
          </div>
          <div className="space-y-0.5 text-xs text-gray-600">
            {member.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                <span className="truncate">{member.email}</span>
              </div>
            )}
            {member.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                <span>{member.phone}</span>
              </div>
            )}
            {member.employer && (
              <div className="flex items-center gap-1.5">
                <Building className="h-3 w-3" />
                <span className="truncate">
                  {member.employer} {member.jobTitle && `â€¢ ${member.jobTitle}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

