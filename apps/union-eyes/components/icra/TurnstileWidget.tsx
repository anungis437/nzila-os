'use client';

/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * Cloudflare Turnstile widget. Env-gated — when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is unset (dev / unconfigured envs), this component renders nothing and
 * immediately reports an empty token so the parent flow proceeds as if no
 * bot check were required. When configured, it loads the official
 * Turnstile script once, renders the widget, and reports the verification
 * token via onVerified.
 *
 * No PII captured. No third-party scripts loaded unless the site key is set.
 */

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  onVerified: (token: string | null) => void;
  locale?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          language?: string;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function TurnstileWidget({ onVerified, locale = 'en' }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) {
      // No site key configured — report empty token so parent gate
      // treats the bot check as satisfied (development / private envs).
      onVerified('');
      return;
    }
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return; // already rendered
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          language: locale.startsWith('fr') ? 'fr' : 'en',
          callback: (token) => onVerified(token),
          'expired-callback': () => onVerified(null),
          'error-callback': () => onVerified(null),
        });
      } catch {
        // Silent failure — parent will not receive a token, gate stays closed.
      }
    };

    if (window.turnstile) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(`script[src^="${TURNSTILE_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', render, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = TURNSTILE_SRC;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', render, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [siteKey, locale, onVerified]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="my-4" />;
}

/** True when the Turnstile site key is configured for this environment. */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
