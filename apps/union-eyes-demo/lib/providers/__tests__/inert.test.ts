/**
 * Wave 0 §4 — externally-inert provider contract.
 *
 * These tests are the enforcement layer: every provider category
 * exposed by `lib/providers/inert.ts` MUST either throw the
 * `DEMO_NO_EXTERNAL_SIDE_EFFECT` error or log the marker without
 * making any external call. If any of these tests regress, a real
 * external side effect has been reintroduced into the demo surface.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEMO_NO_EXTERNAL_SIDE_EFFECT,
  inertProviders,
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
  getRecentInertCalls,
  resetInertCallLog,
} from '../inert';

describe('demo inert providers — throwing categories', () => {
  beforeEach(() => {
    resetInertCallLog();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('email.send throws DEMO_NO_EXTERNAL_SIDE_EFFECT', () => {
    expect(() =>
      email.send({ to: 'nobody@example.invalid', subject: 'x' }),
    ).toThrow(DEMO_NO_EXTERNAL_SIDE_EFFECT);
  });

  it('email.sendTemplate throws', () => {
    expect(() =>
      email.sendTemplate('welcome', 'nobody@example.invalid', { name: 'x' }),
    ).toThrow(DEMO_NO_EXTERNAL_SIDE_EFFECT);
  });

  it('sms.send throws', () => {
    expect(() => sms.send('+15550000000', 'x')).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('webhook.post throws', () => {
    expect(() => webhook.post('https://example.invalid/hook', {})).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('webhook.put throws', () => {
    expect(() => webhook.put('https://example.invalid/hook', {})).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('payment.createPaymentIntent throws', () => {
    expect(() =>
      payment.createPaymentIntent({ amount: 100, currency: 'CAD' }),
    ).toThrow(DEMO_NO_EXTERNAL_SIDE_EFFECT);
  });

  it('payment.refund throws', () => {
    expect(() => payment.refund('pi_test')).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('push.send throws', () => {
    expect(() => push.send({}, {})).toThrow(DEMO_NO_EXTERNAL_SIDE_EFFECT);
  });

  it('ai.chat throws', () => {
    expect(() => ai.chat('hello')).toThrow(DEMO_NO_EXTERNAL_SIDE_EFFECT);
  });

  it('ai.embed throws', () => {
    expect(() => ai.embed('hello')).toThrow(DEMO_NO_EXTERNAL_SIDE_EFFECT);
  });

  it('ai.transcribe throws', () => {
    expect(() => ai.transcribe(new Uint8Array(0))).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('ocr.extract throws', () => {
    expect(() => ocr.extract(new Uint8Array(0), 'application/pdf')).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('social.postSlack throws', () => {
    expect(() => social.postSlack('#alerts', 'x')).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('social.postTeams throws', () => {
    expect(() => social.postTeams('https://example.invalid', {})).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('calendar.createEvent throws', () => {
    expect(() =>
      calendar.createEvent({
        title: 'x',
        start: '2026-01-01T00:00:00Z',
        end: '2026-01-01T01:00:00Z',
      }),
    ).toThrow(DEMO_NO_EXTERNAL_SIDE_EFFECT);
  });

  it('calendar.cancelEvent throws', () => {
    expect(() => calendar.cancelEvent('evt_1')).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('geocoding.forward throws', () => {
    expect(() => geocoding.forward('1 Wellington St, Ottawa')).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });

  it('geocoding.reverse throws', () => {
    expect(() => geocoding.reverse(45.42, -75.7)).toThrow(
      DEMO_NO_EXTERNAL_SIDE_EFFECT,
    );
  });
});

describe('demo inert providers — no-op categories', () => {
  beforeEach(() => {
    resetInertCallLog();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('analytics.track logs but does not throw', () => {
    expect(() => analytics.track('viewed_dashboard')).not.toThrow();
    const calls = getRecentInertCalls();
    expect(calls.at(-1)?.category).toBe('analytics');
    expect(calls.at(-1)?.operation).toBe('track');
  });

  it('analytics.identify logs but does not throw', () => {
    expect(() => analytics.identify('user_1', { role: 'steward' })).not.toThrow();
    expect(getRecentInertCalls().at(-1)?.operation).toBe('identify');
  });

  it('analytics.page logs but does not throw', () => {
    expect(() => analytics.page('/dashboard')).not.toThrow();
  });

  it('observability.captureException logs but does not throw', () => {
    expect(() => observability.captureException(new Error('x'))).not.toThrow();
    expect(getRecentInertCalls().at(-1)?.category).toBe('observability');
  });

  it('observability.captureMessage logs but does not throw', () => {
    expect(() => observability.captureMessage('boot')).not.toThrow();
  });

  it('observability.addBreadcrumb logs but does not throw', () => {
    expect(() =>
      observability.addBreadcrumb({ category: 'nav', message: '/' }),
    ).not.toThrow();
  });
});

describe('demo inert providers — enumeration coverage', () => {
  it('exposes all 12 required categories', () => {
    expect(Object.keys(inertProviders).sort()).toEqual(
      [
        'ai',
        'analytics',
        'calendar',
        'email',
        'geocoding',
        'observability',
        'ocr',
        'payment',
        'push',
        'sms',
        'social',
        'webhook',
      ].sort(),
    );
  });

  it('every warn line embeds the marker', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetInertCallLog();
    analytics.track('x');
    observability.captureMessage('y');
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(String(call[0])).toContain(DEMO_NO_EXTERNAL_SIDE_EFFECT);
    }
  });
});
