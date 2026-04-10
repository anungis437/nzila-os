/**
 * Deterministic seed data for the Deal Engine.
 *
 * Follows the control-plane convention: realistic fixture data used
 * in dev/demo when live adapters have no data yet.
 */
import type { Deal, Pilot, IngestionRun, Proposal, PartnerReferral, AccountHealth, FollowUp, Account } from './types';

const now = new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

// ── Deals ───────────────────────────────────────────────

export const seedDeals: Deal[] = [
  {
    id: 'deal-001', accountId: 'acct-001', accountName: 'CUPE Local 123',
    source: 'partner', stage: 'pilot_active', owner: 'Michel Ouimet',
    partnerId: 'ptr-nungisa', partnerName: 'NungisaLaw', product: 'union-eyes',
    estimatedValue: 85000, currency: 'CAD', contactName: 'Alice Johnson',
    contactEmail: 'alice.johnson@city.toronto.ca', nextAction: 'Review pilot checklist',
    daysInStage: 12, conversionRisk: 'low', createdAt: daysAgo(45), updatedAt: daysAgo(1),
  },
  {
    id: 'deal-002', accountId: 'acct-002', accountName: 'CAPE-ACEP',
    source: 'internal', stage: 'demo_completed', owner: 'Michel Ouimet',
    partnerId: null, partnerName: null, product: 'union-eyes',
    estimatedValue: 120000, currency: 'CAD', contactName: 'Greg Phillips',
    contactEmail: 'g.phillips@acep-cape.ca', nextAction: 'Send pilot proposal',
    daysInStage: 5, conversionRisk: 'medium', createdAt: daysAgo(30), updatedAt: daysAgo(2),
  },
  {
    id: 'deal-003', accountId: 'acct-003', accountName: 'Teamsters Local 938',
    source: 'hubspot', stage: 'qualified', owner: 'David Nkemdirim',
    partnerId: null, partnerName: null, product: 'union-eyes',
    estimatedValue: 65000, currency: 'CAD', contactName: 'Franco Amato',
    contactEmail: 'f.amato@teamsters938.ca', nextAction: 'Schedule demo',
    daysInStage: 8, conversionRisk: 'low', createdAt: daysAgo(20), updatedAt: daysAgo(3),
  },
  {
    id: 'deal-004', accountId: 'acct-004', accountName: 'CLC National',
    source: 'partner', stage: 'ingestion_running', owner: 'Michel Ouimet',
    partnerId: 'ptr-nungisa', partnerName: 'NungisaLaw', product: 'union-eyes',
    estimatedValue: 250000, currency: 'CAD', contactName: 'Hassan Yussuff',
    contactEmail: 'h.yussuff@clc-ctc.ca', nextAction: 'Monitor ingestion completion',
    daysInStage: 3, conversionRisk: 'low', createdAt: daysAgo(60), updatedAt: daysAgo(1),
  },
  {
    id: 'deal-005', accountId: 'acct-005', accountName: 'Afrobeats Records',
    source: 'referral', stage: 'pilot_proposed', owner: 'Tania Da Silva',
    partnerId: null, partnerName: null, product: 'zonga',
    estimatedValue: 40000, currency: 'CAD', contactName: 'Kofi Mensah',
    contactEmail: 'kofi@afrobeatsrecords.com', nextAction: 'Await pilot acceptance',
    daysInStage: 6, conversionRisk: 'medium', createdAt: daysAgo(25), updatedAt: daysAgo(2),
  },
  {
    id: 'deal-006', accountId: 'acct-006', accountName: 'Federation of Agriculture',
    source: 'internal', stage: 'demo_scheduled', owner: 'David Nkemdirim',
    partnerId: null, partnerName: null, product: 'agrimo',
    estimatedValue: 95000, currency: 'CAD', contactName: 'Marie-Claire Fortier',
    contactEmail: 'mc.fortier@fedagri.ca', nextAction: 'Prepare demo environment',
    daysInStage: 2, conversionRisk: 'low', createdAt: daysAgo(15), updatedAt: daysAgo(1),
  },
  {
    id: 'deal-007', accountId: 'acct-007', accountName: 'OPSEU Local 546',
    source: 'partner', stage: 'lead', owner: 'Michel Ouimet',
    partnerId: 'ptr-nungisa', partnerName: 'NungisaLaw', product: 'union-eyes',
    estimatedValue: 55000, currency: 'CAD', contactName: 'Sarah Chen',
    contactEmail: 's.chen@opseu546.on.ca', nextAction: 'Qualify lead',
    daysInStage: 14, conversionRisk: 'high', createdAt: daysAgo(14), updatedAt: daysAgo(14),
  },
  {
    id: 'deal-008', accountId: 'acct-008', accountName: 'PSAC Atlantic',
    source: 'website', stage: 'dormant', owner: 'Tim Maguire',
    partnerId: null, partnerName: null, product: 'union-eyes',
    estimatedValue: 70000, currency: 'CAD', contactName: 'James MacLeod',
    contactEmail: 'j.macleod@psac-afpc.ca', nextAction: 'Revive or close',
    daysInStage: 42, conversionRisk: 'high', createdAt: daysAgo(90), updatedAt: daysAgo(42),
  },
];

// ── Pilots ──────────────────────────────────────────────

export const seedPilots: Pilot[] = [
  {
    id: 'pilot-001', dealId: 'deal-001', accountId: 'acct-001',
    accountName: 'CUPE Local 123', product: 'union-eyes', pilotStatus: 'active',
    successCriteria: ['Grievance case resolution <48h', 'User adoption >60%', 'Data migration verified'],
    startDate: daysAgo(12), targetReviewDate: daysAgo(-18), owner: 'Michel Ouimet',
    ingestionStatus: 'completed',
    checklist: { dataReceived: true, ingestionComplete: true, demoDatasetReady: true, userOnboardingComplete: false, reviewMeetingScheduled: false, conversionTriggered: false },
    currentBlockers: ['User onboarding training not yet scheduled'],
    daysActive: 12, createdAt: daysAgo(15), updatedAt: daysAgo(1),
  },
  {
    id: 'pilot-002', dealId: 'deal-004', accountId: 'acct-004',
    accountName: 'CLC National', product: 'union-eyes', pilotStatus: 'ingestion',
    successCriteria: ['National grievance workflow live', 'Executive dashboard operational', '3 affiliate unions onboarded'],
    startDate: daysAgo(20), targetReviewDate: daysAgo(-10), owner: 'Michel Ouimet',
    ingestionStatus: 'running',
    checklist: { dataReceived: true, ingestionComplete: false, demoDatasetReady: false, userOnboardingComplete: false, reviewMeetingScheduled: false, conversionTriggered: false },
    currentBlockers: ['Ingestion in progress — 2 sources pending'],
    daysActive: 20, createdAt: daysAgo(22), updatedAt: daysAgo(1),
  },
];

// ── Ingestion Runs ──────────────────────────────────────

export const seedIngestionRuns: IngestionRun[] = [
  {
    id: 'ing-001', pilotId: 'pilot-001', migrationId: 'mig-cupe123-001',
    accountName: 'CUPE Local 123', sourceSystem: 'Legacy GMS (FileMaker)',
    status: 'completed', processedCount: 2847, failedCount: 12, warningCount: 34,
    duplicateCount: 8, retryCount: 1, trustSignal: 'verified',
    startedAt: daysAgo(10), completedAt: daysAgo(9),
  },
  {
    id: 'ing-002', pilotId: 'pilot-002', migrationId: 'mig-clc-001',
    accountName: 'CLC National', sourceSystem: 'SharePoint + Excel exports',
    status: 'running', processedCount: 5120, failedCount: 45, warningCount: 89,
    duplicateCount: 23, retryCount: 0, trustSignal: 'partial',
    startedAt: daysAgo(2), completedAt: null,
  },
  {
    id: 'ing-003', pilotId: 'pilot-002', migrationId: 'mig-clc-002',
    accountName: 'CLC National', sourceSystem: 'Member database (Access)',
    status: 'pending', processedCount: 0, failedCount: 0, warningCount: 0,
    duplicateCount: 0, retryCount: 0, trustSignal: null,
    startedAt: null, completedAt: null,
  },
];

// ── Proposals ───────────────────────────────────────────

export const seedProposals: Proposal[] = [
  {
    id: 'prop-001', dealId: 'deal-001', accountName: 'CUPE Local 123',
    quoteSource: 'flow', pricingModel: 'Per-member annual', status: 'accepted',
    amount: 85000, currency: 'CAD', pilotPackageIssued: true,
    conversionPricingReady: true, generatedAt: daysAgo(40),
  },
  {
    id: 'prop-002', dealId: 'deal-002', accountName: 'CAPE-ACEP',
    quoteSource: 'flow', pricingModel: 'Tiered per-user', status: 'draft',
    amount: 120000, currency: 'CAD', pilotPackageIssued: false,
    conversionPricingReady: false, generatedAt: daysAgo(3),
  },
  {
    id: 'prop-003', dealId: 'deal-005', accountName: 'Afrobeats Records',
    quoteSource: 'internal', pricingModel: 'Revenue share + platform fee', status: 'sent',
    amount: 40000, currency: 'CAD', pilotPackageIssued: true,
    conversionPricingReady: false, generatedAt: daysAgo(6),
  },
];

// ── Partner Referrals ───────────────────────────────────

export const seedReferrals: PartnerReferral[] = [
  {
    id: 'ref-001', partnerId: 'ptr-nungisa', partnerName: 'NungisaLaw',
    dealId: 'deal-001', accountName: 'CUPE Local 123',
    referralStatus: 'converted', commissionStatus: 'pending',
    commissionAmount: 8500, referredAt: daysAgo(45),
  },
  {
    id: 'ref-002', partnerId: 'ptr-nungisa', partnerName: 'NungisaLaw',
    dealId: 'deal-004', accountName: 'CLC National',
    referralStatus: 'qualified', commissionStatus: null,
    commissionAmount: null, referredAt: daysAgo(60),
  },
  {
    id: 'ref-003', partnerId: 'ptr-nungisa', partnerName: 'NungisaLaw',
    dealId: 'deal-007', accountName: 'OPSEU Local 546',
    referralStatus: 'registered', commissionStatus: null,
    commissionAmount: null, referredAt: daysAgo(14),
  },
];

// ── Account Health / Proof ──────────────────────────────

export const seedAccountHealth: AccountHealth[] = [
  {
    id: 'ah-001', accountId: 'acct-001', accountName: 'CUPE Local 123',
    pilotId: 'pilot-001', readinessScore: 82, migrationHealth: 'healthy',
    ingestionSuccess: true, productUsageSummary: '47 active users, 156 cases managed',
    recommendationTrust: 'high', evidencePacksAvailable: 3,
    governancePosture: 'compliant', proofStatus: 'ready', lastActivityAt: daysAgo(1),
  },
  {
    id: 'ah-002', accountId: 'acct-004', accountName: 'CLC National',
    pilotId: 'pilot-002', readinessScore: 45, migrationHealth: 'degraded',
    ingestionSuccess: null, productUsageSummary: 'Ingestion in progress',
    recommendationTrust: 'medium', evidencePacksAvailable: 1,
    governancePosture: 'partial', proofStatus: 'in_progress', lastActivityAt: daysAgo(1),
  },
];

// ── Follow-ups ──────────────────────────────────────────

export const seedFollowUps: FollowUp[] = [
  {
    id: 'fu-001', dealId: 'deal-002', pilotId: null,
    accountName: 'CAPE-ACEP', title: 'Send pilot proposal after demo',
    description: 'Demo completed — prepare and send pilot SOW', owner: 'Michel Ouimet',
    priority: 'high', dueDate: daysAgo(-2), isOverdue: false, completedAt: null,
    trigger: 'demo_completed', createdAt: daysAgo(5),
  },
  {
    id: 'fu-002', dealId: 'deal-001', pilotId: 'pilot-001',
    accountName: 'CUPE Local 123', title: 'Schedule user onboarding training',
    description: 'Pilot active but user onboarding not complete',
    owner: 'Tania Da Silva', priority: 'high', dueDate: daysAgo(1), isOverdue: true,
    completedAt: null, trigger: 'pilot_checklist_gap', createdAt: daysAgo(5),
  },
  {
    id: 'fu-003', dealId: 'deal-007', pilotId: null,
    accountName: 'OPSEU Local 546', title: 'Qualify stale lead',
    description: 'Lead has been in stage for 14 days with no activity',
    owner: 'Michel Ouimet', priority: 'medium', dueDate: daysAgo(0), isOverdue: true,
    completedAt: null, trigger: 'deal_stalled', createdAt: daysAgo(3),
  },
  {
    id: 'fu-004', dealId: 'deal-004', pilotId: 'pilot-002',
    accountName: 'CLC National', title: 'Monitor ingestion completion',
    description: 'Ingestion running — check status and schedule review when done',
    owner: 'Michel Ouimet', priority: 'medium', dueDate: daysAgo(-3), isOverdue: false,
    completedAt: null, trigger: 'ingestion_started', createdAt: daysAgo(2),
  },
  {
    id: 'fu-005', dealId: 'deal-008', pilotId: null,
    accountName: 'PSAC Atlantic', title: 'Revive or close dormant deal',
    description: 'No activity for 42 days. Decision required.',
    owner: 'Tim Maguire', priority: 'low', dueDate: daysAgo(7), isOverdue: true,
    completedAt: null, trigger: 'dormant_threshold', createdAt: daysAgo(10),
  },
];

// ── Accounts (unified view) ─────────────────────────────

export const seedAccounts: Account[] = [
  {
    id: 'acct-001', name: 'CUPE Local 123', dealStage: 'pilot_active',
    activePilot: true, billingState: 'Pilot (no billing)', partnerSource: 'NungisaLaw',
    productFootprint: ['union-eyes'], owner: 'Michel Ouimet',
    lastActivityAt: daysAgo(1), healthScore: 82, nextAction: 'Complete user onboarding',
    currentBlocker: 'Training not scheduled',
  },
  {
    id: 'acct-002', name: 'CAPE-ACEP', dealStage: 'demo_completed',
    activePilot: false, billingState: null, partnerSource: null,
    productFootprint: ['union-eyes'], owner: 'Michel Ouimet',
    lastActivityAt: daysAgo(2), healthScore: null, nextAction: 'Send pilot proposal',
    currentBlocker: null,
  },
  {
    id: 'acct-003', name: 'Teamsters Local 938', dealStage: 'qualified',
    activePilot: false, billingState: null, partnerSource: null,
    productFootprint: ['union-eyes'], owner: 'David Nkemdirim',
    lastActivityAt: daysAgo(3), healthScore: null, nextAction: 'Schedule demo',
    currentBlocker: null,
  },
  {
    id: 'acct-004', name: 'CLC National', dealStage: 'ingestion_running',
    activePilot: true, billingState: 'Pilot (no billing)', partnerSource: 'NungisaLaw',
    productFootprint: ['union-eyes'], owner: 'Michel Ouimet',
    lastActivityAt: daysAgo(1), healthScore: 45, nextAction: 'Monitor ingestion',
    currentBlocker: 'Ingestion in progress — 2 sources pending',
  },
  {
    id: 'acct-005', name: 'Afrobeats Records', dealStage: 'pilot_proposed',
    activePilot: false, billingState: null, partnerSource: null,
    productFootprint: ['zonga'], owner: 'Tania Da Silva',
    lastActivityAt: daysAgo(2), healthScore: null, nextAction: 'Await pilot acceptance',
    currentBlocker: null,
  },
  {
    id: 'acct-006', name: 'Federation of Agriculture', dealStage: 'demo_scheduled',
    activePilot: false, billingState: null, partnerSource: null,
    productFootprint: ['agrimo'], owner: 'David Nkemdirim',
    lastActivityAt: daysAgo(1), healthScore: null, nextAction: 'Prepare demo environment',
    currentBlocker: null,
  },
  {
    id: 'acct-007', name: 'OPSEU Local 546', dealStage: 'lead',
    activePilot: false, billingState: null, partnerSource: 'NungisaLaw',
    productFootprint: ['union-eyes'], owner: 'Michel Ouimet',
    lastActivityAt: daysAgo(14), healthScore: null, nextAction: 'Qualify lead',
    currentBlocker: 'No response from contact',
  },
  {
    id: 'acct-008', name: 'PSAC Atlantic', dealStage: 'dormant',
    activePilot: false, billingState: null, partnerSource: null,
    productFootprint: ['union-eyes'], owner: 'Tim Maguire',
    lastActivityAt: daysAgo(42), healthScore: null, nextAction: 'Revive or close',
    currentBlocker: 'No activity for 42 days',
  },
];
