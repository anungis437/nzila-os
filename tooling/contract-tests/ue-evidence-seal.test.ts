/**
 * Contract Test — UnionEyes: Evidence Scripts Use @nzila/os-core
 *
 * Validates that UE evidence scripts (collect, seal, verify) exist
 * and use the canonical @nzila/os-core seal/verify functions.
 *
 * @invariant INV-35: UE evidence scripts use canonical seal infrastructure
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const UE_EVIDENCE = join(ROOT, 'apps', 'union-eyes', 'scripts', 'evidence');

describe('INV-35 — UE Evidence Scripts Use Canonical Seal', () => {
  it('collect.mjs exists', () => {
    expect(existsSync(join(UE_EVIDENCE, 'collect.mjs'))).toBe(true);
  });

  it('seal.mjs exists and references @nzila/os-core', () => {
    const sealPath = join(UE_EVIDENCE, 'seal.mjs');
    expect(existsSync(sealPath)).toBe(true);

    const content = readFileSync(sealPath, 'utf-8');
    expect(content).toContain('generateSeal');
    expect(content).toContain('seal.json');
    expect(content).toContain('pack.json');
  });

  it('verify.mjs exists and references verifySeal', () => {
    const verifyPath = join(UE_EVIDENCE, 'verify.mjs');
    expect(existsSync(verifyPath)).toBe(true);

    const content = readFileSync(verifyPath, 'utf-8');
    expect(content).toContain('verifySeal');
    // Must exit 1 on failure (CI gate)
    expect(content).toMatch(/process\.exit\s*\(\s*1\s*\)/);
  });

  it('verify.mjs is a CI-blocking gate', () => {
    const content = readFileSync(join(UE_EVIDENCE, 'verify.mjs'), 'utf-8');
    // Must contain language indicating CI failure
    expect(content).toMatch(/CI\s*(MUST|must|should)\s*(fail|FAIL)/i);
  });
});
