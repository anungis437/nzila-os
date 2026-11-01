/**
 * Organization settings that are stored but not enforced by any code.
 *
 * An administrator who saves one of these is told it was saved; nothing in sign-in, session, password, rate-limit or notification code
 * reads it. The settings route reports these keys back as `notEnforced` so that "saved" is not read as "in force", and the screen can
 * say so. A key leaves this list only when code that enforces it exists and is proven.
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
