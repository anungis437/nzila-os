import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getRequiredSecret,
  getOptionalSecret,
  getRequiredNumber,
  getOptionalNumber,
  getBoolean,
  validateRequiredSecrets,
  getEnvironment,
  isProduction,
  isDevelopment,
  isTest,
} from '../config';

describe('config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getRequiredSecret', () => {
    it('returns value when set', () => {
      process.env.TEST_KEY = 'secret';
      expect(getRequiredSecret('TEST_KEY')).toBe('secret');
    });

    it('throws when missing', () => {
      delete process.env.MISSING_KEY;
      expect(() => getRequiredSecret('MISSING_KEY')).toThrow('Missing required');
    });
  });

  describe('getOptionalSecret', () => {
    it('returns value when set', () => {
      process.env.OPT_KEY = 'value';
      expect(getOptionalSecret('OPT_KEY', 'default')).toBe('value');
    });

    it('returns default when missing', () => {
      delete process.env.OPT_MISSING;
      expect(getOptionalSecret('OPT_MISSING', 'fallback')).toBe('fallback');
    });
  });

  describe('getRequiredNumber', () => {
    it('parses integer', () => {
      process.env.PORT = '3000';
      expect(getRequiredNumber('PORT')).toBe(3000);
    });

    it('throws on non-numeric', () => {
      process.env.BAD_NUM = 'abc';
      expect(() => getRequiredNumber('BAD_NUM')).toThrow('valid number');
    });
  });

  describe('getOptionalNumber', () => {
    it('returns parsed value', () => {
      process.env.RETRIES = '5';
      expect(getOptionalNumber('RETRIES', 3)).toBe(5);
    });

    it('returns default when missing', () => {
      delete process.env.NO_RETRIES;
      expect(getOptionalNumber('NO_RETRIES', 3)).toBe(3);
    });

    it('returns default on non-numeric', () => {
      process.env.BAD = 'xyz';
      expect(getOptionalNumber('BAD', 7)).toBe(7);
    });
  });

  describe('getBoolean', () => {
    it.each(['true', '1', 'yes', 'on'])('returns true for "%s"', (val) => {
      process.env.FLAG = val;
      expect(getBoolean('FLAG')).toBe(true);
    });

    it('returns false for other values', () => {
      process.env.FLAG = 'nope';
      expect(getBoolean('FLAG')).toBe(false);
    });

    it('returns default when missing', () => {
      delete process.env.NO_FLAG;
      expect(getBoolean('NO_FLAG', true)).toBe(true);
    });
  });

  describe('validateRequiredSecrets', () => {
    it('succeeds when all present', () => {
      process.env.A = '1';
      process.env.B = '2';
      expect(() => validateRequiredSecrets(['A', 'B'])).not.toThrow();
    });

    it('throws listing missing', () => {
      delete process.env.MISSING_A;
      delete process.env.MISSING_B;
      expect(() => validateRequiredSecrets(['MISSING_A', 'MISSING_B'])).toThrow('MISSING_A');
    });
  });

  describe('getEnvironment', () => {
    it('returns test for NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      expect(getEnvironment()).toBe('test');
    });

    it('prefers UE_ENVIRONMENT over NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      process.env.UE_ENVIRONMENT = 'staging';
      expect(getEnvironment()).toBe('staging');
    });

    it('falls back to NEXT_PUBLIC_APP_ENV when UE_ENVIRONMENT is unset', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.UE_ENVIRONMENT;
      process.env.NEXT_PUBLIC_APP_ENV = 'staging';
      expect(getEnvironment()).toBe('staging');
    });

    it('returns development for unknown', () => {
      process.env.NODE_ENV = 'unknown';
      expect(getEnvironment()).toBe('development');
    });
  });

  describe('isProduction / isDevelopment / isTest', () => {
    it('isProduction true for production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
    });

    it('isDevelopment true for development', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
    });

    it('isTest true for test', () => {
      process.env.NODE_ENV = 'test';
      expect(isTest()).toBe(true);
    });
  });
});
