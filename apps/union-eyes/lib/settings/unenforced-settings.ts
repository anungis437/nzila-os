/**
 * Organization settings that are stored but not enforced by any code.
 *
 * Nothing in sign-in, session, password, rate-limit or notification code reads these keys, so the settings route refuses to save one
 * (a 400 naming it) rather than answering updated:true for a control that does not exist, and the settings screens show them as
 * unchangeable. A value stored before that refusal is still reported as `notEnforced` on every read, so it is never taken for a control
 * in force. A key leaves this list only when code that enforces it exists and is proven.
 */
export const NOT_ENFORCED_SETTING_KEYS: readonly string[] = [
  'sessionTimeout',
  'mfaEnforcement',
  'requireMFA',
  'enforceStrongPasswords',
  'passwordMinLength',
  'requireMixedCase',
  'requireSymbol',
  'rateLimitPerMin',
  'webhookUrl',
  'webhookNotifications',
  'ipWhitelist',
  'allowedDomains',
];

export function notEnforcedKeysIn(settings: Record<string, unknown>): string[] {
  return NOT_ENFORCED_SETTING_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(settings, key));
}
