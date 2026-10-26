'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Prefs = { inAppEnabled: boolean; claimUpdates: boolean; saved: boolean };

/**
 * Only controls backed by delivery that exists are shown: in-app notices are produced by case
 * transitions and secure messages. Email, SMS and push preferences are not offered because nothing
 * sends them.
 */
export function MemberPreferences() {
  const t = useTranslations('memberPreferences');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [prefs, setPrefs] = useState<Prefs>({ inAppEnabled: true, claimUpdates: true, saved: false });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<'saved' | 'failed' | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch('/api/notifications/preferences');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      const data = body?.data ?? body;
      setPrefs({ inAppEnabled: Boolean(data.inAppEnabled), claimUpdates: Boolean(data.claimUpdates), saved: Boolean(data.saved) });
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inAppEnabled: prefs.inAppEnabled, claimUpdates: prefs.claimUpdates }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setPrefs((p) => ({ ...p, saved: true }));
      setResult('saved');
    } catch {
      setResult('failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="member-preferences">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      {state === 'loading' && <Skeleton className="h-32 w-full" role="status" aria-busy="true" />}
      {state === 'error' && (
        <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
          {t('loadError')}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void load()}>{t('retry')}</Button>
        </div>
      )}
      {state === 'ready' && (
        <form onSubmit={save} className="space-y-4 rounded-lg border p-4">
          {!prefs.saved && <p className="text-sm text-muted-foreground" data-testid="prefs-defaults">{t('defaultsNote')}</p>}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={prefs.inAppEnabled}
              onChange={(e) => setPrefs((p) => ({ ...p, inAppEnabled: e.target.checked }))}
            />
            <span>
              <span className="block font-medium">{t('inApp')}</span>
              <span className="text-muted-foreground">{t('inAppHelp')}</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={prefs.claimUpdates}
              disabled={!prefs.inAppEnabled}
              onChange={(e) => setPrefs((p) => ({ ...p, claimUpdates: e.target.checked }))}
            />
            <span>
              <span className="block font-medium">{t('caseUpdates')}</span>
              <span className="text-muted-foreground">{t('caseUpdatesHelp')}</span>
            </span>
          </label>
          <p className="text-xs text-muted-foreground">{t('otherChannels')}</p>
          <div aria-live="polite">
            {result === 'saved' && <p className="text-sm text-green-700" data-testid="prefs-saved">{t('saved')}</p>}
            {result === 'failed' && <p role="alert" className="text-sm text-destructive">{t('saveError')}</p>}
          </div>
          <Button type="submit" disabled={saving}>{saving ? t('saving') : t('save')}</Button>
        </form>
      )}
    </div>
  );
}
