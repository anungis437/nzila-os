/**
 * CBA Intelligence — Ingestion Adapter Interface
 *
 * Each public CBA data source gets an adapter that knows how to:
 *  1. Discover available documents from the source
 *  2. Fetch raw content for a single document
 *
 * Adapters MUST be stateless and side-effect-free (no DB writes).
 * The ingestion orchestrator handles persistence.
 */

export interface DiscoveredDocument {
  /** Unique identifier within the source (e.g. URL path, document ID) */
  sourceDocId: string;
  /** Title (English) if available */
  title?: string;
  /** Document type hint */
  documentType?: string;
  /** Source URL for the document */
  sourceUrl: string;
  /** Detected language: "en" | "fr" | "bilingual" */
  language?: string;
  /** Published / last modified date from source metadata */
  publishedAt?: string;
  /** Jurisdiction code (e.g. "CA-QC", "CA-ON", "CA-FED") */
  jurisdiction?: string;
  /** Sector (e.g. "public", "healthcare", "construction") */
  sector?: string;
}

export interface FetchedContent {
  /** Raw content (HTML, PDF bytes as base64, plain text, etc.) */
  rawContent: string;
  /** MIME type */
  contentType: string;
  /** Estimated page count, if applicable */
  pageCount?: number;
  /** Word count of the raw textual content */
  wordCount?: number;
  /** Additional metadata from the fetch */
  metadata?: Record<string, unknown>;
}

export interface IngestionAdapter {
  /** Unique key matching `adapterKey` in the source registry */
  readonly key: string;

  /** Human-readable name */
  readonly name: string;

  /** Semantic version of the adapter implementation */
  readonly version: string;

  /**
   * Discover documents available from the source.
   * @param config Source-specific configuration (from source registry)
   * @returns List of discovered documents
   */
  discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]>;

  /**
   * Fetch the raw content for a single document.
   * @param sourceUrl URL to fetch
   * @param config Source-specific configuration
   * @returns Fetched content with metadata
   */
  fetch(sourceUrl: string, config: Record<string, unknown>): Promise<FetchedContent>;
}

export const ADAPTER_TYPES_VERSION = "1.0.0";
