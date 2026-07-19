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
import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
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
  const t = useTranslations('settingsCommunicationsPage');
  const locale = useLocale();
  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/messaging/preferences');
      
      if (!response.ok) {
        throw new Error(t('errors.fetchFailed'));
      }

      const data = await response.json();
      setPreferences(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

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
        throw new Error(error.error || t('errors.saveFailed'));
      }

      const updated = await response.json();
      setPreferences(updated);
      setSuccessMessage(t('success.saved'));
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
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
          {t('retryButton')}
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
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
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
          <strong>{t('privacyNotice.title')}</strong> {t('privacyNotice.body')}
        </AlertDescription>
      </Alert>

      {/* Channel Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>{t('channels.title')}</CardTitle>
          <CardDescription>
            {t('channels.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-1" />
              <div>
                <Label htmlFor="email-enabled" className="text-base font-medium">
                  {t('channels.email.title')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('channels.email.description')}
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
                  {t('channels.sms.title')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('channels.sms.description')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('channels.sms.warning')}
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
                  {t('channels.push.title')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('channels.push.description')}
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
          <CardTitle>{t('content.title')}</CardTitle>
          <CardDescription>
            {t('content.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="category-campaign" className="font-medium">
                {t('content.campaign.title')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('content.campaign.description')}
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
                {t('content.transactional.title')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('content.transactional.description')}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {t('content.transactional.warning')}
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
                {t('content.alerts.title')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('content.alerts.description')}
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
                {t('content.newsletters.title')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('content.newsletters.description')}
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
                {t('content.social.title')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('content.social.description')}
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
          <CardTitle>{t('frequency.title')}</CardTitle>
          <CardDescription>
            {t('frequency.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="frequency">{t('frequency.label')}</Label>
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
                    <span>{t('frequency.options.realTime.title')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('frequency.options.realTime.description')}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="daily_digest">
                  <div className="flex flex-col">
                    <span>{t('frequency.options.dailyDigest.title')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('frequency.options.dailyDigest.description')}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="weekly_digest">
                  <div className="flex flex-col">
                    <span>{t('frequency.options.weeklyDigest.title')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('frequency.options.weeklyDigest.description')}
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('frequency.note')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('quietHours.title')}
          </CardTitle>
          <CardDescription>
            {t('quietHours.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours-enabled" className="font-medium">
              {t('quietHours.enableLabel')}
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
                  <Label htmlFor="quiet-start">{t('quietHours.startTimeLabel')}</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) => updateQuietHours({ start: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quiet-end">{t('quietHours.endTimeLabel')}</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) => updateQuietHours({ end: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">{t('quietHours.timezoneLabel')}</Label>
                <Select
                  value={preferences.quietHours.timezone}
                  onValueChange={(value) => updateQuietHours({ timezone: value })}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Toronto">{t('quietHours.timezones.toronto')}</SelectItem>
                    <SelectItem value="America/Vancouver">{t('quietHours.timezones.vancouver')}</SelectItem>
                    <SelectItem value="America/Chicago">{t('quietHours.timezones.chicago')}</SelectItem>
                    <SelectItem value="America/Denver">{t('quietHours.timezones.denver')}</SelectItem>
                    <SelectItem value="America/Halifax">{t('quietHours.timezones.halifax')}</SelectItem>
                    <SelectItem value="America/St_Johns">{t('quietHours.timezones.stJohns')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {t('quietHours.alert')}
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
            {t('unsubscribedNotice', {
              date: new Date(preferences.unsubscribedAt).toLocaleDateString(locale),
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Save Button */}
      <Card>
        <CardFooter className="flex justify-between pt-6">
          <p className="text-sm text-muted-foreground">
            {t('lastUpdated', {
              value: new Date(preferences.updatedAt).toLocaleString(locale),
            })}
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('saveButton.saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t('saveButton.idle')}
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
            {t('compliance.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>{t('compliance.rightsTitle')}</strong> {t('compliance.rightsBody')}
          </p>
          <p>
            <strong>{t('compliance.consentTrackingTitle')}</strong> {t('compliance.consentTrackingBody')}
          </p>
          <p>
            <strong>{t('compliance.transactionalTitle')}</strong> {t('compliance.transactionalBody')}
          </p>
          <p>
            <strong>{t('compliance.dataProtectionTitle')}</strong> {t('compliance.dataProtectionBody')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
