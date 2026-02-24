/**
 * Communication Preferences Page
 * 
 * User-facing page to manage email, SMS, and push notification preferences
 * Path: /dashboard/settings/communications
 * 
 * Phase 4: Communications & Organizing
 * CASL/GDPR Compliant with consent tracking
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  MessageSquare, 
  Bell, 
  Clock, 
  Save, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Info,
} from 'lucide-react';

interface CommunicationPreferences {
  id: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  categories: {
    campaign: boolean;
    transactional: boolean;
    alerts: boolean;
    newsletters: boolean;
    social: boolean;
  };
  frequency: 'real_time' | 'daily_digest' | 'weekly_digest';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  language: string;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CommunicationPreferencesPage() {
  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/messaging/preferences');
      
      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const data = await response.json();
      setPreferences(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/messaging/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save preferences');
      }

      const updated = await response.json();
      setPreferences(updated);
      setSuccessMessage('Preferences saved successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreferences = (updates: Partial<CommunicationPreferences>) => {
    if (!preferences) return;
    setPreferences({ ...preferences, ...updates });
  };

  const updateCategory = (category: keyof CommunicationPreferences['categories'], enabled: boolean) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      categories: {
        ...preferences.categories,
        [category]: enabled,
      },
    });
  };

  const updateQuietHours = (updates: Partial<CommunicationPreferences['quietHours']>) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        ...updates,
      },
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !preferences) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchPreferences} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Communication Preferences</h1>
        <p className="text-muted-foreground">
          Manage how and when you receive notifications from your union
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Privacy Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Your Privacy:</strong> We respect your communication preferences and comply with CASL and GDPR regulations. 
          Your consent is tracked securely, and you can update your preferences at any time.
        </AlertDescription>
      </Alert>

      {/* Channel Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Channels</CardTitle>
          <CardDescription>
            Choose which channels you want to receive communications through
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-1" />
              <div>
                <Label htmlFor="email-enabled" className="text-base font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates, newsletters, and important announcements via email
                </p>
              </div>
            </div>
            <Switch
              id="email-enabled"
              checked={preferences.emailEnabled}
              onCheckedChange={(checked) => updatePreferences({ emailEnabled: checked })}
            />
          </div>

          <Separator />

          {/* SMS */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
              <div>
                <Label htmlFor="sms-enabled" className="text-base font-medium">
                  SMS Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive urgent alerts and time-sensitive updates via text message
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ⚠️ Standard messaging rates may apply
                </p>
              </div>
            </div>
            <Switch
              id="sms-enabled"
              checked={preferences.smsEnabled}
              onCheckedChange={(checked) => updatePreferences({ smsEnabled: checked })}
            />
          </div>

          <Separator />

          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-muted-foreground mt-1" />
              <div>
                <Label htmlFor="push-enabled" className="text-base font-medium">
                  Push Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive instant notifications on your device
                </p>
              </div>
            </div>
            <Switch
              id="push-enabled"
              checked={preferences.pushEnabled}
              onCheckedChange={(checked) => updatePreferences({ pushEnabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Content Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Content Preferences</CardTitle>
          <CardDescription>
            Select the types of content you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="category-campaign" className="font-medium">
                Campaigns & Petitions
              </Label>
              <p className="text-sm text-muted-foreground">
                Union campaigns, petitions, and organizing activities
              </p>
            </div>
            <Switch
              id="category-campaign"
              checked={preferences.categories.campaign}
              onCheckedChange={(checked) => updateCategory('campaign', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="category-transactional" className="font-medium">
                Transactional Messages
              </Label>
              <p className="text-sm text-muted-foreground">
                Account updates, receipts, and confirmations
              </p>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Cannot be disabled - required for account functionality
              </p>
            </div>
            <Switch
              id="category-transactional"
              checked={preferences.categories.transactional}
              disabled={true}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="category-alerts" className="font-medium">
                Urgent Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Time-sensitive alerts and emergency notifications
              </p>
            </div>
            <Switch
              id="category-alerts"
              checked={preferences.categories.alerts}
              onCheckedChange={(checked) => updateCategory('alerts', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="category-newsletters" className="font-medium">
                Newsletters
              </Label>
              <p className="text-sm text-muted-foreground">
                Regular union newsletters and member updates
              </p>
            </div>
            <Switch
              id="category-newsletters"
              checked={preferences.categories.newsletters}
              onCheckedChange={(checked) => updateCategory('newsletters', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="category-social" className="font-medium">
                Social & Events
              </Label>
              <p className="text-sm text-muted-foreground">
                Event invitations, social activities, and community updates
              </p>
            </div>
            <Switch
              id="category-social"
              checked={preferences.categories.social}
              onCheckedChange={(checked) => updateCategory('social', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Delivery Frequency */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Frequency</CardTitle>
          <CardDescription>
            Control how often you receive non-urgent communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={preferences.frequency}
              onValueChange={(value) => updatePreferences({ frequency: value as CommunicationPreferences['frequency'] })}
            >
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="real_time">
                  <div className="flex flex-col">
                    <span>Real-time</span>
                    <span className="text-xs text-muted-foreground">
                      Receive messages as they are sent
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="daily_digest">
                  <div className="flex flex-col">
                    <span>Daily Digest</span>
                    <span className="text-xs text-muted-foreground">
                      One email per day with all updates
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="weekly_digest">
                  <div className="flex flex-col">
                    <span>Weekly Digest</span>
                    <span className="text-xs text-muted-foreground">
                      One email per week with all updates
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Note: Urgent alerts and transactional messages are always sent immediately
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set times when you don&apos;t want to receive non-urgent notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours-enabled" className="font-medium">
              Enable Quiet Hours
            </Label>
            <Switch
              id="quiet-hours-enabled"
              checked={preferences.quietHours.enabled}
              onCheckedChange={(checked) => updateQuietHours({ enabled: checked })}
            />
          </div>

          {preferences.quietHours.enabled && (
            <>
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quiet-start">Start Time</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) => updateQuietHours({ start: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quiet-end">End Time</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) => updateQuietHours({ end: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={preferences.quietHours.timezone}
                  onValueChange={(value) => updateQuietHours({ timezone: value })}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Toronto">Eastern Time (Toronto)</SelectItem>
                    <SelectItem value="America/Vancouver">Pacific Time (Vancouver)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (Chicago)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (Denver)</SelectItem>
                    <SelectItem value="America/Halifax">Atlantic Time (Halifax)</SelectItem>
                    <SelectItem value="America/St_Johns">Newfoundland Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  During quiet hours, you won&apos;t receive non-urgent notifications. 
                  Urgent alerts will still be delivered immediately.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Unsubscribe Warning */}
      {preferences.unsubscribedAt && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You unsubscribed from all communications on {new Date(preferences.unsubscribedAt).toLocaleDateString()}.
            Enable at least one channel above to resubscribe.
          </AlertDescription>
        </Alert>
      )}

      {/* Save Button */}
      <Card>
        <CardFooter className="flex justify-between pt-6">
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(preferences.updatedAt).toLocaleString()}
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Preferences
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* CASL Compliance Notice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Your Rights:</strong> You have the right to control your communication preferences 
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            at any time. We comply with Canada's Anti-Spam Legislation (CASL) and GDPR requirements.
          </p>
          <p>
            <strong>Consent Tracking:</strong> All changes to your communication preferences are logged 
            for compliance purposes, including IP address and timestamp.
          </p>
          <p>
            <strong>Transactional Messages:</strong> Even if you unsubscribe from marketing communications, 
            you will still receive essential account-related messages required for service functionality.
          </p>
          <p>
            <strong>Data Protection:</strong> Your contact information is stored securely and never 
            shared with third parties without your explicit consent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Missing Input import - add to component
import { Input } from '@/components/ui/input';
