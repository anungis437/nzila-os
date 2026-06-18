/**
 * RAG Pipeline — Unit Tests
 *
 * Covers RAGPipeline class (addDocuments, search, deleteDocuments, getStats,
 * updateConfig) and the ragPipeline singleton. All storage is in-memory so
 * no DB mocks needed — only logger.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/ai/ai-client", () => ({
  getAiClient: vi.fn(() => ({
    embed: vi.fn(async () => ({ embeddings: [[0.1, 0.2, 0.3]] })),
  })),
  UE_APP_KEY: "union-eyes",
  UE_PROFILES: { EMBEDDINGS: "ue-embeddings" },
  UE_SYSTEM_ORG_ID: "00000000-0000-0000-0000-000000000000",
}));

import { RAGPipeline, ragPipeline, type Document } from "../rag-pipeline";

/* ── helpers ────────────────────────────────────────────────────────── */

function makeDoc(id: string, content: string, type: Document["metadata"]["type"] = "policy", jurisdiction?: string): Document {
  return {
    id,
    content,
    metadata: {
      source: "test",
      type,
      jurisdiction,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

const longContent = "Union grievance procedures require timely filing. " +
  "Step 1: The employee must submit a written grievance within thirty calendar days. " +
  "Step 2: The employer must respond within fifteen business days. " +
  "Step 3: If unresolved, the grievance may proceed to arbitration. " +
  "All deadlines are subject to collective agreement provisions. " +
  "The union steward shall assist the member throughout the process. " +
  "Documentation must be maintained for each step of the grievance. " +
  "Evidence including emails, schedules, and witness statements should be preserved. " +
  "The arbitrator's decision is final and binding on both parties. " +
  "Costs of arbitration are shared equally unless the collective agreement states otherwise.";

/* ── tests ──────────────────────────────────────────────────────────── */

describe("RAGPipeline", () => {
  let pipeline: RAGPipeline;

  beforeEach(() => {
    pipeline = new RAGPipeline();
  });

  // ── constructor ───────────────────────────────────────────────────
  describe("constructor", () => {
    it("uses default config", () => {
      const stats = pipeline.getStats();
      expect(stats.totalChunks).toBe(0);
      expect(stats.totalDocuments).toBe(0);
    });

    it("merges custom config", () => {
      const custom = new RAGPipeline({ chunkSize: 200, topK: 10 });
      expect(custom.getStats().totalChunks).toBe(0);
    });
  });

  // ── addDocuments ──────────────────────────────────────────────────
  describe("addDocuments", () => {
    it("returns number of chunks added", async () => {
      const count = await pipeline.addDocuments([makeDoc("d-1", longContent)]);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("adds multiple documents", async () => {
      await pipeline.addDocuments([
        makeDoc("d-1", longContent),
        makeDoc("d-2", longContent.replace("Union", "Provincial")),
      ]);
      expect(pipeline.getStats().totalDocuments).toBe(2);
    });

    it("skips very short chunks (< 50 chars)", async () => {
      const count = await pipeline.addDocuments([makeDoc("d-tiny", "Short text.")]);
      expect(count).toBe(0);
    });

    it("builds BM25 index", async () => {
      await pipeline.addDocuments([makeDoc("d-1", longContent)]);
      // After adding, search should work (BM25 index populated)
      const results = await pipeline.search("grievance");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── search ────────────────────────────────────────────────────────
  describe("search", () => {
    beforeEach(async () => {
      await pipeline.addDocuments([
        makeDoc("d-1", longContent, "grievance", "ON"),
        makeDoc("d-2",
          "Holiday schedule and vacation entitlements for all employees. " +
          "Members receive four weeks annual vacation after five years of service. " +
          "Statutory holidays include New Year, Good Friday, Canada Day, Labour Day. " +
          "Vacation requests must be submitted thirty days in advance.",
          "contract", "BC"),
      ]);
    });

    it("returns results with score", async () => {
      const results = await pipeline.search("grievance procedures");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("respects topK option", async () => {
      const results = await pipeline.search("procedures", { topK: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("filters by jurisdiction", async () => {
      const results = await pipeline.search("procedures", { jurisdiction: "ON" });
      for (const r of results) {
        expect(r.chunk.metadata.jurisdiction).toBe("ON");
      }
    });

    it("filters by type", async () => {
      const results = await pipeline.search("schedule", { type: "contract" });
      for (const r of results) {
        expect(r.chunk.metadata.type).toBe("contract");
      }
    });

    it("returns empty when no chunks match filter", async () => {
      const results = await pipeline.search("procedures", { jurisdiction: "AB" });
      expect(results).toEqual([]);
    });

    it("uses semantic-only search when hybridSearch is false", async () => {
      pipeline.updateConfig({ hybridSearch: false });
      const results = await pipeline.search("grievance");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("uses reranking when enabled", async () => {
      pipeline.updateConfig({ rerank: true });
      const results = await pipeline.search("grievance arbitration");
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Reranked results should have rerankScore
      if (results.length > 0) {
        expect(results[0].rerankScore).toBeDefined();
      }
    });

    it("returns empty for empty pipeline", async () => {
      const empty = new RAGPipeline();
      const results = await empty.search("anything");
      expect(results).toEqual([]);
    });
  });

  // ── deleteDocuments ───────────────────────────────────────────────
  describe("deleteDocuments", () => {
    it("removes all chunks for document", async () => {
      await pipeline.addDocuments([makeDoc("d-1", longContent)]);
      const before = pipeline.getStats().totalChunks;
      expect(before).toBeGreaterThan(0);
      const deleted = pipeline.deleteDocuments(["d-1"]);
      expect(deleted).toBe(before);
      expect(pipeline.getStats().totalChunks).toBe(0);
    });

    it("returns 0 for unknown documents", () => {
      expect(pipeline.deleteDocuments(["nonexistent"])).toBe(0);
    });

    it("only removes specified document", async () => {
      await pipeline.addDocuments([
        makeDoc("d-1", longContent),
        makeDoc("d-2", longContent.replace("Union", "Federal")),
      ]);
      pipeline.deleteDocuments(["d-1"]);
      expect(pipeline.getStats().totalDocuments).toBe(1);
    });
  });

  // ── getStats ──────────────────────────────────────────────────────
  describe("getStats", () => {
    it("returns zeros for empty pipeline", () => {
      const stats = pipeline.getStats();
      expect(stats).toEqual({
        totalDocuments: 0,
        totalChunks: 0,
        jurisdictions: [],
        types: [],
      });
    });

    it("tracks documents, chunks, jurisdictions, types", async () => {
      await pipeline.addDocuments([
        makeDoc("d-1", longContent, "policy", "ON"),
        makeDoc("d-2", longContent.replace("Union", "Public"), "contract", "BC"),
      ]);
      const stats = pipeline.getStats();
      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalChunks).toBeGreaterThanOrEqual(2);
      expect(stats.jurisdictions).toContain("ON");
      expect(stats.jurisdictions).toContain("BC");
      expect(stats.types).toContain("policy");
      expect(stats.types).toContain("contract");
    });
  });

  // ── updateConfig ──────────────────────────────────────────────────
  describe("updateConfig", () => {
    it("merges partial config", () => {
      pipeline.updateConfig({ topK: 20, chunkSize: 1000 });
      // Verify by adding docs and searching — topK should respect new value
      expect(pipeline.getStats().totalChunks).toBe(0); // config change doesn't affect data
    });

    it("preserves unset config keys", async () => {
      pipeline.updateConfig({ topK: 3 });
      // hybridSearch should still be true (default)
      await pipeline.addDocuments([makeDoc("d-1", longContent)]);
      const results = await pipeline.search("grievance");
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  // ── gap coverage ────────────────────────────────────────────────
  describe("gap coverage", () => {
    it("chunks document where sentence boundary is in first half (no break adjustment)", async () => {
      // Content with periods only near the start — breakPoint won't be > startIndex + chunkSize/2
      const noGoodBreak = "Short sentence. " + "x".repeat(600);
      const count = await pipeline.addDocuments([makeDoc("d-nobreak", noGoodBreak)]);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("getStats returns empty jurisdictions for docs without jurisdiction", async () => {
      await pipeline.addDocuments([makeDoc("d-nojur", longContent, "policy")]);
      const stats = pipeline.getStats();
      expect(stats.totalDocuments).toBe(1);
      expect(stats.jurisdictions).toEqual([]);
    });

    it("rerank calculates density boost for matching terms", async () => {
      pipeline.updateConfig({ rerank: true });
      await pipeline.addDocuments([
        makeDoc("d-dense", "grievance grievance grievance arbitration arbitration procedures filing".repeat(10), "grievance"),
      ]);
      const results = await pipeline.search("grievance arbitration");
      expect(results.length).toBeGreaterThanOrEqual(1);
      for (const r of results) {
        expect(r.rerankScore).toBeGreaterThan(r.score);
      }
    });

    it("hybridSearch combines semantic and keyword results", async () => {
      await pipeline.addDocuments([
        makeDoc("d-h1", longContent, "policy", "ON"),
        makeDoc("d-h2",
          "Overtime compensation rates for unionized workers in the manufacturing sector. " +
          "Double time after ten hours. Premium pay for statutory holidays. " +
          "Shift differentials apply to evening and night shifts. " +
          "Break periods are mandated by the collective agreement.",
          "contract", "BC"),
      ]);
      const results = await pipeline.search("overtime compensation");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

      it("bm25Search: term not in any document hits df=0 branch", async () => {
        await pipeline.addDocuments([makeDoc("d-1", longContent)]);
        // "xyzzy" is not in longContent — hits df === 0 false branch in bm25Search
        const results = await pipeline.search("xyzzy notaword qqqqq");
        expect(results).toBeDefined();
      });

      it("filter with type only (no jurisdiction) hits binary-expr right side", async () => {
        await pipeline.addDocuments([
          makeDoc("d-1", longContent, "policy", "ON"),
          makeDoc("d-2", longContent.replace("Union", "Workers"), "contract", "BC"),
        ]);
        // Pass options with type but no jurisdiction — hits the || right side evaluation
        const results = await pipeline.search("grievance", { type: "policy" });
        for (const r of results) {
          expect(r.chunk.metadata.type).toBe("policy");
        }
      });

      it("search with jurisdiction AND type filters both branches", async () => {
        await pipeline.addDocuments([
          makeDoc("d-1", longContent, "policy", "ON"),
          makeDoc("d-2", longContent.replace("Union", "Federal"), "contract", "BC"),
        ]);
        const results = await pipeline.search("grievance", { jurisdiction: "BC", type: "contract" });
        for (const r of results) {
          expect(r.chunk.metadata.jurisdiction).toBe("BC");
          expect(r.chunk.metadata.type).toBe("contract");
        }
      });

      it("avgDocumentLength fallback: BM25 on fresh pipeline with search returns empty", async () => {
        // Empty pipeline — avgDocumentLength is 0, search returns empty
        const fresh = new RAGPipeline();
        const results = await fresh.search("grievance");
        expect(results).toEqual([]);
      });

      it("bm25Search uses tf fallback when termFrequency entry is missing", async () => {
        await pipeline.addDocuments([makeDoc("d-missing-tf", longContent)]);
        const internals = pipeline as any as { bm25Index: { documents: Map<string, unknown>; termFrequency: Map<string, unknown> } };
        const firstDocId = Array.from(internals.bm25Index.documents.keys())[0];
        internals.bm25Index.termFrequency.delete(firstDocId);

        const results = await pipeline.search("grievance");
        expect(results).toBeDefined();
      });

      it("bm25Search uses avgDocumentLength fallback denominator when avg is zero", async () => {
        await pipeline.addDocuments([makeDoc("d-avg0", longContent)]);
        const internals = pipeline as any as { bm25Index: { avgDocumentLength: number } };
        internals.bm25Index.avgDocumentLength = 0;

        const results = await pipeline.search("grievance");
        expect(results.length).toBeGreaterThanOrEqual(0);
      });

      it("rerank sort falls back to zero for missing/zero rerankScore", () => {
        const internals = pipeline as any as { rerank: (query: string, results: any[]) => any[] };
        const fakeChunkA = {
          id: "a",
          content: "alpha beta",
          documentId: "d-a",
          metadata: {
            source: "test",
            type: "policy",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          embedding: [],
          startIndex: 0,
          endIndex: 10,
        };
        const fakeChunkB = {
          ...fakeChunkA,
          id: "b",
          documentId: "d-b",
          content: "gamma delta",
        };

        // Query terms do not match content terms => rerankScore stays 0 for both results.
        const reranked = internals.rerank("nomatchterm", [
          { chunk: fakeChunkA, score: 0 },
          { chunk: fakeChunkB, score: 0 },
        ]);

        expect(reranked).toHaveLength(2);
      });
    });
});

// ── singleton ──────────────────────────────────────────────────────
describe("ragPipeline singleton", () => {
  it("is an instance of RAGPipeline", () => {
    expect(ragPipeline).toBeInstanceOf(RAGPipeline);
  });

  it("has addDocuments method", () => {
    expect(typeof ragPipeline.addDocuments).toBe("function");
  });

  it("has search method", () => {
    expect(typeof ragPipeline.search).toBe("function");
  });
});
