import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionHeading from '@/components/public/SectionHeading';
import InvestorCTA from '@/components/public/InvestorCTA';

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────
const verticalData: Record<string, {
  name: string;
  tagline: string;
  description: string;
  hero: string;
  heroAlt: string;
  tam: string;
  orgs: string;
  platforms: string[];
  status: string;
  color: string;
  overview: string;
  capabilities: { title: string; description: string; icon: string }[];
  useCases: { scenario: string; outcome: string }[];
  differentiators: string[];
  note?: string;
}> = {
  fintech: {
    name: 'Fintech',
    tagline: 'Financial Infrastructure for Diaspora Communities & Global Markets',
    description: 'Banking, payments, stress testing, and virtual CFO services for individuals and enterprises.',
    hero: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1920',
    heroAlt: 'Financial trading screens displaying market data and candlestick charts',
    tam: '$100B+',
    orgs: '617',
    platforms: ['DiasporaCore V2', 'Insight CFO'],
    status: '2 Platforms',
    color: 'from-electric to-violet',
    overview:
      'Our Fintech vertical builds compliant, multi-currency financial infrastructure designed from the ground up for diaspora communities and global markets. We recognise diaspora and emerging economies as primary markets — not afterthoughts — and design accordingly: compliance, transparency, and community financial models like tontines and chamas built in from day one.',
    capabilities: [
      {
        title: 'KYC / AML Compliance Engine',
        icon: '🔐',
        description:
          'Risk-tiered identity verification with automated AML screening, continuous monitoring, and audit-ready reporting to meet financial regulatory standards.',
      },
      {
        title: 'Multi-Currency Remittances',
        icon: '💸',
        description:
          'Real-time cross-border transfers with FX optimisation, transparent fee structures, and integration into local mobile-money ecosystems.',
      },
      {
        title: 'Community Savings & Lending',
        icon: '🤝',
        description:
          'Rotating savings groups, peer-to-peer micro-lending, and community treasury management — digital infrastructure for tontines and chamas.',
      },
      {
        title: 'Credit Stress Testing',
        icon: '📊',
        description:
          'Scenario-based stress testing models that help financial orgs assess portfolio resilience under economic shocks.',
      },
      {
        title: 'Virtual CFO Services',
        icon: '📈',
        description:
          'AI-assisted financial analysis, cash-flow forecasting, and board-ready reporting for SMEs and non-profits.',
      },
    ],
    useCases: [
      { scenario: 'A diaspora community in Canada managing collective savings', outcome: 'Structured, auditable pools with automated distribution rules' },
      { scenario: 'A credit union evaluating risk under rising interest rates', outcome: 'Rapid scenario modelling and regulatory reporting' },
      { scenario: 'An SME without a dedicated finance team', outcome: 'AI-generated CFO dashboards and cash-flow alerts' },
    ],
    differentiators: [
      'Purpose-built for diaspora and emerging economies — not adapted from legacy platforms',
      'Regulatory-grade KYC/AML from day one',
      'Supports community financial models like tontines and chamas as primary features',
      'Integrated stress-testing for portfolio resilience',
    ],
  },

  agrotech: {
    name: 'Agrotech',
    tagline: 'Precision Agriculture for Canadian Farms & Congolese Supply Chains',
    description: 'Farm management, supply chain, IoT integration, and agricultural market intelligence.',
    hero: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1920',
    heroAlt: 'Aerial view of organised agricultural farmland rows stretching to the horizon',
    tam: '$8.6B',
    orgs: '300+',
    platforms: ['Agrimo', 'CORA'],
    status: 'Flagship + Production Ready',
    color: 'from-emerald to-cyan-400',
    overview:
      'Nzila\'s Agrotech vertical spans two distinct geographies and supply-chain realities: Canadian farm management (CORA) and the agri-logistics challenges of the DRC and Central African corridor (Agrimo). Each platform is data-rich where it matters most.',
    capabilities: [
      {
        title: 'Farm Planning & Season Management',
        icon: '🌱',
        description:
          'Multi-season crop planning, task scheduling, resource allocation, and yield projection — built on Canadian agricultural data and benchmarks (CORA).',
      },
      {
        title: 'IoT & Sensor Integration',
        icon: '📡',
        description:
          'Soil moisture, temperature, and crop health telemetry connected to automated alerts and prescription actions.',
      },
      {
        title: 'Supply-Chain & Logistics Intelligence',
        icon: '🚜',
        description:
          'End-to-end produce traceability, cold-chain monitoring, and logistics coordination — critical for DRC/CA export corridors (Agrimo).',
      },
      {
        title: 'Market Price Intelligence',
        icon: '💹',
        description:
          'Live commodity pricing, seasonal demand forecasting, and wholesale marketplace connectivity to maximise farm-gate returns.',
      },
      {
        title: 'Carbon & Sustainability Reporting',
        icon: '🌍',
        description:
          'Emissions tracking, sustainable-practice logging, and export-ready sustainability reports aligned with B Corp environmental metrics.',
      },
    ],
    useCases: [
      { scenario: 'A Canadian grain farmer managing multiple fields and contractors', outcome: 'Centralised CORA dashboard with season-over-season benchmarking' },
      { scenario: 'A DRC cooperative exporting produce to regional markets', outcome: 'Agrimo supply-chain visibility and buyer-seller matching' },
      { scenario: 'An agri-investor evaluating farm portfolio performance', outcome: 'Cross-farm analytics with risk-adjusted yield projections' },
    ],
    differentiators: [
      'CORA built on verified Canadian agricultural data and government datasets',
      'Agrimo purpose-built for DRC and Central African logistics realities',
      'IoT-ready architecture for sensor-equipped operations',
      'Aligned with B Corp environmental impact measurement frameworks',
    ],
    note: 'CORA is trained on Canadian agricultural data. Agrimo is purpose-built for the DRC / Central African market.',
  },

  uniontech: {
    name: 'Uniontech',
    tagline: 'Modernising Labour Rights Through Intelligent Infrastructure',
    description: 'Union management, pension forecasting, grievance tracking, and CBA intelligence.',
    hero: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920',
    heroAlt: 'Labour union workers raising hands together in solidarity',
    tam: '$50B',
    orgs: '4,773',
    platforms: ['Union Eyes'],
    status: 'Flagship',
    color: 'from-gold to-gold-light',
    overview:
      'Union Eyes is Nzila\'s flagship validation product: organizational continuity infrastructure for labor organizations. It preserves grievance lineage, steward handoffs, CBA context, governance rationale, and evidence-sealed audit trails without becoming a worker surveillance system.',
    capabilities: [
      {
        title: 'Pension Forecasting Engine',
        icon: '📋',
        description:
          'Benefit projections and funding-ratio monitoring integrating contribution history, vesting rules, and trustee-level dashboards to help leaders spot funding risks early.',
      },
      {
        title: 'Grievance Tracking & Case Management',
        icon: '⚖️',
        description:
          'End-to-end grievance lifecycle from filing to arbitration, with automated deadline reminders, document vaults, and outcome analytics.',
      },
      {
        title: 'Collective Bargaining AI',
        icon: '🤝',
        description:
          'Contract clause analysis, pattern recognition across past agreements, and negotiation benchmarking to strengthen bargaining positions. Available for local unions, federations, and congress-tier organizations.',
      },
      {
        title: 'Member Accountability Evidence',
        icon: '👥',
        description:
          'Member-facing governance evidence, visible records, role-scoped access, and communication context that support accountability without behavioral profiling.',
      },
      {
        title: 'Arbitration Precedents & Research',
        icon: '📚',
        description:
          'Searchable precedent database, jurisdiction preferences, citation tracking, and outcome analytics to strengthen grievance and arbitration positions.',
      },
    ],
    useCases: [
      { scenario: 'A pension fund trustee assessing 20-year liability', outcome: 'Funding-ratio dashboard with benefit projections and trustee-level reporting' },
      { scenario: 'A union representative managing an active grievance file', outcome: 'Centralised timeline, evidence vault, and deadline alerts' },
      { scenario: 'A union executive preparing for contract negotiations', outcome: 'AI-powered clause comparison and historical benchmarking' },
    ],
    differentiators: [
      '4,773 orgs already in the data ecosystem',
      'Only platform combining pension, grievance, CBA intelligence, and precedents in one product',
      'AI clause analysis built specifically for collective agreements',
      'Supports labour rights — a core B Corp social impact pillar',
    ],
  },

  legaltech: {
    name: 'Legaltech',
    tagline: 'AI-Powered Justice: From Case Management to eDiscovery',
    description: 'Case management, legal AI, tribunal databases, and eDiscovery services.',
    hero: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920',
    heroAlt: 'Scales of justice on a desk alongside legal reference books and documents',
    tam: '$13B+',
    orgs: '814',
    platforms: ['Court Lens', 'FAIRCASE'],
    status: '2 Platforms',
    color: 'from-violet to-coral',
    overview:
      'Nzila\'s Legaltech vertical makes legal intelligence accessible — from searchable tribunal databases to AI-driven eDiscovery. We believe access to justice is a social equity issue, and our platforms are designed to level the playing field.',
    capabilities: [
      {
        title: 'Tribunal & Case Database',
        icon: '🏛️',
        description:
          'Curated, searchable repository of 814+ tribunal and court decisions across human rights, labour, and equity cases with semantic search.',
      },
      {
        title: 'AI eDiscovery',
        icon: '🔍',
        description:
          'Machine-learning-assisted document review, privilege logging, and pattern extraction to reduce discovery costs by orders of magnitude.',
      },
      {
        title: 'Case Management System',
        icon: '📁',
        description:
          'Matter lifecycle management, deadline tracking, client communications, billing integration, and role-based access control.',
      },
      {
        title: 'Precedent & Citation Engine',
        icon: '📚',
        description:
          'Similar-case finder, citation graph analysis, and outcome prediction to support legal strategy development.',
      },
    ],
    useCases: [
      { scenario: 'A human rights lawyer searching for precedent in tribunal decisions', outcome: 'Semantic search across 814+ curated decisions in seconds' },
      { scenario: 'A firm managing large-volume document review', outcome: 'AI-assisted privilege screening reducing review time by 60%+' },
      { scenario: 'A DEI consultant building a case for systemic discrimination', outcome: 'Pattern analysis across historical decisions and outcomes' },
    ],
    differentiators: [
      'Curated for social equity, labour, and human rights cases',
      'Semantic search rather than keyword-only retrieval',
      'Built alongside FAIRCASE for cross-vertical equity intelligence',
      'Access-to-justice aligned with B Corp community impact standards',
    ],
  },

  edtech: {
    name: 'EdTech',
    tagline: 'Learning Infrastructure for Equity, Skills & Transformation',
    description: 'Learning management, certification, cybersecurity training, and gamified education.',
    hero: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1920',
    heroAlt: 'Students engaged in collaborative learning with laptops and digital devices',
    tam: '$13B+',
    orgs: '162',
    platforms: ['FAIRCASE', 'CyberLearn'],
    status: '2 Platforms',
    color: 'from-electric to-emerald',
    overview:
      'Education is the cornerstone of equitable societies. Nzila\'s EdTech vertical spans anti-racism learning and cybersecurity skills — two of the most urgent capability gaps in modern organisations.',
    capabilities: [
      {
        title: 'Custom LMS (Learning Management System)',
        icon: '🎓',
        description:
          'White-label learning environment with course authoring, progress tracking, cohort management, and certification issuance.',
      },
      {
        title: 'AI Learning Coach',
        icon: '🤖',
        description:
          'Personalised coaching pathways using learner performance data, knowledge-gap identification, and adaptive content delivery.',
      },
      {
        title: 'DEI & Anti-Racism Curriculum',
        icon: '✊',
        description:
          'Structured learning pathways on anti-racism, implicit bias, allyship, and systemic equity — curated from lived-experience research.',
      },
      {
        title: 'Compliance & Certification Tracking',
        icon: '📜',
        description:
          'Automated compliance reporting, certification renewal reminders, and audit-ready training records for regulated environments.',
      },
      {
        title: 'Gamified Cybersecurity Training (CyberLearn)',
        icon: '🛡️',
        description:
          'Scenario-based, gamified cybersecurity awareness modules designed for workforce upskilling and phishing-resistance programmes.',
      },
    ],
    useCases: [
      { scenario: 'An HR team rolling out mandatory DEI training', outcome: 'Branded LMS with completion tracking and outcome surveys' },
      { scenario: 'A municipality requiring annual security-awareness certification', outcome: 'CyberLearn gamified modules with automated certification' },
      { scenario: 'A school board assessing educator anti-racism competency', outcome: 'Personalised coaching and progress dashboards per educator' },
    ],
    differentiators: [
      'Dual focus: equity education and technical skills',
      'AI coach adapts content to individual learning pace',
      'Compliance-ready for regulated industries',
      'Aligned with B Corp governance and education impact metrics',
    ],
  },

  commerce: {
    name: 'Commerce',
    tagline: 'Enterprise-Grade Trade Infrastructure for Modern Businesses & Global Supply Chains',
    description: 'Order-centric trade operations, AI-powered quoting, logistics intelligence, and cross-border export compliance.',
    hero: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920',
    heroAlt: 'Customer completing a digital payment at a modern retail checkout counter',
    tam: '$100B+',
    orgs: '700+',
    platforms: ['Flow', 'Trade OS'],
    status: 'Flagship + In Development',
    color: 'from-gold to-coral',
    overview:
      'Nzila\'s Commerce vertical extends the Nzila OS pattern into trade operations. Flow covers order-to-cash and procure-to-pay workflows with auditable state transitions, inventory context, and multi-channel integrations. Trade OS extends the stack with cross-border trade management.',
    capabilities: [
      {
        title: 'Order-to-Cash & Procure-to-Pay (Flow)',
        icon: '🔄',
        description:
          'Full commerce lifecycle management — order creation, payment gating, inventory control, supplier management, and delivery confirmation. Flow integrates with Shopify, Zoho, WhatsApp, and ERP systems.',
      },
      {
        title: 'Instant Quote Generation (Flow)',
        icon: '💰',
        description:
          'AI-assisted product and service quoting with margin controls, PDF generation, e-signature, and CRM integration — quotes convert to orders in one click.',
      },
      {
        title: 'Order-Centric Trade Management (Trade OS)',
        icon: '🔄',
        description:
          'State-machine-enforced order lifecycle from creation through confirmation, production, shipment, and delivery — with payment deposit gating that blocks fulfilment until financial prerequisites are met.',
      },
      {
        title: 'Inventory & Warehouse Management',
        icon: '🏢',
        description:
          'Real-time stock tracking, multi-location warehousing, reorder automation, and lot-level traceability for physical goods operations.',
      },
      {
        title: 'Order Intelligence & Analytics',
        icon: '📊',
        description:
          'Real-time pipeline metrics, order status distribution, payment gate analysis, and domain event audit trails — giving operators full visibility into trade-cycle health.',
      },
    ],
    useCases: [
      { scenario: 'A business managing end-to-end order fulfilment', outcome: 'Flow unified dashboard with payment gating, inventory sync, and real-time delivery tracking' },
      { scenario: 'A service business creating custom quotes for clients', outcome: 'Professional branded quotes in under 2 minutes via Flow — converting to tracked orders instantly' },
      { scenario: 'An importer managing 50+ active purchase orders', outcome: 'Trade OS state-machine-enforced workflows, payment gating, and real-time shipment visibility' },
    ],
    differentiators: [
      'Flow extends continuity principles into commerce operations: state lineage, audit trails, and governed handoffs',
      'Three complementary platforms covering the full trade lifecycle — order creation to delivery',
      'State-machine-enforced workflows prevent illegal transitions and ensure audit compliance',
      'Payment deposit gating blocks production and shipment until financial prerequisites are met',
      'SME-friendly UX with enterprise-grade data architecture',
    ],
  },

  entertainment: {
    name: 'Music & Entertainment',
    tagline: 'Amplifying African & Diaspora Creative Economies',
    description: 'Africa-first music distribution, artist onboarding, streaming analytics, event ticketing, and royalty management.',
    hero: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1920',
    heroAlt: 'DJ performing live with vibrant stage lights illuminating a crowd',
    tam: '$70B',
    orgs: '1000+',
    platforms: ['Zonga'],
    status: 'Flagship + Production Ready',
    color: 'from-coral to-gold',
    overview:
      'Nzila\'s Music & Entertainment vertical celebrates and monetises African and diaspora creative talent. Zonga is an Africa-first music distribution and streaming platform for artists, with royalty calculation, transparent payouts, event ticketing, and broader content distribution for the African and diaspora creative economy.',
    capabilities: [
      {
        title: 'Artist & Label Dashboard',
        icon: '🎵',
        description:
          'Centralised hub for music releases, streaming analytics, fan engagement metrics, and promotional campaigns.',
      },
      {
        title: 'Royalty Distribution Engine',
        icon: '💎',
        description:
          'Transparent, rules-based royalty splitting and automated payouts across multiple rights holders and distribution channels.',
      },
      {
        title: 'Event Ticketing & Management',
        icon: '🎟️',
        description:
          'End-to-end event platform: ticket sales, capacity management, QR check-in, and post-event revenue reconciliation.',
      },
      {
        title: 'Content Distribution Network',
        icon: '🌍',
        description:
          'Multi-platform distribution to streaming services, social media, and diaspora-focused channels with rights management.',
      },
    ],
    useCases: [
      { scenario: 'An independent artist from the African diaspora releasing their first EP', outcome: 'Global distribution with transparent royalty tracking and equal rates from day one' },
      { scenario: 'A promoter running a diaspora concert series', outcome: 'Branded ticketing portal with live check-in and revenue dashboards' },
      { scenario: 'A label managing 20 artists across 3 continents', outcome: 'Unified rights management and royalty automation' },
    ],
    differentiators: [
      'Built specifically for African and diaspora creative communities',
      'Transparent royalty infrastructure — artists see every cent',
      'Integrated ticketing, streaming, and distribution in one product',
      'Supports community economic development — a B Corp impact pillar',
    ],
  },

  healthtech: {
    name: 'Healthtech',
    tagline: 'Cognitive Wellness & Caregiver Support Through AI',
    description: 'Cognitive wellness, dementia care, caregiver support, and health monitoring.',
    hero: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920',
    heroAlt: 'Healthcare professional using a digital tablet for patient diagnostics',
    tam: '$20B',
    orgs: '150',
    platforms: ['Memora'],
    status: 'Modernizing',
    color: 'from-emerald to-cyan-400',
    overview:
      'Memora addresses the silent crisis of cognitive decline — building AI-assisted tools that support individuals with dementia, their caregivers, and the care networks around them. A deeply human-centered platform undergoing modernisation.',
    capabilities: [
      {
        title: 'Cognitive Health Monitoring',
        icon: '🧠',
        description:
          'Longitudinal cognitive assessments, early-warning indicators, and trend analysis for memory care and dementia management.',
      },
      {
        title: 'Caregiver Coordination Hub',
        icon: '👐',
        description:
          'Task scheduling, care-note sharing, shift handover documentation, and family communications in one secure space.',
      },
      {
        title: 'Personalised Memory Aids',
        icon: '📖',
        description:
          'AI-generated life-story content, photo recognition, and daily routine prompts tailored to individual cognitive profiles.',
      },
      {
        title: 'Health System Integrations',
        icon: '🏥',
        description:
          'Interoperability with EMR systems, pharmacy records, and care-plan documentation standards for seamless clinical handoff.',
      },
    ],
    useCases: [
      { scenario: 'A family managing a parent\'s dementia diagnosis at home', outcome: 'Shared dashboard, daily check-ins, and AI-generated memory prompts' },
      { scenario: 'A care facility managing 150+ residents', outcome: 'Shift-level coordination and cognitive trend reporting for clinical staff' },
      { scenario: 'A geriatric care manager monitoring a remote patient', outcome: 'Remote monitoring alerts and caregiver activity tracking' },
    ],
    differentiators: [
      'Human dignity at the centre of every product decision',
      'Designed with and for caregivers — not just clinicians',
      'Cognitive health monitoring aligned with B Corp social wellbeing standards',
      'Undergoing Nzila OS modernisation to cloud-native architecture',
    ],
  },

  insurtech: {
    name: 'Insurtech',
    tagline: 'AI-Driven Underwriting & Policy Intelligence',
    description: 'Insurance arbitrage, underwriting AI, policy lifecycle, and claims intelligence.',
    hero: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1920',
    heroAlt: 'Business professional reviewing insurance policy documents at a desk',
    tam: '$30B',
    orgs: '79',
    platforms: ['SentryIQ360'],
    status: 'In Development',
    color: 'from-electric to-violet',
    overview:
      'SentryIQ360 brings machine learning to the insurance value chain — from risk scoring and underwriting to claims pattern detection and arbitrage identification. Built for carriers, MGAs, and brokerages that need an analytical edge.',
    capabilities: [
      {
        title: 'Underwriting AI & Risk Scoring',
        icon: '📊',
        description:
          'ML-based risk segmentation models that augment underwriter decisions with data-driven probability scores across multiple risk factors.',
      },
      {
        title: 'Claims Pattern Detection',
        icon: '🔎',
        description:
          'Anomaly detection across claims data to surface potential fraud, systematic billing errors, and high-risk claimant segments.',
      },
      {
        title: 'Policy Lifecycle Management',
        icon: '📋',
        description:
          'End-to-end policy administration: quoting, binding, endorsements, renewals, and cancellations with regulatory audit trails.',
      },
      {
        title: 'Arbitrage Intelligence',
        icon: '⚡',
        description:
          'Market-rate benchmarking and premium gap analysis to identify pricing arbitrage opportunities within compliant bounds.',
      },
    ],
    useCases: [
      { scenario: 'An MGA processing 1,000+ applications per month', outcome: 'AI risk triage reduces manual underwriting time by 40%+' },
      { scenario: 'A carrier investigating a cluster of similar claims', outcome: 'Pattern detection flags anomalies with supporting evidence in real time' },
      { scenario: 'A brokerage benchmarking product pricing across the market', outcome: 'Automated arbitrage reports updated on a weekly cadence' },
    ],
    differentiators: [
      'Designed for both carriers and MGAs',
      'Anomaly detection trained on industry-specific claims patterns',
      'Regulatory-audit-ready policy audit trails',
      'Modular — can deploy underwriting AI without full platform adoption',
    ],
  },

  justice: {
    name: 'Justice',
    tagline: 'Technology as a Tool for Equity, Accountability & Social Change',
    description: 'Anti-racism training, DEI analytics, and equity impact measurement.',
    hero: 'https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=1920',
    heroAlt: 'Symbolic raised fist representing social justice, equity, and advocacy movements',
    tam: '$1.5B',
    orgs: '132',
    platforms: ['FAIRCASE'],
    status: 'Production Ready',
    color: 'from-coral to-violet',
    overview:
      'The Justice vertical is Nzila\'s most explicitly values-aligned domain and the clearest expression of our B Corp mission. FAIRCASE gives organisations the tools to measure, understand, and act on systemic racism and inequity.',
    capabilities: [
      {
        title: 'Anti-Racism Learning Pathways',
        icon: '✊',
        description:
          'Structured, evidence-based learning modules drawing on lived experience, tribunal decisions, and academic research — not generic compliance content.',
      },
      {
        title: 'DEI Analytics Dashboard',
        icon: '📈',
        description:
          'Workforce equity metrics, pay-gap analysis, hiring funnel disparity tracking, and promotion parity scores — with longitudinal trend views.',
      },
      {
        title: 'Equity Impact Measurement',
        icon: '🌱',
        description:
          'Quantified social impact reporting aligned with B Corp, GRI, and SDG frameworks for boards, funders, and public accountability.',
      },
      {
        title: 'Tribunal Decision Repository',
        icon: '⚖️',
        description:
          'Searchable database of 132+ curated human rights and anti-discrimination tribunal decisions for legal research and case building.',
      },
    ],
    useCases: [
      { scenario: 'A school board auditing its disciplinary data for racial disparity', outcome: 'Dashboard surfacing gaps by demographic at every decision point' },
      { scenario: 'An NGO reporting social impact to a foundation funder', outcome: 'B Corp-aligned equity impact report generated in hours' },
      { scenario: 'A legal clinic researching precedent for a discrimination case', outcome: '132+ tribunal decisions with semantic search and citation mapping' },
    ],
    differentiators: [
      'Rooted in lived experience, not just compliance checklists',
      'Directly aligned with B Corp People and Community impact standards',
      'Bridges legal research, learning, and analytics in one product',
      'Only platform in our portfolio purpose-built for accountability',
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// STATIC PARAMS
// ─────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  return Object.keys(verticalData).map((slug) => ({ slug }));
}

// ─────────────────────────────────────────────────────────────
// METADATA
// ─────────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const v = verticalData[slug];
  if (!v) return { title: 'Not Found' };
  return {
    title: `${v.name} | Verticals`,
    description: `${v.tagline} — ${v.description} TAM: ${v.tam}.`,
    openGraph: {
      title: `${v.name} — Nzila Ventures`,
      description: v.tagline,
      images: [{ url: `${v.hero}&w=1200&h=630&fit=crop&q=80`, width: 1200, height: 630, alt: v.heroAlt }],
    },
    alternates: { canonical: `/verticals/${slug}` },
  };
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default async function VerticalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const v = verticalData[slug];
  if (!v) notFound();

  const strategicStory = {
    now: `${v.platforms.join(', ')} is actively shaping our ${v.name} footprint today through production-grade capabilities and measurable market execution.`,
    next: `Over the next execution cycle, we are deepening Nzila OS integrations for ${v.name} to improve delivery speed, governance quality, and customer outcomes.`,
  };

  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <Image
          src={v.hero}
          alt={v.heroAlt}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/95" />
        <div className="absolute inset-0 bg-mesh opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <ScrollReveal>
            <Link
              href="/verticals"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
            >
              ← All Verticals
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-4">
              {v.status} · {v.tam} TAM
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
              {v.name}
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-8">{v.tagline}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="flex flex-wrap gap-3">
              {v.platforms.map((p) => (
                <span
                  key={p}
                  className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/10 backdrop-blur text-white border border-white/20"
                >
                  {p}
                </span>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12 items-start">
            <div className="lg:col-span-2">
              <ScrollReveal>
                <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                  Overview
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
                  Our Approach to {v.name}
                </h2>
                <p className="text-lg text-gray-600 leading-relaxed mb-6">{v.overview}</p>
                <div className="rounded-2xl border border-electric/20 bg-electric/5 p-5 mb-6">
                  <div className="text-xs font-semibold uppercase tracking-widest text-electric mb-3">Current Story</div>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold text-navy">Now:</span> {strategicStory.now}
                    </p>
                    <p>
                      <span className="font-semibold text-navy">Next:</span> {strategicStory.next}
                    </p>
                  </div>
                </div>
                {v.note && (
                  <div className="flex gap-3 bg-gold/5 border border-gold/20 rounded-xl p-4">
                    <span className="text-gold mt-0.5">📌</span>
                    <p className="text-sm text-gray-700">{v.note}</p>
                  </div>
                )}
              </ScrollReveal>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Total Addressable Market', value: v.tam },
                { label: 'Data Entities', value: v.orgs },
                { label: 'Platforms', value: String(v.platforms.length) },
                { label: 'Status', value: v.status },
              ].map((stat) => (
                <ScrollReveal key={stat.label}>
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{stat.label}</div>
                    <div className="text-2xl font-bold text-navy">{stat.value}</div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CAPABILITIES ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Capabilities"
            title="What We Build"
            subtitle={`Core capabilities within the ${v.name} vertical`}
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {v.capabilities.map((cap, i) => (
              <ScrollReveal key={cap.title} delay={i * 0.08}>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 hover-lift h-full flex flex-col">
                  <div className="text-3xl mb-4">{cap.icon}</div>
                  <h3 className="text-lg font-bold text-navy mb-3">{cap.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed flex-1">{cap.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ USE CASES ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Real-World Impact"
            title="Use Cases"
            subtitle={`How ${v.name} platforms create value in practice`}
            light
          />
          <div className="space-y-4">
            {v.useCases.map((uc, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div className="grid md:grid-cols-5 gap-0 bg-white/5 rounded-2xl border border-white/10 overflow-hidden hover-lift">
                  <div className="md:col-span-3 p-6 border-b md:border-b-0 md:border-r border-white/10">
                    <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Scenario</div>
                    <p className="text-white font-medium">{uc.scenario}</p>
                  </div>
                  <div className="md:col-span-2 p-6 bg-white/3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-gold mb-2">Outcome</div>
                    <p className="text-gray-300 text-sm">{uc.outcome}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ DIFFERENTIATORS ═══════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Why Nzila"
            title={`Our ${v.name} Edge`}
            subtitle="Key differentiators that set our approach apart"
          />
          <div className="grid md:grid-cols-2 gap-4">
            {v.differentiators.map((d, i) => (
              <ScrollReveal key={i} delay={i * 0.08}>
                <div className="flex gap-4 bg-gray-50 rounded-xl p-5 border border-gray-100 hover-lift">
                  <div className={`w-1.5 shrink-0 rounded-full bg-linear-to-b ${v.color} mt-1`} />
                  <p className="text-gray-700 font-medium">{d}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ ALL VERTICALS NAV ═══════════════════════ */}
      <section className="py-12 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="text-gray-500 text-sm mb-4">Explore other verticals</p>
            <Link
              href="/verticals"
              className="inline-flex items-center justify-center px-6 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-light transition-all text-sm"
            >
              View All Verticals →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <InvestorCTA />
    </main>
  );
}
