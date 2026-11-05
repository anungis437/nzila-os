'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiShapeError, envelopeData, readApiError } from '@/lib/client/api-envelope';

type Prefs = { inAppEnabled: boolean; claimUpdates: boolean; saved: boolean };
type SaveResult = { kind: 'saved' } | { kind: 'failed'; reason: string };

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** GET and PUT answer with the stored (or default) preferences in withApi's envelope; a body that does not hold all three flags is not read as "all off". */
async function readPrefs(response: Response): Promise<Prefs> {
  const body: unknown = await response.json().catch(() => {
    throw new ApiShapeError('the answer is not JSON');
  });
  const { inAppEnabled, claimUpdates, saved } = envelopeData(body);
  if (typeof inAppEnabled !== 'boolean' || typeof claimUpdates !== 'boolean' || typeof saved !== 'boolean') {
    throw new ApiShapeError('the preferences are incomplete');
  }
  return { inAppEnabled, claimUpdates, saved };
}

async function refusal(response: Response): Promise<Error> {
  return new Error(await readApiError(response, `Request failed with status ${response.status}`));
}

async function fetchPrefs(): Promise<Prefs> {
  const response = await fetch('/api/notifications/preferences');
  if (!response.ok) throw await refusal(response);
  return readPrefs(response);
}

/**
 * Only controls backed by delivery that exists are shown: in-app notices are produced by case
 * transitions and secure messages. Email, SMS and push preferences are not offered because nothing
 * sends them.
 */
export function MemberPreferences() {
  const t = useTranslations('memberPreferences');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  const load = useCallback(() => {
    fetchPrefs().then(
      (value) => {
        setPrefs(value);
        setLoadError(null);
        setLoading(false);
      },
      (error: unknown) => {
        setLoadError(reasonOf(error));
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setLoading(true);
    load();
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (prefs === null) return;
    setSaving(true);
    setResult(null);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inAppEnabled: prefs.inAppEnabled, claimUpdates: prefs.claimUpdates }),
      });
      if (!response.ok) throw await refusal(response);
      // The route answers with the row it stored: the form shows that, not what was typed.
      setPrefs(await readPrefs(response));
      setResult({ kind: 'saved' });
    } catch (error) {
      setResult({ kind: 'failed', reason: reasonOf(error) });
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
      {loading && <Skeleton className="h-32 w-full" role="status" aria-busy="true" />}
      {!loading && loadError !== null && (
        <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
          {t('loadError')}
          <span className="block text-xs text-muted-foreground">{loadError}</span>
          <Button variant="outline" size="sm" className="mt-2" onClick={retry}>{t('retry')}</Button>
        </div>
      )}
      {!loading && prefs !== null && (
        <form onSubmit={save} className="space-y-4 rounded-lg border p-4">
          {!prefs.saved && <p className="text-sm text-muted-foreground" data-testid="prefs-defaults">{t('defaultsNote')}</p>}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={prefs.inAppEnabled}
              onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })}
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
              onChange={(e) => setPrefs({ ...prefs, claimUpdates: e.target.checked })}
            />
            <span>
              <span className="block font-medium">{t('caseUpdates')}</span>
              <span className="text-muted-foreground">{t('caseUpdatesHelp')}</span>
            </span>
          </label>
          <p className="text-xs text-muted-foreground">{t('otherChannels')}</p>
          <div aria-live="polite">
            {result?.kind === 'saved' && <p className="text-sm text-green-700" data-testid="prefs-saved">{t('saved')}</p>}
            {result?.kind === 'failed' && (
              <p role="alert" className="text-sm text-destructive">
                {t('saveError')}
                <span className="block text-xs">{result.reason}</span>
              </p>
            )}
          </div>
          <Button type="submit" disabled={saving}>{saving ? t('saving') : t('save')}</Button>
        </form>
      )}
    </div>
  );
}
