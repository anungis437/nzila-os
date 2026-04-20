/**
 * @nzila/platform-intelligence-home — Partner Map Service
 *
 * Structured map of Nzila's strategic partners, prospects, and ecosystem
 * relationships across all product domains.
 *
 * TODO: Replace SEED_PARTNERS with DB queries from lh_partner_map table
 */
import type { Partner, PartnerKpis } from './types'

// ── Seed Data ─────────────────────────────────────────────────────────────────

const SEED_PARTNERS: Partner[] = [
  // ── Unions & Labour ───────────────────────────────────────────────────────
  {
    id: 'partner-001',
    name: 'CUPE Ontario',
    partnerType: 'union',
    primaryDomain: 'union-eyes',
    status: 'prospect',
    annualValueCad: 0,
    agreementTypes: ['pilot'],
    contactName: null,
    contactEmail: null,
    notes: 'Active pilot discussion. 250,000 Ontario members. Top priority.',
  },
  {
    id: 'partner-002',
    name: 'Unifor Canada',
    partnerType: 'union',
    primaryDomain: 'union-eyes',
    status: 'negotiating',
    annualValueCad: 0,
    agreementTypes: ['pilot', 'data_sharing'],
    contactName: null,
    contactEmail: null,
    notes: 'Pilot MOU in negotiation. 315,000 members across auto, media, telecom sectors.',
  },
  {
    id: 'partner-003',
    name: 'CUPE National',
    partnerType: 'union',
    primaryDomain: 'union-eyes',
    status: 'prospect',
    annualValueCad: 0,
    agreementTypes: ['enterprise_sales'],
    contactName: null,
    contactEmail: null,
    notes: '700,000 members. National deal = platform-defining. Long sales cycle — start relationship building now.',
  },
  {
    id: 'partner-004',
    name: 'Canadian Labour Congress',
    partnerType: 'union',
    primaryDomain: 'union-eyes',
    status: 'prospect',
    annualValueCad: 0,
    agreementTypes: ['distribution', 'research'],
    contactName: null,
    contactEmail: null,
    notes: 'National labour federation — 3M workers. Distribution gateway to affiliate unions.',
  },
  // ── Law Firms ──────────────────────────────────────────────────────────────
  {
    id: 'partner-005',
    name: 'Dentons Canada LLP',
    partnerType: 'law_firm',
    primaryDomain: 'faircase',
    status: 'negotiating',
    annualValueCad: 200_000,
    agreementTypes: ['distribution', 'law_firm_partnership'],
    contactName: null,
    contactEmail: null,
    notes: 'Innovation team engaged. Revenue share model under discussion for FairCase distribution.',
  },
  {
    id: 'partner-006',
    name: 'McCarthy Tétrault',
    partnerType: 'law_firm',
    primaryDomain: 'faircase',
    status: 'prospect',
    annualValueCad: 150_000,
    agreementTypes: ['law_firm_partnership'],
    contactName: null,
    contactEmail: null,
    notes: 'Top Bay Street firm. Labour + employment practice is natural FairCase channel.',
  },
  {
    id: 'partner-007',
    name: 'Access to Justice Network (A2AJ)',
    partnerType: 'ngo',
    primaryDomain: 'faircase',
    status: 'negotiating',
    annualValueCad: 0,
    agreementTypes: ['research', 'data_sharing'],
    contactName: null,
    contactEmail: null,
    notes: 'Legal corpus data sharing MOU in progress. Strategic data moat for FairCase AI.',
  },
  // ── Government Agencies ────────────────────────────────────────────────────
  {
    id: 'partner-008',
    name: 'FedDev Ontario',
    partnerType: 'government_agency',
    primaryDomain: 'platform',
    status: 'prospect',
    annualValueCad: 300_000,
    agreementTypes: ['grant'],
    contactName: null,
    contactEmail: null,
    notes: 'Southern Ontario tech innovation fund. Target $200K–$500K for Flow + Union Eyes.',
  },
  {
    id: 'partner-009',
    name: 'NRC — Industrial Technology Advisor',
    partnerType: 'government_agency',
    primaryDomain: 'platform',
    status: 'prospect',
    annualValueCad: 250_000,
    agreementTypes: ['grant'],
    contactName: null,
    contactEmail: null,
    notes: 'IRAP program. Need to connect with Ontario ITA. Strong CCPC fit.',
  },
  {
    id: 'partner-010',
    name: 'Export Development Canada',
    partnerType: 'government_agency',
    primaryDomain: 'flow',
    status: 'prospect',
    annualValueCad: 0,
    agreementTypes: ['distribution', 'research'],
    contactName: null,
    contactEmail: null,
    notes: 'EDC distributes CanExport through partner network. Explore Flow integration.',
  },
  // ── Music & Arts ──────────────────────────────────────────────────────────
  {
    id: 'partner-011',
    name: 'FACTOR Canada',
    partnerType: 'foundation',
    primaryDomain: 'zonga',
    status: 'prospect',
    annualValueCad: 75_000,
    agreementTypes: ['grant'],
    contactName: null,
    contactEmail: null,
    notes: 'FACTOR digital distribution grant. Application in progress. Deadline June 1.',
  },
  {
    id: 'partner-012',
    name: 'Canada Council for the Arts',
    partnerType: 'government_agency',
    primaryDomain: 'zonga',
    status: 'prospect',
    annualValueCad: 50_000,
    agreementTypes: ['grant'],
    contactName: null,
    contactEmail: null,
    notes: 'Digital Strategies fund. Next intake Q3 2026. Afrobeats cultural heritage angle.',
  },
  {
    id: 'partner-013',
    name: 'Toronto International Film Festival (TIFF)',
    partnerType: 'media',
    primaryDomain: 'zonga',
    status: 'prospect',
    annualValueCad: 15_000,
    agreementTypes: ['sponsorship'],
    contactName: null,
    contactEmail: null,
    notes: 'Zonga × TIFF Black Creators Spotlight. September timing aligns with festival.',
  },
  // ── Insurance & Benefits ──────────────────────────────────────────────────
  {
    id: 'partner-014',
    name: 'Sun Life Financial',
    partnerType: 'insurer',
    primaryDomain: 'union-eyes',
    status: 'prospect',
    annualValueCad: 25_000,
    agreementTypes: ['sponsorship'],
    contactName: null,
    contactEmail: null,
    notes: 'Administers benefits for several CUPE locals. Natural sponsor for Union Eyes.',
  },
  {
    id: 'partner-015',
    name: "Ontario Teachers' Pension Plan (OTPP)",
    partnerType: 'pension_fund',
    primaryDomain: 'union-eyes',
    status: 'prospect',
    annualValueCad: 15_000,
    agreementTypes: ['pilot'],
    contactName: null,
    contactEmail: null,
    notes: 'Pension intelligence module pilot target. 340,000 plan members.',
  },
  // ── SMB Channels ──────────────────────────────────────────────────────────
  {
    id: 'partner-016',
    name: 'BIPOC Business Network Toronto',
    partnerType: 'smb_channel',
    primaryDomain: 'flow',
    status: 'prospect',
    annualValueCad: 60_000,
    agreementTypes: ['channel'],
    contactName: null,
    contactEmail: null,
    notes: '200 members × $300/yr. Channel agreement in proposal stage. High efficiency path.',
  },
  // ── Research ──────────────────────────────────────────────────────────────
  {
    id: 'partner-017',
    name: 'Ryerson DMZ / Toronto Metropolitan University',
    partnerType: 'research_institution',
    primaryDomain: 'platform',
    status: 'prospect',
    annualValueCad: 0,
    agreementTypes: ['research'],
    contactName: null,
    contactEmail: null,
    notes: 'Academic partnership for labour tech research. Adds credibility + SSHRC funding potential.',
  },
]

// ── Service Functions ────────────────────────────────────────────────────────

export function getPartners(): Partner[] {
  return SEED_PARTNERS
}

export function getPartnersByDomain(domain: string): Partner[] {
  return SEED_PARTNERS.filter((p) => p.primaryDomain === domain)
}

export function getActivePartners(): Partner[] {
  return SEED_PARTNERS.filter((p) => p.status === 'active' || p.status === 'negotiating')
}

export function getProspects(): Partner[] {
  return SEED_PARTNERS.filter((p) => p.status === 'prospect')
}

export function getPartnerKpis(): PartnerKpis {
  const all = SEED_PARTNERS
  const active = getActivePartners()
  const prospects = getProspects()
  const totalValue = all.reduce((sum, p) => sum + p.annualValueCad, 0)

  return {
    totalPartners: all.length,
    activePartners: active.length,
    prospects: prospects.length,
    totalAnnualValueCad: totalValue,
  }
}
