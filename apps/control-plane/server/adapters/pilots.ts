/**
 * PilotAdapter — DB-backed with real persistence for reads and mutations.
 *
 * Pilots are stored in the deal_engine_pilots table.
 * Falls back to seed data for initial population.
 */
import "server-only";

import { db } from "@nzila/db";
import { eq } from "drizzle-orm";
import { dealEnginePilots } from "./schemas";
import { seedPilots } from "@nzila/deal-engine/seed";
import { pilotSchema, pilotStatusSchema } from "@nzila/deal-engine/types";
import type { Pilot, PilotChecklist } from "@nzila/deal-engine/types";
import type { PilotAdapter as IPilotAdapter, PilotFilters } from "@nzila/deal-engine/adapters";
import { z } from "zod";

// ── Allowed pilot status transitions ────────────────────

const PILOT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  proposed: ["setup", "cancelled"],
  setup: ["active", "cancelled"],
  active: ["data_collection", "review", "cancelled"],
  data_collection: ["ingestion", "active", "cancelled"],
  ingestion: ["review", "data_collection", "cancelled"],
  review: ["converted", "active", "cancelled"],
  converted: [],
  cancelled: ["proposed"],
};

export function canTransitionPilotStatus(from: string, to: string): boolean {
  return PILOT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Row → domain mapper ─────────────────────────────────

function rowToPilot(row: typeof dealEnginePilots.$inferSelect): Pilot {
  return {
    id: row.id,
    dealId: row.dealId,
    accountId: row.accountId,
    accountName: row.accountName,
    product: row.product as Pilot["product"],
    pilotStatus: row.pilotStatus as Pilot["pilotStatus"],
    successCriteria: (row.successCriteria ?? []) as string[],
    startDate: row.startDate?.toISOString() ?? null,
    targetReviewDate: row.targetReviewDate?.toISOString() ?? null,
    owner: row.owner,
    ingestionStatus: row.ingestionStatus,
    checklist: (row.checklist ?? {
      dataReceived: false,
      ingestionComplete: false,
      demoDatasetReady: false,
      userOnboardingComplete: false,
      reviewMeetingScheduled: false,
      conversionTriggered: false,
    }) as PilotChecklist,
    currentBlockers: (row.currentBlockers ?? []) as string[],
    daysActive: row.daysActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Seed check / population ─────────────────────────────

let _seeded = false;

async function ensureSeeded(): Promise<void> {
  if (_seeded) return;
  _seeded = true;
  try {
    const existing = await db.select({ id: dealEnginePilots.id }).from(dealEnginePilots).limit(1);
    if (existing.length > 0) return;
    const parsed = z.array(pilotSchema).parse(seedPilots) as Pilot[];
    for (const p of parsed) {
      await db.insert(dealEnginePilots).values({
        id: p.id,
        dealId: p.dealId,
        accountId: p.accountId,
        accountName: p.accountName,
        product: p.product,
        pilotStatus: p.pilotStatus,
        successCriteria: p.successCriteria,
        startDate: p.startDate ? new Date(p.startDate) : null,
        targetReviewDate: p.targetReviewDate ? new Date(p.targetReviewDate) : null,
        owner: p.owner,
        ingestionStatus: p.ingestionStatus,
        checklist: p.checklist,
        currentBlockers: p.currentBlockers,
        daysActive: p.daysActive,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      });
    }
  } catch {
    _seeded = false;
  }
}

export class DbPilotAdapter implements IPilotAdapter {
  async getPilots(filters?: PilotFilters): Promise<Pilot[]> {
    await ensureSeeded();
    const rows = await db.select().from(dealEnginePilots);
    let pilots = rows.map(rowToPilot);

    if (filters?.status) pilots = pilots.filter((p) => p.pilotStatus === filters.status);
    if (filters?.product) pilots = pilots.filter((p) => p.product === filters.product);
    if (filters?.owner) pilots = pilots.filter((p) => p.owner === filters.owner);
    if (filters?.stalledOnly) pilots = pilots.filter((p) => p.daysActive > 14 && p.currentBlockers.length > 0);

    return pilots;
  }

  async getPilotById(id: string): Promise<Pilot | null> {
    await ensureSeeded();
    const rows = await db.select().from(dealEnginePilots).where(eq(dealEnginePilots.id, id));
    if (rows.length === 0) return null;
    return rowToPilot(rows[0]);
  }

  async updateChecklist(
    id: string,
    key: string,
    value: boolean,
    _actor: string,
  ): Promise<Pilot | null> {
    const pilot = await this.getPilotById(id);
    if (!pilot) return null;
    if (!(key in pilot.checklist)) return null;

    const newChecklist = { ...pilot.checklist, [key]: value };
    const now = new Date();
    await db
      .update(dealEnginePilots)
      .set({ checklist: newChecklist, updatedAt: now })
      .where(eq(dealEnginePilots.id, id));

    return { ...pilot, checklist: newChecklist as PilotChecklist, updatedAt: now.toISOString() };
  }

  async updateStatus(
    id: string,
    status: string,
    _actor: string,
  ): Promise<Pilot | null> {
    const pilot = await this.getPilotById(id);
    if (!pilot) return null;

    // Validate target status
    const parsed = pilotStatusSchema.safeParse(status);
    if (!parsed.success) return null;

    // Enforce lifecycle guard
    if (!canTransitionPilotStatus(pilot.pilotStatus, status)) return null;

    const now = new Date();
    await db
      .update(dealEnginePilots)
      .set({ pilotStatus: status, updatedAt: now })
      .where(eq(dealEnginePilots.id, id));

    return { ...pilot, pilotStatus: status as Pilot["pilotStatus"], updatedAt: now.toISOString() };
  }
}
