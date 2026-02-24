/**
 * DeadlineAlertList Component
 * 
 * In-app notification list for deadline alerts
 * - Unread alerts sorted by severity and time
 * - Mark as read/acknowledged
 * - Quick action to view related claim
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
type AlertType = 'deadline_approaching' | 'deadline_overdue' | 'extension_request' | 'extension_approved' | 'extension_denied';

interface DeadlineAlert {
  id: string;
  memberId: string;
  deadlineId?: string;
  claimNumber?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  subject: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

interface DeadlineAlertListProps {
  alerts: DeadlineAlert[];
  loading?: boolean;
  onAcknowledge: (alertId: string) => void;
  onTakeAction: (alertId: string, action: string) => void;
}

export function DeadlineAlertList({
  alerts,
  loading = false,
  onAcknowledge,
  onTakeAction,
}: DeadlineAlertListProps) {
  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
      case 'info':
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-600" />;
    }
  };

  const getSeverityBgColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 hover:bg-red-100';
      case 'error':
        return 'bg-red-50 border-red-200 hover:bg-red-100';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const unreadAlerts = alerts.filter(alert => !alert.isRead);
  const sortedAlerts = [...unreadAlerts].sort((a, b) => {
    // Sort by severity first (critical > error > warning > info)
    const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    
    // Then by time (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            Deadline Alerts
          </h3>
          {sortedAlerts.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-0.5 text-sm font-medium text-red-800">
              {sortedAlerts.length} unread
            </span>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-gray-200">
        {sortedAlerts.length === 0 ? (
          // Empty State
          <div className="text-center py-12 px-6">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm font-medium text-gray-900">All caught up!</p>
            <p className="text-sm text-gray-500 mt-1">
              You have no unread deadline alerts
            </p>
          </div>
        ) : (
          // Alerts
          sortedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 transition-all ${getSeverityBgColor(alert.severity)}`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="shrink-0 pt-0.5">
                  {getSeverityIcon(alert.severity)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Subject */}
                  <p className="text-sm font-medium text-gray-900">
                    {alert.subject}
                  </p>

                  {/* Message */}
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                    {alert.message}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </span>
                    {alert.claimNumber && (
                      <span>
                        Claim {alert.claimNumber}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : alert.severity === 'error'
                          ? 'bg-red-100 text-red-800'
                          : alert.severity === 'warning'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {alert.actionUrl && (
                      <button
                        onClick={() => onTakeAction(alert.id, alert.actionUrl!)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-900"
                      >
                        View Claim
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Dismiss Button */}
                <div className="shrink-0">
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Dismiss"
                  >
                    <span className="sr-only">Dismiss</span>
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer - Mark All as Read */}
      {sortedAlerts.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => sortedAlerts.forEach(alert => onAcknowledge(alert.id))}
            className="w-full text-center text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Badge Component for Navbar
 * Shows unread count in navbar
 */
export function DeadlineAlertBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  );
}

