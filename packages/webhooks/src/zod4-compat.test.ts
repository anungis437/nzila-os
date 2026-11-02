import { describe, expect, it } from 'vitest';
import { CreateWebhookSubscriptionSchema, WebhookEventPayloadSchema } from './types';
const valid = { event: 'order.created', payload: { orderId: 'order-1' }, idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', timestamp: '2026-11-02T00:00:00Z' };
describe('Zod 4 webhook ingress', () => {
  it('accepts keyed event payloads', () => expect(WebhookEventPayloadSchema.parse(valid).payload).toEqual(valid.payload));
  it('rejects array payloads and malformed idempotency keys', () => {
    expect(WebhookEventPayloadSchema.safeParse({ ...valid, payload: ['invalid'] }).success).toBe(false);
    expect(WebhookEventPayloadSchema.safeParse({ ...valid, idempotencyKey: 'invalid' }).success).toBe(false);
  });
  it('enforces subscription event and secret constraints', () => {
    const subscription = { orgId: valid.idempotencyKey, url: 'https://example.org/hook', events: ['order.created'], secret: 'a'.repeat(16), createdBy: 'actor' };
    expect(CreateWebhookSubscriptionSchema.safeParse(subscription).success).toBe(true);
    expect(CreateWebhookSubscriptionSchema.safeParse({ ...subscription, events: [] }).success).toBe(false);
    expect(CreateWebhookSubscriptionSchema.safeParse({ ...subscription, secret: 'short' }).success).toBe(false);
  });
});
