/**
 * DeadlineCalendar Component
 * 
 * Calendar view of deadlines with color-coded events
 * - Month/week/day views
 * - Traffic light color system
 * - Click events to view details
 */

import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

interface CalendarDeadline {
  id: string;
  claimId: string;
  deadlineName: string;
  claimNumber?: string;
  deadlineType: string;
  currentDeadline: string;
  status: 'pending' | 'completed' | 'missed' | 'extended' | 'waived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  isOverdue: boolean;
  daysUntilDue?: number;
  daysOverdue: number;
  extensionCount: number;
  completedAt?: string;
  completedBy?: string;
}

interface DeadlineCalendarProps {
  deadlines: CalendarDeadline[];
  loading?: boolean;
  onDateClick?: (date: Date) => void;
  onDeadlineClick?: (deadline: CalendarDeadline) => void;
}

export function DeadlineCalendar({
  deadlines,
  loading = false,
  onDateClick,
  onDeadlineClick,
}: DeadlineCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group deadlines by date
  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, CalendarDeadline[]>();
    deadlines.forEach((deadline) => {
      const dateKey = format(new Date(deadline.currentDeadline), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(deadline);
    });
    return map;
  }, [deadlines]);

  const getDeadlineColor = (deadline: CalendarDeadline) => {
    if (deadline.status !== 'pending') return 'bg-gray-400 border-gray-500';
    if (deadline.isOverdue) return 'bg-gray-900 border-gray-900';
    if ((deadline.daysUntilDue || 0) <= 1) return 'bg-red-600 border-red-700';
    if ((deadline.daysUntilDue || 0) <= 3) return 'bg-yellow-500 border-yellow-600';
    return 'bg-green-500 border-green-600';
  };

  const getDayDeadlines = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return deadlinesByDate.get(dateKey) || [];
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (onDateClick) {
      onDateClick(date);
    }
  };

  const selectedDateDeadlines = selectedDate ? getDayDeadlines(selectedDate) : [];

  // Calculate first day of month (0 = Sunday, 6 = Saturday)
  const firstDayOfMonth = monthStart.getDay();
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-7 gap-2">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            Deadline Calendar
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <h4 className="text-xl font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h4>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <ChevronRightIcon className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-[1fr_300px] gap-6">
          {/* Calendar Grid */}
          <div>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty cells for days before month starts */}
              {emptyDays.map((i) => (
                <div key={`empty-${i}`} className="h-24 border border-transparent"></div>
              ))}

              {/* Month days */}
              {monthDays.map((day) => {
                const dayDeadlines = getDayDeadlines(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    className={`h-24 p-2 border rounded-lg text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                        : isTodayDate
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isTodayDate ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </div>

                    {/* Deadline dots */}
                    {dayDeadlines.length > 0 && (
                      <div className="space-y-1">
                        {dayDeadlines.slice(0, 3).map((deadline) => (
                          <div
                            key={deadline.id}
                            className={`w-full h-1.5 rounded-full ${getDeadlineColor(deadline)}`}
                            title={deadline.deadlineName}
                          />
                        ))}
                        {dayDeadlines.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{dayDeadlines.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar - Selected Date Details */}
          <div className="border-l border-gray-200 pl-6">
            {selectedDate ? (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-4">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h5>

                {selectedDateDeadlines.length === 0 ? (
                  <div className="text-center py-8">
                    <ClockIcon className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">No deadlines on this date</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDateDeadlines.map((deadline) => (
                      <button
                        key={deadline.id}
                        onClick={() => onDeadlineClick?.(deadline)}
                        className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-2 h-2 mt-1.5 rounded-full ${getDeadlineColor(deadline).split(' ')[0]}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {deadline.deadlineName}
                            </p>
                            {deadline.claimNumber && (
                              <p className="text-xs text-gray-500 mt-1">
                                Claim {deadline.claimNumber}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  deadline.priority === 'critical'
                                    ? 'bg-red-100 text-red-800'
                                    : deadline.priority === 'high'
                                    ? 'bg-orange-100 text-orange-800'
                                    : deadline.priority === 'medium'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {deadline.priority}
                              </span>
                              {deadline.isOverdue && (
                                <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                                  Overdue
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClockIcon className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Select a date to view deadlines</p>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-3">Status Legend:</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 border border-green-600"></div>
              <span className="text-xs text-gray-600">Safe (3+ days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-600"></div>
              <span className="text-xs text-gray-600">Warning (1-3 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600 border border-red-700"></div>
              <span className="text-xs text-gray-600">Urgent (today/tomorrow)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-900 border border-gray-900"></div>
              <span className="text-xs text-gray-600">Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400 border border-gray-500"></div>
              <span className="text-xs text-gray-600">Completed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

