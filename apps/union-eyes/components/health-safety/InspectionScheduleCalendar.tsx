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
import { logger } from "@/lib/logger";
import { fetchAllRows } from "@/lib/client/crud-lists";
import { asRecord, humanize, requiredDate, requiredString } from "@/lib/client/row-fields";

export interface Inspection {
  id: string;
  title: string;
  date: Date;
  /** As stored: scheduled, in_progress, completed, requires_followup, followup_complete, cancelled or overdue. */
  status: string;
}

export interface InspectionScheduleCalendarProps {
  organizationId: string;
  onScheduleInspection?: () => void;
  /** Without it an inspection is shown on its day but is not a button: there is nowhere to open it. */
  onViewInspection?: (inspectionId: string) => void;
}

function toInspection(value: unknown): Inspection {
  const row = asRecord(value, "inspection");
  return {
    id: requiredString(row, "id"),
    title: `${requiredString(row, "inspectionNumber")} · ${humanize(requiredString(row, "inspectionType"))}`,
    date: requiredDate(row, "scheduledDate"),
    status: requiredString(row, "status"),
  };
}

type Outcome = { kind: "ready"; inspections: Inspection[] } | { kind: "error"; message: string };

export function InspectionScheduleCalendar({
  organizationId,
  onScheduleInspection,
  onViewInspection
}: InspectionScheduleCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [attempt, setAttempt] = React.useState(0);
  // The answer belongs to the organization it was read for: another one's schedule is never drawn while this one loads.
  const [loaded, setLoaded] = React.useState<{ key: string; outcome: Outcome } | null>(null);
  const key = `${organizationId}|${attempt}`;

  // The inspections route cannot filter by date, so every inspection is read once and each month is drawn from them.
  React.useEffect(() => {
    let current = true;
    fetchAllRows<unknown>("/api/health-safety/inspections")
      .then((rows) => rows.map(toInspection))
      .then(
        (inspections) => {
          if (current) setLoaded({ key, outcome: { kind: "ready", inspections } });
        },
        (error: unknown) => {
          logger.error("Failed to load the inspection schedule", error);
          if (current) setLoaded({ key, outcome: { kind: "error", message: error instanceof Error ? error.message : "The inspection schedule could not be loaded." } });
        },
      );
    return () => {
      current = false;
    };
  }, [key]);

  const outcome = loaded?.key === key ? loaded.outcome : null;
  const inspections = outcome?.kind === "ready" ? outcome.inspections : [];

  function getInspectionsForDay(day: Date): Inspection[] {
    return inspections.filter(inspection => 
      isSameDay(inspection.date, day)
    );
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "completed":
      case "followup_complete":
        return "bg-green-500";
      case "scheduled":
        return "bg-blue-500";
      case "in_progress":
        return "bg-purple-500";
      case "requires_followup":
        return "bg-orange-500";
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
        {outcome === null ? (
          <Skeleton className="h-125 w-full" />
        ) : outcome.kind === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">The inspection schedule could not be loaded.</p>
            <p className="text-sm text-muted-foreground">{outcome.message}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((count) => count + 1)}>
              Try again
            </Button>
          </div>
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
                      {dayInspections.map(inspection => {
                        const entry = (
                          <>
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
                          </>
                        );
                        return onViewInspection ? (
                          <button
                            key={inspection.id}
                            type="button"
                            onClick={() => onViewInspection(inspection.id)}
                            className="w-full text-left p-1 rounded text-xs hover:opacity-80 transition-opacity flex items-start gap-1"
                          >
                            {entry}
                          </button>
                        ) : (
                          <div key={inspection.id} className="w-full p-1 rounded text-xs flex items-start gap-1">
                            {entry}
                          </div>
                        );
                      })}
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
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs text-muted-foreground">Needs follow-up</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">Overdue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-xs text-muted-foreground">Cancelled</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
