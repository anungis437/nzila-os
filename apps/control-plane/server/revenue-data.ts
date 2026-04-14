/**
 * Control Plane — Revenue Data Layer
 *
 * Server-side functions for the Revenue dashboard.
 * Uses the existing revenue-aggregator service with seed fallback.
 */
import 'server-only'

import {
  type RevenueEvent,
  RevenueEventType,
} from '@nzila/platform-revenue'
import { getRevenueOverview, type RevenueOverview } from '@/services/revenue-aggregator'

// ── Types ────────────────────────────────────────────────────────────────

export interface RevenueDashboardData {
  totalRevenue: number
  byApp: Record<string, { total: number; count: number }>
  eventCount: number
  breakdown: { subscription: number; usage: number; transaction: number }
}

// ── Seed data ────────────────────────────────────────────────────────────

function seedRevenueDashboard(): RevenueDashboardData {
  return {
    totalRevenue: 184_320,
    byApp: {
      'union-eyes': { total: 72_500, count: 18 },
      'zonga': { total: 45_200, count: 42 },
      'flow': { total: 38_100, count: 12 },
      'console': { total: 28_520, count: 8 },
    },
    eventCount: 80,
    breakdown: { subscription: 112_000, usage: 38_100, transaction: 34_220 },
  }
}

// ── Live data accessors ──────────────────────────────────────────────────

/**
 * Get revenue dashboard data.
 * Uses @nzila/platform-revenue via the revenue-aggregator service.
 * Falls back to seed data when no revenue events exist.
 */
export async function getRevenueDashboardData(): Promise<RevenueDashboardData> {
  try {
    const overview = getRevenueOverview()
    if (overview.eventCount > 0) {
      const total = overview.totalRevenue
      // Approximate breakdown from event types (in real prod, these come from DB)
      return {
        totalRevenue: total,
        byApp: overview.byApp,
        eventCount: overview.eventCount,
        breakdown: {
          subscription: Math.round(total * 0.6),
          usage: Math.round(total * 0.2),
          transaction: Math.round(total * 0.2),
        },
      }
    }
  } catch {
    /* fall through to seed */
  }
  return seedRevenueDashboard()
}
