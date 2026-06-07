import { describe, it, expect } from 'vitest';
import { getStatusColor, getStatusEmoji, formatUptime } from '../status-utils';

describe('status-utils', () => {
  // ---------- getStatusColor -----------------------------------------------
  describe('getStatusColor', () => {
    it('returns green for healthy', () => {
      expect(getStatusColor('healthy')).toBe('green');
    });

    it('returns yellow for degraded', () => {
      expect(getStatusColor('degraded')).toBe('yellow');
    });

    it('returns red for down', () => {
      expect(getStatusColor('down')).toBe('red');
    });

    it('returns gray for unknown status', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getStatusColor('unknown' as unknown)).toBe('gray');
    });
  });

  // ---------- getStatusEmoji -----------------------------------------------
  describe('getStatusEmoji', () => {
    it('returns check mark for healthy', () => {
      expect(getStatusEmoji('healthy')).toBe('✅');
    });

    it('returns warning for degraded', () => {
      expect(getStatusEmoji('degraded')).toBe('⚠️');
    });

    it('returns X for down', () => {
      expect(getStatusEmoji('down')).toBe('❌');
    });

    it('returns question mark for unknown', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getStatusEmoji('unknown' as unknown)).toBe('❓');
    });
  });

  // ---------- formatUptime -------------------------------------------------
  describe('formatUptime', () => {
    it('returns "<1m" for 0 seconds', () => {
      expect(formatUptime(0)).toBe('<1m');
    });

    it('returns "<1m" for 30 seconds', () => {
      expect(formatUptime(30)).toBe('<1m');
    });

    it('formats minutes only', () => {
      expect(formatUptime(300)).toBe('5m');
    });

    it('formats hours and minutes', () => {
      expect(formatUptime(3660)).toBe('1h 1m');
    });

    it('formats hours only (exact)', () => {
      expect(formatUptime(7200)).toBe('2h');
    });

    it('formats days, hours, and minutes', () => {
      expect(formatUptime(90060)).toBe('1d 1h 1m');
    });

    it('formats days only', () => {
      expect(formatUptime(86400)).toBe('1d');
    });

    it('formats large uptimes', () => {
      // 10 days, 5 hours, 30 minutes
      expect(formatUptime(10 * 86400 + 5 * 3600 + 30 * 60)).toBe('10d 5h 30m');
    });
  });
});
