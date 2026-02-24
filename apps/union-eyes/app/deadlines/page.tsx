'use client';


export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DeadlinesList,
  DeadlineCalendar,
  ExtensionRequestDialog,
} from '@/components/deadlines';
import { ClockIcon, CalendarIcon, ListBulletIcon } from '@heroicons/react/24/outline';

interface Deadline {
  id: string;
  claimId: string;
  claimNumber?: string;
  deadlineName: string;
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

type ViewMode = 'list' | 'calendar';

export default function DeadlinesPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extension dialog state
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);

  // Fetch deadlines
  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/deadlines');
      if (!response.ok) throw new Error('Failed to fetch deadlines');
      const data = await response.json();
      setDeadlines(data.deadlines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deadlines');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDeadline = async (deadlineId: string) => {
    try {
      const response = await fetch(`/api/deadlines/${deadlineId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' }),
      });

      if (!response.ok) throw new Error('Failed to complete deadline');

      // Refresh deadlines
      await fetchDeadlines();
    } catch (_err) {
      alert('Failed to complete deadline. Please try again.');
    }
  };

  const handleExtendDeadline = (deadlineId: string) => {
    const deadline = deadlines.find(d => d.id === deadlineId);
    if (deadline) {
      setSelectedDeadline(deadline);
      setExtensionDialogOpen(true);
    }
  };

  const handleExtensionSubmit = async (data: { daysRequested: number; reason: string }) => {
    if (!selectedDeadline) return;

    try {
      const response = await fetch(`/api/deadlines/${selectedDeadline.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request extension');
      }

      // Refresh deadlines
      await fetchDeadlines();
    } catch (err) {
      throw err; // Let the dialog handle the error
    }
  };

  const handleViewClaim = (claimNumber: string) => {
    router.push(`/claims/${claimNumber}`);
  };

  const handleDateClick = (_date: Date) => {
};

  const handleDeadlineClick = (deadline: Deadline) => {
    if (deadline.claimNumber) {
      handleViewClaim(deadline.claimNumber);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <ClockIcon className="h-8 w-8 text-blue-600" />
                Deadline Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Track and manage claim deadlines across your organization
              </p>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ListBulletIcon className="h-4 w-4" />
                List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'calendar'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarIcon className="h-4 w-4" />
                Calendar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={fetchDeadlines}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {viewMode === 'list' ? (
          <DeadlinesList
            deadlines={deadlines}
            loading={loading}
            onComplete={handleCompleteDeadline}
            onExtend={handleExtendDeadline}
            onViewClaim={handleViewClaim}
          />
        ) : (
          <DeadlineCalendar
            deadlines={deadlines}
            loading={loading}
            onDateClick={handleDateClick}
            onDeadlineClick={handleDeadlineClick}
          />
        )}
      </div>

      {/* Extension Request Dialog */}
      {selectedDeadline && (
        <ExtensionRequestDialog
          deadline={selectedDeadline}
          maxExtensionDays={30}
          onSubmit={handleExtensionSubmit}
          onCancel={() => {
            setExtensionDialogOpen(false);
            setSelectedDeadline(null);
          }}
          open={extensionDialogOpen}
        />
      )}
    </div>
  );
}

