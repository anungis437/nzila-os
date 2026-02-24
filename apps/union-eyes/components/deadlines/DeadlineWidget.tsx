/**
 * DeadlineWidget Component
 * 
 * Dashboard widget showing deadline summary and critical items
 * - Overall statistics (overdue, due today, due soon)
 * - List of next 5 critical deadlines
 * - Quick actions
 */

import React from 'react';
import { format } from 'date-fns';
import { 
  ClockIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon 
} from '@heroicons/react/24/outline';

interface DeadlineSummary {
  activeDeadlines: number;
  overdueCount: number;
  dueSoonCount: number;
  criticalCount: number;
  avgDaysOverdue: number;
  onTimePercentage: number;
}

interface CriticalDeadline {
  id: string;
  deadlineName: string;
  claimNumber?: string;
  currentDeadline: string;
  isOverdue: boolean;
  daysUntilDue?: number;
  daysOverdue: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface DeadlineWidgetProps {
  summary: DeadlineSummary;
  criticalDeadlines: CriticalDeadline[];
  loading?: boolean;
  onViewAll?: () => void;
}

export function DeadlineWidget({
  summary,
  criticalDeadlines,
  loading = false,
  onViewAll,
}: DeadlineWidgetProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (deadline: CriticalDeadline) => {
    if (deadline.isOverdue) return 'text-gray-900 bg-gray-900';
    if ((deadline.daysUntilDue || 0) === 0) return 'text-red-600 bg-red-600';
    if ((deadline.daysUntilDue || 0) <= 1) return 'text-red-600 bg-red-600';
    if ((deadline.daysUntilDue || 0) <= 3) return 'text-yellow-600 bg-yellow-600';
    return 'text-green-600 bg-green-600';
  };

  const getStatusLabel = (deadline: CriticalDeadline) => {
    if (deadline.isOverdue) return `${deadline.daysOverdue}d overdue`;
    if ((deadline.daysUntilDue || 0) === 0) return 'Due today';
    if ((deadline.daysUntilDue || 0) === 1) return 'Due tomorrow';
    return `${deadline.daysUntilDue}d remaining`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            Deadlines
          </h3>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-sm font-medium text-blue-600 hover:text-blue-900 flex items-center gap-1"
            >
              View All
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 p-6 border-b border-gray-200">
        {/* Overdue */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <XCircleIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {summary.overdueCount}
              </p>
              <p className="text-sm text-gray-600">Overdue</p>
            </div>
          </div>
        </div>

        {/* Due Today */}
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-900">
                {summary.dueSoonCount}
              </p>
              <p className="text-sm text-red-600">Due Soon</p>
            </div>
          </div>
        </div>

        {/* Critical */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-900">
                {summary.criticalCount}
              </p>
              <p className="text-sm text-orange-600">Critical Priority</p>
            </div>
          </div>
        </div>

        {/* On Time % */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-900">
                {summary.onTimePercentage}%
              </p>
              <p className="text-sm text-green-600">On Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Deadlines List */}
      <div className="p-6">
        <h4 className="text-sm font-medium text-gray-900 mb-4">
          Critical Deadlines (Next 5)
        </h4>

        {criticalDeadlines.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm font-medium text-gray-900">All caught up!</p>
            <p className="text-sm text-gray-500 mt-1">
              No critical deadlines at this time
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {criticalDeadlines.slice(0, 5).map((deadline) => (
              <div
                key={deadline.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {/* Status Indicator */}
                <div className="shrink-0 pt-1">
                  <div
                    className={`w-3 h-3 rounded-full ${getStatusColor(deadline).split(' ')[1]}`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {deadline.deadlineName}
                      </p>
                      {deadline.claimNumber && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Claim {deadline.claimNumber}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium ${getStatusColor(deadline).split(' ')[0]}`}
                    >
                      {getStatusLabel(deadline)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {format(new Date(deadline.currentDeadline), 'MMM dd')}
                    </span>
                    {deadline.priority && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          deadline.priority === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : deadline.priority === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : deadline.priority === 'medium'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {deadline.priority}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View All Link */}
        {criticalDeadlines.length > 5 && (
          <div className="mt-4 text-center">
            <button
              onClick={onViewAll}
              className="text-sm font-medium text-blue-600 hover:text-blue-900"
            >
              View {criticalDeadlines.length - 5} more deadlines →
            </button>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {summary.avgDaysOverdue > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            Average overdue time: <span className="font-medium text-gray-900">{summary.avgDaysOverdue.toFixed(1)} days</span>
          </p>
        </div>
      )}
    </div>
  );
}

