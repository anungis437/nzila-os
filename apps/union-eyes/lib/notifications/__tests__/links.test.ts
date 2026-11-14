// Where a notification sends the person who opens it. The builders (lib/notifications/links.ts) are held to two facts: the path is a page the app serves
// (read from the app router's page files, as the page-link census does) and the person it is written for may open it (the dashboard bounces a role from every
// page its experience does not include). The last group reads every `actionUrl` a writer sets in the tree, including the directories the census skips, so a
// notification cannot be written with a link to a page that does not exist or that nobody may open.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { appFiles, loadLocales } from '@/scripts/runtime/page-link-census';
import { DYNAMIC } from '@/scripts/lib/frontend-census/client-calls';
import { judgeLink, pageRoutesOf, pathsOf } from '@/scripts/lib/frontend-census/page-links';
import { UserRole } from '@/lib/auth/roles';
import { canAccessDashboardPath, getDashboardExperience, type DashboardExperience } from '@/lib/dashboard/role-experience';
import {
  isInAppPath,
  memberCaseUrl,
  messageThreadUrl,
  NOTIFICATION_LINK_BUILDERS,
  NotificationLinkError,
  sameSiteActionPath,
  workbenchUrl,
} from '../links';
import { inboxPathFor, localizedActionHref } from '../inbox-links';

const CLAIM = '8d3f6a52-1b0c-4a47-9f0e-0c5a3b7d1e01';
const THREAD = '7d9d8a3e-6b1c-4a53-9a2f-0f4e8f7d1b21';
const ROOT = process.cwd();
const pages = pageRoutesOf(appFiles(ROOT));
const locales = loadLocales(ROOT);
const EXPERIENCES: DashboardExperience[] = ['member', 'staff', 'executive', 'governance', 'admin'];

describe('the builders', () => {
  it('build the in-app paths, with the locale left to the screen that shows them', () => {
    expect(workbenchUrl()).toBe('/dashboard/workbench');
    expect(memberCaseUrl(CLAIM)).toBe(`/dashboard/claims/${CLAIM}`);
    expect(messageThreadUrl(THREAD, 'member')).toBe(`/dashboard/messages?thread=${THREAD}`);
    expect(messageThreadUrl(THREAD, 'staff')).toBe(`/dashboard/messages/staff?thread=${THREAD}`);
  });

  it('write an id in lower case', () => {
    expect(memberCaseUrl(CLAIM.toUpperCase())).toBe(`/dashboard/claims/${CLAIM}`);
    expect(messageThreadUrl(THREAD.toUpperCase(), 'staff')).toBe(`/dashboard/messages/staff?thread=${THREAD}`);
  });

  it.each(['', 'case_1', '../x', `${CLAIM}/../x`, `${CLAIM}?x=1`, `${CLAIM}#a`, `${CLAIM} `, 'null', '1'])('refuse %j, which is not a uuid, instead of building a path from it', (id) => {
    expect(() => memberCaseUrl(id)).toThrow(NotificationLinkError);
    expect(() => messageThreadUrl(id, 'member')).toThrow(NotificationLinkError);
  });

  it('refuse something that is not even a string', () => {
    expect(() => memberCaseUrl(undefined as unknown as string)).toThrow();
    expect(() => messageThreadUrl(null as unknown as string, 'staff')).toThrow();
  });
});

describe('a path somebody configured', () => {
  it.each(['/dashboard/workbench', '/dashboard/messages?thread=abc#top', '/'])('is kept when it is an in-app path (%s)', (value) => {
    expect(sameSiteActionPath(value)).toBe(value);
    expect(isInAppPath(value)).toBe(true);
  });

  it.each(['//evil.example/x', 'https://evil.example/x', 'javascript:alert(1)', 'dashboard/x', '/a b', '/a\\b', '/a\nb', '', `/${'a'.repeat(500)}`, 5, null, undefined, {}])(
    'is left out, not guessed at, when it is %j',
    (value) => {
      expect(sameSiteActionPath(value)).toBeUndefined();
      expect(isInAppPath(value)).toBe(false);
    },
  );
});

describe('the link a reader is given', () => {
  it("puts the reader's locale in front of an in-app path", () => {
    expect(localizedActionHref('fr-CA', '/dashboard/workbench')).toBe('/fr-CA/dashboard/workbench');
    expect(localizedActionHref('en-CA', '/dashboard/messages/staff?thread=abc')).toBe('/en-CA/dashboard/messages/staff?thread=abc');
  });

  it('keeps a path that already begins with a locale, which an older writer may have stored', () => {
    expect(localizedActionHref('fr-CA', '/en-CA/dashboard/workbench')).toBe('/en-CA/dashboard/workbench');
    expect(localizedActionHref('fr-CA', '/it?x=1')).toBe('/it?x=1');
  });

  it.each(['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)', 'dashboard/x', '', '/a b'])('makes no link of %j, which is not an in-app path', (stored) => {
    expect(localizedActionHref('en-CA', stored)).toBeNull();
  });
});

describe('every builder leads to a page the app serves, in every locale', () => {
  const SAMPLES: Record<string, string> = {
    memberCaseUrl: memberCaseUrl(CLAIM),
    workbenchUrl: workbenchUrl(),
    'messageThreadUrl (member)': messageThreadUrl(THREAD, 'member'),
    'messageThreadUrl (staff)': messageThreadUrl(THREAD, 'staff'),
    'the notifications page': '/dashboard/notifications',
    'a member Home': '/dashboard',
  };

  it('reads the pages from the app router, so the check is against files and not against a list kept here', () => {
    expect(pages.length).toBeGreaterThan(100);
    expect(locales).toContain('en-CA');
    expect(locales).toContain('fr-CA');
  });

  it.each(Object.entries(SAMPLES))('%s: %s', (_name, sample) => {
    expect(judgeLink(sample, pages, locales)).toBe('OK');
    for (const locale of locales) expect(judgeLink(localizedActionHref(locale, sample) ?? '', pages, locales), `${locale}${sample}`).toBe('OK');
  });

  it('does see a path no page serves, so the check above is not vacuous', () => {
    for (const missing of ['/dashboard/alerts', '/dashboard/cases/abc', '/grievances/abc', '/documents/abc/sign', '/dashboard/signatures/abc']) {
      expect(judgeLink(missing, pages, locales), missing).toBe('PAGE_MISSING');
    }
  });
});

describe('every builder leads to a page the person it is written for may open', () => {
  const OPEN_FOR: Array<[string, string, DashboardExperience]> = [
    ['memberCaseUrl', memberCaseUrl(CLAIM), 'member'],
    ['messageThreadUrl (member)', messageThreadUrl(THREAD, 'member'), 'member'],
    ['workbenchUrl', workbenchUrl(), 'staff'],
    ['messageThreadUrl (staff)', messageThreadUrl(THREAD, 'staff'), 'staff'],
  ];

  it.each(OPEN_FOR)('%s is open to %s, in pilot mode and out of it', (_name, link, experience) => {
    const pathname = link.split('?')[0];
    expect(canAccessDashboardPath(pathname, experience, false)).toBe(true);
    expect(canAccessDashboardPath(pathname, experience, true)).toBe(true);
  });

  it('keeps individual grievance links reachable through case authority without admitting collection or creation routes', () => {
    const detail = `/dashboard/grievances/${CLAIM}`;
    expect(judgeLink(`/en-CA${detail}`, pages, locales)).toBe('OK');
    for (const experience of EXPERIENCES) {
      for (const pilot of [false, true]) {
        expect(canAccessDashboardPath(detail, experience, pilot), experience).toBe(true);
        expect(canAccessDashboardPath('/dashboard/grievances', experience, pilot)).toBe(false);
        expect(canAccessDashboardPath('/dashboard/grievances/new', experience, pilot)).toBe(false);
      }
    }
  });
});

describe('the page that shows a person their inbox', () => {
  it('is the notifications page for staff and Home for a member', () => {
    for (const role of ['steward', 'chief_steward', 'clerk', 'health_safety_rep']) expect(inboxPathFor(role), role).toBe('/dashboard/notifications');
    for (const role of ['member', 'unknown_role', '', null, undefined]) expect(inboxPathFor(role), String(role)).toBe('/dashboard');
  });

  it.each(Object.values(UserRole))('is, for %s, a page the role may open and the app serves, or none', (role) => {
    const target = inboxPathFor(role);
    if (target === null) return;
    const experience = getDashboardExperience(role);
    expect(canAccessDashboardPath(target, experience, false), `${role} -> ${target}`).toBe(true);
    expect(canAccessDashboardPath(target, experience, true), `${role} -> ${target} (pilot)`).toBe(true);
    expect(judgeLink(`/en-CA${target}`, pages, locales), `${role} -> ${target}`).toBe('OK');
  });

  it('is none for a role the dashboard sends away from the inbox, never a link it would bounce', () => {
    for (const role of ['admin', 'system_admin', 'president', 'officer', 'compliance_manager']) {
      expect(canAccessDashboardPath('/dashboard/notifications', getDashboardExperience(role), false), role).toBe(false);
      expect(inboxPathFor(role), role).toBeNull();
    }
  });
});

// ---- every actionUrl a writer sets --------------------------------------------------------------------------------------------------------------------

const SCAN_DIRS = ['app', 'lib', 'services', 'actions'];
const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', '__mocks__', 'financial-service']);
const TEST_FILE = /\.(test|spec)\.[tj]sx?$|\.d\.ts$/;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const relative = `${dir}/${name}`;
    if (statSync(path.join(ROOT, relative)).isDirectory()) {
      if (!SKIP_DIRS.has(name)) sourceFiles(relative, found);
    } else if (/\.[tj]sx?$/.test(name) && !TEST_FILE.test(name)) found.push(relative);
  }
  return found;
}

const FILES = SCAN_DIRS.flatMap((dir) => sourceFiles(dir));

// Modules that nothing but their own tests import. Their notifications are never sent, so their links are never followed; each is held here only while that stays
// true, and the moment something imports one, the links in it must be right like every other.
const UNREFERENCED: Record<string, string> = {
  'lib/integrations/marketing-notifications.ts': 'imported only by its test',
  'services/tax-slip-service.ts': 'imported only by its test (services/__tests__/round34-dead-writer-reachability-lock.test.ts pins it)',
  'lib/services/signature-workflow-service.ts': 'imported only by its test',
};

interface Writer {
  file: string;
  line: number;
  kind: 'builder' | 'path' | 'absent' | 'schema' | 'reader' | 'other';
  text: string;
  paths: string[];
}

function writersIn(file: string): Writer[] {
  const text = readFileSync(path.join(ROOT, file), 'utf8');
  if (!text.includes('actionUrl')) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const writers: Writer[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === 'actionUrl') {
      const init = node.initializer;
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      const written = init.getText(source);
      let kind: Writer['kind'] = 'other';
      let paths: string[] = [];
      if (ts.isIdentifier(init) && init.text === 'undefined') kind = 'absent';
      else if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && (NOTIFICATION_LINK_BUILDERS as readonly string[]).includes(init.expression.text)) kind = 'builder';
      else if (/^z\./.test(written)) kind = 'schema';
      // A record parser reads the stored value (`optionalString(row, 'actionUrl')`); it writes nothing, and the reader's side (inbox-links.ts) judges what it finds.
      else if (ts.isCallExpression(init) && init.arguments.some((argument) => ts.isStringLiteral(argument) && argument.text === 'actionUrl')) kind = 'reader';
      else {
        paths = pathsOf(init);
        if (paths.length > 0) kind = 'path';
      }
      writers.push({ file, line: line + 1, kind, text: written, paths });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return writers;
}

const WRITERS = FILES.filter((file) => !(file in UNREFERENCED)).flatMap(writersIn);

/** A path as the census writes it, with each unknown part made a segment the dashboard policy can read. */
const readable = (candidate: string) => candidate.split(/[?#]/)[0].replaceAll(DYNAMIC, 'x');

describe('every actionUrl a writer sets, in the directories the census skips as well', () => {
  it('finds the writers, so the check is not vacuous', () => {
    const live = WRITERS.filter((writer) => writer.kind === 'builder');
    expect(live.map((writer) => writer.file)).toEqual(
      expect.arrayContaining(['lib/workflow/sla-alerts.ts', 'lib/messaging/thread-access.ts', 'lib/messaging/thread-assignment.ts', 'app/api/cases/[caseId]/transition/route.ts']),
    );
    expect(WRITERS.some((writer) => writer.file === 'lib/notifications/inbox-handlers.ts' && writer.kind === 'schema')).toBe(true);
  });

  it('is a builder, a path to a page that exists and some role may open, nothing, or a validated schema: never another expression', () => {
    const offenders: string[] = [];
    for (const writer of WRITERS) {
      const where = `${writer.file}:${writer.line}  actionUrl: ${writer.text}`;
      if (writer.kind === 'other') offenders.push(`${where}  (an expression the guard cannot read: build the path with lib/notifications/links.ts)`);
      if (writer.kind !== 'path') continue;
      for (const candidate of writer.paths) {
        if (judgeLink(candidate, pages, locales) !== 'OK') offenders.push(`${where}  (no page serves ${readable(candidate)})`);
        else if (readable(candidate).startsWith('/dashboard') && !EXPERIENCES.some((experience) => canAccessDashboardPath(readable(candidate), experience, false))) {
          offenders.push(`${where}  (no role may open ${readable(candidate)}: the dashboard sends every role away from it)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is not made of a literal path in a file that writes inbox rows: those go through the builders, which are held to the persona above', () => {
    const literal = WRITERS.filter((writer) => writer.kind === 'path' && readFileSync(path.join(ROOT, writer.file), 'utf8').includes('inAppNotifications'));
    expect(literal.map((writer) => `${writer.file}:${writer.line}  ${writer.text}`)).toEqual([]);
  });

  it.each(Object.entries(UNREFERENCED))('keeps %s out of reach: %s', (file) => {
    const base = path.basename(file).replace(/\.[tj]sx?$/, '');
    const importer = new RegExp(`from\\s+['"][^'"]*/${base}['"]|import\\(\\s*['"][^'"]*/${base}['"]`);
    const importers = [...FILES, ...['components', 'hooks'].filter((dir) => existsSync(path.join(ROOT, dir))).flatMap((dir) => sourceFiles(dir))].filter(
      (candidate) => candidate !== file && importer.test(readFileSync(path.join(ROOT, candidate), 'utf8')),
    );
    expect(importers).toEqual([]);
  });
});
