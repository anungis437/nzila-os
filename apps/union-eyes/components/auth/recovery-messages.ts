'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { NETWORK_MESSAGE, UNEXPECTED_MESSAGE } from './auth-client';

/** The refusals the password routes state in English, by their exact text (packages/platform-auth/src/password). Anything else is shown as stated. */
export const RECOVERY_REFUSALS = {
  'Too many requests. Please try again later.': 'tooManyRequests',
  'Invalid or expired reset link': 'linkInvalid',
  'This reset link has already been used': 'linkUsed',
  'This reset link has expired. Please request a new one.': 'linkExpired',
  'Password must be at least 8 characters': 'passwordTooShort',
  'Password must be at most 128 characters': 'passwordTooLong',
  'Password must contain at least one uppercase letter': 'passwordNeedsUppercase',
  'Password must contain at least one lowercase letter': 'passwordNeedsLowercase',
  'Password must contain at least one digit': 'passwordNeedsDigit',
  'Invalid email address': 'invalidEmailAddress',
} as const satisfies Readonly<Record<string, string>>;

export function useRecoveryMessage(): (message: string) => string {
  const t = useTranslations('passwordRecovery');
  return useCallback((message: string) => {
    if (message === NETWORK_MESSAGE) return t('networkError');
    if (message === UNEXPECTED_MESSAGE) return t('unexpectedError');
    const key = (RECOVERY_REFUSALS as Readonly<Record<string, string>>)[message];
    return key ? t(`refusals.${key}` as 'refusals.tooManyRequests') : message;
  }, [t]);
}
