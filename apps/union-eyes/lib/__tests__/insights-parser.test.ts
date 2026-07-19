import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  library: '',
  localized: {} as Record<string, string>,
}));

function doc(slug: string, category: string, opts: { bullets?: number } = {}): string {
  const bullets = Array.from({ length: opts.bullets ?? 4 }, (_, i) => `- takeaway ${i + 1}`).join('\n');
  return `# ${slug}.md

---
title: Title ${slug}
slug: ${slug}
category: ${category}
author: Author
publishedOn: 2024-01-01
readTime: 5 min
format: Article
audience: Executives
excerpt: Excerpt for ${slug}
---

## Heading One
${bullets}

### Subheading
Body paragraph for ${slug}.`;
}

function buildLibrary(): string {
  return [
    doc('labour-safe-ai-defined', 'Labour-Safe AI'),
    doc('labour-safe-ai-two', 'Labour-Safe AI'),
    doc('memory-one', 'Organizational Memory'),
    doc('continuity-one', 'Institutional Continuity'),
  ].join('\n');
}

vi.mock('node:fs', () => ({
  default: {
    readFileSync: (p: string) => {
      if (p.includes('union_eyes_insights_markdown_library')) return state.library;
      // Accept both POSIX ("/") and Windows ("\") path separators so the mock
      // works regardless of the platform running the test.
      const m = p.match(/fr-CA[\\/]([^\\/]+)\.md$/);
      if (m && state.localized[m[1]]) return state.localized[m[1]];
      throw new Error(`unexpected readFileSync: ${p}`);
    },
    existsSync: (p: string) => {
      const m = p.match(/fr-CA[\\/]([^\\/]+)\.md$/);
      return Boolean(m && state.localized[m[1]]);
    },
  },
}));

beforeEach(() => {
  state.library = buildLibrary();
  state.localized = {};
});

state.library = buildLibrary();

const parser = await import('../insights-parser');

describe('lib/insights-parser', () => {
  it('parses the article library at module load', () => {
    expect(parser.insightArticles.length).toBe(4);
    const featured = parser.insightArticles.find((a) => a.slug === 'labour-safe-ai-defined');
    expect(featured?.featured).toBe(true);
    // Only 3 takeaways are captured even though 4 bullets exist.
    expect(featured?.takeaways).toHaveLength(3);
    expect(featured?.headings).toContain('Heading One');
    expect(featured?.headings).toContain('Subheading');
  });

  it('renames the legacy Institutional Continuity category', () => {
    const article = parser.getInsightBySlug('continuity-one');
    expect(article?.categoryName).toBe('Organizational Continuity');
    expect(article?.categorySlug).toBe('institutional-continuity');
  });

  it('derives categories with descriptions', () => {
    const categories = parser.getInsightCategories();
    const names = categories.map((c) => c.name);
    expect(names).toContain('Labour-Safe AI');
    expect(parser.insightCategories.length).toBeGreaterThan(0);
    const labour = categories.find((c) => c.name === 'Labour-Safe AI');
    expect(labour?.description).toContain('responsible AI');
  });

  it('returns featured insights only', () => {
    const featured = parser.getFeaturedInsights();
    expect(featured.every((a) => a.featured)).toBe(true);
    expect(featured.map((a) => a.slug)).toContain('labour-safe-ai-defined');
  });

  it('filters insights by category', () => {
    const labour = parser.getInsightsByCategory('labour-safe-ai');
    expect(labour).toHaveLength(2);
  });

  it('finds a category by slug', () => {
    expect(parser.getInsightCategory('labour-safe-ai')?.name).toBe('Labour-Safe AI');
    expect(parser.getInsightCategory('nope')).toBeUndefined();
  });

  it('counts insights per category', () => {
    const counts = parser.getInsightCategoryCounts();
    expect(counts['labour-safe-ai']).toBe(2);
    expect(counts['organizational-memory']).toBe(1);
  });

  describe('getRelatedInsights', () => {
    it('returns same-category articles when enough exist', () => {
      const related = parser.getRelatedInsights('labour-safe-ai-defined', 1);
      expect(related).toHaveLength(1);
      expect(related[0].slug).toBe('labour-safe-ai-two');
    });

    it('back-fills from other categories when same-category is insufficient', () => {
      const related = parser.getRelatedInsights('labour-safe-ai-defined', 3);
      expect(related).toHaveLength(3);
      expect(related[0].slug).toBe('labour-safe-ai-two');
    });

    it('returns an empty list for an unknown slug', () => {
      expect(parser.getRelatedInsights('does-not-exist')).toEqual([]);
    });
  });

  it('builds locale-aware hrefs', () => {
    expect(parser.getInsightHref('my-slug')).toBe('/en-CA/insights/my-slug');
    expect(parser.getInsightHref('my-slug', 'fr-CA')).toBe('/fr-CA/insights/my-slug');
  });

  describe('localization (fr-CA)', () => {
    it('uses a localized document when present and falls back otherwise', () => {
      state.localized['labour-safe-ai-defined'] = doc('labour-safe-ai-defined', 'Labour-Safe AI')
        .replace('Title labour-safe-ai-defined', 'Titre FR');
      const articles = parser.getInsightArticles('fr-CA');
      const localized = articles.find((a) => a.slug === 'labour-safe-ai-defined');
      expect(localized?.title).toBe('Titre FR');
      // Untranslated article retains its English title.
      expect(articles.find((a) => a.slug === 'memory-one')?.title).toBe('Title memory-one');
    });
  });

  describe('parse errors', () => {
    it('throws on a malformed document', () => {
      state.library = 'not a valid insight document';
      expect(() => parser.getInsightArticles()).toThrow(/Unable to parse/);
    });

    it('throws on an unknown category', () => {
      state.library = doc('weird', 'Totally Unknown Category');
      expect(() => parser.getInsightArticles()).toThrow(/Unknown insight category/);
    });
  });
});
