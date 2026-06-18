/**
 * PartnerReferralAdapter — maps partner deals from audit_log + trade commissions.
 */
import "server-only";

import { logger } from "@/lib/telemetry";
import { db } from "@nzila/db";
import { auditLog, tradeCommissions, tradeParties } from "@nzila/db";
import { desc, eq } from "drizzle-orm";
import type { PartnerReferral } from "@nzila/deal-engine/types";
import type {
  PartnerReferralAdapter as IPartnerReferralAdapter,
  PartnerFilters,
  PartnerStats,
} from "@nzila/deal-engine/adapters";

async function fetchPartnerReferrals(): Promise<PartnerReferral[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityType, "deal"))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const stage = String(meta.stage ?? "registered");

    const statusMap: Record<string, PartnerReferral["referralStatus"]> = {
      registered: "registered",
      submitted: "qualified",
      approved: "qualified",
      won: "converted",
      lost: "expired",
    };

    return {
      id: r.id,
      partnerId: String(meta.partnerId ?? "unknown"),
      partnerName: String(meta.partnerName ?? "Unknown Partner"),
      dealId: String(meta.dealId ?? r.id),
      accountName: String(meta.accountName ?? "Unknown"),
      referralStatus: statusMap[stage] ?? "registered",
      commissionStatus: stage === "won" ? "earned" as const : "pending" as const,
      commissionAmount: Number(meta.commissionAmount ?? 0),
      referredAt: r.createdAt.toISOString(),
    };
  });
}

async function fetchTradeCommissionReferrals(): Promise<PartnerReferral[]> {
  const rows = await db
    .select({
      id: tradeCommissions.id,
      dealId: tradeCommissions.dealId,
      partyId: tradeCommissions.partyId,
      calculatedAmount: tradeCommissions.calculatedAmount,
      currency: tradeCommissions.currency,
      status: tradeCommissions.status,
      createdAt: tradeCommissions.createdAt,
      partyName: tradeParties.name,
      partyCompany: tradeParties.companyName,
    })
    .from(tradeCommissions)
    .leftJoin(tradeParties, eq(tradeCommissions.partyId, tradeParties.id))
    .orderBy(desc(tradeCommissions.createdAt))
    .limit(100);

  return rows.map((r) => {
    const commStatusMap: Record<string, PartnerReferral["commissionStatus"]> = {
      pending: "pending",
      previewed: "pending",
      finalized: "earned",
      paid: "paid",
      cancelled: "cancelled",
    };

    return {
      id: r.id,
      partnerId: r.partyId,
      partnerName: r.partyCompany ?? r.partyName ?? "Trade Partner",
      dealId: r.dealId,
      accountName: r.partyCompany ?? "Trade Account",
      referralStatus: "converted" as const,
      commissionStatus: commStatusMap[r.status] ?? "pending",
      commissionAmount: Number(r.calculatedAmount ?? 0),
      referredAt: r.createdAt.toISOString(),
    };
  });
}

export class DbPartnerReferralAdapter implements IPartnerReferralAdapter {
  async getReferrals(filters?: PartnerFilters): Promise<PartnerReferral[]> {
    const [partnerDeals, tradeRefs] = await Promise.all([
      fetchPartnerReferrals().catch((err) => {
        logger.error("[ADAPTER:partners] fetchPartnerReferrals failed", { error: err });
        return [] as PartnerReferral[];
      }),
      fetchTradeCommissionReferrals().catch((err) => {
        logger.error("[ADAPTER:partners] fetchTradeCommissionReferrals failed", { error: err });
        return [] as PartnerReferral[];
      }),
    ]);

    let referrals = [...partnerDeals, ...tradeRefs];

    if (filters?.partnerId) referrals = referrals.filter((r) => r.partnerId === filters.partnerId);
    if (filters?.status) referrals = referrals.filter((r) => r.referralStatus === filters.status);

    referrals.sort((a, b) => new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime());

    return referrals;
  }

  async getPartnerStats(): Promise<PartnerStats> {
    const refs = await this.getReferrals();
    const converted = refs.filter((r) => r.referralStatus === "converted").length;
    const earned = refs
      .filter((r) => r.commissionStatus === "earned" || r.commissionStatus === "paid")
      .reduce((s, r) => s + (r.commissionAmount ?? 0), 0);
    const paid = refs
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
      .map(([id, { name, dealCount, totalValue }]) => ({
        partnerId: id,
        partnerName: name,
        dealCount,
        totalValue,
      }));

    return {
      totalReferrals: refs.length,
      convertedReferrals: converted,
      totalCommissionsEarned: earned,
      totalCommissionsPaid: paid,
      topPartners,
    };
  }
}
