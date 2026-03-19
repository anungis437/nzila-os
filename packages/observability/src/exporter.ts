import type { Span } from './spans.js'

// ─── Exporter Interface ─────────────────────────────────────────────────────

export interface TelemetryExporter {
  readonly name: string
  exportSpan(span: Span): void
  flush(): Promise<void>
  shutdown(): Promise<void>
}

// ─── Console Exporter (dev) ─────────────────────────────────────────────────

export class ConsoleExporter implements TelemetryExporter {
  readonly name = 'console'

  exportSpan(span: Span): void {
    const output = {
      name: span.name,
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      status: span.status,
      durationMs: span.durationMs,
      attributes: span.attributes,
      events: span.events,
    }
    process.stdout.write(`[SPAN] ${JSON.stringify(output)}\n`)
  }

  async flush(): Promise<void> {
    // Console exporter is synchronous
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}

// ─── OTLP HTTP Exporter ─────────────────────────────────────────────────────

export interface OtlpExporterConfig {
  readonly endpoint: string
  readonly headers: Record<string, string>
  readonly batchSize: number
  readonly flushIntervalMs: number
}

export class OtlpHttpExporter implements TelemetryExporter {
  readonly name = 'otlp-http'
  private readonly config: OtlpExporterConfig
  private buffer: Span[] = []
  private flushTimer: ReturnType<typeof setInterval> | undefined

  constructor(config: Partial<OtlpExporterConfig> & { endpoint: string }) {
    this.config = {
      endpoint: config.endpoint,
      headers: config.headers ?? {},
      batchSize: config.batchSize ?? 100,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
    }

    this.flushTimer = setInterval(() => {
      void this.flush()
    }, this.config.flushIntervalMs)

    if (typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref()
    }
  }

  exportSpan(span: Span): void {
    this.buffer.push(span)
    if (this.buffer.length >= this.config.batchSize) {
      void this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    const batch = this.buffer.splice(0, this.config.batchSize)
    const payload = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: '@nzila/observability' },
          spans: batch.map(toOtlpSpan),
        }],
      }],
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        process.stderr.write(
          `[OTLP] Export failed: ${response.status} ${response.statusText}\n`,
        )
        // Re-queue failed spans (bounded to prevent memory leak)
        if (this.buffer.length < this.config.batchSize * 10) {
          this.buffer.unshift(...batch)
        }
      }
    } catch (err) {
      process.stderr.write(
        `[OTLP] Export error: ${err instanceof Error ? err.message : String(err)}\n`,
      )
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
    await this.flush()
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toOtlpSpan(span: Span) {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId ?? '',
    name: span.name,
    kind: 1, // INTERNAL
    startTimeUnixNano: span.startTime * 1_000_000,
    endTimeUnixNano: (span.endTime ?? span.startTime) * 1_000_000,
    attributes: Object.entries(span.attributes).map(([key, value]) => ({
      key,
      value: toOtlpValue(value),
    })),
    events: span.events.map((e) => ({
      name: e.name,
      timeUnixNano: e.timestamp * 1_000_000,
      attributes: Object.entries(e.attributes).map(([key, value]) => ({
        key,
        value: toOtlpValue(value),
      })),
    })),
    status: { code: span.status === 'error' ? 2 : span.status === 'ok' ? 1 : 0 },
  }
}

function toOtlpValue(v: string | number | boolean) {
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return { intValue: v }
  return { boolValue: v }
}

// ─── Multi-Exporter ─────────────────────────────────────────────────────────

export class MultiExporter implements TelemetryExporter {
  readonly name = 'multi'
  private readonly exporters: TelemetryExporter[]

  constructor(exporters: TelemetryExporter[]) {
    this.exporters = exporters
  }

  exportSpan(span: Span): void {
    for (const exporter of this.exporters) {
      exporter.exportSpan(span)
    }
  }

  async flush(): Promise<void> {
    await Promise.all(this.exporters.map((e) => e.flush()))
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.exporters.map((e) => e.shutdown()))
  }
}
