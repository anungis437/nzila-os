/**
 * @nzila/platform-event-fabric — Analytics Bridge
 *
 * Bridges platform events to external analytics providers
 * (PostHog, Mixpanel, Amplitude, Segment, or custom).
 *
 * Closes the "third-party analytics" gap.
 *
 * Design:
 *   - Provider-agnostic adapter pattern
 *   - Configurable event filtering (only forward what matters)
 *   - Batch support for high-throughput
 *   - Privacy-aware: PII stripping before forwarding
 *
 * The bridge subscribes to the platform event bus and forwards
 * matching events to one or more analytics adapters.
 *
 * @module @nzila/platform-event-fabric/analytics-bridge
 */
import type {
  PlatformEvent,
  PlatformEventBus,
  Unsubscribe,
} from './types'

// ── Analytics Adapter Interface ─────────────────────────────────────────────

/**
 * An analytics adapter sends events to an external analytics provider.
 * Implementations are injected at runtime (no hard dependency on any SDK).
 */
export interface AnalyticsAdapter {
  /** Human-readable name (e.g., 'posthog', 'mixpanel'). */
  readonly name: string

  /** Send a single analytics event. */
  track(event: AnalyticsEvent): Promise<void>

  /** Send a batch of events (optional — falls back to sequential track). */
  trackBatch?(events: AnalyticsEvent[]): Promise<void>

  /** Identify a user with properties (for user-centric analytics). */
  identify?(userId: string, properties: Record<string, unknown>): Promise<void>

  /** Flush any internal buffers. */
  flush?(): Promise<void>
}

// ── Analytics Event Shape ───────────────────────────────────────────────────

export interface AnalyticsEvent {
  /** Event name (mapped from platform event type). */
  readonly eventName: string
  /** Distinct user/actor ID. */
  readonly distinctId: string
  /** Organisation context. */
  readonly orgId?: string
  /** Event properties (PII-stripped). */
  readonly properties: Readonly<Record<string, unknown>>
  /** ISO-8601 timestamp. */
  readonly timestamp: string
}

// ── Event Mapping ───────────────────────────────────────────────────────────

/**
 * Maps a platform event type to an analytics event name.
 * Returns null to skip forwarding.
 */
export type EventMapper = (platformEventType: string) => string | null

/**
 * Default event mapper: converts dot-notation to snake_case.
 * e.g., 'case.created' → 'case_created'
 */
export const defaultEventMapper: EventMapper = (type) =>
  type.replace(/\./g, '_')

// ── PII Stripping ───────────────────────────────────────────────────────────

const PII_KEYS = new Set([
  'email',
  'phone',
  'password',
  'ssn',
  'sin',
  'dob',
  'dateOfBirth',
  'date_of_birth',
  'address',
  'postal_code',
  'postalCode',
  'ip',
  'ipAddress',
  'ip_address',
  'creditCard',
  'credit_card',
  'bankAccount',
  'bank_account',
])

/**
 * Strip PII keys from a payload. Returns a new object.
 */
export function stripPII(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (PII_KEYS.has(key)) continue
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      cleaned[key] = stripPII(value as Record<string, unknown>)
    } else {
      cleaned[key] = value
    }
  }
  return cleaned
}

// ── Bridge Configuration ────────────────────────────────────────────────────

export interface AnalyticsBridgeConfig {
  /** Adapters to forward events to. */
  readonly adapters: readonly AnalyticsAdapter[]
  /** Optional event type filter (allowlist). Omit to forward all events. */
  readonly allowedEventTypes?: readonly string[]
  /** Optional event type denylist. Applied after allowlist. */
  readonly deniedEventTypes?: readonly string[]
  /** Custom event name mapper. */
  readonly eventMapper?: EventMapper
  /** Strip PII before forwarding (default: true). */
  readonly stripPii?: boolean
  /** Error handler. */
  readonly onError?: (error: unknown, event: PlatformEvent) => void
}

// ── Bridge Implementation ───────────────────────────────────────────────────

/**
 * Create an analytics bridge that subscribes to the platform event bus
 * and forwards events to external analytics providers.
 *
 * Returns an unsubscribe function to tear down the bridge.
 *
 * @example
 * ```ts
 * const unsub = createAnalyticsBridge(bus, {
 *   adapters: [posthogAdapter],
 *   allowedEventTypes: ['case.created', 'case.closed', 'payment.received'],
 *   stripPii: true,
 * })
 * // Later: unsub() to stop forwarding
 * ```
 */
export function createAnalyticsBridge(
  bus: PlatformEventBus,
  config: AnalyticsBridgeConfig,
): Unsubscribe {
  const {
    adapters,
    allowedEventTypes,
    deniedEventTypes,
    eventMapper = defaultEventMapper,
    stripPii = true,
    onError,
  } = config

  const allowSet = allowedEventTypes ? new Set(allowedEventTypes) : null
  const denySet = deniedEventTypes ? new Set(deniedEventTypes) : null

  function shouldForward(eventType: string): boolean {
    if (denySet?.has(eventType)) return false
    if (allowSet && !allowSet.has(eventType)) return false
    return true
  }

  function mapToAnalyticsEvent(event: PlatformEvent): AnalyticsEvent | null {
    const eventName = eventMapper(event.type)
    if (!eventName) return null

    const payload = typeof event.payload === 'object' && event.payload !== null
      ? (event.payload as Record<string, unknown>)
      : {}

    const properties = stripPii ? stripPII(payload) : payload

    return {
      eventName,
      distinctId: event.metadata.actorId,
      orgId: event.metadata.orgId,
      properties: {
        ...properties,
        source: event.metadata.source,
        correlationId: event.metadata.correlationId,
      },
      timestamp: event.createdAt,
    }
  }

  const unsubscribe = bus.subscribeAll(async (event) => {
    if (!shouldForward(event.type)) return

    const analyticsEvent = mapToAnalyticsEvent(event)
    if (!analyticsEvent) return

    for (const adapter of adapters) {
      try {
        await adapter.track(analyticsEvent)
      } catch (error) {
        onError?.(error, event)
      }
    }
  })

  return unsubscribe
}

// ── Console Adapter (Development) ───────────────────────────────────────────

/**
 * A development adapter that logs analytics events to console.
 * Useful for verifying the bridge works before wiring a real provider.
 */
export function createConsoleAnalyticsAdapter(): AnalyticsAdapter {
  return {
    name: 'console',
    async track(event) {
      console.log(`[analytics:${event.eventName}]`, {
        distinctId: event.distinctId,
        orgId: event.orgId,
        properties: event.properties,
        timestamp: event.timestamp,
      })
    },
    async identify(userId, properties) {
      console.log(`[analytics:identify]`, { userId, properties })
    },
  }
}

// ── In-Memory Adapter (Testing) ─────────────────────────────────────────────

export interface InMemoryAnalyticsStore {
  readonly events: AnalyticsEvent[]
  readonly identifications: { userId: string; properties: Record<string, unknown> }[]
  clear(): void
}

/**
 * An in-memory adapter that captures analytics events for testing.
 */
export function createInMemoryAnalyticsAdapter(): AnalyticsAdapter & {
  store: InMemoryAnalyticsStore
} {
  const events: AnalyticsEvent[] = []
  const identifications: { userId: string; properties: Record<string, unknown> }[] = []

  const store: InMemoryAnalyticsStore = {
    events,
    identifications,
    clear() {
      events.length = 0
      identifications.length = 0
    },
  }

  return {
    name: 'in-memory',
    store,
    async track(event) {
      events.push(event)
    },
    async trackBatch(batch) {
      events.push(...batch)
    },
    async identify(userId, properties) {
      identifications.push({ userId, properties })
    },
    async flush() {
      // no-op for in-memory
    },
  }
}
