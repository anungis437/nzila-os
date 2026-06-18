import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('node:fs', () => ({
  default: {
    readFileSync: () => [
      '# only-doc.md',
      '',
      '---',
      'title: Only Doc',
      'slug: only-doc',
      'category: Labour-Safe AI',
      'author: A',
      'publishedOn: 2024-01-01',
      'readTime: 5 min',
      'format: Article',
      'audience: Execs',
      'excerpt: Excerpt',
      '---',
      '',
      '## Heading',
      '- one',
    ].join('\n'),
    existsSync: () => false,
  },
}));

import * as content from '../insights-content';

describe('lib/insights-content', () => {
  it('re-exports the insights-parser surface', () => {
    expect(typeof content.getInsightArticles).toBe('function');
    expect(typeof content.getInsightBySlug).toBe('function');
    expect(Array.isArray(content.insightArticles)).toBe(true);
  });
});
