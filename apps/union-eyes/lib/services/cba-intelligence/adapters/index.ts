import type { IngestionAdapter } from "./types";
import { HtmlBulletinAdapter } from "./html-bulletin-adapter";
import { EsdcFederalAdapter } from "./esdc-adapter";
import { CanliiAdapter } from "./canlii-adapter";
import { StatsCanCsvAdapter } from "./statscan-csv-adapter";
import { ProvincialBoardAdapter } from "./provincial-board-adapter";
import { UnionBargainingAdapter } from "./union-bargaining-adapter";
import { FpslrebAdapter } from "./fpslreb-adapter";

export type { IngestionAdapter, DiscoveredDocument, FetchedContent } from "./types";
export { BaseAdapter } from "./base-adapter";
export { HtmlBulletinAdapter } from "./html-bulletin-adapter";
export { EsdcFederalAdapter } from "./esdc-adapter";
export { CanliiAdapter } from "./canlii-adapter";
export { StatsCanCsvAdapter } from "./statscan-csv-adapter";
export { ProvincialBoardAdapter } from "./provincial-board-adapter";
export { UnionBargainingAdapter } from "./union-bargaining-adapter";
export { FpslrebAdapter } from "./fpslreb-adapter";

// ---------------------------------------------------------------------------
// Adapter registry — maps `adapterKey` from source registry to adapter instances
// ---------------------------------------------------------------------------

const adapters: Record<string, IngestionAdapter> = {};

function register(adapter: IngestionAdapter): void {
  adapters[adapter.key] = adapter;
}

// Register built-in adapters
register(new HtmlBulletinAdapter());
register(new EsdcFederalAdapter());
register(new CanliiAdapter());
register(new StatsCanCsvAdapter());
register(new ProvincialBoardAdapter());
register(new UnionBargainingAdapter());
register(new FpslrebAdapter());

/**
 * Get the adapter for a given key, or null if not registered.
 */
export function getAdapter(key: string): IngestionAdapter | null {
  return adapters[key] ?? null;
}

/**
 * Get all registered adapter keys.
 */
export function getRegisteredAdapterKeys(): string[] {
  return Object.keys(adapters);
}
