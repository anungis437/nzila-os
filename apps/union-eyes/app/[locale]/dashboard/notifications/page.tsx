"use client";


export const dynamic = 'force-dynamic';
import React from 'react';
import Link from 'next/link';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from 'next-intl';
import { Card } from "@/components/ui/card";
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
} from "lucide-react";

type NotificationType =
  | "case_update"
  | "deadline"
  | "grievance"
  | "vote"
  | "meeting"
  | "system"
  | "message"
  | "achievement";

type NotificationPriority = "low" | "medium" | "high" | "urgent";

interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: {
    caseNumber?: string;
    daysRemaining?: number;
    memberName?: string;
    voteTopic?: string;
  };
}

export default function NotificationsPage() {
  const t = useTranslations();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "notif-1",
      type: "deadline",
      priority: "urgent",
      title: "Grievance Deadline Approaching",
      message:
        "GRV-2025-001 (Unjust Termination) requires response within 3 days. Step 2 meeting scheduled for Nov 16.",
      timestamp: "2025-11-13T09:30:00",
      read: false,
      actionUrl: "/dashboard/grievances",
      actionLabel: "View Grievance",
      metadata: {
        caseNumber: "GRV-2025-001",
        daysRemaining: 3,
      },
    },
    {
      id: "notif-2",
      type: "case_update",
      priority: "high",
      title: "Case Status Update",
      message:
        "Case #2024-0156 has been updated to 'Under Review'. LRO Sarah Johnson added new documentation.",
      timestamp: "2025-11-13T08:15:00",
      read: false,
      actionUrl: "/dashboard/claims",
      actionLabel: "View Case",
      metadata: {
        caseNumber: "2024-0156",
      },
    },
    {
      id: "notif-3",
      type: "vote",
      priority: "high",
      title: "New Vote: Collective Agreement Ratification",
      message:
        "Your local is voting on the tentative collective agreement. Voting closes Nov 20, 2025.",
      timestamp: "2025-11-12T16:45:00",
      read: false,
      actionUrl: "/dashboard/voting",
      actionLabel: "Cast Your Vote",
      metadata: {
        voteTopic: "Collective Agreement Ratification",
      },
    },
    {
      id: "notif-4",
      type: "meeting",
      priority: "medium",
      title: "Upcoming Meeting Reminder",
      message:
        "Monthly membership meeting scheduled for Nov 15, 2025 at 6:00 PM. Location: Union Hall (Main Floor).",
      timestamp: "2025-11-12T14:20:00",
      read: false,
      actionUrl: "/dashboard",
      actionLabel: "Add to Calendar",
    },
    {
      id: "notif-5",
      type: "deadline",
      priority: "urgent",
      title: "Response Required: Unsafe Conditions Grievance",
      message:
        "GRV-2025-003 deadline in 5 days. Management response received. Review required.",
      timestamp: "2025-11-12T11:00:00",
      read: true,
      actionUrl: "/dashboard/grievances",
      actionLabel: "Review Response",
      metadata: {
        caseNumber: "GRV-2025-003",
        daysRemaining: 5,
      },
    },
    {
      id: "notif-6",
      type: "message",
      priority: "medium",
      title: "Message from Steward Mike Chen",
      message:
        "Question about overtime distribution in your department. Can we schedule a call?",
      timestamp: "2025-11-11T15:30:00",
      read: true,
      actionUrl: "/dashboard",
      actionLabel: "Reply",
      metadata: {
        memberName: "Mike Chen",
      },
    },
    {
      id: "notif-7",
      type: "achievement",
      priority: "low",
      title: "Case Resolution Milestone",
      message:
        "Congratulations! Your local has resolved 50 cases this quarter with 92% satisfaction rate.",
      timestamp: "2025-11-11T10:00:00",
      read: true,
    },
    {
      id: "notif-8",
      type: "system",
      priority: "low",
      title: "System Update Completed",
      message:
        "UnionEyes platform updated to v2.4.0 with improved analytics and new grievance tracking features.",
      timestamp: "2025-11-10T23:00:00",
      read: true,
      actionUrl: "/dashboard/settings",
      actionLabel: "View Release Notes",
    },
    {
      id: "notif-9",
      type: "case_update",
      priority: "medium",
      title: "Investigation Complete",
      message:
        "Case #2024-0142 investigation completed. Employer agreed to mediation. Next steps available.",
      timestamp: "2025-11-10T13:45:00",
      read: true,
      actionUrl: "/dashboard/claims",
      actionLabel: "View Details",
      metadata: {
        caseNumber: "2024-0142",
      },
    },
    {
      id: "notif-10",
      type: "grievance",
      priority: "high",
      title: "Arbitration Hearing Scheduled",
      message:
        "GRV-2024-089 arbitration hearing set for Dec 15, 2025. Witness prep meeting Nov 28.",
      timestamp: "2025-11-09T09:00:00",
      read: true,
      actionUrl: "/dashboard/grievances",
      actionLabel: "View Schedule",
      metadata: {
        caseNumber: "GRV-2024-089",
      },
    },
  ]);

  const notificationTypeConfig: Record<
    NotificationType,
    { icon: React.ReactElement; color: string; label: string }
  > = {
    case_update: {
      icon: <FileText className="w-5 h-5" />,
      color: "bg-blue-100 text-blue-700",
      label: t('notifications.types.caseUpdate'),
    },
    deadline: {
      icon: <Clock className="w-5 h-5" />,
      color: "bg-red-100 text-red-700",
      label: t('notifications.types.deadline'),
    },
    grievance: {
      icon: <Scale className="w-5 h-5" />,
      color: "bg-purple-100 text-purple-700",
      label: t('notifications.types.grievance'),
    },
    vote: {
      icon: <CheckCircle className="w-5 h-5" />,
      color: "bg-green-100 text-green-700",
      label: t('notifications.types.vote'),
    },
    meeting: {
      icon: <Calendar className="w-5 h-5" />,
      color: "bg-orange-100 text-orange-700",
      label: t('notifications.types.meeting'),
    },
    system: {
      icon: <Settings className="w-5 h-5" />,
      color: "bg-gray-100 text-gray-700",
      label: t('notifications.types.system'),
    },
    message: {
      icon: <MessageSquare className="w-5 h-5" />,
      color: "bg-indigo-100 text-indigo-700",
      label: t('notifications.types.message'),
    },
    achievement: {
      icon: <TrendingUp className="w-5 h-5" />,
      color: "bg-emerald-100 text-emerald-700",
      label: t('notifications.types.achievement'),
    },
  };

  const priorityConfig: Record<
    NotificationPriority,
    { color: string; label: string }
  > = {
    low: { color: "bg-gray-100 text-gray-700", label: t('notifications.priority.low') },
    medium: { color: "bg-blue-100 text-blue-700", label: t('notifications.priority.medium') },
    high: { color: "bg-orange-100 text-orange-700", label: t('notifications.priority.high') },
    urgent: { color: "bg-red-100 text-red-700", label: t('notifications.priority.urgent') },
  };

  const categories = [
    { id: "all", label: t('common.all'), icon: <Bell className="w-4 h-4" /> },
    {
      id: "case_update",
      label: t('notifications.categories.cases'),
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: "grievance",
      label: t('notifications.categories.grievances'),
      icon: <Scale className="w-4 h-4" />,
    },
    {
      id: "deadline",
      label: t('notifications.categories.deadlines'),
      icon: <Clock className="w-4 h-4" />,
    },
    { id: "vote", label: t('notifications.categories.votes'), icon: <CheckCircle className="w-4 h-4" /> },
    {
      id: "meeting",
      label: t('notifications.categories.meetings'),
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  const filteredNotifications = notifications.filter((notif) => {
    const categoryMatch =
      selectedCategory === "all" || notif.type === selectedCategory;
    const unreadMatch = !showUnreadOnly || !notif.read;
    return categoryMatch && unreadMatch;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor(
      (now.getTime() - time.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return t('notifications.justNow');
    if (diffInMinutes < 60) return t('notifications.minutesAgo', { minutes: diffInMinutes });
    if (diffInMinutes < 1440) return t('notifications.hoursAgo', { hours: Math.floor(diffInMinutes / 60) });
    return t('notifications.daysAgo', { days: Math.floor(diffInMinutes / 1440) });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
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
                      notifications.filter((n) => n.priority === "urgent")
                        .length
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
                          new Date(n.timestamp).toDateString() ===
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
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                {category.icon}
                {category.label}
                {category.id !== "all" && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      selectedCategory === category.id
                        ? "bg-white/20"
                        : "bg-gray-100"
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
                  ? "bg-orange-100 text-orange-700 border border-orange-200"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
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
                  {(selectedCategory !== "all" || showUnreadOnly) && (
                    <button
                      onClick={() => {
                        setSelectedCategory("all");
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
                        ? "border-l-4 border-l-blue-600"
                        : "border-l-4 border-l-transparent"
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                          notificationTypeConfig[notification.type].color
                        }`}
                      >
                        {notificationTypeConfig[notification.type].icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className={`text-base font-semibold ${
                                  notification.read
                                    ? "text-gray-700"
                                    : "text-gray-900"
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
                                  ? "text-gray-500"
                                  : "text-gray-700"
                              }`}
                            >
                              {notification.message}
                            </p>
                          </div>

                          {/* Priority Badge */}
                          {(notification.priority === "high" ||
                            notification.priority === "urgent") && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                priorityConfig[notification.priority].color
                              }`}
                            >
                              {priorityConfig[notification.priority].label}
                            </span>
                          )}
                        </div>

                        {/* Metadata */}
                        {notification.metadata && (
                          <div className="flex flex-wrap gap-3 mb-3">
                            {notification.metadata.caseNumber && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <FileText className="w-3 h-3" />
                                {notification.metadata.caseNumber}
                              </div>
                            )}
                            {notification.metadata.daysRemaining !==
                              undefined && (
                              <div
                                className={`flex items-center gap-1 text-xs ${
                                  notification.metadata.daysRemaining <= 3
                                    ? "text-red-600 font-medium"
                                    : "text-gray-600"
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {t('notifications.daysLeft', { days: notification.metadata.daysRemaining })}
                              </div>
                            )}
                            {notification.metadata.memberName && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Users className="w-3 h-3" />
                                {notification.metadata.memberName}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {getTimeAgo(notification.timestamp)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                notificationTypeConfig[notification.type].color
                              }`}
                            >
                              {
                                notificationTypeConfig[notification.type]
                                  .label
                              }
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {notification.actionUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Navigate to action URL
                                }}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                {notification.actionLabel || "View"}
                              </button>
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
                  • Configure notification preferences in{" "}
                  <Link href="/dashboard/settings"
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
