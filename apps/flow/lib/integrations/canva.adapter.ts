/**
 * Canva Integration Adapter — Flow
 *
 * Adapter for design proof links and asset references.
 *
 * Production status: NOT WIRED. The Canva Connect API client has not yet
 * been implemented in this repo. All adapter methods fail fast with a
 * clear error so callers (and the side-effect dispatcher) see an honest
 * failure rather than silently receiving fake design IDs or empty exports.
 *
 * To complete this integration:
 *   1. Add a Canva Connect API client (POST /v1/designs, POST /v1/exports).
 *   2. Implement the methods below using that client.
 *   3. Remove the `CanvaNotImplementedError` throws.
 */
import { withSpan } from '@nzila/os-core/telemetry'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CanvaDesignRef {
  designId: string
  title: string
  editUrl: string
  viewUrl: string
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface CanvaExportResult {
  exportId: string
  downloadUrl: string
  format: 'pdf' | 'png' | 'jpg'
  status: 'completed' | 'failed'
}

export interface CanvaAdapterConfig {
  apiToken: string
  brandTemplateId?: string
}

class CanvaNotImplementedError extends Error {
  constructor(method: string) {
    super(
      `Canva Connect API not implemented — ${method}() is not available. ` +
        `Wire the Canva Connect REST client before enabling CANVA_API_KEY in this environment.`,
    )
    this.name = 'CanvaNotImplementedError'
  }
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createCanvaAdapter(config: CanvaAdapterConfig) {
  return {
    /**
     * Create a new design from a brand template for a production job.
     * Throws until the Canva Connect API client is wired.
     */
    async createDesignFromTemplate(params: {
      templateId: string
      title: string
      variables?: Record<string, string>
    }): Promise<CanvaDesignRef> {
      return withSpan('canva.create_design', { templateId: params.templateId }, async () => {
        throw new CanvaNotImplementedError('createDesignFromTemplate')
      })
    },

    /**
     * Get a design reference by ID.
     * Throws until the Canva Connect API client is wired.
     */
    async getDesign(designId: string): Promise<CanvaDesignRef | null> {
      return withSpan('canva.get_design', { designId }, async () => {
        throw new CanvaNotImplementedError('getDesign')
      })
    },

    /**
     * Export a design to a downloadable format (PDF/PNG) for proof approval.
     * Throws until the Canva Connect API client is wired.
     */
    async exportDesign(
      designId: string,
      format: 'pdf' | 'png' | 'jpg' = 'pdf',
    ): Promise<CanvaExportResult> {
      return withSpan('canva.export_design', { designId, format }, async () => {
        throw new CanvaNotImplementedError('exportDesign')
      })
    },

    /**
     * Check if the Canva integration is configured and reachable.
     * Always reports `reachable: false` until the API client is wired.
     */
    async healthCheck(): Promise<{ configured: boolean; reachable: boolean }> {
      return {
        configured: Boolean(config.apiToken),
        reachable: false,
      }
    },
  }
}
