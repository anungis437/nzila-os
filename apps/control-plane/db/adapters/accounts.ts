/**
 * AccountAdapter — stitches commerceCustomers + tradeParties into unified Account view.
 *
 * Enriches with deal stage, pilot status, and health scores from related data.
 */
import "server-only";

import { logger } from "@/lib/telemetry";
import { db } from "@nzila/db";
import { commerceCustomers, commerceOpportunities, tradeParties, tradeDeals } from "@nzila/db";
import { desc, eq, sql } from "drizzle-orm";
import { COMMERCE_STAGE_MAP, TRADE_STAGE_MAP } from "@nzila/deal-engine/lifecycle";
import { dealEnginePilots } from "./schemas";
import type { Account, AccountHealth } from "@nzila/deal-engine/types";
import type { AccountAdapter as IAccountAdapter, AccountFilters } from "@nzila/deal-engine/adapters";

async function fetchCommerceAccounts(): Promise<Account[]> {
  const rows = await db
    .select({
      id: commerceCustomers.id,
      name: commerceCustomers.name,
      company: commerceCustomers.company,
      email: commerceCustomers.email,
      createdAt: commerceCustomers.createdAt,
      updatedAt: commerceCustomers.updatedAt,
    })
    .from(commerceCustomers)
    .orderBy(desc(commerceCustomers.updatedAt))
    .limit(200);

  // Enrich with latest opportunity stage per customer
  const customerIds = rows.map((r) => r.id);
  const oppMap = new Map<string, string>();

  if (customerIds.length > 0) {
    try {
      const opps = await db
        .select({
          customerId: commerceOpportunities.customerId,
          status: commerceOpportunities.status,
        })
        .from(commerceOpportunities)
        .where(sql`${commerceOpportunities.customerId} = ANY(${customerIds})`)
        .orderBy(desc(commerceOpportunities.updatedAt));

      for (const o of opps) {
        if (!oppMap.has(o.customerId)) oppMap.set(o.customerId, o.status);
      }
    } catch (err) {
      logger.error("[ADAPTER:accounts] fetchCommerceAccounts opportunity enrichment failed", { error: err });
    }
  }

  return rows.map((r) => {
    const oppStatus = oppMap.get(r.id);
    return {
      id: r.id,
      name: r.company ?? r.name,
      dealStage: oppStatus ? (COMMERCE_STAGE_MAP[oppStatus] ?? null) : null,
      activePilot: false,
      billingState: null,
      partnerSource: null,
      productFootprint: ["platform" as const],
      owner: null,
      lastActivityAt: r.updatedAt.toISOString(),
      healthScore: null,
      nextAction: null,
      currentBlocker: null,
    };
  });
}

async function fetchTradeAccounts(): Promise<Account[]> {
  const rows = await db
    .select({
      id: tradeParties.id,
      name: tradeParties.name,
      companyName: tradeParties.companyName,
      role: tradeParties.role,
      country: tradeParties.country,
      updatedAt: tradeParties.updatedAt,
    })
    .from(tradeParties)
    .orderBy(desc(tradeParties.updatedAt))
    .limit(200);

  // Enrich with latest trade deal stage per party
  const partyIds = rows.map((r) => r.id);
  const dealMap = new Map<string, string>();

  if (partyIds.length > 0) {
    try {
      const deals = await db
        .select({
          buyerPartyId: tradeDeals.buyerPartyId,
          stage: tradeDeals.stage,
        })
        .from(tradeDeals)
        .where(sql`${tradeDeals.buyerPartyId} = ANY(${partyIds})`)
        .orderBy(desc(tradeDeals.updatedAt));

      for (const d of deals) {
        if (!dealMap.has(d.buyerPartyId)) dealMap.set(d.buyerPartyId, d.stage);
      }
    } catch (err) {
      logger.error("[ADAPTER:accounts] fetchTradeAccounts deal stage enrichment failed", { error: err });
    }
  }

  return rows.map((r) => {
    const tradeStage = dealMap.get(r.id);
    return {
      id: r.id,
      name: r.companyName ?? r.name,
      dealStage: tradeStage ? (TRADE_STAGE_MAP[tradeStage] ?? null) : null,
      activePilot: false,
      billingState: null,
      partnerSource: null,
      productFootprint: ["trade" as Account["productFootprint"][number]],
      owner: null,
      lastActivityAt: r.updatedAt.toISOString(),
      healthScore: null,
      nextAction: null,
      currentBlocker: null,
    };
  });
}

export class DbAccountAdapter implements IAccountAdapter {
  async getAccounts(filters?: AccountFilters): Promise<Account[]> {
    const [commerce, trade] = await Promise.all([
      fetchCommerceAccounts().catch((err) => {
        logger.error("[ADAPTER:accounts] fetchCommerceAccounts failed", { error: err });
        return [] as Account[];
      }),
      fetchTradeAccounts().catch((err) => {
        logger.error("[ADAPTER:accounts] fetchTradeAccounts failed", { error: err });
        return [] as Account[];
      }),
    ]);

    let accounts = [...commerce, ...trade];

    if (filters?.stage) accounts = accounts.filter((a) => a.dealStage === filters.stage);
    if (filters?.owner) accounts = accounts.filter((a) => a.owner === filters.owner);
    if (filters?.hasActivePilot !== undefined) accounts = accounts.filter((a) => a.activePilot === filters.hasActivePilot);

    accounts.sort((a, b) => {
      const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return tb - ta;
    });

    return accounts;
  }

  async getAccountById(id: string): Promise<Account | null> {
    // Try commerce first, then trade — avoids full table scan
    try {
      const commerceRows = await db
        .select({ id: commerceCustomers.id, name: commerceCustomers.name, company: commerceCustomers.company, updatedAt: commerceCustomers.updatedAt })
        .from(commerceCustomers)
        .where(eq(commerceCustomers.id, id))
        .limit(1);
      if (commerceRows.length > 0) {
        const r = commerceRows[0];
        return {
          id: r.id, name: r.company ?? r.name, dealStage: null, activePilot: false,
          billingState: null, partnerSource: null, productFootprint: ["platform" as const],
          owner: null, lastActivityAt: r.updatedAt.toISOString(),
          healthScore: null, nextAction: null, currentBlocker: null,
        };
      }
    } catch (err) {
      logger.error("[ADAPTER:accounts] getAccountById commerce lookup failed", { error: err });
    }
    try {
      const tradeRows = await db
        .select({ id: tradeParties.id, name: tradeParties.name, companyName: tradeParties.companyName, updatedAt: tradeParties.updatedAt })
        .from(tradeParties)
        .where(eq(tradeParties.id, id))
        .limit(1);
      if (tradeRows.length > 0) {
        const r = tradeRows[0];
        return {
          id: r.id, name: r.companyName ?? r.name, dealStage: null, activePilot: false,
          billingState: null, partnerSource: null, productFootprint: ["trade" as Account["productFootprint"][number]],
          owner: null, lastActivityAt: r.updatedAt.toISOString(),
          healthScore: null, nextAction: null, currentBlocker: null,
        };
      }
    } catch (err) {
      logger.error("[ADAPTER:accounts] getAccountById trade lookup failed", { error: err });
    }
    return null;
  }

  async getAccountHealth(accountId: string): Promise<AccountHealth | null> {
    // Compute health by checking if account has active pilots and their checklist progress
    try {
      const pilots = await db
        .select()
        .from(dealEnginePilots)
        .where(eq(dealEnginePilots.accountId, accountId));

      if (pilots.length === 0) return null;

      const pilot = pilots[0]; // Use most relevant pilot
      const checklist = (pilot.checklist ?? {}) as Record<string, boolean>;
      const checklistKeys = ["dataReceived", "ingestionComplete", "demoDatasetReady", "userOnboardingComplete", "reviewMeetingScheduled", "conversionTriggered"];
      const completedChecks = checklistKeys.filter((k) => checklist[k]).length;
      const checklistProgress = completedChecks / checklistKeys.length;

      // Compute readiness score from pilot status + checklist
      const statusScores: Record<string, number> = {
        proposed: 10, setup: 20, active: 40, data_collection: 50,
        ingestion: 60, review: 75, converted: 100, cancelled: 0,
      };
      const statusScore = statusScores[pilot.pilotStatus] ?? 10;
      const readinessScore = Math.min(100, Math.round(statusScore * 0.6 + checklistProgress * 100 * 0.4));

      const migrationHealth = pilot.pilotStatus === "cancelled" ? "failed" as const
        : pilot.pilotStatus === "converted" ? "healthy" as const
        : checklist["ingestionComplete"] ? "healthy" as const
        : pilot.pilotStatus === "ingestion" || pilot.pilotStatus === "data_collection" ? "degraded" as const
        : "not_started" as const;

      const governancePosture = readinessScore >= 70 ? "compliant" as const
        : readinessScore >= 40 ? "partial" as const
        : "non_compliant" as const;

      const proofStatus = pilot.pilotStatus === "converted" ? "ready" as const
        : pilot.pilotStatus === "review" ? "in_progress" as const
        : "not_started" as const;

      // Find account name
      const account = await this.getAccountById(accountId);

      return {
        id: `health-${accountId}`,
        accountId,
        accountName: account?.name ?? pilot.accountName,
        pilotId: pilot.id,
        readinessScore,
        migrationHealth,
        ingestionSuccess: checklist["ingestionComplete"] ?? null,
        productUsageSummary: pilot.pilotStatus === "active" ? "Active pilot usage" : null,
        recommendationTrust: readinessScore >= 70 ? "high" : readinessScore >= 40 ? "medium" : "low",
        evidencePacksAvailable: completedChecks,
        governancePosture,
        proofStatus,
        lastActivityAt: pilot.updatedAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  /** Batch health computation — fetches all pilots in one query instead of N+1. */
  async getBulkAccountHealth(): Promise<AccountHealth[]> {
    try {
      const allPilots = await db.select().from(dealEnginePilots);
      if (allPilots.length === 0) return [];

      // Group by accountId, use first pilot per account
      const byAccount = new Map<string, typeof allPilots[0]>();
      for (const p of allPilots) {
        if (!byAccount.has(p.accountId)) byAccount.set(p.accountId, p);
      }

      const results: AccountHealth[] = [];
      for (const [accountId, pilot] of byAccount) {
        const checklist = (pilot.checklist ?? {}) as Record<string, boolean>;
        const checklistKeys = ["dataReceived", "ingestionComplete", "demoDatasetReady", "userOnboardingComplete", "reviewMeetingScheduled", "conversionTriggered"];
        const completedChecks = checklistKeys.filter((k) => checklist[k]).length;
        const checklistProgress = completedChecks / checklistKeys.length;

        const statusScores: Record<string, number> = {
          proposed: 10, setup: 20, active: 40, data_collection: 50,
          ingestion: 60, review: 75, converted: 100, cancelled: 0,
        };
        const statusScore = statusScores[pilot.pilotStatus] ?? 10;
        const readinessScore = Math.min(100, Math.round(statusScore * 0.6 + checklistProgress * 100 * 0.4));

        const migrationHealth = pilot.pilotStatus === "cancelled" ? "failed" as const
          : pilot.pilotStatus === "converted" ? "healthy" as const
          : checklist["ingestionComplete"] ? "healthy" as const
          : pilot.pilotStatus === "ingestion" || pilot.pilotStatus === "data_collection" ? "degraded" as const
          : "not_started" as const;

        const governancePosture = readinessScore >= 70 ? "compliant" as const
          : readinessScore >= 40 ? "partial" as const
          : "non_compliant" as const;

        const proofStatus = pilot.pilotStatus === "converted" ? "ready" as const
          : pilot.pilotStatus === "review" ? "in_progress" as const
          : "not_started" as const;

        results.push({
          id: `health-${accountId}`,
          accountId,
          accountName: pilot.accountName,
          pilotId: pilot.id,
          readinessScore,
          migrationHealth,
          ingestionSuccess: checklist["ingestionComplete"] ?? null,
          productUsageSummary: pilot.pilotStatus === "active" ? "Active pilot usage" : null,
          recommendationTrust: readinessScore >= 70 ? "high" : readinessScore >= 40 ? "medium" : "low",
          evidencePacksAvailable: completedChecks,
          governancePosture,
          proofStatus,
          lastActivityAt: pilot.updatedAt.toISOString(),
        });
      }
      return results;
    } catch (err) {
      logger.error("[ADAPTER:accounts] getBulkAccountHealth failed", { error: err });
      return [];
    }
  }
}
