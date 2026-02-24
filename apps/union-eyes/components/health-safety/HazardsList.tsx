/**
 * Hazards List Component
 * 
 * Displays list of reported hazards with:
 * - Filtering by priority, status, type
 * - Search functionality
 * - Priority indicators
 * - Quick status updates
 * - Responsive grid/list view
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
import { useToast } from "@/components/ui/use-toast";
import {
  Search,
  Filter,
  AlertTriangle,
  MapPin,
  Calendar,
  Eye,
} from "lucide-react";
import { HazardPriorityBadge } from "./HazardPriorityBadge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface Hazard {
  id: string;
  hazardNumber: string;
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "under_review" | "resolved" | "closed";
  location: string;
  description: string;
  reportedDate: Date;
  reportedBy?: string;
  assignedTo?: string;
}

export interface HazardsListProps {
  organizationId: string;
  onViewDetails?: (hazardId: string) => void;
}

export function HazardsList({
  organizationId,
  onViewDetails
}: HazardsListProps) {
  const { toast } = useToast();
  const [hazards, setHazards] = React.useState<Hazard[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("open");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");

  React.useEffect(() => {
    loadHazards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, statusFilter, priorityFilter, searchQuery]);

  async function loadHazards() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        organizationId,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(priorityFilter !== "all" && { priority: priorityFilter }),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await fetch(`/api/health-safety/hazards?${params}`);

      if (!response.ok) {
        throw new Error("Failed to load hazards");
      }

      const data = await response.json();
      if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setHazards(data.hazards.map((h: any) => ({
          ...h,
          reportedDate: new Date(h.reportedDate)
        })));
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load hazards",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleViewDetails(hazardId: string) {
    if (onViewDetails) {
      onViewDetails(hazardId);
    } else {
      window.location.href = `/health-safety/hazards/${hazardId}`;
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      case "under_review":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      case "open":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
      case "closed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hazards Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : hazards.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hazards found</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hazards.map((hazard) => (
              <Card
                key={hazard.id}
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer",
                  hazard.priority === "critical" && "border-red-200 dark:border-red-900"
                )}
                onClick={() => handleViewDetails(hazard.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base line-clamp-1">
                        {hazard.hazardNumber}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {hazard.type.replace(/_/g, ' ')}
                      </CardDescription>
                    </div>
                    <HazardPriorityBadge priority={hazard.priority} />
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
                    <Badge className={getStatusColor(hazard.status)}>
                      {hazard.status.replace(/_/g, ' ')}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(hazard.id);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
