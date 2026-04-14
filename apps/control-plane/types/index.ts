import { z } from "zod";

// ── Shared API envelope ─────────────────────────────────

export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    ok: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    generatedAt: z.string().datetime(),
  });

export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  generatedAt: string;
};

// ── Module definition ───────────────────────────────────

export type ModuleHealth = "healthy" | "degraded" | "offline" | "unknown";

export interface ModuleStatus {
  id: string;
  name: string;
  description: string;
  health: ModuleHealth;
  version: string;
  orgAvailability: string[];
  hasEvidenceExport: boolean;
  hasGovernanceIntegration: boolean;
  hasTelemetryIntegration: boolean;
  lastActivity: string;
  lastActivitySummary: string;
}

export const moduleStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  health: z.enum(["healthy", "degraded", "offline", "unknown"]),
  version: z.string(),
  orgAvailability: z.array(z.string()),
  hasEvidenceExport: z.boolean(),
  hasGovernanceIntegration: z.boolean(),
  hasTelemetryIntegration: z.boolean(),
  lastActivity: z.string().datetime(),
  lastActivitySummary: z.string(),
});

// ── Overview summary ────────────────────────────────────

export interface OverviewSummary {
  platformHealthy: boolean;
  governanceCompliant: boolean;
  intelligenceActive: boolean;
  activeAnomalies: number;
  totalModules: number;
  healthyModules: number;
  procurementPackReady: boolean;
  generatedAt: string;
}

export const overviewSummarySchema = z.object({
  platformHealthy: z.boolean(),
  governanceCompliant: z.boolean(),
  intelligenceActive: z.boolean(),
  activeAnomalies: z.number().int().min(0),
  totalModules: z.number().int().min(0),
  healthyModules: z.number().int().min(0),
  procurementPackReady: z.boolean(),
  generatedAt: z.string().datetime(),
});

// ── Procurement summary ─────────────────────────────────

export interface ProcurementSummary {
  packId: string;
  manifestHash: string;
  signatureStatus: "verified" | "failed" | "unsigned";
  sbomRef: string;
  attestationStatus: "valid" | "expired" | "missing";
  createdAt: string;
  evidence_verified?: number;
  evidence_total?: number;
  last_verified_at?: string;
}

export const procurementSummarySchema = z.object({
  packId: z.string(),
  manifestHash: z.string(),
  signatureStatus: z.enum(["verified", "failed", "unsigned"]),
  sbomRef: z.string(),
  attestationStatus: z.enum(["valid", "expired", "missing"]),
  createdAt: z.string().datetime(),
  evidence_verified: z.number().optional(),
  evidence_total: z.number().optional(),
  last_verified_at: z.string().datetime().optional(),
});
