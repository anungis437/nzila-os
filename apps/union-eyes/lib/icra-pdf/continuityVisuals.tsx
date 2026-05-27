/**
 * ARTIFACT TYPE: PDF Visual Components
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * Leadership Briefing Report — Continuity Visuals
 *
 * React-PDF visual components: dimensional spectrums, burden index,
 * maturity band indicator, signal lists.
 *
 * Aesthetic target: editorial horizontal spectrums, muted institutional
 * palette, generous whitespace, calm and grounded.
 *
 * NOT: dashboard charts, gamified gauges, analytics exports.
 */

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { DimensionScore, StewardshipSignal } from '../icra/types';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  DIMENSION_LABELS,
  dimensionBarColor,
  burdenColor,
  burdenLabel,
} from './reportTheme';

// ─────────────────────────────────────────────────────────────────────────────
// Base styles (shared across components)
// ─────────────────────────────────────────────────────────────────────────────

const base = StyleSheet.create({
  sectionLabel: {
    fontFamily: FONTS.sans,
    ...TYPE.sectionLabel,
    color: COLORS.ink40,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACE.sm,
  },
  body: {
    fontFamily: FONTS.sans,
    ...TYPE.body,
    color: COLORS.ink,
  },
  caption: {
    fontFamily: FONTS.sans,
    ...TYPE.caption,
    color: COLORS.ink40,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CompositeScoreDisplay — large centred score with band name
// ─────────────────────────────────────────────────────────────────────────────

const compositeStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    padding: SPACE.xl,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: SPACE.lg,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACE.xs,
  },
  score: {
    fontFamily: FONTS.serifBold,
    ...TYPE.compositeScore,
    color: COLORS.navy,
    lineHeight: 1,
  },
  scoreMax: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: COLORS.ink40,
    marginLeft: 4,
    marginBottom: 8,
  },
  bandName: {
    fontFamily: FONTS.serifBold,
    ...TYPE.bandLabel,
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: SPACE.xs,
  },
  bandPattern: {
    fontFamily: FONTS.sansOblique,
    fontSize: 9,
    color: COLORS.ink40,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  barContainer: {
    width: '100%',
    marginTop: SPACE.md,
  },
  barTrack: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
  },
  barFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.teal,
  },
});

interface CompositeScoreDisplayProps {
  composite: number;
  ociBandName: string;
  operationalPattern: string;
}

export function CompositeScoreDisplay({
  composite,
  ociBandName,
  operationalPattern,
}: CompositeScoreDisplayProps) {
  const fillWidth = `${composite}%`;
  const scoreColor = composite < 35 ? COLORS.rust : composite < 55 ? COLORS.amber : COLORS.teal;

  return (
    <View style={compositeStyles.container}>
      <View style={compositeStyles.scoreRow}>
        <Text style={[compositeStyles.score, { color: scoreColor }]}>{composite}</Text>
        <Text style={compositeStyles.scoreMax}>/100</Text>
      </View>
      <Text style={compositeStyles.bandName}>{ociBandName}</Text>
      <Text style={compositeStyles.bandPattern}>{operationalPattern}</Text>
      <View style={compositeStyles.barContainer}>
        <View style={compositeStyles.barTrack}>
          <View style={[compositeStyles.barFill, { width: fillWidth, backgroundColor: scoreColor }]} />
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DimensionSpectrum — editorial horizontal bar for a single dimension
// ─────────────────────────────────────────────────────────────────────────────

const spectrumStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  label: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    color: COLORS.ink60,
    width: 130,
    flexShrink: 0,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 3,
    marginLeft: SPACE.sm,
    marginRight: SPACE.sm,
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  score: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    color: COLORS.ink40,
    width: 28,
    textAlign: 'right',
  },
});

interface DimensionSpectrumRowProps {
  dimension: DimensionScore;
}

export function DimensionSpectrumRow({ dimension }: DimensionSpectrumRowProps) {
  const label = DIMENSION_LABELS[dimension.dimension] ?? dimension.dimension;
  const fillColor = dimensionBarColor(dimension.score);
  const fillWidth = `${dimension.score}%`;

  return (
    <View style={spectrumStyles.row}>
      <Text style={spectrumStyles.label}>{label}</Text>
      <View style={spectrumStyles.track}>
        <View style={[spectrumStyles.fill, { width: fillWidth, backgroundColor: fillColor }]} />
      </View>
      <Text style={spectrumStyles.score}>{dimension.score}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DimensionGrid — full continuity spectrum section
// ─────────────────────────────────────────────────────────────────────────────

const gridStyles = StyleSheet.create({
  container: {
    marginBottom: SPACE.lg,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACE.xs,
    marginLeft: 138,
    marginRight: 32,
  },
  legendLabel: {
    fontFamily: FONTS.sans,
    fontSize: 7,
    color: COLORS.ink20,
  },
});

interface DimensionGridProps {
  dimensions: DimensionScore[];
}

export function DimensionGrid({ dimensions }: DimensionGridProps) {
  return (
    <View style={gridStyles.container}>
      <View style={gridStyles.legend}>
        <Text style={gridStyles.legendLabel}>0</Text>
        <Text style={gridStyles.legendLabel}>25</Text>
        <Text style={gridStyles.legendLabel}>50</Text>
        <Text style={gridStyles.legendLabel}>75</Text>
        <Text style={gridStyles.legendLabel}>100</Text>
      </View>
      {dimensions.map((dim) => (
        <DimensionSpectrumRow key={dim.dimension} dimension={dim} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BurdenIndexBlock — visual CBI with label and interpretation
// ─────────────────────────────────────────────────────────────────────────────

const burdenStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 4,
    padding: SPACE.md,
    backgroundColor: COLORS.surface,
    marginBottom: SPACE.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: SPACE.sm,
  },
  titleBlock: {
    flexShrink: 1,
  },
  title: {
    fontFamily: FONTS.sansBold,
    fontSize: 9,
    color: COLORS.ink60,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  levelLabel: {
    fontFamily: FONTS.serifBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  scoreText: {
    fontFamily: FONTS.sans,
    fontSize: 20,
    color: COLORS.ink40,
    lineHeight: 1,
  },
  track: {
    width: '100%',
    height: 5,
    backgroundColor: COLORS.borderLight,
    borderRadius: 3,
    marginBottom: SPACE.sm,
  },
  fill: {
    height: 5,
    borderRadius: 3,
  },
  interpretation: {
    fontFamily: FONTS.sansOblique,
    fontSize: 9,
    color: COLORS.ink60,
    lineHeight: 1.5,
  },
  indicators: {
    marginTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACE.sm,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.ink40,
    marginTop: 3,
    marginRight: 6,
    flexShrink: 0,
  },
  indicatorText: {
    fontFamily: FONTS.sans,
    fontSize: 8.5,
    color: COLORS.ink60,
    flex: 1,
    lineHeight: 1.4,
  },
});

interface BurdenIndexBlockProps {
  score: number;
  interpretation: string;
  humanCompensationIndicators: string[];
  showIndicators?: boolean;
}

export function BurdenIndexBlock({
  score,
  interpretation,
  humanCompensationIndicators,
  showIndicators = true,
}: BurdenIndexBlockProps) {
  const color = burdenColor(score);
  const level = burdenLabel(score);

  return (
    <View style={burdenStyles.container}>
      <View style={burdenStyles.header}>
        <View style={burdenStyles.titleBlock}>
          <Text style={burdenStyles.title}>Continuity Burden Index™</Text>
          <Text style={[burdenStyles.levelLabel, { color }]}>{level}</Text>
        </View>
        <Text style={burdenStyles.scoreText}>{score}</Text>
      </View>

      <View style={burdenStyles.track}>
        <View style={[burdenStyles.fill, { width: `${score}%`, backgroundColor: color }]} />
      </View>

      <Text style={burdenStyles.interpretation}>{interpretation}</Text>

      {showIndicators && humanCompensationIndicators.length > 0 && (
        <View style={burdenStyles.indicators}>
          {humanCompensationIndicators.slice(0, 5).map((indicator, idx) => (
            <View key={idx} style={burdenStyles.indicatorRow}>
              <View style={burdenStyles.dot} />
              <Text style={burdenStyles.indicatorText}>{indicator}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StewardshipSignalList — quiet institutional signal display
// ─────────────────────────────────────────────────────────────────────────────

const signalStyles = StyleSheet.create({
  container: {
    marginBottom: SPACE.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
    marginRight: SPACE.sm,
    flexShrink: 0,
  },
  signalText: {
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: COLORS.ink,
    flex: 1,
    lineHeight: 1.4,
  },
  severityText: {
    fontFamily: FONTS.sans,
    fontSize: 7.5,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 1.5,
    marginLeft: SPACE.sm,
    flexShrink: 0,
  },
});

const SEVERITY_COLORS: Record<StewardshipSignal['severity'], string> = {
  elevated: COLORS.rust,
  moderate: COLORS.amber,
  low: COLORS.tealLight,
};

interface StewardshipSignalListProps {
  signals: StewardshipSignal[];
}

export function StewardshipSignalList({ signals }: StewardshipSignalListProps) {
  if (signals.length === 0) return null;

  return (
    <View style={signalStyles.container}>
      {signals.map((signal) => (
        <View key={signal.id} style={signalStyles.row}>
          <View
            style={[
              signalStyles.severityDot,
              { backgroundColor: SEVERITY_COLORS[signal.severity] },
            ]}
          />
          <Text style={signalStyles.signalText}>{signal.label}</Text>
          <Text style={[signalStyles.severityText, { color: SEVERITY_COLORS[signal.severity] }]}>
            {signal.severity}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PageDivider — thin horizontal rule for section separation
// ─────────────────────────────────────────────────────────────────────────────

const dividerStyles = StyleSheet.create({
  line: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginTop: SPACE.lg,
    marginBottom: SPACE.lg,
  },
  thinLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
    marginTop: SPACE.sm,
    marginBottom: SPACE.sm,
  },
});

export function PageDivider({ thin = false }: { thin?: boolean }) {
  return <View style={thin ? dividerStyles.thinLine : dividerStyles.line} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// OCI Motif block — the closing institutional motif
// ─────────────────────────────────────────────────────────────────────────────

const motifStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACE.xl,
  },
  line: {
    width: 24,
    height: 1,
    backgroundColor: COLORS.gold,
    marginBottom: SPACE.md,
  },
  text: {
    fontFamily: FONTS.serifItalic,
    fontSize: 12,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 1.7,
    maxWidth: 320,
  },
  attribution: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: COLORS.ink40,
    marginTop: SPACE.sm,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

interface OciMotifProps {
  text: string;
  attribution?: string;
}

export function OciMotif({ text, attribution }: OciMotifProps) {
  return (
    <View style={motifStyles.container}>
      <View style={motifStyles.line} />
      <Text style={motifStyles.text}>"{text}"</Text>
      {attribution && <Text style={motifStyles.attribution}>{attribution}</Text>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecommendationBlock — single recommendation card
// ─────────────────────────────────────────────────────────────────────────────

const recStyles = StyleSheet.create({
  container: {
    marginBottom: SPACE.md,
    paddingLeft: SPACE.md,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.navy,
  },
  horizon: {
    fontFamily: FONTS.sans,
    fontSize: 7.5,
    color: COLORS.navy,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 11,
    color: COLORS.ink,
    marginBottom: SPACE.xs,
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: COLORS.ink60,
    lineHeight: 1.55,
  },
});

const HORIZON_LABELS: Record<string, string> = {
  immediate: 'Immediate — 90-Day Priority',
  structural: 'Structural — Governance Architecture',
  transformational: 'Transformational — OCI Pathway',
};

const HORIZON_COLORS: Record<string, string> = {
  immediate: COLORS.rust,
  structural: COLORS.navy,
  transformational: COLORS.teal,
};

interface RecommendationBlockProps {
  title: string;
  body: string;
  horizon: 'immediate' | 'structural' | 'transformational';
}

export function RecommendationBlock({ title, body, horizon }: RecommendationBlockProps) {
  return (
    <View style={[recStyles.container, { borderLeftColor: HORIZON_COLORS[horizon] }]}>
      <Text style={[recStyles.horizon, { color: HORIZON_COLORS[horizon] }]}>
        {HORIZON_LABELS[horizon]}
      </Text>
      <Text style={recStyles.title}>{title}</Text>
      <Text style={recStyles.body}>{body}</Text>
    </View>
  );
}
