/**
 * Campaign Scheduler Component
 * 
 * Schedule newsletter campaigns with:
 * - Date and time selection
 * - Timezone support
 * - Immediate or scheduled sending
 * - Send test emails
 * - Preview before sending
 * 
 * Version: 1.0.0
 * Created: December 6, 2025
 */

'use client';

import { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Send,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CampaignSchedulerProps {
  campaignId: string;
  campaignName: string;
  recipientCount: number;
  onSchedule?: (scheduledAt: Date | null, timezone: string) => void;
  onSendTest?: (emails: string[]) => void;
}

export function CampaignScheduler({
  campaignId,
  campaignName,
  recipientCount,
  onSchedule,
  onSendTest,
}: CampaignSchedulerProps) {
  const { toast } = useToast();

  const [sendType, setSendType] = useState<'now' | 'scheduled'>('now');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [testEmails, setTestEmails] = useState('');
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Common timezones
  const commonTimezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'UTC', label: 'UTC' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  ];

  const getScheduledDateTime = (): Date | null => {
    if (sendType === 'now') {
      return null;
    }

    if (!selectedDate || !selectedTime) {
      return null;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const dateTime = new Date(selectedDate);
    dateTime.setHours(hours, minutes, 0, 0);

    return dateTime;
  };

  const handleSendTest = async () => {
    if (!testEmails.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter at least one email address',
        variant: 'destructive',
      });
      return;
    }

    const emails = testEmails
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e);

    try {
      const response = await fetch(
        `/api/communications/campaigns/${campaignId}/send-test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send test emails');
      }

      toast({
        title: 'Test Sent',
        description: `Test emails sent to ${emails.length} recipient(s)`,
      });

      if (onSendTest) {
        onSendTest(emails);
      }

      setTestDialogOpen(false);
      setTestEmails('');
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to send test emails',
        variant: 'destructive',
      });
    }
  };

  const handleScheduleCampaign = async () => {
    const scheduledAt = getScheduledDateTime();

    if (sendType === 'scheduled' && !scheduledAt) {
      toast({
        title: 'Validation Error',
        description: 'Please select a date and time',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSending(true);

      const response = await fetch(
        `/api/communications/campaigns/${campaignId}/schedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledAt: scheduledAt?.toISOString(),
            timezone,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to schedule campaign');
      }

      toast({
        title: 'Success',
        description:
          sendType === 'now'
            ? 'Campaign is being sent now'
            : 'Campaign scheduled successfully',
      });

      if (onSchedule) {
        onSchedule(scheduledAt, timezone);
      }

      setConfirmDialogOpen(false);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to schedule campaign',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const isValidSchedule = () => {
    if (sendType === 'now') {
      return true;
    }

    const scheduledAt = getScheduledDateTime();
    if (!scheduledAt) {
      return false;
    }

    // Check if scheduled time is in the future
    return scheduledAt.getTime() > Date.now();
  };

  const formatScheduledTime = () => {
    const scheduledAt = getScheduledDateTime();
    if (!scheduledAt) return '';

    return format(scheduledAt, 'PPp');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Campaign</CardTitle>
        <CardDescription>
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          Choose when to send "{campaignName}" to {recipientCount} recipient(s)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Send Type Selection */}
        <div className="space-y-3">
          <Label>When would you like to send?</Label>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <RadioGroup value={sendType} onValueChange={(v: any) => setSendType(v)}>
            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="now" id="send-now" />
              <Label
                htmlFor="send-now"
                className="flex-1 cursor-pointer flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <div>
                  <div className="font-semibold">Send Now</div>
                  <div className="text-sm text-gray-600">
                    Campaign will be sent immediately
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="scheduled" id="send-scheduled" />
              <Label
                htmlFor="send-scheduled"
                className="flex-1 cursor-pointer flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <div>
                  <div className="font-semibold">Schedule for Later</div>
                  <div className="text-sm text-gray-600">
                    Choose a specific date and time
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Scheduling Options */}
        {sendType === 'scheduled' && (
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Selection */}
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
              />
            </div>

            {/* Timezone Selection */}
            <div className="space-y-2">
              <Label>
                <Globe className="w-4 h-4 inline mr-2" />
                Timezone
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commonTimezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Summary */}
            {isValidSchedule() && selectedDate && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Campaign will be sent on:
                  </p>
                  <p className="text-sm text-blue-700">{formatScheduledTime()}</p>
                  <p className="text-xs text-blue-600 mt-1">{timezone}</p>
                </div>
              </div>
            )}

            {selectedDate && !isValidSchedule() && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    Invalid schedule time
                  </p>
                  <p className="text-sm text-red-700">
                    Please select a time in the future
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setTestDialogOpen(true)}
          >
            <Mail className="w-4 h-4 mr-2" />
            Send Test
          </Button>

          <Button
            className="flex-1"
            onClick={() => setConfirmDialogOpen(true)}
            disabled={!isValidSchedule()}
          >
            <Send className="w-4 h-4 mr-2" />
            {sendType === 'now' ? 'Send Now' : 'Schedule Campaign'}
          </Button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">Before sending:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Review your email content for accuracy</li>
              <li>Send a test email to verify formatting</li>
              <li>Confirm recipient list is correct</li>
              <li>Check that all links work properly</li>
            </ul>
          </div>
        </div>
      </CardContent>

      {/* Test Email Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Enter email addresses to receive a test version of your campaign
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="test-emails">Email Addresses</Label>
              <Input
                id="test-emails"
                type="text"
                placeholder="email1@example.com, email2@example.com"
                value={testEmails}
                onChange={(e) => setTestEmails(e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1">
                Separate multiple emails with commas
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendTest} disabled={!testEmails.trim()}>
              <Mail className="w-4 h-4 mr-2" />
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sendType === 'now' ? 'Send Campaign Now?' : 'Schedule Campaign?'}
            </DialogTitle>
            <DialogDescription>
              Please confirm the following details before proceeding
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-semibold">Campaign:</span>
                <span className="text-sm">{campaignName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">Recipients:</span>
                <span className="text-sm">{recipientCount}</span>
              </div>
              {sendType === 'scheduled' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">Send Time:</span>
                    <span className="text-sm">{formatScheduledTime()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">Timezone:</span>
                    <span className="text-sm">{timezone}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800">
                {sendType === 'now'
                  ? 'Your campaign will be sent immediately to all recipients.'
                  : 'Your campaign will be automatically sent at the scheduled time.'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={handleScheduleCampaign} disabled={sending}>
              {sending ? (
                'Processing...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {sendType === 'now' ? 'Send Now' : 'Schedule'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

