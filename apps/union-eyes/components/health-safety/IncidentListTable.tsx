/**
 * Incident List Table Component
 * 
 * Displays incidents in a paginated table with:
 * - Filtering by status and severity, and search
 * - A details button only where the host screen has somewhere to go
 * 
 * Filters use the values the incident routes store and accept: an incident is reported, investigating or closed (resolved is read too), and
 * its severity is near miss, minor, moderate, serious, critical or fatal. A list that could not be loaded is an error with a way to try
 * again, never an empty table.
 * 
 * @module components/health-safety/IncidentListTable
 */

"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle,
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  FileText,
  Calendar
} from "lucide-react";
import { IncidentStatusBadge } from "./IncidentStatusBadge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { ApiShapeError, envelopeData, isRecord, readApiError } from "@/lib/client/api-envelope";
import { asRecord, humanize, optionalString, requiredDate, requiredString } from "@/lib/client/row-fields";

export interface Incident {
  id: string;
  incidentNumber: string;
  incidentDate: Date;
  /** As stored (near_miss, injury, property_damage ...). */
  type: string;
  /** As stored: near_miss, minor, moderate, serious, critical or fatal. */
  severity: string;
  /** As stored: reported, investigating or closed. */
  status: string;
  location: string;
  /** null when the report is anonymous or names nobody. */
  reportedBy: string | null;
  isAnonymous: boolean;
}

export interface IncidentListTableProps {
  organizationId: string;
  /** Without it an incident is listed but cannot be opened: there is no View button. */
  onViewDetails?: (incidentId: string) => void;
}

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "reported", label: "Reported" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "near_miss", label: "Near miss" },
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "serious", label: "Serious" },
  { value: "critical", label: "Critical" },
  { value: "fatal", label: "Fatal" },
] as const;

function toIncident(value: unknown): Incident {
  const row = asRecord(value, "incident");
  return {
    id: requiredString(row, "id"),
    incidentNumber: requiredString(row, "incidentNumber"),
    incidentDate: requiredDate(row, "incidentDate"),
    type: requiredString(row, "incidentType"),
    severity: requiredString(row, "severity"),
    status: requiredString(row, "status"),
    location: requiredString(row, "locationDescription"),
    reportedBy: optionalString(row, "reportedByName"),
    isAnonymous: row.isAnonymous === true,
  };
}

async function readIncidents(params: URLSearchParams): Promise<{ incidents: Incident[]; totalPages: number }> {
  const response = await fetch(`/api/health-safety/incidents?${params}`);
  if (!response.ok) throw new Error(await readApiError(response, `The incidents could not be loaded (status ${response.status}).`));
  const payload = envelopeData(await response.json());
  if (!Array.isArray(payload.data)) throw new ApiShapeError("no list");
  const totalPages = isRecord(payload.pagination) ? Number(payload.pagination.totalPages) : Number.NaN;
  if (!Number.isInteger(totalPages) || totalPages < 0) throw new ApiShapeError("no pagination");
  return { incidents: payload.data.map(toIncident), totalPages };
}

type Outcome =
  | { kind: "ready"; incidents: Incident[]; totalPages: number }
  | { kind: "error"; message: string };

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "fatal":
    case "critical":
      return "text-red-600 bg-red-50 dark:bg-red-950/30";
    case "serious":
      return "text-orange-600 bg-orange-50 dark:bg-orange-950/30";
    case "moderate":
      return "text-yellow-700 bg-yellow-50 dark:bg-yellow-950/30";
    case "minor":
      return "text-green-600 bg-green-50 dark:bg-green-950/30";
    default:
      return "text-gray-600 bg-gray-50 dark:bg-gray-950/30";
  }
};

export function IncidentListTable({
  organizationId,
  onViewDetails
}: IncidentListTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [attempt, setAttempt] = React.useState(0);
  // The answer belongs to the organization, filters and page it was read for: another one's is never shown while this one loads.
  const [loaded, setLoaded] = React.useState<{ key: string; outcome: Outcome } | null>(null);

  const search = searchQuery.trim();
  const key = JSON.stringify([organizationId, statusFilter, severityFilter, search, currentPage, attempt]);

  React.useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ page: String(currentPage), limit: String(PAGE_SIZE) });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (severityFilter !== "all") params.set("severity", severityFilter);
    if (search !== "") params.set("search", search);
    readIncidents(params).then(
      (result) => {
        if (current) setLoaded({ key, outcome: { kind: "ready", ...result } });
      },
      (error: unknown) => {
        logger.error("Failed to load incidents", error);
        if (current) setLoaded({ key, outcome: { kind: "error", message: error instanceof Error ? error.message : "The incidents could not be loaded." } });
      },
    );
    return () => {
      current = false;
    };
  }, [key, currentPage, statusFilter, severityFilter, search]);

  const outcome = loaded?.key === key ? loaded.outcome : null;

  function changeFilter(update: () => void) {
    update();
    setCurrentPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Incident Reports
        </CardTitle>
        <CardDescription>
          Manage and track workplace safety incidents
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => changeFilter(() => setSearchQuery(e.target.value))}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => changeFilter(() => setStatusFilter(value))}>
            <SelectTrigger className="w-full md:w-[180px]" aria-label="Status">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={(value) => changeFilter(() => setSeverityFilter(value))}>
            <SelectTrigger className="w-full md:w-[180px]" aria-label="Severity">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              {SEVERITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {outcome === null ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : outcome.kind === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">The incidents could not be loaded.</p>
            <p className="text-sm text-muted-foreground">{outcome.message}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((count) => count + 1)}>
              Try again
            </Button>
          </div>
        ) : outcome.incidents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No incidents found</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Reported By</TableHead>
                    {onViewDetails && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outcome.incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="font-medium">
                        {incident.incidentNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(incident.incidentDate, "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{humanize(incident.type)}</TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize", getSeverityColor(incident.severity))}>
                          {humanize(incident.severity)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <IncidentStatusBadge status={incident.status} />
                      </TableCell>
                      <TableCell>{incident.location}</TableCell>
                      <TableCell>{incident.isAnonymous ? "Anonymous" : incident.reportedBy ?? "—"}</TableCell>
                      {onViewDetails && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewDetails(incident.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {outcome.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(outcome.totalPages, p + 1))}
                  disabled={currentPage >= outcome.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
