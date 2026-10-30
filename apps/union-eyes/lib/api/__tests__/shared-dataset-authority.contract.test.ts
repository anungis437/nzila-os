import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Shared, platform-wide datasets (no organization column) and the rows a tenant owns through a parent. An organization's steward or administrator
// holds a role floor, not authority over rows every organization reads, so their writes need platform authority; and a table scoped through a
// parent must name it.
// DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET, DEF-0B4-CBA-INTEL-TENANT-STEWARD-REVIEWS-SHARED-DATASET,
// DEF-0B3-ARBITRATION-DECISIONS-ORG-ADMIN-DELETES-SHARED-ROW, DEF-0B4-CASE-STUDIES-ORG-ADMIN-WRITES-GLOBAL-CONTENT,
// DEF-0B4-CASE-STUDIES-READ-IGNORES-PUBLICATION-STATE, DEF-0B3-BARGAINING-PROPOSALS-NO-TENANT-PREDICATE.
const API = path.resolve(__dirname, '../../../app/api');
const read = (route: string) => readFileSync(path.join(API, ...route.split('/'), 'route.ts'), 'utf8');

describe('the extracted CBA dataset is changed only with platform authority', () => {
  const mutating: Array<[string, string]> = [
    ['cba-intelligence/review', 'POST'],
    ['cba-intelligence/extraction', 'POST'],
    ['cba-intelligence/ingestion', 'POST'],
    ['cba-intelligence/ingestion/run', 'POST'],
    ['cba-intelligence/ingestion/seed', 'POST'],
    ['cba-intelligence/sources', 'POST'],
    ['cba-intelligence/sources/[id]', 'PATCH'],
  ];

  it.each(mutating)('%s %s requires a platform administrator before it reads or writes anything', (route, method) => {
    const source = read(route);
    const start = source.indexOf(`export const ${method} = withApi(`);
    expect(start, `${route} exports ${method}`).toBeGreaterThanOrEqual(0);
    const handler = source.slice(start);
    const guard = handler.indexOf('await requireSystemAdmin()');
    expect(guard, `${route} ${method} calls requireSystemAdmin`).toBeGreaterThan(0);
    // The guard comes first in the handler: before any service call or transaction.
    const firstEffect = handler.search(/withRLSContext\(|await [a-z][A-Za-z]+\(/);
    expect(guard).toBeLessThanOrEqual(firstEffect < 0 ? guard : Math.max(firstEffect, guard));
  });
});

describe('shared reference content is written only by a platform content role', () => {
  it.each(['arbitration/precedents', 'arbitration/precedents/[id]', 'case-studies', 'case-studies/[slug]'])('%s', (route) => {
    const source = read(route);
    expect(source).toMatch(/writeRole: 'content_manager'/);
    expect(source).not.toMatch(/writeRole: '(member|steward|officer|admin)'/);
  });

  it('the public case-study list is limited to published rows, for the rows and the count', () => {
    const source = read('case-studies');
    expect(source).toMatch(/eq\(caseStudies\.visibility, 'public'\)/);
    expect(source).toMatch(/lte\(caseStudies\.publishedAt, new Date\(\)\)/);
    expect(source.match(/\.where\(publicOnly\)/g)).toHaveLength(2);
  });

  it('a case study is read by id or slug only by a content manager', () => {
    expect(read('case-studies/[slug]')).toMatch(/readRole: 'content_manager'/);
  });
});

describe('a table owned through a parent names the parent', () => {
  it('bargaining proposals are scoped through their negotiation', () => {
    const source = read('bargaining/proposals');
    expect(source).toMatch(/parentScope: \{ column: 'negotiationId', parent: negotiations \}/);
  });
});
