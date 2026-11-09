import { describe, expect, it } from 'vitest';
import { projectEquitySnapshot } from '../equity-snapshot-projection';

describe('equity snapshot privacy projection', () => {
  it('suppresses a small cell, a complementary gender cell and dependent pay aggregates', () => {
    const result = projectEquitySnapshot({
      totalMembers: 100, womenCount: 8, menCount: 87, nonBinaryCount: 5, genderNotDisclosed: 0,
      avgHourlyRateWomen: '30.00', avgHourlyRateMen: '31.00', genderPayGapPercentage: '3.2',
    });
    expect(result.data.womenCount).toBeNull();
    expect(result.data.nonBinaryCount).toBeNull();
    expect(result.data.menCount).toBeNull();
    expect(result.data.avgHourlyRateWomen).toBeNull();
    expect(result.data.avgHourlyRateMen).toBeNull();
    expect(result.suppression.complementaryFields).toEqual(['menCount']);
  });

  it('keeps zero and cells at the minimum while suppressing overlapping small categories', () => {
    const result = projectEquitySnapshot({ totalMembers: 30, womenCount: 10, menCount: 20, nonBinaryCount: 0, indigenousCount: 9 });
    expect(result.data.womenCount).toBe(10);
    expect(result.data.nonBinaryCount).toBe(0);
    expect(result.data.indigenousCount).toBeNull();
    expect(result.suppression.minimumCellSize).toBe(10);
  });
});
