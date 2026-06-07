'use client';

/**
 * Push Notification History
 * 
 * Component for viewing sent push notifications and their delivery stats.
 * Provides analytics on notification performance.
 * 
 * Features:
 * - List all sent notifications
 * - View delivery stats (sent, delivered, opened, clicked)
 * - Filter by date range, status, audience
 * - View detailed analytics per notification
 * - Resend failed notifications
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MoreVertical,
  TrendingUp,
  Eye,
  MousePointerClick,
  Send,
  Calendar,
} from 'lucide-react';
 
import { format, formatDistanceToNow } from 'date-fns';

interface PushNotification {
  id: string;
  title: string;
  body: string;
  targetAudience: 'all' | 'segment' | 'individual';
  targetSegment?: string;
  sentAt: Date;
  scheduledAt?: Date;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
  status: 'sent' | 'scheduled' | 'failed' | 'draft';
  priority: 'high' | 'normal' | 'low';
}

interface PushNotificationHistoryProps {
  notifications?: PushNotification[];
  onResend?: (notificationId: string) => Promise<void>;
  onViewDetails?: (notificationId: string) => void;
}

export function PushNotificationHistory({
  notifications: propNotifications,
  onResend,
  onViewDetails: _onViewDetails,
}: PushNotificationHistoryProps) {
  const [fetchedNotifications, setFetchedNotifications] = useState<PushNotification[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedNotification, setSelectedNotification] = useState<PushNotification | null>(null);
  const [_loading, setLoading] = useState(!propNotifications);

  const fetchNotifications = useCallback(async () => {
    if (propNotifications) return;
    try {
      setLoading(true);
      const res = await fetch('/api/v2/communications/push/history');
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFetchedNotifications(items.map((n: any) => ({
          ...n,
          sentAt: new Date(n.sentAt ?? n.sent_at),
          scheduledAt: n.scheduledAt ?? n.scheduled_at ? new Date(n.scheduledAt ?? n.scheduled_at) : undefined,
          stats: n.stats ?? { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 },
        })));
      }
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, [propNotifications]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const notifications = propNotifications ?? fetchedNotifications;

  const filteredNotifications = notifications.filter((notif) => {
    return statusFilter === 'all' || notif.status === statusFilter;
  });

  const calculateDeliveryRate = (notif: PushNotification) => {
    if (notif.stats.sent === 0) return 0;
    return Math.round((notif.stats.delivered / notif.stats.sent) * 100);
  };

  const calculateOpenRate = (notif: PushNotification) => {
    if (notif.stats.delivered === 0) return 0;
    return Math.round((notif.stats.opened / notif.stats.delivered) * 100);
  };

  const calculateClickRate = (notif: PushNotification) => {
    if (notif.stats.opened === 0) return 0;
    return Math.round((notif.stats.clicked / notif.stats.opened) * 100);
  };

  const getStatusBadge = (status: PushNotification['status']) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-600">Sent</Badge>;
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const getPriorityBadge = (priority: PushNotification['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'normal':
        return <Badge variant="outline">Normal</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  // Calculate overall stats
  const totalStats = notifications
    .filter(n => n.status === 'sent')
    .reduce(
      (acc, n) => ({
        sent: acc.sent + n.stats.sent,
        delivered: acc.delivered + n.stats.delivered,
        opened: acc.opened + n.stats.opened,
        clicked: acc.clicked + n.stats.clicked,
        failed: acc.failed + n.stats.failed,
      }),
      { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 }
    );

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.sent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.failed} failed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalStats.sent > 0
                ? Math.round((totalStats.delivered / totalStats.sent) * 100)
                : 0}%
            </div>
            <Progress 
              value={totalStats.sent > 0 ? (totalStats.delivered / totalStats.sent) * 100 : 0} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalStats.delivered > 0
                ? Math.round((totalStats.opened / totalStats.delivered) * 100)
                : 0}%
            </div>
            <Progress 
              value={totalStats.delivered > 0 ? (totalStats.opened / totalStats.delivered) * 100 : 0} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {totalStats.opened > 0
                ? Math.round((totalStats.clicked / totalStats.opened) * 100)
                : 0}%
            </div>
            <Progress 
              value={totalStats.opened > 0 ? (totalStats.clicked / totalStats.opened) * 100 : 0} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notification History</CardTitle>
              <CardDescription>
                View and analyze your sent push notifications
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Notification</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Opens</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No notifications found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNotifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div className="font-medium">{notification.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {notification.body}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {notification.targetAudience}
                          {notification.targetSegment && `: ${notification.targetSegment}`}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(notification.status)}</TableCell>
                      <TableCell>{getPriorityBadge(notification.priority)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{notification.stats.sent.toLocaleString()}</div>
                        {notification.stats.failed > 0 && (
                          <div className="text-xs text-destructive">
                            {notification.stats.failed} failed
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{calculateDeliveryRate(notification)}%</span>
                          <Progress value={calculateDeliveryRate(notification)} className="h-2 w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{calculateOpenRate(notification)}%</span>
                          <Progress value={calculateOpenRate(notification)} className="h-2 w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{calculateClickRate(notification)}%</span>
                          <Progress value={calculateClickRate(notification)} className="h-2 w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {notification.status === 'scheduled' ? (
                            <>
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {format(notification.scheduledAt!, 'MMM d')}
                            </>
                          ) : (
                            formatDistanceToNow(notification.sentAt, { addSuffix: true })
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedNotification(notification)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {notification.status === 'failed' && (
                              <DropdownMenuItem onClick={() => onResend?.(notification.id)}>
                                <Send className="h-4 w-4 mr-2" />
                                Resend
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>
              Detailed analytics for this push notification
            </DialogDescription>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-6">
              {/* Content */}
              <div className="space-y-2">
                <h4 className="font-semibold">Content</h4>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="font-semibold">{selectedNotification.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedNotification.body}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Send className="h-4 w-4" />
                    Sent
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedNotification.stats.sent.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    Delivered
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {selectedNotification.stats.delivered.toLocaleString()}
                    <span className="text-sm ml-2">
                      ({calculateDeliveryRate(selectedNotification)}%)
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    Opened
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedNotification.stats.opened.toLocaleString()}
                    <span className="text-sm ml-2">
                      ({calculateOpenRate(selectedNotification)}%)
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MousePointerClick className="h-4 w-4" />
                    Clicked
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {selectedNotification.stats.clicked.toLocaleString()}
                    <span className="text-sm ml-2">
                      ({calculateClickRate(selectedNotification)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Target Audience:</span>
                  <div className="font-medium capitalize">{selectedNotification.targetAudience}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>
                  <div className="font-medium capitalize">{selectedNotification.priority}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Sent At:</span>
                  <div className="font-medium">
                    {format(selectedNotification.sentAt, 'PPpp')}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Failed:</span>
                  <div className="font-medium text-destructive">
                    {selectedNotification.stats.failed}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

