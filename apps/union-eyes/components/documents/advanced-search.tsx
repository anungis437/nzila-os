/**
 * Advanced Search Component - Phase 11
 * 
 * Comprehensive search interface with filters, saved searches, and full-text OCR search.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Save,
  X,
  Calendar,
  Tag,
  User,
  FileType,
  Folder,
  Clock,
  Star,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SearchFilters {
  query: string;
  fileTypes: string[];
  tags: string[];
  uploadedBy: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  folderPath: string;
  minSize: number | null;
  maxSize: number | null;
  ocrSearch: boolean;
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  created_at: string;
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  initialFilters?: Partial<SearchFilters>;
}

const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  fileTypes: [],
  tags: [],
  uploadedBy: [],
  dateRange: { start: null, end: null },
  folderPath: '',
  minSize: null,
  maxSize: null,
  ocrSearch: false,
};

const FILE_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Word (DOC)' },
  { value: 'docx', label: 'Word (DOCX)' },
  { value: 'txt', label: 'Text' },
  { value: 'jpg', label: 'JPEG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'gif', label: 'GIF' },
  { value: 'zip', label: 'ZIP' },
  { value: 'rar', label: 'RAR' },
];

const SIZE_PRESETS = [
  { value: '0-1', label: 'Under 1 MB', min: 0, max: 1024 * 1024 },
  { value: '1-5', label: '1-5 MB', min: 1024 * 1024, max: 5 * 1024 * 1024 },
  { value: '5-10', label: '5-10 MB', min: 5 * 1024 * 1024, max: 10 * 1024 * 1024 },
  { value: '10-50', label: '10-50 MB', min: 10 * 1024 * 1024, max: 50 * 1024 * 1024 },
  { value: '50+', label: 'Over 50 MB', min: 50 * 1024 * 1024, max: null },
];

export function AdvancedSearch({ onSearch, onClear, initialFilters }: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchName, setSearchName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  /**
   * Fetch available filter options
   */
  useEffect(() => {
    fetchFilterOptions();
    fetchSavedSearches();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/documents/filters');
      if (!response.ok) throw new Error('Failed to fetch filters');

      const data = await response.json();
      setAvailableTags(data.tags || []);
      setAvailableUsers(data.users || []);
      setAvailableFolders(data.folders || []);
    } catch (_err) {
}
  };

  const fetchSavedSearches = async () => {
    try {
      const response = await fetch('/api/documents/saved-searches');
      if (!response.ok) throw new Error('Failed to fetch saved searches');

      const data = await response.json();
      setSavedSearches(data.searches || []);
    } catch (_err) {
}
  };

  /**
   * Handle filter changes
   */
  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleFileType = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      fileTypes: prev.fileTypes.includes(type)
        ? prev.fileTypes.filter((t) => t !== type)
        : [...prev.fileTypes, type],
    }));
  };

  const toggleTag = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const toggleUser = (userId: string) => {
    setFilters((prev) => ({
      ...prev,
      uploadedBy: prev.uploadedBy.includes(userId)
        ? prev.uploadedBy.filter((id) => id !== userId)
        : [...prev.uploadedBy, userId],
    }));
  };

  /**
   * Handle search actions
   */
  const handleSearch = () => {
    onSearch(filters);
  };

  const handleClear = () => {
    setFilters(DEFAULT_FILTERS);
    onClear();
  };

  /**
   * Save current search
   */
  const handleSaveSearch = async () => {
    if (!searchName.trim()) {
      alert('Please enter a name for this search');
      return;
    }

    try {
      const response = await fetch('/api/documents/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchName,
          filters,
        }),
      });

      if (!response.ok) throw new Error('Failed to save search');

      const data = await response.json();
      setSavedSearches((prev) => [...prev, data.search]);
      setSearchName('');
      setShowSaveDialog(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save search');
    }
  };

  /**
   * Load saved search
   */
  const handleLoadSearch = (search: SavedSearch) => {
    setFilters(search.filters);
    onSearch(search.filters);
  };

  /**
   * Delete saved search
   */
  const handleDeleteSearch = async (searchId: string) => {
    try {
      const response = await fetch(`/api/documents/saved-searches/${searchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete search');

      setSavedSearches((prev) => prev.filter((s) => s.id !== searchId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete search');
    }
  };

  /**
   * Count active filters
   */
  const activeFilterCount =
    (filters.query ? 1 : 0) +
    filters.fileTypes.length +
    filters.tags.length +
    filters.uploadedBy.length +
    (filters.dateRange.start || filters.dateRange.end ? 1 : 0) +
    (filters.folderPath ? 1 : 0) +
    (filters.minSize !== null || filters.maxSize !== null ? 1 : 0) +
    (filters.ocrSearch ? 1 : 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Advanced Search</CardTitle>
            <CardDescription>
              Refine your search with multiple filters
              {activeFilterCount > 0 && ` â€¢ ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleClear}>
                <X className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            )}
            <Button size="sm" onClick={() => setShowSaveDialog(!showSaveDialog)}>
              <Save className="mr-2 h-4 w-4" />
              Save Search
            </Button>
          </div>
        </div>

        {/* Save Search Dialog */}
        {showSaveDialog && (
          <div className="mt-4 p-4 border rounded-lg bg-muted">
            <Label>Search Name</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Enter a name for this search..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
              <Button onClick={handleSaveSearch}>Save</Button>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Search Query */}
        <div className="space-y-2">
          <Label>Search Query</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter keywords, document names, or content..."
                value={filters.query}
                onChange={(e) => updateFilter('query', e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ocr-search"
              checked={filters.ocrSearch}
              onCheckedChange={(checked) => updateFilter('ocrSearch', checked as boolean)}
            />
            <Label htmlFor="ocr-search" className="text-sm font-normal cursor-pointer">
              Include OCR text in search (slower but more comprehensive)
            </Label>
          </div>
        </div>

        <Separator />

        {/* Filters Accordion */}
        <Accordion type="multiple" defaultValue={['file-types', 'tags']} className="w-full">
          {/* File Types */}
          <AccordionItem value="file-types">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <FileType className="h-4 w-4" />
                File Types
                {filters.fileTypes.length > 0 && (
                  <Badge variant="secondary">{filters.fileTypes.length}</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {FILE_TYPES.map((type) => (
                  <div key={type.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`type-${type.value}`}
                      checked={filters.fileTypes.includes(type.value)}
                      onCheckedChange={() => toggleFileType(type.value)}
                    />
                    <Label
                      htmlFor={`type-${type.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Tags */}
          <AccordionItem value="tags">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
                {filters.tags.length > 0 && (
                  <Badge variant="secondary">{filters.tags.length}</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {availableTags.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {availableTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={filters.tags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                      {filters.tags.includes(tag) && (
                        <X className="ml-1 h-3 w-3" />
                      )}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pt-2">No tags available</p>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Uploaded By */}
          <AccordionItem value="uploaded-by">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Uploaded By
                {filters.uploadedBy.length > 0 && (
                  <Badge variant="secondary">{filters.uploadedBy.length}</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {availableUsers.length > 0 ? (
                <div className="space-y-2 pt-2">
                  {availableUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={filters.uploadedBy.includes(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                      <Label
                        htmlFor={`user-${user.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {user.name}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pt-2">No users available</p>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Date Range */}
          <AccordionItem value="date-range">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
                {(filters.dateRange.start || filters.dateRange.end) && (
                  <Badge variant="secondary">1</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {filters.dateRange.start
                          ? format(filters.dateRange.start, 'MMM d, yyyy')
                          : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={filters.dateRange.start || undefined}
                        onSelect={(date) =>
                          updateFilter('dateRange', { ...filters.dateRange, start: date || null })
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {filters.dateRange.end
                          ? format(filters.dateRange.end, 'MMM d, yyyy')
                          : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={filters.dateRange.end || undefined}
                        onSelect={(date) =>
                          updateFilter('dateRange', { ...filters.dateRange, end: date || null })
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Folder */}
          <AccordionItem value="folder">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Folder
                {filters.folderPath && <Badge variant="secondary">1</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-2">
                <Select value={filters.folderPath} onValueChange={(value) => updateFilter('folderPath', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Folders</SelectItem>
                    {availableFolders.map((folder) => (
                      <SelectItem key={folder} value={folder}>
                        {folder}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* File Size */}
          <AccordionItem value="file-size">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <FileType className="h-4 w-4" />
                File Size
                {(filters.minSize !== null || filters.maxSize !== null) && (
                  <Badge variant="secondary">1</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 gap-2">
                  {SIZE_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={
                        filters.minSize === preset.min && filters.maxSize === preset.max
                          ? 'default'
                          : 'outline'
                      }
                      className="justify-start"
                      onClick={() => {
                        updateFilter('minSize', preset.min);
                        updateFilter('maxSize', preset.max);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Size (MB)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={filters.minSize !== null ? filters.minSize / (1024 * 1024) : ''}
                      onChange={(e) =>
                        updateFilter(
                          'minSize',
                          e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : null
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Size (MB)</Label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={filters.maxSize !== null ? filters.maxSize / (1024 * 1024) : ''}
                      onChange={(e) =>
                        updateFilter(
                          'maxSize',
                          e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : null
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Saved Searches */}
        {savedSearches.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-muted-foreground" />
                <Label>Saved Searches</Label>
              </div>
              <div className="space-y-2">
                {savedSearches.map((search) => (
                  <div
                    key={search.id}
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleLoadSearch(search)}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{search.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(search.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSearch(search.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

