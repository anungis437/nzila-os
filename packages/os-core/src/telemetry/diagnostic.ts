import { redactFields, type Logger, type LogLevel } from './logger'

/**
 * Best-effort diagnostics must not replace or interrupt the operation they describe.
 * The emergency sink deliberately receives no message, metadata or caught error.
 */
export function writeDiagnostic(
  logger: Logger,
  level: LogLevel,
  message: string,
  metadata: Record<string, unknown> = {},
): void {
  try {
    logger[level](message, {
      ...redactFields(metadata),
      orgId: '[REDACTED]',
      userId: '[REDACTED]',
    })
  } catch {
    try {
      process.stderr.write('{"level":"error","message":"Structured diagnostic sink failed"}\n')
    } catch {
      // No application/database audit recursion when the output stream is unavailable.
      try {
        process.emitWarning('Diagnostic output unavailable', { code: 'DIAGNOSTIC_SINK_FAILED' })
      } catch {
        // All diagnostic sinks are unavailable; preserve the primary operation.
      }
    }
  }
}
