'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Scale,
  Users,
  Calendar,
  MessageSquare,
  CheckCheck,
  Filter,
  Trash2,
  Settings,
  Info,
  TrendingUp,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type NotificationType =
  | 'case_update'
  | 'deadline'
  | 'grievance'
  | 'vote'
  | 'meeting'
  | 'system'
  | 'message'
  | 'achievement'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  readAt: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  data: Record<string, unknown> | null;
  expiresAt: string | null;
}

interface ApiResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function NotificationsConsole() {
  const t = useTranslations();
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const notificationTypeConfig: Record<
    string,
    { icon: React.ReactElement; color: string; label: string }
  > = {
    case_update: {
      icon: <FileText className="w-5 h-5" />,
      color: 'bg-blue-100 text-blue-700',
      label: t('notifications.types.caseUpdate'),
    },
    deadline: {
      icon: <Clock className="w-5 h-5" />,
      color: 'bg-red-100 text-red-700',
      label: t('notifications.types.deadline'),
    },
    grievance: {
      icon: <Scale className="w-5 h-5" />,
      color: 'bg-purple-100 text-purple-700',
      label: t('notifications.types.grievance'),
    },
    vote: {
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'bg-green-100 text-green-700',
      label: t('notifications.types.vote'),
    },
    meeting: {
      icon: <Calendar className="w-5 h-5" />,
      color: 'bg-orange-100 text-orange-700',
      label: t('notifications.types.meeting'),
    },
    system: {
      icon: <Settings className="w-5 h-5" />,
      color: 'bg-gray-100 text-gray-700',
      label: t('notifications.types.system'),
    },
    message: {
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'bg-indigo-100 text-indigo-700',
      label: t('notifications.types.message'),
    },
    achievement: {
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-emerald-100 text-emerald-700',
      label: t('notifications.types.achievement'),
    },
    info: {
      icon: <Info className="w-5 h-5" />,
      color: 'bg-blue-100 text-blue-700',
      label: 'Info',
    },
    success: {
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'bg-green-100 text-green-700',
      label: 'Success',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'bg-yellow-100 text-yellow-700',
      label: 'Warning',
    },
    error: {
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'bg-red-100 text-red-700',
      label: 'Error',
    },
  };

  const priorityConfig: Record<
    NotificationPriority,
    { color: string; label: string }
  > = {
    low: { color: 'bg-gray-100 text-gray-700', label: t('notifications.priority.low') },
    medium: { color: 'bg-blue-100 text-blue-700', label: t('notifications.priority.medium') },
    high: { color: 'bg-orange-100 text-orange-700', label: t('notifications.priority.high') },
    urgent: { color: 'bg-red-100 text-red-700', label: t('notifications.priority.urgent') },
  };

  const categories = [
    { id: 'all', label: t('common.all'), icon: <Bell className="w-4 h-4" /> },
    {
      id: 'case_update',
      label: t('notifications.categories.cases'),
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: 'grievance',
      label: t('notifications.categories.grievances'),
      icon: <Scale className="w-4 h-4" />,
    },
    {
      id: 'deadline',
      label: t('notifications.categories.deadlines'),
      icon: <Clock className="w-4 h-4" />,
    },
    { id: 'vote', label: t('notifications.categories.votes'), icon: <CheckCircle className="w-4 h-4" /> },
    {
      id: 'meeting',
      label: t('notifications.categories.meetings'),
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (showUnreadOnly) params.set('unreadOnly', 'true');
      if (selectedCategory !== 'all') params.set('type', selectedCategory);
      params.set('limit', '100');

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data: ApiResponse = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      setError('Unable to load notifications');
    } finally {
      setLoading(false);
    }
  }, [showUnreadOnly, selectedCategory]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = notifications;

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
    } catch {
      // Silently handle — optimistic update already applied
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    } catch {
      // Silently handle — optimistic update already applied
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id && !n.read);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch {
      // Silently handle — optimistic update already applied
    }
  }, [notifications]);

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const time = new Date(dateStr);
    const diffInMinutes = Math.floor(
      (now.getTime() - time.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return t('notifications.justNow');
    if (diffInMinutes < 60) return t('notifications.minutesAgo', { minutes: diffInMinutes });
    if (diffInMinutes < 1440) return t('notifications.hoursAgo', { hours: Math.floor(diffInMinutes / 60) });
    return t('notifications.daysAgo', { days: Math.floor(diffInMinutes / 1440) });
  };

  const getTypeConfig = (type: string) =>
    notificationTypeConfig[type] || notificationTypeConfig.info;

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto flex items-center justify-center min-h-100">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-600">{t('common.loading')}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <Card className="p-12 text-center bg-white/80 backdrop-blur-sm border-gray-200">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
            <button
              onClick={() => { setLoading(true); fetchNotifications(); }}
              className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.retry')}
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {t('notifications.title')}
              </h1>
              <p className="text-gray-600">
                {t('notifications.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  {t('notifications.markAllRead')}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="p-4 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('common.total')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {notifications.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bell className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('notifications.unread')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {unreadCount}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('notifications.urgent')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {
                      notifications.filter((n) => 
                        (n.data as Record<string, unknown>)?.priority === 'urgent'
                      ).length
                    }
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('notifications.today')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {
                      notifications.filter(
                        (n) =>
                          new Date(n.createdAt).toDateString() ===
                          new Date().toDateString()
                      ).length
                    }
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {category.icon}
                {category.label}
                {category.id !== 'all' && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      selectedCategory === category.id
                        ? 'bg-white/20'
                        : 'bg-gray-100'
                    }`}
                  >
                    {
                      notifications.filter((n) => n.type === category.id)
                        .length
                    }
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Unread Only Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                showUnreadOnly
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              {t('notifications.showUnreadOnly')}
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="p-12 text-center bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {t('notifications.allCaughtUp')}
                  </h2>
                  <p className="text-gray-600">
                    {showUnreadOnly
                      ? t('notifications.noUnread')
                      : t('notifications.noMatch')}
                  </p>
                  {(selectedCategory !== 'all' || showUnreadOnly) && (
                    <button
                      onClick={() => {
                        setSelectedCategory('all');
                        setShowUnreadOnly(false);
                      }}
                      className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      {t('notifications.clearFilters')}
                    </button>
                  )}
                </Card>
              </motion.div>
            ) : (
              filteredNotifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={`p-5 bg-white/80 backdrop-blur-sm border-gray-200 hover:shadow-lg transition-all cursor-pointer ${
                      !notification.read
                        ? 'border-l-4 border-l-blue-600'
                        : 'border-l-4 border-l-transparent'
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                          getTypeConfig(notification.type).color
                        }`}
                      >
                        {getTypeConfig(notification.type).icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className={`text-base font-semibold ${
                                  notification.read
                                    ? 'text-gray-700'
                                    : 'text-gray-900'
                                }`}
                              >
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                              )}
                            </div>
                            <p
                              className={`text-sm ${
                                notification.read
                                  ? 'text-gray-500'
                                  : 'text-gray-700'
                              }`}
                            >
                              {notification.message}
                            </p>
                          </div>

                          {/* Priority Badge */}
                          {notification.data && (
                            (notification.data as Record<string, unknown>).priority === 'high' ||
                            (notification.data as Record<string, unknown>).priority === 'urgent'
                          ) && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                priorityConfig[
                                  ((notification.data as Record<string, unknown>).priority as NotificationPriority) || 'low'
                                ]?.color || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {priorityConfig[
                                ((notification.data as Record<string, unknown>).priority as NotificationPriority) || 'low'
                              ]?.label || ''}
                            </span>
                          )}
                        </div>

                        {/* Metadata */}
                        {notification.data && (
                          <div className="flex flex-wrap gap-3 mb-3">
                            {(notification.data as Record<string, unknown>).caseNumber && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <FileText className="w-3 h-3" />
                                {(notification.data as Record<string, unknown>).caseNumber as string}
                              </div>
                            )}
                            {(notification.data as Record<string, unknown>).daysRemaining !==
                              undefined && (
                              <div
                                className={`flex items-center gap-1 text-xs ${
                                  ((notification.data as Record<string, unknown>).daysRemaining as number) <= 3
                                    ? 'text-red-600 font-medium'
                                    : 'text-gray-600'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {t('notifications.daysLeft', { days: (notification.data as Record<string, unknown>).daysRemaining as number })}
                              </div>
                            )}
                            {(notification.data as Record<string, unknown>).memberName && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Users className="w-3 h-3" />
                                {(notification.data as Record<string, unknown>).memberName as string}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {getTimeAgo(notification.createdAt)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                getTypeConfig(notification.type).color
                              }`}
                            >
                              {getTypeConfig(notification.type).label}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {notification.actionUrl && (
                              <Link
                                href={`${localePrefix}${notification.actionUrl}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                {notification.actionLabel || 'View'}
                              </Link>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Help Section */}
        <Card className="mt-8 p-6 bg-blue-50/80 backdrop-blur-sm border-blue-200">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Notification Settings
              </h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>
                  • <strong>Urgent</strong> notifications require immediate
                  action (deadlines, critical updates)
                </li>
                <li>
                  • <strong>High priority</strong> notifications should be
                  reviewed within 24 hours
                </li>
                <li>
                  • Click any notification to mark as read and view details
                </li>
                <li>
                  • Configure notification preferences in{' '}
                  <Link
                    href={`${localePrefix}/dashboard/settings`}
                    className="text-blue-600 hover:underline"
                  >
                    Settings
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
