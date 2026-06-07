/**
 * AutoPay Utilities — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockReturning: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockStripeCustomersRetrieve: vi.fn(),
  mockStripePaymentMethodsRetrieve: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
    insert: mocks.mockInsert,
  },
}));

vi.mock('@/db/schema', () => ({
  autoPaySettings: {
    userId: 'user_id',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { retrieve: mocks.mockStripeCustomersRetrieve },
    paymentMethods: { retrieve: mocks.mockStripePaymentMethodsRetrieve },
  },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  getAutoPaySettings,
  getStripeCustomer,
  getStripePaymentMethod,
  getPaymentMethodLast4,
  getPaymentMethodBrand,
  upsertAutoPaySettings,
  disableAutoPay,
  getAutoPaySettingsWithPaymentMethod,
} from '../utils/autopay-utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSelectChain(rows: any[]) {
  mocks.mockLimit.mockResolvedValue(rows);
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

function setupUpdateChain(returnRows: any[]) {
  mocks.mockReturning.mockResolvedValue(returnRows);
  mocks.mockUpdateWhere.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockSet.mockReturnValue({ where: mocks.mockUpdateWhere });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });
}

function setupInsertChain(returnRows: any[]) {
  mocks.mockInsertReturning.mockResolvedValue(returnRows);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockInsertReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('autopay-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getAutoPaySettings ───────────────────────────────────────────────────

  describe('getAutoPaySettings', () => {
    it('returns settings when found', async () => {
      const settings = { userId: 'user-1', enabled: true, frequency: 'monthly' };
      setupSelectChain([settings]);
      const result = await getAutoPaySettings('user-1');
      expect(result).toEqual(settings);
    });

    it('returns null when not found', async () => {
      setupSelectChain([]);
      const result = await getAutoPaySettings('user-999');
      expect(result).toBeNull();
    });
  });

  // ── getStripeCustomer ────────────────────────────────────────────────────

  describe('getStripeCustomer', () => {
    it('returns customer when found', async () => {
      const customer = { id: 'cus_123', name: 'Alice', deleted: undefined };
      mocks.mockStripeCustomersRetrieve.mockResolvedValue(customer);
      const result = await getStripeCustomer('cus_123');
      expect(result).toEqual(customer);
    });

    it('returns null for deleted customer', async () => {
      mocks.mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_123', deleted: true });
      const result = await getStripeCustomer('cus_123');
      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      mocks.mockStripeCustomersRetrieve.mockRejectedValue(new Error('Not found'));
      const result = await getStripeCustomer('cus_bad');
      expect(result).toBeNull();
    });
  });

  // ── getStripePaymentMethod ───────────────────────────────────────────────

  describe('getStripePaymentMethod', () => {
    it('returns payment method when found', async () => {
      const pm = { id: 'pm_123', type: 'card', card: { last4: '4242', brand: 'visa' } };
      mocks.mockStripePaymentMethodsRetrieve.mockResolvedValue(pm);
      const result = await getStripePaymentMethod('pm_123');
      expect(result).toEqual(pm);
    });

    it('returns null on error', async () => {
      mocks.mockStripePaymentMethodsRetrieve.mockRejectedValue(new Error('Not found'));
      const result = await getStripePaymentMethod('pm_bad');
      expect(result).toBeNull();
    });
  });

  // ── getPaymentMethodLast4 ────────────────────────────────────────────────

  describe('getPaymentMethodLast4', () => {
    it('returns last4 for card', () => {
      const result = getPaymentMethodLast4({
        type: 'card',
        card: { last4: '4242' },
      } as any as Parameters<typeof getPaymentMethodLast4>[0]);
      expect(result).toBe('4242');
    });

    it('returns last4 for us_bank_account', () => {
      const result = getPaymentMethodLast4({
        type: 'us_bank_account',
        us_bank_account: { last4: '6789' },
      } as any as Parameters<typeof getPaymentMethodLast4>[0]);
      expect(result).toBe('6789');
    });

    it('returns null for unknown type', () => {
      const result = getPaymentMethodLast4({
        type: 'paypal',
      } as any as Parameters<typeof getPaymentMethodLast4>[0]);
      expect(result).toBeNull();
    });
  });

  // ── getPaymentMethodBrand ────────────────────────────────────────────────

  describe('getPaymentMethodBrand', () => {
    it('returns card brand', () => {
      const result = getPaymentMethodBrand({
        type: 'card',
        card: { brand: 'visa' },
      } as any as Parameters<typeof getPaymentMethodBrand>[0]);
      expect(result).toBe('visa');
    });

    it('returns bank name for us_bank_account', () => {
      const result = getPaymentMethodBrand({
        type: 'us_bank_account',
        us_bank_account: { bank_name: 'Chase' },
      } as any as Parameters<typeof getPaymentMethodBrand>[0]);
      expect(result).toBe('Chase');
    });

    it('returns bank_account fallback when no bank name', () => {
      const result = getPaymentMethodBrand({
        type: 'us_bank_account',
        us_bank_account: { bank_name: null },
      } as any as Parameters<typeof getPaymentMethodBrand>[0]);
      expect(result).toBe('bank_account');
    });

    it('returns type for unknown payment methods', () => {
      const result = getPaymentMethodBrand({
        type: 'sepa_debit',
      } as any as Parameters<typeof getPaymentMethodBrand>[0]);
      expect(result).toBe('sepa_debit');
    });
  });

  // ── upsertAutoPaySettings ───────────────────────────────────────────────

  describe('upsertAutoPaySettings', () => {
    it('updates existing settings', async () => {
      // getAutoPaySettings returns existing
      const existing = { userId: 'user-1', enabled: true };
      setupSelectChain([existing]);
      // update returns updated record
      const updated = { ...existing, enabled: false };
      setupUpdateChain([updated]);

      const result = await upsertAutoPaySettings({
        userId: 'user-1',
        enabled: false,
      });
      expect(result).toEqual(updated);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('creates new settings when none exist', async () => {
      // getAutoPaySettings returns null
      setupSelectChain([]);
      // insert returns created record
      const created = { userId: 'user-1', enabled: true, frequency: 'monthly' };
      setupInsertChain([created]);

      const result = await upsertAutoPaySettings({
        userId: 'user-1',
        enabled: true,
      });
      expect(result).toEqual(created);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('defaults frequency to monthly', async () => {
      setupSelectChain([]);
      setupInsertChain([{ userId: 'user-1', frequency: 'monthly' }]);

      await upsertAutoPaySettings({ userId: 'user-1', enabled: true });
      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 'monthly' }),
      );
    });
  });

  // ── disableAutoPay ───────────────────────────────────────────────────────

  describe('disableAutoPay', () => {
    it('sets enabled to false and returns updated', async () => {
      const updated = { userId: 'user-1', enabled: false };
      setupUpdateChain([updated]);

      const result = await disableAutoPay('user-1');
      expect(result).toEqual(updated);
      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });
  });

  // ── getAutoPaySettingsWithPaymentMethod ──────────────────────────────────

  describe('getAutoPaySettingsWithPaymentMethod', () => {
    it('returns null paymentMethod when no settings exist', async () => {
      setupSelectChain([]);
      const result = await getAutoPaySettingsWithPaymentMethod('user-1');
      expect(result).toEqual({ settings: null, paymentMethod: null });
    });

    it('returns null paymentMethod when no stripePaymentMethodId', async () => {
      const settings = { userId: 'user-1', enabled: true, stripePaymentMethodId: null };
      setupSelectChain([settings]);
      const result = await getAutoPaySettingsWithPaymentMethod('user-1');
      expect(result).toEqual({ settings, paymentMethod: null });
    });

    it('returns settings with paymentMethod when both exist', async () => {
      const settings = { userId: 'user-1', enabled: true, stripePaymentMethodId: 'pm_123' };
      setupSelectChain([settings]);
      const pm = { id: 'pm_123', type: 'card', card: { last4: '4242', brand: 'visa' } };
      mocks.mockStripePaymentMethodsRetrieve.mockResolvedValue(pm);

      const result = await getAutoPaySettingsWithPaymentMethod('user-1');
      expect(result).toEqual({ settings, paymentMethod: pm });
    });
  });
});
