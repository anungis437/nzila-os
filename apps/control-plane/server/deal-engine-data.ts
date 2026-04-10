/**
 * Server-side data access for the Deal Engine.
 *
 * Strategy: try live DB adapters first → fall back to seed data
 * when the adapter returns nothing or the underlying tables
 * do not exist yet (local dev without full schema).
 */
import "server-only";

import {
  seedDeals,
  seedPilots,
  seedIngestionRuns,
  seedProposals,
  seedReferrals,
  seedAccountHealth,
  seedFollowUps,
  seedAccounts,
} from "@nzila/deal-engine/seed";
import {
  dealSchema,
  pilotSchema,
  ingestionRunSchema,
  proposalSchema,
  partnerReferralSchema,
  accountHealthSchema,
  followUpSchema,
  accountSchema,
} from "@nzila/deal-engine/types";
import type {
  Deal,
  Pilot,
  IngestionRun,
  Proposal,
  PartnerReferral,
  AccountHealth,
  FollowUp,
  Account,
} from "@nzila/deal-engine/types";
import type { PipelineSummary, PartnerStats } from "@nzila/deal-engine/adapters";
import { z } from "zod";

import {
  getDealAdapter,
  getPilotAdapter,
  getIngestionAdapter,
  getProposalAdapter,
  getPartnerAdapter,
  getAccountAdapter,
  getFollowUpAdapter,
} from "./adapters";
import { enrichWithProofData } from "./adapters/proof";

// ── Seed parsers (fallback) ─────────────────────────────

function parseSeedDeals(): Deal[] {
  return z.array(dealSchema).parse(seedDeals) as Deal[];
}
function parseSeedPilots(): Pilot[] {
  return z.array(pilotSchema).parse(seedPilots) as Pilot[];
}
function parseSeedIngestion(): IngestionRun[] {
  return z.array(ingestionRunSchema).parse(seedIngestionRuns) as IngestionRun[];
}
function parseSeedProposals(): Proposal[] {
  return z.array(proposalSchema).parse(seedProposals) as Proposal[];
}
function parseSeedReferrals(): PartnerReferral[] {
  return z.array(partnerReferralSchema).parse(seedReferrals) as PartnerReferral[];
}
function parseSeedFollowUps(): FollowUp[] {
  return z.array(followUpSchema).parse(seedFollowUps) as FollowUp[];
}
function parseSeedAccounts(): Account[] {
  return z.array(accountSchema).parse(seedAccounts) as Account[];
}

// ── Deals / Pipeline ────────────────────────────────────

export async function getDeals(): Promise<Deal[]> {
  try {
    const live = await getDealAdapter().getDeals();
    if (live.length > 0) return live;
  } catch (err) {
    console.error("[DATA] deal adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for deals");
  return parseSeedDeals();
}

export async function getPipelineSummary(preloadedDeals?: Deal[]): Promise<PipelineSummary> {
  const deals = preloadedDeals ?? await getDeals();
  const byStage = new Map<string, { count: number; value: number }>();
  let stalledDeals = 0;
  let totalDays = 0;

  for (const d of deals) {
    const entry = byStage.get(d.stage) ?? { count: 0, value: 0 };
    entry.count++;
    entry.value += d.estimatedValue;
    byStage.set(d.stage, entry);
    totalDays += d.daysInStage;
    if (d.daysInStage > 14) stalledDeals++;
  }

  return {
    totalDeals: deals.length,
    totalValue: deals.reduce((s, d) => s + d.estimatedValue, 0),
    byStage: Object.fromEntries(byStage),
    stalledDeals,
    averageDaysInStage: deals.length > 0 ? Math.round(totalDays / deals.length) : 0,
  };
}

// ── Pilots ───────────────────────────────────────────────

export async function getPilots(): Promise<Pilot[]> {
  try {
    const live = await getPilotAdapter().getPilots();
    if (live.length > 0) return live;
  } catch (err) {
    console.error("[DATA] pilot adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for pilots");
  return parseSeedPilots();
}

// ── Ingestion ───────────────────────────────────────────

export async function getIngestionRuns(): Promise<IngestionRun[]> {
  try {
    const live = await getIngestionAdapter().getIngestionRuns();
    if (live.length > 0) return live;
  } catch (err) {
    console.error("[DATA] ingestion adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for ingestion runs");
  return parseSeedIngestion();
}

// ── Proposals ───────────────────────────────────────────

export async function getProposals(): Promise<Proposal[]> {
  try {
    const live = await getProposalAdapter().getProposals();
    if (live.length > 0) return live;
  } catch (err) {
    console.error("[DATA] proposal adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for proposals");
  return parseSeedProposals();
}

// ── Partners ────────────────────────────────────────────

export async function getReferrals(): Promise<PartnerReferral[]> {
  try {
    const live = await getPartnerAdapter().getReferrals();
    if (live.length > 0) return live;
  } catch (err) {
    console.error("[DATA] referral adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for referrals");
  return parseSeedReferrals();
}

export async function getPartnerStats(): Promise<PartnerStats> {
  try {
    const stats = await getPartnerAdapter().getPartnerStats();
    if (stats.totalReferrals > 0) return stats;
  } catch (err) {
    console.error("[DATA] partner stats adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for partner stats");
  const refs = parseSeedReferrals();
  const converted = refs.filter((r) => r.referralStatus === "converted").length;
  const earnedComm = refs
    .filter((r) => r.commissionStatus === "earned" || r.commissionStatus === "paid")
    .reduce((s, r) => s + (r.commissionAmount ?? 0), 0);
  const paidComm = refs
    .filter((r) => r.commissionStatus === "paid")
    .reduce((s, r) => s + (r.commissionAmount ?? 0), 0);

  const byPartner = new Map<string, { name: string; dealCount: number; totalValue: number }>();
  for (const r of refs) {
    const entry = byPartner.get(r.partnerId) ?? { name: r.partnerName, dealCount: 0, totalValue: 0 };
    entry.dealCount++;
    entry.totalValue += r.commissionAmount ?? 0;
    byPartner.set(r.partnerId, entry);
  }
  const topPartners = [...byPartner.entries()]
    .sort((a, b) => b[1].dealCount - a[1].dealCount)
    .slice(0, 5)
    .map(([id, { name, dealCount, totalValue }]) => ({ partnerId: id, partnerName: name, dealCount, totalValue }));

  return {
    totalReferrals: refs.length,
    convertedReferrals: converted,
    totalCommissionsEarned: earnedComm,
    totalCommissionsPaid: paidComm,
    topPartners,
  };
}

// ── Account Health / Proof ──────────────────────────────

export async function getAccountHealthRecords(): Promise<AccountHealth[]> {
  try {
    const adapter = getAccountAdapter();
    // Use batch method to avoid N+1 per-account queries
    if ("getBulkAccountHealth" in adapter) {
      const bulk = await (adapter as { getBulkAccountHealth: () => Promise<AccountHealth[]> }).getBulkAccountHealth();
      if (bulk.length > 0) return enrichWithProofData(bulk);
    }
  } catch (err) {
    console.error("[DATA] account health adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for account health");
  const records = z.array(accountHealthSchema).parse(seedAccountHealth) as AccountHealth[];
  return enrichWithProofData(records);
}

// ── Follow-ups ──────────────────────────────────────────

export async function getFollowUps(): Promise<FollowUp[]> {
  try {
    const live = await getFollowUpAdapter().getFollowUps();
    if (live.length > 0) return live;
  } catch (err) {
    console.error("[DATA] follow-up adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for follow-ups");
  return parseSeedFollowUps();
}

// ── Accounts ────────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  try {
    const live = await getAccountAdapter().getAccounts();
    if (live.length > 0) return live;
  } catch (err) {
    console.error("[DATA] account adapter unavailable", err);
  }
  console.info("[DEV FALLBACK] Using seed data for accounts");
  return parseSeedAccounts();
}

// ── Pipeline Intelligence ───────────────────────────────

export interface PipelineIntelligence {
  stalledDeals: { id: string; accountName: string; stage: string; daysInStage: number }[];
  missingNextAction: number;
  highRiskCount: number;
  conversionReady: { id: string; accountName: string }[];
  avgDaysToConvert: number | null;
}

export async function getPipelineIntelligence(preloadedDeals?: Deal[]): Promise<PipelineIntelligence> {
  const deals = preloadedDeals ?? await getDeals();

  const stalledDeals = deals
    .filter((d) => d.daysInStage > 14 && d.stage !== "converted" && d.stage !== "lost" && d.stage !== "dormant")
    .map((d) => ({ id: d.id, accountName: d.accountName, stage: d.stage, daysInStage: d.daysInStage }));

  const missingNextAction = deals
    .filter((d) => !d.nextAction && d.stage !== "converted" && d.stage !== "lost" && d.stage !== "dormant")
    .length;

  const highRiskCount = deals.filter((d) => d.conversionRisk === "high").length;

  const conversionReady = deals
    .filter((d) => d.stage === "pilot_review")
    .map((d) => ({ id: d.id, accountName: d.accountName }));

  const convertedDeals = deals.filter((d) => d.stage === "converted");
  const avgDaysToConvert = convertedDeals.length > 0
    ? Math.round(convertedDeals.reduce((s, d) => s + d.daysInStage, 0) / convertedDeals.length)
    : null;

  return { stalledDeals, missingNextAction, highRiskCount, conversionReady, avgDaysToConvert };
}

// ── System Health ───────────────────────────────────────

export interface AdapterHealth {
  adapter: string;
  status: "live" | "degraded";
}

export interface SystemHealth {
  overall: "live" | "degraded";
  adapters: AdapterHealth[];
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const checks: AdapterHealth[] = [];

  const probe = async (name: string, fn: () => Promise<unknown[]>): Promise<AdapterHealth> => {
    try {
      const result = await fn();
      return { adapter: name, status: result.length > 0 ? "live" : "degraded" };
    } catch {
      return { adapter: name, status: "degraded" };
    }
  };

  checks.push(
    ...(await Promise.all([
      probe("deals", () => getDealAdapter().getDeals()),
      probe("pilots", () => getPilotAdapter().getPilots()),
      probe("follow-ups", () => getFollowUpAdapter().getFollowUps()),
      probe("ingestion", () => getIngestionAdapter().getIngestionRuns()),
    ])),
  );

  const overall = checks.some((c) => c.status === "degraded") ? "degraded" : "live";
  return { overall, adapters: checks };
}
