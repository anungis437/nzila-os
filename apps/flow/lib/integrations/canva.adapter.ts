/**
 * Canva Integration Adapter — Flow
 *
 * Manages design proof links and asset references for production workflows.
 * Canva API integration is stubbed until design automation is live.
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

// ── Adapter ────────────────────────────────────────────────────────────────

export function createCanvaAdapter(config: CanvaAdapterConfig) {
  return {
    /**
     * Create a new design from a brand template for a production job.
     */
    async createDesignFromTemplate(params: {
      templateId: string
      title: string
      variables?: Record<string, string>
    }): Promise<CanvaDesignRef> {
      return withSpan('canva.create_design', { templateId: params.templateId }, async () => {
        // Stub: Canva Connect API not yet integrated
        const now = new Date().toISOString()
        return {
          designId: `stub-${Date.now()}`,
          title: params.title,
          editUrl: `https://www.canva.com/design/stub/edit`,
          viewUrl: `https://www.canva.com/design/stub/view`,
          thumbnailUrl: null,
          createdAt: now,
          updatedAt: now,
        }
      })
    },

    /**
     * Get a design reference by ID.
     */
    async getDesign(designId: string): Promise<CanvaDesignRef | null> {
      return withSpan('canva.get_design', { designId }, async () => {
        // Stub: returns null until Canva API is wired
        return null
      })
    },

    /**
     * Export a design to a downloadable format (PDF/PNG) for proof approval.
     */
    async exportDesign(designId: string, format: 'pdf' | 'png' | 'jpg' = 'pdf'): Promise<CanvaExportResult> {
      return withSpan('canva.export_design', { designId, format }, async () => {
        // Stub: returns a placeholder export result
        return {
          exportId: `export-stub-${Date.now()}`,
          downloadUrl: '',
          format,
          status: 'failed' as const,
        }
      })
    },

    /**
     * Check if the Canva integration is configured and reachable.
     */
    async healthCheck(): Promise<{ configured: boolean; reachable: boolean }> {
      return {
        configured: Boolean(config.apiToken),
        reachable: false, // until Canva Connect API is wired
      }
    },
  }
}
