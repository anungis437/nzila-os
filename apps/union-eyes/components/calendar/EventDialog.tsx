/**
 * Event Dialog Component
 *
 * Modal dialog for creating and editing calendar events. A new event takes a title, times, all-day, type, description, location and a
 * meeting link. An existing event takes a title, times, description and location: those are the only fields PATCH /api/calendar/events/[id]
 * accepts, so nothing is shown that an edit could not save. Attendees and recurrence are not offered: no route stores attendees
 * (event_attendees has no runtime authority) and nothing expands a recurrence rule into occurrences (/api/events/[id]/occurrences answers 501).
 *
 * @module components/calendar/EventDialog
 */

'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, MapPin, Video } from 'lucide-react';
import {
  EventFormError,
  blankEventForm,
  formFromEvent,
  withAllDay,
  type CalendarEventDetail,
  type EventFormData,
} from '@/lib/calendar/event-form';

const COPY = {
  en: {
    saveFailed: 'The event could not be saved.',
    deleteFailed: 'The event could not be deleted.',
    confirmDelete: 'Are you sure you want to delete this event?',
    problems: {
      calendar: 'Choose a calendar first.',
      title: 'Enter a title.',
      start: 'Enter a valid start.',
      end: 'Enter a valid end.',
      range: 'The end must be after the start.',
    },
  },
  fr: {
    saveFailed: 'L’événement n’a pas pu être enregistré.',
    deleteFailed: 'L’événement n’a pas pu être supprimé.',
    confirmDelete: 'Voulez-vous vraiment supprimer cet événement?',
    problems: {
      calendar: 'Choisissez d’abord un calendrier.',
      title: 'Saisissez un titre.',
      start: 'Saisissez un début valide.',
      end: 'Saisissez une fin valide.',
      range: 'La fin doit être postérieure au début.',
    },
  },
} as const;

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEventDetail | null;
  initialDate?: Date;
  calendarId: string;
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  initialDate,
  calendarId: _calendarId,
  onSave,
  onDelete,
}: EventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* The form mounts each time the dialog opens, so it always starts from the event or the clicked day, never from the last one. */}
        <EventDialogForm
          event={event ?? null}
          initialDate={initialDate}
          onSave={onSave}
          onDelete={onDelete}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface EventDialogFormProps {
  event: CalendarEventDetail | null;
  initialDate?: Date;
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  onClose: () => void;
}

function EventDialogForm({ event, initialDate, onSave, onDelete, onClose }: EventDialogFormProps) {
  const copy = useLocale().toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;
  const [formData, setFormData] = useState<EventFormData>(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return event ? formFromEvent(event, timezone) : blankEventForm(timezone, initialDate);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = event !== null;

  const messageOf = (failure: unknown, fallback: string): string => {
    if (failure instanceof EventFormError) return copy.problems[failure.problem];
    return failure instanceof Error && failure.message ? failure.message : fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (failure) {
      setError(messageOf(failure, copy.saveFailed));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    if (!window.confirm(copy.confirmDelete)) return;
    setError(null);
    setLoading(true);
    try {
      await onDelete(event.id);
      onClose();
    } catch (failure) {
      setError(messageOf(failure, copy.deleteFailed));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Event' : 'Create Event'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update event details' : 'Add a new event to your calendar'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Event title"
            required
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Start {!formData.isAllDay && 'Time'} *</Label>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                id="startTime"
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endTime">End {!formData.isAllDay && 'Time'} *</Label>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                id="endTime"
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={formData.endTime}
                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                required
              />
            </div>
          </div>
        </div>

        {/* All Day & Event Type: chosen when the event is made, not changeable by an edit */}
        {!isEdit && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isAllDay"
                checked={formData.isAllDay}
                onCheckedChange={(checked) => setFormData(prev => withAllDay(prev, checked))}
              />
              <Label htmlFor="isAllDay">All-day event</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type</Label>
              <Select
                value={formData.eventType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, eventType: value }))}
              >
                <SelectTrigger id="eventType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="hearing">Hearing</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Event description..."
            rows={3}
          />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Add location"
            />
          </div>
        </div>

        {/* Meeting URL */}
        {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="meetingUrl">Meeting URL</Label>
            <div className="flex items-center space-x-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <Input
                id="meetingUrl"
                type="url"
                value={formData.meetingUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, meetingUrl: e.target.value }))}
                placeholder="https://meet.example.com/..."
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          {isEdit && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
