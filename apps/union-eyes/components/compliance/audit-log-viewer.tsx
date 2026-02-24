/**
 * Audit Log Viewer Component
 * 
 * Comprehensive audit log system with:
 * - Activity timeline
 * - Advanced filtering
 * - User tracking
 * - Security events
 * - Export capabilities
 * - Real-time updates
 * 
 * @module components/compliance/audit-log-viewer
 */

"use client";

import * as React from "react";
import {
  Shield,
  User,
  FileText,
  Settings,
  Download,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
 
import { format } from "date-fns";

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  category: "security" | "data" | "access" | "configuration" | "system";
  severity: "info" | "warning" | "critical";
  ipAddress: string;
  userAgent: string;
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  changes?: {
    field: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldValue: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newValue: any;
  }[];
}

export interface AuditLogFilters {
  search?: string;
  categories?: string[];
  severities?: string[];
  users?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  successOnly?: boolean;
}

export interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  filters: AuditLogFilters;
  availableUsers: { id: string; name: string }[];
  totalCount: number;
  page: number;
  pageSize: number;
  onFiltersChange?: (filters: AuditLogFilters) => void;
  onPageChange?: (page: number) => void;
  onExport?: () => void;
}

export function AuditLogViewer({
  logs,
  filters,
  availableUsers: _availableUsers,
  totalCount,
  page,
  pageSize,
  onFiltersChange,
  onPageChange,
  onExport,
}: AuditLogViewerProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const [showFilters, setShowFilters] = React.useState(false);

  const categoryIcons = {
    security: Shield,
    data: FileText,
    access: User,
    configuration: Settings,
    system: Settings,
  };

  const severityConfig = {
    info: {
      color: "bg-blue-100 text-blue-800",
      label: "Info",
    },
    warning: {
      color: "bg-yellow-100 text-yellow-800",
      label: "Warning",
    },
    critical: {
      color: "bg-red-100 text-red-800",
      label: "Critical",
    },
  };

  const categoryConfig = {
    security: {
      color: "bg-purple-100 text-purple-800",
      label: "Security",
    },
    data: {
      color: "bg-blue-100 text-blue-800",
      label: "Data",
    },
    access: {
      color: "bg-green-100 text-green-800",
      label: "Access",
    },
    configuration: {
      color: "bg-orange-100 text-orange-800",
      label: "Configuration",
    },
    system: {
      color: "bg-gray-100 text-gray-800",
      label: "System",
    },
  };

  const handleSearch = () => {
    onFiltersChange?.({ ...filters, search: searchInput });
  };

  const toggleCategory = (category: string) => {
    const categories = filters.categories || [];
    const updated = categories.includes(category)
      ? categories.filter((c) => c !== category)
      : [...categories, category];
    onFiltersChange?.({ ...filters, categories: updated });
  };

  const toggleSeverity = (severity: string) => {
    const severities = filters.severities || [];
    const updated = severities.includes(severity)
      ? severities.filter((s) => s !== severity)
      : [...severities, severity];
    onFiltersChange?.({ ...filters, severities: updated });
  };

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange?.({});
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const activeFilterCount = [
    filters.categories?.length || 0,
    filters.severities?.length || 0,
    filters.users?.length || 0,
    filters.dateFrom ? 1 : 0,
    filters.dateTo ? 1 : 0,
    filters.successOnly ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Audit Log
          </h2>
          <p className="text-gray-600 mt-1">
            System activity and security events
          </p>
        </div>
        {onExport && (
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search logs..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            <Popover open={showFilters} onOpenChange={setShowFilters}>
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
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Category</Label>
                    <div className="space-y-2">
                      {Object.entries(categoryConfig).map(([key, config]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            checked={filters.categories?.includes(key)}
                            onCheckedChange={() => toggleCategory(key)}
                          />
                          <Label className="text-sm">{config.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Severity</Label>
                    <div className="space-y-2">
                      {Object.entries(severityConfig).map(([key, config]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            checked={filters.severities?.includes(key)}
                            onCheckedChange={() => toggleSeverity(key)}
                          />
                          <Label className="text-sm">{config.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Success Status</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={filters.successOnly}
                        onCheckedChange={(checked) =>
                          onFiltersChange?.({ ...filters, successOnly: !!checked })
                        }
                      />
                      <Label className="text-sm">Show only successful actions</Label>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={clearFilters} className="flex-1">
                      Clear
                    </Button>
                    <Button size="sm" onClick={() => setShowFilters(false)} className="flex-1">
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              No audit logs found
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const CategoryIcon = categoryIcons[log.category];
                const severityConfig = {
                  info: { color: "bg-blue-100 text-blue-800", label: "Info" },
                  warning: { color: "bg-yellow-100 text-yellow-800", label: "Warning" },
                  critical: { color: "bg-red-100 text-red-800", label: "Critical" },
                }[log.severity];

                return (
                  <div key={log.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 mt-1">
                        <CategoryIcon className="h-5 w-5 text-gray-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{log.action}</span>
                          <Badge variant="outline" className={categoryConfig[log.category].color}>
                            {categoryConfig[log.category].label}
                          </Badge>
                          <Badge variant="outline" className={severityConfig.color}>
                            {severityConfig.label}
                          </Badge>
                          {!log.success && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </div>

                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            <User className="h-3 w-3 inline mr-1" />
                            {log.userName} ({log.userEmail})
                          </div>
                          <div>
                            {log.resource}
                            {log.resourceId && ` • ID: ${log.resourceId}`}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{format(log.timestamp, "MMM d, yyyy 'at' h:mm:ss a")}</span>
                            <span>IP: {log.ipAddress}</span>
                          </div>
                        </div>

                        {log.changes && log.changes.length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <div className="font-medium mb-1">Changes:</div>
                            {log.changes.map((change, idx) => (
                              <div key={idx} className="text-gray-600">
                                <span className="font-medium">{change.field}:</span>{" "}
                                <span className="line-through">{JSON.stringify(change.oldValue)}</span>{" "}
                                → <span>{JSON.stringify(change.newValue)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of{" "}
            {totalCount} entries
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

