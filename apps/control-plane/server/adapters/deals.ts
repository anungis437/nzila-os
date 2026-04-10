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
import { canTransition, mapPartnerStage } from "@nzila/deal-engine/lifecycle";
import type { DealStage } from "@nzila/deal-engine/lifecycle";
import type { Deal } from "@nzila/deal-engine/types";
import type { DealAdapter as IDealAdapter, DealFilters } from "@nzila/deal-engine/adapters";

// ── Stage mappings ──────────────────────────────────────

const COMMERCE_STAGE_MAP: Record<string, DealStage> = {
  lead: "lead",
  qualified: "qualified",
  proposal: "pilot_proposed",
  negotiation: "demo_completed",
  closed_won: "converted",
};

const TRADE_STAGE_MAP: Record<string, DealStage> = {
  lead: "lead",
  qualified: "qualified",
  quoted: "pilot_proposed",
  accepted: "demo_completed",
  funded: "converted",
  shipped: "expanding",
  delivered: "expanding",
  closed: "converted",
  cancelled: "lost",
};

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
      partnerName: String(meta.partnerName ?? null),
      product: "platform" as const,
      estimatedValue: Number(meta.estimatedArr ?? 0),
      currency: "CAD",
      contactName: String(meta.contactName ?? null),
      contactEmail: String(meta.contactEmail ?? null),
      nextAction: null,
      daysInStage: daysAgo(r.createdAt),
      conversionRisk: null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.createdAt.toISOString(),
    };
  });
}

// ── Adapter implementation ──────────────────────────────

export class DbDealAdapter implements IDealAdapter {
  async getDeals(filters?: DealFilters): Promise<Deal[]> {
    const [commerce, trade, partner] = await Promise.all([
      fetchCommerceDeals().catch(() => []),
      fetchTradeDeals().catch(() => []),
      fetchPartnerDeals().catch(() => []),
    ]);

    let deals = [...commerce, ...trade, ...partner];

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
    const deals = await this.getDeals();
    return deals.find((d) => d.id === id) ?? null;
  }

  async transitionStage(
    id: string,
    toStage: DealStage,
    _actor: string,
    _reason?: string,
  ): Promise<Deal | null> {
    const deal = await this.getDealById(id);
    if (!deal) return null;
    if (!canTransition(deal.stage, toStage)) return null;

    // Audit logging is handled by the mutation route via recordDealAudit()
    // Return the deal with updated stage
    return { ...deal, stage: toStage, updatedAt: new Date().toISOString() };
  }
}
