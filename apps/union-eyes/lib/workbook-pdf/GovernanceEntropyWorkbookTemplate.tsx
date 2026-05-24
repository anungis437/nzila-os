/**
 * Governance Entropy Workbook PDF template.
 *
 * Structure:
 *   1. Cover
 *   2. Table of Contents
 *   3. Chapter 1 \u2014 Organizational Memory Holders (UNLOCKED)
 *   4. Chapters 2\u20136 \u2014 Reserved for the Facilitated Edition
 *   7. Closing reflection
 *
 * Same editorial palette and type as the Executive Continuity Brief.
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import { PAGE, COLORS, FONTS, TYPE, SPACE } from '@/lib/icra-pdf/reportTheme';
import { WORKBOOK_PALETTE } from './workbookTheme';
import type { CartographyResult, CartographySignal } from '@/lib/workbook/engines/stewardshipCartography';
import type { ContinuityLandscapeResult } from '@/lib/workbook/engines/continuityMappingEngine';
import type { ContinuityLineageResult } from '@/lib/workbook/engines/continuityLineageEngine';
import type { GovernanceEntropyResult } from '@/lib/workbook/engines/governanceEntropyEngine';
import type { ContinuityBreakpointResult } from '@/lib/workbook/engines/continuityBreakpointEngine';
import type { ModernizationAlignmentResult } from '@/lib/workbook/engines/modernizationAlignmentEngine';
import type { TransformationRoadmapResult } from '@/lib/workbook/engines/transformationRoadmapEngine';
import type { WorkbookSynthesisResult } from '@/lib/workbook/engines/workbookSynthesisEngine';
import type { StewardshipRedistributionResult } from '@/lib/workbook/engines/stewardshipRedistributionEngine';
import type { GovernanceRecoveryResult } from '@/lib/workbook/engines/governanceRecoveryEngine';
import type {
  WorkbookNarrative,
  ModuleNarrative,
} from './workbookNarrativeEngine';
import {
  buildLandscapeNarrative,
  buildLineageNarrative,
  buildBreakpointNarrative,
  buildModernizationNarrative,
  buildRoadmapNarrative,
  buildSynthesisNarrative,
  buildStewardshipRedistributionNarrative,
  buildGovernanceRecoveryNarrative,
} from './workbookNarrativeEngine';

export interface WorkbookModuleResults {
  landscape?: ContinuityLandscapeResult;
  lineage?: ContinuityLineageResult;
  entropy?: GovernanceEntropyResult;
  breakpoint?: ContinuityBreakpointResult;
  modernization?: ModernizationAlignmentResult;
  roadmap?: TransformationRoadmapResult;
  synthesis?: WorkbookSynthesisResult;
  stewardshipRedistribution?: StewardshipRedistributionResult;
  governanceRecovery?: GovernanceRecoveryResult;
}

export interface WorkbookPdfData {
  workbookId: string;
  locale: 'en-CA' | 'fr-CA';
  organizationName: string | null;
  generatedAt: Date;
  cartography: CartographyResult;
  narrative: WorkbookNarrative;
  holders: ReadonlyArray<{
    role: string;
    displayName: string | null;
    responsibility: string;
    tenureBand: string | null;
    criticality: string | null;
    successorIdentified: boolean;
  }>;
  modules?: WorkbookModuleResults;
}

const RESERVED_CHAPTERS = [
  { id: 'lineage', n: '02', en: 'Governance Lineage', fr: 'Lign\u00e9e de gouvernance' },
  { id: 'breakpoints', n: '03', en: 'Continuity Breakpoints', fr: 'Points de rupture de continuit\u00e9' },
  { id: 'entropy', n: '04', en: 'Governance Entropy Reading', fr: 'Lecture d\u2019entropie de gouvernance' },
  { id: 'modernization', n: '05', en: 'Modernization Alignment', fr: 'Alignement de modernisation' },
  { id: 'roadmap', n: '06', en: 'Transformation Roadmap', fr: 'Feuille de route de transformation' },
] as const;

const S = StyleSheet.create({
  page: {
    backgroundColor: COLORS.paper,
    paddingTop: PAGE.marginTop,
    paddingBottom: PAGE.marginBottom,
    paddingLeft: PAGE.marginLeft,
    paddingRight: PAGE.marginRight,
    fontFamily: FONTS.sans,
  },
  cover: {
    flex: 1,
    justifyContent: 'space-between',
  },
  ociLabel: {
    fontFamily: FONTS.sansBold,
    color: COLORS.gold,
    ...TYPE.coverOciLabel,
    textTransform: 'uppercase',
  },
  coverTitle: {
    fontFamily: FONTS.serif,
    color: COLORS.ink,
    ...TYPE.coverTitle,
    marginTop: SPACE.lg,
  },
  coverSubtitle: {
    fontFamily: FONTS.serifItalic,
    color: COLORS.ink60,
    ...TYPE.coverSubtitle,
    marginTop: SPACE.md,
  },
  coverInstitution: {
    fontFamily: FONTS.serif,
    color: COLORS.navy,
    ...TYPE.coverInstitution,
  },
  coverFooter: {
    fontFamily: FONTS.sans,
    color: COLORS.ink40,
    ...TYPE.footerText,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  rule: {
    borderBottomWidth: 0.6,
    borderBottomColor: COLORS.border,
    marginVertical: SPACE.lg,
  },
  ruleGold: {
    borderBottomWidth: 1,
    borderBottomColor: WORKBOOK_PALETTE.chapterRule,
    marginBottom: SPACE.lg,
    width: 48,
  },
  sectionLabel: {
    fontFamily: FONTS.sansBold,
    color: COLORS.ink40,
    ...TYPE.sectionLabel,
    textTransform: 'uppercase',
  },
  sectionHeading: {
    fontFamily: FONTS.serif,
    color: COLORS.ink,
    ...TYPE.sectionHeading,
    marginTop: SPACE.sm,
  },
  body: {
    fontFamily: FONTS.sans,
    color: COLORS.ink,
    ...TYPE.body,
    marginTop: SPACE.md,
  },
  bodyMuted: {
    fontFamily: FONTS.sans,
    color: COLORS.ink60,
    ...TYPE.body,
  },
  pullQuote: {
    fontFamily: FONTS.serifItalic,
    color: COLORS.navy,
    ...TYPE.pullQuote,
    marginTop: SPACE.lg,
  },
  tocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACE.sm,
  },
  tocNumber: {
    fontFamily: FONTS.sansBold,
    color: COLORS.gold,
    ...TYPE.bodySmall,
    width: 30,
  },
  tocTitle: {
    fontFamily: FONTS.serif,
    color: COLORS.ink,
    ...TYPE.body,
    flexGrow: 1,
  },
  tocLockChip: {
    fontFamily: FONTS.sansBold,
    color: WORKBOOK_PALETTE.lockedChip,
    ...TYPE.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  density: {
    fontFamily: FONTS.serif,
    color: COLORS.navy,
    ...TYPE.compositeScore,
    marginTop: SPACE.sm,
  },
  bandLabel: {
    fontFamily: FONTS.sansBold,
    color: COLORS.ink60,
    ...TYPE.bandLabel,
    textTransform: 'capitalize',
    marginTop: SPACE.xs,
  },
  holderRow: {
    marginTop: SPACE.md,
    paddingTop: SPACE.sm,
    borderTopWidth: 0.4,
    borderTopColor: COLORS.borderLight,
  },
  holderRole: {
    fontFamily: FONTS.serif,
    color: COLORS.ink,
    ...TYPE.subsectionHeading,
  },
  holderMeta: {
    fontFamily: FONTS.sans,
    color: COLORS.ink40,
    ...TYPE.caption,
    marginTop: 2,
  },
  holderResp: {
    fontFamily: FONTS.sans,
    color: COLORS.ink,
    ...TYPE.bodySmall,
    marginTop: SPACE.sm,
  },
  signalRow: {
    marginTop: SPACE.sm,
    paddingLeft: SPACE.sm,
    borderLeftWidth: 1.2,
    borderLeftColor: COLORS.border,
  },
  signalLabel: {
    fontFamily: FONTS.sansBold,
    color: COLORS.ink60,
    ...TYPE.signalLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  signalText: {
    fontFamily: FONTS.sans,
    color: COLORS.ink,
    ...TYPE.bodySmall,
    marginTop: 2,
  },
  reservedNote: {
    fontFamily: FONTS.serifItalic,
    color: COLORS.ink60,
    ...TYPE.body,
    marginTop: SPACE.lg,
  },
  footer: {
    position: 'absolute',
    bottom: SPACE.lg,
    left: PAGE.marginLeft,
    right: PAGE.marginRight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: COLORS.ink40,
    fontFamily: FONTS.sans,
    ...TYPE.footerText,
  },
});

function signalLabelColor(severity: CartographySignal['severity']) {
  switch (severity) {
    case 'critical':
      return WORKBOOK_PALETTE.signalCritical;
    case 'warning':
      return WORKBOOK_PALETTE.signalWarning;
    case 'observation':
      return WORKBOOK_PALETTE.signalObservation;
    default:
      return WORKBOOK_PALETTE.signalNote;
  }
}

type AnySignal = { signalId: string; severity: 'note' | 'observation' | 'warning' | 'critical'; statement: string };

function moduleNarrativeFor(
  id: (typeof RESERVED_CHAPTERS)[number]['id'],
  modules: WorkbookModuleResults | undefined,
): ModuleNarrative | null {
  if (!modules) return null;
  switch (id) {
    case 'lineage':
      return modules.lineage ? buildLineageNarrative(modules.lineage) : null;
    case 'breakpoints':
      return modules.breakpoint ? buildBreakpointNarrative(modules.breakpoint) : null;
    case 'entropy':
      return modules.entropy
        ? {
            opening: modules.entropy.reading,
            body: `Aggregate governance drift across mapped domains: ${modules.entropy.aggregateDrift.toFixed(2)} — ${modules.entropy.level.label}.`,
            signalsHeading: 'Entropy attribution',
          }
        : null;
    case 'modernization':
      return modules.modernization ? buildModernizationNarrative(modules.modernization) : null;
    case 'roadmap':
      return modules.roadmap ? buildRoadmapNarrative(modules.roadmap) : null;
    default:
      return null;
  }
}

function moduleSignalsFor(
  id: (typeof RESERVED_CHAPTERS)[number]['id'],
  modules: WorkbookModuleResults | undefined,
): readonly AnySignal[] {
  if (!modules) return [];
  switch (id) {
    case 'lineage':
      return modules.lineage?.signals ?? [];
    case 'breakpoints':
      return modules.breakpoint?.signals ?? [];
    case 'modernization':
      return modules.modernization?.signals ?? [];
    case 'roadmap':
      return modules.roadmap?.signals ?? [];
    case 'entropy':
      return (modules.entropy?.attribution ?? []).map((a) => ({
        signalId: `entropy_${a.domainId}`,
        severity:
          a.level.ordinal >= 4
            ? 'critical'
            : a.level.ordinal === 3
              ? 'warning'
              : a.level.ordinal === 2
                ? 'observation'
                : 'note',
        statement: `${a.label}: drift ${a.drift.toFixed(2)} — ${a.level.label}.`,
      }));
    default:
      return [];
  }
}

export function GovernanceEntropyWorkbookTemplate({ data }: { data: WorkbookPdfData }) {
  const fr = data.locale === 'fr-CA';
  const title = fr ? 'Cahier d\u2019Entropie de Gouvernance' : 'Governance Entropy Workbook';
  const subtitle = fr
    ? 'Une cartographie de la continuit\u00e9 organisationnelle'
    : 'A cartography of organizational continuity';
  const institution =
    data.organizationName ?? (fr ? '\u00c9dition autoguid\u00e9e' : 'Self-Guided Edition');
  const generated = data.generatedAt.toLocaleDateString(fr ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      {/* Cover */}
      <Page size={PAGE.size} style={S.page}>
        <View style={S.cover}>
          <View>
            <Text style={S.ociLabel}>OCI \u2014 Product 2</Text>
            <Text style={S.coverTitle}>{title}</Text>
            <Text style={S.coverSubtitle}>{subtitle}</Text>
          </View>
          <View>
            <View style={S.ruleGold} />
            <Text style={S.coverInstitution}>{institution}</Text>
            <Text style={[S.coverFooter, { marginTop: SPACE.md }]}>
              {fr ? 'G\u00e9n\u00e9r\u00e9 le' : 'Generated'} {generated}
            </Text>
          </View>
        </View>
      </Page>

      {/* Table of contents */}
      <Page size={PAGE.size} style={S.page}>
        <Text style={S.sectionLabel}>
          {fr ? 'Sommaire' : 'Table of contents'}
        </Text>
        <Text style={S.sectionHeading}>
          {fr ? 'Six modules. Un module ouvert.' : 'Six modules. One open module.'}
        </Text>
        <View style={S.rule} />

        <View style={S.tocRow}>
          <Text style={S.tocNumber}>01</Text>
          <Text style={S.tocTitle}>
            {fr ? 'Porteurs de m\u00e9moire organisationnelle' : 'Organizational Memory Holders'}
          </Text>
          <Text style={[S.tocLockChip, { color: COLORS.teal }]}>
            {fr ? 'Ouvert' : 'Open'}
          </Text>
        </View>

        {RESERVED_CHAPTERS.map((c) => (
          <View key={c.id} style={S.tocRow}>
            <Text style={S.tocNumber}>{c.n}</Text>
            <Text style={S.tocTitle}>{fr ? c.fr : c.en}</Text>
            <Text style={S.tocLockChip}>
              {fr ? 'Facilit\u00e9' : 'Facilitated'}
            </Text>
          </View>
        ))}

        <Text style={S.reservedNote}>
          {fr
            ? 'Les chapitres 02 \u00e0 06 sont r\u00e9serv\u00e9s \u00e0 l\u2019\u00e9dition facilit\u00e9e. Aucune restriction technique \u2014 ces chapitres exigent un dialogue organisationnel encadr\u00e9.'
            : 'Chapters 02\u201306 are reserved for the Facilitated Edition. No technical paywall \u2014 these chapters require an in-person organizational dialogue.'}
        </Text>

        <View style={S.footer} fixed>
          <Text>{title}</Text>
          <Text render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
        </View>
      </Page>

      {/* Chapter 01 \u2014 Memory Holders */}
      <Page size={PAGE.size} style={S.page} wrap>
        <Text style={S.sectionLabel}>
          {fr ? 'Chapitre 01' : 'Chapter 01'}
        </Text>
        <Text style={S.sectionHeading}>
          {fr ? 'Porteurs de m\u00e9moire organisationnelle' : 'Organizational Memory Holders'}
        </Text>
        <View style={S.rule} />

        <Text style={S.density}>{data.cartography.density.index.toFixed(2)}</Text>
        <Text style={S.bandLabel}>{data.cartography.density.band.label}</Text>

        <Text style={S.body}>{data.narrative.density}</Text>
        <Text style={S.pullQuote}>{data.narrative.posture}</Text>
        <Text style={S.body}>{data.narrative.concentration}</Text>

        {data.cartography.signals.length > 0 ? (
          <>
            <Text style={[S.sectionLabel, { marginTop: SPACE.lg }]}>
              {fr ? 'Signaux de cartographie' : 'Cartography signals'}
            </Text>
            {data.cartography.signals.map((s) => (
              <View key={s.signalId} style={S.signalRow}>
                <Text style={[S.signalLabel, { color: signalLabelColor(s.severity) }]}>
                  {s.severity}
                </Text>
                <Text style={S.signalText}>{s.statement}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Text style={[S.sectionLabel, { marginTop: SPACE.lg }]}>
          {fr ? 'Porteurs cartographi\u00e9s' : 'Mapped carriers'}
        </Text>

        {data.holders.length === 0 ? (
          <Text style={[S.bodyMuted, { marginTop: SPACE.md }]}>
            {fr
              ? 'Aucun porteur enregistr\u00e9. La cartographie commencera lorsque les porteurs seront ajout\u00e9s.'
              : 'No carriers recorded. The cartography will begin when carriers are added.'}
          </Text>
        ) : (
          data.holders.map((h, idx) => (
            <View key={idx} style={S.holderRow} wrap={false}>
              <Text style={S.holderRole}>{h.role}</Text>
              <Text style={S.holderMeta}>
                {[
                  h.criticality ?? '\u2014',
                  h.tenureBand ?? '\u2014',
                  h.successorIdentified
                    ? fr
                      ? 'successeur identifi\u00e9'
                      : 'successor identified'
                    : fr
                      ? 'aucun successeur'
                      : 'no successor',
                ].join(' \u00b7 ')}
              </Text>
              <Text style={S.holderResp}>{h.responsibility}</Text>
            </View>
          ))
        )}

        <View style={S.footer} fixed>
          <Text>{title}</Text>
          <Text render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
        </View>
      </Page>

      {/* Reserved chapters — render real content when modules data is provided. */}
      {RESERVED_CHAPTERS.map((c) => {
        const moduleNarrative = moduleNarrativeFor(c.id, data.modules);
        const signals = moduleSignalsFor(c.id, data.modules);
        return (
          <Page key={c.id} size={PAGE.size} style={S.page} wrap>
            <Text style={S.sectionLabel}>
              {fr ? `Chapitre ${c.n}` : `Chapter ${c.n}`}
            </Text>
            <Text style={S.sectionHeading}>{fr ? c.fr : c.en}</Text>
            <View style={S.rule} />
            {moduleNarrative ? (
              <>
                <Text style={S.body}>{moduleNarrative.opening}</Text>
                <Text style={[S.body, { marginTop: SPACE.md }]}>{moduleNarrative.body}</Text>
                {signals.length > 0 ? (
                  <>
                    <Text style={[S.sectionLabel, { marginTop: SPACE.lg }]}>
                      {moduleNarrative.signalsHeading}
                    </Text>
                    {signals.map((s, idx) => (
                      <View key={`${c.id}-${idx}`} style={S.signalRow}>
                        <Text style={[S.signalLabel, { color: signalLabelColor(s.severity) }]}>
                          {s.severity}
                        </Text>
                        <Text style={S.signalText}>{s.statement}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <Text style={S.reservedNote}>
                {fr
                  ? 'R\u00e9serv\u00e9 \u00e0 l\u2019\u00e9dition facilit\u00e9e. Cette section exige un dialogue organisationnel encadr\u00e9 par un facilitateur OCI.'
                  : 'Reserved for the Facilitated Edition. This chapter requires an organizational dialogue led by an OCI facilitator.'}
              </Text>
            )}

            <View style={S.footer} fixed>
              <Text>{title}</Text>
              <Text render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
            </View>
          </Page>
        );
      })}

      {/* Cross-module synthesis — rendered only if synthesis result is provided. */}
      {data.modules?.synthesis ? (
        <Page size={PAGE.size} style={S.page} wrap>
          <Text style={S.sectionLabel}>
            {fr ? 'Chapitre 07' : 'Chapter 07'}
          </Text>
          <Text style={S.sectionHeading}>
            {fr ? 'Synth\u00e8se inter-modules' : 'Cross-Module Synthesis'}
          </Text>
          <View style={S.rule} />
          {(() => {
            const n = buildSynthesisNarrative(data.modules.synthesis);
            return (
              <>
                <Text style={S.body}>{n.opening}</Text>
                <Text style={[S.body, { marginTop: SPACE.md }]}>{n.body}</Text>
                {data.modules.synthesis.crossModuleSignals.length > 0 ? (
                  <>
                    <Text style={[S.sectionLabel, { marginTop: SPACE.lg }]}>
                      {n.signalsHeading}
                    </Text>
                    {data.modules.synthesis.crossModuleSignals.map((s, idx) => (
                      <View key={`syn-${idx}`} style={S.signalRow}>
                        <Text style={[S.signalLabel, { color: signalLabelColor(s.severity) }]}>
                          {s.severity}
                        </Text>
                        <Text style={S.signalText}>{s.statement}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </>
            );
          })()}

          <View style={S.footer} fixed>
            <Text>{title}</Text>
            <Text render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
          </View>
        </Page>
      ) : null}

      {/* Chapter 08 — Stabilization Direction. Facilitated-edition only: rendered
          when either stewardshipRedistribution or governanceRecovery results are
          present. When neither is present, a reserved-edition notice appears in
          the reserved-chapters list above. */}
      {data.modules?.stewardshipRedistribution || data.modules?.governanceRecovery ? (
        <Page size={PAGE.size} style={S.page} wrap>
          <Text style={S.sectionLabel}>
            {fr ? 'Chapitre 08' : 'Chapter 08'}
          </Text>
          <Text style={S.sectionHeading}>
            {fr ? 'Direction de stabilisation' : 'Stabilization Direction'}
          </Text>
          <View style={S.rule} />

          {data.modules.stewardshipRedistribution ? (() => {
            const n = buildStewardshipRedistributionNarrative(data.modules.stewardshipRedistribution);
            const signals = data.modules.stewardshipRedistribution.signals;
            return (
              <View>
                <Text style={[S.sectionLabel, { marginTop: SPACE.md }]}>
                  {fr ? 'Redistribution de l\u2019intendance' : 'Stewardship redistribution'}
                </Text>
                <Text style={S.body}>{n.opening}</Text>
                <Text style={[S.body, { marginTop: SPACE.sm }]}>{n.body}</Text>
                {signals.length > 0 ? (
                  <>
                    <Text style={[S.sectionLabel, { marginTop: SPACE.md }]}>
                      {n.signalsHeading}
                    </Text>
                    {signals.map((s, idx) => (
                      <View key={`sr-${idx}`} style={S.signalRow}>
                        <Text style={[S.signalLabel, { color: signalLabelColor(s.severity) }]}>
                          {s.severity}
                        </Text>
                        <Text style={S.signalText}>{s.statement}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            );
          })() : null}

          {data.modules.governanceRecovery ? (() => {
            const n = buildGovernanceRecoveryNarrative(data.modules.governanceRecovery);
            const signals = data.modules.governanceRecovery.signals;
            return (
              <View style={{ marginTop: SPACE.lg }}>
                <Text style={[S.sectionLabel, { marginTop: SPACE.md }]}>
                  {fr ? 'R\u00e9cup\u00e9ration de la gouvernance' : 'Governance recovery'}
                </Text>
                <Text style={S.body}>{n.opening}</Text>
                <Text style={[S.body, { marginTop: SPACE.sm }]}>{n.body}</Text>
                {signals.length > 0 ? (
                  <>
                    <Text style={[S.sectionLabel, { marginTop: SPACE.md }]}>
                      {n.signalsHeading}
                    </Text>
                    {signals.map((s, idx) => (
                      <View key={`gr-${idx}`} style={S.signalRow}>
                        <Text style={[S.signalLabel, { color: signalLabelColor(s.severity) }]}>
                          {s.severity}
                        </Text>
                        <Text style={S.signalText}>{s.statement}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            );
          })() : null}

          <View style={S.footer} fixed>
            <Text>{title}</Text>
            <Text render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
          </View>
        </Page>
      ) : null}

      {/* Closing reflection */}
      <Page size={PAGE.size} style={S.page}>
        <Text style={S.sectionLabel}>
          {fr ? 'R\u00e9flexion finale' : 'Closing reflection'}
        </Text>
        <Text style={S.sectionHeading}>
          {fr ? 'La continuit\u00e9 se construit avant la perte.' : 'Continuity is built before the loss.'}
        </Text>
        <View style={S.rule} />
        <Text style={S.body}>
          {fr
            ? 'Ce cahier ne prescrit pas. Il vous tend un miroir d\u00e9terministe pour qu\u2019aucune cartographie ne dispara\u00eesse avec un seul d\u00e9part.'
            : 'This workbook prescribes nothing. It offers a deterministic mirror so that no cartography disappears with a single departure.'}
        </Text>
        <Text style={[S.bodyMuted, { marginTop: SPACE.lg }]}>
          {fr ? 'Cahier' : 'Workbook'} {data.workbookId}
        </Text>

        <View style={S.footer} fixed>
          <Text>{title}</Text>
          <Text render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
        </View>
      </Page>
    </Document>
  );
}
