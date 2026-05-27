/**
 * ARTIFACT TYPE: PDF Template
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * Leadership Briefing Report — PDF Document Template
 *
 * React-PDF document with full editorial institutional layout.
 * Cover → Executive Summary → Continuity Profile →
 * Governance Entropy → Memory Holders → Modernization Review →
 * Recommendations → Executive Reflection.
 *
 * Visual target: governance briefing, not software artifact.
 * Typography: Times-Roman (serif) headings, Helvetica body.
 * Palette: institutional navy, warm grays, muted editorial tones.
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import type { PdfReportData } from './reportDataMapper';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  PAGE,
  DIMENSION_LABELS,
  SECTION_LABELS,
} from './reportTheme';
import {
  CompositeScoreDisplay,
  DimensionGrid,
  BurdenIndexBlock,
  StewardshipSignalList,
  PageDivider,
  OciMotif,
  RecommendationBlock,
} from './continuityVisuals';

// ─────────────────────────────────────────────────────────────────────────────
// Document-level styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  // Pages
  page: {
    backgroundColor: COLORS.paper,
    paddingTop: PAGE.marginTop,
    paddingBottom: PAGE.marginBottom,
    paddingLeft: PAGE.marginLeft,
    paddingRight: PAGE.marginRight,
    fontFamily: FONTS.sans,
  },
  coverPage: {
    backgroundColor: COLORS.paper,
    paddingTop: 64,
    paddingBottom: 52,
    paddingLeft: 64,
    paddingRight: 64,
    fontFamily: FONTS.sans,
  },

  // Common layout
  fill: { flex: 1 },

  // Section structure
  sectionLabel: {
    fontFamily: FONTS.sans,
    ...TYPE.sectionLabel,
    color: COLORS.ink40,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACE.sm,
  },
  sectionHeading: {
    fontFamily: FONTS.serifBold,
    ...TYPE.sectionHeading,
    color: COLORS.navy,
    marginBottom: SPACE.md,
  },
  subsectionHeading: {
    fontFamily: FONTS.serifBold,
    ...TYPE.subsectionHeading,
    color: COLORS.ink,
    marginBottom: SPACE.sm,
    marginTop: SPACE.md,
  },

  // Body prose
  bodyPara: {
    fontFamily: FONTS.sans,
    ...TYPE.body,
    color: COLORS.ink,
    marginBottom: SPACE.md,
    lineHeight: 1.65,
  },
  bodySmall: {
    fontFamily: FONTS.sans,
    ...TYPE.bodySmall,
    color: COLORS.ink60,
    lineHeight: 1.5,
  },

  // Divider
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    marginTop: SPACE.md,
    marginBottom: SPACE.lg,
  },
  thinDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
    marginTop: SPACE.sm,
    marginBottom: SPACE.sm,
  },

  // Footer
  pageFooter: {
    position: 'absolute',
    bottom: 28,
    left: PAGE.marginLeft,
    right: PAGE.marginRight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FONTS.sans,
    ...TYPE.footerText,
    color: COLORS.ink20,
  },
  footerCenter: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },

  // Cover page components
  coverOciLabel: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    letterSpacing: 2.5,
    color: COLORS.navy,
    textTransform: 'uppercase',
    marginBottom: SPACE.xxl,
  },
  coverRule: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACE.xxl,
  },
  coverTitle: {
    fontFamily: FONTS.serifBold,
    ...TYPE.coverTitle,
    color: COLORS.navy,
    lineHeight: 1.1,
    marginBottom: SPACE.sm,
  },
  coverSubtitle: {
    fontFamily: FONTS.serifItalic,
    ...TYPE.coverSubtitle,
    color: COLORS.ink60,
    marginBottom: SPACE.xxl,
  },
  coverInstitutionLabel: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    letterSpacing: 1.5,
    color: COLORS.ink40,
    textTransform: 'uppercase',
    marginBottom: SPACE.xs,
  },
  coverInstitution: {
    fontFamily: FONTS.serifBold,
    ...TYPE.coverInstitution,
    color: COLORS.ink,
    marginBottom: SPACE.xl,
  },
  coverBandLabel: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    letterSpacing: 1.5,
    color: COLORS.ink40,
    textTransform: 'uppercase',
    marginBottom: SPACE.xs,
  },
  coverBandName: {
    fontFamily: FONTS.serifBold,
    ...TYPE.coverBand,
    color: COLORS.navy,
    marginBottom: 3,
  },
  coverPattern: {
    fontFamily: FONTS.sansOblique,
    ...TYPE.coverPattern,
    color: COLORS.ink40,
    marginBottom: SPACE.xxl,
  },
  coverMotifContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACE.lg,
    marginBottom: SPACE.xxl,
  },
  coverMotif: {
    fontFamily: FONTS.serifItalic,
    ...TYPE.coverMotif,
    color: COLORS.ink60,
    lineHeight: 1.7,
    maxWidth: 360,
  },
  coverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  coverFooterLeft: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: COLORS.ink40,
    lineHeight: 1.5,
  },
  coverFooterRight: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: COLORS.ink40,
    textAlign: 'right',
    lineHeight: 1.5,
  },

  // Signal list
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
  },
  signalDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.tealLight,
    marginTop: 3.5,
    marginRight: SPACE.sm,
    flexShrink: 0,
  },
  signalText: {
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: COLORS.ink,
    flex: 1,
    lineHeight: 1.45,
  },

  // Observation block
  obsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACE.sm,
    paddingLeft: SPACE.sm,
    borderLeftWidth: 1.5,
    borderLeftColor: COLORS.borderLight,
  },
  obsText: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    color: COLORS.ink60,
    flex: 1,
    lineHeight: 1.5,
  },

  // Two-column layout for dimensions + context
  twoCol: {
    flexDirection: 'row',
  },
  colLeft: {
    flex: 3,
    paddingRight: SPACE.lg,
  },
  colRight: {
    flex: 2,
  },

  // Key stat block
  statBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  statValue: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: COLORS.navy,
    lineHeight: 1,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: COLORS.ink40,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Band characteristics list
  bandCharRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACE.xs,
  },
  bandCharDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.navy,
    marginTop: 4,
    marginRight: 6,
    flexShrink: 0,
  },
  bandCharText: {
    fontFamily: FONTS.sans,
    fontSize: 8.5,
    color: COLORS.ink60,
    flex: 1,
    lineHeight: 1.45,
  },

  // Pull quote
  pullQuote: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.navy,
    paddingLeft: SPACE.md,
    marginTop: SPACE.md,
    marginBottom: SPACE.md,
  },
  pullQuoteText: {
    fontFamily: FONTS.serifItalic,
    fontSize: 11,
    color: COLORS.navyLight,
    lineHeight: 1.6,
  },

  // Table of contents (optional)
  tocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
  },
  tocLabel: {
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: COLORS.ink,
  },
  tocPage: {
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: COLORS.ink40,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Footer (shared across pages)
// ─────────────────────────────────────────────────────────────────────────────

function PageFooter({
  institutionName,
  generatedAt,
}: {
  institutionName?: string;
  generatedAt: Date;
}) {
  const dateStr = generatedAt.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return (
    <View style={S.pageFooter} fixed>
      <Text style={S.footerText}>
        Leadership Briefing Report{institutionName ? ` · ${institutionName}` : ''}
      </Text>
      <View style={S.footerCenter} />
      <Text style={S.footerText}>UnionEyes / Nzila OS · {dateStr}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover Page
// ─────────────────────────────────────────────────────────────────────────────

function CoverPage({ data }: { data: PdfReportData }) {
  const dateStr = data.generatedAt.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Page size={PAGE.size} style={S.coverPage}>
      {/* OCI Label */}
      <Text style={S.coverOciLabel}>Organizational Continuity Infrastructure</Text>

      {/* Rule */}
      <View style={S.coverRule} />

      {/* Main title block */}
      <Text style={S.coverTitle}>Executive{'\n'}Continuity{'\n'}Brief</Text>
      <Text style={S.coverSubtitle}>OCI Continuity Risk Assessment</Text>

      {/* Institution name */}
      {data.institutionName && (
        <View>
          <Text style={S.coverInstitutionLabel}>Prepared for</Text>
          <Text style={S.coverInstitution}>{data.institutionName}</Text>
        </View>
      )}

      {/* OCI band */}
      <View>
        <Text style={S.coverBandLabel}>OCI Maturity Band</Text>
        <Text style={S.coverBandName}>{data.maturityBand.ociBandName}</Text>
        <Text style={S.coverPattern}>
          Operational Pattern: {data.maturityBand.operationalPattern}
        </Text>
      </View>

      {/* Motif */}
      <View style={S.coverMotifContainer}>
        <Text style={S.coverMotif}>
          "What institutions choose to remember determines what they become."
        </Text>
      </View>

      {/* Spacer */}
      <View style={S.fill} />

      {/* Footer */}
      <View style={S.coverFooter}>
        <Text style={S.coverFooterLeft}>
          Prepared by UnionEyes / Nzila OS{'\n'}
          Organizational Continuity Infrastructure Programme
        </Text>
        <Text style={S.coverFooterRight}>
          Generated {dateStr}{'\n'}
          Assessment Ref: {data.assessmentId.slice(0, 8).toUpperCase()}
        </Text>
      </View>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Executive Summary Page
// ─────────────────────────────────────────────────────────────────────────────

function ExecutiveSummaryPage({ data }: { data: PdfReportData }) {
  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Section 1</Text>
      <Text style={S.sectionHeading}>Executive Summary</Text>

      <View style={S.divider} />

      {data.narrative.executiveSummary.map((para, idx) => (
        <Text key={idx} style={S.bodyPara}>
          {para}
        </Text>
      ))}

      {/* Continuity signals observed */}
      {data.continuitySignals.filter((s) => s.observed).length > 0 && (
        <View>
          <Text style={S.subsectionHeading}>Continuity Signals Observed</Text>
          {data.continuitySignals
            .filter((s) => s.observed)
            .map((sig) => (
              <View key={sig.id} style={S.signalRow}>
                <View style={S.signalDot} />
                <Text style={S.signalText}>{sig.label}</Text>
              </View>
            ))}
        </View>
      )}

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Continuity Profile Page
// ─────────────────────────────────────────────────────────────────────────────

function ContinuityProfilePage({ data }: { data: PdfReportData }) {
  const { maturityBand, composite, dimensions, burdenIndex } = data;

  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Section 2</Text>
      <Text style={S.sectionHeading}>Institutional Continuity Profile</Text>

      <View style={S.divider} />

      {/* Composite score + band */}
      <CompositeScoreDisplay
        composite={composite}
        ociBandName={maturityBand.ociBandName}
        operationalPattern={maturityBand.operationalPattern}
      />

      {/* Band summary */}
      <View style={S.pullQuote}>
        <Text style={S.pullQuoteText}>{maturityBand.summary}</Text>
      </View>

      {/* Two-column: dimensions left, characteristics right */}
      <View style={S.twoCol}>
        <View style={S.colLeft}>
          <Text style={S.subsectionHeading}>Continuity Spectrum</Text>
          <DimensionGrid dimensions={dimensions} />
        </View>
        <View style={S.colRight}>
          <Text style={S.subsectionHeading}>Operational Characteristics</Text>
          {maturityBand.operationalCharacteristics.map((c, idx) => (
            <View key={idx} style={S.bandCharRow}>
              <View style={S.bandCharDot} />
              <Text style={S.bandCharText}>{c}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Burden index */}
      <Text style={S.subsectionHeading}>Continuity Burden Index™</Text>
      <BurdenIndexBlock
        score={burdenIndex.score}
        interpretation={burdenIndex.interpretation}
        humanCompensationIndicators={burdenIndex.humanCompensationIndicators}
        showIndicators={true}
      />

      {/* Stewardship signals */}
      {data.stewardshipSignals.length > 0 && (
        <View>
          <Text style={S.subsectionHeading}>Stewardship Signals</Text>
          <StewardshipSignalList signals={data.stewardshipSignals} />
        </View>
      )}

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance Entropy Page
// ─────────────────────────────────────────────────────────────────────────────

function GovernanceEntropyPage({ data }: { data: PdfReportData }) {
  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Section 3</Text>
      <Text style={S.sectionHeading}>Governance Entropy Analysis</Text>

      <View style={S.divider} />

      <Text style={[S.bodySmall, { marginBottom: SPACE.lg, color: COLORS.ink40 }]}>
        This section examines the consistency and coherence of governance practice: the alignment between documented procedure and operational reality, the reliability of governance evidence, and the patterns that indicate quiet governance drift over time.
      </Text>

      {data.narrative.governanceEntropy.map((para, idx) => (
        <Text key={idx} style={S.bodyPara}>
          {para}
        </Text>
      ))}

      {/* Material observations */}
      {data.observations.filter((o) => o.category === 'governance' && o.severity !== 'informational').length > 0 && (
        <View>
          <Text style={S.subsectionHeading}>Governance Observations</Text>
          {data.observations
            .filter((o) => o.category === 'governance')
            .map((obs, idx) => (
              <View key={idx} style={S.obsRow}>
                <Text style={S.obsText}>{obs.statement}</Text>
              </View>
            ))}
        </View>
      )}

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Institutional Memory & Continuity Holders
// ─────────────────────────────────────────────────────────────────────────────

function MemoryHoldersPage({ data }: { data: PdfReportData }) {
  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Section 4</Text>
      <Text style={S.sectionHeading}>Institutional Memory & Continuity Holders</Text>

      <View style={S.divider} />

      <Text style={[S.bodySmall, { marginBottom: SPACE.lg, color: COLORS.ink40 }]}>
        This section examines where institutional memory lives, how continuity labour is distributed, and what the concentration of operational knowledge in individuals means for transition resilience and governance sustainability.
      </Text>

      {data.narrative.memoryHolders.map((para, idx) => (
        <Text key={idx} style={S.bodyPara}>
          {para}
        </Text>
      ))}

      {/* Cross-dimensional insights */}
      {data.insights.length > 0 && (
        <View>
          <Text style={S.subsectionHeading}>Cross-Dimensional Observations</Text>
          {data.insights.map((insight, idx) => (
            <View key={idx} style={[S.obsRow, { borderLeftColor: insight.severity === 'material' ? COLORS.rust : COLORS.amber, marginBottom: SPACE.sm }]}>
              <View>
                <Text style={[S.bodySmall, { fontFamily: FONTS.sansBold, color: COLORS.ink, marginBottom: 2 }]}>
                  {insight.headline}
                </Text>
                <Text style={S.obsText}>{insight.body}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modernization & Continuity Review
// ─────────────────────────────────────────────────────────────────────────────

function ModernizationReviewPage({ data }: { data: PdfReportData }) {
  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Section 5</Text>
      <Text style={S.sectionHeading}>Modernization & OCI Review</Text>

      <View style={S.divider} />

      <Text style={[S.bodySmall, { marginBottom: SPACE.lg, color: COLORS.ink40 }]}>
        This section examines the intersection of technology modernization and institutional continuity — the risks of advancing operational capability without preserving the institutional context that makes that capability purposeful.
      </Text>

      {data.narrative.modernizationReview.map((para, idx) => (
        <Text key={idx} style={S.bodyPara}>
          {para}
        </Text>
      ))}

      {/* Governance implications from maturity band */}
      <Text style={S.subsectionHeading}>Governance Continuity Implications</Text>
      {data.maturityBand.continuityImplications.map((implication, idx) => (
        <View key={idx} style={S.bandCharRow}>
          <View style={S.bandCharDot} />
          <Text style={[S.bandCharText, { fontSize: 9.5 }]}>{implication}</Text>
        </View>
      ))}

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations
// ─────────────────────────────────────────────────────────────────────────────

function RecommendationsPage({ data }: { data: PdfReportData }) {
  const immediate = data.narrative.recommendations.filter((r) => r.horizon === 'immediate');
  const structural = data.narrative.recommendations.filter((r) => r.horizon === 'structural');
  const transformational = data.narrative.recommendations.filter(
    (r) => r.horizon === 'transformational',
  );

  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Section 6</Text>
      <Text style={S.sectionHeading}>Continuity Transformation Recommendations</Text>

      <View style={S.divider} />

      <Text style={[S.bodySmall, { marginBottom: SPACE.lg, color: COLORS.ink40 }]}>
        These recommendations are calibrated to the specific continuity posture of this institution. They are organized by planning horizon and represent a continuity-first approach to institutional development — not digital transformation hype, not consulting boilerplate.
      </Text>

      {immediate.length > 0 && (
        <View>
          <Text style={S.subsectionHeading}>Immediate Stabilization (90-Day Priorities)</Text>
          {immediate.map((rec, idx) => (
            <RecommendationBlock
              key={idx}
              title={rec.title}
              body={rec.body}
              horizon={rec.horizon}
            />
          ))}
        </View>
      )}

      {structural.length > 0 && (
        <View>
          <Text style={S.subsectionHeading}>Structural Improvements</Text>
          {structural.map((rec, idx) => (
            <RecommendationBlock
              key={idx}
              title={rec.title}
              body={rec.body}
              horizon={rec.horizon}
            />
          ))}
        </View>
      )}

      {transformational.length > 0 && (
        <View>
          <Text style={S.subsectionHeading}>Transformational OCI Pathway</Text>
          {transformational.map((rec, idx) => (
            <RecommendationBlock
              key={idx}
              title={rec.title}
              body={rec.body}
              horizon={rec.horizon}
            />
          ))}
        </View>
      )}

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Executive Reflection (closing page)
// ─────────────────────────────────────────────────────────────────────────────

function ExecutiveReflectionPage({ data }: { data: PdfReportData }) {
  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Closing Reflection</Text>
      <Text style={S.sectionHeading}>Executive Stewardship Reflections</Text>

      <View style={S.divider} />

      {data.narrative.executiveReflection.map((para, idx) => (
        <Text key={idx} style={S.bodyPara}>
          {para}
        </Text>
      ))}

      {/* OCI Motif */}
      <OciMotif
        text="What institutions choose to remember determines what they become."
        attribution="Organizational Continuity Infrastructure — OCI Doctrine"
      />

      {/* Final line */}
      <View style={[S.divider, { marginTop: SPACE.xl }]} />
      <Text
        style={[
          S.bodyPara,
          {
            fontFamily: FONTS.serifItalic,
            fontSize: 12,
            color: COLORS.navy,
            textAlign: 'center',
            lineHeight: 1.7,
          },
        ]}
      >
        Technology should help institutions remember their obligations to people.
      </Text>

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stabilization Movement Appendix (facilitated edition only)
//
// Optional appendix page rendered only when data.stabilizationMovement is
// supplied. The mapper composes the paragraphs from the executive
// stabilization model output. No appendix page is rendered for institutions
// that have not requested a facilitated-edition reading.
// ─────────────────────────────────────────────────────────────────────────────

function StabilizationMovementAppendixPage({ data }: { data: PdfReportData }) {
  const paragraphs = data.stabilizationMovement?.paragraphs ?? [];
  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Appendix — Facilitated Edition</Text>
      <Text style={S.sectionHeading}>Stabilization Movement</Text>
      <View style={S.divider} />

      {paragraphs.map((p, idx) => (
        <View key={`sm-${idx}`} style={{ marginBottom: SPACE.lg }}>
          <Text style={S.subsectionHeading}>{p.heading}</Text>
          <Text style={S.bodyPara}>{p.body}</Text>
        </View>
      ))}

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment Metadata Page (back matter)
// ─────────────────────────────────────────────────────────────────────────────

function AssessmentMetadataPage({ data }: { data: PdfReportData }) {
  const dateStr = data.generatedAt.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Page size={PAGE.size} style={S.page}>
      <Text style={S.sectionLabel}>Assessment Record</Text>
      <Text style={S.sectionHeading}>About This Assessment</Text>

      <View style={S.divider} />

      <Text style={S.bodyPara}>
        This Leadership Briefing Report was generated from the OCI Continuity Risk Assessment (ICRA), a structured self-assessment instrument designed to surface institutional continuity posture across five core dimensions: institutional continuity, governance fragility, evidence and traceability, operational memory, and transition readiness.
      </Text>

      <Text style={S.bodyPara}>
        Scoring is fully deterministic and traceable. Every observation in this brief derives directly from the answers provided in the assessment, applied against published question weights and scoring logic. No algorithmic black boxes. No opaque models. Every score can be reproduced from the underlying data.
      </Text>

      <Text style={S.subsectionHeading}>Assessment Details</Text>

      {[
        ['Assessment Reference', data.assessmentId.slice(0, 8).toUpperCase()],
        ['Generated', dateStr],
        ['Questions Answered', String(data.answeredQuestionCount)],
        ['Question Bank Version', `v${data.questionBankVersion}`],
        ['OCI Maturity Band', data.maturityBand.ociBandName],
        ['Operational Pattern', data.maturityBand.operationalPattern],
        ['Composite Continuity Indicator', `${data.composite}/100`],
        ...(data.institutionName ? [['Institution', data.institutionName]] : []),
        ...(data.sector ? [['Sector', data.sector]] : []),
        ...(data.jurisdiction ? [['Jurisdiction', data.jurisdiction]] : []),
      ].map(([label, value], idx) => (
        <View
          key={idx}
          style={[
            S.twoCol,
            {
              paddingVertical: 5,
              borderBottomWidth: 0.5,
              borderBottomColor: COLORS.borderLight,
            },
          ]}
        >
          <Text style={[S.bodySmall, { flex: 1, color: COLORS.ink40 }]}>{label}</Text>
          <Text style={[S.bodySmall, { flex: 2, color: COLORS.ink }]}>{value}</Text>
        </View>
      ))}

      <Text style={[S.subsectionHeading, { marginTop: SPACE.xl }]}>Section Scores</Text>
      {data.sections
        .filter((s) => s.section !== 'organizational_context')
        .map((sec) => (
          <View
            key={sec.section}
            style={[
              S.twoCol,
              {
                paddingVertical: 5,
                borderBottomWidth: 0.5,
                borderBottomColor: COLORS.borderLight,
              },
            ]}
          >
            <Text style={[S.bodySmall, { flex: 3, color: COLORS.ink60 }]}>
              {SECTION_LABELS[sec.section] ?? sec.section}
            </Text>
            <Text style={[S.bodySmall, { flex: 1, color: COLORS.ink, textAlign: 'right' }]}>
              {sec.score}/100
            </Text>
          </View>
        ))}

      <Text style={[S.bodySmall, { marginTop: SPACE.xl, color: COLORS.ink40, lineHeight: 1.6 }]}>
        This report was prepared by UnionEyes, a Nzila OS programme. The OCI Continuity Risk Assessment and the Organizational Continuity Infrastructure framework are proprietary analytical instruments. Results are intended for internal governance use. UnionEyes does not retain personally identifiable information beyond the pseudonymous assessment record.
      </Text>

      <PageFooter
        institutionName={data.institutionName}
        generatedAt={data.generatedAt}
      />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Document
// ─────────────────────────────────────────────────────────────────────────────

interface ExecutiveContinuityBriefTemplateProps {
  data: PdfReportData;
}

export function ExecutiveContinuityBriefTemplate({
  data,
}: ExecutiveContinuityBriefTemplateProps) {
  return (
    <Document
      title={`Leadership Briefing Report${data.institutionName ? ` — ${data.institutionName}` : ''}`}
      author="UnionEyes / Nzila OS"
      subject="OCI Continuity Risk Assessment — Leadership Briefing Report"
      keywords="OCI, institutional continuity, governance, continuity risk"
      creator="UnionEyes ICRA Platform"
      producer="UnionEyes / Nzila OS"
    >
      <CoverPage data={data} />
      <ExecutiveSummaryPage data={data} />
      <ContinuityProfilePage data={data} />
      <GovernanceEntropyPage data={data} />
      <MemoryHoldersPage data={data} />
      <ModernizationReviewPage data={data} />
      <RecommendationsPage data={data} />
      <ExecutiveReflectionPage data={data} />
      {data.stabilizationMovement ? <StabilizationMovementAppendixPage data={data} /> : null}
      <AssessmentMetadataPage data={data} />
    </Document>
  );
}
