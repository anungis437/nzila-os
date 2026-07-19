/**
 * UE documentation path resolver (Phase 4 — validator path repair).
 *
 * The Union Eyes governance doc corpus migrated from the legacy tree
 *   docs/union-eyes/<area>/
 * to the canonical nested tree
 *   docs/categories/products-and-market/union-eyes/<area>/
 *
 * Several advisory validators still hard-coded the legacy base and therefore
 * failed on PATH DRIFT rather than on real missing evidence. This helper lets
 * every UE validator resolve a doc area by name, PREFERRING the canonical
 * nested path and falling back to the legacy path only while a given area has
 * not yet been migrated (e.g. runtime-convergence). It fabricates nothing —
 * it only points validators at wherever the real docs actually live.
 *
 * Resolution order for an area:
 *   1. docs/categories/products-and-market/union-eyes/<area>   (canonical)
 *   2. docs/union-eyes/<area>                                  (legacy alias)
 *   3. canonical path (so error messages report the canonical location)
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Canonical nested base, relative to repo root. */
export const UE_CANONICAL_BASE = ['docs', 'categories', 'products-and-market', 'union-eyes'];

/** Legacy base, relative to repo root (temporary compatibility alias). */
export const UE_LEGACY_BASE = ['docs', 'union-eyes'];

/** Absolute canonical directory for a UE doc area. */
export function ueCanonicalDir(repoRoot, area) {
  return path.join(repoRoot, ...UE_CANONICAL_BASE, area);
}

/** Absolute legacy directory for a UE doc area. */
export function ueLegacyDir(repoRoot, area) {
  return path.join(repoRoot, ...UE_LEGACY_BASE, area);
}

/**
 * Resolve a UE doc area directory, preferring the canonical nested path and
 * falling back to the legacy path only if the canonical one is absent.
 * Defaults to the canonical path when neither exists, so "missing evidence"
 * errors report the canonical location operators should populate.
 */
export function resolveUeAreaDir(repoRoot, area) {
  const canonical = ueCanonicalDir(repoRoot, area);
  if (existsSync(canonical)) return canonical;
  const legacy = ueLegacyDir(repoRoot, area);
  if (existsSync(legacy)) return legacy;
  return canonical;
}

/** True when an area still resolves to the legacy tree (migration pending). */
export function ueAreaIsLegacy(repoRoot, area) {
  return !existsSync(ueCanonicalDir(repoRoot, area)) && existsSync(ueLegacyDir(repoRoot, area));
}
