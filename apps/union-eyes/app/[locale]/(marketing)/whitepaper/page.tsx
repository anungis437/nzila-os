import type { Metadata } from 'next';
import type * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { CONTINUITY_GAP_BLOCKS } from '@/lib/whitepaper/continuity-gap';
// PDF download temporarily hidden; keep PrintPdfButton import path available for re-enable.
// import { PrintPdfButton } from './PrintPdfButton';

const WHITEPAPER_COPY = {
  'en-CA': {
    title: 'UnionEyes Whitepaper | Organizational Continuity Infrastructure',
    description:
      'The UnionEyes whitepaper outlines the Organizational Continuity Infrastructure (OCI) model, governance boundaries, deterministic AI doctrine, and deployment controls for labour organizations.',
    heading: 'UnionEyes Whitepaper',
    heroDescription:
      'An executive technical brief on Organizational Continuity Infrastructure, governed AI boundaries, and operational safeguards for labour leadership.',
    subtitle: 'Whitepaper article',
    ctaLabel: 'Read Insights Library',
    ctaHref: '/insights',
    downloadLabel: 'Download Full PDF',
    tocLabel: 'On this page',
    articleMeta: {
      format: 'Evidence-Enhanced Whitepaper',
      version: 'v3.0',
      author: 'Nzila Ventures / Nzila OS Research Initiative',
      source: 'Primary source',
    },
    sourceLabel: 'Source file',
    sourceValue: 'infotech/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf',
    articleNotice:
      'This page renders the full extracted whitepaper text and preserves section order for direct online reading.',
    abstractLabel: 'Abstract',
    abstractReadingTime: '~25 minute read',
    abstractBody:
      'Canadian labour organizations face a generational continuity gap: 5.2 million boomers have already left the workforce, another 2.7 million are projected to exit within five years, and labour-force participation is forecast to decline by more than two percentage points by 2030. Succession planning, headcount strategy, and document retention were designed for a different scale of loss and cannot, on their own, preserve the organizational memory, governance posture, and decision lineage that organized labour relies on.',
    abstractBodyTwo:
      'This whitepaper introduces organizational continuity infrastructure as a distinct discipline. It defines the Organizational Continuity Index (OCI) and Organizational Continuity Risk Analysis (OCRA), describes the deterministic-AI doctrine and governance boundaries used to keep continuity tooling safe under labour scrutiny, and outlines the deployment controls, evidence model, and legal alignment that allow unions, federations, and democratic organizations to operationalize continuity without surrendering authority over their own organizational memory.',
    abstractCallouts: [
      'Defines OCI and OCRA as organizational continuity primitives.',
      'Articulates deterministic-AI doctrine and governance boundaries.',
      'Maps deployment, evidence, and legal alignment for labour organizations.',
    ],
  },
  'fr-CA': {
    title: 'Livre blanc UnionEyes | Infrastructure de continuite organisationnelle',
    description:
      'Le livre blanc UnionEyes presente le modele d Infrastructure de continuite organisationnelle (OCI), les limites de gouvernance, la doctrine IA deterministe et les controles de deploiement pour les organisations syndicales.',
    heading: 'Livre blanc UnionEyes',
    heroDescription:
      'Une note technique executive sur l Infrastructure de continuite organisationnelle, les limites d IA gouvernee et les garanties operationnelles pour la direction syndicale.',
    subtitle: 'Article livre blanc',
    ctaLabel: 'Consulter la bibliotheque Perspectives',
    ctaHref: '/insights',
    downloadLabel: 'Telecharger le PDF complet',
    tocLabel: 'Sommaire',
    articleMeta: {
      format: 'Livre blanc renforce par preuves',
      version: 'v3.0',
      author: 'Nzila Ventures / Initiative de recherche Nzila OS',
      source: 'Source principale',
    },
    sourceLabel: 'Fichier source',
    sourceValue: 'infotech/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf',
    articleNotice:
      'Cette page affiche le texte integral extrait du livre blanc et conserve l ordre original des sections.',
    abstractLabel: 'Resume',
    abstractReadingTime: 'Lecture d environ 25 minutes',
    abstractBody:
      'Les organisations syndicales canadiennes affrontent un ecart generationnel de continuite : 5,2 millions de baby-boomers ont deja quitte la population active, 2,7 millions supplementaires devraient partir d ici cinq ans, et le taux d activite devrait reculer de plus de deux points de pourcentage d ici 2030. La planification de la releve, la gestion des effectifs et la conservation documentaire ont ete concues pour une autre echelle de pertes et ne peuvent, a elles seules, preserver la memoire institutionnelle, la posture de gouvernance et la lignee des decisions sur lesquelles repose le mouvement syndical.',
    abstractBodyTwo:
      'Ce livre blanc introduit l infrastructure de continuite institutionnelle comme une discipline distincte. Il definit l Indice de continuite institutionnelle (OCI) et l Analyse de risque de continuite institutionnelle (OCRA), decrit la doctrine d IA deterministe et les limites de gouvernance qui permettent aux outils de continuite de resister a un examen syndical rigoureux, et expose les controles de deploiement, le modele de preuve et l alignement juridique qui permettent aux syndicats, federations et organisations democratiques d operationnaliser la continuite sans renoncer a leur autorite sur leur propre memoire institutionnelle.',
    abstractCallouts: [
      'Definit OCI et OCRA comme primitives de continuite institutionnelle.',
      'Enonce la doctrine d IA deterministe et les limites de gouvernance.',
      'Cartographie le deploiement, la preuve et l alignement juridique pour les organisations syndicales.',
    ],
  },
} as const;

const HEADING_PATTERNS = [
  /^The Continuity Gap$/i,
  /^Central Thesis$/i,
  /^A Note on Stewardship and Memory$/i,
  /^Executive Summary$/i,
  /^Section\s+\d+/i,
  // Numeric subsection like "1.1 Title" or "11.2 Title" — bare "1." stays prose/list.
  /^\d+\.\d+\s+[A-Z]/,
  /^Objections and Counterarguments$/i,
  /^Legal and Regulatory Alignment$/i,
  /^Category Declaration$/i,
  /^Final Thesis$/i,
  /^Research Foundations and Selected References$/i,
];

// Short, italicized pull-quote labels that introduce a single emphatic paragraph.
const CALLOUT_TITLES = new Set([
  'the argument in one sentence',
  'core distinction',
  'world-class continuity principle',
  'succession planning is necessary but insufficient',
  'ocra principle',
  'continuity transformation',
  'closing statement',
  'key findings',
]);

// Known structured tables in the source PDF. The PDF extraction loses column
// boundaries, so we curate the rows here and replace the raw text run with a
// proper <table>. `anchor` is the exact header line in the body; `endMarker`
// is the (case-insensitive) last fragment of the final row, used to bound the
// run to remove from the line stream.
type TableSpec = {
  anchor: string;
  endMarker: string;
  caption?: string;
  columns: string[];
  rows: string[][];
};

const KNOWN_TABLES: TableSpec[] = [
  {
    anchor: 'Indicator Continuity implication',
    endMarker: 'availability simultaneously',
    caption: 'Canadian demographic indicators and their continuity implications',
    columns: ['Indicator', 'Continuity implication'],
    rows: [
      [
        '5.2 million boomers already left the labour force',
        'A large portion of accumulated organizational experience has already exited organizations.',
      ],
      [
        '2.7 million aged 60–64 expected to exit in five years',
        'The next wave will be sharper and more operationally visible.',
      ],
      [
        'Labour-force participation projected to decline by more than two percentage points by 2030',
        'Fewer workers must maintain or rebuild organizational capacity.',
      ],
      [
        '8.1 million Canadians aged 65+ as of July 1, 2025',
        'Population aging reshapes service demand and workforce availability simultaneously.',
      ],
    ],
  },
  {
    anchor: 'Component Purpose',
    endMarker: 'rather than weaken',
    caption: 'Core components of Organizational Continuity Infrastructure',
    columns: ['Component', 'Purpose'],
    rows: [
      ['Operational Memory', 'Preserved understanding of how the organization actually functions over time.'],
      ['Governance Continuity', 'Preservation of governance lineage, rationale, precedent, and organizational interpretation.'],
      ['Evidence Infrastructure', 'Operational traceability, auditability, integrity verification, and defensibility.'],
      ['Runtime Truth', 'Continuously verifiable operational state reflecting actual governance and operational conditions.'],
      ['Organizational Intelligence', 'Accumulated organizational understanding preserved independently of specific individuals.'],
      ['Operational Lineage', 'Traceable evolution of workflows, decisions, governance structures, and operational assumptions.'],
      ['Continuity-Aware AI', 'AI systems designed to strengthen continuity rather than weaken it.'],
    ],
  },
  {
    anchor: 'Level Name Description',
    endMarker: 'embedded into organizational',
    caption: 'The OCI Maturity Model',
    columns: ['Level', 'Name', 'Description'],
    rows: [
      ['1', 'Tribal', 'Continuity depends primarily on individuals.'],
      ['2', 'Documented', 'Processes are documented but inconsistently operationalized.'],
      ['3', 'Structured', 'Governance and operational continuity are partially standardized.'],
      ['4', 'Evidence-Backed', 'Operational traceability and continuity verification exist.'],
      ['5', 'Continuity-Native', 'Continuity is embedded into organizational infrastructure.'],
    ],
  },
  {
    anchor: 'Sensing mode Question modality What it captures Why it matters',
    endMarker: 'hidden topology of',
    caption: 'OCRA multi-dimensional sensing modes',
    columns: ['Sensing mode', 'Question modality', 'What it captures', 'Why it matters'],
    rows: [
      [
        'Maturity sensing',
        'maturity_select',
        'How developed continuity practices are across governance, operations, onboarding, evidence, and intelligence.',
        'Preserves the backbone of organizational readiness assessment.',
      ],
      [
        'Confidence sensing',
        'likert_5',
        'How recoverable, clear, or survivable continuity feels under operational stress.',
        'Reveals perceived fragility, ambiguity, and trust gaps.',
      ],
      [
        'Structural sensing',
        'multiple_choice',
        'How knowledge, escalation, onboarding, and governance actually transfer.',
        'Exposes the hidden topology of continuity.',
      ],
    ],
  },
  {
    anchor: 'Phase Purpose',
    endMarker: 'ethical survivability insights',
    caption: 'OCI adoption roadmap',
    columns: ['Phase', 'Purpose'],
    rows: [
      ['1. Recognition', 'Assess continuity exposure, maturity, confidence, and structural transfer patterns.'],
      ['2. Mapping', 'Map operational lineage, governance structures, escalation pathways, and organizational precedent.'],
      ['3. Stabilization', 'Reduce continuity debt, clarify governance, redistribute stewardship burden, and strengthen onboarding survivability.'],
      ['4. Runtime Infrastructure', 'Embed governance memory, continuity events, runtime truth, and operational traceability.'],
      ['5. Intelligence Network', 'Develop longitudinal continuity intelligence, sector baselines, and ethical survivability insights.'],
    ],
  },
  {
    anchor: 'Sector Continuity exposure OCI implication',
    endMarker: 'sector-specific baselines',
    caption: 'Sector-specific continuity exposure and OCI implications',
    columns: ['Sector', 'Continuity exposure', 'OCI implication'],
    rows: [
      [
        'Labour organizations',
        'Precedent, investigations, grievances, governance interpretation, distributed representation.',
        'Evidence-backed governance, lineage preservation, continuity-aware case history.',
      ],
      [
        'Healthcare systems',
        'Operational handoffs, onboarding, staffing pressure, patient continuity, fragmented systems.',
        'Continuity-aware onboarding, operational memory, stewardship support.',
      ],
      [
        'Public sector',
        'Policy memory, program rationale, turnover, political transitions, public accountability.',
        'Governance memory runtime, defensible lineage, organizational knowledge preservation.',
      ],
      [
        'SMEs and family enterprises',
        'Ownership exits, informal knowledge, founder dependency, local economic risk.',
        'Continuity mapping before succession, knowledge transfer infrastructure, stabilization planning.',
      ],
      [
        'Federated organizations',
        'Distributed governance, regional inconsistency, organizational memory fragmentation.',
        'Interoperable continuity infrastructure and sector-specific baselines.',
      ],
    ],
  },
  {
    anchor: 'Objection Response',
    endMarker: 'what must survive',
    caption: 'Objections and counterarguments',
    columns: ['Objection', 'Response'],
    rows: [
      [
        'Is this simply knowledge management rebranded?',
        'No. Knowledge management focuses on information organization and retrieval. OCI focuses on governance lineage, operational defensibility, continuity resilience, runtime verification, evidence continuity, and continuity-aware operational systems.',
      ],
      [
        'Will continuity systems increase bureaucracy?',
        'Poorly implemented systems can. Continuity-native systems should reduce duplicated reconstruction labour, fragmented governance effort, onboarding degradation, and dependency on organizational veterans.',
      ],
      [
        'Can continuity become too rigid?',
        'Yes. Healthy continuity systems preserve context while maintaining adaptability, human judgment, and proportional governance.',
      ],
      [
        'Does continuity-aware AI increase surveillance risk?',
        'It can if badly designed. OCI requires consent, minimization, explainability, reviewer-led interpretation, and anti-surveillance architecture.',
      ],
      [
        'Is succession planning enough?',
        'No. Succession planning identifies who follows. Organizational continuity preserves what must survive.',
      ],
    ],
  },
];

// Curated stat highlights surfaced as a card grid above Section 2 body.
const SECTION_STATS: Array<{ headingMatch: RegExp; stats: Array<{ value: string; label: string; cite?: string }> }> = [
  {
    headingMatch: /^Section\s+2\b/i,
    stats: [
      { value: '5.2M', label: 'Boomers already exited the Canadian labour force', cite: '1' },
      { value: '2.7M', label: 'Aged 60–64 expected to exit within five years', cite: '1' },
      { value: '184%', label: 'Growth in workers aged 55+ from 2000 to 2023', cite: '3' },
      { value: '3.4', label: 'Working-age Canadians per senior in 2022 (down from 7.7 in 1966)', cite: '5' },
    ],
  },
  {
    headingMatch: /^Section\s+4\b/i,
    stats: [
      { value: '76%', label: 'Canadian SME owners planning to exit within a decade', cite: '6' },
      { value: '$2T+', label: 'In business assets at stake from SME succession', cite: '6' },
      { value: '9%', label: 'Of Canadian businesses with a formalized succession plan', cite: '6' },
      { value: '$47M', label: 'Average annual productivity loss from inefficient knowledge sharing (large U.S. firms)', cite: '9' },
    ],
  },
];

const MAJOR_HEADING_PATTERNS = [
  /^A Note on Stewardship and Memory$/i,
  /^Executive Summary$/i,
  /^Section\s+\d+/i,
  /^Objections and Counterarguments$/i,
  /^Legal and Regulatory Alignment$/i,
  /^Category Declaration$/i,
  /^Final Thesis$/i,
  /^Research Foundations and Selected References$/i,
];

const CURATED_SECTION_IMAGERY: Array<{ match: RegExp; imageUrl: string; alt: string }> = [
  { match: /^Executive Summary$/i, imageUrl: heroImagery.insights, alt: 'Executive continuity summary' },
  { match: /^Section\s+1\b/i, imageUrl: heroImagery.organizationalContinuity, alt: 'Organizational continuity risk landscape' },
  { match: /^Section\s+2\b/i, imageUrl: 'https://images.unsplash.com/photo-1576765608866-5b51046452be?w=1920&q=80&auto=format', alt: 'Aging hands \u2014 Canada\u2019s demographic continuity shock' },
  { match: /^Section\s+3\b/i, imageUrl: heroImagery.organizationalMemoryModule, alt: 'Organizational memory and tacit knowledge transfer' },
  { match: /^Section\s+4\b/i, imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1920&q=80&auto=format', alt: 'Financial cost of organizational unpreparedness' },
  { match: /^Section\s+5\b/i, imageUrl: heroImagery.solutions, alt: 'Sector-specific continuity exposure' },
  { match: /^Section\s+6\b/i, imageUrl: heroImagery.platform, alt: 'System design and continuity failure modes' },
  { match: /^Section\s+7\b/i, imageUrl: heroImagery.operationalCoherenceModule, alt: 'Organizational Continuity Infrastructure architecture' },
  { match: /^Section\s+8\b/i, imageUrl: 'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=1920&q=80&auto=format', alt: 'OCRA continuity benchmark survey and sensing instrumentation' },
  { match: /^Section\s+9\b/i, imageUrl: 'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1920&q=80&auto=format', alt: 'Governance pillars, evidence, and runtime truth' },
  { match: /^Section\s+10\b/i, imageUrl: heroImagery.explainableIntelligenceModule, alt: 'AI and continuity-aware governance' },
  { match: /^Section\s+11\b/i, imageUrl: heroImagery.conventions, alt: 'Adoption roadmap and operating frameworks' },
  { match: /^Section\s+12\b/i, imageUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920&q=80&auto=format', alt: 'Skilled trades and cross-sector continuity implications' },
  { match: /^Section\s+13\b/i, imageUrl: heroImagery.executiveIntelligenceModule, alt: 'Future-state continuity-native organization' },
  { match: /^Objections and Counterarguments$/i, imageUrl: 'https://images.unsplash.com/photo-1548111150-1bd19bdc123f?w=1920&q=80&auto=format', alt: 'Objections and counterarguments \u2014 protest and labour strike' },
  { match: /^Legal and Regulatory Alignment$/i, imageUrl: 'https://images.unsplash.com/photo-1645570990200-2701a49d45ca?w=1920&q=80&auto=format', alt: 'Legal and regulatory alignment \u2014 gavel and judicial defensibility' },
  { match: /^Category Declaration$/i, imageUrl: 'https://images.unsplash.com/photo-1718118778991-e06559e62510?w=1920&q=80&auto=format', alt: 'Category declaration \u2014 Canadian flag planted at the summit' },
  { match: /^Final Thesis$/i, imageUrl: 'https://images.unsplash.com/photo-1661967927841-6c96df5ead5e?w=1920&q=80&auto=format', alt: 'Final thesis \u2014 library of preserved organizational knowledge' },
];

const OPENING_PARAGRAPH =
  'Modern organizations are losing continuity faster than they preserve it. The organizations that endure the next decade will not simply digitize faster; they will preserve organizational memory, governance lineage, operational trust, and continuity intelligence more deliberately. "Continuity is not nostalgia for how organizations used to work. It is the discipline of ensuring that what matters can survive the people who carried it."';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Hide the "Section N — " prefix from displayed headings; the sidebar TOC
 * already provides numeric ordering, so the prefix becomes redundant noise.
 * Anchors continue to use the original heading via slugify().
 */
function stripSectionPrefix(value: string): string {
  return value.replace(/^Section\s+\d+\s*[\u2014\u2013-]\s*/i, '').trim();
}

/**
 * Wrap each standalone occurrence of "OCI" with a trademark superscript.
 * Word boundaries ensure we don't match identifiers like "OCRA" or "OCI-".
 * Safe to call on any plain text fragment that lands inside JSX.
 */
function applyTrademark(
  text: string,
  keyPrefix: string,
): Array<string | React.ReactElement> {
  const result: Array<string | React.ReactElement> = [];
  const pattern = /\bOCI\b/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    result.push(
      <span key={`${keyPrefix}-tm-${i++}-${match.index}`} className="whitespace-nowrap">
        OCI
        <sup className="ml-px align-super text-[0.6em] font-medium text-slate-500">™</sup>
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex === 0) return [text];
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
}

/**
 * Plain inline renderer for headings, captions, and other short labels that
 * don't carry citation markers but should still receive the OCI™ treatment.
 */
function renderInline(text: string, keyPrefix = 'inline'): Array<string | React.ReactElement> {
  return applyTrademark(text, keyPrefix);
}

/**
 * Render inline `[n]` citation markers as small superscript links pointing at the
 * matching reference list item (`#ref-n`). A single marker may carry multiple
 * citations, e.g. `[1][2]` or `[1, 2]`. Also applies the OCI™ transformation
 * to the surrounding plain-text fragments.
 */
function renderWithCitations(text: string): Array<string | React.ReactElement> {
  const parts: Array<string | React.ReactElement> = [];
  const pattern = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;
  const pushText = (slice: string, idx: number) => {
    if (!slice) return;
    for (const piece of applyTrademark(slice, `cw-${idx}`)) {
      parts.push(piece);
    }
  };
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushText(text.slice(lastIndex, match.index), match.index);
    }
    const markers = match[1].split(/\s*,\s*/);
    parts.push(
      <sup
        key={`cite-${keyIndex++}-${match.index}`}
        className="ml-0.5 inline-flex gap-0.5 align-super text-[0.7em] font-medium text-[#1f5b84]"
      >
        {markers.map((marker, i) => (
          <a
            key={`cite-${match!.index}-${marker}-${i}`}
            href={`#ref-${marker}`}
            className="no-underline hover:underline"
          >
            {marker}
            {i < markers.length - 1 ? ',' : ''}
          </a>
        ))}
      </sup>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex), lastIndex);
  }
  return parts.length > 0 ? parts : applyTrademark(text, 'cw-only');
}

function normalizeBlock(block: string): string {
  return block
    .replace(/^The Continuity Gap \| Evidence-Enhanced Edition\nNzila Ventures \/ Nzila OS Research Initiative\n?/gm, '')
    .trim();
}

function isHeadingLine(line: string): boolean {
  const candidate = line.trim();
  if (!candidate) return false;
  return HEADING_PATTERNS.some((pattern) => pattern.test(candidate));
}

function isMajorHeadingLine(line: string): boolean {
  const candidate = line.trim();
  if (!candidate) return false;
  return MAJOR_HEADING_PATTERNS.some((pattern) => pattern.test(candidate));
}

function getSectionImage(heading: string): { imageUrl: string; alt: string } | null {
  const match = CURATED_SECTION_IMAGERY.find((item) => item.match.test(heading));
  return match ? { imageUrl: match.imageUrl, alt: match.alt } : null;
}

type ContentSegment =
  | { type: 'paragraph'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'ordered'; items: string[]; variant?: 'steps' }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'callout'; title: string; body: string }
  | { type: 'references'; items: Array<{ marker: string; text: string }> }
  | { type: 'table'; caption?: string; columns: string[]; rows: string[][] };

/**
 * Locate the first known table anchored in `body`. Returns the pre-anchor text,
 * the matched table spec, and the post-table remainder so the caller can stitch
 * parsed segments around the structured table.
 */
function extractKnownTable(body: string): { before: string; table: TableSpec; after: string } | null {
  for (const spec of KNOWN_TABLES) {
    const anchorIdx = body.indexOf(spec.anchor);
    if (anchorIdx === -1) continue;
    const afterAnchor = body.slice(anchorIdx);
    const endIdx = afterAnchor.toLowerCase().indexOf(spec.endMarker.toLowerCase());
    if (endIdx === -1) continue;
    // Advance to the end of the line containing the endMarker.
    const endOfLine = afterAnchor.indexOf('\n', endIdx);
    let tableEnd = endOfLine === -1 ? afterAnchor.length : endOfLine;
    // The PDF extractor wraps the final cell across two lines; consume one short
    // trailing continuation line that ends in sentence-terminating punctuation
    // (e.g. "infrastructure.", "continuity.", "it.") so it does not appear as
    // an orphan fragment beneath the rendered table.
    const wrap = afterAnchor.slice(tableEnd).match(/^\n([^\n]{1,60}[.!?])\s*(?=\n|$)/);
    if (wrap) {
      tableEnd += wrap[0].length;
    }
    return {
      before: body.slice(0, anchorIdx).trim(),
      table: spec,
      after: afterAnchor.slice(tableEnd).trim(),
    };
  }
  return null;
}

function parseReferenceSegments(body: string): ContentSegment[] {
  // Split on `[n]` markers while keeping them attached to the following text.
  const trimmed = body.trim();
  if (!trimmed) return [];

  const intro: string[] = [];
  const items: Array<{ marker: string; text: string }> = [];
  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);

  let current: { marker: string; text: string } | null = null;
  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s*(.*)$/);
    if (match) {
      if (current) items.push(current);
      current = { marker: match[1], text: match[2].trim() };
      continue;
    }
    if (current) {
      current.text = `${current.text} ${line}`.replace(/\s+/g, ' ').trim();
    } else {
      intro.push(line);
    }
  }
  if (current) items.push(current);

  const segments: ContentSegment[] = [];
  if (intro.length > 0) {
    segments.push({ type: 'paragraph', text: intro.join(' ').replace(/\s+/g, ' ').trim() });
  }
  if (items.length > 0) {
    segments.push({ type: 'references', items });
  }
  return segments;
}

function parseContentSegments(body: string, options?: { heading?: string }): ContentSegment[] {
  if (options?.heading && /^Research Foundations and Selected References$/i.test(options.heading)) {
    return parseReferenceSegments(body);
  }

  // Extract any known curated table first, then recursively parse the surrounding text.
  const extracted = extractKnownTable(body);
  if (extracted) {
    const before = extracted.before
      ? parseContentSegments(extracted.before, options)
      : [];
    const after = extracted.after
      ? parseContentSegments(extracted.after, options)
      : [];
    const tableSegment: ContentSegment = {
      type: 'table',
      caption: extracted.table.caption,
      columns: extracted.table.columns,
      rows: extracted.table.rows,
    };
    return [...before, tableSegment, ...after];
  }

  const segments: ContentSegment[] = [];
  const normalized = body.replace(/\u2022|\uF0B7/g, '•');
  const rawLines = normalized.split('\n');

  // Pre-pass:
  //  1. Convert PDF-extracted "leading-space + Capital" pseudo-bullets into "• ..." items
  //     and fold their wrapped continuation lines (no leading space) back onto the item.
  //  2. Insert blank lines where the source clearly ended a paragraph (a short final wrap
  //     line that terminates in `.`/`!`/`?`), so flushParagraph can split walls of text.
  const processedLines: string[] = [];
  const lastProcessed = () =>
    processedLines.length > 0 ? processedLines[processedLines.length - 1] : '';
  const PARAGRAPH_BREAK_MAX_LINE = 95;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      if (lastProcessed() !== '') processedLines.push('');
      continue;
    }

    const isLeadingSpacePseudoBullet =
      /^\s+[A-Z]/.test(raw) && !/^(?:•|-|\d+\.)\s/.test(trimmed);

    if (isLeadingSpacePseudoBullet) {
      if (lastProcessed() !== '' && !lastProcessed().startsWith('• ')) {
        processedLines.push('');
      }
      processedLines.push(`• ${trimmed}`);
      continue;
    }

    // Wrapped continuation of a pseudo-bullet (no leading whitespace, lowercase start).
    if (lastProcessed().startsWith('• ') && !/^\s/.test(raw) && /^[a-z0-9(\[]/.test(trimmed)) {
      processedLines[processedLines.length - 1] =
        `${lastProcessed()} ${trimmed}`.replace(/\s+/g, ' ');
      continue;
    }

    processedLines.push(trimmed);

    // Heuristic paragraph break: only when the line is clearly the last wrap of a
    // paragraph (short + sentence-terminating) AND the next line doesn't belong to
    // the same logical block (attribution, quote, ordered/bullet list).
    const nextRaw = rawLines[i + 1] ?? '';
    const nextTrim = nextRaw.trim();
    const nextStartsAttribution = /^[\u2014\u2013\-]\s+/.test(nextTrim);
    const nextStartsQuote = /^[\u201C"]/.test(nextTrim);
    const nextIsOrdered = /^\d+\.\s/.test(nextTrim);
    const nextIsBullet = /^(?:•|-)\s/.test(nextTrim) || /^\s+[A-Z]/.test(nextRaw);
    const endsSentence = /[.!?]["\u201D]?$/.test(trimmed);

    if (
      endsSentence &&
      trimmed.length < PARAGRAPH_BREAK_MAX_LINE &&
      nextTrim.length > 0 &&
      !nextStartsAttribution &&
      !nextStartsQuote &&
      !nextIsOrdered &&
      !nextIsBullet
    ) {
      processedLines.push('');
    }
  }

  const lines = processedLines.map((line) => line.trim());

  let paragraphParts: string[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let quoteParts: string[] = [];
  let quoteAttribution: string | undefined;

  const flushParagraph = () => {
    if (paragraphParts.length === 0) return;
    const text = paragraphParts.join(' ').replace(/\s+/g, ' ').trim();
    paragraphParts = [];

    // Detect callout pattern: a short title line followed by its body on the same paragraph.
    // The PDF extraction merges "Title\nBody..." into one paragraph; we detect by leading title.
    // Callout titles are all plain ASCII words with no regex metacharacters, so no escaping needed.
    for (const title of CALLOUT_TITLES) {
      const re = new RegExp(`^(${title})\\s+([A-Z\u201C\u201D\u2018\u2019"'].+)$`, 'i');
      const m = text.match(re);
      if (m) {
        segments.push({ type: 'callout', title: m[1], body: m[2].trim() });
        return;
      }
    }
    segments.push({ type: 'paragraph', text });
  };

  const flushList = () => {
    if (listItems.length > 0) {
      segments.push({ type: 'list', items: [...listItems] });
      listItems = [];
    }
  };

  const flushOrdered = () => {
    if (orderedItems.length > 0) {
      segments.push({ type: 'ordered', items: [...orderedItems] });
      orderedItems = [];
    }
  };

  const flushQuote = () => {
    if (quoteParts.length === 0 && !quoteAttribution) return;
    segments.push({
      type: 'quote',
      text: quoteParts.join(' ').replace(/\s+/g, ' ').replace(/^[\u201C"]|[\u201D"]$/g, '').trim(),
      attribution: quoteAttribution,
    });
    quoteParts = [];
    quoteAttribution = undefined;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushOrdered();
    flushQuote();
  };

  lines.forEach((line) => {
    if (!line) {
      flushAll();
      return;
    }

    // Synthetic subheading marker (injected by sanitizeSectionBody for in-section
    // labels such as "Key Findings" that the PDF emits as plain text lines).
    const subheadingMatch = line.match(/^##\s+(.+)$/);
    if (subheadingMatch) {
      flushAll();
      segments.push({ type: 'subheading', text: subheadingMatch[1].trim() });
      return;
    }

    // Attribution line — closes any pending quote/paragraph.
    if (/^[\u2014\u2013\-]\s+/.test(line)) {
      const attribution = line.replace(/^[\u2014\u2013\-]\s+/, '— ').trim();
      // If we have an open quote, attach attribution and flush.
      if (quoteParts.length > 0) {
        quoteAttribution = attribution;
        flushQuote();
        return;
      }
      // Otherwise treat preceding paragraph as the quoted text.
      if (paragraphParts.length > 0) {
        const quoted = paragraphParts.join(' ').replace(/\s+/g, ' ').trim();
        paragraphParts = [];
        segments.push({
          type: 'quote',
          text: quoted.replace(/^[\u201C"]|[\u201D"]$/g, '').trim(),
          attribution,
        });
        return;
      }
      paragraphParts.push(attribution);
      return;
    }

    // Block-quote opener (curly or straight opening double-quote).
    if (/^[\u201C"]/.test(line) && !quoteParts.length) {
      flushParagraph();
      flushList();
      flushOrdered();
      quoteParts.push(line);
      return;
    }
    if (quoteParts.length > 0) {
      quoteParts.push(line);
      return;
    }

    // Bullet list.
    const bulletMatch = line.match(/^(?:•|-)\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      flushOrdered();
      listItems.push(bulletMatch[1].trim());
      return;
    }

    // Ordered list "1. ...", "2. ..." — bare numeric, not subsection (those are headings).
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushList();
      orderedItems.push(orderedMatch[2].trim());
      return;
    }

    if (listItems.length > 0) {
      const last = listItems[listItems.length - 1];
      listItems[listItems.length - 1] = `${last} ${line}`.replace(/\s+/g, ' ').trim();
      return;
    }
    if (orderedItems.length > 0) {
      const last = orderedItems[orderedItems.length - 1];
      orderedItems[orderedItems.length - 1] = `${last} ${line}`.replace(/\s+/g, ' ').trim();
      return;
    }

    paragraphParts.push(line);
  });

  flushAll();

  return segments;
}

function sanitizeSectionBody(heading: string, body: string): string {
  if (/^Executive Summary$/i.test(heading)) {
    return body
      // Surface "Key Findings" as a real subheading with breathing room above
      // and below so the bullet list that follows reads as its own block.
      .replace(/(^|\n)\s*Key Findings\s*(?=\n)/i, '\n\n## Key Findings\n')
      // Force a paragraph break after a Statistics-Canada-style citation that
      // closes a sentence, since the PDF wraps these without a blank line.
      .replace(/(\[\d+\](?:\s*\[\d+\])*)\s*\n(?=[A-Z])/g, '$1\n\n')
      // And after any sentence ending in a period followed directly by a new
      // capital-letter sentence on the next line (PDF wrap artefact).
      .replace(/([a-z0-9\)\"\u201D])\.\s*\n(?=[A-Z])/g, '$1.\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (!/^A Note on Stewardship and Memory$/i.test(heading)) {
    return body;
  }

  const linesToRemove = new Set([
    'contents',
    'executive summary',
    '1. the continuity crisis',
    '2. canada’s demographic continuity shock',
    '2. canada\'s demographic continuity shock',
    '3. what is lost: corporate memory, tacit knowledge, and the 42% problem',
    '4. the financial cost of organizational unpreparedness',
    '5. sector vulnerabilities in canada',
    '6. why modern systems fail',
    '7. organizational continuity infrastructure (oci)',
    '8. ocra: multi-dimensional continuity sensing',
    '9. trust, evidence, governance, and runtime truth',
    '10. ai and the future of continuity',
    '11. practical frameworks and adoption roadmap',
    '12. sector implications',
    '13. the future institution',
    'objections and counterarguments',
    'legal and regulatory alignment',
    'research foundations and references',
    'research foundations and selected references',
  ]);

  const cleaned = body
    .split('\n')
    .filter((rawLine) => {
      const normalized = rawLine
        .toLowerCase()
        .replace(/[•]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Drop any residual numbered table-of-contents lines in this section.
      if (/^\d+\.\s+/.test(normalized)) {
        return false;
      }

      return !linesToRemove.has(normalized);
    })
    .join('\n')
    .replace(/([a-z0-9])\.([A-Z])/g, '$1. $2')
    // Drop the opening "Nzila means …" line; it duplicates the hero framing.
    .replace(/Nzila means [\s\S]*?slowly lose themselves\.\s*/i, '')
    // Drop the stray "Technology with soul" sub-label.
    .replace(/Technology with soul\s+/gi, '')
    // Convert the run-on "human story" sentence into a bulleted list.
    .replace(
      /Behind nearly every continuity failure is usually a human story:\s*([\s\S]*?rebuilding context after every governance transition)\.?/i,
      (_match, body: string) => {
        const items = body
          .split(/;\s*/)
          .map((item) => item.trim().replace(/\.$/, ''))
          .filter(Boolean);
        const bullets = items.map((item) => `• ${item}.`).join('\n');
        return `Behind nearly every continuity failure is usually a human story:\n\n${bullets}\n`;
      },
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

type WhitepaperSection = {
  heading: string;
  body: string;
  level: 2 | 3;
  segments: ContentSegment[];
};

function buildWhitepaperSections(blocks: string[]): WhitepaperSection[] {
  const sections: Array<{ heading: string; level: 2 | 3; bodyLines: string[] }> = [];
  let current: { heading: string; level: 2 | 3; bodyLines: string[] } | null = null;
  // True immediately after we created a heading and haven't yet seen body/blank.
  // Used to allow continuation of the three section titles that wrap across PDF lines.
  let pendingHeadingContinuation = false;

  // Hardcoded continuation map: only the three Section headings that actually wrap in
  // the source PDF extraction. Keeps unrelated body text (table headers, lead
  // paragraphs) from being absorbed into headings.
  const WRAPPED_HEADING_CONTINUATIONS: Record<string, string> = {
    'Section 3 — What Is Lost: Corporate Memory, Tacit': 'Knowledge, and the 42% Problem',
    'Section 4 — The Financial Cost of Organizational': 'Unpreparedness',
    'Section 9 — Trust, Evidence, Governance, and Runtime': 'Truth',
  };

  const pushCurrent = () => {
    if (!current) return;
    const body = current.bodyLines.join('\n').trim();
    if (body.length === 0 && sections.length > 0) {
      current = null;
      return;
    }

    sections.push({
      heading: current.heading,
      level: current.level,
      bodyLines: current.bodyLines,
    });
    current = null;
  };

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim());

    for (const line of lines) {
      if (!line) {
        if (current) {
          current.bodyLines.push('');
        }
        pendingHeadingContinuation = false;
        continue;
      }

      if (isHeadingLine(line)) {
        pushCurrent();
        const level: 2 | 3 = isMajorHeadingLine(line) ? 2 : 3;
        current = {
          heading: line,
          level,
          bodyLines: [],
        };
        pendingHeadingContinuation = true;
        continue;
      }

      // Wrapped-heading continuation: only the three known wraps from the source PDF.
      if (
        pendingHeadingContinuation &&
        current &&
        WRAPPED_HEADING_CONTINUATIONS[current.heading] === line
      ) {
        current.heading = `${current.heading} ${line}`.replace(/\s+/g, ' ').trim();
        pendingHeadingContinuation = false;
        continue;
      }
      pendingHeadingContinuation = false;

      if (!current) {
        current = {
          heading: 'The Continuity Gap',
          level: 2,
          bodyLines: [],
        };
      }

      current.bodyLines.push(line);
    }

    if (current) {
      // Only force a paragraph break between blocks when the previous block
      // actually ended a sentence. Some sentences wrap across PDF page boundaries
      // (e.g. "...patient continuity would otherwise break. The" → next page
      // continues with "union representative..."). Inserting an unconditional
      // blank line splits these mid-sentence and produces an orphan fragment.
      const lastLine = current.bodyLines.length > 0
        ? current.bodyLines[current.bodyLines.length - 1]
        : '';
      const endsParagraph = lastLine === '' || /[.!?:;)"\u201D]$/.test(lastLine);
      if (endsParagraph) {
        current.bodyLines.push('');
      }
    }
    pendingHeadingContinuation = false;
  }

  pushCurrent();

    return sections.map((section) => {
    const rawBody = section.bodyLines.join('\n').trim();
    const body = sanitizeSectionBody(section.heading, rawBody);
    const segments = parseContentSegments(body, { heading: section.heading });
    // Style the §1.2 Continuity Failure Sequence as a step diagram.
    if (/Continuity Failure Sequence/i.test(section.heading)) {
      for (const seg of segments) {
        if (seg.type === 'ordered') {
          (seg as { variant?: 'steps' }).variant = 'steps';
        }
      }
    }
    return {
      heading: section.heading,
      body,
      level: section.level,
      segments,
    };
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = WHITEPAPER_COPY[locale as keyof typeof WHITEPAPER_COPY] ?? WHITEPAPER_COPY['en-CA'];

  return {
    title: copy.title,
    description: copy.description,
    alternates: buildLocaleAlternates(locale, '/whitepaper'),
  };
}

export default async function LocaleWhitepaperPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = WHITEPAPER_COPY[locale as keyof typeof WHITEPAPER_COPY] ?? WHITEPAPER_COPY['en-CA'];
  const whitepaperBlocks = CONTINUITY_GAP_BLOCKS.map(normalizeBlock).filter((block) => block.length > 0);
  const sections = buildWhitepaperSections(whitepaperBlocks);
  const tocHeadings = sections
    .filter((section) => section.level === 2 && !/^The Continuity Gap$/i.test(section.heading))
    .map((section) => section.heading);

  return (
    <div className="whitepaper-print-root min-h-screen bg-white">
      <style>{`
        /* Layout overrides applied while html2canvas captures the page for
           the downloadable PDF. Mirrors the @media print rules but works
           outside print mode so html2canvas sees the print-style layout. */
        .whitepaper-print-root.pdf-capture aside { display: none !important; }
        .whitepaper-print-root.pdf-capture main {
          padding: 0 !important;
          max-width: 100% !important;
        }
        .whitepaper-print-root.pdf-capture section.grid {
          display: block !important;
        }
        .whitepaper-print-root.pdf-capture article {
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          max-width: 100% !important;
        }

        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          html, body {
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Print only the whitepaper root: hide everything, then re-show our subtree.
             Absolutely positioning the root frees it from any flex/grid ancestor
             constraints that otherwise clip print output to a single page. */
          body * { visibility: hidden !important; }
          .whitepaper-print-root,
          .whitepaper-print-root * { visibility: visible !important; }
          .whitepaper-print-root {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Collapse the desktop grid + hide sidebar so the article uses full width */
          .whitepaper-print-root aside { display: none !important; }
          .whitepaper-print-root main {
            padding: 0 !important;
            max-width: 100% !important;
          }
          .whitepaper-print-root section.grid {
            display: block !important;
          }
          .whitepaper-print-root article {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .whitepaper-print-root h2,
          .whitepaper-print-root h3 {
            break-after: avoid;
            page-break-after: avoid;
          }
          /* Start every major section on a fresh page (except the first, which
             follows the hero) and never split a section banner across pages. */
          .whitepaper-print-root [data-major-section] {
            break-before: page;
            page-break-before: always;
          }
          .whitepaper-print-root [data-major-section]:first-of-type {
            break-before: auto;
            page-break-before: auto;
          }
          .whitepaper-print-root [data-section-banner] {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .whitepaper-print-root figure,
          .whitepaper-print-root table,
          .whitepaper-print-root img {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#0f2133]">
        {/* Use an <img> instead of CSS background-image so the photo prints reliably */}
        <img
          aria-hidden="true"
          src={heroImagery.organizationalMemoryModule}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#0f2133]/85 via-[#123451]/75 to-[#0f2133]/90"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-semibold text-white drop-shadow-md sm:text-5xl lg:text-6xl">The Continuity Gap</h1>
            <p className="mt-4 text-base text-white/90 drop-shadow sm:text-lg lg:text-xl">Organizational Memory, Organizational Resilience, and the Future of Operational Trust</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center print:hidden">
              {/* PDF download temporarily hidden — see PrintPdfButton */}
              <Link
                href={`/${locale}${copy.ctaHref}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
              >
                {copy.ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="whitepaper-abstract" className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="whitepaper-abstract" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1f5b84]">
                {copy.abstractLabel}
              </h2>
              <span className="text-xs font-medium text-slate-500">{copy.abstractReadingTime}</span>
            </div>
            <p className="mt-5 text-base leading-relaxed text-slate-700 sm:text-lg">{copy.abstractBody}</p>
            <p className="mt-4 text-base leading-relaxed text-slate-700 sm:text-lg">{copy.abstractBodyTwo}</p>
            <ul className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              {copy.abstractCallouts.map((point) => (
                <li
                  key={point}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 leading-snug"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <section className="grid gap-8 xl:grid-cols-12">
          <aside className="xl:col-span-3 xl:sticky xl:top-24 xl:self-start space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{copy.tocLabel}</h3>
              <ol className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto pr-1 text-sm text-slate-700">
                {tocHeadings.map((heading, index) => (
                  <li key={heading}>
                    <a href={`#${slugify(heading)}`} className="group inline-flex items-start gap-2 transition-colors hover:text-[#1f5b84]">
                      <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 group-hover:bg-[#1f5b84]/10 group-hover:text-[#1f5b84]">{index + 1}</span>
                      <span>{renderInline(stripSectionPrefix(heading), `toc-${index}`)}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Quick actions</h3>
              <div className="mt-3 space-y-2">
                {/* PDF download temporarily hidden — see PrintPdfButton */}
                {tocHeadings[0] ? (
                  <a href={`#${slugify(tocHeadings[0])}`} className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100">
                    Start reading
                  </a>
                ) : null}
              </div>
            </div>
          </aside>

          <article className="xl:col-span-9 rounded-2xl border border-slate-200 bg-white p-7 sm:p-10 space-y-10">
            {sections.map((section, index) => {
              const heading = section.heading;
              const isCentralThesis = /^Central Thesis$/i.test(heading);

              if (isCentralThesis) {
                return null;
              }

              const isIntroHeading = /^The Continuity Gap$/i.test(heading);
              const body = isIntroHeading ? '' : index === 0 ? OPENING_PARAGRAPH : section.body;
              const isMajorSection = section.level === 2;
              const sectionImage = isMajorSection ? getSectionImage(heading) : null;
              const statSpec = isMajorSection
                ? SECTION_STATS.find((entry) => entry.headingMatch.test(heading))
                : undefined;

              return (
                <div
                  key={`wb-${index}`}
                  data-major-section={isMajorSection ? 'true' : undefined}
                  className="space-y-4"
                >
                  {heading ? isMajorSection ? (
                    <h2
                      id={slugify(heading)}
                      className={`scroll-mt-28 border-b border-slate-200 pb-3 font-semibold text-navy tracking-tight ${
                        /^Research Foundations and Selected References$/i.test(heading)
                          ? 'text-xl sm:text-2xl'
                          : 'text-3xl sm:text-4xl'
                      }`}
                    >
                      {renderInline(stripSectionPrefix(heading), `h2-${index}`)}
                    </h2>
                  ) : (
                    <h3 id={slugify(heading)} className="scroll-mt-28 mt-2 text-lg font-semibold text-slate-800 tracking-tight">
                      {renderInline(heading.replace(/^\d+\.\d+\s+/, ''), `h3-${index}`)}
                    </h3>
                  ) : null}

                  {sectionImage ? (
                    <div data-section-banner className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="relative h-52 w-full">
                        <Image
                          src={sectionImage.imageUrl}
                          alt={sectionImage.alt}
                          fill
                          loading="eager"
                          sizes="(min-width: 1280px) 900px, 100vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#10263a]/70 via-[#10263a]/30 to-transparent" />
                        <div className="relative z-10 flex h-full items-end p-5">
                          <p className="text-sm font-medium text-white/90">{renderInline(stripSectionPrefix(heading), `hero-${index}`)}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {statSpec ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {statSpec.stats.map((stat, statIndex) => (
                        <div
                          key={`wb-stat-${index}-${statIndex}`}
                          className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#f4f9fc] to-white p-4"
                        >
                          <p className="text-2xl font-semibold tracking-tight text-[#1f5b84] sm:text-3xl">
                            {stat.value}
                            {stat.cite ? (
                              <sup className="ml-0.5 align-super text-[0.45em] font-medium text-[#1f5b84]">
                                <a href={`#ref-${stat.cite}`} className="no-underline hover:underline">
                                  {stat.cite}
                                </a>
                              </sup>
                            ) : null}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">{renderInline(stat.label, `stat-${index}-${statIndex}`)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {body
                    ? section.segments.map((segment, segmentIndex) => {
                        const key = `wb-segment-${index}-${segmentIndex}`;
                        if (segment.type === 'paragraph') {
                          return (
                            <p key={key} className="text-[1.05rem] leading-8 text-slate-700">
                              {renderWithCitations(segment.text)}
                            </p>
                          );
                        }
                        if (segment.type === 'subheading') {
                          return (
                            <h4
                              key={key}
                              className="mt-2 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5b84]"
                            >
                              <span className="inline-block h-px w-8 bg-[#1f5b84]/40" aria-hidden="true" />
                              {renderInline(segment.text, `${key}-subheading`)}
                            </h4>
                          );
                        }
                        if (segment.type === 'list') {
                          return (
                            <ul key={key} className="list-disc space-y-2 pl-6 text-[1.05rem] leading-8 text-slate-700">
                              {segment.items.map((item, itemIndex) => (
                                <li key={`${key}-${itemIndex}`}>{renderWithCitations(item)}</li>
                              ))}
                            </ul>
                          );
                        }
                        if (segment.type === 'ordered') {
                          if (segment.variant === 'steps') {
                            return (
                              <ol key={key} className="space-y-3">
                                {segment.items.map((item, itemIndex) => (
                                  <li
                                    key={`${key}-${itemIndex}`}
                                    className="flex items-start gap-4 rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4"
                                  >
                                    <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1f5b84] text-sm font-semibold text-white shadow-sm">
                                      {itemIndex + 1}
                                    </span>
                                    <span className="pt-1 text-[1rem] leading-7 text-slate-800">
                                      {renderWithCitations(item)}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            );
                          }
                          return (
                            <ol key={key} className="list-decimal space-y-2 pl-6 text-[1.05rem] leading-8 text-slate-700 marker:font-semibold marker:text-[#1f5b84]">
                              {segment.items.map((item, itemIndex) => (
                                <li key={`${key}-${itemIndex}`}>{renderWithCitations(item)}</li>
                              ))}
                            </ol>
                          );
                        }
                        if (segment.type === 'table') {
                          return (
                            <figure key={key} className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-[0.95rem] leading-6 text-slate-700">
                                  <thead>
                                    <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                      {segment.columns.map((col, colIndex) => (
                                        <th
                                          key={`${key}-th-${colIndex}`}
                                          scope="col"
                                          className="border-b border-slate-200 px-4 py-3 align-bottom"
                                        >
                                          {renderInline(col, `${key}-th-${colIndex}`)}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {segment.rows.map((row, rowIndex) => (
                                      <tr key={`${key}-tr-${rowIndex}`} className="odd:bg-white even:bg-slate-50/40">
                                        {row.map((cell, cellIndex) => (
                                          <td
                                            key={`${key}-td-${rowIndex}-${cellIndex}`}
                                            className={`border-t border-slate-100 px-4 py-3 align-top ${cellIndex === 0 ? 'font-semibold text-slate-900' : ''}`}
                                          >
                                            {renderWithCitations(cell)}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {segment.caption ? (
                                <figcaption className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-xs italic text-slate-500">
                                  {renderInline(segment.caption, `${key}-cap`)}
                                </figcaption>
                              ) : null}
                            </figure>
                          );
                        }
                        if (segment.type === 'quote') {
                          return (
                            <blockquote
                              key={key}
                              className="my-2 rounded-r-lg border-l-4 border-[#1f5b84] bg-slate-50 px-5 py-4 text-[0.95rem] italic leading-7 text-slate-700"
                            >
                              <p>“{renderWithCitations(segment.text)}”</p>
                              {segment.attribution ? (
                                <footer className="mt-2 text-xs not-italic text-slate-500">
                                  {renderWithCitations(segment.attribution)}
                                </footer>
                              ) : null}
                            </blockquote>
                          );
                        }
                        if (segment.type === 'callout') {
                          const isHero = /^(closing statement|world-class continuity principle|core distinction|the argument in one sentence|continuity transformation)$/i.test(segment.title);
                          if (isHero) {
                            return (
                              <aside
                                key={key}
                                className="my-10 rounded-2xl border border-[#1f5b84]/30 bg-gradient-to-br from-[#1f5b84] to-[#163f5e] px-8 py-12 text-center shadow-md sm:px-12 sm:py-14"
                              >
                                <p className="mx-auto max-w-3xl text-[1.35rem] font-semibold leading-10 text-white sm:text-[1.5rem] sm:leading-[2.6rem]">
                                  {renderWithCitations(segment.body)}
                                </p>
                              </aside>
                            );
                          }
                          return (
                            <aside
                              key={key}
                              className="rounded-xl border border-[#1f5b84]/20 bg-gradient-to-br from-[#f4f9fc] to-white p-5 shadow-sm"
                            >
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1f5b84]">
                                {renderInline(segment.title, `${key}-callout-title`)}
                              </p>
                              <p className="mt-2 text-[1.05rem] leading-8 text-slate-800">
                                {renderWithCitations(segment.body)}
                              </p>
                            </aside>
                          );
                        }
                        if (segment.type === 'references') {
                          return (
                            <ol key={key} className="space-y-3 text-[0.95rem] leading-7 text-slate-700">
                              {segment.items.map((item) => (
                                <li
                                  key={`${key}-${item.marker}`}
                                  id={`ref-${item.marker}`}
                                  className="grid scroll-mt-28 grid-cols-[2.5rem_1fr] items-baseline gap-2 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 target:bg-amber-50"
                                >
                                  <span className="font-mono text-xs font-semibold text-[#1f5b84]">[{item.marker}]</span>
                                  <span>{item.text}</span>
                                </li>
                              ))}
                            </ol>
                          );
                        }
                        return null;
                      })
                    : null}
                </div>
              );
            })}
          </article>
        </section>
      </main>
    </div>
  );
}