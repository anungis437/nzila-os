/**
 * Hazards List Component
 * 
 * Displays the reported hazards, a page at a time, with:
 * - Filtering by status and hazard level, and search
 * - Priority indicators
 * - A details button only where the host screen has somewhere to go
 * 
 * Filters use the values the hazard routes store and accept: a hazard is reported, assessed, assigned, resolved or closed, and its level
 * is low, moderate, high, critical or extreme. A list that could not be loaded is an error with a way to try again, never an empty list.
 * 
 * @module components/health-safety/HazardsList
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Filter,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Eye,
} from "lucide-react";
import { HazardPriorityBadge } from "./HazardPriorityBadge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { ApiShapeError, envelopeData, isRecord, readApiError } from "@/lib/client/api-envelope";
import { asRecord, humanize, requiredDate, requiredString } from "@/lib/client/row-fields";

export interface Hazard {
  id: string;
  reportNumber: string;
  category: string;
  /** As stored: low, moderate, high, critical or extreme. */
  level: string;
  /** As stored: reported, assessed, assigned, resolved or closed. */
  status: string;
  location: string;
  description: string;
  reportedDate: Date;
}

export interface HazardsListProps {
  organizationId: string;
  /** Without it a hazard is listed but cannot be opened: there is no button and the card is not a link. */
  onViewDetails?: (hazardId: string) => void;
}

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
  { value: "reported", label: "Reported" },
  { value: "assessed", label: "Assessed" },
  { value: "assigned", label: "Assigned" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

const LEVEL_OPTIONS = [
  { value: "extreme", label: "Extreme" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
  { value: "low", label: "Low" },
] as const;

function toHazard(value: unknown): Hazard {
  const row = asRecord(value, "hazard");
  return {
    id: requiredString(row, "id"),
    reportNumber: requiredString(row, "reportNumber"),
    category: requiredString(row, "hazardCategory"),
    level: requiredString(row, "hazardLevel"),
    status: requiredString(row, "status"),
    location: requiredString(row, "specificLocation"),
    description: requiredString(row, "hazardDescription"),
    reportedDate: requiredDate(row, "reportedDate"),
  };
}

async function readHazards(params: URLSearchParams): Promise<{ hazards: Hazard[]; totalPages: number }> {
  const response = await fetch(`/api/health-safety/hazards?${params}`);
  if (!response.ok) throw new Error(await readApiError(response, `The hazards could not be loaded (status ${response.status}).`));
  const payload = envelopeData(await response.json());
  if (!Array.isArray(payload.data)) throw new ApiShapeError("no list");
  const totalPages = isRecord(payload.pagination) ? Number(payload.pagination.totalPages) : Number.NaN;
  if (!Number.isInteger(totalPages) || totalPages < 0) throw new ApiShapeError("no pagination");
  return { hazards: payload.data.map(toHazard), totalPages };
}

type Outcome =
  | { kind: "ready"; hazards: Hazard[]; totalPages: number }
  | { kind: "error"; message: string };

function getStatusColor(status: string) {
  switch (status) {
    case "resolved":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    case "assessed":
    case "assigned":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "reported":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
    case "closed":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function HazardsList({
  organizationId,
  onViewDetails
}: HazardsListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [attempt, setAttempt] = React.useState(0);
  // The answer belongs to the organization, filters and page it was read for: another one's is never shown while this one loads.
  const [loaded, setLoaded] = React.useState<{ key: string; outcome: Outcome } | null>(null);

  const search = searchQuery.trim();
  const key = JSON.stringify([organizationId, statusFilter, priorityFilter, search, page, attempt]);

  React.useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (search !== "") params.set("search", search);
    readHazards(params).then(
      (result) => {
        if (current) setLoaded({ key, outcome: { kind: "ready", ...result } });
      },
      (error: unknown) => {
        logger.error("Failed to load hazards", error);
        if (current) setLoaded({ key, outcome: { kind: "error", message: error instanceof Error ? error.message : "The hazards could not be loaded." } });
      },
    );
    return () => {
      current = false;
    };
  }, [key, page, statusFilter, priorityFilter, search]);

  const outcome = loaded?.key === key ? loaded.outcome : null;

  function changeFilter(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Reported Hazards
            </CardTitle>
            <CardDescription>
              Track and manage workplace hazards
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search hazards..."
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
          <Select value={priorityFilter} onValueChange={(value) => changeFilter(() => setPriorityFilter(value))}>
            <SelectTrigger className="w-full md:w-[180px]" aria-label="Priority">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {LEVEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hazards Grid */}
        {outcome === null ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : outcome.kind === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">The hazards could not be loaded.</p>
            <p className="text-sm text-muted-foreground">{outcome.message}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((count) => count + 1)}>
              Try again
            </Button>
          </div>
        ) : outcome.hazards.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hazards found</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {outcome.hazards.map((hazard) => (
                <Card
                  key={hazard.id}
                  className={cn(
                    onViewDetails && "hover:shadow-md transition-shadow cursor-pointer",
                    (hazard.level === "critical" || hazard.level === "extreme") && "border-red-200 dark:border-red-900"
                  )}
                  onClick={onViewDetails ? () => onViewDetails(hazard.id) : undefined}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base line-clamp-1">
                          {hazard.reportNumber}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {humanize(hazard.category)}
                        </CardDescription>
                      </div>
                      <HazardPriorityBadge priority={hazard.level} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {hazard.description}
                    </p>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{hazard.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{format(hazard.reportedDate, "MMM dd, yyyy")}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Badge className={cn("capitalize", getStatusColor(hazard.status))}>
                        {humanize(hazard.status)}
                      </Badge>
                      {onViewDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`View details of ${hazard.reportNumber}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(hazard.id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {outcome.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {outcome.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(outcome.totalPages, current + 1))}
                    disabled={page >= outcome.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
