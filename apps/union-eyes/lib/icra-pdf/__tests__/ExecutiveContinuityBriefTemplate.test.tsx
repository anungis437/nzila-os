// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';

globalThis.React = React;

// Replace React-PDF primitives with DOM wrappers so the whole document renders
// recursively in jsdom, forcing every sub-page component and `.map` callback to
// execute.
vi.mock('@react-pdf/renderer', () => {
  const makeComponent =
    (tag: string, displayName: string) => {
    const component = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(tag, null, children);
    component.displayName = displayName;
    return component;
    };
  return {
    Document: makeComponent('div', 'Document'),
    Page: makeComponent('div', 'Page'),
    View: makeComponent('div', 'View'),
    Text: makeComponent('span', 'Text'),
    StyleSheet: { create: (styles: unknown) => styles },
    Font: { register: () => undefined },
  };
});

import { ExecutiveContinuityBriefTemplate } from '../ExecutiveContinuityBriefTemplate';
import type { PdfReportData } from '../reportDataMapper';

type Overrides = Partial<Record<string, unknown>>;

function buildData(overrides: Overrides = {}): PdfReportData {
  const base = {
    assessmentId: 'abcdef1234567890',
    generatedAt: new Date('2024-06-01T12:00:00Z'),
    locale: 'en-CA',
    institutionName: 'Test Federation',
    sector: 'Public Sector',
    jurisdiction: 'Quebec',
    maturityBand: {
      ociBandName: 'Stewarded',
      operationalPattern: 'Reliant on individual memory holders',
      summary: 'The institution maintains continuity through informal stewardship.',
      operationalCharacteristics: ['Informal handoffs', 'Strong individual memory'],
      continuityImplications: ['Transition risk is concentrated', 'Documentation lags practice'],
    },
    composite: 62,
    dimensions: [
      { dimension: 'institutional_continuity', score: 70 },
      { dimension: 'governance_fragility', score: 40 },
    ],
    sections: [
      { section: 'operational_dependency', score: 60 },
      { section: 'governance_visibility', score: 55 },
      { section: 'organizational_context', score: 50 },
    ],
    insights: [
      { severity: 'material', headline: 'Material insight', body: 'Material body.' },
      { severity: 'advisory', headline: 'Advisory insight', body: 'Advisory body.' },
    ],
    continuitySignals: [
      { id: 'c1', observed: true, label: 'Observed signal' },
      { id: 'c2', observed: false, label: 'Unobserved signal' },
    ],
    stewardshipSignals: [{ id: 's1', severity: 'elevated', label: 'Stewardship signal' }],
    burdenIndex: {
      score: 55,
      interpretation: 'Moderate reliance on individuals.',
      humanCompensationIndicators: ['Indicator one', 'Indicator two'],
    },
    observations: [
      { category: 'governance', severity: 'material', statement: 'Governance observation.' },
      { category: 'governance', severity: 'informational', statement: 'Informational note.' },
    ],
    platformRecommendations: [],
    narrative: {
      executiveSummary: ['Summary paragraph one.', 'Summary paragraph two.'],
      governanceEntropy: ['Governance entropy paragraph.'],
      memoryHolders: ['Memory holders paragraph.'],
      modernizationReview: ['Modernization paragraph.'],
      recommendations: [
        { title: 'Immediate rec', body: 'Body.', horizon: 'immediate' },
        { title: 'Structural rec', body: 'Body.', horizon: 'structural' },
        { title: 'Transformational rec', body: 'Body.', horizon: 'transformational' },
      ],
      executiveReflection: ['Reflection paragraph.'],
    },
    answeredQuestionCount: 42,
    questionBankVersion: 3,
    stabilizationMovement: {
      paragraphs: [{ heading: 'Stabilization heading', body: 'Stabilization body.' }],
    },
    ...overrides,
  };
  return base as unknown as PdfReportData;
}

afterEach(() => cleanup());

describe('ExecutiveContinuityBriefTemplate', () => {
  it('renders the full document including the facilitated-edition appendix', () => {
    const { container } = render(
      React.createElement(ExecutiveContinuityBriefTemplate, { data: buildData() }),
    );
    expect(container.textContent).toContain('Executive');
    expect(container.textContent).toContain('Summary paragraph one.');
    expect(container.textContent).toContain('Stabilization heading');
    expect(container.textContent).toContain('Immediate rec');
    expect(container.textContent).toContain('Transformational rec');
    expect(container.textContent).toContain('Test Federation');
  });

  it('omits optional sections when data is minimal', () => {
    const { container } = render(
      React.createElement(ExecutiveContinuityBriefTemplate, {
        data: buildData({
          institutionName: undefined,
          sector: undefined,
          jurisdiction: undefined,
          stabilizationMovement: undefined,
          continuitySignals: [{ id: 'c1', observed: false, label: 'None observed' }],
          stewardshipSignals: [],
          insights: [],
          observations: [],
          narrative: {
            executiveSummary: ['Only summary.'],
            governanceEntropy: [],
            memoryHolders: [],
            modernizationReview: [],
            recommendations: [],
            executiveReflection: ['Only reflection.'],
          },
        }),
      }),
    );
    // No appendix heading when stabilizationMovement is absent.
    expect(container.textContent).not.toContain('Stabilization heading');
    expect(container.textContent).toContain('Only summary.');
  });
});
