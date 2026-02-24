/**
 * Calendar View Component
 * 
 * Main calendar interface with month/week/day/agenda views.
 * Uses react-day-picker for date selection and custom event rendering.
 * 
 * @module components/calendar/CalendarView
 */

'use client';

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Clock } from 'lucide-react';
 
import { cn } from '@/lib/utils';

type ViewType = 'month' | 'week' | 'day' | 'agenda';

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventType: string;
  status: string;
  location?: string;
  isAllDay: boolean;
}

interface CalendarViewProps {
  calendarId: string;
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onCreateEvent?: (date: Date) => void;
}

export function CalendarView({
  calendarId: _calendarId,
  events = [],
  onEventClick,
  onDateClick,
  onCreateEvent,
}: CalendarViewProps) {
  const [view, setView] = useState<ViewType>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [displayedEvents, setDisplayedEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    // Filter events based on view and selected date
    const start = getViewStart(selectedDate, view);
    const end = getViewEnd(selectedDate, view);

    const filtered = events.filter(event => {
      const eventStart = new Date(event.startTime);
      return eventStart >= start && eventStart <= end;
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedEvents(filtered);
  }, [selectedDate, view, events]);

  const handlePrevious = () => {
    const newDate = new Date(selectedDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    }
    setSelectedDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(selectedDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold">
            {format(selectedDate, view === 'month' ? 'MMMM yyyy' : 'MMMM d, yyyy')}
          </h2>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex space-x-2">
          <Button
            variant={view === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('month')}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Month
          </Button>
          <Button
            variant={view === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('week')}
          >
            <Clock className="h-4 w-4 mr-2" />
            Week
          </Button>
          <Button
            variant={view === 'day' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('day')}
          >
            Day
          </Button>
          <Button
            variant={view === 'agenda' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('agenda')}
          >
            <List className="h-4 w-4 mr-2" />
            Agenda
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'month' && (
          <MonthView
            date={selectedDate}
            events={displayedEvents}
            onEventClick={onEventClick}
            onDateClick={onDateClick}
            onCreateEvent={onCreateEvent}
          />
        )}
        {view === 'week' && (
          <WeekView
            date={selectedDate}
            events={displayedEvents}
            onEventClick={onEventClick}
            onCreateEvent={onCreateEvent}
          />
        )}
        {view === 'day' && (
          <DayView
            date={selectedDate}
            events={displayedEvents}
            onEventClick={onEventClick}
            onCreateEvent={onCreateEvent}
          />
        )}
        {view === 'agenda' && (
          <AgendaView
            events={displayedEvents}
            onEventClick={onEventClick}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MONTH VIEW
// ============================================================================

function MonthView({
  date,
  events,
  onEventClick,
  onDateClick,
  onCreateEvent,
}: {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onCreateEvent?: (date: Date) => void;
}) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let currentDay = calendarStart;
  while (currentDay <= calendarEnd) {
    days.push(currentDay);
    currentDay = addDays(currentDay, 1);
  }

  const getEventsForDay = (day: Date) => {
    return events.filter(event =>
      isSameDay(new Date(event.startTime), day)
    );
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {/* Day Headers */}
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <div key={day} className="text-center font-semibold text-sm py-2">
          {day}
        </div>
      ))}

      {/* Calendar Days */}
      {days.map((day, index) => {
        const dayEvents = getEventsForDay(day);
        const isCurrentMonth = day.getMonth() === date.getMonth();
        const isToday = isSameDay(day, new Date());

        return (
          <div
            key={index}
            className={cn(
              'min-h-24 p-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors',
              !isCurrentMonth && 'bg-muted/20 text-muted-foreground',
              isToday && 'border-primary border-2'
            )}
            onClick={() => {
              onDateClick?.(day);
              if (dayEvents.length === 0) {
                onCreateEvent?.(day);
              }
            }}
          >
            <div className="text-sm font-medium mb-1">{format(day, 'd')}</div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map(event => (
                <div
                  key={event.id}
                  className="text-xs p-1 rounded bg-primary/10 hover:bg-primary/20 cursor-pointer truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                >
                  {event.title}
                </div>
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
  );
}

// ============================================================================
// WEEK VIEW
// ============================================================================

function WeekView({
  date,
  events,
  onEventClick,
  onCreateEvent,
}: {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: (date: Date) => void;
}) {
  const weekStart = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      return isSameDay(eventStart, day) && eventStart.getHours() === hour;
    });
  };

  return (
    <div className="grid grid-cols-8 gap-1">
      {/* Header */}
      <div className="col-span-1"></div>
      {days.map((day, index) => (
        <div key={index} className="text-center p-2 border-b">
          <div className="font-semibold">{format(day, 'EEE')}</div>
          <div className={cn('text-2xl', isSameDay(day, new Date()) && 'text-primary')}>
            {format(day, 'd')}
          </div>
        </div>
      ))}

      {/* Time Grid */}
      {hours.map(hour => (
        <React.Fragment key={hour}>
          <div className="text-right pr-2 text-xs text-muted-foreground py-2">
            {format(new Date().setHours(hour, 0), 'h a')}
          </div>
          {days.map((day, dayIndex) => {
            const dayEvents = getEventsForDayAndHour(day, hour);
            return (
              <div
                key={dayIndex}
                className="border min-h-16 p-1 hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  const dateTime = new Date(day);
                  dateTime.setHours(hour);
                  onCreateEvent?.(dateTime);
                }}
              >
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className="text-xs p-1 mb-1 rounded bg-primary text-primary-foreground cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// DAY VIEW
// ============================================================================

function DayView({
  date,
  events,
  onEventClick,
  onCreateEvent,
}: {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: (date: Date) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (hour: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      return eventStart.getHours() === hour;
    });
  };

  return (
    <div className="space-y-1">
      {hours.map(hour => {
        const hourEvents = getEventsForHour(hour);
        return (
          <div key={hour} className="flex items-start space-x-4">
            <div className="w-20 text-right text-sm text-muted-foreground pt-2">
              {format(new Date().setHours(hour, 0), 'h:mm a')}
            </div>
            <div
              className="flex-1 border rounded-lg min-h-16 p-2 hover:bg-muted/50 cursor-pointer"
              onClick={() => {
                const dateTime = new Date(date);
                dateTime.setHours(hour);
                onCreateEvent?.(dateTime);
              }}
            >
              {hourEvents.map(event => (
                <div
                  key={event.id}
                  className="p-2 mb-2 rounded-lg bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                >
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-xs opacity-90">
                    {format(new Date(event.startTime), 'h:mm a')} -{' '}
                    {format(new Date(event.endTime), 'h:mm a')}
                  </div>
                  {event.location && (
                    <div className="text-xs opacity-80 mt-1">{event.location}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// AGENDA VIEW
// ============================================================================

function AgendaView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}) {
  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = format(new Date(event.startTime), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="space-y-6">
      {sortedDates.map(dateKey => {
        const date = new Date(dateKey);
        const dayEvents = groupedEvents[dateKey];

        return (
          <div key={dateKey}>
            <h3 className="text-lg font-semibold mb-3 sticky top-0 bg-background py-2">
              {format(date, 'EEEE, MMMM d, yyyy')}
            </h3>
            <div className="space-y-2">
              {dayEvents.map(event => (
                <div
                  key={event.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onEventClick?.(event)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{event.title}</h4>
                      <div className="text-sm text-muted-foreground mt-1">
                        {event.isAllDay ? (
                          'All day'
                        ) : (
                          <>
                            {format(new Date(event.startTime), 'h:mm a')} -{' '}
                            {format(new Date(event.endTime), 'h:mm a')}
                          </>
                        )}
                      </div>
                      {event.location && (
                        <div className="text-sm text-muted-foreground">{event.location}</div>
                      )}
                    </div>
                    <Badge variant={event.status === 'confirmed' ? 'default' : 'secondary'}>
                      {event.eventType}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {sortedDates.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No events scheduled
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getViewStart(date: Date, view: ViewType): Date {
  if (view === 'month') {
    return startOfWeek(startOfMonth(date));
  } else if (view === 'week') {
    return startOfWeek(date);
  } else {
    return new Date(date.setHours(0, 0, 0, 0));
  }
}

function getViewEnd(date: Date, view: ViewType): Date {
  if (view === 'month') {
    return endOfWeek(endOfMonth(date));
  } else if (view === 'week') {
    return endOfWeek(date);
  } else {
    return new Date(date.setHours(23, 59, 59, 999));
  }
}

