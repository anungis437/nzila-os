/**
 * Client-safe structured logger
 *
 * Provides a lightweight logging interface that works in both browser and
 * Edge runtimes where the full os-core logger (which pulls in Node.js-only
 * APIs like process.stdout, node:crypto, node:async_hooks) cannot be used.
 *
 * In production all messages are captured as Sentry breadcrumbs — no runtime
 * console.* calls occur.
 *
 * @module lib/client-logger
 */

export interface ClientLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: any): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

/* ---------- sink helpers ---------- */

let _sentry: typeof import('@sentry/nextjs') | null = null;

async function getSentry() {
  if (!_sentry) {
    try {
      _sentry = await import('@sentry/nextjs');
    } catch {
      // Sentry not available (build phase / test)
    }
  }
  return _sentry;
}

/**
 * Write a structured breadcrumb into Sentry (fire-and-forget).
 * Falls back to a no-op when Sentry is unavailable.
 */
function writeBreadcrumb(
  level: 'info' | 'warning' | 'error' | 'debug',
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  getSentry().then(S => {
    if (!S) return;
    S.addBreadcrumb({ level, category, message, data });
    if (level === 'error') {
      S.captureMessage(message, { level: 'error', extra: data });
    }
  }).catch(() => {/* noop */});
}

/**
 * Create a namespaced client-safe logger.
 *
 * @param namespace - Short prefix shown in log messages, e.g. "api", "middleware"
 */
export function createClientLogger(namespace: string): ClientLogger {
  return {
    info:  (msg, meta) => writeBreadcrumb('info', namespace, msg, meta),
    warn:  (msg, meta) => writeBreadcrumb('warning', namespace, msg, meta),
    error: (msg, meta) => writeBreadcrumb('error', namespace, msg, meta as Record<string, unknown> | undefined),
    debug: (msg, meta) => writeBreadcrumb('debug', namespace, msg, meta),
  };
}
