import { describe, expect, it } from 'vitest';
import { advanceStatus, alreadyCounted, keysToCount, nextMetadata } from '../resend-event-rules';

describe('resend event rules', () => {
  it('only moves a status to a higher rank', () => {
    expect(advanceStatus('delivered', 'sent')).toBe('delivered');
    expect(advanceStatus('sent', 'delivered')).toBe('delivered');
    expect(advanceStatus('bounced', 'opened')).toBe('bounced');
    expect(advanceStatus('delivered', 'complained')).toBe('complained');
    expect(advanceStatus('complained', 'bounced')).toBe('complained');
    expect(advanceStatus('queued', 'sent')).toBe('sent');
    expect(advanceStatus(null, 'sent')).toBe('sent');
  });

  it('reads what a row already contributed from its timestamps, its terminal status and its recorded set', () => {
    const counted = alreadyCounted({ sentAt: new Date(), status: 'failed', metadata: { resendCounted: ['bounced', 'not-a-key'] } });
    expect([...counted].sort()).toEqual(['bounced', 'failed', 'sent']);
    expect(alreadyCounted({ metadata: 'garbage' }).size).toBe(0);
  });

  it('counts an event once, and a click also counts the open it implies', () => {
    expect(keysToCount('delivered', new Set())).toEqual(['delivered']);
    expect(keysToCount('delivered', new Set(['delivered']))).toEqual([]);
    expect(keysToCount('clicked', new Set())).toEqual(['clicked', 'opened']);
    expect(keysToCount('clicked', new Set(['opened']))).toEqual(['clicked']);
    expect(keysToCount('clicked', new Set(['clicked', 'opened']))).toEqual([]);
  });

  it('keeps existing metadata and only grows the counted set', () => {
    const meta = nextMetadata({ keep: 1 }, new Set(['sent']), ['delivered'], { type: 'email.delivered', createdAt: 't', lastErrorMessage: 'old' });
    expect(meta).toMatchObject({ keep: 1, lastErrorMessage: 'old', resendEventType: 'email.delivered', resendCounted: ['sent', 'delivered'] });
    expect(nextMetadata(null, new Set(), [], { type: 'x' })).toMatchObject({ resendCounted: [] });
  });
});
