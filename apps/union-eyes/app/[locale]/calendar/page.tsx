/**
 * Calendar Page - Main Component
 * 
 * Integrates all calendar components into a complete calendar interface.
 * Handles state management and API interactions.
 * 
 * @module app/calendar/page
 */

'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarView } from '@/components/calendar/CalendarView';
import { CalendarSidebar } from '@/components/calendar/CalendarSidebar';
import { EventDialog } from '@/components/calendar/EventDialog';
import { CalendarSyncManager } from '@/components/calendar/CalendarSyncManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Settings } from 'lucide-react';

export default function CalendarPage() {
  const t = useTranslations();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [calendars, setCalendars] = useState<any[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [syncManagerOpen, setSyncManagerOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [initialDate, setInitialDate] = useState<Date | undefined>();
  const [createCalendarOpen, setCreateCalendarOpen] = useState(false);
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarDescription, setNewCalendarDescription] = useState('');
  const [newCalendarColor, setNewCalendarColor] = useState('#2563eb');
  const [newCalendarTimezone, setNewCalendarTimezone] = useState('America/New_York');

  useEffect(() => {
    fetchCalendars();
  }, []);

  useEffect(() => {
    if (selectedCalendarId) {
      fetchEvents(selectedCalendarId);
    }
  }, [selectedCalendarId]);

  const fetchCalendars = async () => {
    try {
      const response = await fetch('/api/calendars');
      const data = await response.json();
      
      setCalendars(data.calendars || []);
      
      // Select first calendar by default
      if (data.calendars && data.calendars.length > 0) {
        setSelectedCalendarId(data.calendars[0].id);
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async (calendarId: string) => {
    try {
      const response = await fetch(`/api/calendars/${calendarId}/events`);
      const data = await response.json();
      
      setEvents(data.events || []);
    } catch (_error) {
    }
  };

  const handleCreateEvent = (date?: Date) => {
    setSelectedEvent(null);
    setInitialDate(date);
    setEventDialogOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditEvent = (event: any) => {
    setSelectedEvent(event);
    setInitialDate(undefined);
    setEventDialogOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveEvent = async (eventData: any) => {
    try {
      if (selectedEvent) {
        // Update existing event
        await fetch(`/api/calendars/${selectedCalendarId}/events/${selectedEvent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      } else {
        // Create new event
        await fetch(`/api/calendars/${selectedCalendarId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      }

      // Refresh events
      await fetchEvents(selectedCalendarId);
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await fetch(`/api/calendars/${selectedCalendarId}/events/${eventId}`, {
        method: 'DELETE',
      });

      // Refresh events
      await fetchEvents(selectedCalendarId);
    } catch (error) {
      throw error;
    }
  };

  const handleToggleCalendarVisibility = (calendarId: string, visible: boolean) => {
    setCalendars(prev =>
      prev.map(cal =>
        cal.id === calendarId ? { ...cal, visibility: visible } : cal
      )
    );
  };

  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) {
      return;
    }

    setIsCreatingCalendar(true);

    try {
      const response = await fetch('/api/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCalendarName.trim(),
          description: newCalendarDescription.trim() || undefined,
          color: newCalendarColor,
          timezone: newCalendarTimezone,
          isPersonal: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create calendar');
      }

      const data = await response.json();
      await fetchCalendars();

      if (data?.calendar?.id) {
        setSelectedCalendarId(data.calendar.id);
      }

      setCreateCalendarOpen(false);
      setNewCalendarName('');
      setNewCalendarDescription('');
    } catch (_error) {
alert('Failed to create calendar');
    } finally {
      setIsCreatingCalendar(false);
    }
  };

  const handleSyncCalendar = async (calendarId: string) => {
    // Trigger sync via API
    try {
      const calendar = calendars.find(c => c.id === calendarId);
      if (!calendar?.connectionId) return;

      await fetch(`/api/calendar-sync/connections/${calendar.connectionId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localCalendarId: calendarId,
          externalCalendarId: calendar.externalCalendarId,
        }),
      });

      // Refresh events
      await fetchEvents(selectedCalendarId);
    } catch (_error) {
alert('Failed to sync calendar');
    }
  };

  // Filter visible events
  const visibleEvents = events.filter(event => {
    const calendar = calendars.find(cal => cal.id === event.calendarId);
    return calendar?.visibility !== false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">{t('calendar.loadingCalendars')}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <CalendarSidebar
        calendars={calendars}
        selectedCalendarId={selectedCalendarId}
        onSelectCalendar={setSelectedCalendarId}
        onToggleVisibility={handleToggleCalendarVisibility}
        onCreateCalendar={() => setCreateCalendarOpen(true)}
        onSyncCalendar={handleSyncCalendar}
        onManageSync={() => setSyncManagerOpen(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b p-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('calendar.title')}</h1>
          <div className="flex space-x-2">
            <Button onClick={() => handleCreateEvent()}>
              <Plus className="h-4 w-4 mr-2" />
              {t('calendar.newEvent')}
            </Button>
            <Button variant="outline" onClick={() => setSyncManagerOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              {t('calendar.syncSettings')}
            </Button>
          </div>
        </div>

        {/* Calendar View */}
        {selectedCalendarId ? (
          <CalendarView
            calendarId={selectedCalendarId}
            events={visibleEvents}
            onEventClick={handleEditEvent}
            onDateClick={(_date) => undefined}
            onCreateEvent={handleCreateEvent}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="mb-4">{t('calendar.noCalendarSelected')}</p>
              <Button onClick={() => setCreateCalendarOpen(true)}>
                {t('calendar.createFirstCalendar')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        event={selectedEvent}
        initialDate={initialDate}
        calendarId={selectedCalendarId}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />

      <CalendarSyncManager
        open={syncManagerOpen}
        onOpenChange={setSyncManagerOpen}
      />

      <Dialog open={createCalendarOpen} onOpenChange={setCreateCalendarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Calendar</DialogTitle>
            <DialogDescription>
              Create a new personal calendar to organize your events.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calendar-name">Name</Label>
              <Input
                id="calendar-name"
                value={newCalendarName}
                onChange={(event) => setNewCalendarName(event.target.value)}
                placeholder="e.g., Team Calendar"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-description">Description</Label>
              <Input
                id="calendar-description"
                value={newCalendarDescription}
                onChange={(event) => setNewCalendarDescription(event.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-color">Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="calendar-color"
                  type="color"
                  value={newCalendarColor}
                  onChange={(event) => setNewCalendarColor(event.target.value)}
                  className="h-10 w-16 p-1"
                />
                <Input
                  value={newCalendarColor}
                  onChange={(event) => setNewCalendarColor(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-timezone">Timezone</Label>
              <Input
                id="calendar-timezone"
                value={newCalendarTimezone}
                onChange={(event) => setNewCalendarTimezone(event.target.value)}
                placeholder="America/New_York"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCalendarOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCalendar} disabled={!newCalendarName.trim() || isCreatingCalendar}>
              {isCreatingCalendar ? 'Creating...' : 'Create Calendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

