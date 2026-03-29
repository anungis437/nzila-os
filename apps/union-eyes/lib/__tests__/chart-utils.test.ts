import { describe, it, expect } from 'vitest';
import {
  pivotData,
  aggregateData,
  groupByMultiple,
  generateColorPalette,
  getColorFromValue,
  formatCurrency,
  formatPercentage,
  abbreviateNumber,
  formatChartDate,
  calculateDomain,
  calculateMovingAverage,
  calculateTrendLine,
  validateChartData,
  generateChartAriaLabel,
} from '../chart-utils';

describe('chart-utils', () => {
  describe('pivotData', () => {
    it('pivots rows into column-based structure', () => {
      const data = [
        { month: 'Jan', category: 'A', value: 10 },
        { month: 'Jan', category: 'B', value: 20 },
        { month: 'Feb', category: 'A', value: 30 },
      ];
      const result = pivotData(data, 'month', 'category', 'value');
      expect(result).toEqual([
        { month: 'Jan', A: 10, B: 20 },
        { month: 'Feb', A: 30, B: 0 },
      ]);
    });
  });

  describe('aggregateData', () => {
    const data = [
      { dept: 'sales', amount: 10 },
      { dept: 'sales', amount: 20 },
      { dept: 'eng', amount: 50 },
    ];

    it('sums by default', () => {
      const result = aggregateData(data, 'dept', 'amount');
      expect(result).toContainEqual({ dept: 'sales', value: 30 });
      expect(result).toContainEqual({ dept: 'eng', value: 50 });
    });

    it('averages values', () => {
      const result = aggregateData(data, 'dept', 'amount', 'avg');
      expect(result).toContainEqual({ dept: 'sales', value: 15 });
    });

    it('counts values', () => {
      const result = aggregateData(data, 'dept', 'amount', 'count');
      expect(result).toContainEqual({ dept: 'sales', value: 2 });
    });
  });

  describe('groupByMultiple', () => {
    it('groups by composite key', () => {
      const data = [
        { a: 1, b: 'x', c: 100 },
        { a: 1, b: 'x', c: 200 },
        { a: 2, b: 'y', c: 300 },
      ];
      const groups = groupByMultiple(data, ['a', 'b']);
      expect(groups.get('1|x')).toHaveLength(2);
      expect(groups.get('2|y')).toHaveLength(1);
    });
  });

  describe('generateColorPalette', () => {
    it('returns the requested number of colors', () => {
      const colors = generateColorPalette(5);
      expect(colors).toHaveLength(5);
      colors.forEach((c) => expect(c).toMatch(/^hsl\(/));
    });
  });

  describe('getColorFromValue', () => {
    it('returns first color for min value', () => {
      expect(getColorFromValue(0, 0, 100)).toBe('#ef4444');
    });

    it('returns last color for max value', () => {
      expect(getColorFromValue(100, 0, 100)).toBe('#10b981');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD by default', () => {
      const result = formatCurrency(1234.5);
      expect(result).toContain('1,234.5');
    });
  });

  describe('formatPercentage', () => {
    it('appends % sign', () => {
      expect(formatPercentage(75.123, 2)).toBe('75.12%');
    });
  });

  describe('abbreviateNumber', () => {
    it('abbreviates thousands', () => {
      expect(abbreviateNumber(1500)).toBe('1.5K');
    });
    it('abbreviates millions', () => {
      expect(abbreviateNumber(2_500_000)).toBe('2.5M');
    });
    it('returns small numbers as-is', () => {
      expect(abbreviateNumber(42)).toBe('42');
    });
  });

  describe('formatChartDate', () => {
    it('formats short date', () => {
      const result = formatChartDate(new Date('2026-03-15T12:00:00Z'));
      expect(result).toMatch(/3\/15/);
    });
  });

  describe('calculateDomain', () => {
    it('returns padded min/max', () => {
      const [min, max] = calculateDomain([10, 20, 30]);
      expect(min).toBeLessThan(10);
      expect(max).toBeGreaterThan(30);
    });
  });

  describe('calculateMovingAverage', () => {
    it('computes moving average with given window', () => {
      const result = calculateMovingAverage([2, 4, 6, 8], 2);
      expect(result[0]).toBe(2);
      expect(result[1]).toBe(3);
      expect(result[3]).toBe(7);
    });
  });

  describe('calculateTrendLine', () => {
    it('calculates positive slope for increasing data', () => {
      const data = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ];
      const { slope } = calculateTrendLine(data);
      expect(slope).toBe(2);
    });
  });

  describe('validateChartData', () => {
    it('valid when all keys present', () => {
      const result = validateChartData([{ a: 1, b: 2 }], ['a', 'b']);
      expect(result.valid).toBe(true);
    });

    it('invalid for empty array', () => {
      const result = validateChartData([], ['a']);
      expect(result.valid).toBe(false);
    });
  });

  describe('generateChartAriaLabel', () => {
    it('includes chart type and count', () => {
      const label = generateChartAriaLabel('bar', 10, 'Revenue');
      expect(label).toBe('Revenue, bar with 10 data points');
    });
  });
});
