/**
 * Server-side data for platform metrics — unit economics & ESG.
 *
 * Follows the same seed-fallback pattern as data.ts.
 */
import "server-only";

import {
  computeUnitEconomics,
  seedUnitEconomics,
  computeNRRBreakdown,
  seedNRRBreakdown,
  type SaaSUnitEconomics,
  type NRRBreakdown,
} from "@nzila/platform-metrics";
import {
  computeESGScorecard,
  seedESGScorecard,
  type ESGScorecard,
} from "@nzila/platform-metrics";

// ── Unit Economics ──────────────────────────────────────

export async function getUnitEconomics(): Promise<SaaSUnitEconomics> {
  try {
    const live = await computeUnitEconomics();
    if (live.activeOrgCount > 0) return live;
  } catch { /* fall through to seed */ }
  return seedUnitEconomics();
}

export async function getNRRBreakdown(): Promise<NRRBreakdown> {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const live = await computeNRRBreakdown(start, now);
    if (live.startingMRR > 0) return live;
  } catch { /* fall through to seed */ }
  return seedNRRBreakdown();
}

// ── ESG & Impact ────────────────────────────────────────

export async function getESGScorecard(): Promise<ESGScorecard> {
  try {
    const live = await computeESGScorecard();
    if (live.activeOrgCount > 0) return live;
  } catch { /* fall through to seed */ }
  return seedESGScorecard();
}
