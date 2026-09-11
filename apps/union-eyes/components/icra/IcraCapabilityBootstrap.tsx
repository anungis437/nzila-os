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
    notFound: 'This link appears to be incomplete. Please use the full link from your email.',
    invalid: 'This access link is invalid or has expired.',
  },
  'fr-CA': {
    verifying: 'Vérification de votre lien d\u2019accès…',
    notFound: 'Ce lien semble incomplet. Veuillez utiliser le lien complet reçu par courriel.',
    invalid: 'Ce lien d\u2019accès est invalide ou a expiré.',
  },
} as const;

/**
 * Extracts and decodes the `cap=` fragment value, never throwing on
 * malformed percent-encoding (e.g. `#cap=%ZZ`). Distinguishes "no cap=
 * key present at all" from "present but undecodable", since the two map
 * to different denial states.
 */
export function extractFragmentCapability(hash: string): { present: boolean; value: string | null } {
  const match = /(?:^#|&)cap=([^&]+)/.exec(hash);
  if (!match) return { present: false, value: null };
  try {
    return { present: true, value: decodeURIComponent(match[1]) };
  } catch {
    return { present: true, value: null };
  }
}

export function IcraCapabilityBootstrap({ assessmentId, locale = 'en-CA' }: IcraCapabilityBootstrapProps) {
  const router = useRouter();
  const copy = COPY[locale as keyof typeof COPY] ?? COPY['en-CA'];
  const [state, setState] = useState<'checking' | 'no-fragment' | 'invalid'>('checking');

  useEffect(() => {
    const { present, value: capability } = extractFragmentCapability(window.location.hash);

    if (!present) {
      setState('no-fragment');
      return;
    }
    if (!capability) {
      setState('invalid'); // present but undecodable — never a client exception
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
