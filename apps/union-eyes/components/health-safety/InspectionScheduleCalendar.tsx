/**
 * Inspection Schedule Calendar Component
 * 
 * Calendar view for scheduling and tracking inspections with:
 * - Monthly calendar view
 * - Scheduled inspections
 * - Overdue indicators
 * - Quick scheduling
 * - Color-coded by status
 * 
 * @module components/health-safety/InspectionScheduleCalendar
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  AlertCircle
} from "lucide-react";
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { cn } from "@/lib/utils";

export interface Inspection {
  id: string;
  title: string;
  date: Date;
  status: "scheduled" | "completed" | "overdue" | "in_progress";
  inspector?: string;
  location: string;
}

interface _InspectionData {
  id: string;
  title: string;
  date: string;
  status: "scheduled" | "completed" | "overdue" | "in_progress";
  inspector?: string;
  location: string;
}

export interface InspectionScheduleCalendarProps {
  organizationId: string;
  onScheduleInspection?: () => void;
  onViewInspection?: (inspectionId: string) => void;
}

export function InspectionScheduleCalendar({
  organizationId,
  onScheduleInspection,
  onViewInspection
}: InspectionScheduleCalendarProps) {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [inspections, setInspections] = React.useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadInspections = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const response = await fetch(
        `/api/health-safety/inspections?organizationId=${organizationId}&startDate=${start}&endDate=${end}`
      );

      if (!response.ok) {
        throw new Error("Failed to load inspections");
      }

      const json = await response.json();
      if (json.success) {
        const rows = Array.isArray(json.data?.data) ? json.data.data : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setInspections(rows.map((i: unknown) => ({
          id: i.id,
          title: i.inspectionType ?? i.inspectionNumber ?? i.title ?? 'Inspection',
          date: new Date(i.scheduledDate ?? i.date ?? Date.now()),
          status: i.status ?? 'scheduled',
          inspector: i.leadInspectorName ?? i.inspector,
          location: i.workplaceName ?? i.specificLocation ?? i.location ?? '',
        })));
      } else {
        throw new Error(json.error);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load inspection schedule",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, currentMonth, toast]);

  React.useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  function getInspectionsForDay(day: Date): Inspection[] {
    return inspections.filter(inspection => 
      isSameDay(inspection.date, day)
    );
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "scheduled":
        return "bg-blue-500";
      case "in_progress":
        return "bg-purple-500";
      case "overdue":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  }

  // Get calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Inspection Schedule
            </CardTitle>
            <CardDescription>
              {format(currentMonth, "MMMM yyyy")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {onScheduleInspection && (
              <Button size="sm" onClick={onScheduleInspection}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-125 w-full" />
        ) : (
          <div className="space-y-4">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Week day headers */}
              {weekDays.map(day => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {days.map(day => {
                const dayInspections = getInspectionsForDay(day);
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isDayToday = isToday(day);

                return (
                  <div
                    key={day.toString()}
                    className={cn(
                      "min-h-25 p-2 border rounded-lg",
                      isCurrentMonth 
                        ? "bg-background" 
                        : "bg-muted/50 text-muted-foreground",
                      isDayToday && "border-primary border-2"
                    )}
                  >
                    <div className="text-sm font-medium mb-1">
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayInspections.map(inspection => (
                        <button
                          key={inspection.id}
                          onClick={() => onViewInspection?.(inspection.id)}
                          className={cn(
                            "w-full text-left p-1 rounded text-xs hover:opacity-80 transition-opacity",
                            "flex items-start gap-1"
                          )}
                        >
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full mt-1 shrink-0",
                              getStatusColor(inspection.status)
                            )}
                          />
                          <span className="line-clamp-2 flex-1">
                            {inspection.title}
                          </span>
                          {inspection.status === "overdue" && (
                            <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-muted-foreground">Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-xs text-muted-foreground">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">Overdue</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
