import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicPortfolio } from '../lib/public-portfolio';
import { searchSite, siteSearchIndex } from '../lib/site-search-index';
import { securityControls } from '../lib/security-controls';

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

describe('public website credibility and navigation contract', () => {
  const routeFile = (href: string) => (href === '/' ? 'app/page.tsx' : `app${href}/page.tsx`);

  it('only indexes search results that resolve to an existing, bilingual page', () => {
    expect(new Set(siteSearchIndex.map((entry) => entry.href)).size).toBe(siteSearchIndex.length);
    for (const entry of siteSearchIndex) {
      expect(existsSync(resolve(appRoot, routeFile(entry.href))), entry.href).toBe(true);
      for (const language of ['en', 'fr'] as const) {
        expect(entry.title[language].trim().length, `${entry.href} title ${language}`).toBeGreaterThan(2);
        expect(entry.description[language].trim().length, `${entry.href} description ${language}`).toBeGreaterThan(15);
        expect(entry.keywords[language].trim().length, `${entry.href} keywords ${language}`).toBeGreaterThan(3);
      }
    }
  });

  it('finds pages by title, keyword and accent-insensitive French terms', () => {
    expect(searchSite('union', 'en')[0]?.href).toBe('/union-eyes');
    expect(searchSite('securite', 'fr').map((entry) => entry.href)).toContain('/security');
    expect(searchSite('securite', 'en').map((entry) => entry.href)).toContain('/security');
    expect(searchSite('carrieres', 'en')[0]?.href).toBe('/careers');
    expect(searchSite('uptime', 'en').map((entry) => entry.href)).toContain('/status');
    expect(searchSite('careers', 'en')[0]?.href).toBe('/careers');
    expect(searchSite('zzzznotapage', 'en')).toEqual([]);
    expect(searchSite('   ', 'en')).toEqual([]);
  });

  it('exposes status, security, careers and search from the global chrome', () => {
    const nav = read('components/public/Navigation.tsx');
    expect(nav).toContain("'/about'");
    expect(nav).toContain('"/status"');
    expect(nav).toContain('<SiteSearch');
    const footer = read('components/public/Footer.tsx');
    for (const href of ["'/security'", "'/status'", "'/careers'", "'/case-studies'"]) {
      expect(footer, href).toContain(href);
    }
  });

  it('states who the company serves in the hero and backs trust claims with a linked ledger', () => {
    const home = read('components/public/HomeExperience.tsx');
    expect(home).toContain('labour organizations and public institutions');
    expect(home).toContain('syndicales et les institutions publiques');
    const ledger = read('components/public/ProofLedger.tsx');
    for (const href of ["'/status'", "'/union-eyes'", "'/public-service'", "'/portfolio'", "'/security'", "'/trust'", "'/case-studies'"]) {
      expect(ledger, href).toContain(href);
    }
    expect(ledger).not.toMatch(/testimonial\s*:/i);
    expect(securityControls.length).toBeGreaterThan(0);
  });

  it('does not probe the retired Azure environment from the public status page', () => {
    const status = read('app/status/page.tsx');
    expect(status).not.toContain('jollydune');
    expect(status).toContain('https://nzilaventures.com/api/health');
  });

  it('does not publish invented open roles on the careers page', () => {
    const careers = read('app/careers/page.tsx');
    expect(careers).toContain('No roles are posted right now');
    expect(careers).toContain('interest=careers');
  });
});
