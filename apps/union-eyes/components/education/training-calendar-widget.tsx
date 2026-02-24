/**
 * Training Calendar Widget Component
 * 
 * Calendar view for training events with:
 * - Month/week/day views
 * - Session filtering
 * - Event details
 * - Registration links
 * - ICS export
 * - Reminders
 * 
 * @module components/education/training-calendar-widget
 */

"use client";

import * as React from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Download,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";

export interface TrainingEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  format: "online" | "in-person" | "hybrid";
  instructor: string;
  category: string;
  maxParticipants?: number;
  enrolledCount: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  registrationUrl?: string;
}

export interface TrainingCalendarWidgetProps {
  events: TrainingEvent[];
  categories: string[];
  initialView?: "month" | "week" | "list";
  onRegister?: (eventId: string) => void;
  onExportCalendar?: () => void;
}

export function TrainingCalendarWidget({
  events,
  categories,
  initialView = "month",
  onRegister,
  onExportCalendar,
}: TrainingCalendarWidgetProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [view, setView] = React.useState<"month" | "week" | "list">(initialView);
  const [selectedEvent, setSelectedEvent] = React.useState<TrainingEvent | null>(null);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = React.useState<string[]>([]);

  const filteredEvents = events.filter((event) => {
    const categoryMatch =
      selectedCategories.length === 0 || selectedCategories.includes(event.category);
    const formatMatch = selectedFormats.length === 0 || selectedFormats.includes(event.format);
    return categoryMatch && formatMatch;
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter((event) => {
      return (
        isSameDay(event.startDate, day) ||
        (event.startDate <= day && event.endDate >= day)
      );
    });
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const toggleFormat = (format: string) => {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedFormats([]);
  };

  const formatConfig = {
    online: { label: "Online", color: "bg-blue-100 text-blue-800", icon: "💻" },
    "in-person": { label: "In-Person", color: "bg-green-100 text-green-800", icon: "👥" },
    hybrid: { label: "Hybrid", color: "bg-purple-100 text-purple-800", icon: "🔄" },
  };

  const statusConfig = {
    upcoming: { color: "bg-blue-100 text-blue-800", label: "Upcoming" },
    ongoing: { color: "bg-green-100 text-green-800", label: "Ongoing" },
    completed: { color: "bg-gray-100 text-gray-800", label: "Completed" },
    cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Training Calendar
          </h2>
          <p className="text-gray-600 mt-1">View and register for upcoming training sessions</p>
        </div>
        {onExportCalendar && (
          <Button variant="outline" onClick={onExportCalendar}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="font-semibold ml-2">{format(currentDate, "MMMM yyyy")}</span>
            </div>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {(selectedCategories.length > 0 || selectedFormats.length > 0) && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedCategories.length + selectedFormats.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Categories</Label>
                      <div className="space-y-2">
                        {categories.map((category) => (
                          <div key={category} className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedCategories.includes(category)}
                              onCheckedChange={() => toggleCategory(category)}
                            />
                            <Label className="text-sm">{category}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2 block">Format</Label>
                      <div className="space-y-2">
                        {Object.entries(formatConfig).map(([key, config]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedFormats.includes(key)}
                              onCheckedChange={() => toggleFormat(key)}
                            />
                            <Label className="text-sm">
                              {config.icon} {config.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button size="sm" variant="outline" onClick={clearFilters} className="w-full">
                      Clear Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Select value={view} onValueChange={(v: any) => setView(v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                </SelectContent>
              </Select>
            </div>
160          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      {view === "month" && (
        <Card>
          <CardContent className="p-4">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-gray-600">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const dayEvents = getEventsForDay(day);
                const _isCurrentMonth = isSameDay(day, currentDate);
                const isDayToday = isToday(day);

                return (
                  <div
                    key={day.toString()}
                    className={`
                      min-h-[100px] p-2 border rounded-lg
                      ${!isSameMonth(day, currentDate) ? "bg-gray-50" : "bg-white"}
                      ${isDayToday ? "border-blue-500 border-2" : ""}
                    `}
                  >
                    <div
                      className={`
                        text-sm font-medium mb-1
                        ${!isSameMonth(day, currentDate) ? "text-gray-400" : ""}
                        ${isDayToday ? "text-blue-600 font-bold" : ""}
                      `}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`
                            text-xs p-1 rounded cursor-pointer
                            ${formatConfig[event.format].color}
                            hover:opacity-80
                          `}
                          onClick={() => setSelectedEvent(event)}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-gray-600">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No training events found</p>
              </CardContent>
            </Card>
          ) : (
            filteredEvents.map((event) => (
              <Card key={event.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{event.title}</h4>
                        <Badge className={formatConfig[event.format].color}>
                          {formatConfig[event.format].icon} {formatConfig[event.format].label}
                        </Badge>
                        <Badge className={statusConfig[event.status].color}>
                          {statusConfig[event.status].label}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">{event.description}</p>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="h-4 w-4" />
                          {format(event.startDate, "MMM d, yyyy h:mm a")}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="h-4 w-4" />
                          {event.enrolledCount}
                          {event.maxParticipants && ` / ${event.maxParticipants}`} enrolled
                        </div>
                        <div className="text-gray-600">
                          Instructor: {event.instructor}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button size="sm" onClick={() => setSelectedEvent(event)}>
                        View Details
                      </Button>
                      {event.status === "upcoming" && onRegister && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRegister(event.id)}
                        >
                          Register
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={selectedEvent ? formatConfig[selectedEvent.format].color : ""}>
                  {selectedEvent && formatConfig[selectedEvent.format].icon}{" "}
                  {selectedEvent && formatConfig[selectedEvent.format].label}
                </Badge>
                <Badge className={selectedEvent ? statusConfig[selectedEvent.status].color : ""}>
                  {selectedEvent && statusConfig[selectedEvent.status].label}
                </Badge>
              </div>
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">Description</h4>
                <p className="text-gray-600">{selectedEvent.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Start Date</h4>
                  <p className="text-gray-600">
                    {format(selectedEvent.startDate, "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">End Date</h4>
                  <p className="text-gray-600">
                    {format(selectedEvent.endDate, "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Location</h4>
                  <p className="text-gray-600">{selectedEvent.location}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Instructor</h4>
                  <p className="text-gray-600">{selectedEvent.instructor}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Category</h4>
                  <p className="text-gray-600">{selectedEvent.category}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Enrollment</h4>
                  <p className="text-gray-600">
                    {selectedEvent.enrolledCount}
                    {selectedEvent.maxParticipants && ` / ${selectedEvent.maxParticipants}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>
              Close
            </Button>
            {selectedEvent && selectedEvent.status === "upcoming" && onRegister && (
              <Button onClick={() => onRegister(selectedEvent.id)}>
                Register Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

