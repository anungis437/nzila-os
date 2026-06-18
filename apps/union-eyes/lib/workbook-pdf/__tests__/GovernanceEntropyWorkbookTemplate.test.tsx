// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';

globalThis.React = React;

// React-PDF primitives become DOM wrappers. The Text mock invokes the `render`
// prop (used by page footers) so those `({ pageNumber }) => ...` arrows execute.
vi.mock('@react-pdf/renderer', () => {
  const wrap =
    (tag: string, displayName: string) => {
    const component = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(tag, null, children);
    component.displayName = displayName;
    return component;
    };
  const Document = wrap('div', 'Document');
  const Page = wrap('div', 'Page');
  const View = wrap('div', 'View');
  const Text = ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: (props: { pageNumber: number }) => React.ReactNode;
  }) =>
      React.createElement(
        'span',
        null,
        typeof renderProp === 'function' ? renderProp({ pageNumber: 1 }) : children,
      );
  Text.displayName = 'Text';
  return {
    Document,
    Page,
    View,
    Text,
    StyleSheet: { create: (styles: unknown) => styles },
    Font: { register: () => undefined },
  };
});

// The narrative builders live in a sibling module; stub them with canned
// ModuleNarrative output so the template's IIFEs and module branches run
// without needing fully-formed engine result objects.
vi.mock('../workbookNarrativeEngine', () => {
  const moduleNarrative = { opening: 'Opening.', body: 'Body.', signalsHeading: 'Signals' };
  return {
    buildLineageNarrative: () => moduleNarrative,
    buildBreakpointNarrative: () => moduleNarrative,
    buildModernizationNarrative: () => moduleNarrative,
    buildRoadmapNarrative: () => moduleNarrative,
    buildSynthesisNarrative: () => moduleNarrative,
    buildStewardshipRedistributionNarrative: () => moduleNarrative,
    buildGovernanceRecoveryNarrative: () => moduleNarrative,
  };
});

import { GovernanceEntropyWorkbookTemplate } from '../GovernanceEntropyWorkbookTemplate';
import type { WorkbookPdfData } from '../GovernanceEntropyWorkbookTemplate';

function buildData(over: Record<string, unknown> = {}): WorkbookPdfData {
  const data = {
    workbookId: 'wb-123',
    locale: 'en-CA',
    organizationName: 'Test Local',
    generatedAt: new Date('2024-06-01T12:00:00Z'),
    cartography: {
      density: { index: 0.72, band: { label: 'Concentrated' } },
      // All four severities exercise every branch of signalLabelColor().
      signals: [
        { signalId: 'sig1', severity: 'critical', statement: 'Critical signal.' },
        { signalId: 'sig2', severity: 'warning', statement: 'Warning signal.' },
        { signalId: 'sig3', severity: 'observation', statement: 'Observation signal.' },
        { signalId: 'sig4', severity: 'note', statement: 'Note signal.' },
      ],
    },
    narrative: {
      density: 'Density narrative.',
      posture: 'Posture pull-quote.',
      concentration: 'Concentration narrative.',
    },
    holders: [
      {
        role: 'Bargaining Lead',
        displayName: 'A. Person',
        responsibility: 'Leads bargaining.',
        tenureBand: '15y_plus',
        criticality: 'institution_critical',
        successorIdentified: false,
      },
      {
        role: 'Grievance Lead',
        displayName: null,
        responsibility: 'Handles grievances.',
        tenureBand: null,
        criticality: null,
        successorIdentified: true,
      },
    ],
    modules: {
      entropy: {
        reading: 'Entropy reading.',
        aggregateDrift: 0.55,
        level: { label: 'Moderate' },
        // Ordinals 4/3/2/1 exercise every branch of the attribution severity map.
        attribution: [
          { domainId: 'd1', label: 'Domain One', drift: 0.9, level: { ordinal: 4, label: 'Severe' } },
          { domainId: 'd2', label: 'Domain Two', drift: 0.7, level: { ordinal: 3, label: 'Elevated' } },
          { domainId: 'd3', label: 'Domain Three', drift: 0.4, level: { ordinal: 2, label: 'Mild' } },
          { domainId: 'd4', label: 'Domain Four', drift: 0.1, level: { ordinal: 1, label: 'Low' } },
        ],
      },
      synthesis: {
        crossModuleSignals: [{ severity: 'critical', statement: 'Synthesis signal.' }],
      },
      stewardshipRedistribution: {
        signals: [{ severity: 'warning', statement: 'Redistribution signal.' }],
      },
      governanceRecovery: {
        signals: [{ severity: 'note', statement: 'Recovery signal.' }],
      },
    },
    ...over,
  };
  return data as unknown as WorkbookPdfData;
}

afterEach(() => cleanup());

describe('GovernanceEntropyWorkbookTemplate', () => {
  it('renders the full workbook with all module chapters (en-CA)', () => {
    const { container } = render(
      React.createElement(GovernanceEntropyWorkbookTemplate, { data: buildData() }),
    );
    expect(container.textContent).toContain('Governance Entropy Workbook');
    expect(container.textContent).toContain('Bargaining Lead');
    expect(container.textContent).toContain('Critical signal.');
    expect(container.textContent).toContain('Cross-Module Synthesis');
    expect(container.textContent).toContain('Stabilization Direction');
  });

  it('renders the French edition and tolerates absent modules/holders', () => {
    const { container } = render(
      React.createElement(GovernanceEntropyWorkbookTemplate, {
        data: buildData({
          locale: 'fr-CA',
          organizationName: null,
          holders: [],
          cartography: {
            density: { index: 0.1, band: { label: 'Distributed' } },
            signals: [],
          },
          modules: undefined,
        }),
      }),
    );
    expect(container.textContent).toContain('Cahier d\u2019Entropie de Gouvernance');
    // Reserved chapters fall back to the facilitated-edition notice.
    expect(container.textContent).toContain('\u00c9dition autoguid\u00e9e');
  });
});
