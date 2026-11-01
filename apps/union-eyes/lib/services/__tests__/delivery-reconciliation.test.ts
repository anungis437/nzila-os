import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
  },
}));

vi.mock('uuid', () => ({ v4: () => 'ledger-row-1' }));

import {
  decideDeliveryRetry,
  decideProviderCallback,
  recordProviderCallback,
} from '../delivery-reconciliation';

describe('delivery retry decisions', () => {
  it('sends when the ledger has no outcome', () => {
    expect(decideDeliveryRetry([])).toEqual({ action: 'send', retry: false });
  });

  it('holds an attempt that has no terminal outcome', () => {
    expect(decideDeliveryRetry([{ event: 'attempted', externalEventId: 'prov-1' }])).toMatchObject({
      action: 'skip',
      status: 'uncertain',
      providerMessageId: 'prov-1',
    });
  });

  it('does not resend after provider acceptance or confirmed delivery', () => {
    expect(decideDeliveryRetry([{ event: 'accepted', externalEventId: 'prov-2' }])).toMatchObject({
      action: 'skip',
      status: 'sent',
    });
    expect(decideDeliveryRetry([
      { event: 'accepted', externalEventId: 'prov-2' },
      { event: 'delivered', externalEventId: 'prov-2' },
    ])).toMatchObject({ action: 'skip', status: 'delivered' });
  });

  it('resends only a confirmed failure, not a bounce or a suppression', () => {
    expect(decideDeliveryRetry([{ event: 'attempted' }, { event: 'failed' }])).toEqual({ action: 'send', retry: true });
    expect(decideDeliveryRetry([{ event: 'bounced' }])).toMatchObject({ action: 'skip', status: 'bounced' });
    expect(decideDeliveryRetry([{ event: 'suppressed' }])).toMatchObject({ action: 'skip', status: 'failed' });
  });

  it('treats a retry marker after a failure as a new send, and a retry marker after an attempt as uncertain', () => {
    expect(decideDeliveryRetry([{ event: 'failed' }, { event: 'retried' }])).toEqual({ action: 'send', retry: true });
    expect(decideDeliveryRetry([{ event: 'attempted' }, { event: 'retried' }])).toMatchObject({
      action: 'skip',
      status: 'uncertain',
    });
  });
});

describe('provider callbacks', () => {
  it('records a delivery confirmation once and ignores duplicates and downgrades', () => {
    const accepted = [{ event: 'accepted' as const, externalEventId: 'prov-3' }];
    expect(decideProviderCallback(accepted, { event: 'delivered', externalEventId: 'prov-3' })).toBe('record');
    const delivered = [...accepted, { event: 'delivered' as const, externalEventId: 'prov-3' }];
    expect(decideProviderCallback(delivered, { event: 'delivered', externalEventId: 'prov-3' })).toBe('duplicate');
    expect(decideProviderCallback(delivered, { event: 'failed', externalEventId: 'prov-3' })).toBe('ignore-downgrade');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue([]);
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.values.mockResolvedValue(undefined);
    mocks.insert.mockReturnValue({ values: mocks.values });
  });

  it('does not write when the provider message is unknown, duplicated, downgraded, or split across tenants', async () => {
    await expect(recordProviderCallback({
      providerMessageId: 'missing',
      event: 'delivered',
      providerId: 'resend',
      webhookId: 'hook-1',
    })).resolves.toBe('unmatched');

    mocks.limit.mockResolvedValueOnce([
      { event: 'delivered', externalEventId: 'prov-4', organizationId: 'org-1', notificationId: 'note-1' },
    ]);
    await expect(recordProviderCallback({
      providerMessageId: 'prov-4',
      event: 'delivered',
      providerId: 'resend',
      webhookId: 'hook-2',
    })).resolves.toBe('duplicate');

    mocks.limit.mockResolvedValueOnce([
      { event: 'delivered', externalEventId: 'prov-5', organizationId: 'org-1', notificationId: 'note-1' },
    ]);
    await expect(recordProviderCallback({
      providerMessageId: 'prov-5',
      event: 'failed',
      providerId: 'resend',
      webhookId: 'hook-3',
    })).resolves.toBe('ignored');

    mocks.limit.mockResolvedValueOnce([
      { event: 'accepted', externalEventId: 'prov-6', organizationId: 'org-1', notificationId: 'note-1' },
      { event: 'accepted', externalEventId: 'prov-6', organizationId: 'org-2', notificationId: 'note-2' },
    ]);
    await expect(recordProviderCallback({
      providerMessageId: 'prov-6',
      event: 'delivered',
      providerId: 'resend',
      webhookId: 'hook-4',
    })).resolves.toBe('ambiguous');

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('records a confirmation on the tenant that already owns the provider message', async () => {
    mocks.limit.mockResolvedValue([
      { event: 'accepted', externalEventId: 'prov-7', organizationId: 'org-1', notificationId: 'note-7' },
    ]);

    await expect(recordProviderCallback({
      providerMessageId: 'prov-7',
      event: 'delivered',
      providerId: 'resend',
      webhookId: 'hook-5',
    })).resolves.toBe('recorded');

    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      notificationId: 'note-7',
      event: 'delivered',
      externalEventId: 'prov-7',
    }));
  });

  it('treats a unique callback insert as a duplicate and a cross-tenant constraint as ambiguous', async () => {
    mocks.limit.mockResolvedValue([
      { event: 'accepted', externalEventId: 'prov-8', organizationId: 'org-1', notificationId: 'note-8' },
    ]);
    const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    mocks.values.mockRejectedValueOnce(duplicate);
    await expect(recordProviderCallback({
      providerMessageId: 'prov-8',
      event: 'delivered',
      providerId: 'resend',
      webhookId: 'hook-6',
    })).resolves.toBe('duplicate');

    mocks.limit.mockResolvedValue([
      { event: 'accepted', externalEventId: 'prov-9', organizationId: 'org-1', notificationId: 'note-9' },
    ]);
    const foreignOwner = Object.assign(
      new Error('notification_delivery_log provider message prov-9 is already owned by another organization'),
      { code: '23505' },
    );
    mocks.values.mockRejectedValueOnce(foreignOwner);
    await expect(recordProviderCallback({
      providerMessageId: 'prov-9',
      event: 'delivered',
      providerId: 'resend',
      webhookId: 'hook-7',
    })).resolves.toBe('ambiguous');
  });
});
