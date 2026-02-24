"use client";

export const dynamic = 'force-dynamic';

/**
 * Notifications Page
 * 
 * Notifications management interface with:
 * - Notification inbox list
 * - Read/unread filtering
 * - Quick actions (mark read, delete)
 * - Link to preferences
 * 
 * @page app/[locale]/notifications/page.tsx
 */

import * as React from "react";
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  AlertCircle,
  Info,
  MessageSquare,
  FileText,
  Vote,
  BookOpen,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Mock notification type
interface Notification {
  id: string;
  type: "announcement" | "claim" | "document" | "training" | "voting" | "message";
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  priority: "low" | "normal" | "high" | "urgent";
  link?: string;
}

export default function NotificationsPage() {
  // Mock notifications - would come from API/database
  const [notifications, setNotifications] = React.useState<Notification[]>([
    {
      id: "1",
      type: "announcement",
      title: "System Maintenance Scheduled",
      message: "Scheduled maintenance on Saturday from 2-4 AM EST",
      // eslint-disable-next-line react-hooks/purity
      timestamp: new Date(Date.now() - 3600000),
      isRead: false,
      priority: "high",
    },
    {
      id: "2",
      type: "claim",
      title: "Claim Approved",
      message: "Your claim #12345 has been approved",
      // eslint-disable-next-line react-hooks/purity
      timestamp: new Date(Date.now() - 7200000),
      isRead: false,
      priority: "normal",
    },
    {
      id: "3",
      type: "training",
      title: "New Course Available",
      message: "Advanced Safety Training course is now available",
      // eslint-disable-next-line react-hooks/purity
      timestamp: new Date(Date.now() - 86400000),
      isRead: true,
      priority: "normal",
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "announcement":
        return <AlertCircle className="h-5 w-5" />;
      case "claim":
        return <FileText className="h-5 w-5" />;
      case "document":
        return <FileText className="h-5 w-5" />;
      case "training":
        return <BookOpen className="h-5 w-5" />;
      case "voting":
        return <Vote className="h-5 w-5" />;
      case "message":
        return <MessageSquare className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: Notification["priority"]) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "normal":
        return "secondary";
      case "low":
        return "outline";
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-gray-600 mt-2">
            Stay updated with important announcements and activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings?tab=notifications">
              <Settings className="h-4 w-4 mr-2" />
              Preferences
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread ({unreadCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Bell className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No notifications</p>
                </CardContent>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={notification.isRead ? "opacity-60" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold flex items-center gap-2">
                              {notification.title}
                              {!notification.isRead && (
                                <Badge variant="default" className="text-xs">
                                  NEW
                                </Badge>
                              )}
                              <Badge variant={getPriorityColor(notification.priority)}>
                                {notification.priority}
                              </Badge>
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              {formatDistanceToNow(notification.timestamp, {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="unread">
          <div className="space-y-2">
            {notifications.filter((n) => !n.isRead).length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCheck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No unread notifications</p>
                </CardContent>
              </Card>
            ) : (
              notifications
                .filter((n) => !n.isRead)
                .map((notification) => (
                  <Card key={notification.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold flex items-center gap-2">
                                {notification.title}
                                <Badge variant="default" className="text-xs">
                                  NEW
                                </Badge>
                                <Badge variant={getPriorityColor(notification.priority)}>
                                  {notification.priority}
                                </Badge>
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-2">
                                {formatDistanceToNow(notification.timestamp, {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
