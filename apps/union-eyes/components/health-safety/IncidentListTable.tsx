/**
 * Incident List Table Component
 * 
 * Displays incidents in a paginated table with:
 * - Filtering by status, severity, type
 * - Sorting by date, severity
 * - Search functionality
 * - Quick status updates
 * - Detailed view navigation
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
import { useToast } from "@/components/ui/use-toast";
import { 
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

export interface Incident {
  id: string;
  incidentNumber: string;
  reportedDate: Date;
  incidentDate: Date;
  type: string;
  severity: "minor" | "major" | "critical";
  status: "open" | "investigating" | "resolved" | "closed";
  location: string;
  reportedBy: string;
  assignedTo?: string;
  description: string;
}

export interface IncidentListTableProps {
  organizationId: string;
  onViewDetails?: (incidentId: string) => void;
}

export function IncidentListTable({
  organizationId,
  onViewDetails
}: IncidentListTableProps) {
  const { toast } = useToast();
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const itemsPerPage = 10;

  const loadIncidents = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        organizationId,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(severityFilter !== "all" && { severity: severityFilter }),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await fetch(`/api/health-safety/incidents?${params}`);

      if (!response.ok) {
        throw new Error("Failed to load incidents");
      }

      const json = await response.json();
      if (json.success) {
        const payload = json.data;
        const rows = Array.isArray(payload.data) ? payload.data : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setIncidents(rows.map((r: unknown) => ({
          id: r.id,
          incidentNumber: r.incidentNumber ?? '',
          reportedDate: new Date(r.reportedDate ?? Date.now()),
          incidentDate: new Date(r.incidentDate ?? r.reportedDate ?? Date.now()),
          type: r.incidentType ?? r.type ?? '',
          severity: r.severity ?? 'minor',
          status: r.status ?? 'open',
          location: r.locationDescription ?? r.location ?? '',
          reportedBy: r.reportedByName ?? r.reportedBy ?? '',
          assignedTo: r.assignedToName ?? r.assignedTo,
          description: r.description ?? '',
        })));
        setTotalPages(payload.pagination?.totalPages ?? 1);
      } else {
        throw new Error(json.error);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load incidents",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, statusFilter, severityFilter, currentPage, searchQuery, toast]);

  React.useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  function handleViewDetails(incidentId: string) {
    if (onViewDetails) {
      onViewDetails(incidentId);
    } else {
      // Default navigation
      window.location.href = `/health-safety/incidents/${incidentId}`;
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-600 bg-red-50 dark:bg-red-950/30";
      case "major":
        return "text-orange-600 bg-orange-50 dark:bg-orange-950/30";
      case "minor":
        return "text-green-600 bg-green-50 dark:bg-green-950/30";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-950/30";
    }
  };

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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : incidents.length === 0 ? (
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="font-medium">
                        {incident.incidentNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(incident.incidentDate), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>{incident.type}</TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize", getSeverityColor(incident.severity))}>
                          {incident.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <IncidentStatusBadge status={incident.status} />
                      </TableCell>
                      <TableCell>{incident.location}</TableCell>
                      <TableCell>{incident.reportedBy}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(incident.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
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
