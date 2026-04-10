/**
 * DealAdapter — unifies commerceOpportunities + tradeDeals into canonical Deal objects.
 *
 * Reads from both commerce and trade systems in the shared DB, maps
 * their stages to the Deal Engine canonical lifecycle, and presents
 * a unified deal view.
 */
import "server-only";

import { db } from "@nzila/db";
import {
  commerceOpportunities,
  commerceCustomers,
  tradeDeals,
  tradeParties,
  auditLog,
} from "@nzila/db";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  canTransition,
  mapPartnerStage,
  COMMERCE_STAGE_MAP,
  TRADE_STAGE_MAP,
} from "@nzila/deal-engine/lifecycle";
import type { DealStage } from "@nzila/deal-engine/lifecycle";
import type { Deal } from "@nzila/deal-engine/types";
import type { DealAdapter as IDealAdapter, DealFilters } from "@nzila/deal-engine/adapters";

function daysAgo(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

// ── Commerce → Deal mapping ────────────────────────────

async function fetchCommerceDeals(): Promise<Deal[]> {
  const rows = await db
    .select({
      id: commerceOpportunities.id,
      customerId: commerceOpportunities.customerId,
      title: commerceOpportunities.title,
      estimatedValue: commerceOpportunities.estimatedValue,
      status: commerceOpportunities.status,
      customerName: commerceCustomers.name,
      customerCompany: commerceCustomers.company,
      createdAt: commerceOpportunities.createdAt,
      updatedAt: commerceOpportunities.updatedAt,
    })
    .from(commerceOpportunities)
    .leftJoin(commerceCustomers, eq(commerceOpportunities.customerId, commerceCustomers.id))
    .orderBy(desc(commerceOpportunities.updatedAt))
    .limit(200);

  return rows.map((r) => {
    const stage = COMMERCE_STAGE_MAP[r.status] ?? "lead";
    return {
      id: r.id,
      accountId: r.customerId,
      accountName: r.customerCompany ?? r.customerName ?? r.title,
      source: "internal" as const,
      stage,
      owner: "system",
      partnerId: null,
      partnerName: null,
      product: "platform" as const,
      estimatedValue: Number(r.estimatedValue ?? 0),
      currency: "CAD",
      contactName: r.customerName,
      contactEmail: null,
      nextAction: null,
      daysInStage: daysAgo(r.updatedAt),
      conversionRisk: daysAgo(r.updatedAt) > 30 ? "high" as const : daysAgo(r.updatedAt) > 14 ? "medium" as const : "low" as const,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

// ── Trade → Deal mapping ────────────────────────────────

async function fetchTradeDeals(): Promise<Deal[]> {
  const buyerParty = alias(tradeParties, "buyer_party");
  const sellerParty = alias(tradeParties, "seller_party");

  const rows = await db
    .select({
      id: tradeDeals.id,
      refNumber: tradeDeals.refNumber,
      stage: tradeDeals.stage,
      totalValue: tradeDeals.totalValue,
      currency: tradeDeals.currency,
      notes: tradeDeals.notes,
      buyerName: buyerParty.name,
      sellerName: sellerParty.name,
      buyerCompany: buyerParty.companyName,
      createdAt: tradeDeals.createdAt,
      updatedAt: tradeDeals.updatedAt,
    })
    .from(tradeDeals)
    .leftJoin(buyerParty, eq(tradeDeals.buyerPartyId, buyerParty.id))
    .leftJoin(sellerParty, eq(tradeDeals.sellerPartyId, sellerParty.id))
    .orderBy(desc(tradeDeals.updatedAt))
    .limit(200);

  return rows.map((r) => {
    const stage = TRADE_STAGE_MAP[r.stage] ?? "lead";
    return {
      id: r.id,
      accountId: null,
      accountName: r.buyerCompany ?? r.buyerName ?? `Trade ${r.refNumber}`,
      source: "internal" as const,
      stage,
      owner: "system",
      partnerId: null,
      partnerName: null,
      product: "trade" as Deal["product"],
      estimatedValue: Number(r.totalValue ?? 0),
      currency: r.currency ?? "CAD",
      contactName: r.buyerName,
      contactEmail: null,
      nextAction: r.notes,
      daysInStage: daysAgo(r.updatedAt),
      conversionRisk: daysAgo(r.updatedAt) > 30 ? "high" as const : daysAgo(r.updatedAt) > 14 ? "medium" as const : "low" as const,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

// ── Partner → Deal mapping (from audit_log) ─────────────

async function fetchPartnerDeals(): Promise<Deal[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityType, "deal"))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const partnerStage = String(meta.stage ?? "registered");
    const stage = mapPartnerStage(partnerStage);
    return {
      id: r.id,
      accountId: null,
      accountName: String(meta.accountName ?? "Partner Deal"),
      source: "partner" as const,
      stage,
      owner: r.actorId ?? "system",
      partnerId: String(meta.partnerId ?? ""),
      partnerName: meta.partnerName ? String(meta.partnerName) : null,
      product: "platform" as const,
      estimatedValue: Number(meta.estimatedArr ?? 0),
      currency: "CAD",
      contactName: meta.contactName ? String(meta.contactName) : null,
      contactEmail: meta.contactEmail ? String(meta.contactEmail) : null,
      nextAction: null,
      daysInStage: daysAgo(r.createdAt),
      conversionRisk: null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.createdAt.toISOString(),
    };
  });
}

// ── Dedup resolution ────────────────────────────────────

function normalizeAccountName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Dedup deals from multiple sources. Same real-world deal may appear
 * in commerce + partner audit log. Key: normalized accountName + product.
 * Keeps the richest record (most non-null fields) when duplicates found.
 */
function deduplicateDeals(deals: Deal[]): Deal[] {
  const groups = new Map<string, Deal[]>();
  for (const d of deals) {
    const key = `${normalizeAccountName(d.accountName)}::${d.product}`;
    const group = groups.get(key);
    if (group) {
      group.push(d);
    } else {
      groups.set(key, [d]);
    }
  }

  const result: Deal[] = [];
  for (const [key, group] of groups) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // Pick the richest record (most non-null fields, prefer internal over partner)
    const scored = group.map((d) => {
      let score = 0;
      if (d.accountId) score += 2;
      if (d.contactName) score++;
      if (d.contactEmail) score++;
      if (d.estimatedValue > 0) score++;
      if (d.source === "internal") score += 3;
      if (d.source === "partner") score += 1;
      return { deal: d, score };
    });
    scored.sort((a, b) => b.score - a.score);
    console.info("[ADAPTER:deals] dedup merged %d deals for key=%s", group.length, key);
    result.push(scored[0].deal);
  }
  return result;
}

// ── Reverse stage maps (canonical → source-specific) ────

/** Pick the first source-status that maps to a given canonical DealStage. */
function reverseMap(map: Record<string, DealStage>, canonical: DealStage): string | null {
  for (const [sourceStatus, mapped] of Object.entries(map)) {
    if (mapped === canonical) return sourceStatus;
  }
  return null;
}

// ── Adapter implementation ──────────────────────────────

export class DbDealAdapter implements IDealAdapter {
  async getDeals(filters?: DealFilters): Promise<Deal[]> {
    const [commerce, trade, partner] = await Promise.all([
      fetchCommerceDeals().catch((err) => {
        console.error("[ADAPTER:deals] fetchCommerceDeals failed", err);
        return [] as Deal[];
      }),
      fetchTradeDeals().catch((err) => {
        console.error("[ADAPTER:deals] fetchTradeDeals failed", err);
        return [] as Deal[];
      }),
      fetchPartnerDeals().catch((err) => {
        console.error("[ADAPTER:deals] fetchPartnerDeals failed", err);
        return [] as Deal[];
      }),
    ]);

    let deals = deduplicateDeals([...commerce, ...trade, ...partner]);

    // Apply filters
    if (filters?.source) deals = deals.filter((d) => d.source === filters.source);
    if (filters?.product) deals = deals.filter((d) => d.product === filters.product);
    if (filters?.owner) deals = deals.filter((d) => d.owner === filters.owner);
    if (filters?.stage) deals = deals.filter((d) => d.stage === filters.stage);
    if (filters?.stalledDays) deals = deals.filter((d) => d.daysInStage >= filters.stalledDays!);

    // Sort by most recently updated
    deals.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return deals;
  }

  async getDealById(id: string): Promise<Deal | null> {
    try {
      // Targeted lookups by ID across each source — avoids fetching all deals
      const [commerce, trade, partner] = await Promise.all([
        db
          .select({
            id: commerceOpportunities.id,
            customerId: commerceOpportunities.customerId,
            title: commerceOpportunities.title,
            estimatedValue: commerceOpportunities.estimatedValue,
            status: commerceOpportunities.status,
            customerName: commerceCustomers.name,
            customerCompany: commerceCustomers.company,
            createdAt: commerceOpportunities.createdAt,
            updatedAt: commerceOpportunities.updatedAt,
          })
          .from(commerceOpportunities)
          .leftJoin(commerceCustomers, eq(commerceOpportunities.customerId, commerceCustomers.id))
          .where(eq(commerceOpportunities.id, id))
          .limit(1)
          .catch(() => []),
        db
          .select({
            id: tradeDeals.id,
            refNumber: tradeDeals.refNumber,
            stage: tradeDeals.stage,
            totalValue: tradeDeals.totalValue,
            currency: tradeDeals.currency,
            notes: tradeDeals.notes,
            buyerName: sql<string>`null`.as("buyerName"),
            sellerName: sql<string>`null`.as("sellerName"),
            buyerCompany: sql<string>`null`.as("buyerCompany"),
            createdAt: tradeDeals.createdAt,
            updatedAt: tradeDeals.updatedAt,
          })
          .from(tradeDeals)
          .where(eq(tradeDeals.id, id))
          .limit(1)
          .catch(() => []),
        db
          .select()
          .from(auditLog)
          .where(eq(auditLog.id, id))
          .limit(1)
          .catch(() => []),
      ]);

      if (commerce.length > 0) {
        const r = commerce[0];
        const stage = COMMERCE_STAGE_MAP[r.status] ?? "lead";
        return {
          id: r.id, accountId: r.customerId,
          accountName: r.customerCompany ?? r.customerName ?? r.title,
          source: "internal", stage, owner: "system",
          partnerId: null, partnerName: null, product: "platform",
          estimatedValue: Number(r.estimatedValue ?? 0), currency: "CAD",
          contactName: r.customerName, contactEmail: null, nextAction: null,
          daysInStage: daysAgo(r.updatedAt),
          conversionRisk: daysAgo(r.updatedAt) > 30 ? "high" : daysAgo(r.updatedAt) > 14 ? "medium" : "low",
          createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        };
      }

      if (trade.length > 0) {
        const r = trade[0];
        const stage = TRADE_STAGE_MAP[r.stage] ?? "lead";
        return {
          id: r.id, accountId: null,
          accountName: r.buyerCompany ?? r.buyerName ?? `Trade ${r.refNumber}`,
          source: "internal", stage, owner: "system",
          partnerId: null, partnerName: null, product: "trade" as Deal["product"],
          estimatedValue: Number(r.totalValue ?? 0), currency: r.currency ?? "CAD",
          contactName: r.buyerName, contactEmail: null, nextAction: r.notes,
          daysInStage: daysAgo(r.updatedAt),
          conversionRisk: daysAgo(r.updatedAt) > 30 ? "high" : daysAgo(r.updatedAt) > 14 ? "medium" : "low",
          createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        };
      }

      if (partner.length > 0) {
        const r = partner[0];
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        const partnerStage = String(meta.stage ?? "registered");
        const stage = mapPartnerStage(partnerStage);
        return {
          id: r.id, accountId: null,
          accountName: String(meta.accountName ?? "Partner Deal"),
          source: "partner", stage, owner: r.actorId ?? "system",
          partnerId: String(meta.partnerId ?? ""),
          partnerName: meta.partnerName ? String(meta.partnerName) : null,
          product: "platform", estimatedValue: Number(meta.estimatedArr ?? 0), currency: "CAD",
          contactName: meta.contactName ? String(meta.contactName) : null,
          contactEmail: meta.contactEmail ? String(meta.contactEmail) : null,
          nextAction: null, daysInStage: daysAgo(r.createdAt), conversionRisk: null,
          createdAt: r.createdAt.toISOString(), updatedAt: r.createdAt.toISOString(),
        };
      }

      return null;
    } catch (err) {
      console.error("[ADAPTER:deals] getDealById failed", { id }, err);
      return null;
    }
  }

  async transitionStage(
    id: string,
    toStage: DealStage,
    _actor: string,
    _reason?: string,
  ): Promise<Deal | null> {
    try {
      const deal = await this.getDealById(id);
      if (!deal) return null;
      if (!canTransition(deal.stage, toStage)) return null;

      // Persist the stage change to the actual source table.
      // Trade deals have product set via type assertion ("trade" as Deal["product"])
      // so we cast to string for the runtime check.
      const now = new Date();
      const productStr = deal.product as string;
      if (productStr === "trade") {
        const tradeStatus = reverseMap(TRADE_STAGE_MAP, toStage);
        if (tradeStatus) {
          await db.execute(
            sql`UPDATE trade_deals SET stage = ${tradeStatus}, updated_at = ${now.toISOString()}::timestamptz WHERE id = ${id}`,
          );
        }
      } else {
        // Commerce opportunity
        const commerceStatus = reverseMap(COMMERCE_STAGE_MAP, toStage);
        if (commerceStatus) {
          await db.execute(
            sql`UPDATE commerce_opportunities SET status = ${commerceStatus}, updated_at = ${now.toISOString()}::timestamptz WHERE id = ${id}`,
          );
        }
      }

      return { ...deal, stage: toStage, updatedAt: now.toISOString() };
    } catch (err) {
      console.error("[ADAPTER:deals] transitionStage failed", { id, toStage }, err);
      return null;
    }
  }
}
