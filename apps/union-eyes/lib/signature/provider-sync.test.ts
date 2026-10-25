import { describe, expect, it } from 'vitest';
import { decideProviderSync, mayAdvanceSigner } from './provider-sync';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const stored = (over: Partial<Parameters<typeof decideProviderSync>[0]> = {}) => ({
  status: 'sent', provider: 'docusign', providerEnvelopeId: 'env-1', providerAcknowledgedAt: null as Date | null, ...over,
});

describe('decideProviderSync', () => {
  it('ignores the built-in internal provider and a document with no envelope', () => {
    expect(decideProviderSync(stored({ provider: 'internal' }), { status: 'completed' }, NOW)).toEqual({ action: 'ignore', reason: 'not_external_provider' });
    expect(decideProviderSync(stored({ providerEnvelopeId: null }), { status: 'completed' }, NOW)).toEqual({ action: 'ignore', reason: 'no_envelope' });
  });

  it('records a completion with the provider’s own event time as the acknowledgment', () => {
    const event = new Date('2026-02-28T09:30:00.000Z');
    expect(decideProviderSync(stored({ status: 'signed' }), { status: 'completed', completedAt: event }, NOW)).toEqual({
      action: 'apply', status: 'completed', providerAcknowledgedAt: event, statusChanged: true,
    });
  });

  it('records a completion without inventing a time when the provider supplied none', () => {
    expect(decideProviderSync(stored({ status: 'signed' }), { status: 'completed' }, NOW)).toEqual({
      action: 'apply', status: 'completed', providerAcknowledgedAt: null, statusChanged: true,
    });
  });

  it('does not accept a future or invalid time as an event time', () => {
    expect(decideProviderSync(stored(), { status: 'completed', completedAt: new Date('2027-01-01T00:00:00Z') }, NOW)).toMatchObject({ providerAcknowledgedAt: null });
    expect(decideProviderSync(stored(), { status: 'completed', completedAt: new Date('nonsense') }, NOW)).toMatchObject({ providerAcknowledgedAt: null });
  });

  it('never gives a non-completion status an acknowledgment time', () => {
    expect(decideProviderSync(stored(), { status: 'declined', completedAt: new Date('2026-02-01T00:00:00Z') }, NOW)).toMatchObject({ status: 'declined', providerAcknowledgedAt: null });
  });

  it('treats a repeated status as a no-op, except to attach a provider time to an already-completed document once', () => {
    expect(decideProviderSync(stored({ status: 'sent' }), { status: 'sent' }, NOW)).toEqual({ action: 'ignore', reason: 'no_change' });
    const event = new Date('2026-02-28T09:30:00.000Z');
    expect(decideProviderSync(stored({ status: 'completed' }), { status: 'completed' }, NOW)).toEqual({ action: 'ignore', reason: 'no_change' });
    expect(decideProviderSync(stored({ status: 'completed' }), { status: 'completed', completedAt: event }, NOW)).toEqual({
      action: 'apply', status: 'completed', providerAcknowledgedAt: event, statusChanged: false,
    });
    expect(decideProviderSync(stored({ status: 'completed', providerAcknowledgedAt: event }), { status: 'completed', completedAt: new Date('2026-02-28T10:00:00Z') }, NOW)).toEqual({ action: 'ignore', reason: 'no_change' });
  });

  it('keeps a terminal status final against any later or replayed observation', () => {
    for (const terminal of ['completed', 'declined', 'voided', 'expired']) {
      expect(decideProviderSync(stored({ status: terminal }), { status: 'sent' }, NOW)).toEqual({ action: 'ignore', reason: 'terminal_is_final' });
      expect(decideProviderSync(stored({ status: terminal }), { status: 'voided' }, NOW).action).toBe('ignore');
    }
  });

  it('moves a document forward only', () => {
    expect(decideProviderSync(stored({ status: 'viewed' }), { status: 'sent' }, NOW)).toEqual({ action: 'ignore', reason: 'stale_observation' });
    expect(decideProviderSync(stored({ status: 'viewed' }), { status: 'delivered' }, NOW)).toEqual({ action: 'ignore', reason: 'stale_observation' });
    expect(decideProviderSync(stored({ status: 'sent' }), { status: 'viewed' }, NOW)).toMatchObject({ action: 'apply', status: 'viewed', statusChanged: true });
  });

  it('ignores a status it does not know', () => {
    expect(decideProviderSync(stored(), { status: 'teleported' }, NOW)).toEqual({ action: 'ignore', reason: 'unknown_status' });
  });
});

describe('mayAdvanceSigner', () => {
  it('moves forward, never backward, and never out of a settled state', () => {
    expect(mayAdvanceSigner('sent', 'viewed')).toBe(true);
    expect(mayAdvanceSigner('viewed', 'sent')).toBe(false);
    expect(mayAdvanceSigner('viewed', 'signed')).toBe(true);
    expect(mayAdvanceSigner('viewed', 'declined')).toBe(true);
    expect(mayAdvanceSigner('signed', 'viewed')).toBe(false);
    expect(mayAdvanceSigner('signed', 'declined')).toBe(false);
    expect(mayAdvanceSigner('declined', 'signed')).toBe(false);
    expect(mayAdvanceSigner('sent', 'sent')).toBe(false);
  });
});
