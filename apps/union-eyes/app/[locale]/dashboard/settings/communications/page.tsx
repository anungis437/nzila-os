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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  MessageSquare, 
  Bell, 
  Save, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { ApiShapeError, envelopeData, readApiError } from '@/lib/client/api-envelope';

/**
 * The channel switches /api/notifications/preferences keeps for the signed-in user, which the notification service consults before it
 * sends on a channel. The page offers only those. It once also offered content categories, a digest frequency, quiet hours with a zone,
 * and an "unsubscribed on" notice: no column holds the categories, the zone or the date, and nothing that sends reads the frequency or the
 * quiet hours, so a control for them would only look as though it did something. Until the switches are first saved the route answers
 * with defaults, not a record.
 */
interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  saved: boolean;
  updatedAt: string | null;
}

const COPY = {
  en: {
    defaultsNote: 'These are the default settings. Nothing has been saved yet.',
  },
  fr: {
    defaultsNote: 'Ce sont les paramètres par défaut. Rien n’a encore été enregistré.',
  },
} as const;

/** The preferences in a withApi answer; a body that lacks a switch is refused, not filled in. */
function preferencesFrom(body: unknown): NotificationPreferences {
  const data = envelopeData(body);
  const flag = (key: string): boolean => {
    const value = data[key];
    if (typeof value !== 'boolean') throw new ApiShapeError(key);
    return value;
  };
  return {
    emailEnabled: flag('emailEnabled'),
    smsEnabled: flag('smsEnabled'),
    pushEnabled: flag('pushEnabled'),
    saved: data.saved === true,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  };
}

export default function CommunicationPreferencesPage() {
  const t = useTranslations('settingsCommunicationsPage');
  const locale = useLocale();
  const copy = locale.toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/notifications/preferences');
      
      if (!response.ok) {
        throw new Error(await readApiError(response, t('errors.fetchFailed')));
      }

      setPreferences(preferencesFrom(await response.json()));
    } catch (err) {
      setError(err instanceof Error && !(err instanceof ApiShapeError) ? err.message : t('errors.fetchFailed'));
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

      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailEnabled: preferences.emailEnabled,
          smsEnabled: preferences.smsEnabled,
          pushEnabled: preferences.pushEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, t('errors.saveFailed')));
      }

      setPreferences(preferencesFrom(await response.json()));
      setSuccessMessage(t('success.saved'));
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error && !(err instanceof ApiShapeError) ? err.message : t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const updatePreferences = (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return;
    setPreferences({ ...preferences, ...updates });
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

      {!preferences.saved && (
        <p className="text-sm text-muted-foreground" data-testid="preferences-defaults">
          {copy.defaultsNote}
        </p>
      )}

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

      {/* Save Button */}
      <Card>
        <CardFooter className="flex justify-between pt-6">
          <p className="text-sm text-muted-foreground">
            {preferences.updatedAt
              ? t('lastUpdated', { value: new Date(preferences.updatedAt).toLocaleString(locale) })
              : ''}
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
