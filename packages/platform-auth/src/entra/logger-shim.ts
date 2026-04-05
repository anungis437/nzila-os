/**
 * Minimal logger shim to avoid circular dependency with os-core.
 * Falls back to console if no structured logger is available.
 */
export const logger = {
  warn: (...args: unknown[]) => console.warn('[platform-auth]', ...args),
  info: (...args: unknown[]) => console.info('[platform-auth]', ...args),
  error: (...args: unknown[]) => console.error('[platform-auth]', ...args),
}
