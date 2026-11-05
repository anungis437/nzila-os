import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import enCA from '@/messages/en-CA.json';
import en from '@/messages/en.json';
import frCA from '@/messages/fr-CA.json';
import fr from '@/messages/fr.json';
import itIT from '@/messages/it.json';
import pt from '@/messages/pt.json';
import { loadMessages } from '@/lib/i18n/messages';

const LOCALES: Record<string, unknown> = { 'en-CA': enCA, en, 'fr-CA': frCA, fr, it: itIT, pt };

// The screens whose text comes from the message files: a key a screen asks for that a locale lacks shows as the raw key (or throws) there.
const SCREENS = [
  'app/[locale]/dashboard/committees',
  'app/[locale]/dashboard/correspondence',
  'app/[locale]/dashboard/health-safety',
  'app/[locale]/dashboard/members',
  'app/[locale]/dashboard/settings',
  'app/[locale]/mobile/members',
  'components/auth',
  'components/bargaining',
  'components/education',
  'components/health-safety',
  'components/knowledge',
  'components/member',
  'components/members',
  'components/organization',
  'components/union-structure',
  'components/workaid',
];

function sourcesIn(path: string): string[] {
  if (path.endsWith('.tsx')) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__') return [];
    const child = join(path, entry.name);
    return entry.isDirectory() ? sourcesIn(child) : entry.name.endsWith('.tsx') ? [child] : [];
  });
}

/** The message keys a source file asks for through `const t = useTranslations("namespace")` and `t("key")`; a key built at run time is not read. */
function keysAskedFor(source: string): string[] {
  const keys: string[] = [];
  for (const [, name, namespace] of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*(?:["'`]([\w.]+)["'`])?\s*\)/g)) {
    for (const [, , key] of source.matchAll(new RegExp(`(?<![\\w.])${name}\\(\\s*(["'\`])([^"'\`$]*)\\1`, 'g'))) {
      keys.push(namespace ? `${namespace}.${key}` : key);
    }
  }
  return keys;
}

const lookup = (messages: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages);

describe('the message keys the health-safety, members and union-structure screens ask for', () => {
  // A screen directory that has been removed asks for nothing; the count below keeps this from passing by reading nothing.
  const asked = SCREENS.filter((screen) => existsSync(screen)).flatMap(sourcesIn).flatMap((file) => keysAskedFor(readFileSync(file, 'utf8')).map((key) => ({ file, key })));

  it('reads a real number of keys, so that this check cannot pass by finding nothing', () => {
    expect(asked.length).toBeGreaterThan(150);
  });

  // What a person can read in each language is the locale's catalog laid over its base's (en-CA over en, fr-CA over fr, it and pt over en-CA): a key
  // that only the base lacks is rendered, and a key a locale and its bases all lack is a raw key on screen.
  it.each(['en-CA', 'fr-CA', 'it', 'pt'])('exist as text in %s, as the application serves it', async (locale) => {
    const served = await loadMessages(locale, async (catalog) => LOCALES[catalog] as Record<string, unknown>);
    const missing = asked.filter(({ key }) => {
      const text = lookup(served, key);
      return typeof text !== 'string' || text.trim() === '';
    });
    expect(missing.map(({ file, key }) => `${key} (${file})`)).toEqual([]);
  });
});

describe('the incidents page text', () => {
  it.each(Object.keys(LOCALES))('has a title that names the page and a "total incidents" title in %s', (locale) => {
    const page = lookup(LOCALES[locale], 'healthSafetyIncidentsPage') as Record<string, string>;
    expect(page.pageTitle).not.toMatch(/continuity|restoration/i);
    expect(page.totalIncidents).toBeTruthy();
    expect(page.totalIncidents).not.toBe(page.pageTitle);
  });

  it('is written in each language', () => {
    const text = (locale: string, key: string) => (lookup(LOCALES[locale], `healthSafetyIncidentsPage.${key}`) as string);
    expect(text('en-CA', 'pageTitle')).toBe('Workplace Incidents');
    expect(text('en', 'pageTitle')).toBe('Workplace Incidents');
    expect(text('en-CA', 'totalIncidents')).toBe('Total Incidents');
    expect(text('fr-CA', 'totalIncidents')).toBe('Total des incidents');
    expect(text('fr', 'totalIncidents')).toBe('Total des incidents');
    expect(text('it', 'totalIncidents')).toBe('Totale incidenti');
    expect(text('pt', 'totalIncidents')).toBe('Total de incidentes');
  });
});

describe('the mobile members list text', () => {
  it.each(Object.keys(LOCALES))('says what it is, and claims no cache that is not kept, in %s', (locale) => {
    const members = lookup(LOCALES[locale], 'mobile.members') as Record<string, string>;
    for (const key of ['title', 'noResultsEmpty', 'noResultsSearch', 'offlineBanner', 'loadFailed', 'showing', 'loadMore']) expect(members[key]).toBeTruthy();
    expect(members.showing).toContain('{shown}');
    expect(members.showing).toContain('{total}');
    expect(members.offlineBanner).not.toMatch(/cache|cach|memoriz|memória/i);
  });
});
