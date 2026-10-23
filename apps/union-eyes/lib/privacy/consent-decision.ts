'use client';

import { useSyncExternalStore } from 'react';

export const CONSENT_DECISION_EVENT = 'ue:privacy-decision';

/** Corrupt, missing or expired storage is not a privacy decision. Never writes consent. */
export function hasStoredConsentDecision(): boolean {
  try {
    if (!window.localStorage.getItem('cookie_consent_id')) return false;
    const value = JSON.parse(window.localStorage.getItem('cookie_consent') || 'null');
    return !!value && Date.parse(value.expiresAt) > Date.now()
      && value.preferences?.essential === true
      && ['functional', 'analytics', 'marketing'].every(key => typeof value.preferences[key] === 'boolean');
  } catch { return false; }
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
