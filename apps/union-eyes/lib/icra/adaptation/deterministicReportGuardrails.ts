import type { SupportedLocale } from './adaptivePassageLibrary';

// Bounded quantifiers keep the match linear on long input; an unanchored match still finds any email-like run.
const EMAIL_PATTERN = /[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,255}\.[A-Z]{2,24}/i;
const URL_PATTERN = /https?:\/\//i;

export function assertSupportedLocale(locale: string): asserts locale is SupportedLocale {
  if (locale !== 'en-CA' && locale !== 'fr-CA') {
    throw new Error(`Unsupported locale for deterministic report AI: ${locale}`);
  }
}

export function assertSafeDeterministicText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} must not be empty`);
  }
  if (EMAIL_PATTERN.test(value)) {
    throw new Error(`${field} contains email-like content and violates disclosure guardrails`);
  }
  if (URL_PATTERN.test(value)) {
    throw new Error(`${field} contains URL-like content and violates disclosure guardrails`);
  }
}

export function stableDeterministicId(prefix: string, parts: readonly string[]): string {
  let hash = 2166136261;
  const joined = `${prefix}|${parts.join('|')}`;
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${prefix}-${hex}`;
}
