/**
 * Event Dialog Component
 * 
 * Modal dialog for creating and editing calendar events.
 * Includes form fields for title, dates, location, recurrence, etc.
 * 
 * @module components/calendar/EventDialog
 */

'use client';

import React, { useState, useEffect } from 'react';
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
 
import { Calendar, Clock, MapPin, Users, Video, Repeat } from 'lucide-react';

interface EventFormData {
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrenceRule: string;
  eventType: string;
  attendees: string[];
  meetingUrl: string;
  roomId: string;
  reminders: Array<{ type: string; minutes: number }>;
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event?: any;
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
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    location: '',
    startTime: '',
    endTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isAllDay: false,
    isRecurring: false,
    recurrenceRule: '',
    eventType: 'meeting',
    attendees: [],
    meetingUrl: '',
    roomId: '',
    reminders: [{ type: 'notification', minutes: 15 }],
  });

  const [loading, setLoading] = useState(false);
  const [attendeeInput, setAttendeeInput] = useState('');

  useEffect(() => {
    if (event) {
      // Edit mode - populate form with event data
      setFormData({
        title: event.title || '',
        description: event.description || '',
        location: event.location || '',
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        timezone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        isAllDay: event.isAllDay || false,
        isRecurring: event.isRecurring || false,
        recurrenceRule: event.recurrenceRule || '',
        eventType: event.eventType || 'meeting',
        attendees: event.attendees || [],
        meetingUrl: event.meetingUrl || '',
        roomId: event.roomId || '',
        reminders: event.reminders || [{ type: 'notification', minutes: 15 }],
      });
    } else if (initialDate) {
      // Create mode with initial date
      const start = new Date(initialDate);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      setFormData(prev => ({
        ...prev,
        startTime: start.toISOString().slice(0, 16),
        endTime: end.toISOString().slice(0, 16),
      }));
    }
  }, [event, initialDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (_error) {
alert('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;

    if (confirm('Are you sure you want to delete this event?')) {
      setLoading(true);
      try {
        await onDelete(event.id);
        onOpenChange(false);
      } catch (_error) {
alert('Failed to delete event');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddAttendee = () => {
    if (attendeeInput && !formData.attendees.includes(attendeeInput)) {
      setFormData(prev => ({
        ...prev,
        attendees: [...prev.attendees, attendeeInput],
      }));
      setAttendeeInput('');
    }
  };

  const handleRemoveAttendee = (email: string) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.filter(a => a !== email),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Create Event'}</DialogTitle>
          <DialogDescription>
            {event ? 'Update event details' : 'Add a new event to your calendar'}
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

          {/* All Day & Event Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isAllDay"
                checked={formData.isAllDay}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAllDay: checked }))}
              />
              <Label htmlFor="isAllDay">All-day event</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type</Label>
              <Select
                value={formData.eventType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, eventType: value }))}
              >
                <SelectTrigger>
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

          {/* Attendees */}
          <div className="space-y-2">
            <Label htmlFor="attendees">Attendees</Label>
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Input
                id="attendees"
                type="email"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAttendee())}
                placeholder="Add attendee email"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddAttendee}>
                Add
              </Button>
            </div>
            {formData.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.attendees.map(email => (
                  <div
                    key={email}
                    className="px-2 py-1 bg-secondary rounded-md text-sm flex items-center space-x-2"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(email)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Ã—
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recurring */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: checked }))}
              />
              <Label htmlFor="isRecurring" className="flex items-center space-x-2">
                <Repeat className="h-4 w-4" />
                <span>Recurring event</span>
              </Label>
            </div>
            {formData.isRecurring && (
              <Input
                value={formData.recurrenceRule}
                onChange={(e) => setFormData(prev => ({ ...prev, recurrenceRule: e.target.value }))}
                placeholder="RRULE (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR)"
              />
            )}
          </div>

          <DialogFooter>
            {event && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : event ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

