import { getRequestConfig } from 'next-intl/server';

type MessageValue = string | number | boolean | null | MessageMap | MessageValue[];
type MessageMap = Record<string, MessageValue>;

type Messages = MessageMap;

function isObject(value: unknown): value is Messages {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: Messages, override: Messages): Messages {
  if (!isObject(base) || !isObject(override)) {
    return (override ?? base) as Messages;
  }

  const merged: Messages = { ...base };
  for (const key of Object.keys(override)) {
    const baseValue = merged[key];
    const overrideValue = override[key];
    merged[key] = isObject(baseValue) && isObject(overrideValue)
      ? deepMerge(baseValue, overrideValue)
      : overrideValue;
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) ?? 'en-CA';

  // Bare language codes without region fall back to the regional variant
  if (locale === 'en') locale = 'en-CA';
  if (locale === 'fr') locale = 'fr-CA';
  if (locale === 'sw') locale = 'sw-KE';
  if (locale === 'ha') locale = 'ha-NG';

  const baseMessages = (await import('./messages/en-CA.json')).default as Messages;
  let messages: Messages = baseMessages;
  try {
    const localeMessages = (await import(`./messages/${locale}.json`)).default as Messages;
    messages = deepMerge(baseMessages, localeMessages);
  } catch {
    // Locale file not yet available — fall back to en-CA base messages.
    messages = baseMessages;
  }

  return { locale, messages };
});
