/**
 * Demo-local logger shim.
 *
 * Wave 0 §2 remediation: replaces `@/lib/logger` (which would resolve into
 * the operational app and pull in operational observability wiring).
 *
 * The demo logger is intentionally minimal: it writes structured JSON to
 * stdout / stderr so container-level log aggregation still works, but it
 * does NOT initialize Sentry, OpenTelemetry, or any other operational
 * telemetry sink. That behaviour matches the Wave 0 §4 rule that the demo
 * must be externally inert.
 */

type LogFields = Record<string, unknown>;

function emit(level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: LogFields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    app: '@nzila/union-eyes-demo',
    msg: message,
    ...(fields ?? {}),
  };
  const line = JSON.stringify(payload);
  process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};
