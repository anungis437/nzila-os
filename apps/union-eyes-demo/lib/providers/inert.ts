/**
 * Externally-inert provider stubs for the Union Eyes demo (Wave 0 §4).
 *
 * The demo environment MUST NOT reach any real third-party provider.
 * These stubs are the canonical demo-scoped replacements for the
 * twelve prohibited categories:
 *
 *   1. email        (SendGrid / Resend / SES / Microsoft Graph mail)
 *   2. sms          (Twilio / MessageBird / Vonage)
 *   3. webhook      (Zapier / Make / n8n / arbitrary outbound HTTP)
 *   4. payment      (Stripe / PayPal / Interac)
 *   5. push         (APNs / FCM / Web Push)
 *   6. analytics    (GA4 / Segment / PostHog / Amplitude)
 *   7. observability(Sentry / Datadog / OTLP exporter)
 *   8. ai           (OpenAI / Azure OpenAI / Anthropic / Google Gemini)
 *   9. ocr          (Tesseract cloud / Azure Doc AI / AWS Textract)
 *  10. social       (Slack / Teams / Discord / Twitter / LinkedIn)
 *  11. calendar     (Google Cal / Outlook / iCal push)
 *  12. geocoding    (Google Maps / Mapbox / Azure Maps)
 *
 * Structural guarantee: every exported operation calls
 * {@link failInert} which logs a `DEMO_NO_EXTERNAL_SIDE_EFFECT` line
 * and throws. Nothing here opens a socket, imports a real SDK, or
 * touches `process.env` for a real API key. Tests in
 * `__tests__/inert.test.ts` enforce this contract.
 *
 * If future demo code needs a soft no-op instead of a throw
 * (e.g. best-effort analytics), use {@link noopInert} which logs the
 * same marker but returns `undefined` and never throws.
 */
import 'server-only';

/**
 * The single wire-format tag every demo provider emits. Log scrapers,
 * scanners, and tests all key off this exact string. Do NOT rename.
 */
export const DEMO_NO_EXTERNAL_SIDE_EFFECT = 'DEMO_NO_EXTERNAL_SIDE_EFFECT' as const;

export type ProviderCategory =
  | 'email'
  | 'sms'
  | 'webhook'
  | 'payment'
  | 'push'
  | 'analytics'
  | 'observability'
  | 'ai'
  | 'ocr'
  | 'social'
  | 'calendar'
  | 'geocoding';

export interface InertCallRecord {
  category: ProviderCategory;
  operation: string;
  argsSummary: string;
  timestamp: string;
}

const RECENT_CALLS: InertCallRecord[] = [];
const MAX_RECENT = 100;

function recordCall(record: InertCallRecord): void {
  RECENT_CALLS.push(record);
  if (RECENT_CALLS.length > MAX_RECENT) {
    RECENT_CALLS.shift();
  }
}

/** Test-only: inspect the last N inert calls. Read-only snapshot. */
export function getRecentInertCalls(): readonly InertCallRecord[] {
  return [...RECENT_CALLS];
}

/** Test-only: reset the recorded-call ring buffer. */
export function resetInertCallLog(): void {
  RECENT_CALLS.length = 0;
}

function summarize(args: unknown): string {
  try {
    const s = JSON.stringify(args);
    return s.length > 240 ? s.slice(0, 237) + '...' : s;
  } catch {
    return '[unserializable]';
  }
}

/**
 * Log the DEMO_NO_EXTERNAL_SIDE_EFFECT marker and throw. Use for
 * operations where a silent no-op would mask a real integration bug.
 */
export function failInert(
  category: ProviderCategory,
  operation: string,
  args?: unknown,
): never {
  const record: InertCallRecord = {
    category,
    operation,
    argsSummary: summarize(args),
    timestamp: new Date().toISOString(),
  };
  recordCall(record);
  // eslint-disable-next-line no-console
  console.warn(
    `[${DEMO_NO_EXTERNAL_SIDE_EFFECT}] category=${category} op=${operation} args=${record.argsSummary}`,
  );
  throw new Error(
    `${DEMO_NO_EXTERNAL_SIDE_EFFECT}: ${category}.${operation} is disabled in the demo environment.`,
  );
}

/**
 * Log the marker and return `undefined`. Use for fire-and-forget
 * telemetry-style operations where throwing would break request flow.
 */
export function noopInert(
  category: ProviderCategory,
  operation: string,
  args?: unknown,
): void {
  const record: InertCallRecord = {
    category,
    operation,
    argsSummary: summarize(args),
    timestamp: new Date().toISOString(),
  };
  recordCall(record);
  // eslint-disable-next-line no-console
  console.warn(
    `[${DEMO_NO_EXTERNAL_SIDE_EFFECT}] category=${category} op=${operation} args=${record.argsSummary}`,
  );
}

// ── 1. Email ────────────────────────────────────────────────────────
export interface DemoEmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}
export const email = {
  send(msg: DemoEmailMessage): never {
    return failInert('email', 'send', { to: msg.to, subject: msg.subject });
  },
  sendTemplate(template: string, to: string | string[], vars?: Record<string, unknown>): never {
    return failInert('email', 'sendTemplate', { template, to, vars });
  },
} as const;

// ── 2. SMS ──────────────────────────────────────────────────────────
export const sms = {
  send(to: string, body: string): never {
    return failInert('sms', 'send', { to, bodyLen: body.length });
  },
} as const;

// ── 3. Webhook ──────────────────────────────────────────────────────
export const webhook = {
  post(url: string, body: unknown): never {
    return failInert('webhook', 'post', { url });
  },
  put(url: string, body: unknown): never {
    return failInert('webhook', 'put', { url });
  },
} as const;

// ── 4. Payment ──────────────────────────────────────────────────────
export const payment = {
  createPaymentIntent(args: { amount: number; currency: string; customerId?: string }): never {
    return failInert('payment', 'createPaymentIntent', args);
  },
  refund(paymentIntentId: string): never {
    return failInert('payment', 'refund', { paymentIntentId });
  },
} as const;

// ── 5. Push notifications ───────────────────────────────────────────
export const push = {
  send(subscription: unknown, payload: unknown): never {
    return failInert('push', 'send', {});
  },
} as const;

// ── 6. Analytics ────────────────────────────────────────────────────
export const analytics = {
  track(event: string, props?: Record<string, unknown>): void {
    noopInert('analytics', 'track', { event, propKeys: props ? Object.keys(props) : [] });
  },
  identify(userId: string, traits?: Record<string, unknown>): void {
    noopInert('analytics', 'identify', { userId, traitKeys: traits ? Object.keys(traits) : [] });
  },
  page(name: string): void {
    noopInert('analytics', 'page', { name });
  },
} as const;

// ── 7. Observability ────────────────────────────────────────────────
export const observability = {
  captureException(err: unknown): void {
    noopInert('observability', 'captureException', {
      name: err instanceof Error ? err.name : typeof err,
    });
  },
  captureMessage(msg: string): void {
    noopInert('observability', 'captureMessage', { msg });
  },
  addBreadcrumb(bc: { category?: string; message?: string }): void {
    noopInert('observability', 'addBreadcrumb', bc);
  },
} as const;

// ── 8. AI ───────────────────────────────────────────────────────────
export const ai = {
  chat(prompt: string, opts?: Record<string, unknown>): never {
    return failInert('ai', 'chat', { promptLen: prompt.length, opts });
  },
  embed(text: string): never {
    return failInert('ai', 'embed', { textLen: text.length });
  },
  transcribe(audio: Uint8Array | Buffer): never {
    return failInert('ai', 'transcribe', { bytes: audio.byteLength });
  },
} as const;

// ── 9. OCR ──────────────────────────────────────────────────────────
export const ocr = {
  extract(file: Uint8Array | Buffer, mimeType: string): never {
    return failInert('ocr', 'extract', { bytes: file.byteLength, mimeType });
  },
} as const;

// ── 10. Social ──────────────────────────────────────────────────────
export const social = {
  postSlack(channel: string, text: string): never {
    return failInert('social', 'postSlack', { channel, textLen: text.length });
  },
  postTeams(webhook: string, card: unknown): never {
    return failInert('social', 'postTeams', {});
  },
} as const;

// ── 11. Calendar ────────────────────────────────────────────────────
export const calendar = {
  createEvent(args: { title: string; start: string; end: string; attendees?: string[] }): never {
    return failInert('calendar', 'createEvent', args);
  },
  cancelEvent(eventId: string): never {
    return failInert('calendar', 'cancelEvent', { eventId });
  },
} as const;

// ── 12. Geocoding ───────────────────────────────────────────────────
export const geocoding = {
  forward(address: string): never {
    return failInert('geocoding', 'forward', { address });
  },
  reverse(lat: number, lon: number): never {
    return failInert('geocoding', 'reverse', { lat, lon });
  },
} as const;

/** Aggregate map, handy for tests / audits that want to enumerate. */
export const inertProviders = {
  email,
  sms,
  webhook,
  payment,
  push,
  analytics,
  observability,
  ai,
  ocr,
  social,
  calendar,
  geocoding,
} as const;
