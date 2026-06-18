import { describe, it, expect } from 'vitest';
import { renderWhitepaperMarkdown } from '../markdown-renderer';

/**
 * `renderWhitepaperMarkdown` is a pure markdown -> React-node transform. Because
 * the JSX children (lists, table rows/cells, citation markers, section images)
 * are produced by eager `.map`/`.find`/`.filter` callbacks, simply calling the
 * function with markdown that exercises every block kind and inline marker
 * executes all of the internal functions — no DOM rendering required.
 */

const FULL_MARKDOWN = [
  '# Whitepaper Title',
  '',
  '**Author:** Jane Doe',
  '**Date:** 2024-01-01',
  '',
  '---',
  '',
  '## Central Thesis',
  '',
  '> "A single pull-quote line under the central thesis heading."',
  '',
  '## Section 1 — Introduction',
  '',
  'A paragraph with **bold**, *italic*, `code`, a [web link](https://example.com),',
  'a [relative link](/docs), a [1,2] citation, an OCI and OCRA and GES marker,',
  'and a malformed [link]( that should stay plain.',
  '',
  '### A Level Three Heading',
  '',
  '#### A Level Four Heading',
  '',
  '## 1.2 Numbered Subsection',
  '',
  '- First bullet',
  '  continuation of the first bullet',
  '- Second bullet',
  '',
  '1. First ordered',
  '   continuation of first ordered',
  '2. Second ordered',
  '',
  '| Column A | Column B |',
  '| --- | --- |',
  '| Cell **one** | Cell two |',
  '| Cell three | Cell four |',
  '',
  '> "A quoted statement."',
  '> — Some Attribution',
  '',
  '> A plain blockquote with no attribution and no central thesis.',
  '',
  '```ts',
  'const x = 1;',
  '```',
  '',
  '---',
  '',
  '## Duplicate Heading',
  '',
  'Body under first duplicate.',
  '',
  '## Duplicate Heading',
  '',
  'Body under second duplicate (forces a -1 slug suffix).',
].join('\n');

describe('renderWhitepaperMarkdown', () => {
  it('renders a comprehensive whitepaper covering every block and inline kind', () => {
    const result = renderWhitepaperMarkdown(FULL_MARKDOWN, {
      sectionImages: [
        { sectionIndex: 1, imageUrl: '/img/section-1.png', alt: 'Section one' },
      ],
    });

    expect(result.title).toBe('');
    // Level-2 headings become TOC items; duplicates produce distinct slugs.
    const slugs = result.tocItems.map((item) => item.slug);
    expect(slugs).toContain('central-thesis');
    expect(slugs).toContain('duplicate-heading');
    expect(slugs).toContain('duplicate-heading-1');
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it('strips the "Section N —" and numeric heading prefixes', () => {
    const result = renderWhitepaperMarkdown(FULL_MARKDOWN);
    const headings = result.tocItems.map((item) => item.heading);
    expect(headings).toContain('Introduction');
    expect(headings).toContain('Numbered Subsection');
  });

  it('returns the source untouched when there is no metadata preamble', () => {
    const result = renderWhitepaperMarkdown('## Plain Section\n\nJust a paragraph.');
    expect(result.title).toBe('');
    expect(result.tocItems).toHaveLength(1);
  });

  it('keeps a leading rule when the head has no top-level title', () => {
    // ruleIdx found but head does not start with `# `, so no preamble strip.
    const result = renderWhitepaperMarkdown('Intro line\n\n---\n\n## After Rule\n\nBody.');
    expect(result.tocItems.map((i) => i.slug)).toContain('after-rule');
  });

  it('does not strip when the head lacks metadata-style key lines', () => {
    const result = renderWhitepaperMarkdown('# Heading Only\n\nNo metadata here.\n\n---\n\n## Body Section\n\nText.');
    // The level-1 heading is still consumed as the title.
    expect(result.title).toBe('Heading Only');
  });
});
