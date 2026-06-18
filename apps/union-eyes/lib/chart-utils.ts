/**
 * Chart Utilities
 * 
 * Helper functions for chart data transformation, formatting, and calculations
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

// ============================================================================
// Data Transformation
// ============================================================================

/**
 * Pivot data from rows to columns
 */
export function pivotData(
  data: any[],
  rowKey: string,
  columnKey: string,
  valueKey: string
): any[] {
  const result: any[] = [];
  const rows = new Set(data.map(d => d[rowKey]));
  const columns = new Set(data.map(d => d[columnKey]));

  rows.forEach(row => {
    const rowData: any = { [rowKey]: row };
    columns.forEach(column => {
      const match = data.find(d => d[rowKey] === row && d[columnKey] === column);
      rowData[column] = match ? match[valueKey] : 0;
    });
    result.push(rowData);
  });

  return result;
}

/**
 * Aggregate data by key with specified operation
 */
export function aggregateData(
  data: any[],
  groupKey: string,
  valueKey: string,
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count' = 'sum'
): any[] {
  const groups = new Map<string, number[]>();

  data.forEach(item => {
    const key = item[groupKey];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item[valueKey]);
  });

  const result: any[] = [];
  groups.forEach((values, key) => {
    let aggregatedValue: number;
    switch (operation) {
      case 'sum':
        aggregatedValue = values.reduce((sum, v) => sum + v, 0);
        break;
      case 'avg':
        aggregatedValue = values.reduce((sum, v) => sum + v, 0) / values.length;
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
    }
    result.push({ [groupKey]: key, value: aggregatedValue });
  });

  return result;
}

/**
 * Group data by multiple keys
 */
export function groupByMultiple(data: any[], keys: string[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();

  data.forEach(item => {
    const groupKey = keys.map(k => item[k]).join('|');
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(item);
  });

  return groups;
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Generate color palette with specified number of colors
 */
export function generateColorPalette(count: number, baseHue: number = 200): string[] {
  const colors: string[] = [];
  const hueStep = 360 / count;

  for (let i = 0; i < count; i++) {
    const hue = (baseHue + i * hueStep) % 360;
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }

  return colors;
}

/**
 * Get color from value in range
 */
export function getColorFromValue(
  value: number,
  min: number,
  max: number,
  colorScale: string[] = ['#ef4444', '#f59e0b', '#10b981']
): string {
  const normalized = (value - min) / (max - min);
  const index = Math.floor(normalized * (colorScale.length - 1));
  return colorScale[Math.max(0, Math.min(colorScale.length - 1, index))];
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format number as currency
 */
export function formatCurrency(value: number, currency: string = 'USD', locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format number as percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Abbreviate large numbers (1000 -> 1K, 1000000 -> 1M)
 */
export function abbreviateNumber(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toString();
}

/**
 * Format date for chart display
 */
export function formatChartDate(date: Date | string, format: 'short' | 'medium' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'short':
      return `${d.getMonth() + 1}/${d.getDate()}`;
    case 'medium':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'long':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// ============================================================================
// Calculation Utilities
// ============================================================================

/**
 * Calculate domain for axis with padding
 */
export function calculateDomain(values: number[], padding: number = 0.1): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  return [
    min - range * padding,
    max + range * padding,
  ];
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const values = data.slice(start, i + 1);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    result.push(avg);
  }
  
  return result;
}

/**
 * Calculate trend line (linear regression)
 */
export function calculateTrendLine(data: Array<{ x: number; y: number }>): { slope: number; intercept: number } {
  const n = data.length;
  const sumX = data.reduce((sum, d) => sum + d.x, 0);
  const sumY = data.reduce((sum, d) => sum + d.y, 0);
  const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
  const sumXX = data.reduce((sum, d) => sum + d.x * d.x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

// ============================================================================
// Data Validation
// ============================================================================

/**
 * Validate chart data structure
 */
export function validateChartData(data: any[], requiredKeys: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { valid: false, errors };
  }
  
  if (data.length === 0) {
    errors.push('Data array is empty');
    return { valid: false, errors };
  }
  
  data.forEach((item, index) => {
    requiredKeys.forEach(key => {
      if (!(key in item)) {
        errors.push(`Missing required key "${key}" in item at index ${index}`);
      }
    });
  });
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Accessibility Utilities
// ============================================================================

/**
 * Generate ARIA label for chart
 */
export function generateChartAriaLabel(
  chartType: string,
  dataPoints: number,
  title?: string
): string {
  return `${title ? `${title}, ` : ''}${chartType} with ${dataPoints} data points`;
}

/**
 * Get accessible color contrast
 */
export function ensureColorContrast(foreground: string, background: string): boolean {
  // Simplified contrast check - in production, use proper WCAG contrast calculation
  return foreground !== background;
}

