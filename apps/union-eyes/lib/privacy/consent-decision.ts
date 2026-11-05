'use client';

import { useSyncExternalStore } from 'react';
import { isRecord } from '@/lib/client/api-envelope';

export const CONSENT_DECISION_EVENT = 'ue:privacy-decision';

/** What a stored decision says about each kind of cookie; essential cookies are always on. */
export interface StoredConsentPreferences {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

/**
 * The decision the browser holds, or null: corrupt, missing, incomplete or expired storage is not a privacy decision. Never writes consent.
 * The banner reads its preferences from here, so what it applies is exactly what `hasStoredConsentDecision` accepted.
 */
export function readStoredConsentPreferences(): StoredConsentPreferences | null {
  try {
    if (!window.localStorage.getItem('cookie_consent_id')) return null;
    const value: unknown = JSON.parse(window.localStorage.getItem('cookie_consent') || 'null');
    if (!isRecord(value) || typeof value.expiresAt !== 'string' || !(Date.parse(value.expiresAt) > Date.now())) return null;
    const { preferences } = value;
    if (!isRecord(preferences) || preferences.essential !== true) return null;
    const { functional, analytics, marketing } = preferences;
    if (typeof functional !== 'boolean' || typeof analytics !== 'boolean' || typeof marketing !== 'boolean') return null;
    return { essential: true, functional, analytics, marketing };
  } catch { return null; }
}

/** Corrupt, missing or expired storage is not a privacy decision. Never writes consent. */
export function hasStoredConsentDecision(): boolean {
  return readStoredConsentPreferences() !== null;
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CONSENT_DECISION_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CONSENT_DECISION_EVENT, callback);
  };
}

export function useConsentDecision() {
  return useSyncExternalStore(subscribe, hasStoredConsentDecision, () => false);
}
