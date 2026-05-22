/**
 * ARTIFACT TYPE: Runtime Identity — Compatibility Fallbacks
 * MODULE: OCI ↔ OCRA Convergence
 * DOCTRINE_VERSION: 1.0.0
 *
 * Resolvers that consume the alias map. Each resolver is read-only and
 * deterministic. Resolvers refuse rather than guess.
 */

import {
  DB_TABLE_ALIASES,
  ENV_VAR_ALIASES,
  HUBSPOT_PROPERTY_ALIASES,
  ROUTE_ALIASES,
  STRIPE_PRICE_ALIASES,
  type AliasPair,
} from './runtimeIdentityAliasMap';

function findByLegacy(pairs: readonly AliasPair[], legacy: string): AliasPair | undefined {
  return pairs.find((p) => p.legacy === legacy);
}

function findByCanonical(pairs: readonly AliasPair[], canonical: string): AliasPair | undefined {
  return pairs.find((p) => p.canonical === canonical);
}

/**
 * Read an environment variable that may be present under either the legacy
 * `ICRA_*` form or the canonical `OCRA_*` form. Prefers the canonical form
 * when both are present.
 *
 * Returns `undefined` if neither form is present. Never guesses, never
 * coerces.
 */
export function resolveLegacyEnv(
  canonicalName: string,
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const canonicalValue = env[canonicalName];
  const pair = findByCanonical(ENV_VAR_ALIASES, canonicalName);
  if (canonicalValue !== undefined) return canonicalValue;
  if (!pair) return undefined;
  return env[pair.legacy];
}

/**
 * Normalize a request path. Returns the canonical `/api/ocra/*` form if the
 * input matches a known legacy `/api/icra/*` route. Returns the input
 * unchanged otherwise.
 */
export function resolveLegacyRoute(requestPath: string): string {
  // Exact-match aliases first.
  const exact = findByLegacy(ROUTE_ALIASES, requestPath);
  if (exact) return exact.canonical;
  // Prefix replacement for nested paths.
  const prefix = ROUTE_ALIASES.find((p) => requestPath.startsWith(`${p.legacy}/`));
  if (prefix) {
    return prefix.canonical + requestPath.slice(prefix.legacy.length);
  }
  return requestPath;
}

/**
 * Map a Stripe price key (legacy or canonical) to its canonical form.
 * Returns `undefined` if the key is not known to the alias map.
 */
export function resolveLegacyStripePriceKey(key: string): string | undefined {
  return (
    findByCanonical(STRIPE_PRICE_ALIASES, key)?.canonical ??
    findByLegacy(STRIPE_PRICE_ALIASES, key)?.canonical
  );
}

/**
 * Map a HubSpot property name (legacy or canonical) to its canonical form.
 */
export function resolveLegacyHubspotProperty(name: string): string | undefined {
  return (
    findByCanonical(HUBSPOT_PROPERTY_ALIASES, name)?.canonical ??
    findByLegacy(HUBSPOT_PROPERTY_ALIASES, name)?.canonical
  );
}

/**
 * Map a database table name (legacy or canonical) to its canonical form.
 */
export function resolveLegacyDbTable(name: string): string | undefined {
  return (
    findByCanonical(DB_TABLE_ALIASES, name)?.canonical ??
    findByLegacy(DB_TABLE_ALIASES, name)?.canonical
  );
}

/**
 * True when the resolver can express an opinion (i.e. the name is known to
 * either alias category). Useful at boundaries that need to refuse on
 * ambiguity rather than guess.
 */
export function isKnownIdentityAlias(name: string): boolean {
  for (const pairs of [
    ENV_VAR_ALIASES,
    STRIPE_PRICE_ALIASES,
    HUBSPOT_PROPERTY_ALIASES,
    DB_TABLE_ALIASES,
  ]) {
    if (findByLegacy(pairs, name) || findByCanonical(pairs, name)) {
      return true;
    }
  }
  return false;
}
