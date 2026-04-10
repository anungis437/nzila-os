/**
 * FollowUpAdapter — DB-backed with real persistence for reads and mutations.
 *
 * Follow-ups are stored in the deal_engine_follow_ups table.
 * Falls back to seed data for initial population.
 */
import "server-only";

import { db } from "@nzila/db";
import { eq } from "drizzle-orm";
import { dealEngineFollowUps } from "./schemas";
import { seedFollowUps } from "@nzila/deal-engine/seed";
import { followUpSchema } from "@nzila/deal-engine/types";
import type { FollowUp } from "@nzila/deal-engine/types";
import type { FollowUpAdapter as IFollowUpAdapter, FollowUpFilters } from "@nzila/deal-engine/adapters";
import { z } from "zod";

// ── Row → domain mapper ─────────────────────────────────

function rowToFollowUp(row: typeof dealEngineFollowUps.$inferSelect): FollowUp {
  return {
    id: row.id,
    dealId: row.dealId ?? null,
    pilotId: row.pilotId ?? null,
    accountName: row.accountName,
    title: row.title,
    description: row.description ?? null,
    owner: row.owner,
    priority: row.priority as FollowUp["priority"],
    dueDate: row.dueDate.toISOString(),
    isOverdue: row.isOverdue,
    completedAt: row.completedAt?.toISOString() ?? null,
    trigger: row.trigger,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Seed check / population ─────────────────────────────

let _seeded = false;

async function ensureSeeded(): Promise<void> {
  if (_seeded) return;
  _seeded = true;
  try {
    const existing = await db.select({ id: dealEngineFollowUps.id }).from(dealEngineFollowUps).limit(1);
    if (existing.length > 0) return;
    const parsed = z.array(followUpSchema).parse(seedFollowUps) as FollowUp[];
    if (parsed.length > 0) {
      await db.insert(dealEngineFollowUps).values(
        parsed.map((f) => ({
          id: f.id,
          dealId: f.dealId,
          pilotId: f.pilotId,
          accountName: f.accountName,
          title: f.title,
          description: f.description,
          owner: f.owner,
          priority: f.priority,
          dueDate: new Date(f.dueDate),
          isOverdue: f.isOverdue,
          completedAt: f.completedAt ? new Date(f.completedAt) : null,
          trigger: f.trigger,
          createdAt: new Date(f.createdAt),
        })),
      );
    }
  } catch (err) {
    console.error("[ADAPTER:follow-ups] seed failed", err);
    _seeded = false;
  }
}

export class DbFollowUpAdapter implements IFollowUpAdapter {
  async getFollowUps(filters?: FollowUpFilters): Promise<FollowUp[]> {
    try {
      await ensureSeeded();
      const rows = await db.select().from(dealEngineFollowUps);
      let followUps = rows.map(rowToFollowUp);

      if (filters?.owner) followUps = followUps.filter((f) => f.owner === filters.owner);
      if (filters?.priority) followUps = followUps.filter((f) => f.priority === filters.priority);
      if (filters?.overdueOnly) followUps = followUps.filter((f) => f.isOverdue);
      if (filters?.dealId) followUps = followUps.filter((f) => f.dealId === filters.dealId);
      if (filters?.pilotId) followUps = followUps.filter((f) => f.pilotId === filters.pilotId);

      return followUps;
    } catch (err) {
      console.error("[ADAPTER:follow-ups] getFollowUps failed", err);
      return [];
    }
  }

  async complete(id: string, _actor: string): Promise<FollowUp | null> {
    try {
      await ensureSeeded();
      const rows = await db.select().from(dealEngineFollowUps).where(eq(dealEngineFollowUps.id, id));
      if (rows.length === 0) return null;

      const now = new Date();
      await db
        .update(dealEngineFollowUps)
        .set({ completedAt: now, isOverdue: false })
        .where(eq(dealEngineFollowUps.id, id));

      const followUp = rowToFollowUp(rows[0]);
      return { ...followUp, completedAt: now.toISOString(), isOverdue: false };
    } catch (err) {
      console.error("[ADAPTER:follow-ups] complete failed", { id }, err);
      return null;
    }
  }

  async snooze(id: string, newDueDate: string, _actor: string): Promise<FollowUp | null> {
    try {
      await ensureSeeded();
      const rows = await db.select().from(dealEngineFollowUps).where(eq(dealEngineFollowUps.id, id));
      if (rows.length === 0) return null;

      const due = new Date(newDueDate);
      const overdue = due < new Date();
      await db
        .update(dealEngineFollowUps)
        .set({ dueDate: due, isOverdue: overdue })
        .where(eq(dealEngineFollowUps.id, id));

      const followUp = rowToFollowUp(rows[0]);
      return { ...followUp, dueDate: due.toISOString(), isOverdue: overdue };
    } catch (err) {
      console.error("[ADAPTER:follow-ups] snooze failed", { id }, err);
      return null;
    }
  }

  async reassign(id: string, newOwner: string, _actor: string): Promise<FollowUp | null> {
    try {
      await ensureSeeded();
      const rows = await db.select().from(dealEngineFollowUps).where(eq(dealEngineFollowUps.id, id));
      if (rows.length === 0) return null;

      await db
        .update(dealEngineFollowUps)
        .set({ owner: newOwner })
        .where(eq(dealEngineFollowUps.id, id));

      const followUp = rowToFollowUp(rows[0]);
      return { ...followUp, owner: newOwner };
    } catch (err) {
      console.error("[ADAPTER:follow-ups] reassign failed", { id }, err);
      return null;
    }
  }
}
