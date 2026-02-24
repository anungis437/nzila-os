'use client';

/**
 * Push Notification Builder
 * 
 * Component for creating and sending push notifications to mobile devices.
 * Integrates with Firebase Cloud Messaging (FCM).
 * 
 * Features:
 * - Rich notification composer (title, body, image, icon)
 * - Recipient targeting (all users, specific segments, individual users)
 * - Scheduling
 * - Preview on different devices
 * - Deep linking support
 * - Priority settings
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Send,
  Users,
  Smartphone,
  Save,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PushNotificationBuilderProps {
  onSave?: (notification: PushNotificationData) => Promise<void>;
  onSend?: (notification: PushNotificationData) => Promise<void>;
  onSchedule?: (notification: PushNotificationData, scheduledAt: Date) => Promise<void>;
}

export interface PushNotificationData {
  title: string;
  body: string;
  imageUrl?: string;
  iconUrl?: string;
  clickAction?: string;
  priority: 'high' | 'normal' | 'low';
  sound?: string;
  badgeCount?: number;
  ttl?: number;
  targetAudience: 'all' | 'segment' | 'individual';
  targetSegment?: string;
  targetUserIds?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}

export function PushNotificationBuilder({
  onSave,
  onSend,
  onSchedule,
}: PushNotificationBuilderProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [clickAction, setClickAction] = useState('');
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [sound, setSound] = useState('default');
  const [badgeCount, setBadgeCount] = useState<number | undefined>();
  const [ttl, setTtl] = useState(86400); // 24 hours default
  const [targetAudience, setTargetAudience] = useState<'all' | 'segment' | 'individual'>('all');
  const [targetSegment, setTargetSegment] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [isSaving, setIsSaving] = useState(false);

  const notificationData: PushNotificationData = {
    title,
    body,
    imageUrl: imageUrl || undefined,
    iconUrl: iconUrl || undefined,
    clickAction: clickAction || undefined,
    priority,
    sound: sound !== 'default' ? sound : undefined,
    badgeCount,
    ttl,
    targetAudience,
    targetSegment: targetSegment || undefined,
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(notificationData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!onSend) return;
    setIsSaving(true);
    try {
      await onSend(notificationData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!onSchedule || !scheduledDate) return;
    setIsSaving(true);
    try {
      await onSchedule(notificationData, scheduledDate);
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Composer */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Compose Notification</CardTitle>
            <CardDescription>
              Create a push notification to send to your members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Important Update"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={65}
              />
              <p className="text-xs text-muted-foreground">
                {title.length}/65 characters
              </p>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">
                Message <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="body"
                placeholder="Your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={240}
              />
              <p className="text-xs text-muted-foreground">
                {body.length}/240 characters
              </p>
            </div>

            {/* Media */}
            <Tabs defaultValue="none">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="none">No Media</TabsTrigger>
                <TabsTrigger value="image">Image</TabsTrigger>
                <TabsTrigger value="icon">Icon</TabsTrigger>
              </TabsList>
              <TabsContent value="image" className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  <Button variant="outline" size="icon">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="icon" className="space-y-2">
                <Label htmlFor="iconUrl">Icon URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="iconUrl"
                    type="url"
                    placeholder="https://example.com/icon.png"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                  />
                  <Button variant="outline" size="icon">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action */}
            <div className="space-y-2">
              <Label htmlFor="clickAction">Click Action (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="clickAction"
                  type="url"
                  placeholder="/grievances/123 or https://example.com"
                  value={clickAction}
                  onChange={(e) => setClickAction(e.target.value)}
                />
                <Button variant="outline" size="icon">
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Deep link or external URL to open when notification is tapped
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sound */}
              <div className="space-y-2">
                <Label htmlFor="sound">Sound</Label>
                <Select value={sound} onValueChange={setSound}>
                  <SelectTrigger id="sound">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                    <SelectItem value="chime">Chime</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Badge Count */}
            <div className="space-y-2">
              <Label htmlFor="badgeCount">Badge Count (iOS)</Label>
              <Input
                id="badgeCount"
                type="number"
                min={0}
                placeholder="Leave empty for no badge"
                value={badgeCount || ''}
                onChange={(e) => setBadgeCount(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>

            {/* TTL */}
            <div className="space-y-2">
              <Label htmlFor="ttl">Time to Live (seconds)</Label>
              <Input
                id="ttl"
                type="number"
                min={0}
                value={ttl}
                onChange={(e) => setTtl(parseInt(e.target.value) || 86400)}
              />
              <p className="text-xs text-muted-foreground">
                How long to keep trying to deliver if device is offline
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Audience */}
        <Card>
          <CardHeader>
            <CardTitle>Target Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Send to</Label>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Select value={targetAudience} onValueChange={(v: any) => setTargetAudience(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  <SelectItem value="segment">Specific Segment</SelectItem>
                  <SelectItem value="individual">Individual Users</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetAudience === 'segment' && (
              <div className="space-y-2">
                <Label htmlFor="segment">Segment</Label>
                <Select value={targetSegment} onValueChange={setTargetSegment}>
                  <SelectTrigger id="segment">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active Members</SelectItem>
                    <SelectItem value="executive">Executive Board</SelectItem>
                    <SelectItem value="stewards">Union Stewards</SelectItem>
                    <SelectItem value="engaged">Highly Engaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetAudience === 'individual' && (
              <div className="space-y-2">
                <Label>Select Recipients</Label>
                <Button variant="outline" className="w-full">
                  <Users className="h-4 w-4 mr-2" />
                  Choose Members
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview & Actions */}
      <div className="space-y-6">
        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>How your notification will appear</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* iOS Preview */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">iOS</Label>
                <div className="bg-gray-100 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    {iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconUrl} alt="" className="w-8 h-8 rounded-lg" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{title || 'Notification Title'}</div>
                      <div className="text-sm text-gray-600 line-clamp-2">
                        {body || 'Notification body text will appear here...'}
                      </div>
                    </div>
                  </div>
                  {imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="w-full rounded-lg" />
                  )}
                </div>
              </div>

              {/* Android Preview */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Android</Label>
                <div className="bg-white border rounded-lg p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <Smartphone className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{title || 'Notification Title'}</div>
                      <div className="text-sm text-gray-700">
                        {body || 'Notification body text will appear here...'}
                      </div>
                      {imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="" className="w-full rounded mt-2" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Send Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Schedule */}
            <div className="space-y-2">
              <Label>Schedule for later</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !scheduledDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSend}
                disabled={!isValid || isSaving}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Now
              </Button>
              
              <Button
                onClick={handleSchedule}
                disabled={!isValid || !scheduledDate || isSaving}
                variant="outline"
                className="w-full"
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={!isValid || isSaving}
                variant="secondary"
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Estimated Reach</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Devices</span>
                <Badge variant="secondary">1,234</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active (last 30 days)</span>
                <Badge variant="secondary">987</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Platform</span>
                <div className="flex gap-2">
                  <Badge variant="outline">iOS: 543</Badge>
                  <Badge variant="outline">Android: 444</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

