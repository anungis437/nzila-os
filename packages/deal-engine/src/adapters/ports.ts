/**
 * Cross-app adapter interfaces.
 *
 * Each adapter maps app-specific data models into canonical Deal Engine
 * domain objects. Control-plane consumes only these interfaces — never
 * raw app-specific models.
 */
import type { Deal, Pilot, IngestionRun, Proposal, PartnerReferral, AccountHealth, FollowUp, Account } from '../types';
import type { DealStage } from '../lifecycle';

export interface DealAdapter {
  getDeals(filters?: DealFilters): Promise<Deal[]>;
  getDealById(id: string): Promise<Deal | null>;
  /** Transition a deal to a new stage. Returns updated deal or null if transition is invalid. */
  transitionStage?(id: string, toStage: DealStage, actor: string, reason?: string): Promise<Deal | null>;
}

export interface PilotAdapter {
  getPilots(filters?: PilotFilters): Promise<Pilot[]>;
  getPilotById(id: string): Promise<Pilot | null>;
  /** Toggle a checklist item on a pilot. */
  updateChecklist?(id: string, key: string, value: boolean, actor: string): Promise<Pilot | null>;
  /** Update pilot status. */
  updateStatus?(id: string, status: string, actor: string): Promise<Pilot | null>;
}

export interface IngestionAdapter {
  getIngestionRuns(filters?: IngestionFilters): Promise<IngestionRun[]>;
  getIngestionRunById(id: string): Promise<IngestionRun | null>;
  /** Retry a failed ingestion run. */
  retry?(id: string, actor: string): Promise<IngestionRun | null>;
}

export interface ProposalAdapter {
  getProposals(filters?: ProposalFilters): Promise<Proposal[]>;
}

export interface PartnerReferralAdapter {
  getReferrals(filters?: PartnerFilters): Promise<PartnerReferral[]>;
  getPartnerStats(): Promise<PartnerStats>;
}

export interface AccountAdapter {
  getAccounts(filters?: AccountFilters): Promise<Account[]>;
  getAccountById(id: string): Promise<Account | null>;
  getAccountHealth(accountId: string): Promise<AccountHealth | null>;
}

export interface FollowUpAdapter {
  getFollowUps(filters?: FollowUpFilters): Promise<FollowUp[]>;
  /** Mark a follow-up complete. */
  complete?(id: string, actor: string): Promise<FollowUp | null>;
  /** Snooze a follow-up to a new date. */
  snooze?(id: string, newDueDate: string, actor: string): Promise<FollowUp | null>;
  /** Reassign a follow-up to a different owner. */
  reassign?(id: string, newOwner: string, actor: string): Promise<FollowUp | null>;
}

// ── Filter types ────────────────────────────────────────

export interface DealFilters {
  source?: string;
  product?: string;
  owner?: string;
  stage?: string;
  stalledDays?: number;
}

export interface PilotFilters {
  status?: string;
  product?: string;
  owner?: string;
  stalledOnly?: boolean;
}

export interface IngestionFilters {
  pilotId?: string;
  status?: string;
  accountName?: string;
}

export interface ProposalFilters {
  dealId?: string;
  status?: string;
}

export interface PartnerFilters {
  partnerId?: string;
  status?: string;
}

export interface AccountFilters {
  stage?: string;
  product?: string;
  owner?: string;
  hasActivePilot?: boolean;
}

export interface FollowUpFilters {
  owner?: string;
  priority?: string;
  overdueOnly?: boolean;
  dealId?: string;
  pilotId?: string;
}

// ── Aggregate types ─────────────────────────────────────

export interface PartnerStats {
  totalReferrals: number;
  convertedReferrals: number;
  totalCommissionsEarned: number;
  totalCommissionsPaid: number;
  topPartners: Array<{ partnerId: string; partnerName: string; dealCount: number; totalValue: number }>;
}

export interface PipelineSummary {
  totalDeals: number;
  totalValue: number;
  byStage: Record<string, { count: number; value: number }>;
  stalledDeals: number;
  averageDaysInStage: number;
}
