import { describe, it, expect } from 'vitest';
import { heroImagery, type HeroImageKey } from '../marketing-hero-imagery';

describe('lib/marketing-hero-imagery', () => {
  it('maps every key to an Unsplash https URL', () => {
    const keys = Object.keys(heroImagery) as HeroImageKey[];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(heroImagery[key]).toMatch(/^https:\/\/images\.unsplash\.com\//);
    }
  });

  it('exposes the expected core marketing pages', () => {
    expect(heroImagery.trust).toBeDefined();
    expect(heroImagery.pricing).toBeDefined();
    expect(heroImagery.solutions).toBeDefined();
  });
});
