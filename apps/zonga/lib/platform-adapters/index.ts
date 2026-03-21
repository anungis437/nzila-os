/**
 * Platform adapter barrel — zonga
 *
 * Typed adapter contracts for platform integrations.
 * See @nzila/platform-contracts for contract definitions.
 */

export interface HealthAdapter {
  check(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: Record<string, unknown> }>
}

export interface MetricsAdapter {
  trackEvent(name: string, properties: Record<string, string | number | boolean>): void
  trackRevenue(amount: number, currency: string, source: string): void
}

export interface StorageAdapter {
  upload(key: string, data: Buffer | ReadableStream, contentType: string): Promise<{ url: string }>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  delete(key: string): Promise<void>
}

export interface PaymentAdapter {
  createIntent(amount: number, currency: string, metadata: Record<string, string>): Promise<{ intentId: string; clientSecret: string }>
  confirmPayment(intentId: string): Promise<{ status: 'succeeded' | 'failed'; error?: string }>
  refund(intentId: string, amount: number): Promise<{ refundId: string }>
}

export interface NotificationAdapter {
  send(userId: string, channel: 'in_app' | 'email', payload: { title: string; body: string; data?: Record<string, string> }): Promise<void>
}

export interface ModerationAdapter {
  analyzeText(text: string): Promise<{ flagged: boolean; reasons: string[] }>
  analyzeAudio(url: string): Promise<{ fingerprint: string; duplicateOf?: string }>
}
