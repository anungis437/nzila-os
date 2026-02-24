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
  Calendar,
  Plus,
  Cloud,
  CloudOff,
  RefreshCw,
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
  syncEnabled?: boolean;
  syncStatus?: 'synced' | 'syncing' | 'failed' | 'pending';
  provider?: 'google' | 'microsoft' | 'local';
}

interface CalendarSidebarProps {
  calendars: Calendar[];
  selectedCalendarId?: string;
  onSelectCalendar: (calendarId: string) => void;
  onToggleVisibility: (calendarId: string, visible: boolean) => void;
  onCreateCalendar: () => void;
  onSyncCalendar?: (calendarId: string) => void;
  onManageSync?: () => void;
}

export function CalendarSidebar({
  calendars,
  selectedCalendarId,
  onSelectCalendar,
  onToggleVisibility,
  onCreateCalendar,
  onSyncCalendar,
  onManageSync,
}: CalendarSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    myCalendars: true,
    synced: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const localCalendars = calendars.filter(cal => !cal.provider || cal.provider === 'local');
  const syncedCalendars = calendars.filter(cal => cal.provider && cal.provider !== 'local');

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
            {localCalendars.map(calendar => (
              <CalendarItem
                key={calendar.id}
                calendar={calendar}
                selected={calendar.id === selectedCalendarId}
                onSelect={onSelectCalendar}
                onToggleVisibility={onToggleVisibility}
              />
            ))}
            {localCalendars.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No calendars yet</p>
            )}
          </div>
        )}
      </div>

      {/* Synced Calendars Section */}
      {syncedCalendars.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleSection('synced')}
              className="flex items-center space-x-2 text-sm font-semibold hover:text-primary"
            >
              {expandedSections.synced ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>Synced Calendars</span>
            </button>
          </div>

          {expandedSections.synced && (
            <div className="space-y-1 pl-2">
              {syncedCalendars.map(calendar => (
                <CalendarItem
                  key={calendar.id}
                  calendar={calendar}
                  selected={calendar.id === selectedCalendarId}
                  onSelect={onSelectCalendar}
                  onToggleVisibility={onToggleVisibility}
                  onSync={onSyncCalendar}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync Management */}
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
  onSync?: (calendarId: string) => void;
}

function CalendarItem({
  calendar,
  selected,
  onSelect,
  onToggleVisibility,
  onSync,
}: CalendarItemProps) {
  const getSyncIcon = () => {
    if (!calendar.syncEnabled) return null;

    switch (calendar.syncStatus) {
      case 'syncing':
        return <RefreshCw className="h-3 w-3 animate-spin" />;
      case 'failed':
        return <CloudOff className="h-3 w-3 text-destructive" />;
      case 'synced':
        return <Cloud className="h-3 w-3 text-green-600" />;
      default:
        return <Cloud className="h-3 w-3 text-muted-foreground" />;
    }
  };

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

      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {getSyncIcon()}
        {onSync && calendar.syncEnabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSync(calendar.id);
            }}
            className="p-1 hover:bg-background rounded"
            title="Sync now"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

