import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decisionTypeEnum, outcomeEnum, precedentValueEnum, tribunalTypeEnum } from '@/db/schema';
import { grievanceStatusEnum } from '@/db/schema/domains/claims/grievances';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import { CITATION_TYPES, JURISDICTION_CODES, LANGUAGES } from '@/components/precedents/precedent-filters';
import { ACCESS_ROLES, DOCUMENT_TYPES, PRIVACY_LABELS } from '@/components/grievances/grievance-detail-model';

// The words of the precedents console, the platform administration console, the CLC analytics dashboard and the pages that say a capability
// is unavailable come from the message catalogs. A key a language lacks shows as the raw key path (or throws) there, so each of these
// groups must be whole in both languages, written in each of them, and used by the screens only as it is defined.

const LOCALES = { 'en-CA': enCA, 'fr-CA': frCA } as Record<string, unknown>;

const GROUPS = [
  'precedents.console',
  'precedents.search',
  'precedents.fields',
  'precedents.viewer',
  'precedents.comparison',
  'precedents.outcomes',
  'precedents.values',
  'precedents.tribunals',
  'precedents.decisionTypes',
  'precedents.languages',
  'precedents.citationTypes',
  'precedents.jurisdictions',
  'adminConsolePage',
  'adminScheduledReportsPage',
  'pensionTrusteePortalPage',
  'clcAnalyticsDashboard',
  'grievanceDetailConsole',
];

const lookup = (messages: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages);

/** The path of every message under `node`, relative to it. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (node === null || typeof node !== 'object') return [`${prefix} (not a message)`];
  return Object.entries(node).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}

/** The arguments a message takes: `{name}`, `{count, plural, ...}`. */
const argumentsOf = (message: string): string[] => [...new Set([...message.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((match) => match[1]))].sort();

/** Keys that a JSON parse silently collapses: the same key twice in one object (the later one wins). */
function duplicateKeys(json: string): string[] {
  const duplicates: string[] = [];
  const objects: Array<{ path: string; keys: Set<string> } | null> = [];
  let lastString = '';
  let pendingKey = '';
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (char === '"') {
      let end = i + 1;
      while (json[end] !== '"') end += json[end] === '\\' ? 2 : 1;
      lastString = json.slice(i + 1, end);
      i = end;
    } else if (char === ':') {
      const object = objects[objects.length - 1];
      if (object) {
        if (object.keys.has(lastString)) duplicates.push(`${object.path}${object.path ? '.' : ''}${lastString}`);
        object.keys.add(lastString);
      }
      pendingKey = lastString;
    } else if (char === '{') {
      const parent = objects[objects.length - 1];
      objects.push({ path: parent ? `${parent.path}${parent.path ? '.' : ''}${pendingKey}` : '', keys: new Set() });
    } else if (char === '[') {
      objects.push(null);
    } else if (char === '}' || char === ']') {
      objects.pop();
    }
  }
  return duplicates;
}

describe.each(Object.keys(LOCALES))('the message groups of the precedents, admin and CLC screens, in %s', (locale) => {
  const messages = LOCALES[locale];

  it.each(GROUPS)('has %s, with every message a non-empty text', (group) => {
    const node = lookup(messages, group);
    expect(node, group).toBeTypeOf('object');
    for (const path of leaves(node)) {
      const text = lookup(node, path);
      expect(typeof text, `${group}.${path}`).toBe('string');
      expect((text as string).trim(), `${group}.${path}`).not.toBe('');
    }
  });
});

describe('the two languages of those message groups', () => {
  it.each(GROUPS)('define the same messages, taking the same arguments, in %s', (group) => {
    const english = lookup(enCA, group);
    const french = lookup(frCA, group);

    expect(leaves(french).sort(), group).toEqual(leaves(english).sort());
    for (const path of leaves(english)) {
      const en = lookup(english, path) as string;
      const fr = lookup(french, path) as string;
      expect(argumentsOf(fr), `${group}.${path}`).toEqual(argumentsOf(en));
    }
  });

  // These are the same word, or the same name, in both languages.
  const SAME_IN_BOTH = new Set([
    'precedents.jurisdictions.ON',
    'precedents.jurisdictions.AB',
    'precedents.jurisdictions.MB',
    'precedents.jurisdictions.SK',
    'precedents.jurisdictions.YT',
    'precedents.jurisdictions.NU',
    'precedents.fields.tribunal',
    'precedents.fields.citations',
    'precedents.viewer.parties',
    'precedents.viewer.citationCount',
    'adminConsolePage.notRecorded',
    'adminConsolePage.ai.ok',
    'grievanceDetailConsole.type',
    'grievanceDetailConsole.description',
    'grievanceDetailConsole.types.discrimination',
  ]);

  it('is written in French in the French catalog, not left in English', () => {
    const untranslated = GROUPS.flatMap((group) =>
      leaves(lookup(enCA, group))
        .map((path) => `${group}.${path}`)
        .filter((full) => !SAME_IN_BOTH.has(full) && lookup(enCA, full) === lookup(frCA, full)),
    );

    expect(untranslated).toEqual([]);
  });

  it('has no key twice in one object of the catalogs, which a JSON parse would silently collapse', () => {
    const ours = [...GROUPS.map((group) => group.split('.')[0]), 'adminOrganizationsPage'];
    for (const locale of ['en-CA', 'fr-CA']) {
      const duplicates = duplicateKeys(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')).filter((path) =>
        ours.includes(path.split('.')[0]),
      );
      expect(duplicates, locale).toEqual([]);
    }
  });

  it('keeps the unused bulk-import label out of every catalog', () => {
    for (const locale of ['en-CA', 'fr-CA', 'en', 'fr', 'it', 'pt']) {
      const catalog = JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')) as Record<string, Record<string, unknown>>;
      expect(catalog.adminOrganizationsPage, locale).not.toHaveProperty('bulkImportButton');
    }
  });
});

describe('the database vocabulary the precedents screens label', () => {
  const keysOf = (group: string) => Object.keys(lookup(enCA, group) as object).sort();

  it('has a label for every member of each enumeration, and for no member the database lacks', () => {
    expect(keysOf('precedents.outcomes')).toEqual([...outcomeEnum.enumValues].sort());
    expect(keysOf('precedents.values')).toEqual([...precedentValueEnum.enumValues].sort());
    expect(keysOf('precedents.tribunals')).toEqual([...tribunalTypeEnum.enumValues].sort());
    expect(keysOf('precedents.decisionTypes')).toEqual([...decisionTypeEnum.enumValues].sort());
  });

  it('has a name for every jurisdiction, language and citation type the screens offer', () => {
    expect(keysOf('precedents.jurisdictions')).toEqual([...JURISDICTION_CODES].sort());
    expect(keysOf('precedents.languages')).toEqual([...LANGUAGES].sort());
    expect(keysOf('precedents.citationTypes')).toEqual([...CITATION_TYPES].sort());
  });

  it('has a word for every grievance status, document type, privacy label and access role the grievance screen offers', () => {
    expect(keysOf('grievanceDetailConsole.statuses')).toEqual([...grievanceStatusEnum.enumValues].sort());
    expect(keysOf('grievanceDetailConsole.documentTypes')).toEqual([...DOCUMENT_TYPES].sort());
    expect(keysOf('grievanceDetailConsole.privacyLabels')).toEqual([...PRIVACY_LABELS].sort());
    expect(keysOf('grievanceDetailConsole.accessRoles')).toEqual([...ACCESS_ROLES].sort());
  });
});

// The messages a source file asks for, as `t("key")` through `const t = useTranslations("namespace")`. A key built at run time is not read here.
const literalKeys = (source: string): string[] => [...source.matchAll(/(?<![\w.])t\(\s*(["'])([^"'`$]+)\1/g)].map((match) => match[2]);

function sourcesIn(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => join(path, entry.name));
}

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('the messages the screens ask for', () => {
  const SCREENS: Array<{ name: string; files: string[]; namespace: (key: string) => string }> = [
    {
      name: 'the precedents console',
      files: sourcesIn(join(process.cwd(), 'components', 'precedents')).map((file) => file.slice(process.cwd().length + 1)),
      namespace: () => 'precedents',
    },
    {
      name: 'the CLC analytics dashboard',
      files: ['components/admin/clc-analytics-dashboard.tsx'],
      namespace: () => 'clcAnalyticsDashboard',
    },
    {
      name: 'the scheduled reports page',
      files: ['app/[locale]/dashboard/admin/scheduled-reports/page.tsx'],
      namespace: () => 'adminScheduledReportsPage',
    },
    {
      name: 'the pension trustee portal page',
      files: ['components/pension/trustee-portal-page.tsx'],
      namespace: () => 'pensionTrusteePortalPage',
    },
    {
      name: 'the grievance detail screen',
      files: ['components/grievances/grievance-detail-console.tsx'],
      namespace: () => 'grievanceDetailConsole',
    },
    {
      // The page asks the root for the older `admin.*` messages and the `adminConsolePage` namespace for its own.
      name: 'the platform administration console',
      files: ['app/[locale]/dashboard/admin/page.tsx'],
      namespace: (key) => (key.startsWith('admin.') ? '' : 'adminConsolePage'),
    },
  ];

  it.each(SCREENS)('exist in both languages for $name', ({ files, namespace }) => {
    const asked = files.flatMap((file) => literalKeys(read(file)).map((key) => ({ file, key })));
    expect(asked.length).toBeGreaterThan(0);

    for (const locale of Object.keys(LOCALES)) {
      const missing = asked.filter(({ key }) => {
        const prefix = namespace(key);
        return typeof lookup(LOCALES[locale], prefix ? `${prefix}.${key}` : key) !== 'string';
      });
      expect(missing.map(({ file, key }) => `${key} (${file})`), locale).toEqual([]);
    }
  });

  it('exist for the messages the administration console builds at run time', () => {
    const built = [
      ...['stats', 'activity', 'users', 'locals', 'health'].map((subject) => `${subject}Failed`),
      ...['checklist', 'invites', 'structure', 'taxonomy'].flatMap((entry) => [`hub.${entry}.title`, `hub.${entry}.body`]),
    ];

    for (const locale of Object.keys(LOCALES)) {
      for (const key of built) expect(typeof lookup(LOCALES[locale], `adminConsolePage.${key}`), `${locale} ${key}`).toBe('string');
    }
  });
});
