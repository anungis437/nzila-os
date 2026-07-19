import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  warn: vi.fn(),
}));

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of [
    'insert', 'values', 'returning', 'update', 'set', 'where',
    'select', 'from', 'limit', 'orderBy', '$dynamic',
  ]) {
    c[m] = vi.fn(() => c);
  }
  (c as { then: (r: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(h.queue.shift() ?? []);
  };
  return c;
}

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => chain()),
    update: vi.fn(() => chain()),
    select: vi.fn(() => chain()),
  },
}));

vi.mock('@/db/schema', () => {
  const col = (name: string) => ({ name });
  return {
    accessibilityAudits: { id: col('id') },
    accessibilityIssues: {
      id: col('id'),
      organizationId: col('organizationId'),
      auditId: col('auditId'),
      severity: col('severity'),
      status: col('status'),
      wcagCriteria: col('wcagCriteria'),
    },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  desc: vi.fn(() => 'desc'),
  inArray: vi.fn(() => 'inArray'),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: h.warn } }));

import {
  AccessibilityAuditManager,
  AccessibilityReportGenerator,
  WCAGChecker,
} from '../accessibility-service';

beforeEach(() => {
  h.queue = [];
  h.warn.mockReset();
});

const auditRow = { id: 'a1', targetUrl: 'http://x', organizationId: 'o1' };

describe('AccessibilityAuditManager', () => {
  it('createAudit inserts and returns the audit', async () => {
    h.queue = [[{ id: 'a1' }]];
    const mgr = new AccessibilityAuditManager();
    const audit = await mgr.createAudit({
      organizationId: 'o1',
      auditName: 'n',
      auditType: 'automated',
      targetUrl: 'http://x',
      targetEnvironment: 'prod',
    });
    expect(audit).toEqual({ id: 'a1' });
  });

  it('runAutomatedAudit completes with empty violations (real runAxeScan)', async () => {
    h.queue = [[], [auditRow], []]; // update, select, update
    const mgr = new AccessibilityAuditManager();
    await mgr.runAutomatedAudit('a1');
    expect(h.warn).toHaveBeenCalled(); // axe scan unavailable
  });

  it('runAutomatedAudit saves issues when violations exist', async () => {
    h.queue = [[], [auditRow], [], []]; // update, select, insert, update
    const mgr = new AccessibilityAuditManager();
    (mgr as unknown as { runAxeScan: () => Promise<unknown> }).runAxeScan = vi
      .fn()
      .mockResolvedValue({
        violations: [
          {
            description: 'd', help: 'h', impact: 'critical',
            tags: ['wcag2aa'], helpUrl: 'u',
            nodes: [{ target: ['a', 'b'], html: '<a>', failureSummary: 'fix' }],
          },
          {
            description: 'd2', help: 'h2', impact: null,
            tags: [], helpUrl: 'u2', nodes: [],
          },
        ],
      });
    await mgr.runAutomatedAudit('a1');
  });

  it('runAutomatedAudit handles scan errors and rethrows', async () => {
    h.queue = [[], [auditRow], []]; // update, select, update(failed)
    const mgr = new AccessibilityAuditManager();
    (mgr as unknown as { runAxeScan: () => Promise<unknown> }).runAxeScan = vi
      .fn()
      .mockRejectedValue(new Error('scan failed'));
    await expect(mgr.runAutomatedAudit('a1')).rejects.toThrow('scan failed');
  });

  it('runAutomatedAudit throws when audit not found', async () => {
    h.queue = [[], []]; // update, select empty
    const mgr = new AccessibilityAuditManager();
    await expect(mgr.runAutomatedAudit('missing')).rejects.toThrow('Audit not found');
  });

  it('getAudit returns audit and issues', async () => {
    h.queue = [[auditRow], [{ id: 'i1' }]];
    const mgr = new AccessibilityAuditManager();
    const result = await mgr.getAudit('a1');
    expect(result.audit).toEqual(auditRow);
    expect(result.issues).toEqual([{ id: 'i1' }]);
  });

  it('getAudit throws when not found', async () => {
    h.queue = [[]];
    const mgr = new AccessibilityAuditManager();
    await expect(mgr.getAudit('x')).rejects.toThrow('Audit not found');
  });

  it('getOpenIssues applies all optional filters', async () => {
    h.queue = [[{ id: 'i1' }]];
    const mgr = new AccessibilityAuditManager();
    const issues = await mgr.getOpenIssues('o1', {
      severity: ['critical'],
      wcagCriteria: '1.1.1',
      status: 'open',
      limit: 10,
    });
    expect(issues).toEqual([{ id: 'i1' }]);
  });

  it('getOpenIssues works without filters', async () => {
    h.queue = [[]];
    const mgr = new AccessibilityAuditManager();
    expect(await mgr.getOpenIssues('o1')).toEqual([]);
  });

  it('resolveIssue updates the issue', async () => {
    h.queue = [[]];
    const mgr = new AccessibilityAuditManager();
    await expect(mgr.resolveIssue('i1', 'me', 'done')).resolves.toBeUndefined();
  });
});

describe('WCAGChecker', () => {
  const checker = new WCAGChecker();

  it('checkColorContrast evaluates AA/AAA/fail', () => {
    expect(checker.checkColorContrast('#000000', '#FFFFFF', 12, false).level).toBe('AAA');
    const fail = checker.checkColorContrast('#777777', '#888888', 12, false);
    expect(fail.passes).toBe(false);
    const large = checker.checkColorContrast('#000000', '#FFFFFF', 20, true);
    expect(large.requiredRatio).toBe(3.0);
  });

  it('checkKeyboardAccessibility flags inaccessible interactive elements', () => {
    const r = checker.checkKeyboardAccessibility({
      tagName: 'div', tabIndex: -1, role: 'button', hasOnClick: true,
    });
    expect(r.passes).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);

    const ok = checker.checkKeyboardAccessibility({
      tagName: 'button', hasOnClick: true,
    });
    expect(ok.passes).toBe(true);
  });

  it('checkAltText flags missing and short alt text', () => {
    expect(checker.checkAltText({ tagName: 'img' }).passes).toBe(false);
    expect(checker.checkAltText({ tagName: 'img', alt: 'ab' }).passes).toBe(false);
    expect(checker.checkAltText({ tagName: 'img', alt: 'a meaningful description' }).passes).toBe(true);
    expect(checker.checkAltText({ tagName: 'div' }).passes).toBe(true);
  });

  it('checkHeadingHierarchy detects missing headings and skips', () => {
    expect(checker.checkHeadingHierarchy([]).passes).toBe(false);
    const r = checker.checkHeadingHierarchy([
      { level: 2, text: 'a' },
      { level: 4, text: 'b' },
    ]);
    expect(r.passes).toBe(false);
    expect(checker.checkHeadingHierarchy([{ level: 1, text: 'a' }]).passes).toBe(true);
  });
});

describe('AccessibilityReportGenerator', () => {
  it('generateComplianceReport summarizes issues and recommendations', async () => {
    h.queue = [[
      { status: 'open', severity: 'critical', wcagCriteria: '1.1.1' },
      { status: 'resolved', severity: 'serious', wcagCriteria: '1.4.3' },
      { status: 'open', severity: 'moderate', wcagCriteria: '1.1.1' },
      { status: 'open', severity: 'minor', wcagCriteria: '2.1.1' },
    ]];
    const gen = new AccessibilityReportGenerator();
    const report = await gen.generateComplianceReport('o1');
    expect(report.summary.totalIssues).toBe(4);
    expect(report.criteriaCoverage.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.complianceScore).toBeLessThan(100);
  });
});
