import { describe, expect, it } from 'vitest';
import { ApiShapeError } from '@/lib/client/api-envelope';
import { campaignFrom, counter, rate } from '../campaign-record';

// A campaign as the CRUD routes answer it: the table's row, with the defaults a new draft takes.
const row = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  organizationId: 'org-1',
  name: 'Dues drive',
  description: null,
  type: 'broadcast',
  channel: 'email',
  status: 'draft',
  subject: 'Dues are due',
  body: 'Please pay by Friday',
  audienceCount: 0,
  scheduledAt: null,
  sentAt: null,
  completedAt: null,
  stats: { queued: 0, sent: 0, delivered: 0, bounced: 0, failed: 0, opened: 0, clicked: 0, unsubscribed: 0 },
  settings: { trackOpens: true, trackClicks: true, respectQuietHours: true },
  createdAt: '2026-01-05T10:00:00Z',
  updatedAt: '2026-01-05T10:00:00Z',
  ...over,
});

describe('campaignFrom', () => {
  it('reads the stored fields of a campaign, and the counters its stats object holds', () => {
    const campaign = campaignFrom(row({ audienceCount: 12, stats: { queued: 1, sent: 2, delivered: 3, bounced: 4, failed: 5, opened: 6, clicked: 7, unsubscribed: 8 } }));

    expect(campaign).toMatchObject({ id: 'c1', name: 'Dues drive', type: 'broadcast', channel: 'email', status: 'draft', subject: 'Dues are due', body: 'Please pay by Friday', audienceCount: 12 });
    expect(campaign.stats).toEqual({ queued: 1, sent: 2, delivered: 3, failed: 5, bounced: 4, opened: 6, clicked: 7, unsubscribed: 8 });
    expect(campaign.trackOpens).toBe(true);
    expect(campaign.trackClicks).toBe(true);
  });

  it('keeps a counter the record does not hold as null, not 0, whether the stats object is missing, empty or partial', () => {
    for (const stats of [undefined, null, {}, 'x', []]) {
      expect(Object.values(campaignFrom(row({ stats })).stats)).toEqual(Array(8).fill(null));
    }
    expect(campaignFrom(row({ stats: { sent: 5, opened: 'many' } })).stats).toMatchObject({ sent: 5, opened: null, delivered: null });
  });

  it('keeps an audience count the record does not hold as null', () => {
    expect(campaignFrom(row({ audienceCount: null })).audienceCount).toBeNull();
    expect(campaignFrom(row({ audienceCount: '12' })).audienceCount).toBeNull();
  });

  it('reads tracking as on only where the settings say so', () => {
    expect(campaignFrom(row({ settings: { trackOpens: false, trackClicks: true } }))).toMatchObject({ trackOpens: false, trackClicks: true });
    expect(campaignFrom(row({ settings: null }))).toMatchObject({ trackOpens: false, trackClicks: false });
    expect(campaignFrom(row({ settings: { trackOpens: 'yes' } }))).toMatchObject({ trackOpens: false });
  });

  it('reads a body the row leaves empty as empty text, and a description or subject it leaves empty as none', () => {
    expect(campaignFrom(row({ body: null, subject: null, description: null }))).toMatchObject({ body: '', subject: null, description: null });
  });

  it.each(['id', 'name', 'type', 'channel', 'status', 'createdAt'])('refuses a record with no %s, which a campaign always has', (field) => {
    expect(() => campaignFrom(row({ [field]: undefined }))).toThrow(ApiShapeError);
  });

  it.each([null, undefined, 'campaign', 7, ['c1']])('refuses %j, which is not a record', (value) => {
    expect(() => campaignFrom(value)).toThrow(ApiShapeError);
  });
});

describe('counter', () => {
  it('is the number, and null for anything else', () => {
    expect(counter(0)).toBe(0);
    expect(counter(7)).toBe(7);
    for (const value of [undefined, null, '7', Number.NaN, Number.POSITIVE_INFINITY, {}]) expect(counter(value)).toBeNull();
  });
});

describe('rate', () => {
  it('is a percentage to one decimal place', () => {
    expect(rate(8, 10)).toBe('80.0');
    expect(rate(1, 3)).toBe('33.3');
    expect(rate(0, 10)).toBe('0.0');
  });

  it('is null, not 0% and not NaN, when the base is zero or either figure is not recorded', () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
    expect(rate(null, 10)).toBeNull();
    expect(rate(5, null)).toBeNull();
    expect(rate(null, null)).toBeNull();
  });
});
