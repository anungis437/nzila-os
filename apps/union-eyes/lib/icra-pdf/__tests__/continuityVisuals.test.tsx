// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';

globalThis.React = React;

// React-PDF primitives are replaced with plain DOM wrappers so the components
// render in jsdom and their internal `.map`/`.slice` callbacks execute.
vi.mock('@react-pdf/renderer', () => {
  const makeComponent =
    (tag: string, displayName: string) => {
    const component = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(tag, null, children);
    component.displayName = displayName;
    return component;
    };
  return {
    View: makeComponent('div', 'View'),
    Text: makeComponent('span', 'Text'),
    StyleSheet: { create: (styles: unknown) => styles },
    Font: { register: () => undefined },
  };
});

import {
  BurdenIndexBlock,
  CompositeScoreDisplay,
  DimensionGrid,
  DimensionSpectrumRow,
  OciMotif,
  PageDivider,
  RecommendationBlock,
  StewardshipSignalList,
} from '../continuityVisuals';

afterEach(() => cleanup());

describe('continuityVisuals', () => {
  it('CompositeScoreDisplay renders across all score-color thresholds', () => {
    for (const composite of [20, 45, 80]) {
      const { container } = render(
        React.createElement(CompositeScoreDisplay, {
          composite,
          ociBandName: 'Stewarded',
          operationalPattern: 'Reliant on memory holders',
        }),
      );
      expect(container.textContent).toContain(String(composite));
    }
  });

  it('DimensionSpectrumRow renders both known and unknown dimension labels', () => {
    const known = render(
      React.createElement(DimensionSpectrumRow, {
        dimension: { dimension: 'institutional_continuity', score: 72 } as never,
      }),
    );
    expect(known.container.textContent).toContain('72');

    const unknown = render(
      React.createElement(DimensionSpectrumRow, {
        dimension: { dimension: 'totally_unknown_dimension', score: 10 } as never,
      }),
    );
    expect(unknown.container.textContent).toContain('totally_unknown_dimension');
  });

  it('DimensionGrid maps over the supplied dimensions', () => {
    const { container } = render(
      React.createElement(DimensionGrid, {
        dimensions: [
          { dimension: 'institutional_continuity', score: 60 },
          { dimension: 'governance_fragility', score: 30 },
        ] as never,
      }),
    );
    expect(container.textContent).toContain('60');
    expect(container.textContent).toContain('30');
  });

  it('BurdenIndexBlock renders indicators when present and shown', () => {
    const { container } = render(
      React.createElement(BurdenIndexBlock, {
        score: 78,
        interpretation: 'Elevated reliance on individuals.',
        humanCompensationIndicators: ['a', 'b', 'c', 'd', 'e', 'f'],
        showIndicators: true,
      }),
    );
    expect(container.textContent).toContain('78');
    // slice(0, 5) keeps only the first five indicators.
    expect(container.textContent).toContain('e');
    expect(container.textContent).not.toContain('f');
  });

  it('BurdenIndexBlock hides indicators when showIndicators is false', () => {
    const { container } = render(
      React.createElement(BurdenIndexBlock, {
        score: 40,
        interpretation: 'Managed.',
        humanCompensationIndicators: ['hidden'],
        showIndicators: false,
      }),
    );
    expect(container.textContent).not.toContain('hidden');
  });

  it('StewardshipSignalList returns null when empty and maps signals otherwise', () => {
    const empty = render(
      React.createElement(StewardshipSignalList, { signals: [] as never }),
    );
    expect(empty.container.textContent).toBe('');

    const filled = render(
      React.createElement(StewardshipSignalList, {
        signals: [
          { id: 's1', severity: 'elevated', label: 'Signal one' },
          { id: 's2', severity: 'moderate', label: 'Signal two' },
          { id: 's3', severity: 'low', label: 'Signal three' },
        ] as never,
      }),
    );
    expect(filled.container.textContent).toContain('Signal one');
    expect(filled.container.textContent).toContain('Signal three');
  });

  it('PageDivider renders thin and standard variants', () => {
    expect(() => render(React.createElement(PageDivider, { thin: true }))).not.toThrow();
    expect(() => render(React.createElement(PageDivider, {}))).not.toThrow();
  });

  it('OciMotif renders with and without attribution', () => {
    const withAttr = render(
      React.createElement(OciMotif, { text: 'Continuity is stewardship.', attribution: 'OCI' }),
    );
    expect(withAttr.container.textContent).toContain('OCI');

    const noAttr = render(
      React.createElement(OciMotif, { text: 'Continuity is stewardship.' }),
    );
    expect(noAttr.container.textContent).toContain('Continuity is stewardship.');
  });

  it('RecommendationBlock renders every horizon variant', () => {
    for (const horizon of ['immediate', 'structural', 'transformational'] as const) {
      const { container } = render(
        React.createElement(RecommendationBlock, {
          title: `Title ${horizon}`,
          body: `Body ${horizon}`,
          horizon,
        }),
      );
      expect(container.textContent).toContain(`Title ${horizon}`);
    }
  });
});
