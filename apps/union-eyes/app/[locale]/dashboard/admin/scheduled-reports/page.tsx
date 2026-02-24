/**
 * Scheduled Reports Admin Page
 * 
 * Manage automated report schedules
 * 
 * Part of: Phase 2.4 - Scheduled Reports System
 */

"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Clock,
  Mail,
  Calendar,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ScheduledReportForm } from '@/components/admin/ScheduledReportForm';

interface ScheduledReport {
  id: string;
  reportId: string;
  report_name: string;
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  deliveryMethod: 'email' | 'dashboard' | 'storage' | 'webhook';
  recipients: string[];
  exportFormat: 'pdf' | 'excel' | 'csv' | 'json';
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | 'pending' | null;
  runCount: number;
  failureCount: number;
  createdAt: string;
}

export default function ScheduledReportsPage() {
  const _t = useTranslations();
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === 'active') params.set('isActive', 'true');
      if (filter === 'inactive') params.set('isActive', 'false');

      const response = await fetch(`/api/reports/scheduled?${params}`);
      if (!response.ok) throw new Error('Failed to fetch schedules');

      const data = await response.json();
      setSchedules(data.schedules || []);
    } catch (_error) {
toast.error('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleToggleActive = async (schedule: ScheduledReport) => {
    try {
      const response = await fetch(`/api/reports/scheduled/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: schedule.isActive ? 'pause' : 'resume',
        }),
      });

      if (!response.ok) throw new Error('Failed to update schedule');

      toast.success(schedule.isActive ? 'Schedule paused' : 'Schedule resumed');
      fetchSchedules();
    } catch (_error) {
toast.error('Failed to update schedule');
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const response = await fetch(`/api/reports/scheduled/${scheduleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete schedule');

      toast.success('Schedule deleted');
      fetchSchedules();
    } catch (_error) {
toast.error('Failed to delete schedule');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingSchedule(null);
    fetchSchedules();
  };

  const getScheduleTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const filteredSchedules = schedules.filter(schedule => {
    if (filter === 'active') return schedule.isActive;
    if (filter === 'inactive') return !schedule.isActive;
    return true;
  });

  if (showForm) {
    return (
      <ScheduledReportForm
        schedule={editingSchedule}
        onClose={() => {
          setShowForm(false);
          setEditingSchedule(null);
        }}
        onSubmit={handleFormSubmit}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Reports</h1>
          <p className="text-muted-foreground mt-2">
            Automate report generation and delivery
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Schedule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Schedules</p>
              <p className="text-2xl font-bold">{schedules.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">
                {schedules.filter(s => s.isActive).length}
              </p>
            </div>
            <Play className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Runs</p>
              <p className="text-2xl font-bold">
                {schedules.reduce((sum, s) => sum + s.runCount, 0)}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold">
                {schedules.reduce((sum, s) => sum + s.failureCount, 0)}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('active')}
        >
          Active
        </Button>
        <Button
          variant={filter === 'inactive' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('inactive')}
        >
          Inactive
        </Button>
      </div>

      {/* Schedules List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled reports</h3>
            <p className="text-muted-foreground mb-4">
              Create your first scheduled report to automate report generation
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSchedules.map((schedule) => (
            <motion.div
              key={schedule.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {schedule.report_name}
                      </h3>
                      <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                        {schedule.isActive ? 'Active' : 'Paused'}
                      </Badge>
                      <Badge variant="outline">
                        {getScheduleTypeLabel(schedule.scheduleType)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Next Run</p>
                        <p className="text-sm font-medium flex items-center gap-2 mt-1">
                          <Clock className="h-4 w-4" />
                          {formatDate(schedule.nextRunAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Last Run</p>
                        <p className="text-sm font-medium flex items-center gap-2 mt-1">
                          {getStatusIcon(schedule.lastRunStatus)}
                          {formatDate(schedule.lastRunAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Delivery</p>
                        <p className="text-sm font-medium flex items-center gap-2 mt-1">
                          <Mail className="h-4 w-4" />
                          {schedule.deliveryMethod}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Format</p>
                        <p className="text-sm font-medium flex items-center gap-2 mt-1">
                          <Download className="h-4 w-4" />
                          {schedule.exportFormat.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                      <span>Recipients: {schedule.recipients.length}</span>
                      <span>Total Runs: {schedule.runCount}</span>
                      {schedule.failureCount > 0 && (
                        <span className="text-red-600">
                          Failures: {schedule.failureCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(schedule)}
                    >
                      {schedule.isActive ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Resume
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSchedule(schedule);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
