import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicPortfolio } from '../lib/public-portfolio';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(resolve(appRoot, path), 'utf8');

describe('public website marketing contract', () => {
  it('has unique, bilingual public portfolio entries', () => {
    const names = publicPortfolio.map((entry) => entry.name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);

    for (const item of publicPortfolio) {
      expect(item.sector.trim().length).toBeGreaterThan(0);
      expect(item.en.trim().length).toBeGreaterThan(15);
      expect(item.fr.trim().length).toBeGreaterThan(15);
    }
  });

  it('keeps every primary journey on an existing public route', () => {
    for (const path of [
      'app/page.tsx',
      'app/union-eyes/page.tsx',
      'app/public-service/page.tsx',
      'app/continuity-assessment/page.tsx',
      'app/products/page.tsx',
      'app/portfolio/page.tsx',
      'app/contact/page.tsx',
    ]) {
      expect(existsSync(resolve(appRoot, path))).toBe(true);
    }
  });

  it('does not reintroduce unsubstantiated market totals or maturity scores on the primary pages', () => {
    for (const path of [
      'app/page.tsx',
      'app/products/page.tsx',
      'app/portfolio/page.tsx',
      'app/union-eyes/page.tsx',
      'app/public-service/page.tsx',
    ]) {
      const source = read(path);
      expect(source, path).not.toMatch(/\bproduction ready\b/i);
      expect(source, path).not.toMatch(/readiness:\s*\d/i);
      expect(source, path).not.toMatch(/\$\s*\d+(?:\.\d+)?\s*[BM]\+?/i);
    }
  });

  it('provides both Canadian language variants for public product journeys', () => {
    for (const path of [
      'app/union-eyes/page.tsx',
      'app/public-service/page.tsx',
      'app/continuity-assessment/page.tsx',
      'app/products/page.tsx',
    ]) {
      const source = read(path);
      expect(source, path).toContain("'en-CA'");
      expect(source, path).toContain("'fr-CA'");
    }
  });

  it('does not expose a localhost application switcher on public pages', () => {
    for (const path of [
      'components/public/Navigation.tsx',
      'components/public/Footer.tsx',
    ]) {
      expect(read(path), path).not.toContain('http://localhost:');
    }
  });

  it('labels conceptual journeys rather than presenting them as live records', () => {
    const home = read('components/public/HomeExperience.tsx');
    expect(home).toContain('Illustrative workflow overview');
    expect(home).toContain('Illustration conceptuelle');
    expect(read('app/union-eyes/page.tsx')).toContain('No live member information');
    expect(read('app/public-service/page.tsx')).toContain('Not live institutional data');
  });
});
