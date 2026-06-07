/**
 * Corrective Action Tracker Component
 * 
 * Tracks follow-up actions from incidents, inspections, and hazards with:
 * - Action items list
 * - Priority and deadline tracking
 * - Assignment management
 * - Progress monitoring
 * - Completion verification
 * 
 * @module components/health-safety/CorrectiveActionTracker
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { 
  CheckSquare, 
  Search, 
  Filter,
  Calendar,
  User,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format, differenceInDays, isBefore } from "date-fns";
import { cn } from "@/lib/utils";

export interface CorrectiveAction {
  id: string;
  actionNumber: string;
  title: string;
  description: string;
  sourceType: "incident" | "inspection" | "hazard";
  sourceId: string;
  sourceNumber: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
  assignedTo: string;
  assignedDate: Date;
  dueDate: Date;
  completedDate?: Date;
  verifiedBy?: string;
  verifiedDate?: Date;
  notes?: string;
}

export interface CorrectiveActionTrackerProps {
  organizationId: string;
  sourceType?: "incident" | "inspection" | "hazard";
  sourceId?: string;
  onViewAction?: (actionId: string) => void;
}

export function CorrectiveActionTracker({
  organizationId,
  sourceType,
  sourceId,
  onViewAction
}: CorrectiveActionTrackerProps) {
  const { toast } = useToast();
  const [actions, setActions] = React.useState<CorrectiveAction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("active");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");

  React.useEffect(() => {
    loadActions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, sourceType, sourceId, statusFilter, priorityFilter]);

  async function loadActions() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        organizationId,
        ...(sourceType && { sourceType }),
        ...(sourceId && { sourceId }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(priorityFilter !== "all" && { priority: priorityFilter })
      });

      const response = await fetch(`/api/health-safety/corrective-actions?${params}`);

      if (!response.ok) {
        throw new Error("Failed to load corrective actions");
      }

      const data = await response.json();
      if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setActions(data.actions.map((a: any) => ({
          ...a,
          assignedDate: new Date(a.assignedDate),
          dueDate: new Date(a.dueDate),
          completedDate: a.completedDate ? new Date(a.completedDate) : undefined,
          verifiedDate: a.verifiedDate ? new Date(a.verifiedDate) : undefined
        })));
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load corrective actions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getStatusInfo(action: CorrectiveAction) {
    if (action.status === "completed") {
      return {
        label: "Completed",
        color: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
        icon: CheckCircle2
      };
    }

    if (action.status === "cancelled") {
      return {
        label: "Cancelled",
        color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
        icon: XCircle
      };
    }

    const daysUntilDue = differenceInDays(action.dueDate, new Date());

    if (daysUntilDue < 0 || action.status === "overdue") {
      return {
        label: `Overdue by ${Math.abs(daysUntilDue)} days`,
        color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        icon: AlertTriangle
      };
    }

    if (action.status === "in_progress") {
      return {
        label: daysUntilDue <= 3 ? `Due in ${daysUntilDue} days` : "In Progress",
        color: daysUntilDue <= 3 
          ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
        icon: Clock
      };
    }

    return {
      label: `Due in ${daysUntilDue} days`,
      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
      icon: Clock
    };
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case "critical":
        return "bg-red-600 text-white";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  const filteredActions = actions.filter(action =>
    action.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.actionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.assignedTo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const overdueActions = actions.filter(a => 
    a.status === "overdue" || (a.status !== "completed" && isBefore(a.dueDate, new Date()))
  );
  const inProgressActions = actions.filter(a => a.status === "in_progress");
  const completedActions = actions.filter(a => a.status === "completed");
  
  const completionRate = actions.length > 0 
    ? Math.round((completedActions.length / actions.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {overdueActions.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Overdue Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 dark:text-red-400">
              {overdueActions.length} corrective action{overdueActions.length !== 1 ? 's are' : ' is'} overdue and require immediate attention.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{completionRate}%</div>
              <Progress value={completionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressActions.length}</div>
            <p className="text-xs text-muted-foreground">Active actions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueActions.length}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedActions.length}</div>
            <p className="text-xs text-muted-foreground">Successfully closed</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions List */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Corrective Actions
            </CardTitle>
            <CardDescription>
              Track and manage follow-up actions
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col gap-4 mb-6 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
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

          {/* Actions Grid */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No corrective actions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActions.map((action) => {
                const statusInfo = getStatusInfo(action);
                const StatusIcon = statusInfo.icon;

                return (
                  <Card
                    key={action.id}
                    className={cn(
                      "hover:shadow-md transition-shadow",
                      action.priority === "critical" && "border-red-200 dark:border-red-900"
                    )}
                  >
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{action.title}</h3>
                              <Badge className={getPriorityColor(action.priority)}>
                                {action.priority}
                              </Badge>
                              <Badge className={statusInfo.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Action #{action.actionNumber}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewAction?.(action.id)}
                          >
                            View Details
                          </Button>
                        </div>

                        <p className="text-sm">{action.description}</p>

                        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 lg:grid-cols-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>Assigned: {action.assignedTo}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Due: {format(action.dueDate, "MMM dd, yyyy")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              Source: {action.sourceType} #{action.sourceNumber}
                            </span>
                          </div>
                          {action.completedDate && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span>Completed: {format(action.completedDate, "MMM dd")}</span>
                            </div>
                          )}
                        </div>

                        {action.notes && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium mb-1">Notes:</p>
                            <p className="text-xs text-muted-foreground">{action.notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
