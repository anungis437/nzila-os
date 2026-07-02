/**
 * Contract Test — UE Validator Path Repair (Phase 4)
 *
 * Proves the four advisory UE governance validators resolve the CANONICAL
 * nested documentation tree (docs/categories/products-and-market/union-eyes/…)
 * instead of the stale legacy tree (docs/union-eyes/…), via the shared
 * resolver in tooling/scripts/lib/ue-doc-paths.mjs.
 *
 * This test asserts PATH WIRING only — it does not assert validator pass/fail,
 * because remaining validator failures (real missing evidence / content
 * defects) are intentionally out of Phase 4 scope and reported honestly.
 *
 * @invariant INV-PATH-UE: UE validators read the canonical doc corpus
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// Resolver under test (ESM .mjs imported directly).
import {
  resolveUeAreaDir,
  ueCanonicalDir,
  ueLegacyDir,
  ueAreaIsLegacy,
  UE_CANONICAL_BASE,
  UE_LEGACY_BASE,
} from '../scripts/lib/ue-doc-paths.mjs';

const ROOT = join(__dirname, '..', '..');
const SCRIPTS = join(__dirname, '..', 'scripts');

const VALIDATORS = [
  'validate-ue-infrastructure.mjs',
  'validate-runtime-authority-audit.mjs',
  'validate-navigation-monetization.mjs',
  'validate-runtime-convergence.mjs',
];

/** UE areas that have migrated to the canonical tree. */
const CANONICAL_AREAS = [
  'institutional-operating-infrastructure',
  'runtime-authority-audit',
  'navigation-monetization-matrix',
];

describe('INV-PATH-UE — UE validators use the canonical doc corpus', () => {
  it('resolver constants point at the canonical nested base', () => {
    expect(UE_CANONICAL_BASE).toEqual(['docs', 'categories', 'products-and-market', 'union-eyes']);
    expect(UE_LEGACY_BASE).toEqual(['docs', 'union-eyes']);
  });

  it('every repaired validator imports the shared resolver (no hard-coded legacy base)', () => {
    for (const file of VALIDATORS) {
      const src = readFileSync(join(SCRIPTS, file), 'utf-8');
      expect(src, `${file} must import the resolver`).toMatch(
        /from\s+'\.\/lib\/ue-doc-paths\.mjs'/,
      );
      // No remaining hard-coded join into the legacy tree for a named UE area.
      for (const area of [...CANONICAL_AREAS, 'runtime-convergence']) {
        const legacyJoin = new RegExp(
          `'docs',\\s*'union-eyes',\\s*'${area.replace(/[-/]/g, '\\$&')}'`,
        );
        expect(
          legacyJoin.test(src),
          `${file} still hard-codes legacy path for "${area}"`,
        ).toBe(false);
      }
    }
  });

  it('migrated UE areas resolve to the canonical tree on this repo', () => {
    for (const area of CANONICAL_AREAS) {
      const resolved = resolveUeAreaDir(ROOT, area);
      expect(existsSync(resolved), `${area} canonical dir must exist`).toBe(true);
      expect(resolved).toBe(ueCanonicalDir(ROOT, area));
      expect(resolved).toContain(
        join('docs', 'categories', 'products-and-market', 'union-eyes', area),
      );
      expect(ueAreaIsLegacy(ROOT, area), `${area} must not resolve as legacy`).toBe(false);
    }
  });

  it('resolver PREFERS canonical over legacy when both exist (synthetic repo)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ue-paths-'));
    try {
      const area = 'sample-area';
      mkdirSync(join(tmp, ...UE_LEGACY_BASE, area), { recursive: true });
      // Only legacy exists → falls back to legacy.
      expect(resolveUeAreaDir(tmp, area)).toBe(ueLegacyDir(tmp, area));
      expect(ueAreaIsLegacy(tmp, area)).toBe(true);

      // Now add canonical → must prefer canonical.
      mkdirSync(join(tmp, ...UE_CANONICAL_BASE, area), { recursive: true });
      expect(resolveUeAreaDir(tmp, area)).toBe(ueCanonicalDir(tmp, area));
      expect(ueAreaIsLegacy(tmp, area)).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('resolver defaults to canonical path when neither tree exists (clean error target)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ue-paths-none-'));
    try {
      const resolved = resolveUeAreaDir(tmp, 'nonexistent-area');
      expect(resolved).toBe(ueCanonicalDir(tmp, 'nonexistent-area'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
