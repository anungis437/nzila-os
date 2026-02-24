/**
 * Election Audit Log Component
 * 
 * Comprehensive election audit trail with:
 * - Activity logging
 * - Timeline view
 * - Filter & search
 * - Export capabilities
 * - User tracking
 * - Detailed records
 * 
 * @module components/voting/election-audit-log
 */

"use client";

import * as React from "react";
import {
  FileText,
  Download,
  Filter,
  Search,
  Calendar,
  User,
  Shield,
  AlertCircle,
  CheckCircle2,
  Settings,
  Vote,
  UserPlus,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
 
import { format, formatDistanceToNow } from "date-fns";

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  target?: {
    type: "election" | "ballot" | "vote" | "nomination" | "user";
    id: string;
    name: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
  };
  severity: "info" | "warning" | "critical";
}

export type AuditAction =
  | "election_created"
  | "election_updated"
  | "election_published"
  | "election_started"
  | "election_ended"
  | "election_cancelled"
  | "ballot_created"
  | "ballot_updated"
  | "ballot_deleted"
  | "vote_cast"
  | "vote_verified"
  | "vote_challenged"
  | "nomination_submitted"
  | "nomination_approved"
  | "nomination_rejected"
  | "eligibility_checked"
  | "eligibility_overridden"
  | "results_calculated"
  | "results_published"
  | "results_certified"
  | "user_granted_access"
  | "user_revoked_access"
  | "settings_changed"
  | "audit_exported";

export interface ElectionAuditLogProps {
  electionId: string;
  electionTitle: string;
  entries: AuditEntry[];
  onExport?: (filters: AuditFilters) => Promise<void>;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
}

export interface AuditFilters {
  actions?: AuditAction[];
  actors?: string[];
  severity?: ("info" | "warning" | "critical")[];
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
}

export function ElectionAuditLog({
  electionId: _electionId,
  electionTitle,
  entries,
  onExport,
  onLoadMore,
  hasMore,
}: ElectionAuditLogProps) {
  const [filters, setFilters] = React.useState<AuditFilters>({});
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedEntry, setSelectedEntry] = React.useState<AuditEntry | null>(null);
  const [viewMode, setViewMode] = React.useState<"table" | "timeline">("table");

  const filteredEntries = React.useMemo(() => {
    return entries.filter((entry) => {
      // Action filter
      if (filters.actions && filters.actions.length > 0) {
        if (!filters.actions.includes(entry.action)) return false;
      }

      // Actor filter
      if (filters.actors && filters.actors.length > 0) {
        if (!filters.actors.includes(entry.actor.id)) return false;
      }

      // Severity filter
      if (filters.severity && filters.severity.length > 0) {
        if (!filters.severity.includes(entry.severity)) return false;
      }

      // Date range filter
      if (filters.dateFrom && entry.timestamp < filters.dateFrom) return false;
      if (filters.dateTo && entry.timestamp > filters.dateTo) return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          entry.actor.name.toLowerCase().includes(term) ||
          entry.action.toLowerCase().includes(term) ||
          JSON.stringify(entry.details).toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [entries, filters, searchTerm]);

  const stats = React.useMemo(() => {
    const total = entries.length;
    const critical = entries.filter((e) => e.severity === "critical").length;
    const warnings = entries.filter((e) => e.severity === "warning").length;
    const votesCast = entries.filter((e) => e.action === "vote_cast").length;
    const uniqueActors = new Set(entries.map((e) => e.actor.id)).size;

    return { total, critical, warnings, votesCast, uniqueActors };
  }, [entries]);

  const handleExport = async () => {
    if (!onExport) return;
    await onExport(filters);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Election Audit Log</h1>
        <p className="text-gray-600 mt-2">{electionTitle}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Events</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <div className="text-sm text-gray-600">Critical</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-orange-600">{stats.warnings}</div>
            <div className="text-sm text-gray-600">Warnings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-blue-600">{stats.votesCast}</div>
            <div className="text-sm text-gray-600">Votes Cast</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.uniqueActors}</div>
            <div className="text-sm text-gray-600">Unique Users</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit Trail
            </CardTitle>
            <div className="flex gap-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Table View</SelectItem>
                  <SelectItem value="timeline">Timeline View</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search audit log..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <FilterDialog filters={filters} onFiltersChange={setFilters} />
            </div>

            {/* Active Filters */}
            {(filters.actions?.length ||
              filters.severity?.length ||
              filters.dateFrom ||
              filters.dateTo) && (
              <div className="flex flex-wrap gap-2">
                {filters.actions?.map((action) => (
                  <Badge key={action} variant="secondary">
                    {action.replace(/_/g, " ")}
                  </Badge>
                ))}
                {filters.severity?.map((severity) => (
                  <Badge key={severity} variant="secondary">
                    {severity}
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({})}
                  className="h-6"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          {viewMode === "table" ? (
            <TableView
              entries={filteredEntries}
              onSelectEntry={setSelectedEntry}
            />
          ) : (
            <TimelineView
              entries={filteredEntries}
              onSelectEntry={setSelectedEntry}
            />
          )}

          {/* Load More */}
          {hasMore && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={onLoadMore}>
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {selectedEntry && (
        <AuditEntryDetailDialog
          entry={selectedEntry}
          open={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}

function TableView({
  entries,
  onSelectEntry,
}: {
  entries: AuditEntry[];
  onSelectEntry: (entry: AuditEntry) => void;
}) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="cursor-pointer hover:bg-gray-50">
              <TableCell className="text-sm">
                <div>{format(entry.timestamp, "MMM d, yyyy")}</div>
                <div className="text-gray-500">{format(entry.timestamp, "h:mm a")}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ActionIcon action={entry.action} />
                  <span className="text-sm">{formatAction(entry.action)}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div className="font-medium">{entry.actor.name}</div>
                  <div className="text-gray-500">{entry.actor.role}</div>
                </div>
              </TableCell>
              <TableCell>
                {entry.target && (
                  <div className="text-sm">
                    <Badge variant="outline">{entry.target.type}</Badge>
                    <div className="mt-1">{entry.target.name}</div>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <SeverityBadge severity={entry.severity} />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectEntry(entry)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TimelineView({
  entries,
  onSelectEntry,
}: {
  entries: AuditEntry[];
  onSelectEntry: (entry: AuditEntry) => void;
}) {
  return (
    <div className="relative pl-8 space-y-4">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

      {entries.map((entry, _index) => (
        <div key={entry.id} className="relative">
          <div
            className={cn(
              "absolute left-[-1.65rem] w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center",
              entry.severity === "critical"
                ? "border-red-500"
                : entry.severity === "warning"
                ? "border-orange-500"
                : "border-gray-300"
            )}
          >
            <ActionIcon action={entry.action} className="h-3 w-3" />
          </div>

          <div
            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onSelectEntry(entry)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{formatAction(entry.action)}</h4>
                <SeverityBadge severity={entry.severity} />
              </div>
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
              </span>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <div>
                By <span className="font-medium">{entry.actor.name}</span> (
                {entry.actor.role})
              </div>
              {entry.target && (
                <div>
                  Target: <Badge variant="outline">{entry.target.type}</Badge>{" "}
                  {entry.target.name}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterDialog({
  filters,
  onFiltersChange,
}: {
  filters: AuditFilters;
  onFiltersChange: (filters: AuditFilters) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [localFilters, setLocalFilters] = React.useState(filters);

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filter Audit Log</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Severity</Label>
            <div className="flex gap-2 mt-2">
              {(["info", "warning", "critical"] as const).map((severity) => (
                <Badge
                  key={severity}
                  variant={
                    localFilters.severity?.includes(severity) ? "default" : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => {
                    const current = localFilters.severity || [];
                    setLocalFilters({
                      ...localFilters,
                      severity: current.includes(severity)
                        ? current.filter((s) => s !== severity)
                        : [...current, severity],
                    });
                  }}
                >
                  {severity}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApply}>Apply Filters</Button>
            <Button variant="outline" onClick={() => setLocalFilters({})}>
              Clear
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuditEntryDetailDialog({
  entry,
  open,
  onClose,
}: {
  entry: AuditEntry;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActionIcon action={entry.action} />
            {formatAction(entry.action)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Timestamp</Label>
              <div className="font-medium mt-1">{format(entry.timestamp, "PPpp")}</div>
            </div>
            <div>
              <Label className="text-gray-600">Severity</Label>
              <div className="mt-1">
                <SeverityBadge severity={entry.severity} />
              </div>
            </div>
          </div>

          {/* Actor */}
          <div>
            <Label className="text-gray-600">Actor</Label>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="font-medium">{entry.actor.name}</div>
              <div className="text-sm text-gray-600">{entry.actor.email}</div>
              <div className="text-sm text-gray-600">Role: {entry.actor.role}</div>
            </div>
          </div>

          {/* Target */}
          {entry.target && (
            <div>
              <Label className="text-gray-600">Target</Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{entry.target.type}</Badge>
                  <span className="font-medium">{entry.target.name}</span>
                </div>
                <div className="text-sm text-gray-600">ID: {entry.target.id}</div>
              </div>
            </div>
          )}

          {/* Details */}
          <div>
            <Label className="text-gray-600">Details</Label>
            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-sm overflow-auto">
              {JSON.stringify(entry.details, null, 2)}
            </pre>
          </div>

          {/* Metadata */}
          <div>
            <Label className="text-gray-600">Metadata</Label>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
              {entry.metadata.ipAddress && (
                <div>IP Address: {entry.metadata.ipAddress}</div>
              )}
              {entry.metadata.location && (
                <div>Location: {entry.metadata.location}</div>
              )}
              {entry.metadata.userAgent && (
                <div className="text-xs text-gray-600">
                  User Agent: {entry.metadata.userAgent}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionIcon({ action, className }: { action: AuditAction; className?: string }) {
  const iconClass = cn("h-4 w-4", className);

  if (action.startsWith("vote_")) return <Vote className={iconClass} />;
  if (action.startsWith("nomination_")) return <UserPlus className={iconClass} />;
  if (action.startsWith("election_")) return <Calendar className={iconClass} />;
  if (action.startsWith("ballot_")) return <FileText className={iconClass} />;
  if (action.startsWith("user_")) return <User className={iconClass} />;
  if (action.startsWith("settings_")) return <Settings className={iconClass} />;
  
  return <Shield className={iconClass} />;
}

function SeverityBadge({ severity }: { severity: "info" | "warning" | "critical" }) {
  const variants = {
    info: { variant: "secondary" as const, icon: CheckCircle2, color: "text-gray-600" },
    warning: { variant: "default" as const, icon: AlertCircle, color: "text-orange-600" },
    critical: { variant: "destructive" as const, icon: AlertCircle, color: "text-red-600" },
  };

  const config = variants[severity];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3 mr-1" />
      {severity.toUpperCase()}
    </Badge>
  );
}

function formatAction(action: AuditAction): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

