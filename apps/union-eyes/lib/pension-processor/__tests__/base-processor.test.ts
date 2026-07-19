import { Decimal } from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: h.info, warn: h.warn, error: h.error } }));

import { BasePensionProcessor } from '../base-processor';
import { PensionPlanType } from '../types';

// Minimal concrete subclass exposing protected helpers for testing.
class TestProcessor extends BasePensionProcessor {
  async initialize() { this.initialized = true; }
  async calculateContribution() { return {} as never; }
  async getContributionRates() { return {} as never; }
  isPensionableEarnings() { return true; }
  async submitRemittance() { return {} as never; }
  async generateAnnualStatement() { return {} as never; }
  getCapabilities() {
    return {
      supportsElectronicRemittance: true, supportsAutomaticEnrollment: false,
      supportsBuyBack: false, supportsEarlyRetirement: false,
    };
  }
  // expose protected members
  pEnsureInitialized() { return this.ensureInitialized(); }
  pLogInfo(m: string) { return this.logInfo(m); }
  pLogWarn(m: string) { return this.logWarn(m); }
  pLogError(m: string) { return this.logError(m); }
  pRoundCurrency(a: Decimal) { return this.roundCurrency(a); }
  pCalcYTD(c: Decimal, y: Decimal, m: Decimal) { return this.calculateYTDWithCap(c, y, m); }
  pGetTaxYear(d?: Date) { return this.getTaxYear(d); }
  pValidate(member: unknown) { return this.validateMemberEligibility(member as never); }
  pCalcAge(dob: Date, asOf?: Date) { return this.calculateAge(dob, asOf); }
  getLogger() { return this.logger; }
}

const config = { environment: 'sandbox' as const };

function processor(logger?: unknown) {
  return new TestProcessor(PensionPlanType.CPP, config as never, logger as never);
}

function contribution(overrides: Record<string, unknown> = {}) {
  return {
    memberId: 'm1',
    pensionableEarnings: new Decimal(1000),
    employeeContribution: new Decimal(50),
    employerContribution: new Decimal(50),
    ...overrides,
  };
}

beforeEach(() => {
  h.info.mockReset();
  h.warn.mockReset();
  h.error.mockReset();
});

describe('lib/pension-processor/base-processor', () => {
  it('exposes environment from config', () => {
    expect(processor().environment).toBe('sandbox');
  });

  it('default ConsoleLogger routes through appLogger and formats messages', () => {
    const p = processor();
    const log = p.getLogger() as unknown as {
      info: (m: string, c?: unknown) => void;
      warn: (m: string, c?: unknown) => void;
      error: (m: string, c?: unknown) => void;
      formatMessage: (l: string, m: string, c?: unknown) => string;
    };
    log.info('i', { a: 1 });
    log.warn('w');
    log.error('e', { b: 2 });
    expect(h.info).toHaveBeenCalledWith('i', { a: 1 });
    expect(h.warn).toHaveBeenCalledWith('w', undefined);
    expect(h.error).toHaveBeenCalledWith('e', undefined, { b: 2 });
    const formatted = log.formatMessage('INFO', 'msg', { x: 1 });
    expect(formatted).toContain('[INFO]');
    expect(formatted).toContain('Context:');
    expect(log.formatMessage('WARN', 'no-ctx')).toContain('no-ctx');
  });

  it('uses an injected logger for log helpers', () => {
    const custom = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const p = processor(custom);
    p.pLogInfo('hello');
    p.pLogWarn('careful');
    p.pLogError('boom');
    expect(custom.info).toHaveBeenCalledWith('[CPP] hello', undefined);
    expect(custom.warn).toHaveBeenCalledWith('[CPP] careful', undefined);
    expect(custom.error).toHaveBeenCalledWith('[CPP] boom', undefined);
  });

  it('ensureInitialized throws until initialized', async () => {
    const p = processor();
    expect(() => p.pEnsureInitialized()).toThrow(/not initialized/);
    await p.initialize();
    expect(() => p.pEnsureInitialized()).not.toThrow();
  });

  it('createRemittance aggregates contributions', async () => {
    const p = processor();
    await p.initialize();
    const remittance = await p.createRemittance(
      [contribution(), contribution({ memberId: 'm2' })] as never,
      3,
      2025,
    );
    expect(remittance.numberOfMembers).toBe(2);
    expect(remittance.totalContributions.toString()).toBe('200');
    expect(remittance.memberIds).toEqual(['m1', 'm2']);
    expect(remittance.status).toBe('pending');
    expect(remittance.dueDate.getDate()).toBe(15);
  });

  it('createRemittance throws on empty contributions', async () => {
    const p = processor();
    await p.initialize();
    await expect(p.createRemittance([] as never, 1, 2025)).rejects.toThrow(/no contributions/);
  });

  it('roundCurrency rounds half-up to 2 decimals', () => {
    expect(processor().pRoundCurrency(new Decimal('1.005')).toString()).toBe('1.01');
  });

  it('calculateYTDWithCap caps at maximum', () => {
    const p = processor();
    const capped = p.pCalcYTD(new Decimal(100), new Decimal(950), new Decimal(1000));
    expect(capped.isAtMaximum).toBe(true);
    expect(capped.amount.toString()).toBe('50');

    const over = p.pCalcYTD(new Decimal(100), new Decimal(1000), new Decimal(1000));
    expect(over.amount.toString()).toBe('0');

    const under = p.pCalcYTD(new Decimal(10), new Decimal(20), new Decimal(1000));
    expect(under.isAtMaximum).toBe(false);
    expect(under.amount.toString()).toBe('10');
  });

  it('getTaxYear defaults to current year', () => {
    const p = processor();
    expect(p.pGetTaxYear(new Date('2023-06-01'))).toBe(2023);
    expect(p.pGetTaxYear()).toBe(new Date().getFullYear());
  });

  it('validateMemberEligibility enforces required fields', () => {
    const p = processor();
    expect(() => p.pValidate({ employeeNumber: 'e', dateOfBirth: new Date(), hireDate: new Date() })).toThrow(/employee number/);
    expect(() => p.pValidate({ id: 'i', employeeNumber: 'e', hireDate: new Date() })).toThrow(/date of birth/);
    expect(() => p.pValidate({ id: 'i', employeeNumber: 'e', dateOfBirth: new Date() })).toThrow(/hire date/);
    expect(() => p.pValidate({ id: 'i', employeeNumber: 'e', dateOfBirth: new Date(), hireDate: new Date() })).not.toThrow();
  });

  it('calculateAge accounts for birthday not yet reached', () => {
    const p = processor();
    expect(p.pCalcAge(new Date('2000-01-01'), new Date('2025-06-01'))).toBe(25);
    expect(p.pCalcAge(new Date('2000-12-31'), new Date('2025-06-01'))).toBe(24);
  });
});
