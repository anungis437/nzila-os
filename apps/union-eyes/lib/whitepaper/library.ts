import nodePath from 'node:path';

import { heroImagery } from '@/lib/marketing-hero-imagery';

/**
 * Static registry of every whitepaper surfaced in the marketing site.
 *
 * The continuity-gap entry is rendered by its bespoke route at
 * `/whitepaper` (preserved for SEO and theme parity). All other entries
 * are rendered through the shared markdown-driven renderer at
 * `/whitepapers/[slug]` and source their content from the canonical
 * markdown files under `docs/oci/whitepapers/`.
 */
export type WhitepaperEntry = {
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly format: string;
  readonly version: string;
  readonly readingTime: string;
  readonly heroImage: string;
  readonly heroAlt: string;
  readonly abstract: string;
  readonly abstractCallouts: readonly string[];
  /**
   * When set, the entry is rendered by the shared markdown renderer using
   * the file at `docs/oci/whitepapers/<sourceFile>`.
   * When omitted, the entry is rendered by a bespoke route (currently
   * only `the-continuity-gap`).
   */
  readonly sourceFile?: string;
  /**
   * Public route (relative to `/{locale}`) the hub card should link to.
   */
  readonly href: string;
};

const DOCS_RELATIVE = ['..', '..', 'docs', 'oci', 'whitepapers'] as const;

/**
 * Resolves the absolute path of a whitepaper markdown source file.
 * Only called from server components.
 */
export function resolveWhitepaperSourcePath(sourceFile: string): string {
  return nodePath.resolve(process.cwd(), ...DOCS_RELATIVE, sourceFile);
}

export const WHITEPAPER_LIBRARY: readonly WhitepaperEntry[] = [
  {
    slug: 'the-continuity-gap',
    title: 'The Continuity Gap',
    subtitle:
      'Organizational Memory, Organizational Resilience, and the Future of Operational Trust',
    format: 'Evidence-Enhanced Whitepaper',
    version: 'v3.0',
    readingTime: '~25 minute read',
    heroImage: heroImagery.organizationalMemoryModule,
    heroAlt: 'Organizational memory and continuity infrastructure',
    abstract:
      'Canadian organizations face a generational continuity gap: 5.2 million boomers have already exited the workforce, another 2.7 million are projected to exit within five years, and labour-force participation is forecast to decline by more than two percentage points by 2030. This whitepaper introduces Organizational Continuity Infrastructure (OCI) and Organizational Continuity Risk Analysis (OCRA) as a distinct discipline for preserving organizational memory, governance lineage, and decision trust across time.',
    abstractCallouts: [
      'Defines OCI and OCRA as organizational continuity primitives.',
      'Articulates deterministic-AI doctrine and governance boundaries.',
      'Maps deployment, evidence, and legal alignment for labour organizations.',
    ],
    href: '/whitepaper',
  },
  {
    slug: 'operational-reality-edition',
    title: 'The Continuity Gap — Operational Reality Edition',
    subtitle:
      'How operational labour systems revealed the continuity category — and why OCI / OCRA emerged from work, not from theory.',
    format: 'Executive Whitepaper',
    version: 'Operational Reality Edition',
    readingTime: '~22 minute read',
    heroImage: heroImagery.operationalCoherenceModule,
    heroAlt: 'Operational continuity in labour and federated organizations',
    abstract:
      'A companion to the Evidence-Enhanced edition, this whitepaper begins from the operational surface rather than the demographic argument. It walks through the lived realities — grievance transitions, executive turnover, modernization fragmentation — that made the continuity category visible inside Union Eyes deployments, and reconstructs the discovery path that produced OCI and OCRA as the structural answer.',
    abstractCallouts: [
      'Operational-first framing: continuity discovered through work, not theory.',
      'Three worked scenarios (grievance, executive, modernization).',
      'Dual-entry GTM and continuity-aware operations doctrine.',
    ],
    sourceFile: 'THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md',
    href: '/whitepapers/operational-reality-edition',
  },
  {
    slug: 'oci-method-companion',
    title: 'The OCI Method — Companion Whitepaper',
    subtitle:
      'The procurement-grade methodology companion: scaffolding, confidence doctrine, reviewer workflow, and conformance checklist.',
    format: 'Methodology Companion',
    version: 'v1.0',
    readingTime: '~18 minute read',
    heroImage: heroImagery.explainableIntelligenceModule,
    heroAlt: 'OCI methodology and reviewer-led interpretation',
    abstract:
      'Written for procurement officers, governance bodies, legal reviewers, and methodology auditors, the companion whitepaper explains the methodological scaffolding behind the OCI Method: ontology, confidence states, evidence sufficiency, small-sample honesty, reviewer reproducibility, anti-surveillance posture, standards positioning, the reviewer workflow, and a twelve-point procurement evaluation checklist.',
    abstractCallouts: [
      'Worked confidence reading and small-sample honesty examples.',
      'Reviewer reproducibility and two-reviewer divergence doctrine.',
      'Twelve-item procurement evaluation checklist (every "no" disqualifying).',
    ],
    sourceFile: 'OCI_METHOD_COMPANION_WHITEPAPER.md',
    href: '/whitepapers/oci-method-companion',
  },
  {
    slug: 'oci-method-canonical',
    title: 'The OCI Method — Canonical Authority',
    subtitle:
      'The canonical methodology authority: definitions, ontology, layer separation, enforcement, and brand integrity doctrine.',
    format: 'Methodology Authority',
    version: 'v1.2',
    readingTime: '~10 minute read',
    heroImage: heroImagery.executiveIntelligenceModule,
    heroAlt: 'OCI Method canonical authority',
    abstract:
      'The authoritative reference document for the OCI Method. Establishes canonical definitions, the OCI / OCRA layer ontology, reviewer accountability, confidence and evidence doctrine, anti-surveillance posture, standards positioning, brand and enforcement doctrine, and version governance. All public-facing OCI materials must remain consistent with this authority.',
    abstractCallouts: [
      'Canonical definitions and OCI / OCRA layer ontology.',
      'Brand and enforcement doctrine: disqualifying conditions for OCI / OCRA branding.',
      'Governance, versioning, and conformance to the canonical five-phase OCI Method™.',
    ],
    sourceFile: 'OCI_METHOD_WHITEPAPER_v1.md',
    href: '/whitepapers/oci-method-canonical',
  },
] as const;

export function getWhitepaperBySlug(slug: string): WhitepaperEntry | undefined {
  return WHITEPAPER_LIBRARY.find((entry) => entry.slug === slug);
}
