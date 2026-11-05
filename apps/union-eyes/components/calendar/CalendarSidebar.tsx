/**
 * Calendar Sidebar Component
 * 
 * Displays list of user's calendars with visibility toggles,
 * sync status, and quick actions.
 * 
 * @module components/calendar/CalendarSidebar
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Cloud,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Calendar {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  visibility: boolean;
}

interface CalendarSidebarProps {
  calendars: Calendar[];
  selectedCalendarId?: string;
  onSelectCalendar: (calendarId: string) => void;
  onToggleVisibility: (calendarId: string, visible: boolean) => void;
  onCreateCalendar: () => void;
  onManageSync?: () => void;
}

export function CalendarSidebar({
  calendars,
  selectedCalendarId,
  onSelectCalendar,
  onToggleVisibility,
  onCreateCalendar,
  onManageSync,
}: CalendarSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    myCalendars: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="w-64 border-r bg-muted/10 p-4 space-y-6">
      {/* Create Calendar Button */}
      <Button onClick={onCreateCalendar} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        New Calendar
      </Button>

      {/* My Calendars Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => toggleSection('myCalendars')}
            className="flex items-center space-x-2 text-sm font-semibold hover:text-primary"
          >
            {expandedSections.myCalendars ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>My Calendars</span>
          </button>
        </div>

        {expandedSections.myCalendars && (
          <div className="space-y-1 pl-2">
            {calendars.map(calendar => (
              <CalendarItem
                key={calendar.id}
                calendar={calendar}
                selected={calendar.id === selectedCalendarId}
                onSelect={onSelectCalendar}
                onToggleVisibility={onToggleVisibility}
              />
            ))}
            {calendars.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No calendars yet</p>
            )}
          </div>
        )}
      </div>

      {/* Connected external calendars (sync itself is not available: see CalendarSyncManager) */}
      {onManageSync && (
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={onManageSync}
            className="w-full"
          >
            <Cloud className="h-4 w-4 mr-2" />
            Manage Sync
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CALENDAR ITEM
// ============================================================================

interface CalendarItemProps {
  calendar: Calendar;
  selected: boolean;
  onSelect: (calendarId: string) => void;
  onToggleVisibility: (calendarId: string, visible: boolean) => void;
}

function CalendarItem({
  calendar,
  selected,
  onSelect,
  onToggleVisibility,
}: CalendarItemProps) {
  return (
    <div
      className={cn(
        'flex items-center space-x-2 p-2 rounded-lg hover:bg-muted cursor-pointer group',
        selected && 'bg-muted'
      )}
      onClick={() => onSelect(calendar.id)}
    >
      <Switch
        checked={calendar.visibility}
        onCheckedChange={(checked) => {
          onToggleVisibility(calendar.id, checked);
        }}
        onClick={(e) => e.stopPropagation()}
        className="scale-75"
      />

      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: calendar.color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="text-sm truncate">{calendar.name}</span>
          {calendar.isDefault && (
            <Badge variant="secondary" className="text-xs">
              Default
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

