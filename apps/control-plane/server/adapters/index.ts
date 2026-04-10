/**
 * Adapter barrel — instantiates concrete adapters and exports
 * factory functions for the data layer.
 */
import "server-only";

import { DbDealAdapter } from "./deals";
import { DbPilotAdapter } from "./pilots";
import { DbIngestionAdapter } from "./ingestion";
import { DbProposalAdapter } from "./proposals";
import { DbPartnerReferralAdapter } from "./partners";
import { DbAccountAdapter } from "./accounts";
import { DbFollowUpAdapter } from "./follow-ups";

// Singleton instances (stateless, safe to reuse)
const dealAdapter = new DbDealAdapter();
const pilotAdapter = new DbPilotAdapter();
const ingestionAdapter = new DbIngestionAdapter();
const proposalAdapter = new DbProposalAdapter();
const partnerAdapter = new DbPartnerReferralAdapter();
const accountAdapter = new DbAccountAdapter();
const followUpAdapter = new DbFollowUpAdapter();

export function getDealAdapter() {
  return dealAdapter;
}
export function getPilotAdapter() {
  return pilotAdapter;
}
export function getIngestionAdapter() {
  return ingestionAdapter;
}
export function getProposalAdapter() {
  return proposalAdapter;
}
export function getPartnerAdapter() {
  return partnerAdapter;
}
export function getAccountAdapter() {
  return accountAdapter;
}
export function getFollowUpAdapter() {
  return followUpAdapter;
}

// Re-export services
export { emitDealEvent, onDealEvent, DEAL_ENGINE_EVENTS } from "./events";
export { recordDealAudit, getDealAuditTimeline } from "./audit";
export type { DealAuditAction } from "./audit";
export { registerDealEngineAutomations } from "./automations";

// Register event-driven automations on module load
import { registerDealEngineAutomations } from "./automations";
registerDealEngineAutomations();
