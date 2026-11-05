import { describe, expect, it } from 'vitest';
import { movementTrendCategoryEnum } from '@/db/schema/domains/marketing';
import { movementTrendCategoryLabel } from '../category-labels';

describe('movementTrendCategoryLabel', () => {
  it('labels every category the database enum allows, in both languages, with no label repeated', () => {
    const english = movementTrendCategoryEnum.enumValues.map((value) => movementTrendCategoryLabel(value, 'en'));
    const french = movementTrendCategoryEnum.enumValues.map((value) => movementTrendCategoryLabel(value, 'fr'));

    for (const [index, value] of movementTrendCategoryEnum.enumValues.entries()) {
      expect(english[index]).not.toBe(value);
      expect(french[index]).not.toBe(value);
    }
    expect(new Set(english).size).toBe(english.length);
    expect(new Set(french).size).toBe(french.length);
  });

  it('returns a value it has no label for exactly as stored', () => {
    expect(movementTrendCategoryLabel('a-new-category', 'en')).toBe('a-new-category');
    expect(movementTrendCategoryLabel('a-new-category', 'fr')).toBe('a-new-category');
    expect(movementTrendCategoryLabel('toString', 'en')).toBe('toString');
  });
});
