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
import { useLocale, useTranslations } from 'next-intl';
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
import { ApiShapeError, envelopeRows, isRecord, readApiError } from '@/lib/client/api-envelope';
import {
  createEventBody,
  eventDetailFrom,
  updateEventBody,
  type CalendarEventDetail,
  type EventFormData,
} from '@/lib/calendar/event-form';

const COPY = {
  en: {
    calendarsLoadFailed: 'Calendars could not be loaded.',
    eventsLoadFailed: 'Events could not be loaded.',
    saveFailed: 'The event could not be saved.',
    deleteFailed: 'The event could not be deleted.',
    createCalendarFailed: 'The calendar could not be created.',
  },
  fr: {
    calendarsLoadFailed: 'Les calendriers n’ont pas pu être chargés.',
    eventsLoadFailed: 'Les événements n’ont pas pu être chargés.',
    saveFailed: 'L’événement n’a pas pu être enregistré.',
    deleteFailed: 'L’événement n’a pas pu être supprimé.',
    createCalendarFailed: 'Le calendrier n’a pas pu être créé.',
  },
} as const;

interface CalendarSummary {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  visibility: boolean;
}

/** The event shape the month, week and day views draw. */
interface CalendarEventRecord {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventType: string;
  status: string;
  location?: string;
  isAllDay: boolean;
  calendarId?: string;
}

const viewEventOf = (event: CalendarEventDetail): CalendarEventRecord => ({
  id: event.id,
  title: event.title,
  startTime: event.startTime,
  endTime: event.endTime,
  eventType: event.eventType ?? 'other',
  status: event.status,
  location: event.location ?? undefined,
  isAllDay: event.isAllDay,
  calendarId: event.calendarId || undefined,
});

/** A calendar row of GET /api/calendars. A calendar starts visible; the row does not carry that choice. */
function calendarSummaryFrom(row: unknown): CalendarSummary {
  if (!isRecord(row) || typeof row.id !== 'string' || typeof row.name !== 'string') throw new ApiShapeError('not a calendar');
  return {
    id: row.id,
    name: row.name,
    color: typeof row.color === 'string' ? row.color : '#3B82F6',
    isDefault: false,
    visibility: true,
  };
}

export default function CalendarPage() {
  const t = useTranslations();
  const copy = useLocale().toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [events, setEvents] = useState<CalendarEventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  // What failed to load, and what the server said about it (the page words the failure in the reader's language when it said nothing).
  const [loadError, setLoadError] = useState<{ source: 'calendars' | 'events'; serverMessage: string | null } | null>(null);

  // Dialog states
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [syncManagerOpen, setSyncManagerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetail | null>(null);
  const [initialDate, setInitialDate] = useState<Date | undefined>();
  const [createCalendarOpen, setCreateCalendarOpen] = useState(false);
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);
  const [createCalendarError, setCreateCalendarError] = useState<string | null>(null);
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
    let serverMessage: string | null = null;
    try {
      const response = await fetch('/api/calendars');
      if (!response.ok) {
        serverMessage = (await readApiError(response, '')) || null;
        throw new Error('Calendars were refused');
      }
      const rows = envelopeRows(await response.json()).map(calendarSummaryFrom);

      setCalendars(rows);
      setLoadError(null);

      // Select first calendar by default
      if (rows.length > 0) {
        setSelectedCalendarId(rows[0].id);
      }
    } catch (_error) {
      setLoadError({ source: 'calendars', serverMessage });
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async (calendarId: string) => {
    let serverMessage: string | null = null;
    try {
      const response = await fetch(`/api/calendars/${calendarId}/events`);
      if (!response.ok) {
        serverMessage = (await readApiError(response, '')) || null;
        throw new Error('Events were refused');
      }
      const rows = envelopeRows(await response.json()).map((row) => {
        if (!isRecord(row)) throw new ApiShapeError('not an event');
        return eventDetailFrom(row);
      });

      setEvents(rows);
      setLoadError(null);
    } catch (_error) {
      // The events on screen belong to the calendar that was selected before, so they are not left standing under this one.
      setEvents([]);
      setLoadError({ source: 'events', serverMessage });
    }
  };

  const handleCreateEvent = (date?: Date) => {
    setSelectedEvent(null);
    setInitialDate(date);
    setEventDialogOpen(true);
  };

  const handleEditEvent = (event: CalendarEventRecord) => {
    const stored = events.find((candidate) => candidate.id === event.id);
    if (!stored) return;
    setSelectedEvent(stored);
    setInitialDate(undefined);
    setEventDialogOpen(true);
  };

  /** The error a failed event request becomes: what the server said, or the fallback. */
  const failureOf = async (response: Response, fallback: string) => new Error(await readApiError(response, fallback));

  const handleSaveEvent = async (form: EventFormData) => {
    if (selectedEvent) {
      const changes = updateEventBody(form, selectedEvent);
      // Nothing was changed, so there is nothing to save.
      if (changes === null) return;
      const response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw await failureOf(response, copy.saveFailed);
    } else {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createEventBody(form, selectedCalendarId)),
      });
      if (!response.ok) throw await failureOf(response, copy.saveFailed);
    }

    // Refresh events
    await fetchEvents(selectedCalendarId);
  };

  const handleDeleteEvent = async (eventId: string) => {
    const response = await fetch(`/api/calendar/events/${eventId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw await failureOf(response, copy.deleteFailed);

    // Refresh events
    await fetchEvents(selectedCalendarId);
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
    setCreateCalendarError(null);

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

      if (!response.ok) throw await failureOf(response, copy.createCalendarFailed);

      const json: unknown = await response.json();
      await fetchCalendars();

      const createdId = isRecord(json) && isRecord(json.data) && isRecord(json.data.data) ? json.data.data.id : undefined;
      if (typeof createdId === 'string') {
        setSelectedCalendarId(createdId);
      }

      setCreateCalendarOpen(false);
      setNewCalendarName('');
      setNewCalendarDescription('');
    } catch (error) {
      // The dialog stays open with what was typed, and says why (the server's own message when it gave one: a member may not create a calendar).
      setCreateCalendarError(error instanceof Error && error.message ? error.message : copy.createCalendarFailed);
    } finally {
      setIsCreatingCalendar(false);
    }
  };

  // Filter visible events
  const visibleEvents = events
    .filter(event => {
      const calendar = calendars.find(cal => cal.id === event.calendarId);
      return calendar?.visibility !== false;
    })
    .map(viewEventOf);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">{t('calendar.loadingCalendars')}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <CalendarSidebar
        calendars={calendars}
        selectedCalendarId={selectedCalendarId}
        onSelectCalendar={setSelectedCalendarId}
        onToggleVisibility={handleToggleCalendarVisibility}
        onCreateCalendar={() => {
          setCreateCalendarError(null);
          setCreateCalendarOpen(true);
        }}
        onManageSync={() => setSyncManagerOpen(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b p-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('calendar.title')}</h1>
          <div className="flex space-x-2">
            <Button onClick={() => handleCreateEvent()} disabled={!selectedCalendarId}>
              <Plus className="h-4 w-4 mr-2" />
              {t('calendar.newEvent')}
            </Button>
            <Button variant="outline" onClick={() => setSyncManagerOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              {t('calendar.syncSettings')}
            </Button>
          </div>
        </div>

        {loadError && (
          <p role="alert" className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
            {loadError.serverMessage ?? (loadError.source === 'calendars' ? copy.calendarsLoadFailed : copy.eventsLoadFailed)}
          </p>
        )}

        {/* Calendar View */}
        {selectedCalendarId ? (
          <CalendarView
            calendarId={selectedCalendarId}
            events={visibleEvents}
            onEventClick={handleEditEvent}
            onCreateEvent={handleCreateEvent}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="mb-4">{t('calendar.noCalendarSelected')}</p>
              <Button onClick={() => {
                setCreateCalendarError(null);
                setCreateCalendarOpen(true);
              }}>
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

          {createCalendarError && (
            <p role="alert" className="text-sm text-destructive">{createCalendarError}</p>
          )}

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

