/**
 * ProposalAdapter — maps commerceQuotes + tradeQuotes into canonical Proposal objects.
 */
import "server-only";

import { logger } from "@/lib/telemetry";
import { db } from "@nzila/db";
import {
  commerceQuotes,
  commerceCustomers,
  tradeQuotes,
  tradeDeals,
  tradeParties,
} from "@nzila/db";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Proposal } from "@nzila/deal-engine/types";
import type { ProposalAdapter as IProposalAdapter, ProposalFilters } from "@nzila/deal-engine/adapters";

const COMMERCE_QUOTE_STATUS_MAP: Record<string, Proposal["status"]> = {
  draft: "draft",
  pricing: "draft",
  ready: "draft",
  sent: "sent",
  reviewing: "viewed",
  accepted: "accepted",
  declined: "rejected",
  revised: "draft",
  expired: "expired",
  cancelled: "rejected",
};

const TRADE_QUOTE_STATUS_MAP: Record<string, Proposal["status"]> = {
  draft: "draft",
  sent: "sent",
  accepted: "accepted",
  declined: "rejected",
  expired: "expired",
  revised: "draft",
};

async function fetchCommerceProposals(): Promise<Proposal[]> {
  const rows = await db
    .select({
      id: commerceQuotes.id,
      opportunityId: commerceQuotes.opportunityId,
      customerId: commerceQuotes.customerId,
      status: commerceQuotes.status,
      total: commerceQuotes.total,
      currency: commerceQuotes.currency,
      pricingTier: commerceQuotes.pricingTier,
      createdAt: commerceQuotes.createdAt,
      customerName: commerceCustomers.name,
      customerCompany: commerceCustomers.company,
    })
    .from(commerceQuotes)
    .leftJoin(commerceCustomers, eq(commerceQuotes.customerId, commerceCustomers.id))
    .orderBy(desc(commerceQuotes.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    dealId: r.opportunityId ?? "",
    accountName: r.customerCompany ?? r.customerName ?? "Unknown",
    quoteSource: "commerce",
    pricingModel: r.pricingTier,
    status: COMMERCE_QUOTE_STATUS_MAP[r.status] ?? "draft",
    amount: Number(r.total ?? 0),
    currency: r.currency ?? "CAD",
    pilotPackageIssued: false,
    conversionPricingReady: r.status === "accepted",
    generatedAt: r.createdAt.toISOString(),
  }));
}

async function fetchTradeProposals(): Promise<Proposal[]> {
  const buyerParty = alias(tradeParties, "buyer_p");

  const rows = await db
    .select({
      id: tradeQuotes.id,
      dealId: tradeQuotes.dealId,
      status: tradeQuotes.status,
      total: tradeQuotes.total,
      currency: tradeQuotes.currency,
      createdAt: tradeQuotes.createdAt,
      buyerName: buyerParty.name,
      buyerCompany: buyerParty.companyName,
    })
    .from(tradeQuotes)
    .leftJoin(tradeDeals, eq(tradeQuotes.dealId, tradeDeals.id))
    .leftJoin(buyerParty, eq(tradeDeals.buyerPartyId, buyerParty.id))
    .orderBy(desc(tradeQuotes.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    dealId: r.dealId,
    accountName: r.buyerCompany ?? r.buyerName ?? "Trade Quote",
    quoteSource: "trade",
    pricingModel: null,
    status: TRADE_QUOTE_STATUS_MAP[r.status] ?? "draft",
    amount: Number(r.total ?? 0),
    currency: r.currency ?? "CAD",
    pilotPackageIssued: false,
    conversionPricingReady: r.status === "accepted",
    generatedAt: r.createdAt.toISOString(),
  }));
}

export class DbProposalAdapter implements IProposalAdapter {
  async getProposals(filters?: ProposalFilters): Promise<Proposal[]> {
    const [commerce, trade] = await Promise.all([
      fetchCommerceProposals().catch((err) => {
        logger.error("[ADAPTER:proposals] fetchCommerceProposals failed", { error: err });
        return [] as Proposal[];
      }),
      fetchTradeProposals().catch((err) => {
        logger.error("[ADAPTER:proposals] fetchTradeProposals failed", { error: err });
        return [] as Proposal[];
      }),
    ]);

    let proposals = [...commerce, ...trade];

    if (filters?.dealId) proposals = proposals.filter((p) => p.dealId === filters.dealId);
    if (filters?.status) proposals = proposals.filter((p) => p.status === filters.status);

    proposals.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    return proposals;
  }
}
