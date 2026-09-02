'use client';

/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * IcraCapabilityBootstrap — client-side bridge for the email-recovery flow.
 *
 * A URL fragment (`#cap=<token>`) is never sent to the server, so the first
 * server-rendered request for /continuity-assessment/results/[id] cannot see
 * it even though the browser can. This component runs only when the server
 * render found no valid HttpOnly capability cookie: it reads the fragment,
 * exchanges it for the cookie via a dedicated endpoint (which does NOT
 * rotate the capability), strips the fragment from the URL, and refreshes
 * so the server can re-render with the now-readable cookie.
 *
 * If there is no fragment token either, access genuinely cannot be
 * authorized from this browser/link and a plain "not verified" message is
 * shown \u2014 this must never loop.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface IcraCapabilityBootstrapProps {
  assessmentId: string;
  locale?: string;
}

const COPY = {
  'en-CA': {
    verifying: 'Verifying your access link…',
    notFound: 'This link could not be verified. It may be incomplete, expired, or already used from a different device.',
    invalid: 'This access link is invalid or has expired.',
  },
  'fr-CA': {
    verifying: 'Vérification de votre lien d\u2019accès…',
    notFound: 'Ce lien n\u2019a pas pu être vérifié. Il peut être incomplet, expiré, ou déjà utilisé depuis un autre appareil.',
    invalid: 'Ce lien d\u2019accès est invalide ou a expiré.',
  },
} as const;

export function IcraCapabilityBootstrap({ assessmentId, locale = 'en-CA' }: IcraCapabilityBootstrapProps) {
  const router = useRouter();
  const copy = COPY[locale as keyof typeof COPY] ?? COPY['en-CA'];
  const [state, setState] = useState<'checking' | 'no-fragment' | 'invalid'>('checking');

  useEffect(() => {
    const hash = window.location.hash;
    const match = /(?:^#|&)cap=([^&]+)/.exec(hash);
    const capability = match ? decodeURIComponent(match[1]) : null;

    if (!capability) {
      setState('no-fragment');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/icra/${assessmentId}/capability/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capability }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setState('invalid');
          return;
        }
        // Strip the fragment so the raw token never lingers in browser
        // history/URL bar, then let the server re-render with the cookie.
        const url = new URL(window.location.href);
        url.hash = '';
        window.history.replaceState(null, '', url.toString());
        router.refresh();
      } catch {
        if (!cancelled) setState('invalid');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  if (state === 'checking') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center text-sm text-stone-500">
        {copy.verifying}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center text-sm text-stone-600">
      {state === 'invalid' ? copy.invalid : copy.notFound}
    </div>
  );
}
