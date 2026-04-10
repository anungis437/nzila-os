/**
 * Canonical commercial lifecycle for the Nzila OS Deal Engine.
 *
 * Every deal, pilot, and account view across the platform uses this single
 * lifecycle vocabulary. Individual apps may have their own internal statuses,
 * but the Deal Engine always projects into these canonical stages.
 */
import { z } from 'zod';

// ── Canonical stages ────────────────────────────────────

export const DEAL_STAGES = [
  'lead',
  'qualified',
  'demo_scheduled',
  'demo_completed',
  'pilot_proposed',
  'pilot_active',
  'data_received',
  'ingestion_running',
  'pilot_review',
  'converted',
  'expanding',
  'dormant',
  'lost',
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const dealStageSchema = z.enum(DEAL_STAGES);

// ── Stage metadata ──────────────────────────────────────

export interface StageMetadata {
  label: string;
  description: string;
  category: 'early' | 'pilot' | 'ingestion' | 'closing' | 'terminal';
  color: string;
}

export const STAGE_METADATA: Record<DealStage, StageMetadata> = {
  lead:              { label: 'Lead',              description: 'Initial contact or referral received',         category: 'early',     color: 'slate' },
  qualified:         { label: 'Qualified',         description: 'Lead vetted and confirmed as viable',          category: 'early',     color: 'blue' },
  demo_scheduled:    { label: 'Demo Scheduled',    description: 'Product demo booked with prospect',            category: 'early',     color: 'blue' },
  demo_completed:    { label: 'Demo Completed',    description: 'Demo delivered, follow-up pending',            category: 'early',     color: 'indigo' },
  pilot_proposed:    { label: 'Pilot Proposed',    description: 'Pilot package or SOW sent to prospect',        category: 'pilot',     color: 'violet' },
  pilot_active:      { label: 'Pilot Active',      description: 'Pilot in progress with live product usage',    category: 'pilot',     color: 'purple' },
  data_received:     { label: 'Data Received',     description: 'Client data received for ingestion/migration', category: 'ingestion', color: 'amber' },
  ingestion_running: { label: 'Ingestion Running', description: 'Data ingestion or migration in progress',      category: 'ingestion', color: 'orange' },
  pilot_review:      { label: 'Pilot Review',      description: 'Pilot results under review for conversion',    category: 'closing',   color: 'cyan' },
  converted:         { label: 'Converted',         description: 'Deal closed, customer onboarded',              category: 'closing',   color: 'emerald' },
  expanding:         { label: 'Expanding',         description: 'Active customer expanding usage/products',     category: 'closing',   color: 'green' },
  dormant:           { label: 'Dormant',           description: 'No activity for extended period',              category: 'terminal',  color: 'gray' },
  lost:              { label: 'Lost',              description: 'Deal closed-lost or prospect declined',        category: 'terminal',  color: 'red' },
};

// ── Allowed transitions ─────────────────────────────────

export const ALLOWED_TRANSITIONS: Record<DealStage, readonly DealStage[]> = {
  lead:              ['qualified', 'dormant', 'lost'],
  qualified:         ['demo_scheduled', 'pilot_proposed', 'dormant', 'lost'],
  demo_scheduled:    ['demo_completed', 'dormant', 'lost'],
  demo_completed:    ['pilot_proposed', 'qualified', 'dormant', 'lost'],
  pilot_proposed:    ['pilot_active', 'demo_scheduled', 'dormant', 'lost'],
  pilot_active:      ['data_received', 'pilot_review', 'dormant', 'lost'],
  data_received:     ['ingestion_running', 'pilot_active', 'dormant', 'lost'],
  ingestion_running: ['pilot_review', 'data_received', 'dormant', 'lost'],
  pilot_review:      ['converted', 'pilot_active', 'dormant', 'lost'],
  converted:         ['expanding'],
  expanding:         ['dormant'],
  dormant:           ['lead', 'qualified'],
  lost:              ['lead'],
};

export function canTransition(from: DealStage, to: DealStage): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function getNextStages(current: DealStage): readonly DealStage[] {
  return ALLOWED_TRANSITIONS[current];
}

// ── Stage classification helpers ────────────────────────

export function isActiveStage(stage: DealStage): boolean {
  return !['dormant', 'lost', 'converted', 'expanding'].includes(stage);
}

export function isPilotStage(stage: DealStage): boolean {
  return ['pilot_proposed', 'pilot_active', 'data_received', 'ingestion_running', 'pilot_review'].includes(stage);
}

export function isTerminalStage(stage: DealStage): boolean {
  return stage === 'dormant' || stage === 'lost';
}

export function stageOrdinal(stage: DealStage): number {
  return DEAL_STAGES.indexOf(stage);
}

// ── Source mapping from partner/CRM stages to canonical ─

export const PARTNER_STAGE_MAP: Record<string, DealStage> = {
  registered: 'lead',
  submitted:  'qualified',
  approved:   'demo_completed',
  won:        'converted',
  lost:       'lost',
};

export const HUBSPOT_STAGE_MAP: Record<string, DealStage> = {
  appointmentscheduled: 'demo_scheduled',
  qualifiedtobuy:       'qualified',
  presentationscheduled: 'demo_scheduled',
  decisionmakerboughtin: 'demo_completed',
  contractsent:          'pilot_proposed',
  closedwon:             'converted',
  closedlost:            'lost',
};

export function mapPartnerStage(stage: string): DealStage {
  return PARTNER_STAGE_MAP[stage] ?? 'lead';
}

export function mapHubSpotStage(stage: string): DealStage {
  return HUBSPOT_STAGE_MAP[stage.toLowerCase().replace(/\s+/g, '')] ?? 'lead';
}
