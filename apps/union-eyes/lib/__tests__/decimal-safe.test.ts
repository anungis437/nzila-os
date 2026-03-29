import { describe, it, expect } from 'vitest';
import {
  toCents,
  fromCents,
  parseMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  negateMoney,
  absMoney,
  compareMoney,
  sumMoney,
  moneyToNumber,
} from '../decimal-safe';

describe('decimal-safe', () => {
  describe('toCents', () => {
    it('converts number to cents', () => {
      expect(toCents(12.34)).toBe(1234);
    });
    it('converts string to cents', () => {
      expect(toCents('99.99')).toBe(9999);
    });
    it('returns 0 for null/undefined/empty', () => {
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
      expect(toCents('')).toBe(0);
    });
  });

  describe('fromCents', () => {
    it('converts cents to decimal string', () => {
      expect(fromCents(1234)).toBe('12.34');
    });
  });

  describe('parseMoney', () => {
    it('normalises to X.XX format', () => {
      expect(parseMoney(10)).toBe('10.00');
      expect(parseMoney('5.1')).toBe('5.10');
    });
  });

  describe('addMoney', () => {
    it('adds two monetary values', () => {
      expect(addMoney('10.50', '20.30')).toBe('30.80');
    });
    it('handles null values', () => {
      expect(addMoney(null, '5.00')).toBe('5.00');
    });
  });

  describe('subtractMoney', () => {
    it('subtracts b from a', () => {
      expect(subtractMoney('20.00', '7.50')).toBe('12.50');
    });
  });

  describe('multiplyMoney', () => {
    it('multiplies amount by factor', () => {
      expect(multiplyMoney('10.00', 1.5)).toBe('15.00');
    });
  });

  describe('divideMoney', () => {
    it('divides two values', () => {
      expect(divideMoney('10.00', '5.00')).toBe(2);
    });
    it('returns 0 for zero denominator', () => {
      expect(divideMoney('10.00', 0)).toBe(0);
    });
  });

  describe('negateMoney', () => {
    it('negates a positive value', () => {
      expect(negateMoney('10.00')).toBe('-10.00');
    });
  });

  describe('absMoney', () => {
    it('returns absolute value', () => {
      expect(absMoney('-15.50')).toBe('15.50');
    });
  });

  describe('compareMoney', () => {
    it('returns negative when a < b', () => {
      expect(compareMoney('5.00', '10.00')).toBeLessThan(0);
    });
    it('returns 0 for equal', () => {
      expect(compareMoney('5.00', '5.00')).toBe(0);
    });
  });

  describe('sumMoney', () => {
    it('sums an array of values', () => {
      expect(sumMoney(['1.00', '2.50', '3.50'])).toBe('7.00');
    });
  });

  describe('moneyToNumber', () => {
    it('converts to number with cents precision', () => {
      expect(moneyToNumber('12.34')).toBe(12.34);
    });
  });
});
