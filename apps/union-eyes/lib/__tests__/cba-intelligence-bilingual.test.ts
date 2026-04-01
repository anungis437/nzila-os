import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { HtmlBulletinAdapter } from "@/lib/services/cba-intelligence/adapters/html-bulletin-adapter";
import { getAdapter, getRegisteredAdapterKeys } from "@/lib/services/cba-intelligence/adapters";
import { computeFreshnessStatus } from "@/lib/services/cba-intelligence/freshness-service";

// ---------------------------------------------------------------------------
// EN / FR Fixture Data
// ---------------------------------------------------------------------------

const EN_HTML = `
  <html lang="en"><body>
    <h1>Collective Agreement</h1>
    <a href="/docs/cba-cupe-2026.pdf">Collective Agreement – CUPE Local 500</a>
    <a href="/docs/wage-grid-2026.html">Wage Grid and Pay Equity Report 2026</a>
    <a href="/docs/arbitration-award-001.pdf">Arbitration Award – Grievance 2025-44</a>
    <a href="/about">About Us</a>
  </body></html>
`;

const FR_HTML = `
  <html lang="fr"><body>
    <h1>Convention collective</h1>
    <a href="/fr/docs/convention-scfp-2026.pdf">Convention collective – SCFP Section locale 500</a>
    <a href="/fr/docs/grille-salariale-2026.html">Grille salariale et équité salariale 2026</a>
    <a href="/fr/docs/sentence-arbitrale-001.pdf">Sentence arbitrale – Grief 2025-44</a>
    <a href="/fr/a-propos">À propos de nous</a>
  </body></html>
`;

const BILINGUAL_HTML = `
  <html><body>
    <h1>Collective Agreement / Convention collective</h1>
    <a href="/docs/cba-psac-2026.pdf">Collective Agreement – PSAC PA Group / Convention collective – AFPC groupe PA</a>
    <a href="/docs/wage-settlement.html">Wage Settlement / Règlement salarial</a>
  </body></html>
`;

const FR_CLAUSE_CONTENT = `
  <html><body>
    <article>
      <h2>Article 12 – Heures de travail</h2>
      <p>La semaine normale de travail est de trente-cinq (35) heures, du lundi au vendredi.</p>
      <p>Les heures supplémentaires sont rémunérées au taux majoré de cinquante pour cent (50 %).</p>
    </article>
  </body></html>
`;

const EN_CLAUSE_CONTENT = `
  <html><body>
    <article>
      <h2>Article 12 – Hours of Work</h2>
      <p>The normal work week shall be thirty-five (35) hours, Monday to Friday.</p>
      <p>Overtime shall be compensated at one and one-half (1.5) times the hourly rate.</p>
    </article>
  </body></html>
`;

// ---------------------------------------------------------------------------
// Tests — HTML Bulletin Adapter (bilingual discovery)
// ---------------------------------------------------------------------------

describe("HtmlBulletinAdapter – EN/FR bilingual discovery", () => {
  let adapter: HtmlBulletinAdapter;

  beforeEach(() => {
    adapter = new HtmlBulletinAdapter();
  });

  it("discovers CBA-related links from English HTML", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(EN_HTML, { status: 200, headers: { "Content-Type": "text/html" } }),
    );

    const docs = await adapter.discover({ baseUrl: "https://example.ca/en" });

    expect(docs.length).toBeGreaterThanOrEqual(2);
    const urls = docs.map((d) => d.sourceUrl);
    expect(urls).toContain("https://example.ca/docs/cba-cupe-2026.pdf");
    expect(urls).toContain("https://example.ca/docs/wage-grid-2026.html");

    fetchSpy.mockRestore();
  });

  it("discovers CBA-related links from French HTML", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(FR_HTML, { status: 200, headers: { "Content-Type": "text/html" } }),
    );

    const docs = await adapter.discover({ baseUrl: "https://example.ca/fr" });

    expect(docs.length).toBeGreaterThanOrEqual(1);
    const urls = docs.map((d) => d.sourceUrl);
    // At minimum the French collective agreement should match
    expect(urls).toContain("https://example.ca/fr/docs/convention-scfp-2026.pdf");

    fetchSpy.mockRestore();
  });

  it("detects French or bilingual language from French link text", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(FR_HTML, { status: 200, headers: { "Content-Type": "text/html" } }),
    );

    const docs = await adapter.discover({ baseUrl: "https://example.ca/fr" });
    for (const doc of docs) {
      expect(["fr", "bilingual"]).toContain(doc.language);
    }

    fetchSpy.mockRestore();
  });

  it("detects bilingual content from mixed EN/FR HTML", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(BILINGUAL_HTML, { status: 200, headers: { "Content-Type": "text/html" } }),
    );

    const docs = await adapter.discover({ baseUrl: "https://example.ca" });
    expect(docs.length).toBeGreaterThanOrEqual(1);
    // Bilingual links should be detected as bilingual or FR
    const languages = docs.map((d) => d.language);
    expect(languages.some((l) => l === "bilingual" || l === "fr")).toBe(true);

    fetchSpy.mockRestore();
  });

  it("fetches French clause content and returns valid metadata", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(FR_CLAUSE_CONTENT, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const result = await adapter.fetch("https://example.ca/fr/docs/article-12.html", {});
    expect(result.rawContent).toContain("Heures de travail");
    expect(result.wordCount).toBeGreaterThan(10);
    expect(result.contentType).toBe("text/html");

    fetchSpy.mockRestore();
  });

  it("fetches English clause content and returns valid metadata", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(EN_CLAUSE_CONTENT, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const result = await adapter.fetch("https://example.ca/en/docs/article-12.html", {});
    expect(result.rawContent).toContain("Hours of Work");
    expect(result.wordCount).toBeGreaterThan(10);

    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Tests — Adapter registry
// ---------------------------------------------------------------------------

describe("Adapter registry – keys", () => {
  it("includes html_bulletin in registered keys", () => {
    const keys = getRegisteredAdapterKeys();
    expect(keys).toContain("html_bulletin");
  });

  it("returns HtmlBulletinAdapter for 'html_bulletin' key", () => {
    const adapter = getAdapter("html_bulletin");
    expect(adapter).toBeDefined();
    expect(adapter?.key).toBe("html_bulletin");
  });

  it("returns null for unknown key", () => {
    expect(getAdapter("nonexistent_adapter")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — Freshness thresholds (Canadian bilingual context)
// ---------------------------------------------------------------------------

describe("freshness-service – Canadian bilingual thresholds", () => {
  // Federal labour boards (FSLRB) typically have 30-day update cycles
  const federalThresholds = { agingDays: 30, staleDays: 60, expiredDays: 180 };

  // Provincial boards (e.g., OLRB, TAT) update more frequently
  const provincialThresholds = { agingDays: 7, staleDays: 21, expiredDays: 60 };

  it("federal source is fresh within 30 days", () => {
    expect(computeFreshnessStatus(29, federalThresholds)).toBe("fresh");
    expect(computeFreshnessStatus(30, federalThresholds)).toBe("aging");
  });

  it("federal source becomes stale after 60 days", () => {
    expect(computeFreshnessStatus(59, federalThresholds)).toBe("aging");
    expect(computeFreshnessStatus(60, federalThresholds)).toBe("stale");
  });

  it("federal source expires after 180 days", () => {
    expect(computeFreshnessStatus(179, federalThresholds)).toBe("stale");
    expect(computeFreshnessStatus(180, federalThresholds)).toBe("expired");
  });

  it("provincial source is fresh within 7 days", () => {
    expect(computeFreshnessStatus(6, provincialThresholds)).toBe("fresh");
    expect(computeFreshnessStatus(7, provincialThresholds)).toBe("aging");
  });

  it("provincial source becomes stale after 21 days", () => {
    expect(computeFreshnessStatus(20, provincialThresholds)).toBe("aging");
    expect(computeFreshnessStatus(21, provincialThresholds)).toBe("stale");
  });

  it("provincial source expires after 60 days", () => {
    expect(computeFreshnessStatus(59, provincialThresholds)).toBe("stale");
    expect(computeFreshnessStatus(60, provincialThresholds)).toBe("expired");
  });

  it("both jurisdictions return unknown for null days", () => {
    expect(computeFreshnessStatus(null, federalThresholds)).toBe("unknown");
    expect(computeFreshnessStatus(null, provincialThresholds)).toBe("unknown");
  });
});
