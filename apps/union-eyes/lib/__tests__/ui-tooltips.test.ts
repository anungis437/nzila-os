import { describe, it, expect } from 'vitest';
import {
  getTooltip,
  getTooltipsByCategory,
  getTooltipsForPage,
  getSuggestedTooltips,
} from '../ui-tooltips';

describe('lib/ui-tooltips', () => {
  describe('getTooltip', () => {
    it('returns a known tooltip by id', () => {
      const tip = getTooltip('nav-dashboard');
      expect(tip?.title).toBe('Dashboard');
    });

    it('returns undefined for an unknown id', () => {
      expect(getTooltip('does-not-exist')).toBeUndefined();
    });
  });

  describe('getTooltipsByCategory', () => {
    it('returns only tooltips in the requested category', () => {
      const nav = getTooltipsByCategory('navigation');
      expect(nav.length).toBeGreaterThan(0);
      expect(nav.every((t) => t.category === 'navigation')).toBe(true);
    });
  });

  describe('getTooltipsForPage', () => {
    it('returns an empty array for an unknown page', () => {
      expect(getTooltipsForPage('unknown-page')).toEqual([]);
    });
  });

  describe('getSuggestedTooltips', () => {
    it('returns role-specific suggestions for a steward', () => {
      const tips = getSuggestedTooltips('steward');
      expect(Array.isArray(tips)).toBe(true);
      // Every resolved tooltip is defined.
      expect(tips.every((t) => t !== undefined)).toBe(true);
    });

    it('returns admin suggestions', () => {
      expect(Array.isArray(getSuggestedTooltips('admin'))).toBe(true);
    });

    it('falls back to member suggestions for an unknown role', () => {
      const unknown = getSuggestedTooltips('unknown-role');
      const member = getSuggestedTooltips('member');
      expect(unknown.map((t) => t.id)).toEqual(member.map((t) => t.id));
    });
  });
});
