'use client';

import { useTranslations } from 'next-intl';

/** `grievance_pay` -> `grievancePay`, matching the `claimTypes` message keys. */
export function claimLabelKey(value: string): string {
  return value.toLowerCase().replace(/[-_\s]+(.)/g, (_match, char: string) => char.toUpperCase());
}

function humanize(value: string): string {
  const spaced = value.replace(/[-_]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
}

/** The database calls the highest priority `critical`; the messages call it `urgent`. */
const PRIORITY_KEYS: Record<string, string> = { critical: 'urgent' };

/** What a case's type, status and priority are called in the language of the page; a value the messages do not know is put in words, never printed as the identifier. */
export function useClaimLabels() {
  const types = useTranslations('claimTypes');
  const priorities = useTranslations('priority');
  const statuses = useTranslations('status');

  return {
    typeLabel: (value: string) => {
      const key = claimLabelKey(value);
      return value && types.has(key) ? types(key) : humanize(value);
    },
    statusLabel: (value: string) => {
      const key = claimLabelKey(value);
      if (types.has(key)) return types(key);
      if (statuses.has(key)) return statuses(key);
      return humanize(value);
    },
    priorityLabel: (value: string) => {
      const key = PRIORITY_KEYS[value] ?? value;
      return priorities.has(key) ? priorities(key) : humanize(value);
    },
  };
}
