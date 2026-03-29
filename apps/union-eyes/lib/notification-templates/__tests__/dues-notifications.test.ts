import { describe, it, expect } from 'vitest';

import {
  DuesNotificationTemplates,
  type DuesNotificationData,
} from '../dues-notifications';

function makeData(overrides: Partial<DuesNotificationData> = {}): DuesNotificationData {
  return {
    memberName: 'Jane Doe',
    memberEmail: 'jane@example.com',
    organizationName: 'CUPE Local 123',
    amount: '75.00',
    dueDate: '2024-07-01',
    periodStart: '2024-07-01',
    periodEnd: '2024-07-31',
    transactionId: 'txn_abc123',
    ...overrides,
  };
}

const TEMPLATE_KEYS = [
  'DUES_REMINDER_7_DAYS',
  'DUES_REMINDER_1_DAY',
  'DUES_OVERDUE',
  'DUES_PAYMENT_CONFIRMATION',
  'DUES_PAYMENT_FAILED',
  'DUES_PAYMENT_RETRY_SCHEDULED',
  'DUES_ADMIN_INTERVENTION',
] as const;

describe('DuesNotificationTemplates', () => {
  describe('structure', () => {
    it.each(TEMPLATE_KEYS)('%s has all required fields', (key) => {
      const template = DuesNotificationTemplates[key];
      expect(template).toHaveProperty('id');
      expect(typeof template.id).toBe('string');
      expect(typeof template.subject).toBe('function');
      expect(typeof template.title).toBe('function');
      expect(typeof template.body).toBe('function');
      expect(typeof template.htmlBody).toBe('function');
    });

    it.each(TEMPLATE_KEYS)('%s functions return strings', (key) => {
      const template = DuesNotificationTemplates[key];
      const data = makeData();
      expect(typeof template.subject(data)).toBe('string');
      expect(typeof template.title(data)).toBe('string');
      expect(typeof template.body(data)).toBe('string');
      expect(typeof template.htmlBody(data)).toBe('string');
    });

    it('has exactly 7 templates', () => {
      expect(Object.keys(DuesNotificationTemplates)).toHaveLength(7);
    });
  });

  describe('DUES_REMINDER_7_DAYS', () => {
    const t = DuesNotificationTemplates.DUES_REMINDER_7_DAYS;

    it('id is dues_reminder_7days', () => {
      expect(t.id).toBe('dues_reminder_7days');
    });

    it('subject contains due date', () => {
      expect(t.subject(makeData())).toContain('2024-07-01');
    });

    it('body contains member name and amount', () => {
      const body = t.body(makeData());
      expect(body).toContain('Jane Doe');
      expect(body).toContain('$75.00');
    });

    it('body contains period', () => {
      const body = t.body(makeData());
      expect(body).toContain('2024-07-01');
      expect(body).toContain('2024-07-31');
    });

    it('htmlBody includes breakdown when provided', () => {
      const html = t.htmlBody(
        makeData({
          breakdown: { dues: '50.00', cope: '10.00', pac: '5.00', strikeFund: '10.00' },
        }),
      );
      expect(html).toContain('$50.00');
      expect(html).toContain('COPE');
      expect(html).toContain('Strike Fund');
    });

    it('htmlBody excludes breakdown when not provided', () => {
      const html = t.htmlBody(makeData());
      expect(html).not.toContain('COPE');
    });

    it('htmlBody includes payment URL when provided', () => {
      const html = t.htmlBody(makeData({ paymentUrl: 'https://pay.example.com' }));
      expect(html).toContain('https://pay.example.com');
      expect(html).toContain('Pay Now');
    });

    it('htmlBody excludes payment link when not provided', () => {
      const html = t.htmlBody(makeData());
      expect(html).not.toContain('Pay Now');
    });
  });

  describe('DUES_REMINDER_1_DAY', () => {
    const t = DuesNotificationTemplates.DUES_REMINDER_1_DAY;

    it('id is dues_reminder_1day', () => {
      expect(t.id).toBe('dues_reminder_1day');
    });

    it('subject contains urgent', () => {
      expect(t.subject(makeData())).toMatch(/urgent/i);
    });

    it('body is marked urgent', () => {
      expect(t.body(makeData())).toContain('URGENT');
    });

    it('body contains amount and due date', () => {
      const body = t.body(makeData());
      expect(body).toContain('$75.00');
      expect(body).toContain('2024-07-01');
    });
  });

  describe('DUES_OVERDUE', () => {
    const t = DuesNotificationTemplates.DUES_OVERDUE;

    it('id is dues_overdue', () => {
      expect(t.id).toBe('dues_overdue');
    });

    it('subject contains overdue', () => {
      expect(t.subject(makeData())).toMatch(/overdue/i);
    });

    it('body mentions membership standing', () => {
      expect(t.body(makeData())).toContain('membership in good standing');
    });

    it('body mentions financial hardship option', () => {
      expect(t.body(makeData())).toContain('financial hardship');
    });

    it('htmlBody contains overdue styling', () => {
      const html = t.htmlBody(makeData());
      expect(html).toContain('OVERDUE');
      expect(html).toContain('#dc3545');
    });
  });

  describe('DUES_PAYMENT_CONFIRMATION', () => {
    const t = DuesNotificationTemplates.DUES_PAYMENT_CONFIRMATION;

    it('id is dues_payment_confirmation', () => {
      expect(t.id).toBe('dues_payment_confirmation');
    });

    it('subject indicates success', () => {
      expect(t.subject(makeData())).toContain('Payment Received');
    });

    it('body includes transaction receipt info', () => {
      const body = t.body(makeData({ receiptUrl: 'https://receipt.example.com' }));
      expect(body).toContain('https://receipt.example.com');
    });

    it('body uses fallback when no receipt URL', () => {
      const body = t.body(makeData());
      expect(body).toContain('account dashboard');
    });

    it('htmlBody shows transaction ID', () => {
      const html = t.htmlBody(makeData());
      expect(html).toContain('txn_abc123');
    });

    it('htmlBody shows receipt link when provided', () => {
      const html = t.htmlBody(makeData({ receiptUrl: 'https://receipt.example.com' }));
      expect(html).toContain('View Receipt');
    });
  });

  describe('DUES_PAYMENT_FAILED', () => {
    const t = DuesNotificationTemplates.DUES_PAYMENT_FAILED;

    it('id is dues_payment_failed', () => {
      expect(t.id).toBe('dues_payment_failed');
    });

    it('subject indicates failure', () => {
      expect(t.subject(makeData())).toContain('Payment Failed');
    });

    it('body uses provided failure reason', () => {
      const body = t.body(makeData({ failureReason: 'Insufficient funds' }));
      expect(body).toContain('Insufficient funds');
    });

    it('body uses default reason when not provided', () => {
      const body = t.body(makeData());
      expect(body).toContain('Payment declined');
    });

    it('htmlBody includes retry date when provided', () => {
      const html = t.htmlBody(makeData({ retryDate: '2024-07-05' }));
      expect(html).toContain('2024-07-05');
    });

    it('htmlBody lists common failure reasons', () => {
      const html = t.htmlBody(makeData());
      expect(html).toContain('Insufficient funds');
      expect(html).toContain('Expired card');
    });
  });

  describe('DUES_PAYMENT_RETRY_SCHEDULED', () => {
    const t = DuesNotificationTemplates.DUES_PAYMENT_RETRY_SCHEDULED;

    it('id is dues_payment_retry_scheduled', () => {
      expect(t.id).toBe('dues_payment_retry_scheduled');
    });

    it('body includes retry date', () => {
      const body = t.body(makeData({ retryDate: '2024-07-10' }));
      expect(body).toContain('2024-07-10');
    });

    it('htmlBody shows attempt number', () => {
      const html = t.htmlBody(makeData({ attemptNumber: 3 }));
      expect(html).toContain('Attempt 3');
    });

    it('htmlBody defaults attempt to 1', () => {
      const html = t.htmlBody(makeData());
      expect(html).toContain('Attempt 1');
    });
  });

  describe('DUES_ADMIN_INTERVENTION', () => {
    const t = DuesNotificationTemplates.DUES_ADMIN_INTERVENTION;

    it('id is dues_admin_intervention', () => {
      expect(t.id).toBe('dues_admin_intervention');
    });

    it('subject contains member name', () => {
      expect(t.subject(makeData())).toContain('Jane Doe');
    });

    it('body is addressed to admin', () => {
      expect(t.body(makeData())).toContain('Admin Alert');
    });

    it('body includes member email', () => {
      expect(t.body(makeData())).toContain('jane@example.com');
    });

    it('body includes transaction ID', () => {
      expect(t.body(makeData())).toContain('txn_abc123');
    });

    it('body shows attempt count', () => {
      const body = t.body(makeData({ attemptNumber: 5 }));
      expect(body).toContain('5');
    });

    it('htmlBody contains admin alert styling', () => {
      const html = t.htmlBody(makeData());
      expect(html).toContain('ADMIN INTERVENTION REQUIRED');
    });

    it('htmlBody shows member details table', () => {
      const html = t.htmlBody(makeData());
      expect(html).toContain('jane@example.com');
      expect(html).toContain('$75.00');
      expect(html).toContain('txn_abc123');
    });
  });

  describe('type exports', () => {
    it('DuesNotificationData shape', () => {
      const data: DuesNotificationData = makeData();
      expect(data.memberName).toBe('Jane Doe');
      expect(data.memberEmail).toBe('jane@example.com');
    });
  });
});
