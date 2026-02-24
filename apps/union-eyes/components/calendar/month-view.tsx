/**
 * Calendar Month View Component
 * 
 * Full-featured monthly calendar with:
 * - Month navigation
 * - Event display with indicators
 * - Multi-day event spanning
 * - Today highlighting
 * - Date selection
 * - Event click handlers
 * - Color-coded events by type
 * - Responsive layout
 * 
 * @module components/calendar/month-view
 */

"use client";

import * as React from "react";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as _CalendarIcon,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  type?: "meeting" | "deadline" | "training" | "election" | "other";
  color?: string;
  allDay?: boolean;
  description?: string;
  location?: string;
}

interface MonthViewProps {
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onAddEvent?: (date: Date) => void;
  initialDate?: Date;
}

export function MonthView({
  events,
  onDateClick,
  onEventClick,
  onAddEvent,
  initialDate = new Date(),
}: MonthViewProps) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDaysInMonth = (year: number, month: number): Date[] => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Date[] = [];

    // Add previous month's days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }

    // Add current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    // Add next month's days to complete the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter((event) => {
      if (filterType !== "all" && event.type !== filterType) {
        return false;
      }

      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const eventStart = new Date(
        event.startDate.getFullYear(),
        event.startDate.getMonth(),
        event.startDate.getDate()
      );
      const eventEnd = new Date(
        event.endDate.getFullYear(),
        event.endDate.getMonth(),
        event.endDate.getDate()
      );

      return dateOnly >= eventStart && dateOnly <= eventEnd;
    });
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const isToday = (date: Date): boolean => {
    return isSameDay(date, today);
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick?.(date);
  };

  const days = getDaysInMonth(currentYear, currentMonth);

  const eventTypeColors = {
    meeting: "bg-blue-500",
    deadline: "bg-red-500",
    training: "bg-green-500",
    election: "bg-purple-500",
    other: "bg-gray-500",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <CardTitle>
                {monthNames[currentMonth]} {currentYear}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="ghost" size="sm" onClick={goToNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="deadline">Deadlines</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="election">Elections</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              {onAddEvent && (
                <Button onClick={() => onAddEvent(currentDate)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Event
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Day headers */}
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="bg-muted p-2 text-center text-sm font-semibold"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((date, index) => {
              const dayEvents = getEventsForDate(date);
              const isCurrentMonthDay = isCurrentMonth(date);
              const isTodayDate = isToday(date);
              const isSelected = selectedDate && isSameDay(date, selectedDate);

              return (
                <div
                  key={index}
                  onClick={() => handleDateClick(date)}
                  className={`bg-background min-h-[100px] p-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !isCurrentMonthDay ? "opacity-40" : ""
                  } ${isTodayDate ? "ring-2 ring-primary" : ""} ${
                    isSelected ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`text-sm font-medium ${
                        isTodayDate
                          ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                          : ""
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <Popover key={event.id}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                            className={`w-full text-left text-xs p-1 rounded truncate ${
                              event.color ||
                              eventTypeColors[event.type || "other"]
                            } text-white hover:opacity-80`}
                          >
                            {event.title}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <EventDetails event={event} />
                        </PopoverContent>
                      </Popover>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            {Object.entries(eventTypeColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span className="text-sm capitalize">{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Event Details Popover
function EventDetails({ event }: { event: CalendarEvent }) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-semibold">{event.title}</h4>
        {event.type && (
          <Badge variant="secondary" className="mt-1 capitalize">
            {event.type}
          </Badge>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Start:</span>{" "}
          {formatDate(event.startDate)}
          {!event.allDay && ` at ${formatTime(event.startDate)}`}
        </div>
        <div>
          <span className="font-medium">End:</span> {formatDate(event.endDate)}
          {!event.allDay && ` at ${formatTime(event.endDate)}`}
        </div>
        {event.location && (
          <div>
            <span className="font-medium">Location:</span> {event.location}
          </div>
        )}
      </div>

      {event.description && (
        <div className="text-sm text-muted-foreground">{event.description}</div>
      )}
    </div>
  );
}

