/**
 * Scheduled Report Form Component
 * 
 * Create and edit scheduled reports
 * 
 * Part of: Phase 2.4 - Scheduled Reports System
 */

"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface ScheduledReportFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schedule?: any;
  onClose: () => void;
  onSubmit: () => void;
}

export function ScheduledReportForm({
  schedule,
  onClose,
  onSubmit,
}: ScheduledReportFormProps) {
  const _t = useTranslations();
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reports, setReports] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    reportId: schedule?.reportId || '',
    scheduleType: schedule?.scheduleType || 'daily',
    deliveryMethod: schedule?.deliveryMethod || 'email',
    exportFormat: schedule?.exportFormat || 'pdf',
    recipients: schedule?.recipients?.join(', ') || '',
    time: schedule?.scheduleConfig?.time || '09:00',
    dayOfWeek: schedule?.scheduleConfig?.dayOfWeek?.toString() || '1',
    dayOfMonth: schedule?.scheduleConfig?.dayOfMonth?.toString() || '1',
    isActive: schedule?.isActive ?? true,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      setReports(data.reports || []);
    } catch (_error) {
toast.error('Failed to load reports');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate recipients
      const recipients = formData.recipients
        .split(',')
        .map((r: string) => r.trim())
        .filter((r: string) => r);

      if (recipients.length === 0) {
        toast.error('Please enter at least one recipient');
        return;
      }

      // Build schedule config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scheduleConfig: any = {
        time: formData.time,
      };

      if (formData.scheduleType === 'weekly') {
        scheduleConfig.dayOfWeek = parseInt(formData.dayOfWeek);
      }

      if (formData.scheduleType === 'monthly') {
        scheduleConfig.dayOfMonth = parseInt(formData.dayOfMonth);
      }

      const payload = {
        reportId: formData.reportId,
        scheduleType: formData.scheduleType,
        scheduleConfig,
        deliveryMethod: formData.deliveryMethod,
        recipients,
        exportFormat: formData.exportFormat,
        isActive: formData.isActive,
      };

      const url = schedule
        ? `/api/reports/scheduled/${schedule.id}`
        : '/api/reports/scheduled';

      const method = schedule ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save schedule');
      }

      toast.success(schedule ? 'Schedule updated' : 'Schedule created');
      onSubmit();
    } catch (error) {
toast.error(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {schedule ? 'Edit Schedule' : 'Create Schedule'}
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure automated report delivery
          </p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Report Selection */}
          <div className="space-y-2">
            <Label htmlFor="reportId">Report *</Label>
            <Select
              value={formData.reportId}
              onValueChange={(value) =>
                setFormData({ ...formData, reportId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a report" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((report) => (
                  <SelectItem key={report.id} value={report.id}>
                    {report.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Schedule Type */}
          <div className="space-y-2">
            <Label htmlFor="scheduleType">Schedule Type *</Label>
            <Select
              value={formData.scheduleType}
              onValueChange={(value) =>
                setFormData({ ...formData, scheduleType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="time">Time *</Label>
            <Input
              id="time"
              type="time"
              value={formData.time}
              onChange={(e) =>
                setFormData({ ...formData, time: e.target.value })
              }
              required
            />
          </div>

          {/* Day of Week (for weekly) */}
          {formData.scheduleType === 'weekly' && (
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Day of Week *</Label>
              <Select
                value={formData.dayOfWeek}
                onValueChange={(value) =>
                  setFormData({ ...formData, dayOfWeek: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of Month (for monthly) */}
          {formData.scheduleType === 'monthly' && (
            <div className="space-y-2">
              <Label htmlFor="dayOfMonth">Day of Month *</Label>
              <Select
                value={formData.dayOfMonth}
                onValueChange={(value) =>
                  setFormData({ ...formData, dayOfMonth: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Delivery Method */}
          <div className="space-y-2">
            <Label htmlFor="deliveryMethod">Delivery Method *</Label>
            <Select
              value={formData.deliveryMethod}
              onValueChange={(value) =>
                setFormData({ ...formData, deliveryMethod: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Format */}
          <div className="space-y-2">
            <Label htmlFor="exportFormat">Export Format *</Label>
            <Select
              value={formData.exportFormat}
              onValueChange={(value) =>
                setFormData({ ...formData, exportFormat: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label htmlFor="recipients">
              Recipients * (comma-separated emails)
            </Label>
            <Input
              id="recipients"
              type="text"
              placeholder="user1@example.com, user2@example.com"
              value={formData.recipients}
              onChange={(e) =>
                setFormData({ ...formData, recipients: e.target.value })
              }
              required
            />
            <p className="text-sm text-muted-foreground">
              Enter email addresses separated by commas
            </p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="h-4 w-4"
            />
            <Label htmlFor="isActive">Active (schedule will run automatically)</Label>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {schedule ? 'Update Schedule' : 'Create Schedule'}
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

