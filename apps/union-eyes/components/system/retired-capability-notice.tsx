'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Makes a removed capability visible. Many dashboard components call the retired /api/v2 mirror and, on any failure, show an
 * empty or default state, which reads as "nothing to report" rather than "this does not work". The v2 catch-all answers
 * 410 Gone for every method; this notice watches for that answer on same-origin /api/v2 calls and says so on the page,
 * once per capability, in English or French. It never reads or alters a response body.
 */

const COPY = {
  en: {
    title: 'Part of this page is not available',
    body: (paths: string) => `A feature this page depends on has been retired in this release (${paths}). Any empty figures or lists are not real data. Nothing was changed.`,
    dismiss: 'Dismiss',
  },
  fr: {
    title: 'Une partie de cette page n’est pas disponible',
    body: (paths: string) => `Une fonction dont dépend cette page a été retirée dans cette version (${paths}). Les chiffres ou listes vides ne sont pas des données réelles. Rien n’a été modifié.`,
    dismiss: 'Fermer',
  },
} as const;

const WATCHED_FLAG = '__ueRetiredCapabilityWatch';

export function retiredCapabilityPath(input: RequestInfo | URL, status: number): string | null {
  if (status !== 410) return null;
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(raw, 'http://local.invalid');
    return url.pathname.startsWith('/api/v2/') ? url.pathname : null;
  } catch {
    return null;
  }
}

export function RetiredCapabilityNotice() {
  const locale = useLocale();
  const copy = locale.toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown> & { fetch: typeof fetch };
    if (w[WATCHED_FLAG]) return;
    const original = w.fetch;
    const bound = original.bind(window);
    w[WATCHED_FLAG] = true;
    w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await bound(input, init);
      const path = retiredCapabilityPath(input, response.status);
      if (path) setPaths((current) => (current.includes(path) ? current : [...current, path]));
      return response;
    };
    return () => {
      w.fetch = original;
      w[WATCHED_FLAG] = false;
    };
  }, []);

  if (paths.length === 0) return null;
  return (
    <div role="alert" aria-live="assertive" className="fixed bottom-4 right-4 z-50 max-w-md rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold">{copy.title}</p>
          <p>{copy.body(paths.join(', '))}</p>
        </div>
        <button type="button" onClick={() => setPaths([])} aria-label={copy.dismiss} className="ml-2 rounded p-1 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
