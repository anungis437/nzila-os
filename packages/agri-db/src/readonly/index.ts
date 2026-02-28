/**
 * Read-Only Repository Layer for Agri DB
 *
 * This module re-exports ONLY the read (SELECT) functions from each repository.
 * Write functions (create*, update*, delete*, record*, save*) are excluded.
 *
 * Intelligence surfaces like Cora MUST import from this module (or via
 * `@nzila/agri-db/readonly`) to enforce the read-only contract.
 *
 * These functions accept `AgriReadContext` (which requires only `orgId`)
 * and cannot accept transaction (`tx`) objects.
 */
import type { AgriReadContext, PaginationOpts, PaginatedResult } from '../types'
export type { AgriReadContext, PaginationOpts, PaginatedResult } from '../types'

// ── Producers (read-only) ──────────────────────────────────────────────────

import { listProducers, getProducerById } from '../repositories/producers'
export { listProducers, getProducerById }

// ── Crops (read-only) ──────────────────────────────────────────────────────

import { listCrops, getCropById } from '../repositories/crops'
export { listCrops, getCropById }

// ── Harvests (read-only) ────────────────────────────────────────────────────

import { listHarvests, getHarvestById, getHarvestsByIds } from '../repositories/harvests'
export { listHarvests, getHarvestById, getHarvestsByIds }

// ── Lots (read-only) ───────────────────────────────────────────────────────

import { listLots, getLotById, getLotContributions } from '../repositories/lots'
export { listLots, getLotById, getLotContributions }

// ── Quality (read-only) ────────────────────────────────────────────────────

import { listInspections, getInspectionById } from '../repositories/quality'
export { listInspections, getInspectionById }

// ── Batches (read-only) ────────────────────────────────────────────────────

import { listBatches, getBatchById, getBatchAllocations } from '../repositories/batches'
export { listBatches, getBatchById, getBatchAllocations }

// ── Warehouses (read-only) ─────────────────────────────────────────────────

import { listWarehouses, getWarehouseById } from '../repositories/warehouses'
export { listWarehouses, getWarehouseById }

// ── Shipments (read-only) ──────────────────────────────────────────────────

import { listShipments, getShipmentById, getShipmentMilestones } from '../repositories/shipments'
export { listShipments, getShipmentById, getShipmentMilestones }

// ── Payments (read-only) ───────────────────────────────────────────────────

import { listPaymentPlans, getPaymentPlanById, listPayments } from '../repositories/payments'
export { listPaymentPlans, getPaymentPlanById, listPayments }

// ── Certifications (read-only) ─────────────────────────────────────────────

import { listCertifications, getCertificationById } from '../repositories/certifications'
export { listCertifications, getCertificationById }

// ── Traceability (read-only) ───────────────────────────────────────────────

import { listTraceabilityLinks, getFullChain } from '../repositories/traceability'
export { listTraceabilityLinks, getFullChain }

// ── Intelligence (read-only) ───────────────────────────────────────────────

import { listForecasts } from '../repositories/intelligence'
import { listPriceSignals } from '../repositories/intelligence'
import { listRiskScores } from '../repositories/intelligence'
export { listForecasts, listPriceSignals, listRiskScores }
